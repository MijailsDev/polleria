import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../comun/prisma.service';
import { BitacoraService } from '../comun/bitacora.service';
import { EventosGateway } from '../eventos/eventos.gateway';
import { AuthService } from '../auth/auth.service';
import { PedidosService } from '../pedidos/pedidos.service';
import { aCentimos, aSoles, desglosarImpuesto } from '../comun/dinero';

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

const MARGEN_ARQUEO = 100; // S/ 1.00 en céntimos (REQ-TUR-04)
const LIMITE_EGRESO_SIN_PIN = 5000; // S/ 50.00 (REQ-TUR-02)
const RE_DNI = /^[0-9]{8}$/;
const RE_RUC = /^(10|15|17|20)[0-9]{9}$/;

@Injectable()
export class CajaService {
  private readonly tasa = Number(process.env.TASA_IMPUESTO ?? 0.105);

  constructor(
    private prisma: PrismaService,
    private eventos: EventosGateway,
    private bitacora: BitacoraService,
    private auth: AuthService,
    private pedidos: PedidosService,
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
    if (tipo === 'EGRESO' && cent > LIMITE_EGRESO_SIN_PIN) {
      if (!pinAdmin) throw new BadRequestException('Los egresos mayores a S/ 50.00 requieren el PIN del administrador.');
      autorizadoPor = await this.auth.autorizarAdmin(pinAdmin);
    }
    const m = await this.prisma.movimiento_caja.create({
      data: { turno_id: t.id, tipo, monto: aSoles(cent), motivo: motivo.trim(), autorizado_por: autorizadoPor },
    });
    await this.bitacora.registrar(`MOVIMIENTO_${tipo}`, 'movimiento_caja', m.id, usuarioId, { monto, motivo, autorizadoPor });
    if (tipo === 'EGRESO') this.eventos.emitir('gaveta:abrir', { motivo: 'Egreso de caja' });
    return { ok: true };
  }

  private async resumenTurno(turnoId: string) {
    const t = await this.prisma.turno.findUniqueOrThrow({
      where: { id: turnoId },
      include: { pago: true, movimiento_caja: true, usuario: { select: { nombre: true } } },
    });
    const porMedio: Record<string, number> = { EFECTIVO: 0, YAPE: 0, PLIN: 0, TARJETA: 0 };
    for (const p of t.pago) porMedio[p.medio] = (porMedio[p.medio] ?? 0) + aCentimos(p.monto);
    const ingresos = t.movimiento_caja.filter((m) => m.tipo === 'INGRESO').reduce((s, m) => s + aCentimos(m.monto), 0);
    const egresos = t.movimiento_caja.filter((m) => m.tipo === 'EGRESO').reduce((s, m) => s + aCentimos(m.monto), 0);
    const esperadoEfectivo = aCentimos(t.fondo_inicial) + porMedio.EFECTIVO + ingresos - egresos;
    const comprobantes = await this.prisma.comprobante.findMany({
      where: { cuenta: { pago: { some: { turno_id: turnoId } } } },
      select: { tipo: true, serie: true, correlativo: true, total: true },
      orderBy: [{ serie: 'asc' }, { correlativo: 'asc' }],
    });
    return { t, porMedio, ingresos, egresos, esperadoEfectivo, comprobantes };
  }

