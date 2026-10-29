import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../comun/prisma.service';
import { BitacoraService } from '../comun/bitacora.service';
import { ConfigService } from '../comun/config.service';
import { recalcularCuenta } from '../comun/cuentas';
import { EventosGateway } from '../eventos/eventos.gateway';
import { SalonService } from '../salon/salon.service';
import { AuthService } from '../auth/auth.service';
import { aCentimos, aSoles } from '../comun/dinero';

type Tx = Prisma.TransactionClient;

export interface ItemEntrada {
  productoId: string;
  cantidad: number;
  nota?: string;
  opciones?: string[]; // ids de opcion_modificador elegidas
}

export interface DatosPedido {
  cuentaId: string;
  canal: string;
  estado: string;
  registradoPor: string | null;
  items: ItemEntrada[];
  clave?: string;
  nombreCliente?: string | null;
  codigoPlataforma?: string | null;
  horaProgramada?: Date | null;
}

export const INCLUIR_COMANDA = {
  usuario: { select: { nombre: true } },
  cuenta: { include: { sesion_mesa: { include: { mesa: { select: { numero: true } } } } } },
  pedido_delivery: { include: { cliente: true, usuario: { select: { nombre: true } } } },
  item_pedido: {
    include: {
      producto: { select: { nombre: true, destino_impresion: true } },
      item_opcion: { include: { opcion_modificador: { include: { grupo_modificador: { select: { nombre: true } } } } } },
    },
  },
} satisfies Prisma.pedidoInclude;

export type PedidoComanda = Prisma.pedidoGetPayload<{ include: typeof INCLUIR_COMANDA }>;

const INCLUIR_EFECTO = { item_pedido: { include: { producto: true, item_opcion: { include: { opcion_modificador: true } } } } } satisfies Prisma.pedidoInclude;
type ItemConEfecto = Prisma.item_pedidoGetPayload<{ include: (typeof INCLUIR_EFECTO)['item_pedido']['include'] }>;

/** Pollos y cuartos de presa que consume un ítem (REQ-INV-02). */
function efectoItem(it: ItemConEfecto) {
  let pecho = 0;
  let pierna = 0;
  for (const io of it.item_opcion) {
    const ef = (io.opcion_modificador.efecto_inventario ?? {}) as Record<string, number>;
    pecho += (ef.cuartos_pecho ?? 0) * it.cantidad;
    pierna += (ef.cuartos_pierna ?? 0) * it.cantidad;
  }
  return { pollos: Number(it.producto.fraccion_pollo) * it.cantidad, pecho, pierna };
}

