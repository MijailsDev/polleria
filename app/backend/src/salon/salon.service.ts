import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../comun/prisma.service';
import { BitacoraService } from '../comun/bitacora.service';
import { recalcularCuenta } from '../comun/cuentas';
import { EventosGateway } from '../eventos/eventos.gateway';

type Tx = Prisma.TransactionClient;
type Sesion = Prisma.sesion_mesaGetPayload<object>;

@Injectable()
export class SalonService {
  constructor(private prisma: PrismaService, private eventos: EventosGateway, private bitacora: BitacoraService) {}

  /** Plano del salón: cada mesa con su estado, tiempo y monto acumulado (REQ-SAL-01). */
  async mesas() {
    const mesas = await this.prisma.mesa.findMany({
      where: { activa: true },
      orderBy: { numero: 'asc' },
      include: {
        sesion_mesa: {
          where: { cierre: null },
          include: {
            sesion_mesa: { include: { mesa: { select: { numero: true } } } },
            other_sesion_mesa: { where: { cierre: null }, include: { mesa: { select: { numero: true } } } },
            cuenta: {
              where: { estado: 'ABIERTA' },
              include: { pedido: { where: { estado: 'POR_CONFIRMAR' }, select: { id: true } } },
            },
          },
        },
      },
    });
    const porSesion = new Map(mesas.flatMap((m) => m.sesion_mesa.map((s) => [s.id, s] as const)));
    return mesas.map((m) => {
      const propia = m.sesion_mesa[0];
      // Si la mesa está unida a otra, muestra los montos de la cuenta maestra
      const s = propia?.unida_a ? porSesion.get(propia.unida_a) ?? propia : propia;
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
        unidaA: propia?.sesion_mesa?.mesa.numero ?? null,
        unidas: propia?.other_sesion_mesa.map((o) => o.mesa.numero) ?? [],
      };
    });
  }

  /** Si la sesión pertenece a una mesa unida, devuelve la sesión de la mesa maestra. */
  async efectiva(tx: Tx, sesion: Sesion) {
    return sesion.unida_a ? tx.sesion_mesa.findUniqueOrThrow({ where: { id: sesion.unida_a } }) : sesion;
  }

  /** Sesión abierta de la mesa (o la de su mesa maestra) con su cuenta; si no hay, la crea. */
  async sesionAbierta(mesaId: string, tx: Tx = this.prisma) {
    let propia = await tx.sesion_mesa.findFirst({ where: { mesa_id: mesaId, cierre: null } });
    if (!propia) propia = await tx.sesion_mesa.create({ data: { mesa_id: mesaId } });
    const sesion = await this.efectiva(tx, propia);
    let cuenta = await tx.cuenta.findFirst({ where: { sesion_mesa_id: sesion.id, estado: 'ABIERTA' } });
    if (!cuenta) cuenta = await tx.cuenta.create({ data: { sesion_mesa_id: sesion.id } });
    return { sesion, cuenta, propia };
  }

  /** Cambia el estado de una mesa y de las mesas unidas a ella. */
  async estadoMesa(tx: Tx, mesaId: string, estado: string) {
    await tx.mesa.update({ where: { id: mesaId }, data: { estado } });
    const s = await tx.sesion_mesa.findFirst({ where: { mesa_id: mesaId, cierre: null }, include: { other_sesion_mesa: { where: { cierre: null } } } });
    const unidas = s?.other_sesion_mesa.map((o) => o.mesa_id) ?? [];
    if (unidas.length) await tx.mesa.updateMany({ where: { id: { in: unidas } }, data: { estado } });
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
    const propia = await this.prisma.sesion_mesa.findFirst({ where: { mesa_id: mesaId, cierre: null } });
    if (propia?.unida_a && mesa.estado !== 'POR_LIMPIAR') throw new BadRequestException(`La mesa ${mesa.numero} está unida a otra. Sepárala primero.`);
    const sesion = propia && !propia.unida_a ? await this.prisma.sesion_mesa.findUnique({ where: { id: propia.id }, include: { cuenta: true, other_sesion_mesa: { where: { cierre: null } } } }) : null;
    const deuda = sesion?.cuenta.find((c) => c.estado === 'ABIERTA' && Number(c.saldo) > 0);
    if (deuda) throw new BadRequestException(`La mesa ${mesa.numero} tiene un saldo pendiente de S/ ${Number(deuda.saldo).toFixed(2)}.`);
    if (sesion?.other_sesion_mesa.length && mesa.estado !== 'POR_LIMPIAR') throw new BadRequestException('Esta mesa tiene otras unidas. Sepáralas o cobra la cuenta primero.');
    await this.prisma.$transaction(async (tx) => {
      if (sesion) {
        await tx.pedido.updateMany({ where: { cuenta: { sesion_mesa_id: sesion.id }, estado: 'POR_CONFIRMAR' }, data: { estado: 'ANULADO' } });
        await tx.cuenta.updateMany({ where: { sesion_mesa_id: sesion.id, estado: 'ABIERTA' }, data: { estado: 'ANULADA' } });
        // Las mesas unidas a esta se liberan junto con ella
        const unidas = sesion.other_sesion_mesa;
        if (unidas.length) {
          await tx.sesion_mesa.updateMany({ where: { id: { in: unidas.map((u) => u.id) } }, data: { cierre: new Date() } });
          await tx.mesa.updateMany({ where: { id: { in: unidas.map((u) => u.mesa_id) } }, data: { estado: 'LIBRE' } });
        }
      }
      if (propia) await tx.sesion_mesa.update({ where: { id: propia.id }, data: { cierre: new Date() } });
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
    const sesion = await this.prisma.sesion_mesa.findFirst({ where: { mesa_id: origenId, cierre: null }, include: { other_sesion_mesa: { where: { cierre: null } } } });
    if (!sesion) throw new BadRequestException(`La mesa ${origen.numero} no tiene una cuenta abierta.`);
    if (sesion.unida_a || sesion.other_sesion_mesa.length) throw new BadRequestException('Separa las mesas unidas antes de transferir.');
    await this.prisma.$transaction([
      this.prisma.sesion_mesa.updateMany({ where: { mesa_id: destinoId, cierre: null }, data: { cierre: new Date() } }),
      this.prisma.sesion_mesa.update({ where: { id: sesion.id }, data: { mesa_id: destinoId } }),
      this.prisma.mesa.update({ where: { id: destinoId }, data: { estado: origen.estado } }),
      this.prisma.mesa.update({ where: { id: origenId }, data: { estado: 'LIBRE' } }),
    ]);
    this.eventos.emitir('mesas:cambio');
    return { ok: true };
  }

  /**
   * Une la mesa «otra» a la mesa maestra: sus pedidos pasan a la cuenta maestra (REQ-SAL-04).
   * Se recuerda la cuenta original de cada pedido para poder separarlas después.
   */
  async unir(maestraId: string, otraId: string, usuarioId: string) {
    if (maestraId === otraId) throw new BadRequestException('Elige otra mesa.');
    await this.prisma.$transaction(async (tx) => {
      const [m, o] = await Promise.all([tx.mesa.findUnique({ where: { id: maestraId } }), tx.mesa.findUnique({ where: { id: otraId } })]);
      if (!m || !o) throw new NotFoundException('Mesa no encontrada');
      for (const x of [m, o]) {
        if (!['OCUPADA', 'POR_CONFIRMAR', 'CUENTA_SOLICITADA'].includes(x.estado)) throw new BadRequestException(`La mesa ${x.numero} debe estar ocupada para unirla.`);
      }
      const sm = await tx.sesion_mesa.findFirst({ where: { mesa_id: maestraId, cierre: null } });
      const so = await tx.sesion_mesa.findFirst({ where: { mesa_id: otraId, cierre: null }, include: { other_sesion_mesa: { where: { cierre: null } } } });
      if (!sm || !so) throw new BadRequestException('Las dos mesas deben tener una cuenta abierta.');
      if (sm.unida_a || so.unida_a || so.other_sesion_mesa.length) throw new BadRequestException('Una de las mesas ya está unida a otra.');
      const cm = (await this.sesionAbierta(maestraId, tx)).cuenta;
      const co = await tx.cuenta.findFirst({ where: { sesion_mesa_id: so.id, estado: 'ABIERTA' }, include: { pago: true } });
      if (co?.pago.length) throw new BadRequestException(`La mesa ${o.numero} ya tiene pagos parciales; no se puede unir.`);
      if (co) {
        await tx.pedido.updateMany({ where: { cuenta_id: co.id }, data: { cuenta_id: cm.id, cuenta_original_id: co.id } });
        await tx.cuenta.update({ where: { id: co.id }, data: { total: 0, saldo: 0 } });
      }
      await tx.sesion_mesa.update({ where: { id: so.id }, data: { unida_a: sm.id } });
      await recalcularCuenta(tx, cm.id);
      await tx.mesa.update({ where: { id: otraId }, data: { estado: m.estado } });
      await this.bitacora.registrar('UNIR_MESAS', 'mesa', maestraId, usuarioId, { maestra: m.numero, unida: o.numero }, tx);
    });
    this.eventos.emitir('mesas:cambio');
    return { ok: true };
  }

  /** Separa una mesa unida mientras no se haya cobrado nada de la cuenta maestra. */
  async separar(mesaId: string, usuarioId: string) {
    await this.prisma.$transaction(async (tx) => {
      const so = await tx.sesion_mesa.findFirst({ where: { mesa_id: mesaId, cierre: null }, include: { mesa: true } });
      if (!so?.unida_a) throw new BadRequestException('Esta mesa no está unida a otra.');
      const cm = await tx.cuenta.findFirst({ where: { sesion_mesa_id: so.unida_a, estado: 'ABIERTA' }, include: { pago: true } });
      if (cm?.pago.length) throw new BadRequestException('La cuenta maestra ya tiene pagos; no se puede separar.');
      const co = await tx.cuenta.findFirst({ where: { sesion_mesa_id: so.id }, orderBy: { creada_en: 'desc' } });
      if (co && cm) {
        await tx.pedido.updateMany({ where: { cuenta_id: cm.id, cuenta_original_id: co.id }, data: { cuenta_id: co.id, cuenta_original_id: null } });
        await tx.cuenta.update({ where: { id: co.id }, data: { estado: 'ABIERTA' } });
        await recalcularCuenta(tx, co.id);
        await recalcularCuenta(tx, cm.id);
      }
      await tx.sesion_mesa.update({ where: { id: so.id }, data: { unida_a: null } });
      await tx.mesa.update({ where: { id: mesaId }, data: { estado: 'OCUPADA' } });
      await this.bitacora.registrar('SEPARAR_MESAS', 'mesa', mesaId, usuarioId, { mesa: so.mesa.numero }, tx);
    });
    this.eventos.emitir('mesas:cambio');
    return { ok: true };
  }

  // ---------------------------------------------------------------- QR del comensal

  async numeros() {
    const ms = await this.prisma.mesa.findMany({ where: { activa: true }, orderBy: { numero: 'asc' }, select: { numero: true } });
    return ms.map((m) => m.numero);
  }

  /** Al escanear el QR: une el celular a la sesión de la mesa (REQ-QR-01). */
  async sesionQR(numero: string) {
    const mesa = await this.prisma.mesa.findUnique({ where: { numero } });
    if (!mesa || !mesa.activa) throw new NotFoundException('Esta mesa no existe.');
    if (mesa.estado === 'POR_LIMPIAR') {
      // Recién pagada: el comensal aún puede ver su cuenta y su boleta hasta que el mozo libere la mesa
      const abierta = await this.prisma.sesion_mesa.findFirst({ where: { mesa_id: mesa.id, cierre: null } });
      if (!abierta) throw new BadRequestException('Esta mesa se está preparando. Solicita ayuda al mozo.');
      return { mesa: { id: mesa.id, numero: mesa.numero }, token: abierta.token };
    }
    const { propia } = await this.sesionAbierta(mesa.id);
    return { mesa: { id: mesa.id, numero: mesa.numero }, token: propia.token };
  }

  /** Valida el token del QR: solo sirve mientras la mesa sigue abierta. Devuelve la sesión efectiva (maestra si está unida). */
  async validarToken(token: string) {
    const propia = token ? await this.prisma.sesion_mesa.findFirst({ where: { token, cierre: null }, include: { mesa: true } }) : null;
    if (!propia) throw new BadRequestException('Esta mesa no tiene una atención activa. Vuelve a escanear el QR o solicita ayuda al mozo.');
    const sesion = await this.efectiva(this.prisma, propia);
    const cuenta = await this.prisma.cuenta.findFirst({ where: { sesion_mesa_id: sesion.id, estado: 'ABIERTA' } });
    const maestra = sesion.id === propia.id ? propia.mesa : await this.prisma.mesa.findUniqueOrThrow({ where: { id: sesion.mesa_id } });
    return { sesion, mesa: propia.mesa, maestra, cuenta };
  }

  async llamar(token: string, motivo: 'MOZO' | 'CUENTA') {
    const { mesa, maestra } = await this.validarToken(token);
    if (motivo === 'CUENTA' && maestra.estado === 'OCUPADA') {
      await this.prisma.$transaction((tx) => this.estadoMesa(tx, maestra.id, 'CUENTA_SOLICITADA'));
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