  /**
   * Cierre con arqueo ciego (REQ-TUR-03/04): el cajero declara lo contado sin ver lo esperado.
   * La primera declaración queda guardada; si la diferencia supera S/ 1.00 se pide un comentario.
   */
  async cerrarTurno(usuarioId: string, efectivoDeclarado: number, comentario?: string) {
    const t = await this.turnoAbierto(usuarioId);
    if (!t) throw new BadRequestException('No tienes un turno abierto.');
    const abiertas = await this.prisma.cuenta.findMany({
      where: { estado: 'ABIERTA', saldo: { gt: 0 } },
      include: { sesion_mesa: { include: { mesa: { select: { numero: true } } } } },
    });
    if (abiertas.length) {
      const lista = abiertas.map((c) => c.sesion_mesa?.mesa.numero ?? 'Llevar').join(', ');
      throw new BadRequestException(`Hay ${abiertas.length} cuenta(s) abierta(s) con saldo (${lista}). Cóbralas antes de cerrar.`);
    }
    let declarado = t.efectivo_declarado;
    if (declarado === null) {
      if (!(Number(efectivoDeclarado) >= 0)) throw new BadRequestException('Ingresa el efectivo contado.');
      declarado = new Prisma.Decimal(aSoles(aCentimos(efectivoDeclarado)));
      await this.prisma.turno.update({ where: { id: t.id }, data: { efectivo_declarado: declarado } });
    }
    const r = await this.resumenTurno(t.id);
    const diferencia = aCentimos(declarado) - r.esperadoEfectivo;
    if (Math.abs(diferencia) > MARGEN_ARQUEO && !comentario?.trim()) {
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
    return {
      turnoId,
      cajero: r.t.usuario.nombre,
      apertura: r.t.apertura,
      cierre: r.t.cierre,
      fondoInicial: Number(r.t.fondo_inicial),
      ventasPorMedio: Object.fromEntries(Object.entries(r.porMedio).map(([k, v]) => [k, aSoles(v)])),
      totalVentas: aSoles(ventas),
      ingresos: aSoles(r.ingresos),
      egresos: aSoles(r.egresos),
      efectivoEsperado: aSoles(r.esperadoEfectivo),
      efectivoDeclarado: r.t.efectivo_declarado === null ? null : Number(r.t.efectivo_declarado),
      diferencia: r.t.diferencia === null ? null : Number(r.t.diferencia),
      comentario: r.t.comentario,
      comprobantes: r.comprobantes.map((c) => ({ numero: `${c.serie}-${String(c.correlativo).padStart(6, '0')}`, tipo: c.tipo, total: Number(c.total) })),
    };
  }

  async reporteX(usuarioId: string) {
    const t = await this.prisma.turno.findFirst({ where: { cierre: null }, orderBy: { apertura: 'desc' } });
    if (!t) throw new BadRequestException('No hay turnos abiertos.');
    return this.reporteZ(t.id);
  }

  // ---------------------------------------------------------------- Cobro (F-08)

  async cuentaDeMesa(mesaId: string) {
    const sesion = await this.prisma.sesion_mesa.findFirst({ where: { mesa_id: mesaId, cierre: null }, include: { mesa: true } });
    if (!sesion) throw new NotFoundException('La mesa no tiene una cuenta abierta.');
    const cuenta = await this.prisma.cuenta.findFirst({
      where: { sesion_mesa_id: sesion.id },
      orderBy: { creada_en: 'desc' },
      include: { pago: { orderBy: { fecha: 'asc' } }, comprobante: { orderBy: { emitido_en: 'asc' } } },
    });
    if (!cuenta) throw new NotFoundException('La mesa no tiene una cuenta abierta.');
    const pedidos = await this.prisma.pedido.findMany({
      where: { cuenta_id: cuenta.id, estado: { notIn: ['ANULADO'] } },
      orderBy: { creado_en: 'asc' },
      include: {
        usuario: { select: { nombre: true } },
        cuenta: { include: { sesion_mesa: { include: { mesa: { select: { numero: true } } } } } },
        item_pedido: {
          include: {
            producto: { select: { nombre: true, destino_impresion: true } },
            item_opcion: { include: { opcion_modificador: { include: { grupo_modificador: { select: { nombre: true } } } } } },
          },
        },
      },
    });
    return {
      cuentaId: cuenta.id,
      mesaId,
      mesa: sesion.mesa.numero,
      estado: cuenta.estado,
      total: Number(cuenta.total),
      saldo: Number(cuenta.saldo),
      pedidos: pedidos.map((p) => this.pedidos.formatoComanda(p)),
      pagos: cuenta.pago.map((p) => ({ medio: p.medio, monto: Number(p.monto), numeroOperacion: p.numero_operacion, fecha: p.fecha })),
      comprobantes: cuenta.comprobante.map((c) => ({ id: c.id, numero: `${c.serie}-${String(c.correlativo).padStart(6, '0')}`, total: Number(c.total) })),
    };
  }

  /** Consulta DNI/RUC simulada (en producción: ApisPeru). */
  consultarDocumento(numero: string) {
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
    if (tipo === 'FACTURA' && !(documento && RE_RUC.test(documento))) throw new BadRequestException('La factura necesita un RUC válido de 11 dígitos.');
    if (documento && !RE_DNI.test(documento) && !RE_RUC.test(documento)) throw new BadRequestException('Número de documento inválido');
    if (tipo === 'BOLETA' && total > 70000 && !documento) throw new BadRequestException('Las boletas de más de S/ 700.00 necesitan el DNI del cliente.');

    try {
      const r = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(4242)`; // correlativos sin choques
        const cuenta = await tx.cuenta.findUnique({ where: { id: cuentaId }, include: { sesion_mesa: true } });
        if (!cuenta || cuenta.estado !== 'ABIERTA') throw new BadRequestException('Esta cuenta ya no está abierta.');
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
        const serie = tipo === 'FACTURA' ? 'F001' : 'B001';
        const ultimo = await tx.comprobante.aggregate({ where: { serie }, _max: { correlativo: true } });
        const { base, impuesto } = desglosarImpuesto(total, this.tasa);
        const comprobante = await tx.comprobante.create({
          data: {
            cuenta_id: cuenta.id,
            tipo,
            serie,
            correlativo: (ultimo._max.correlativo ?? 0) + 1,
            documento_cliente: documento,
            nombre_cliente: comp?.nombre?.trim() || null,
            base_imponible: aSoles(base),
            impuesto: aSoles(impuesto),
            total: aSoles(total),
            estado_sunat: 'ACEPTADO', // simulado: en producción lo devuelve el OSE
          },
        });
        const nuevoSaldo = saldo - total;
        await tx.cuenta.update({ where: { id: cuenta.id }, data: { saldo: aSoles(nuevoSaldo), estado: nuevoSaldo === 0 ? 'PAGADA' : 'ABIERTA' } });
        const mesaId = cuenta.sesion_mesa?.mesa_id ?? null;
        if (nuevoSaldo === 0 && mesaId) await tx.mesa.update({ where: { id: mesaId }, data: { estado: 'POR_LIMPIAR' } });
        await this.bitacora.registrar('COBRO', 'cuenta', cuenta.id, usuarioId, { total: aSoles(total), comprobante: `${serie}-${comprobante.correlativo}` }, tx);
        return { comprobanteId: comprobante.id, nuevoSaldo, mesaId };
      });
      const efectivo = lineas.filter((l) => l.medio === 'EFECTIVO');
      const vuelto = efectivo.reduce((s, l) => s + ((l.recibido ?? l.monto) - l.monto), 0);
      if (efectivo.length) this.eventos.emitir('gaveta:abrir', { motivo: 'Cobro en efectivo' }); // REQ-CAJ-06
      this.eventos.emitir('mesas:cambio');
      if (r.mesaId) this.eventos.emitir('cuenta:actualizada', { mesaId: r.mesaId });
      return { comprobanteId: r.comprobanteId, saldo: aSoles(r.nuevoSaldo), vuelto: aSoles(vuelto) };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ese número de operación ya fue usado en otra venta.');
      }
      throw e;
    }
  }

  /** Datos para imprimir el comprobante (representación impresa simulada). */
  async comprobante(id: string) {
    const c = await this.prisma.comprobante.findUnique({
      where: { id },
      include: {
        cuenta: {
          include: {
            sesion_mesa: { include: { mesa: { select: { numero: true } } } },
            pedido: { where: { estado: { not: 'ANULADO' } }, include: { item_pedido: { include: { producto: { select: { nombre: true } } } } } },
            comprobante: { select: { id: true } },
          },
        },
      },
    });
    if (!c) throw new NotFoundException('Comprobante no encontrado');
    const parcial = c.cuenta.comprobante.length > 1 || aCentimos(c.total) !== aCentimos(c.cuenta.total);
    const items = parcial
      ? [{ cantidad: 1, descripcion: `Consumo ${c.cuenta.sesion_mesa ? 'mesa ' + c.cuenta.sesion_mesa.mesa.numero : ''} (cuenta dividida)`, importe: Number(c.total) }]
      : c.cuenta.pedido.flatMap((p) =>
          p.item_pedido.map((i) => ({ cantidad: i.cantidad, descripcion: i.producto.nombre, importe: aSoles(aCentimos(i.precio_unitario) * i.cantidad) })),
        );
    const numero = `${c.serie}-${String(c.correlativo).padStart(6, '0')}`;
    return {
      id: c.id,
      tipo: c.tipo,
      numero,
      emitidoEn: c.emitido_en,
      documento: c.documento_cliente,
      nombre: c.nombre_cliente,
      mesa: c.cuenta.sesion_mesa?.mesa.numero ?? null,
      items,
      base: Number(c.base_imponible),
      impuesto: Number(c.impuesto),
      total: Number(c.total),
      tasa: this.tasa,
      estadoSunat: c.estado_sunat,
      qr: `20000000001|${c.tipo === 'FACTURA' ? '01' : '03'}|${c.serie}|${c.correlativo}|${Number(c.impuesto).toFixed(2)}|${Number(c.total).toFixed(2)}`,
    };
  }
}
