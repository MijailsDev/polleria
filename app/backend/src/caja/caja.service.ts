import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../comun/prisma.service';
import { BitacoraService } from '../comun/bitacora.service';
import { ConfigService } from '../comun/config.service';
import { numeroComprobante, recalcularCuenta } from '../comun/cuentas';
import { EventosGateway } from '../eventos/eventos.gateway';
import { AuthService } from '../auth/auth.service';
import { INCLUIR_COMANDA, PedidosService } from '../pedidos/pedidos.service';
import { SalonService } from '../salon/salon.service';
import { ComprobantesService, RE_DNI, RE_RUC } from './comprobantes.service';
import { aCentimos, aSoles } from '../comun/dinero';

export interface PagoEntrada {
  medio: 'EFECTIVO' | 'YAPE' | 'PLIN' | 'TARJETA';
  monto: number;
  recibido?: number;
  numeroOperacion?: string;
}
export interface ComprobanteEntrada {
  tipo: 'BOLETA' | 'FACTURA';
  documento?: string;
  nombre?: string;
}

const CANALES: Record<string, string> = { SALON: 'Salón', LLEVAR: 'Para llevar', DELIVERY: 'Delivery', APP_EXTERNA: 'Apps' };

@Injectable()
export class CajaService {
  constructor(
    private prisma: PrismaService,
    private eventos: EventosGateway,
    private bitacora: BitacoraService,
    private config: ConfigService,
    private auth: AuthService,
    private pedidos: PedidosService,
    private salon: SalonService,
    private comprobantes: ComprobantesService,
  ) {}

  // ---------------------------------------------------------------- Turnos (F-11)

  turnoAbierto(usuarioId: string) {
    return this.prisma.turno.findFirst({ where: { usuario_id: usuarioId, cierre: null } });
  }

  async turnoActual(usuarioId: string) {
    const t = await this.turnoAbierto(usuarioId);
    // Arqueo ciego: no se devuelve ningún total esperado
    return t ? { id: t.id, apertura: t.apertura, fondoInicial: Number(t.fondo_inicial), declarado: t.efectivo_declarado !== null } : null;
  }

  async abrirTurno(usuarioId: string, fondoInicial: number) {
    if (!(Number(fondoInicial) >= 0)) throw new BadRequestException('Ingresa un fondo inicial válido.');
    if (await this.turnoAbierto(usuarioId)) throw new BadRequestException('Ya tienes un turno abierto.');
    const t = await this.prisma.turno.create({ data: { usuario_id: usuarioId, fondo_inicial: aSoles(aCentimos(fondoInicial)) } });
    await this.bitacora.registrar('ABRIR_TURNO', 'turno', t.id, usuarioId, { fondoInicial });
    return { id: t.id };
  }

  async movimiento(usuarioId: string, tipo: 'INGRESO' | 'EGRESO', monto: number, motivo: string, pinAdmin?: string) {
    const t = await this.turnoAbierto(usuarioId);
    if (!t) throw new BadRequestException('Abre tu turno de caja primero.');
    const cent = aCentimos(monto);
    if (cent <= 0) throw new BadRequestException('Ingresa un monto mayor a cero.');
    if (!motivo?.trim()) throw new BadRequestException('Escribe el motivo del movimiento.');
    let autorizadoPor: string | null = null;
    const limite = this.config.numero('limite_egreso');
    if (tipo === 'EGRESO' && cent > aCentimos(limite)) {
      if (!pinAdmin) throw new BadRequestException(`Los egresos mayores a S/ ${limite.toFixed(2)} requieren el PIN del administrador.`);
      autorizadoPor = await this.auth.autorizarAdmin(pinAdmin);
    }
    const m = await this.prisma.movimiento_caja.create({
      data: { turno_id: t.id, tipo, monto: aSoles(cent), motivo: motivo.trim(), autorizado_por: autorizadoPor },
    });
    await this.bitacora.registrar(`MOVIMIENTO_${tipo}`, 'movimiento_caja', m.id, usuarioId, { monto, motivo, autorizadoPor });
    if (tipo === 'EGRESO') this.eventos.emitir('gaveta:abrir', { motivo: 'Egreso de caja' });
    return { ok: true };
  }

