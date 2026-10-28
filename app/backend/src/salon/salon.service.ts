import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../comun/prisma.service';
import { EventosGateway } from '../eventos/eventos.gateway';

type Tx = Prisma.TransactionClient;

@Injectable()
export class SalonService {
  constructor(private prisma: PrismaService, private eventos: EventosGateway) {}

  /** Plano del salón: cada mesa con su estado, tiempo y monto acumulado (REQ-SAL-01). */
  async mesas() {
    const mesas = await this.prisma.mesa.findMany({
      where: { activa: true },
      orderBy: { numero: 'asc' },
      include: {
        sesion_mesa: {
          where: { cierre: null },
          include: {
            cuenta: {
              where: { estado: 'ABIERTA' },
              include: { pedido: { where: { estado: 'POR_CONFIRMAR' }, select: { id: true } } },
            },
          },
        },
      },
    });
    return mesas.map((m) => {
      const s = m.sesion_mesa[0];
      const c = s?.cuenta[0];
      return {
        id: m.id,
        numero: m.numero,
        capacidad: m.capacidad,
        estado: m.estado,
        posX: m.pos_x,
        posY: m.pos_y,
        apertura: s?.apertura ?? null,
        cuentaId: c?.id ?? null,
        total: Number(c?.total ?? 0),
        saldo: Number(c?.saldo ?? 0),
        porConfirmar: c?.pedido.length ?? 0,
      };
    });
  }

  /** Sesión abierta de la mesa con su cuenta; si no hay, la crea. */
  async sesionAbierta(mesaId: string, tx: Tx = this.prisma) {
    let sesion = await tx.sesion_mesa.findFirst({ where: { mesa_id: mesaId, cierre: null } });
    if (!sesion) sesion = await tx.sesion_mesa.create({ data: { mesa_id: mesaId } });
    let cuenta = await tx.cuenta.findFirst({ where: { sesion_mesa_id: sesion.id, estado: 'ABIERTA' } });
    if (!cuenta) cuenta = await tx.cuenta.create({ data: { sesion_mesa_id: sesion.id } });
    return { sesion, cuenta };
  }

  async abrir(mesaId: string) {
    const mesa = await this.prisma.mesa.findUnique({ where: { id: mesaId } });
    if (!mesa || !mesa.activa) throw new NotFoundException('Mesa no encontrada');
    if (mesa.estado === 'POR_LIMPIAR') throw new BadRequestException(`La mesa ${mesa.numero} está por limpiar. Márcala como libre primero.`);
    const r = await this.prisma.$transaction(async (tx) => {
      const s = await this.sesionAbierta(mesaId, tx);
      if (mesa.estado === 'LIBRE') await tx.mesa.update({ where: { id: mesaId }, data: { estado: 'OCUPADA' } });
      return s;
    });
    this.eventos.emitir('mesas:cambio');
    return { sesionId: r.sesion.id, cuentaId: r.cuenta.id };
  }

  /** El mozo marca la mesa como libre después de limpiarla: cierra la sesión e invalida el token QR. */
  async liberar(mesaId: string) {
    const mesa = await this.prisma.mesa.findUnique({ where: { id: mesaId } });
    if (!mesa) throw new NotFoundException('Mesa no encontrada');
    const sesion = await this.prisma.sesion_mesa.findFirst({ where: { mesa_id: mesaId, cierre: null }, include: { cuenta: true } });
    const deuda = sesion?.cuenta.find((c) => c.estado === 'ABIERTA' && Number(c.saldo) > 0);
    if (deuda) throw new BadRequestException(`La mesa ${mesa.numero} tiene un saldo pendiente de S/ ${Number(deuda.saldo).toFixed(2)}.`);
    await this.prisma.$transaction(async (tx) => {
      if (sesion) {
        await tx.pedido.updateMany({ where: { cuenta: { sesion_mesa_id: sesion.id }, estado: 'POR_CONFIRMAR' }, data: { estado: 'ANULADO' } });
        await tx.cuenta.updateMany({ where: { sesion_mesa_id: sesion.id, estado: 'ABIERTA' }, data: { estado: 'ANULADA' } });
        await tx.sesion_mesa.update({ where: { id: sesion.id }, data: { cierre: new Date() } });
      }
      await tx.mesa.update({ where: { id: mesaId }, data: { estado: 'LIBRE' } });
    });
    this.eventos.emitir('mesas:cambio');
    return { ok: true };
  }

