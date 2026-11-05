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
import { ImpresionService } from '../perifericos/impresion.service';
import { Ticket } from '../perifericos/escpos';

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
      producto: {
        select: {
          nombre: true,
          destino_impresion: true,
          componentes: { include: { componente: { select: { nombre: true, destino_impresion: true } } } },
        },
      },
      item_opcion: { include: { opcion_modificador: { include: { grupo_modificador: { select: { nombre: true } } } } } },
    },
  },
} satisfies Prisma.pedidoInclude;

export type PedidoComanda = Prisma.pedidoGetPayload<{ include: typeof INCLUIR_COMANDA }>;
type ItemComanda = PedidoComanda['item_pedido'][number];

/** Las bebidas salen de la refrigeradora de caja; lo demás lo prepara el pollero. Un combo puede tener de ambos. */
export const vaACocina = (i: Pick<ItemComanda, 'producto'>) =>
  i.producto.destino_impresion !== 'CAJA' || i.producto.componentes.some((c) => c.componente.destino_impresion !== 'CAJA');
export const tieneBebida = (i: Pick<ItemComanda, 'producto'>) =>
  i.producto.destino_impresion === 'CAJA' || i.producto.componentes.some((c) => c.componente.destino_impresion === 'CAJA');

/** Comandas en preparación que tienen algo para el pollero (los pedidos solo de bebidas no cuentan). */
const PARA_COCINA = {
  estado: 'EN_PREPARACION',
  item_pedido: {
    some: {
      estado: { not: 'ANULADO' },
      producto: { OR: [{ destino_impresion: { not: 'CAJA' } }, { componentes: { some: { componente: { destino_impresion: { not: 'CAJA' } } } } }] },
    },
  },
} satisfies Prisma.pedidoWhereInput;

const INCLUIR_EFECTO = {
  item_pedido: { include: { producto: { include: { componentes: { include: { componente: true } } } }, item_opcion: { include: { opcion_modificador: true } } } },
} satisfies Prisma.pedidoInclude;
type ItemConEfecto = Prisma.item_pedidoGetPayload<{ include: (typeof INCLUIR_EFECTO)['item_pedido']['include'] }>;

/**
 * Pollos y cuartos de presa que consume un ítem (REQ-INV-02). En un combo se suma cada
 * componente (REQ-CAT-03): un componente de pollo sin presa elegida descuenta mitad pecho
 * y mitad pierna (1 pollo = 2 cuartos de pecho + 2 de pierna).
 */