  /** Apertura de gaveta sin venta: requiere PIN del administrador y queda registrada (REQ-CAJ-06). */
  async abrirGaveta(usuarioId: string, motivo: string, pinAdmin: string) {
    if (!motivo?.trim()) throw new BadRequestException('Escribe el motivo.');
    const autorizadoPor = await this.auth.autorizarAdmin(pinAdmin);
    await this.bitacora.registrar('ABRIR_GAVETA', 'turno', null, usuarioId, { motivo: motivo.trim(), autorizadoPor });
    this.eventos.emitir('gaveta:abrir', { motivo: motivo.trim() });
    return { ok: true };
  }

  private async resumenTurno(turnoId: string) {
    const t = await this.prisma.turno.findUniqueOrThrow({
      where: { id: turnoId },
      include: {
        pago: { include: { cuenta: { include: { pedido: { select: { canal: true }, take: 1, orderBy: { creado_en: 'asc' } }, pedido_pedido_cuenta_original_idTocuenta: { select: { canal: true }, take: 1 } } } } },
        movimiento_caja: true,
        usuario: { select: { nombre: true } },
      },
    });
    const desde = t.apertura;
    const hasta = t.cierre ?? new Date();
    const porMedio: Record<string, number> = { EFECTIVO: 0, YAPE: 0, PLIN: 0, TARJETA: 0, PLATAFORMA_EXTERNA: 0 };
    const porCanal: Record<string, number> = {};
    let delivery = 0;
    for (const p of t.pago) {
      const cent = aCentimos(p.monto);
      porMedio[p.medio] = (porMedio[p.medio] ?? 0) + cent;
      const canal = p.cuenta.pedido[0]?.canal ?? p.cuenta.pedido_pedido_cuenta_original_idTocuenta[0]?.canal ?? 'SALON';
      porCanal[canal] = (porCanal[canal] ?? 0) + cent;
      if (canal === 'DELIVERY' && p.medio === 'EFECTIVO') delivery += cent;
    }
    const ingresos = t.movimiento_caja.filter((m) => m.tipo === 'INGRESO').reduce((s, m) => s + aCentimos(m.monto), 0);
    const egresos = t.movimiento_caja.filter((m) => m.tipo === 'EGRESO').reduce((s, m) => s + aCentimos(m.monto), 0);
    const esperadoEfectivo = aCentimos(t.fondo_inicial) + porMedio.EFECTIVO + ingresos - egresos;
    const cuentasIds = [...new Set(t.pago.map((p) => p.cuenta_id))];
    const comprobantes = await this.prisma.comprobante.findMany({
      where: { OR: [{ cuenta_id: { in: cuentasIds }, tipo: { not: 'NOTA_CREDITO' } }, { tipo: 'NOTA_CREDITO', emitido_en: { gte: desde, lte: hasta } }] },
      select: { tipo: true, serie: true, correlativo: true, total: true },
      orderBy: [{ serie: 'asc' }, { correlativo: 'asc' }],
    });
    const descuentos = await this.prisma.cuenta.aggregate({ where: { id: { in: cuentasIds } }, _sum: { descuento: true } });
    const eventos = await this.prisma.bitacora.findMany({ where: { fecha: { gte: desde, lte: hasta }, accion: { in: ['ANULAR_ITEM', 'FUGA_COMENSAL'] } } });
    const suma = (accion: string, campo: string) =>
      eventos.filter((e) => e.accion === accion).reduce((s, e) => s + aCentimos((e.valores_despues as Record<string, number>)?.[campo] ?? 0), 0);
    const mermas = await this.prisma.movimiento_inventario.aggregate({
      where: { fecha: { gte: desde, lte: hasta }, tipo: { in: ['MERMA', 'REPOSICION'] } },
      _sum: { pollos: true },
      _count: true,
    });
    return {
      t,
      porMedio,
      porCanal,
      delivery,
      ingresos,
      egresos,
      esperadoEfectivo,
      comprobantes,
      descuentos: aCentimos(descuentos._sum.descuento),
      anulaciones: { cantidad: eventos.filter((e) => e.accion === 'ANULAR_ITEM').length, importe: suma('ANULAR_ITEM', 'importe') },
      fugas: { cantidad: eventos.filter((e) => e.accion === 'FUGA_COMENSAL').length, importe: suma('FUGA_COMENSAL', 'total') },
      mermas: { cantidad: mermas._count, pollos: -Number(mermas._sum.pollos ?? 0) },
    };
  }

