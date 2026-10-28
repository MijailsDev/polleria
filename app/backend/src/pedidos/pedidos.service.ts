import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../comun/prisma.service';
import { BitacoraService } from '../comun/bitacora.service';
import { EventosGateway } from '../eventos/eventos.gateway';
import { SalonService } from '../salon/salon.service';
import { aCentimos, aSoles } from '../comun/dinero';

type Tx = Prisma.TransactionClient;

export interface ItemEntrada {
  productoId: string;
  cantidad: number;
  nota?: string;
  opciones?: string[]; // ids de opcion_modificador elegidas
}

const INCLUIR_COMANDA = {
  usuario: { select: { nombre: true } },
  cuenta: { include: { sesion_mesa: { include: { mesa: { select: { numero: true } } } } } },
  item_pedido: {
    include: {
      producto: { select: { nombre: true, destino_impresion: true } },
      item_opcion: { include: { opcion_modificador: { include: { grupo_modificador: { select: { nombre: true } } } } } },
    },
  },
} satisfies Prisma.pedidoInclude;

type PedidoComanda = Prisma.pedidoGetPayload<{ include: typeof INCLUIR_COMANDA }>;

@Injectable()
export class PedidosService {
  constructor(
    private prisma: PrismaService,
    private eventos: EventosGateway,
    private salon: SalonService,
    private bitacora: BitacoraService,
  ) {}

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
      const opciones: { id: string; recargo: number; efecto: Record<string, number> }[] = [];
      for (const g of p.grupo_modificador) {
        const delGrupo = g.opcion_modificador.filter((o) => elegidas.has(o.id));
        if (delGrupo.length < g.minimo)
          throw new BadRequestException(`Elige ${g.nombre.toLowerCase()} para «${p.nombre}»${g.obligatorio ? ' (obligatorio)' : ''}.`);
        if (delGrupo.length > g.maximo) throw new BadRequestException(`Solo puedes elegir ${g.maximo} en ${g.nombre} de «${p.nombre}».`);
        for (const o of delGrupo) {
          if (o.agotado) throw new BadRequestException(`«${o.nombre}» se agotó hace un momento. Por favor elige otra opción para «${p.nombre}».`);
          opciones.push({ id: o.id, recargo: aCentimos(o.recargo), efecto: (o.efecto_inventario ?? {}) as Record<string, number> });
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
  private async registrar(
    tx: Tx,
    datos: { cuentaId: string; canal: string; estado: string; registradoPor: string | null; items: ItemEntrada[]; clave?: string },
  ) {
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
    return { pedido, repetido: false };
  }

  /** Confirma el pedido: suma a la cuenta, descuenta inventario y lo manda a cocina. */
  private async enviarACocina(tx: Tx, pedidoId: string) {
    const pedido = await tx.pedido.findUniqueOrThrow({
      where: { id: pedidoId },
      include: { item_pedido: { include: { producto: true, item_opcion: { include: { opcion_modificador: true } } } } },
    });
    let total = 0;
    let pollos = 0;
    let pecho = 0;
    let pierna = 0;
    for (const it of pedido.item_pedido) {
      total += aCentimos(it.precio_unitario) * it.cantidad;
      pollos += Number(it.producto.fraccion_pollo) * it.cantidad;
      for (const io of it.item_opcion) {
        const ef = (io.opcion_modificador.efecto_inventario ?? {}) as Record<string, number>;
        pecho += (ef.cuartos_pecho ?? 0) * it.cantidad;
        pierna += (ef.cuartos_pierna ?? 0) * it.cantidad;
      }
    }
    const cuenta = await tx.cuenta.findUniqueOrThrow({ where: { id: pedido.cuenta_id } });
    await tx.cuenta.update({
      where: { id: cuenta.id },
      data: { total: aSoles(aCentimos(cuenta.total) + total), saldo: aSoles(aCentimos(cuenta.saldo) + total) },
    });
    if (pollos || pecho || pierna) {
      await tx.movimiento_inventario.create({
        data: { tipo: 'VENTA', pedido_id: pedido.id, pollos: -pollos, cuartos_pecho: -pecho, cuartos_pierna: -pierna },
      });
    }
    await tx.pedido.update({ where: { id: pedido.id }, data: { estado: 'EN_PREPARACION', impreso_en: new Date() } });
  }

  private async avisarCocina(pedidoId: string) {
    const p = await this.prisma.pedido.findUniqueOrThrow({ where: { id: pedidoId }, include: INCLUIR_COMANDA });
    this.eventos.emitir('cocina:comanda', this.formatoComanda(p));
    this.eventos.emitir('mesas:cambio');
    const mesaId = p.cuenta.sesion_mesa?.mesa_id;
    if (mesaId) this.eventos.emitir('cuenta:actualizada', { mesaId });
  }

  formatoComanda(p: PedidoComanda) {
    return {
      id: p.id,
      numero: p.numero,
      canal: p.canal,
      estado: p.estado,
      origen: p.cuenta.sesion_mesa ? `MESA ${p.cuenta.sesion_mesa.mesa.numero}` : p.canal === 'LLEVAR' ? 'PARA LLEVAR' : p.canal,
      mozo: p.usuario?.nombre ?? 'Pedido QR',
      creadoEn: p.creado_en,
      impresoEn: p.impreso_en,
      servidoEn: p.servido_en,
      items: p.item_pedido
        .filter((i) => i.estado !== 'ANULADO')
        .map((i) => ({
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
  private async recalcularEstadoMesa(tx: Tx, mesaId: string) {
    const mesa = await tx.mesa.findUniqueOrThrow({ where: { id: mesaId } });
    if (mesa.estado === 'CUENTA_SOLICITADA' || mesa.estado === 'POR_LIMPIAR') return;
    const sesion = await tx.sesion_mesa.findFirst({ where: { mesa_id: mesaId, cierre: null }, include: { cuenta: { include: { pedido: true } } } });
    const pedidos = sesion?.cuenta.flatMap((c) => c.pedido) ?? [];
    const estado = pedidos.some((p) => p.estado === 'POR_CONFIRMAR')
      ? 'POR_CONFIRMAR'
      : pedidos.some((p) => p.estado !== 'ANULADO')
        ? 'OCUPADA'
        : 'LIBRE';
    if (estado !== mesa.estado) await tx.mesa.update({ where: { id: mesaId }, data: { estado } });
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

  async servido(pedidoId: string) {
    const p = await this.prisma.pedido.findUnique({ where: { id: pedidoId } });
    if (!p) throw new NotFoundException('Pedido no encontrado');
    if (p.estado !== 'EN_PREPARACION') throw new BadRequestException('Este pedido no está en preparación.');
    await this.prisma.pedido.update({ where: { id: pedidoId }, data: { estado: 'SERVIDO', servido_en: new Date() } });
    this.eventos.emitir('cocina:actualizar', { id: pedidoId, estado: 'SERVIDO' });
    return { ok: true };
  }

  // ---------------------------------------------------------------- Comensal (QR)

  async crearDesdeQR(token: string, items: ItemEntrada[], clave?: string) {
    const { mesa, sesion } = await this.salon.validarToken(token);
    const r = await this.prisma.$transaction(async (tx) => {
      const { cuenta } = await this.salon.sesionAbierta(mesa.id, tx);
      if (cuenta.sesion_mesa_id !== sesion.id) throw new BadRequestException('La atención de esta mesa cambió. Vuelve a escanear el QR.');
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

  /** Precuenta que ve el comensal en su celular (REQ-QR-08). */
  async cuentaQR(token: string) {
    const { mesa, sesion } = await this.salon.validarToken(token);
    const pedidos = await this.prisma.pedido.findMany({
      where: { cuenta: { sesion_mesa_id: sesion.id, estado: 'ABIERTA' }, estado: { not: 'ANULADO' } },
      include: INCLUIR_COMANDA,
      orderBy: { creado_en: 'asc' },
    });
    const confirmados = pedidos.filter((p) => p.estado !== 'POR_CONFIRMAR');
    const total = confirmados.reduce((s, p) => s + p.item_pedido.reduce((t, i) => t + aCentimos(i.precio_unitario) * i.cantidad, 0), 0);
    return {
      mesa: mesa.numero,
      estadoMesa: mesa.estado,
      total: aSoles(total),
      pedidos: pedidos.map((p) => this.formatoComanda(p)),
    };
  }
}