@Injectable()
export class PedidosService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Programados');
  private reloj?: NodeJS.Timeout;

  constructor(
    private prisma: PrismaService,
    private eventos: EventosGateway,
    private salon: SalonService,
    private bitacora: BitacoraService,
    private config: ConfigService,
    private auth: AuthService,
  ) {}

  // Libera a cocina los pedidos programados cuando llega su hora (REQ-DEL-02)
  onModuleInit() {
    this.reloj = setInterval(() => this.liberarProgramados().catch((e) => this.log.error(e.message)), 30_000);
  }
  onModuleDestroy() {
    clearInterval(this.reloj);
  }

  /**
   * Valida los ítems contra la carta (RN-01: modificadores obligatorios, agotados)
   * y calcula el precio de cada uno con sus recargos.
   */
  private async prepararItems(items: ItemEntrada[], tx: Tx) {
    if (!Array.isArray(items) || items.length === 0) throw new BadRequestException('El pedido no tiene productos.');
    const ids = [...new Set(items.map((i) => i.productoId))];
    const productos = await tx.producto.findMany({
      where: { id: { in: ids } },
      include: { grupo_modificador: { include: { opcion_modificador: true } } },
    });
    return items.map((it) => {
      const p = productos.find((x) => x.id === it.productoId);
      if (!p || !p.activo) throw new BadRequestException('Uno de los productos ya no está en la carta.');
      if (p.agotado) throw new BadRequestException(`El producto «${p.nombre}» se agotó hace un momento. Por favor elige otra opción.`);
      const cantidad = Math.trunc(Number(it.cantidad));
      if (!(cantidad >= 1 && cantidad <= 50)) throw new BadRequestException(`Cantidad inválida para «${p.nombre}».`);
      const elegidas = new Set(it.opciones ?? []);
      const opciones: { id: string; recargo: number }[] = [];
      for (const g of p.grupo_modificador) {
        const delGrupo = g.opcion_modificador.filter((o) => elegidas.has(o.id));
        if (delGrupo.length < g.minimo)
          throw new BadRequestException(`Elige ${g.nombre.toLowerCase()} para «${p.nombre}»${g.obligatorio ? ' (obligatorio)' : ''}.`);
        if (delGrupo.length > g.maximo) throw new BadRequestException(`Solo puedes elegir ${g.maximo} en ${g.nombre} de «${p.nombre}».`);
        for (const o of delGrupo) {
          if (o.agotado) {
            // REQ-AGO-05: sugerir la otra presa disponible
            const otra = g.opcion_modificador.find((x) => !x.agotado && x.id !== o.id);
            throw new BadRequestException(`«${o.nombre}» se agotó.${otra ? ` Solo tenemos ${otra.nombre}, ¿deseas continuar?` : ''} (${p.nombre})`);
          }
          opciones.push({ id: o.id, recargo: aCentimos(o.recargo) });
          elegidas.delete(o.id);
        }
      }
      if (elegidas.size) throw new BadRequestException(`Hay opciones que no corresponden a «${p.nombre}».`);
      const precio = aCentimos(p.precio) + opciones.reduce((s, o) => s + o.recargo, 0);
      const nota = it.nota?.trim().slice(0, 100) || null;
      return { producto: p, cantidad, nota, opciones, precio };
    });
  }

  private async numeroDelDia(tx: Tx) {
    const inicio = new Date();
    inicio.setHours(0, 0, 0, 0);
    return (await tx.pedido.count({ where: { creado_en: { gte: inicio } } })) + 1;
  }

  /** Registra un pedido (con su clave de idempotencia para no duplicar ante reintentos, RNF-INT-01). */
  async registrar(tx: Tx, datos: DatosPedido) {
    if (datos.clave) {
      const previo = await tx.pedido.findUnique({ where: { clave_idempotencia: datos.clave } });
      if (previo) return { pedido: previo, repetido: true };
    }
    const items = await this.prepararItems(datos.items, tx);
    const pedido = await tx.pedido.create({
      data: {
        cuenta_id: datos.cuentaId,
        registrado_por: datos.registradoPor,
        numero: await this.numeroDelDia(tx),
        canal: datos.canal,
        estado: datos.estado,
        nombre_cliente: datos.nombreCliente?.trim() || null,
        codigo_plataforma: datos.codigoPlataforma?.trim() || null,
        hora_programada: datos.horaProgramada ?? null,
        ...(datos.clave ? { clave_idempotencia: datos.clave } : {}),
      },
    });
    for (const it of items) {
      await tx.item_pedido.create({
        data: {
          pedido_id: pedido.id,
          producto_id: it.producto.id,
          cantidad: it.cantidad,
          precio_unitario: aSoles(it.precio),
          nota: it.nota,
          item_opcion: { create: it.opciones.map((o) => ({ opcion_id: o.id, recargo: aSoles(o.recargo) })) },
        },
      });
    }
    if (datos.estado === 'PROGRAMADO') await recalcularCuenta(tx, datos.cuentaId);
    return { pedido, repetido: false };
  }

  /** Confirma el pedido: descuenta inventario, lo manda a cocina y recalcula la cuenta. */
  async enviarACocina(tx: Tx, pedidoId: string, mov: { tipo: 'VENTA' | 'REPOSICION'; motivo?: string; autorizadoPor?: string } = { tipo: 'VENTA' }) {
    const pedido = await tx.pedido.findUniqueOrThrow({ where: { id: pedidoId }, include: INCLUIR_EFECTO });
    const ef = pedido.item_pedido.filter((i) => i.estado !== 'ANULADO').map(efectoItem);
    const pollos = ef.reduce((s, e) => s + e.pollos, 0);
    const pecho = ef.reduce((s, e) => s + e.pecho, 0);
    const pierna = ef.reduce((s, e) => s + e.pierna, 0);
    if (pollos || pecho || pierna) {
      await tx.movimiento_inventario.create({
        data: {
          tipo: mov.tipo,
          pedido_id: pedido.id,
          pollos: -pollos,
          cuartos_pecho: -pecho,
          cuartos_pierna: -pierna,
          motivo: mov.motivo,
          autorizado_por: mov.autorizadoPor,
        },
      });
    }
    await tx.pedido.update({ where: { id: pedido.id }, data: { estado: 'EN_PREPARACION', impreso_en: new Date() } });
    await recalcularCuenta(tx, pedido.cuenta_id);
  }

  /** Stock teórico actual a partir del kardex. */
  async stock(tx: Tx = this.prisma) {
    const s = await tx.movimiento_inventario.aggregate({ _sum: { pollos: true, cuartos_pecho: true, cuartos_pierna: true } });
    return { pollos: Number(s._sum.pollos ?? 0), pecho: Number(s._sum.cuartos_pecho ?? 0), pierna: Number(s._sum.cuartos_pierna ?? 0) };
  }

  /**
   * REQ-AGO-03: si el stock de una presa baja del umbral, marca agotadas las opciones que la usan
   * y avisa a caja y mozos. Con «liberar» (tras un ingreso de pollos) las vuelve a habilitar.
   */
  async controlarStock(liberar = false) {
    const st = await this.stock();
    const umbral = this.config.numero('umbral_presas');
    const opciones = await this.prisma.opcion_modificador.findMany({ where: { efecto_inventario: { not: Prisma.DbNull } } });
    const cambios: string[] = [];
    for (const o of opciones) {
      const ef = (o.efecto_inventario ?? {}) as Record<string, number>;
      const falta = (ef.cuartos_pecho > 0 && st.pecho < Math.max(umbral, ef.cuartos_pecho)) || (ef.cuartos_pierna > 0 && st.pierna < Math.max(umbral, ef.cuartos_pierna));
      if (falta && !o.agotado) {
        await this.prisma.opcion_modificador.update({ where: { id: o.id }, data: { agotado: true } });
        cambios.push(o.nombre);
      } else if (!falta && o.agotado && liberar) {
        await this.prisma.opcion_modificador.update({ where: { id: o.id }, data: { agotado: false } });
      }
    }
    if (cambios.length) {
      const nombres = [...new Set(cambios)].join(', ');
      await this.bitacora.registrar('AGOTADO_AUTOMATICO', 'opcion_modificador', null, null, { opciones: nombres, stock: st });
      this.eventos.emitir('alerta', { tipo: 'STOCK', mensaje: `Se agotó: ${nombres} (stock bajo de presas)`, hora: new Date() });
    }
    if (cambios.length || liberar) this.eventos.emitir('carta:actualizada');
    if (st.pollos < this.config.numero('minimo_pollos')) {
      this.eventos.emitir('inventario:alerta', { mensaje: `Quedan ${st.pollos.toFixed(3)} pollos`, stock: st });
    }
    return st;
  }

  async avisarCocina(pedidoId: string) {
    const p = await this.prisma.pedido.findUniqueOrThrow({ where: { id: pedidoId }, include: INCLUIR_COMANDA });
    this.eventos.emitir('cocina:comanda', this.formatoComanda(p));
    this.eventos.emitir('mesas:cambio');
    if (p.canal !== 'SALON') this.eventos.emitir('despacho:cambio');
    const mesaId = p.cuenta.sesion_mesa?.mesa_id;
    if (mesaId) this.eventos.emitir('cuenta:actualizada', { mesaId });
    await this.controlarStock();
  }

  /** Rótulo de la comanda: MESA M-04, PARA LLEVAR #18 – Carlos, DELIVERY #D-05 o APP #PY-9421 (REQ-COC-02). */
  origen(p: Pick<PedidoComanda, 'canal' | 'numero' | 'nombre_cliente' | 'codigo_plataforma' | 'cuenta'>) {
    if (p.cuenta.sesion_mesa) return `MESA ${p.cuenta.sesion_mesa.mesa.numero}`;
    if (p.canal === 'LLEVAR') return `PARA LLEVAR #${p.numero}${p.nombre_cliente ? ' – ' + p.nombre_cliente : ''}`;
    if (p.canal === 'DELIVERY') return `DELIVERY #D-${String(p.numero).padStart(2, '0')}`;
    if (p.canal === 'APP_EXTERNA') return `APP #${p.codigo_plataforma ?? p.numero}`;
    return p.canal;
  }

  formatoComanda(p: PedidoComanda) {
    return {
      id: p.id,
      cuentaId: p.cuenta_id,
      numero: p.numero,
      canal: p.canal,
      estado: p.estado,
      origen: this.origen(p),
      mozo: p.usuario?.nombre ?? (p.canal === 'SALON' ? 'Pedido QR' : 'Caja'),
      nombreCliente: p.nombre_cliente,
      codigoPlataforma: p.codigo_plataforma,
      horaProgramada: p.hora_programada,
      reposicion: p.es_reposicion,
      creadoEn: p.creado_en,
      impresoEn: p.impreso_en,
      servidoEn: p.servido_en,
      delivery: p.pedido_delivery
        ? {
            cliente: p.pedido_delivery.cliente.nombre,
            celular: p.pedido_delivery.cliente.celular,
            direccion: p.pedido_delivery.direccion,
            referencia: p.pedido_delivery.referencia,
            pagaCon: p.pedido_delivery.paga_con === null ? null : Number(p.pedido_delivery.paga_con),
            estado: p.pedido_delivery.estado_despacho,
            repartidorId: p.pedido_delivery.repartidor_id,
            repartidor: p.pedido_delivery.usuario?.nombre ?? null,
            liquidado: p.pedido_delivery.liquidado,
            destinoFallido: p.pedido_delivery.destino_fallido,
          }
        : null,
      items: p.item_pedido
        .filter((i) => i.estado !== 'ANULADO')
        .map((i) => ({
          id: i.id,
          cantidad: i.cantidad,
          producto: i.producto.nombre,
          destino: i.producto.destino_impresion,
          precio: Number(i.precio_unitario),
          nota: i.nota,
          opciones: i.item_opcion.map((o) => ({ grupo: o.opcion_modificador.grupo_modificador.nombre, nombre: o.opcion_modificador.nombre })),
        })),
    };
  }

  // ---------------------------------------------------------------- Personal (tablet o caja)

  async crearDesdePersonal(mesaId: string, items: ItemEntrada[], usuarioId: string, clave?: string) {
    const { pedidoId, repetido } = await this.prisma.$transaction(async (tx) => {
      const mesa = await tx.mesa.findUnique({ where: { id: mesaId } });
      if (!mesa) throw new NotFoundException('Mesa no encontrada');
      if (mesa.estado === 'POR_LIMPIAR') throw new BadRequestException(`La mesa ${mesa.numero} está por limpiar.`);
      const { cuenta } = await this.salon.sesionAbierta(mesaId, tx);
      await this.verificarSinPagoEnCurso(tx, cuenta.id);
      const r = await this.registrar(tx, { cuentaId: cuenta.id, canal: 'SALON', estado: 'CONFIRMADO', registradoPor: usuarioId, items, clave });
      if (!r.repetido) {
        await this.enviarACocina(tx, r.pedido.id);
        if (mesa.estado === 'LIBRE') await tx.mesa.update({ where: { id: mesaId }, data: { estado: 'OCUPADA' } });
      }
      return { pedidoId: r.pedido.id, repetido: r.repetido };
    });
    if (!repetido) await this.avisarCocina(pedidoId);
    return { pedidoId, repetido };
  }

  /** REQ-PAG-03: mientras el comensal paga en línea, la cuenta no acepta nuevos ítems. */
  async verificarSinPagoEnCurso(tx: Tx, cuentaId: string) {
    const enCurso = await tx.pago_en_linea.findFirst({ where: { cuenta_id: cuentaId, estado: 'PENDIENTE', expira_en: { gt: new Date() } } });
    if (enCurso) throw new BadRequestException('Hay un pago en línea en curso para esta cuenta. Espera a que termine (máximo 10 minutos).');
  }

  /** El mozo confirma un pedido hecho desde el QR (REQ-MOZ-04). */
  async confirmar(pedidoId: string, usuarioId: string) {
    await this.prisma.$transaction(async (tx) => {
      const p = await tx.pedido.findUnique({ where: { id: pedidoId }, include: { cuenta: { include: { sesion_mesa: true } } } });
      if (!p) throw new NotFoundException('Pedido no encontrado');
      if (p.estado !== 'POR_CONFIRMAR') throw new BadRequestException('Este pedido ya fue atendido.');
      await tx.pedido.update({ where: { id: p.id }, data: { estado: 'CONFIRMADO', registrado_por: usuarioId } });
      await this.enviarACocina(tx, p.id);
      const mesaId = p.cuenta.sesion_mesa?.mesa_id;
      if (mesaId) await this.recalcularEstadoMesa(tx, mesaId);
    });
    await this.avisarCocina(pedidoId);
    return { ok: true };
  }

  async rechazar(pedidoId: string, usuarioId: string) {
    const mesaId = await this.prisma.$transaction(async (tx) => {
      const p = await tx.pedido.findUnique({ where: { id: pedidoId }, include: { cuenta: { include: { sesion_mesa: true } } } });
      if (!p) throw new NotFoundException('Pedido no encontrado');
      if (p.estado !== 'POR_CONFIRMAR') throw new BadRequestException('Este pedido ya fue atendido.');
      await tx.pedido.update({ where: { id: p.id }, data: { estado: 'ANULADO' } });
      await this.bitacora.registrar('RECHAZAR_PEDIDO_QR', 'pedido', p.id, usuarioId, undefined, tx);
      const mesaId = p.cuenta.sesion_mesa?.mesa_id;
      if (mesaId) await this.recalcularEstadoMesa(tx, mesaId);
      return mesaId;
    });
    this.eventos.emitir('mesas:cambio');
    if (mesaId) this.eventos.emitir('cuenta:actualizada', { mesaId });
    return { ok: true };
  }

  /** Amarillo si hay pedidos QR por confirmar; si no, ocupada o libre según la cuenta. */
  async recalcularEstadoMesa(tx: Tx, mesaId: string) {
    let mesa = await tx.mesa.findUniqueOrThrow({ where: { id: mesaId } });
    const propia = await tx.sesion_mesa.findFirst({ where: { mesa_id: mesaId, cierre: null } });
    if (propia?.unida_a) {
      const maestra = await tx.sesion_mesa.findUniqueOrThrow({ where: { id: propia.unida_a } });
      mesa = await tx.mesa.findUniqueOrThrow({ where: { id: maestra.mesa_id } });
    }
    if (mesa.estado === 'CUENTA_SOLICITADA' || mesa.estado === 'POR_LIMPIAR') return;
    const sesion = await tx.sesion_mesa.findFirst({ where: { mesa_id: mesa.id, cierre: null }, include: { cuenta: { include: { pedido: true } } } });
    const pedidos = sesion?.cuenta.filter((c) => c.estado !== 'ANULADA').flatMap((c) => c.pedido) ?? [];
    const estado = pedidos.some((p) => p.estado === 'POR_CONFIRMAR')
      ? 'POR_CONFIRMAR'
      : pedidos.some((p) => p.estado !== 'ANULADO')
        ? 'OCUPADA'
        : 'LIBRE';
    if (estado !== mesa.estado) await this.salon.estadoMesa(tx, mesa.id, estado);
  }

  porConfirmar() {
    return this.prisma.pedido
      .findMany({ where: { estado: 'POR_CONFIRMAR' }, include: INCLUIR_COMANDA, orderBy: { creado_en: 'asc' } })
      .then((ps) => ps.map((p) => this.formatoComanda(p)));
  }

  /** Comandas que la estación del pollero aún no despacha (simula la ticketera). */
  cocina() {
    return this.prisma.pedido
      .findMany({ where: { estado: 'EN_PREPARACION' }, include: INCLUIR_COMANDA, orderBy: { impreso_en: 'asc' } })
      .then((ps) => ps.map((p) => this.formatoComanda(p)));
  }

  /** REQ-QR-07: si la estación del pollero tiene muchas comandas, la carta avisa la demora. */
  async carga() {
    const pendientes = await this.prisma.pedido.count({ where: { estado: 'EN_PREPARACION' } });
    const umbral = this.config.numero('umbral_cola_cocina');
    return { pendientes, umbral, demora: pendientes > umbral };
  }

  /** Servido (salón) o listo para entregar (llevar y delivery). Registra la hora para medir tiempos (REQ-COC-07). */
  async servido(pedidoId: string) {
    const p = await this.prisma.pedido.findUnique({ where: { id: pedidoId } });
    if (!p) throw new NotFoundException('Pedido no encontrado');
    if (p.estado !== 'EN_PREPARACION') throw new BadRequestException('Este pedido no está en preparación.');
    await this.prisma.pedido.update({ where: { id: pedidoId }, data: { estado: 'SERVIDO', servido_en: new Date() } });
    this.eventos.emitir('cocina:actualizar', { id: pedidoId, estado: 'SERVIDO' });
    if (p.canal !== 'SALON') this.eventos.emitir('despacho:cambio');
    return { ok: true };
  }

  // ---------------------------------------------------------------- Anulaciones, reposiciones y reimpresiones (RN-04)

  /**
   * Anula un ítem ya comandado con PIN del administrador (REQ-MOZ-05). Si aún no se sirvió,
   * devuelve las presas al inventario (REQ-INV-02) y la cocina recibe un ticket ANULACIÓN.
   */
  async anularItem(itemId: string, motivo: string, pinAdmin: string, usuarioId: string) {
    if (!motivo?.trim()) throw new BadRequestException('Escribe el motivo de la anulación.');
    const autorizadoPor = await this.auth.autorizarAdmin(pinAdmin);
    const r = await this.prisma.$transaction(async (tx) => {
      const it = await tx.item_pedido.findUnique({
        where: { id: itemId },
        include: { producto: true, item_opcion: { include: { opcion_modificador: true } }, pedido: { include: { cuenta: { include: { sesion_mesa: true } } } } },
      });
      if (!it || it.estado === 'ANULADO') throw new NotFoundException('El ítem ya no existe o ya fue anulado.');
      const p = it.pedido;
      if (p.cuenta.estado !== 'ABIERTA') throw new BadRequestException('La cuenta ya está cerrada. Para devolver dinero usa una nota de crédito.');
      await tx.item_pedido.update({ where: { id: it.id }, data: { estado: 'ANULADO' } });
      if (p.estado === 'EN_PREPARACION' || p.estado === 'CONFIRMADO') {
        const ef = efectoItem(it);
        if (ef.pollos || ef.pecho || ef.pierna) {
          await tx.movimiento_inventario.create({
            data: { tipo: 'AJUSTE', pedido_id: p.id, pollos: ef.pollos, cuartos_pecho: ef.pecho, cuartos_pierna: ef.pierna, motivo: `Anulación antes de preparar: ${motivo.trim()}`, autorizado_por: autorizadoPor },
          });
        }
      }
      const activos = await tx.item_pedido.count({ where: { pedido_id: p.id, estado: { not: 'ANULADO' } } });
      if (activos === 0) await tx.pedido.update({ where: { id: p.id }, data: { estado: 'ANULADO' } });
      const c = await recalcularCuenta(tx, p.cuenta_id);
      if (c.pagado > c.total) throw new BadRequestException('Esa parte de la cuenta ya se cobró. Usa una nota de crédito.');
      if (c.estado === 'PAGADA' && p.cuenta.sesion_mesa) await this.salon.estadoMesa(tx, p.cuenta.sesion_mesa.mesa_id, 'POR_LIMPIAR');
      await this.bitacora.registrar('ANULAR_ITEM', 'item_pedido', it.id, usuarioId, {
        producto: it.producto.nombre,
        cantidad: it.cantidad,
        importe: aSoles(aCentimos(it.precio_unitario) * it.cantidad),
        motivo: motivo.trim(),
        autorizadoPor,
      }, tx);
      return { pedidoId: p.id, item: `${it.cantidad}× ${it.producto.nombre}`, mesaId: p.cuenta.sesion_mesa?.mesa_id };
    });
    const p = await this.prisma.pedido.findUniqueOrThrow({ where: { id: r.pedidoId }, include: INCLUIR_COMANDA });
    this.eventos.emitir('cocina:especial', { tipo: 'ANULACIÓN', detalle: `${r.item} · ${motivo.trim()}`, comanda: this.formatoComanda(p), hora: new Date() });
    this.eventos.emitir('cocina:actualizar', { id: r.pedidoId });
    this.eventos.emitir('mesas:cambio');
    this.eventos.emitir('despacho:cambio');
    if (r.mesaId) this.eventos.emitir('cuenta:actualizada', { mesaId: r.mesaId });
    await this.controlarStock(true);
    return { ok: true };
  }

  /**
   * Reposición por reclamo (REQ-INV-05): vuelve a preparar el ítem sin costo para el cliente,
   * con ticket REPOSICIÓN – SIN COSTO; el pollo usado queda en el kardex como REPOSICION.
   */
  async reponer(itemId: string, motivo: string, pinAdmin: string, usuarioId: string) {
    if (!motivo?.trim()) throw new BadRequestException('Escribe el motivo del reclamo.');
    const autorizadoPor = await this.auth.autorizarAdmin(pinAdmin);
    const pedidoId = await this.prisma.$transaction(async (tx) => {
      const it = await tx.item_pedido.findUnique({ where: { id: itemId }, include: { item_opcion: true, pedido: { include: { cuenta: true } }, producto: true } });
      if (!it || it.estado === 'ANULADO') throw new NotFoundException('Ítem no encontrado.');
      if (it.pedido.cuenta.estado === 'ANULADA') throw new BadRequestException('La cuenta está anulada.');
      const nuevo = await tx.pedido.create({
        data: {
          cuenta_id: it.pedido.cuenta_id,
          registrado_por: usuarioId,
          numero: await this.numeroDelDia(tx),
          canal: it.pedido.canal,
          estado: 'CONFIRMADO',
          es_reposicion: true,
          nombre_cliente: it.pedido.nombre_cliente,
          item_pedido: {
            create: [{
              producto_id: it.producto_id,
              cantidad: it.cantidad,
              precio_unitario: 0,
              nota: `REPOSICIÓN: ${motivo.trim()}`.slice(0, 100),
              item_opcion: { create: it.item_opcion.map((o) => ({ opcion_id: o.opcion_id, recargo: 0 })) },
            }],
          },
        },
      });
      await this.enviarACocina(tx, nuevo.id, { tipo: 'REPOSICION', motivo: motivo.trim(), autorizadoPor });
      await this.bitacora.registrar('REPOSICION', 'item_pedido', it.id, usuarioId, { producto: it.producto.nombre, cantidad: it.cantidad, motivo: motivo.trim(), autorizadoPor }, tx);
      return nuevo.id;
    });
    await this.avisarCocina(pedidoId);
    return { ok: true, pedidoId };
  }

  /** Reimprime una comanda con la marca REIMPRESIÓN (REQ-COC-06). */
  async reimprimir(pedidoId: string, usuarioId: string) {
    const p = await this.prisma.pedido.findUnique({ where: { id: pedidoId }, include: INCLUIR_COMANDA });
    if (!p) throw new NotFoundException('Pedido no encontrado');
    await this.bitacora.registrar('REIMPRIMIR_COMANDA', 'pedido', p.id, usuarioId, { numero: p.numero });
    this.eventos.emitir('cocina:especial', { tipo: 'REIMPRESIÓN', detalle: `Orden #${p.numero}`, comanda: this.formatoComanda(p), hora: new Date() });
    return { ok: true };
  }

  // ---------------------------------------------------------------- Pedidos programados (REQ-DEL-02)

  async liberarProgramados() {
    const limite = new Date(Date.now() + this.config.numero('anticipacion_programados') * 60_000);
    const pendientes = await this.prisma.pedido.findMany({ where: { estado: 'PROGRAMADO', hora_programada: { lte: limite } }, select: { id: true, numero: true } });
    for (const p of pendientes) {
      await this.prisma.$transaction((tx) => this.enviarACocina(tx, p.id));
      await this.bitacora.registrar('LIBERAR_PROGRAMADO', 'pedido', p.id, null, { numero: p.numero });
      this.log.log(`Pedido programado #${p.numero} enviado a cocina`);
      await this.avisarCocina(p.id);
    }
    return pendientes.length;
  }

  // ---------------------------------------------------------------- Comensal (QR)

  async crearDesdeQR(token: string, items: ItemEntrada[], clave?: string) {
    const { mesa, sesion, maestra } = await this.salon.validarToken(token);
    if (maestra.estado === 'POR_LIMPIAR') throw new BadRequestException('La cuenta de esta mesa ya se cerró. Pide ayuda al mozo para un nuevo pedido.');
    const r = await this.prisma.$transaction(async (tx) => {
      const { cuenta } = await this.salon.sesionAbierta(mesa.id, tx);
      if (cuenta.sesion_mesa_id !== sesion.id) throw new BadRequestException('La atención de esta mesa cambió. Vuelve a escanear el QR.');
      await this.verificarSinPagoEnCurso(tx, cuenta.id);
      const res = await this.registrar(tx, { cuentaId: cuenta.id, canal: 'SALON', estado: 'POR_CONFIRMAR', registradoPor: null, items, clave });
      if (!res.repetido) await this.recalcularEstadoMesa(tx, mesa.id);
      return res;
    });
    if (!r.repetido) {
      this.eventos.emitir('mesas:cambio');
      this.eventos.emitir('alerta', {
        tipo: 'PEDIDO_QR',
        mesaId: mesa.id,
        mesa: mesa.numero,
        pedidoId: r.pedido.id,
        mensaje: `${mesa.numero}: pedido QR por confirmar`,
        hora: new Date(),
      });
      this.eventos.emitir('cuenta:actualizada', { mesaId: mesa.id });
    }
    return { pedidoId: r.pedido.id, estado: r.pedido.estado };
  }

  /** Precuenta que ve el comensal en su celular (REQ-QR-08), con el estado del pago en línea. */
  async cuentaQR(token: string) {
    const { mesa, maestra, sesion } = await this.salon.validarToken(token);
    const cuenta = await this.prisma.cuenta.findFirst({
      where: { sesion_mesa_id: sesion.id, estado: { not: 'ANULADA' } },
      orderBy: { creada_en: 'desc' },
      include: { comprobante: { where: { tipo: { not: 'NOTA_CREDITO' } }, select: { id: true, serie: true, correlativo: true } }, pago_en_linea: { where: { estado: 'PENDIENTE', expira_en: { gt: new Date() } } } },
    });
    const pedidos = cuenta
      ? await this.prisma.pedido.findMany({ where: { cuenta_id: cuenta.id, estado: { not: 'ANULADO' } }, include: INCLUIR_COMANDA, orderBy: { creado_en: 'asc' } })
      : [];
    return {
      mesa: mesa.numero,
      maestra: maestra.numero !== mesa.numero ? maestra.numero : null,
      estadoMesa: maestra.estado,
      cuentaId: cuenta?.id ?? null,
      estadoCuenta: cuenta?.estado ?? 'ABIERTA',
      total: Number(cuenta?.total ?? 0),
      saldo: Number(cuenta?.saldo ?? 0),
      descuento: Number(cuenta?.descuento ?? 0),
      porConfirmar: pedidos.some((p) => p.estado === 'POR_CONFIRMAR'),
      pagoEnCurso: cuenta?.pago_en_linea[0]?.id ?? null,
      comprobantes: cuenta?.comprobante.map((c) => ({ id: c.id, numero: `${c.serie}-${String(c.correlativo).padStart(6, '0')}` })) ?? [],
      pedidos: pedidos.map((p) => this.formatoComanda(p)),
    };
  }
}
