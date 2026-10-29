import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../comun/prisma.service';
import { BitacoraService } from '../comun/bitacora.service';
import { recalcularCuenta } from '../comun/cuentas';
import { aCentimos, aSoles } from '../comun/dinero';
import { EventosGateway } from '../eventos/eventos.gateway';
import { AuthService } from '../auth/auth.service';
import { INCLUIR_COMANDA, ItemEntrada, PedidosService } from '../pedidos/pedidos.service';

export interface PedidoDespachoEntrada {
  canal: 'LLEVAR' | 'DELIVERY' | 'APP_EXTERNA';
  items: ItemEntrada[];
  clave?: string;
  nombreCliente?: string;
  celular?: string;
  direccion?: string;
  referencia?: string;
  pagaCon?: number;
  horaProgramada?: string;
  codigoPlataforma?: string;
}

const RE_CELULAR = /^9[0-9]{8}$/;

/** Pedidos para llevar, programados, delivery y de aplicaciones externas (F-12). */
@Injectable()
export class DespachoService {
  constructor(
    private prisma: PrismaService,
    private pedidos: PedidosService,
    private eventos: EventosGateway,
    private bitacora: BitacoraService,
    private auth: AuthService,
  ) {}

  /** Autocompleta al cliente de delivery por su celular (REQ-DEL-03). */
  async cliente(celular: string) {
    const c = await this.prisma.cliente.findUnique({
      where: { celular },
      include: { pedido_delivery: { orderBy: { pedido: { creado_en: 'desc' } }, take: 10, select: { direccion: true, referencia: true } } },
    });
    if (!c) return null;
    const vistas = new Set<string>();
    const direcciones = c.pedido_delivery.filter((d) => !vistas.has(d.direccion) && vistas.add(d.direccion)).slice(0, 4);
    return { id: c.id, celular: c.celular, nombre: c.nombre, documento: c.documento, direcciones };
  }

  repartidores() {
    return this.prisma.usuario.findMany({ where: { rol: 'REPARTIDOR', activo: true }, select: { id: true, nombre: true }, orderBy: { nombre: 'asc' } });
  }

  async crear(d: PedidoDespachoEntrada, usuarioId: string) {
    if (!['LLEVAR', 'DELIVERY', 'APP_EXTERNA'].includes(d.canal)) throw new BadRequestException('Canal no válido.');
    const nombre = d.nombreCliente?.trim();
    if (d.canal === 'LLEVAR' && !nombre) throw new BadRequestException('Escribe el nombre del cliente para rotular el pedido.');
    if (d.canal === 'APP_EXTERNA' && !d.codigoPlataforma?.trim()) throw new BadRequestException('Escribe el código del pedido de la aplicación (ej.: PY-9421).');
    if (d.canal === 'DELIVERY') {
      if (!RE_CELULAR.test(d.celular ?? '')) throw new BadRequestException('El celular debe tener 9 dígitos y empezar con 9.');
      if (!nombre) throw new BadRequestException('Escribe el nombre del cliente.');
      if (!d.direccion?.trim()) throw new BadRequestException('Escribe la dirección de entrega.');
    }
    let hora: Date | null = null;
    if (d.horaProgramada) {
      hora = new Date(d.horaProgramada);
      if (isNaN(hora.getTime()) || hora.getTime() < Date.now() + 5 * 60_000) throw new BadRequestException('La hora programada debe ser al menos 5 minutos después de ahora.');
    }
    const turno = await this.prisma.turno.findFirst({ where: { usuario_id: usuarioId, cierre: null } });

    if (d.canal === 'APP_EXTERNA') {
      const repetido = await this.prisma.pago.findUnique({ where: { numero_operacion: `APP-${d.codigoPlataforma!.trim()}`.slice(0, 30) } });
      if (repetido) throw new BadRequestException(`El pedido ${d.codigoPlataforma!.trim()} de la aplicación ya fue registrado.`);
    }
    const r = await this.prisma.$transaction(async (tx) => {
      if (d.clave) {
        const previo = await tx.pedido.findUnique({ where: { clave_idempotencia: d.clave } });
        if (previo) return { pedidoId: previo.id, repetido: true, programado: previo.estado === 'PROGRAMADO' };
      }
      const cuenta = await tx.cuenta.create({ data: {} });
      const { pedido } = await this.pedidos.registrar(tx, {
        cuentaId: cuenta.id,
        canal: d.canal,
        estado: hora ? 'PROGRAMADO' : 'CONFIRMADO',
        registradoPor: usuarioId,
        items: d.items,
        clave: d.clave,
        nombreCliente: nombre,
        codigoPlataforma: d.codigoPlataforma,
        horaProgramada: hora,
      });
      if (!hora) await this.pedidos.enviarACocina(tx, pedido.id);
      const c = await recalcularCuenta(tx, cuenta.id);
      if (d.canal === 'DELIVERY') {
        if (d.pagaCon !== undefined && d.pagaCon !== null && aCentimos(d.pagaCon) > 0 && aCentimos(d.pagaCon) < c.total) {
          throw new BadRequestException(`El cliente paga con S/ ${Number(d.pagaCon).toFixed(2)} pero el pedido es S/ ${aSoles(c.total).toFixed(2)}.`);
        }
        const cliente = await tx.cliente.upsert({ where: { celular: d.celular! }, update: { nombre: nombre! }, create: { celular: d.celular!, nombre: nombre! } });
        await tx.pedido_delivery.create({
          data: { pedido_id: pedido.id, cliente_id: cliente.id, direccion: d.direccion!.trim(), referencia: d.referencia?.trim() || null, paga_con: d.pagaCon ? aSoles(aCentimos(d.pagaCon)) : null },
        });
      }
      if (d.canal === 'APP_EXTERNA') {
        // Prepagado por la plataforma: no entra al efectivo de caja (REQ-DEL-06)
        await tx.pago.create({ data: { cuenta_id: cuenta.id, turno_id: turno?.id ?? null, medio: 'PLATAFORMA_EXTERNA', monto: aSoles(c.total), numero_operacion: `APP-${d.codigoPlataforma!.trim()}`.slice(0, 30) } });
        await recalcularCuenta(tx, cuenta.id);
      }
      await this.bitacora.registrar('PEDIDO_' + d.canal, 'pedido', pedido.id, usuarioId, { total: aSoles(c.total), programado: hora }, tx);
      return { pedidoId: pedido.id, repetido: false, programado: !!hora };
    });
    if (!r.repetido && !r.programado) await this.pedidos.avisarCocina(r.pedidoId);
    this.eventos.emitir('despacho:cambio');
    const p = await this.prisma.pedido.findUniqueOrThrow({ where: { id: r.pedidoId }, include: INCLUIR_COMANDA });
    return { ...this.pedidos.formatoComanda(p), repetido: r.repetido };
  }