function efectoItem(it: ItemConEfecto) {
  let pecho = 0;
  let pierna = 0;
  for (const io of it.item_opcion) {
    const ef = (io.opcion_modificador.efecto_inventario ?? {}) as Record<string, number>;
    pecho += (ef.cuartos_pecho ?? 0) * it.cantidad;
    pierna += (ef.cuartos_pierna ?? 0) * it.cantidad;
  }
  let pollos = Number(it.producto.fraccion_pollo) * it.cantidad;
  for (const c of it.producto.componentes) {
    const f = Number(c.componente.fraccion_pollo) * c.cantidad * it.cantidad;
    pollos += f;
    pecho += f * 2;
    pierna += f * 2;
  }
  return { pollos, pecho, pierna };
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
    private impresion: ImpresionService,
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
  private async prepararItems(items: ItemEntrada[], tx: Tx, canal = 'SALON') {
    if (!Array.isArray(items) || items.length === 0) throw new BadRequestException('El pedido no tiene productos.');
    const ids = [...new Set(items.map((i) => i.productoId))];
    const productos = await tx.producto.findMany({
      where: { id: { in: ids } },
      include: {
        grupo_modificador: { include: { opcion_modificador: true } },
        precio_canal: { where: { canal } },
        componentes: { include: { componente: { select: { nombre: true, activo: true, agotado: true } } } },
      },
    });
    return items.map((it) => {
      const p = productos.find((x) => x.id === it.productoId);
      if (!p || !p.activo) throw new BadRequestException('Uno de los productos ya no está en la carta.');
      if (p.agotado) throw new BadRequestException(`El producto «${p.nombre}» se agotó hace un momento. Por favor elige otra opción.`);
      const faltante = p.componentes.find((c) => c.componente.agotado || !c.componente.activo);
      if (faltante) throw new BadRequestException(`«${p.nombre}» no está disponible: se agotó ${faltante.componente.nombre}.`);
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
      // REQ-CAT-06: precio del canal (llevar, delivery, apps) si el administrador lo definió
      const precio = aCentimos(p.precio_canal[0]?.precio ?? p.precio) + opciones.reduce((s, o) => s + o.recargo, 0);
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
    const items = await this.prepararItems(datos.items, tx, datos.canal);
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
    const comanda = this.formatoComanda(p);
    if (comanda.items.some((i) => i.cocina)) {
      this.eventos.emitir('cocina:comanda', comanda);
      await this.impresion.imprimir('COCINA', 'COMANDA', this.ticketComanda(comanda, 'cocina'), { pitidos: 3 });
    }
    if (comanda.items.some((i) => i.bebida)) {
      // Las bebidas salen por la ticketera de caja (refrigeradora junto a la caja)
      this.eventos.emitir('bebidas:cambio', { nuevo: comanda.origen });
      await this.impresion.imprimir('CAJA', 'BEBIDAS', this.ticketComanda(comanda, 'bebida', 'BEBIDAS'), { pitidos: 1 });
    }
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
          productoId: i.producto_id,
          opcionIds: i.item_opcion.map((o) => o.opcion_id),
          cantidad: i.cantidad,
          producto: i.producto.nombre,
          destino: i.producto.destino_impresion,
          cocina: vaACocina(i),
          bebida: tieneBebida(i),
          entregadoEn: i.entregado_en,
          precio: Number(i.precio_unitario),
          nota: i.nota,
          opciones: i.item_opcion.map((o) => ({ grupo: o.opcion_modificador.grupo_modificador.nombre, nombre: o.opcion_modificador.nombre })),
          componentes: i.producto.componentes.map((c) => ({ cantidad: c.cantidad * i.cantidad, nombre: c.componente.nombre, destino: c.componente.destino_impresion })),
        })),
    };
  }

  /** Ticket térmico de la comanda: solo lo que prepara cada estación (cocina o bebidas de caja). */
  ticketComanda(c: ReturnType<PedidosService['formatoComanda']>, estacion: 'cocina' | 'bebida', encabezado?: string, detalle?: string) {
    const t = new Ticket();
    if (encabezado) t.titulo(encabezado);
    if (detalle) t.centro(detalle, true);
    t.titulo(c.origen).centro(`Orden #${c.numero} · ${new Date(c.creadoEn).toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' })} · ${c.mozo}`);
    if (c.reposicion) t.centro('*** REPOSICIÓN – SIN COSTO ***', true);
    if (c.horaProgramada) t.centro(`PROGRAMADO para las ${new Date(c.horaProgramada).toLocaleTimeString('es-PE', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit' })}`, true);
    t.separador();
    const deEstacion = (destino: string) => (estacion === 'bebida' ? destino === 'CAJA' : destino !== 'CAJA');
    for (const i of c.items.filter((x) => (estacion === 'cocina' ? x.cocina : x.bebida))) {
      const propio = deEstacion(i.destino);
      t.texto(`${i.cantidad} x ${i.producto}`, { b: true, g: estacion === 'cocina' && propio });
      for (const o of i.opciones) t.texto(`   - ${o.grupo}: ${o.nombre}`);
      for (const comp of i.componentes.filter((x) => deEstacion(x.destino))) t.texto(`   + ${comp.cantidad} ${comp.nombre}`);
      if (i.nota) t.texto(`   NOTA: ${i.nota}`, { b: true });
    }
    if (c.delivery) t.separador().texto(`Cliente: ${c.delivery.cliente} · ${c.delivery.celular}`).texto(`Dirección: ${c.delivery.direccion}`);
    if (c.nombreCliente && !c.delivery) t.separador().texto(`Cliente: ${c.nombreCliente}`, { b: true });
    return t;
  }

  // ---------------------------------------------------------------- Bebidas despachadas por la caja

  /** Pedidos confirmados con bebidas que la caja aún no entrega (las bebidas no van al pollero). */
  async bebidas() {
    const ps = await this.prisma.pedido.findMany({
      where: {
        estado: { in: ['EN_PREPARACION', 'SERVIDO'] },
        // Solo el servicio en curso: una bebida de hace más de 12 h ya no se entrega
        impreso_en: { gte: new Date(Date.now() - 12 * 3_600_000) },
        cuenta: { estado: { not: 'ANULADA' } },
        item_pedido: {
          some: {
            estado: { not: 'ANULADO' },
            entregado_en: null,
            producto: { OR: [{ destino_impresion: 'CAJA' }, { componentes: { some: { componente: { destino_impresion: 'CAJA' } } } }] },
          },
        },
      },
      include: INCLUIR_COMANDA,
      orderBy: { impreso_en: 'asc' },
    });
    return ps.map((p) => {
      const c = this.formatoComanda(p);
      return { ...c, items: c.items.filter((i) => i.bebida && !i.entregadoEn) };
    });
  }

  /** La caja entregó las bebidas del pedido: avisa al mozo para recogerlas (salón). */
  async entregarBebidas(pedidoId: string, usuarioId: string) {
    const p = await this.prisma.pedido.findUnique({ where: { id: pedidoId }, include: INCLUIR_COMANDA });
    if (!p) throw new NotFoundException('Pedido no encontrado');
    const pendientes = p.item_pedido.filter((i) => i.estado !== 'ANULADO' && !i.entregado_en && tieneBebida(i));
    if (!pendientes.length) throw new BadRequestException('Este pedido no tiene bebidas por entregar.');
    await this.prisma.item_pedido.updateMany({ where: { id: { in: pendientes.map((i) => i.id) } }, data: { entregado_en: new Date() } });
    // Un pedido solo de bebidas no pasa por la cocina: queda servido al entregarlas
    const soloBebidas = p.item_pedido.filter((i) => i.estado !== 'ANULADO').every((i) => !vaACocina(i));
    if (soloBebidas && p.estado === 'EN_PREPARACION') await this.prisma.pedido.update({ where: { id: p.id }, data: { estado: 'SERVIDO', servido_en: new Date() } });
    await this.bitacora.registrar('ENTREGAR_BEBIDAS', 'pedido', p.id, usuarioId, { bebidas: pendientes.map((i) => `${i.cantidad}× ${i.producto.nombre}`) });
    const origen = this.origen(p);
    this.eventos.emitir('bebidas:cambio', {});
    if (p.cuenta.sesion_mesa) {
      this.eventos.emitir('alerta', { tipo: 'BEBIDAS', mesaId: p.cuenta.sesion_mesa.mesa_id, mesa: p.cuenta.sesion_mesa.mesa.numero, mensaje: `${p.cuenta.sesion_mesa.mesa.numero}: bebidas listas en caja`, hora: new Date() });
    }
    if (p.canal !== 'SALON') this.eventos.emitir('despacho:cambio');
    return { ok: true, origen };
  }

  // ---------------------------------------------------------------- Personal (tablet o caja)

  async crearDesdePersonal(mesaId: string, items: ItemEntrada[], usuarioId: string, clave?: string) {
    this.salon.verificarBloqueo(mesaId, usuarioId); // REQ-SAL-05: otro mozo está editando la mesa
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
      .findMany({ where: PARA_COCINA, include: INCLUIR_COMANDA, orderBy: { impreso_en: 'asc' } })
      .then((ps) => ps.map((p) => this.formatoComanda(p)));
  }

  /** REQ-QR-07: si la estación del pollero tiene muchas comandas, la carta avisa la demora. */
  async carga() {
    const pendientes = await this.prisma.pedido.count({ where: PARA_COCINA });
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
    // El celular del comensal vibra: «¡Tu pedido está listo!»
    const sesion = await this.prisma.cuenta.findUnique({ where: { id: p.cuenta_id }, select: { sesion_mesa: { select: { mesa_id: true } } } });
    if (sesion?.sesion_mesa) {
      this.eventos.emitir('pedido:listo', { mesaId: sesion.sesion_mesa.mesa_id, pedidoId, numero: p.numero });
      this.eventos.emitir('cuenta:actualizada', { mesaId: sesion.sesion_mesa.mesa_id });
    }
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
        include: {
          producto: { include: { componentes: { include: { componente: true } } } },
          item_opcion: { include: { opcion_modificador: true } },
          pedido: { include: { cuenta: { include: { sesion_mesa: true } } } },
        },
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
    const comanda = this.formatoComanda(p);
    this.eventos.emitir('cocina:especial', { tipo: 'ANULACIÓN', detalle: `${r.item} · ${motivo.trim()}`, comanda, hora: new Date() });
    await this.impresion.imprimir('COCINA', 'ANULACION', new Ticket().titulo('*** ANULACIÓN ***').titulo(comanda.origen).centro(`Orden #${comanda.numero}`).separador().texto(`NO PREPARAR: ${r.item}`, { b: true, g: true }).texto(`Motivo: ${motivo.trim()}`), { pitidos: 2 });
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
    const comanda = this.formatoComanda(p);
    this.eventos.emitir('cocina:especial', { tipo: 'REIMPRESIÓN', detalle: `Orden #${p.numero}`, comanda, hora: new Date() });
    await this.impresion.imprimir('COCINA', 'REIMPRESION', this.ticketComanda(comanda, 'cocina', '*** REIMPRESIÓN ***'), { pitidos: 2 });
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
    const estimados = await this.estimarListo(pedidos.filter((p) => p.estado === 'EN_PREPARACION').map((p) => p.id));
    const calificada = cuenta ? (await this.prisma.calificacion.count({ where: { cuenta_id: cuenta.id } })) > 0 : false;
    const enCurso = cuenta ? await this.prisma.pago_en_linea.aggregate({ where: { cuenta_id: cuenta.id, estado: 'PENDIENTE', expira_en: { gt: new Date() } }, _sum: { monto: true } }) : null;
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
      // Lo que aún se puede pagar en línea (si otro comensal está pagando su parte)
      disponible: Math.max(0, aSoles(aCentimos(cuenta?.saldo ?? 0) - aCentimos(enCurso?._sum.monto ?? 0))),
      calificada,
      comprobantes: cuenta?.comprobante.map((c) => ({ id: c.id, numero: `${c.serie}-${String(c.correlativo).padStart(6, '0')}` })) ?? [],
      pedidos: pedidos.map((p) => ({ ...this.formatoComanda(p), listoEnMin: estimados.get(p.id) ?? null })),
    };
  }

  /**
   * Minutos que faltan para que salga cada pedido: el tiempo promedio de preparación de las
   * últimas 3 horas (o 12 min sin historial) más 1.5 min por cada comanda que está antes en la cola.
   */
  async estimarListo(ids: string[]) {
    const r = new Map<string, number>();
    if (!ids.length) return r;
    const hace3h = new Date(Date.now() - 3 * 3_600_000);
    const recientes = await this.prisma.pedido.findMany({ where: { servido_en: { gte: hace3h }, impreso_en: { not: null }, es_reposicion: false }, select: { impreso_en: true, servido_en: true }, take: 200 });
    const muestras = recientes.map((p) => (+p.servido_en! - +p.impreso_en!) / 60_000).filter((m) => m > 0 && m < 90);
    const promedio = muestras.length >= 3 ? muestras.reduce((s, m) => s + m, 0) / muestras.length : 12;
    const cola = await this.prisma.pedido.findMany({ where: PARA_COCINA, select: { id: true, impreso_en: true }, orderBy: { impreso_en: 'asc' } });
    cola.forEach((p, posicion) => {
      if (!ids.includes(p.id)) return;
      const transcurrido = (Date.now() - +(p.impreso_en ?? new Date())) / 60_000;
      r.set(p.id, Math.max(1, Math.round(promedio + 1.5 * posicion - transcurrido)));
    });
    return r;
  }

  /** El comensal cancela su pedido antes de que el mozo lo confirme (para corregirlo). */
  async cancelarDesdeQR(token: string, pedidoId: string) {
    const { mesa, sesion } = await this.salon.validarToken(token);
    await this.prisma.$transaction(async (tx) => {
      const p = await tx.pedido.findUnique({ where: { id: pedidoId }, include: { cuenta: true } });
      if (!p || p.cuenta.sesion_mesa_id !== sesion.id) throw new NotFoundException('Pedido no encontrado.');
      if (p.estado !== 'POR_CONFIRMAR') throw new BadRequestException('El mozo ya confirmó este pedido y está en cocina. Para cambiarlo, llama al mozo.');
      await tx.pedido.update({ where: { id: p.id }, data: { estado: 'ANULADO' } });
      await this.bitacora.registrar('CANCELAR_PEDIDO_QR', 'pedido', p.id, null, { mesa: mesa.numero, numero: p.numero }, tx);
      await this.recalcularEstadoMesa(tx, mesa.id);
    });
    this.eventos.emitir('mesas:cambio');
    this.eventos.emitir('cuenta:actualizada', { mesaId: mesa.id });
    this.eventos.emitir('pedido:cancelado', { pedidoId, mesaId: mesa.id });
    return { ok: true };
  }

  /** Calificación de la atención al terminar (una por cuenta). */
  async calificar(token: string, estrellas: number, comentario?: string) {
    const { sesion, mesa } = await this.salon.validarToken(token);
    const e = Math.trunc(Number(estrellas));
    if (!(e >= 1 && e <= 5)) throw new BadRequestException('Elige de 1 a 5 estrellas.');
    const cuenta = await this.prisma.cuenta.findFirst({ where: { sesion_mesa_id: sesion.id, estado: { not: 'ANULADA' } }, orderBy: { creada_en: 'desc' } });
    if (!cuenta) throw new BadRequestException('Aún no hay una cuenta en esta mesa.');
    if (await this.prisma.calificacion.findUnique({ where: { cuenta_id: cuenta.id } })) throw new BadRequestException('Ya calificaste esta atención. ¡Gracias!');
    await this.prisma.calificacion.create({ data: { cuenta_id: cuenta.id, estrellas: e, comentario: comentario?.trim().slice(0, 500) || null } });
    if (e <= 2) this.eventos.emitir('alerta', { tipo: 'CALIFICACION', mesaId: mesa.id, mesa: mesa.numero, mensaje: `${mesa.numero} calificó con ${e} estrella(s)${comentario?.trim() ? ': ' + comentario.trim().slice(0, 80) : ''}`, hora: new Date() });
    return { ok: true };
  }
}