  /**
   * Cierre con arqueo ciego (REQ-TUR-03/04): el cajero declara lo contado sin ver lo esperado.
   * La primera declaración queda guardada; si la diferencia supera el margen se pide un comentario.
   */
  async cerrarTurno(usuarioId: string, efectivoDeclarado: number, comentario?: string) {
    const t = await this.turnoAbierto(usuarioId);
    if (!t) throw new BadRequestException('No tienes un turno abierto.');
    const otros = await this.prisma.turno.count({ where: { cierre: null, id: { not: t.id } } });
    if (!otros) {
      // El último turno abierto no puede cerrar con cuentas pendientes de cobro
      const abiertas = await this.prisma.cuenta.findMany({
        where: { estado: 'ABIERTA', saldo: { gt: 0 } },
        include: { sesion_mesa: { include: { mesa: { select: { numero: true } } } }, pedido: { select: { canal: true, numero: true }, take: 1 } },
      });
      if (abiertas.length) {
        const lista = abiertas.map((c) => c.sesion_mesa?.mesa.numero ?? `${CANALES[c.pedido[0]?.canal] ?? 'Pedido'} #${c.pedido[0]?.numero ?? ''}`).join(', ');
        throw new BadRequestException(`Hay ${abiertas.length} cuenta(s) abierta(s) con saldo (${lista}). Cóbralas antes de cerrar.`);
      }
    }
    let declarado = t.efectivo_declarado;
    if (declarado === null) {
      if (!(Number(efectivoDeclarado) >= 0)) throw new BadRequestException('Ingresa el efectivo contado.');
      declarado = new Prisma.Decimal(aSoles(aCentimos(efectivoDeclarado)));
      await this.prisma.turno.update({ where: { id: t.id }, data: { efectivo_declarado: declarado } });
    }
    const r = await this.resumenTurno(t.id);
    const diferencia = aCentimos(declarado) - r.esperadoEfectivo;
    if (Math.abs(diferencia) > aCentimos(this.config.numero('margen_arqueo')) && !comentario?.trim()) {
      return { cerrado: false, requiereComentario: true, esperado: aSoles(r.esperadoEfectivo), declarado: Number(declarado), diferencia: aSoles(diferencia) };
    }
    await this.prisma.turno.update({
      where: { id: t.id },
      data: { cierre: new Date(), diferencia: aSoles(diferencia), comentario: comentario?.trim() || null },
    });
    await this.bitacora.registrar('CERRAR_TURNO', 'turno', t.id, usuarioId, { declarado: Number(declarado), diferencia: aSoles(diferencia) });
    return { cerrado: true, reporte: await this.reporteZ(t.id) };
  }

  /** Reporte Z del turno (REQ-TUR-05). Reporte X = el mismo cálculo con el turno abierto (solo administrador). */
  async reporteZ(turnoId: string) {
    const r = await this.resumenTurno(turnoId);
    const ventas = Object.values(r.porMedio).reduce((s, v) => s + v, 0);
    const nc = r.comprobantes.filter((c) => c.tipo === 'NOTA_CREDITO');
    return {
      turnoId,
      cajero: r.t.usuario.nombre,
      apertura: r.t.apertura,
      cierre: r.t.cierre,
      fondoInicial: Number(r.t.fondo_inicial),
      ventasPorMedio: Object.fromEntries(Object.entries(r.porMedio).filter(([k, v]) => v || k !== 'PLATAFORMA_EXTERNA').map(([k, v]) => [k, aSoles(v)])),
      ventasPorCanal: Object.fromEntries(Object.entries(r.porCanal).map(([k, v]) => [CANALES[k] ?? k, aSoles(v)])),
      totalVentas: aSoles(ventas),
      ingresos: aSoles(r.ingresos),
      egresos: aSoles(r.egresos),
      efectivoDelivery: aSoles(r.delivery),
      descuentos: aSoles(r.descuentos),
      anulaciones: { cantidad: r.anulaciones.cantidad, importe: aSoles(r.anulaciones.importe) },
      fugas: { cantidad: r.fugas.cantidad, importe: aSoles(r.fugas.importe) },
      notasCredito: { cantidad: nc.length, importe: nc.reduce((s, c) => s + Number(c.total), 0) },
      mermas: r.mermas,
      efectivoEsperado: aSoles(r.esperadoEfectivo),
      efectivoDeclarado: r.t.efectivo_declarado === null ? null : Number(r.t.efectivo_declarado),
      diferencia: r.t.diferencia === null ? null : Number(r.t.diferencia),
      comentario: r.t.comentario,
      comprobantes: r.comprobantes.map((c) => ({ numero: numeroComprobante(c.serie, c.correlativo), tipo: c.tipo, total: Number(c.total) })),
    };
  }