  /** Tablero de llevar, delivery y apps del día (REQ-DEL-05). */
  async tablero() {
    const inicio = new Date();
    inicio.setHours(0, 0, 0, 0);
    const ps = await this.prisma.pedido.findMany({
      where: {
        canal: { not: 'SALON' },
        es_reposicion: false,
        OR: [{ creado_en: { gte: inicio } }, { estado: { in: ['PROGRAMADO', 'EN_PREPARACION'] } }, { pedido_delivery: { liquidado: false, estado_despacho: { in: ['PENDIENTE', 'EN_RUTA', 'ENTREGADO'] } } }],
      },
      include: { ...INCLUIR_COMANDA, cuenta: { include: { sesion_mesa: { include: { mesa: { select: { numero: true } } } } } } },
      orderBy: [{ hora_programada: 'asc' }, { creado_en: 'asc' }],
    });
    return ps.map((p) => ({
      ...this.pedidos.formatoComanda(p),
      total: Number(p.cuenta.total),
      saldo: Number(p.cuenta.saldo),
      estadoCuenta: p.cuenta.estado,
    }));
  }

  /** Asignar repartidor y cambiar el estado de despacho, desde la caja o el celular del repartidor. */
  async estado(pedidoId: string, estado: string, repartidorId: string | undefined, usuario: { sub: string; rol: string }) {
    if (!['PENDIENTE', 'EN_RUTA', 'ENTREGADO', 'FALLIDO'].includes(estado)) throw new BadRequestException('Estado no válido.');
    const d = await this.prisma.pedido_delivery.findUnique({ where: { pedido_id: pedidoId }, include: { pedido: true } });
    if (!d) throw new NotFoundException('Pedido de delivery no encontrado');
    if (usuario.rol === 'REPARTIDOR' && d.repartidor_id !== usuario.sub) throw new ForbiddenException('Este pedido no está asignado a ti.');
    if (d.liquidado) throw new BadRequestException('Este pedido ya fue liquidado.');
    const repartidor = estado === 'EN_RUTA' ? repartidorId ?? d.repartidor_id : d.repartidor_id;
    if (estado === 'EN_RUTA') {
      if (!repartidor) throw new BadRequestException('Elige el repartidor.');
      if (d.pedido.estado === 'PROGRAMADO' || d.pedido.estado === 'EN_PREPARACION') throw new BadRequestException('El pedido aún no está listo en cocina.');
    }
    await this.prisma.pedido_delivery.update({
      where: { pedido_id: pedidoId },
      data: { estado_despacho: estado, repartidor_id: repartidor, entregado_en: estado === 'ENTREGADO' ? new Date() : undefined },
    });
    await this.bitacora.registrar('DESPACHO_' + estado, 'pedido', pedidoId, usuario.sub, { repartidor });
    this.eventos.emitir('despacho:cambio');
    if (estado === 'FALLIDO') this.eventos.emitir('alerta', { tipo: 'DELIVERY', mensaje: `Entrega fallida: delivery #D-${String(d.pedido.numero).padStart(2, '0')}`, hora: new Date() });
    return { ok: true };
  }