  /** Transfiere la cuenta completa a otra mesa libre (REQ-SAL-03). */
  async transferir(origenId: string, destinoId: string) {
    const [origen, destino] = await Promise.all([
      this.prisma.mesa.findUnique({ where: { id: origenId } }),
      this.prisma.mesa.findUnique({ where: { id: destinoId } }),
    ]);
    if (!origen || !destino) throw new NotFoundException('Mesa no encontrada');
    if (destino.estado !== 'LIBRE') throw new BadRequestException(`La mesa ${destino.numero} no está libre.`);
    const sesion = await this.prisma.sesion_mesa.findFirst({ where: { mesa_id: origenId, cierre: null } });
    if (!sesion) throw new BadRequestException(`La mesa ${origen.numero} no tiene una cuenta abierta.`);
    await this.prisma.$transaction([
      this.prisma.sesion_mesa.updateMany({ where: { mesa_id: destinoId, cierre: null }, data: { cierre: new Date() } }),
      this.prisma.sesion_mesa.update({ where: { id: sesion.id }, data: { mesa_id: destinoId } }),
      this.prisma.mesa.update({ where: { id: destinoId }, data: { estado: origen.estado } }),
      this.prisma.mesa.update({ where: { id: origenId }, data: { estado: 'LIBRE' } }),
    ]);
    this.eventos.emitir('mesas:cambio');
    return { ok: true };
  }

  // ---------------------------------------------------------------- QR del comensal

  /** Al escanear el QR: une el celular a la sesión de la mesa (REQ-QR-01). */
  async sesionQR(numero: string) {
    const mesa = await this.prisma.mesa.findUnique({ where: { numero } });
    if (!mesa || !mesa.activa) throw new NotFoundException('Esta mesa no existe.');
    if (mesa.estado === 'POR_LIMPIAR') throw new BadRequestException('Esta mesa se está preparando. Solicita ayuda al mozo.');
    const { sesion } = await this.sesionAbierta(mesa.id);
    return { mesa: { id: mesa.id, numero: mesa.numero }, token: sesion.token };
  }

  /** Valida el token del QR: solo sirve mientras la mesa sigue abierta. */
  async validarToken(token: string) {
    const sesion = token
      ? await this.prisma.sesion_mesa.findFirst({ where: { token, cierre: null }, include: { mesa: true } })
      : null;
    if (!sesion) throw new BadRequestException('Esta mesa no tiene una atención activa. Vuelve a escanear el QR o solicita ayuda al mozo.');
    const cuenta = await this.prisma.cuenta.findFirst({ where: { sesion_mesa_id: sesion.id, estado: 'ABIERTA' } });
    return { sesion, mesa: sesion.mesa, cuenta };
  }

  async llamar(token: string, motivo: 'MOZO' | 'CUENTA') {
    const { mesa } = await this.validarToken(token);
    if (motivo === 'CUENTA' && mesa.estado === 'OCUPADA') {
      await this.prisma.mesa.update({ where: { id: mesa.id }, data: { estado: 'CUENTA_SOLICITADA' } });
      this.eventos.emitir('mesas:cambio');
    }
    this.eventos.emitir('alerta', {
      tipo: motivo === 'CUENTA' ? 'CUENTA' : 'LLAMADO',
      mesaId: mesa.id,
      mesa: mesa.numero,
      mensaje: motivo === 'CUENTA' ? `${mesa.numero} pide la cuenta` : `${mesa.numero} llama al mozo`,
      hora: new Date(),
    });
    return { ok: true };
  }
}