  async reporteX() {
    const t = await this.prisma.turno.findFirst({ where: { cierre: null }, orderBy: { apertura: 'desc' } });
    if (!t) throw new BadRequestException('No hay turnos abiertos.');
    return this.reporteZ(t.id);
  }

  /** Lista de turnos para el administrador, con la opción de reabrir (REQ-TUR-06). */
  async turnos() {
    const ts = await this.prisma.turno.findMany({ orderBy: { apertura: 'desc' }, take: 30, include: { usuario: { select: { nombre: true } } } });
    return ts.map((t) => ({
      id: t.id,
      cajero: t.usuario.nombre,
      apertura: t.apertura,
      cierre: t.cierre,
      fondoInicial: Number(t.fondo_inicial),
      declarado: t.efectivo_declarado === null ? null : Number(t.efectivo_declarado),
      diferencia: t.diferencia === null ? null : Number(t.diferencia),
      comentario: t.comentario,
    }));
  }

  async reabrirTurno(turnoId: string, pinAdmin: string, usuarioId: string) {
    const autorizadoPor = await this.auth.autorizarAdmin(pinAdmin);
    const t = await this.prisma.turno.findUnique({ where: { id: turnoId } });
    if (!t?.cierre) throw new BadRequestException('Ese turno no está cerrado.');
    if (await this.turnoAbierto(t.usuario_id)) throw new BadRequestException('El cajero ya tiene otro turno abierto.');
    await this.prisma.turno.update({ where: { id: t.id }, data: { cierre: null, efectivo_declarado: null, diferencia: null, comentario: null } });
    await this.bitacora.cambio('REABRIR_TURNO', 'turno', t.id, usuarioId, { cierre: t.cierre, declarado: Number(t.efectivo_declarado), diferencia: Number(t.diferencia) }, { autorizadoPor });
    return { ok: true };
  }

  // ---------------------------------------------------------------- Cuentas (F-08)

  async cuentaDeMesa(mesaId: string) {
    const propia = await this.prisma.sesion_mesa.findFirst({ where: { mesa_id: mesaId, cierre: null } });
    if (!propia) throw new NotFoundException('La mesa no tiene una cuenta abierta.');
    const sesion = await this.salon.efectiva(this.prisma, propia);
    const cuenta = await this.prisma.cuenta.findFirst({ where: { sesion_mesa_id: sesion.id, estado: { not: 'ANULADA' } }, orderBy: { creada_en: 'desc' } });
    if (!cuenta) throw new NotFoundException('La mesa no tiene una cuenta abierta.');
    return this.cuenta(cuenta.id);
  }