  /**
   * Entrega fallida (REQ-DEL-08): la caja decide el destino del producto con PIN del administrador.
   * REINGRESO devuelve el pollo al stock; CONSUMO (personal) y MERMA lo registran como merma.
   * Si la cuenta no estaba pagada se anula; si estaba pagada, corresponde una nota de crédito.
   */
  async resolverFallido(pedidoId: string, destino: 'REINGRESO' | 'CONSUMO' | 'MERMA', pinAdmin: string, usuarioId: string) {
    if (!['REINGRESO', 'CONSUMO', 'MERMA'].includes(destino)) throw new BadRequestException('Destino no válido.');
    const autorizadoPor = await this.auth.autorizarAdmin(pinAdmin);
    await this.prisma.$transaction(async (tx) => {
      const d = await tx.pedido_delivery.findUnique({ where: { pedido_id: pedidoId }, include: { pedido: { include: { cuenta: { include: { pago: true } }, movimiento_inventario: true } } } });
      if (!d || d.estado_despacho !== 'FALLIDO') throw new BadRequestException('El pedido no está marcado como entrega fallida.');
      if (d.destino_fallido) throw new BadRequestException('Este pedido ya fue resuelto.');
      const venta = d.pedido.movimiento_inventario.filter((m) => m.tipo === 'VENTA');
      const pollos = -venta.reduce((s, m) => s + Number(m.pollos), 0);
      const pecho = -venta.reduce((s, m) => s + Number(m.cuartos_pecho), 0);
      const pierna = -venta.reduce((s, m) => s + Number(m.cuartos_pierna), 0);
      const motivo = `Entrega fallida #D-${d.pedido.numero}: ${destino === 'REINGRESO' ? 'reingreso al stock' : destino === 'CONSUMO' ? 'consumo del personal' : 'merma'}`;
      if (pollos || pecho || pierna) {
        // Se devuelve lo vendido y, si no se reingresa, se registra como merma
        await tx.movimiento_inventario.create({ data: { tipo: 'AJUSTE', pedido_id: pedidoId, pollos, cuartos_pecho: pecho, cuartos_pierna: pierna, motivo, autorizado_por: autorizadoPor } });
        if (destino !== 'REINGRESO') {
          await tx.movimiento_inventario.create({ data: { tipo: 'MERMA', pedido_id: pedidoId, pollos: -pollos, cuartos_pecho: -pecho, cuartos_pierna: -pierna, motivo, autorizado_por: autorizadoPor } });
        }
      }
      if (!d.pedido.cuenta.pago.length) {
        await tx.cuenta.update({ where: { id: d.pedido.cuenta_id }, data: { estado: 'ANULADA', motivo_anulacion: motivo.slice(0, 150) } });
      }
      await tx.pedido_delivery.update({ where: { pedido_id: pedidoId }, data: { destino_fallido: destino, liquidado: true } });
      await this.bitacora.registrar('RESOLVER_FALLIDO', 'pedido', pedidoId, usuarioId, { destino, autorizadoPor, pagado: d.pedido.cuenta.pago.length > 0 }, tx);
    });
    this.eventos.emitir('despacho:cambio');
    await this.pedidos.controlarStock(true);
    return { ok: true };
  }

  /** Pedidos asignados al repartidor que inició sesión (su celular). */
  async misPedidos(repartidorId: string) {
    const ps = await this.prisma.pedido.findMany({
      where: { pedido_delivery: { repartidor_id: repartidorId, liquidado: false, estado_despacho: { in: ['EN_RUTA', 'ENTREGADO', 'FALLIDO'] } } },
      include: INCLUIR_COMANDA,
      orderBy: { creado_en: 'asc' },
    });
    const cuentas = await this.prisma.cuenta.findMany({ where: { id: { in: ps.map((p) => p.cuenta_id) } } });
    return ps.map((p) => {
      const c = cuentas.find((x) => x.id === p.cuenta_id)!;
      return { ...this.pedidos.formatoComanda(p), total: Number(c.total), saldo: Number(c.saldo) };
    });
  }
}