  /** Detalle consolidado de una cuenta de mesa, para llevar o delivery (REQ-CAJ-01). */
  async cuenta(cuentaId: string) {
    const cuenta = await this.prisma.cuenta.findUnique({
      where: { id: cuentaId },
      include: {
        sesion_mesa: { include: { mesa: true, other_sesion_mesa: { where: { cierre: null }, include: { mesa: { select: { numero: true } } } } } },
        pago: { orderBy: { fecha: 'asc' } },
        comprobante: { orderBy: { emitido_en: 'asc' }, include: { other_comprobante: { select: { id: true } } } },
        pago_en_linea: { where: { estado: 'PENDIENTE', expira_en: { gt: new Date() } } },
      },
    });
    if (!cuenta) throw new NotFoundException('Cuenta no encontrada');
    const pedidos = await this.prisma.pedido.findMany({
      where: { cuenta_id: cuenta.id, estado: { notIn: ['ANULADO'] } },
      orderBy: { creado_en: 'asc' },
      include: INCLUIR_COMANDA,
    });
    const p0 = pedidos[0];
    const unidas = cuenta.sesion_mesa?.other_sesion_mesa.map((o) => o.mesa.numero) ?? [];
    return {
      cuentaId: cuenta.id,
      mesaId: cuenta.sesion_mesa?.mesa_id ?? null,
      mesa: cuenta.sesion_mesa ? cuenta.sesion_mesa.mesa.numero + (unidas.length ? ' + ' + unidas.join(' + ') : '') : p0 ? this.pedidos.origen(p0) : 'Pedido',
      canal: p0?.canal ?? 'SALON',
      estado: cuenta.estado,
      total: Number(cuenta.total),
      saldo: Number(cuenta.saldo),
      descuento: Number(cuenta.descuento),
      motivoDescuento: cuenta.motivo_descuento,
      pagoEnLinea: cuenta.pago_en_linea.length > 0,
      pedidos: pedidos.map((p) => this.pedidos.formatoComanda(p)),
      pagos: cuenta.pago.map((p) => ({ medio: p.medio, monto: Number(p.monto), numeroOperacion: p.numero_operacion ?? p.id_transaccion, fecha: p.fecha })),
      comprobantes: cuenta.comprobante.map((c) => ({
        id: c.id,
        tipo: c.tipo,
        numero: numeroComprobante(c.serie, c.correlativo),
        total: Number(c.total),
        estadoSunat: c.estado_sunat,
        anulado: c.other_comprobante.length > 0,
      })),
    };
  }

  /** Cuentas de llevar, delivery y apps que aún tienen saldo (para la lista de la caja). */
  async cuentasSinMesa() {
    const cuentas = await this.prisma.cuenta.findMany({
      where: { sesion_mesa_id: null, estado: 'ABIERTA', saldo: { gt: 0 } },
      orderBy: { creada_en: 'asc' },
      include: { pedido: { where: { estado: { not: 'ANULADO' } }, include: INCLUIR_COMANDA, take: 1, orderBy: { creado_en: 'asc' } } },
    });
    return cuentas
      .filter((c) => c.pedido.length)
      .map((c) => ({
        cuentaId: c.id,
        origen: this.pedidos.origen(c.pedido[0]),
        canal: c.pedido[0].canal,
        estadoPedido: c.pedido[0].estado,
        despacho: c.pedido[0].pedido_delivery?.estado_despacho ?? null,
        saldo: Number(c.saldo),
        total: Number(c.total),
      }));
  }

  /** Consulta DNI/RUC simulada (en producción: ApisPeru). Sin internet se ingresa a mano (REQ-FAC-02). */
  consultarDocumento(numero: string) {
    if (this.config.booleano('sin_internet')) throw new ServiceUnavailableException('Sin internet: escribe el nombre a mano. El comprobante quedará en cola.');
    if (RE_DNI.test(numero)) return { tipo: 'DNI', numero, nombre: `CLIENTE DE PRUEBA ${numero.slice(-4)}` };
    if (RE_RUC.test(numero)) return { tipo: 'RUC', numero, nombre: `EMPRESA DE PRUEBA ${numero.slice(-3)} S.A.C.`, direccion: 'Av. León Velarde 100, Tambopata', estado: 'ACTIVO', condicion: 'HABIDO' };
    throw new BadRequestException('Número de documento inválido');
  }

  /**
   * Cobra la cuenta completa o una parte (división por montos). Cada cobro genera su propio
   * comprobante (REQ-CAJ-04/05, REQ-FAC-01/03/04). La emisión ante SUNAT está simulada.
   */
  async cobrar(cuentaId: string, pagos: PagoEntrada[], comp: ComprobanteEntrada, usuarioId: string) {
    if (!Array.isArray(pagos) || pagos.length === 0) throw new BadRequestException('Registra al menos un pago.');
    const turno = await this.turnoAbierto(usuarioId);
    const lineas = pagos.map((p) => {
      const monto = aCentimos(p.monto);
      if (monto <= 0) throw new BadRequestException('Cada pago debe ser mayor a cero.');
      if (!['EFECTIVO', 'YAPE', 'PLIN', 'TARJETA'].includes(p.medio)) throw new BadRequestException('Medio de pago no válido.');
      let recibido: number | null = null;
      if (p.medio === 'EFECTIVO') {
        if (!turno) throw new BadRequestException('Abre tu turno de caja antes de cobrar en efectivo.');
        recibido = p.recibido === undefined || p.recibido === null ? monto : aCentimos(p.recibido);
        if (recibido < monto) throw new BadRequestException(`Falta S/ ${aSoles(monto - recibido).toFixed(2)} para completar el pago en efectivo.`);
      }
      const op = p.numeroOperacion?.trim() || null;
      if (p.medio !== 'EFECTIVO' && !op) throw new BadRequestException(`Ingresa el número de operación del pago con ${p.medio.toLowerCase()}.`);
      return { medio: p.medio, monto, recibido, op };
    });
    const total = lineas.reduce((s, l) => s + l.monto, 0);
    const tipo = comp?.tipo === 'FACTURA' ? 'FACTURA' : 'BOLETA';
    const documento = comp?.documento?.trim() || null;
    this.comprobantes.validarCliente(tipo, total, documento);

    try {
      const r = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(4242)`;
        const cuenta = await tx.cuenta.findUnique({ where: { id: cuentaId }, include: { sesion_mesa: true } });
        if (!cuenta || cuenta.estado !== 'ABIERTA') throw new BadRequestException('Esta cuenta ya no está abierta.');
        await this.pedidos.verificarSinPagoEnCurso(tx, cuenta.id);
        const saldo = aCentimos(cuenta.saldo);
        if (saldo <= 0) throw new BadRequestException('Esta cuenta no tiene saldo pendiente.');
        if (total > saldo) throw new BadRequestException(`Los pagos (S/ ${aSoles(total).toFixed(2)}) superan el saldo de S/ ${aSoles(saldo).toFixed(2)}.`);
        for (const l of lineas) {
          await tx.pago.create({
            data: {
              cuenta_id: cuenta.id,
              turno_id: turno?.id ?? null,
              medio: l.medio,
              monto: aSoles(l.monto),
              recibido: l.recibido === null ? null : aSoles(l.recibido),
              numero_operacion: l.op,
            },
          });
        }
        const comprobante = await this.comprobantes.emitir(tx, { cuentaId: cuenta.id, tipo, total, documento, nombre: comp?.nombre });
        const c = await recalcularCuenta(tx, cuenta.id);
        const mesaId = cuenta.sesion_mesa?.mesa_id ?? null;
        if (c.estado === 'PAGADA' && mesaId) await this.salon.estadoMesa(tx, mesaId, 'POR_LIMPIAR');
        await this.bitacora.registrar('COBRO', 'cuenta', cuenta.id, usuarioId, { total: aSoles(total), comprobante: numeroComprobante(comprobante.serie, comprobante.correlativo) }, tx);
        return { comprobanteId: comprobante.id, nuevoSaldo: c.saldo, mesaId };
      });
      const efectivo = lineas.filter((l) => l.medio === 'EFECTIVO');
      const vuelto = efectivo.reduce((s, l) => s + ((l.recibido ?? l.monto) - l.monto), 0);
      if (efectivo.length) this.eventos.emitir('gaveta:abrir', { motivo: 'Cobro en efectivo' }); // REQ-CAJ-06
      this.eventos.emitir('mesas:cambio');
      this.eventos.emitir('despacho:cambio');
      if (r.mesaId) this.eventos.emitir('cuenta:actualizada', { mesaId: r.mesaId });
      this.eventos.emitir('estado:cambio', await this.comprobantes.estado());
      return { comprobanteId: r.comprobanteId, saldo: aSoles(r.nuevoSaldo), vuelto: aSoles(vuelto) };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ese número de operación ya fue usado en otra venta.');
      }
      throw e;
    }
  }

  /** Descuento o cortesía sobre el total, con PIN del administrador y motivo (REQ-CAJ-07). */
  async descuento(cuentaId: string, d: { monto?: number; porcentaje?: number; motivo: string; pinAdmin: string }, usuarioId: string) {
    if (!d.motivo?.trim()) throw new BadRequestException('Escribe el motivo del descuento.');
    const autorizadoPor = await this.auth.autorizarAdmin(d.pinAdmin);
    const r = await this.prisma.$transaction(async (tx) => {
      const cuenta = await tx.cuenta.findUnique({ where: { id: cuentaId }, include: { pago: true, sesion_mesa: true } });
      if (!cuenta || cuenta.estado !== 'ABIERTA') throw new BadRequestException('La cuenta no está abierta.');
      if (cuenta.pago.length) throw new BadRequestException('Aplica el descuento antes del primer cobro.');
      const consumo = (await recalcularCuenta(tx, cuenta.id)).consumo;
      const desc = d.porcentaje ? Math.round((consumo * Math.min(100, Math.max(0, Number(d.porcentaje)))) / 100) : aCentimos(d.monto);
      if (desc < 0 || desc > consumo) throw new BadRequestException('El descuento no puede ser mayor que el consumo.');
      await tx.cuenta.update({ where: { id: cuenta.id }, data: { descuento: aSoles(desc), motivo_descuento: d.motivo.trim() } });
      const c = await recalcularCuenta(tx, cuenta.id);
      if (c.estado === 'PAGADA' && cuenta.sesion_mesa) await this.salon.estadoMesa(tx, cuenta.sesion_mesa.mesa_id, 'POR_LIMPIAR');
      await this.bitacora.cambio('DESCUENTO', 'cuenta', cuenta.id, usuarioId, { descuento: Number(cuenta.descuento) }, { descuento: aSoles(desc), motivo: d.motivo.trim(), autorizadoPor }, tx);
      return cuenta.sesion_mesa?.mesa_id;
    });
    this.eventos.emitir('mesas:cambio');
    if (r) this.eventos.emitir('cuenta:actualizada', { mesaId: r });
    return { ok: true };
  }

  /**
   * Fuga de comensal (REQ-INV-06): la cuenta se anula como pérdida con PIN del administrador.
   * No afecta el efectivo esperado de la caja; la mesa pasa a «Por limpiar».
   */
  async fuga(cuentaId: string, motivo: string, pinAdmin: string, usuarioId: string) {
    if (!motivo?.trim()) throw new BadRequestException('Describe lo ocurrido.');
    const autorizadoPor = await this.auth.autorizarAdmin(pinAdmin);
    const mesaId = await this.prisma.$transaction(async (tx) => {
      const cuenta = await tx.cuenta.findUnique({ where: { id: cuentaId }, include: { sesion_mesa: true, pago: true } });
      if (!cuenta || cuenta.estado !== 'ABIERTA') throw new BadRequestException('La cuenta no está abierta.');
      if (cuenta.pago.length) throw new BadRequestException('La cuenta ya tiene pagos; cobra el saldo o registra un descuento.');
      await tx.cuenta.update({ where: { id: cuenta.id }, data: { estado: 'ANULADA', motivo_anulacion: `Fuga: ${motivo.trim()}`.slice(0, 150) } });
      await tx.pedido.updateMany({ where: { cuenta_id: cuenta.id, estado: 'POR_CONFIRMAR' }, data: { estado: 'ANULADO' } });
      await this.bitacora.registrar('FUGA_COMENSAL', 'cuenta', cuenta.id, usuarioId, { total: Number(cuenta.total), motivo: motivo.trim(), autorizadoPor }, tx);
      if (cuenta.sesion_mesa) await this.salon.estadoMesa(tx, cuenta.sesion_mesa.mesa_id, 'POR_LIMPIAR');
      return cuenta.sesion_mesa?.mesa_id;
    });
    this.eventos.emitir('mesas:cambio');
    this.eventos.emitir('despacho:cambio');
    if (mesaId) this.eventos.emitir('cuenta:actualizada', { mesaId });
    return { ok: true };
  }

  // ---------------------------------------------------------------- Liquidación de repartidores (REQ-DEL-07)

  async porLiquidar() {
    const ps = await this.prisma.pedido_delivery.findMany({
      where: { liquidado: false, estado_despacho: { in: ['EN_RUTA', 'ENTREGADO'] }, repartidor_id: { not: null } },
      include: { usuario: { select: { id: true, nombre: true } }, pedido: { include: { cuenta: true } }, cliente: true },
      orderBy: { pedido: { creado_en: 'asc' } },
    });
    const grupos = new Map<string, { repartidorId: string; repartidor: string; pedidos: unknown[]; cobrar: number; vueltos: number }>();
    for (const d of ps) {
      const g = grupos.get(d.repartidor_id!) ?? { repartidorId: d.repartidor_id!, repartidor: d.usuario?.nombre ?? '', pedidos: [], cobrar: 0, vueltos: 0 };
      const saldo = Number(d.pedido.cuenta.saldo);
      const vuelto = d.paga_con !== null && saldo > 0 ? Math.max(0, Number(d.paga_con) - saldo) : 0;
      g.pedidos.push({ pedidoId: d.pedido_id, numero: d.pedido.numero, cliente: d.cliente.nombre, estado: d.estado_despacho, saldo, pagaCon: d.paga_con === null ? null : Number(d.paga_con), vuelto });
      if (d.estado_despacho === 'ENTREGADO') g.cobrar += saldo;
      g.vueltos += vuelto;
      grupos.set(d.repartidor_id!, g);
    }
    return [...grupos.values()];
  }

  /**
   * Cobra en efectivo los deliveries entregados del repartidor (boleta por cada uno) y los marca liquidados.
   * El repartidor declara lo que rinde; la diferencia queda en la bitácora.
   */
  async liquidar(repartidorId: string, rendido: number, usuarioId: string) {
    const turno = await this.turnoAbierto(usuarioId);
    if (!turno) throw new BadRequestException('Abre tu turno de caja para liquidar.');
    const ps = await this.prisma.pedido_delivery.findMany({
      where: { repartidor_id: repartidorId, liquidado: false, estado_despacho: 'ENTREGADO' },
      include: { pedido: { include: { cuenta: true } }, cliente: true, usuario: { select: { nombre: true } } },
    });
    if (!ps.length) throw new BadRequestException('Este repartidor no tiene entregas por liquidar.');
    const esperado = ps.reduce((s, d) => s + aCentimos(d.pedido.cuenta.saldo), 0);
    const comprobantes: string[] = [];
    await this.prisma.$transaction(async (tx) => {
      for (const d of ps) {
        const saldo = aCentimos(d.pedido.cuenta.saldo);
        if (saldo > 0) {
          await tx.pago.create({ data: { cuenta_id: d.pedido.cuenta_id, turno_id: turno.id, medio: 'EFECTIVO', monto: aSoles(saldo), recibido: aSoles(saldo) } });
          const c = await this.comprobantes.emitir(tx, { cuentaId: d.pedido.cuenta_id, tipo: 'BOLETA', total: saldo, documento: d.cliente.documento?.length === 8 ? d.cliente.documento : null, nombre: d.cliente.nombre });
          comprobantes.push(c.id);
          await recalcularCuenta(tx, d.pedido.cuenta_id);
        }
        await tx.pedido_delivery.update({ where: { pedido_id: d.pedido_id }, data: { liquidado: true } });
      }
      await this.bitacora.registrar('LIQUIDAR_REPARTIDOR', 'usuario', repartidorId, usuarioId, {
        repartidor: ps[0].usuario?.nombre,
        pedidos: ps.length,
        esperado: aSoles(esperado),
        rendido: Number(rendido),
        diferencia: aSoles(aCentimos(rendido) - esperado),
      }, tx);
    });
    this.eventos.emitir('gaveta:abrir', { motivo: 'Liquidación de repartidor' });
    this.eventos.emitir('despacho:cambio');
    return { pedidos: ps.length, esperado: aSoles(esperado), rendido: Number(rendido), diferencia: aSoles(aCentimos(rendido) - esperado), comprobantes };
  }
}
