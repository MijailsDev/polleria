import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../comun/prisma.service';
import { BitacoraService } from '../comun/bitacora.service';
import { ConfigService } from '../comun/config.service';
import { icbperPorBolsa, numeroComprobante } from '../comun/cuentas';
import { aCentimos, aSoles, desglosarImpuesto } from '../comun/dinero';
import { EventosGateway } from '../eventos/eventos.gateway';
import { AuthService } from '../auth/auth.service';
import { ImpresionService } from '../perifericos/impresion.service';
import { WhatsappService } from '../perifericos/whatsapp.service';
import { SincronizacionService } from '../perifericos/sincronizacion.service';
import { CODIGO_TIPO, DocumentoCpe, LineaCpe, TipoCpe, rucValido, xmlUbl } from '../facturacion/cpe';
import { crearProveedorCpe, crearProveedorDocumentos } from '../facturacion/proveedores';
import { Ticket } from '../perifericos/escpos';

type Tx = Prisma.TransactionClient;

export const RE_DNI = /^[0-9]{8}$/;
export const RE_RUC = /^(10|15|17|20)[0-9]{9}$/;

const INCLUIR_VER = {
  comprobante: { select: { tipo: true, serie: true, correlativo: true } },
  cuenta: {
    include: {
      sesion_mesa: { include: { mesa: { select: { numero: true } } } },
      pedido: {
        where: { estado: { notIn: ['ANULADO', 'POR_CONFIRMAR'] } },
        include: { item_pedido: { where: { estado: { not: 'ANULADO' } }, include: { producto: { select: { nombre: true } } } } },
      },
      comprobante: { where: { tipo: { not: 'NOTA_CREDITO' } }, select: { id: true } },
    },
  },
} satisfies Prisma.comprobanteInclude;

/**
 * Comprobantes electrónicos (F-10). Se emiten con serie y correlativo dentro de la venta y luego
 * se envían al OSE (simulado o Nubefact). Sin internet quedan PENDIENTE en cola y se reenvían
 * al volver la conexión (REQ-FAC-08, REQ-CON-03). Las boletas se informan además en el
 * resumen diario (REQ-FAC-09).
 */
@Injectable()
export class ComprobantesService implements OnModuleInit, OnModuleDestroy {
  readonly tasa = Number(process.env.TASA_IMPUESTO ?? 0.105);
  readonly ose = crearProveedorCpe();
  readonly padron = crearProveedorDocumentos();
  private readonly log = new Logger('SUNAT');
  private reloj?: NodeJS.Timeout;
  private procesando = false;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private eventos: EventosGateway,
    private bitacora: BitacoraService,
    private auth: AuthService,
    private impresion: ImpresionService,
    private whatsapp: WhatsappService,
    private sync: SincronizacionService,
  ) {}

  onModuleInit() {
    this.reloj = setInterval(() => this.procesarCola().catch((e) => this.log.error(e.message)), 20_000);
  }
  onModuleDestroy() {
    clearInterval(this.reloj);
  }

  /** Reglas del adquirente (RN-11): factura con RUC válido; boleta de más de S/ 700 con documento. */
  validarCliente(tipo: string, totalCentimos: number, documento: string | null) {
    if (tipo === 'FACTURA' && !(documento && RE_RUC.test(documento))) throw new BadRequestException('La factura necesita un RUC válido de 11 dígitos.');
    if (documento && !RE_DNI.test(documento) && !RE_RUC.test(documento)) throw new BadRequestException('Número de documento inválido');
    if (documento && RE_RUC.test(documento) && !rucValido(documento)) throw new BadRequestException('El RUC no es válido (revisa el último dígito).');
    if (tipo === 'BOLETA' && totalCentimos > 70000 && !documento) throw new BadRequestException('Las boletas de más de S/ 700.00 necesitan el DNI del cliente.');
  }

  /** Consulta de DNI (RENIEC) o RUC (SUNAT) para autocompletar el nombre (REQ-FAC-02). */
  async consultarDocumento(numero: string) {
    if (!RE_DNI.test(numero) && !RE_RUC.test(numero)) throw new BadRequestException('Número de documento inválido');
    if (this.config.booleano('sin_internet')) throw new ServiceUnavailableException('Sin internet: escribe el nombre a mano. El comprobante quedará en cola.');
    if (RE_RUC.test(numero) && !rucValido(numero)) throw new BadRequestException('El RUC no es válido (revisa el último dígito).');
    const d = await this.padron.consultar(numero).catch(() => {
      throw new ServiceUnavailableException('El servicio de consulta no responde. Escribe el nombre a mano.');
    });
    if (!d) throw new NotFoundException(`No se encontró el ${numero.length === 8 ? 'DNI' : 'RUC'} ${numero}.`);
    return d;
  }

  /**
   * Reserva serie y correlativo y guarda el comprobante PENDIENTE dentro de la transacción de la venta.
   * El ICBPER de las bolsas de la cuenta va en el primer comprobante que lo cubra.
   */
  async emitir(
    tx: Tx,
    d: { cuentaId: string; tipo: 'BOLETA' | 'FACTURA' | 'NOTA_CREDITO'; total: number; documento?: string | null; nombre?: string | null; referenciaId?: string; serieRef?: string; motivo?: string; icbper?: number },
  ) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(4242)`; // correlativos sin choques
    const serie = d.tipo === 'FACTURA' ? 'F001' : d.tipo === 'BOLETA' ? 'B001' : d.serieRef?.startsWith('F') ? 'FC01' : 'BC01';
    const ultimo = await tx.comprobante.aggregate({ where: { serie }, _max: { correlativo: true } });
    let icbper = d.icbper ?? 0;
    if (d.tipo !== 'NOTA_CREDITO') {
      const cuenta = await tx.cuenta.findUniqueOrThrow({ where: { id: d.cuentaId }, select: { bolsas: true } });
      const yaFacturado = await tx.comprobante.aggregate({ where: { cuenta_id: d.cuentaId, tipo: { not: 'NOTA_CREDITO' } }, _sum: { icbper: true } });
      icbper = Math.min(d.total, Math.max(0, cuenta.bolsas * (await icbperPorBolsa(tx)) - aCentimos(yaFacturado._sum.icbper)));
    }
    const { base, impuesto } = desglosarImpuesto(d.total - icbper, this.tasa);
    const c = await tx.comprobante.create({
      data: {
        cuenta_id: d.cuentaId,
        referencia_id: d.referenciaId,
        tipo: d.tipo,
        serie,
        correlativo: (ultimo._max.correlativo ?? 0) + 1,
        documento_cliente: d.documento || null,
        nombre_cliente: d.nombre?.trim() || null,
        base_imponible: aSoles(base),
        impuesto: aSoles(impuesto),
        icbper: aSoles(icbper),
        total: aSoles(d.total),
        motivo: d.motivo,
        estado_sunat: 'PENDIENTE',
      },
    });
    await this.sync.registrar(tx, 'comprobante', c.id, 'EMITIR', {
      tipo: c.tipo,
      numero: numeroComprobante(c.serie, c.correlativo),
      total: Number(c.total),
      icbper: Number(c.icbper),
      documento: c.documento_cliente,
      emitidoEn: c.emitido_en,
    });
    return c;
  }

  /** Envía uno o varios comprobantes al OSE esperando como máximo unos segundos (el resto sigue en cola). */
  async enviarAhora(ids: string[], maxMs = 4000) {
    await Promise.race([Promise.all(ids.map((id) => this.enviar(id).catch(() => undefined))), new Promise((r) => setTimeout(r, maxMs))]);
  }

  /** Envía un comprobante al OSE y guarda la respuesta de SUNAT. */
  async enviar(id: string) {
    if (this.config.booleano('sin_internet')) return null;
    const actual = await this.prisma.comprobante.findUnique({ where: { id }, select: { estado_sunat: true, intentos: true } });
    if (!actual || actual.estado_sunat !== 'PENDIENTE') return null;
    const { doc } = await this.documento(id);
    let r;
    try {
      r = await this.ose.enviar(doc);
    } catch (e) {
      await this.prisma.comprobante.update({ where: { id }, data: { intentos: { increment: 1 }, mensaje_sunat: `Sin respuesta del OSE: ${(e as Error).message}`.slice(0, 250) } });
      return null;
    }
    const c = await this.prisma.comprobante.update({
      where: { id },
      data: {
        estado_sunat: r.aceptado ? 'ACEPTADO' : 'RECHAZADO',
        hash_cpe: r.hash,
        codigo_sunat: r.codigo,
        mensaje_sunat: r.mensaje.slice(0, 250),
        enviado_en: new Date(),
        intentos: { increment: 1 },
      },
    });
    if (!r.aceptado) {
      const numero = numeroComprobante(c.serie, c.correlativo);
      await this.bitacora.registrar('RECHAZO_SUNAT', 'comprobante', c.id, null, { numero, codigo: r.codigo, mensaje: r.mensaje });
      this.eventos.emitir('alerta', { tipo: 'SUNAT', mensaje: `SUNAT rechazó ${numero}: ${r.mensaje}`, hora: new Date() });
    }
    this.eventos.emitir('estado:cambio', await this.estado());
    return c;
  }

  pendientes() {
    return this.prisma.comprobante.count({ where: { estado_sunat: 'PENDIENTE' } });
  }

  /** Reenvía la cola de comprobantes pendientes cuando hay internet. */
  async procesarCola() {
    if (this.procesando || this.config.booleano('sin_internet')) return 0;
    this.procesando = true;
    try {
      const cola = await this.prisma.comprobante.findMany({ where: { estado_sunat: 'PENDIENTE', intentos: { lt: 10 } }, orderBy: [{ serie: 'asc' }, { correlativo: 'asc' }], select: { id: true }, take: 50 });
      let enviados = 0;
      for (const c of cola) if ((await this.enviar(c.id))?.estado_sunat === 'ACEPTADO') enviados++;
      if (enviados) {
        this.log.log(`${enviados} comprobante(s) aceptados desde la cola`);
        await this.bitacora.registrar('ENVIAR_COLA_SUNAT', 'comprobante', null, null, { enviados });
      }
      return enviados;
    } finally {
      this.procesando = false;
    }
  }

  async estado() {
    const [pendientes, rechazados] = await Promise.all([this.pendientes(), this.prisma.comprobante.count({ where: { estado_sunat: 'RECHAZADO' } })]);
    return { sinInternet: this.config.booleano('sin_internet'), pendientes, rechazados, ose: this.ose.nombre, padron: this.padron.nombre };
  }

  /**
   * Nota de crédito que anula un comprobante (REQ-FAC-07), con PIN del administrador.
   * Si se devuelve el dinero en efectivo, sale de la caja del turno como egreso.
   */
  async notaCredito(comprobanteId: string, motivo: string, pinAdmin: string, devolverEfectivo: boolean, usuarioId: string) {
    if (!motivo?.trim()) throw new BadRequestException('Elige o escribe el motivo de la nota de crédito.');
    const autorizadoPor = await this.auth.autorizarAdmin(pinAdmin);
    const turno = devolverEfectivo ? await this.prisma.turno.findFirst({ where: { usuario_id: usuarioId, cierre: null } }) : null;
    if (devolverEfectivo && !turno) throw new BadRequestException('Abre tu turno de caja para devolver efectivo.');
    const nc = await this.prisma.$transaction(async (tx) => {
      const c = await tx.comprobante.findUnique({ where: { id: comprobanteId }, include: { other_comprobante: true } });
      if (!c) throw new NotFoundException('Comprobante no encontrado');
      if (c.tipo === 'NOTA_CREDITO') throw new BadRequestException('No se puede anular una nota de crédito.');
      if (c.estado_sunat === 'RECHAZADO') throw new BadRequestException('Un comprobante rechazado por SUNAT no necesita nota de crédito.');
      if (c.other_comprobante.length) throw new BadRequestException('Este comprobante ya tiene una nota de crédito.');
      const nc = await this.emitir(tx, {
        cuentaId: c.cuenta_id,
        tipo: 'NOTA_CREDITO',
        total: aCentimos(c.total),
        icbper: aCentimos(c.icbper),
        documento: c.documento_cliente,
        nombre: c.nombre_cliente,
        referenciaId: c.id,
        serieRef: c.serie,
        motivo: motivo.trim(),
      });
      if (turno) {
        await tx.movimiento_caja.create({
          data: { turno_id: turno.id, tipo: 'EGRESO', monto: c.total, motivo: `Devolución ${numeroComprobante(nc.serie, nc.correlativo)}`.slice(0, 150), autorizado_por: autorizadoPor },
        });
      }
      await this.bitacora.registrar('NOTA_CREDITO', 'comprobante', nc.id, usuarioId, {
        anula: numeroComprobante(c.serie, c.correlativo),
        total: Number(c.total),
        motivo: motivo.trim(),
        devolverEfectivo,
        autorizadoPor,
      }, tx);
      return { nc, anula: numeroComprobante(c.serie, c.correlativo), total: Number(c.total) };
    });
    await this.enviarAhora([nc.nc.id]);
    if (devolverEfectivo) await this.impresion.abrirGaveta('Devolución por nota de crédito');
    await this.whatsapp.alertaDueno(`Nota de crédito ${numeroComprobante(nc.nc.serie, nc.nc.correlativo)} anula ${nc.anula} por S/ ${nc.total.toFixed(2)}. Motivo: ${motivo.trim()}`);
    return { id: nc.nc.id, numero: numeroComprobante(nc.nc.serie, nc.nc.correlativo) };
  }

  // ---------------------------------------------------------------- Representación del comprobante

  /** Arma el documento electrónico (para el OSE y el XML) y las líneas del ticket impreso. */
  private async documento(id: string) {
    const c = await this.prisma.comprobante.findUnique({ where: { id }, include: INCLUIR_VER });
    if (!c) throw new NotFoundException('Comprobante no encontrado');
    const p0 = c.cuenta.pedido[0];
    const origen = c.cuenta.sesion_mesa
      ? `Mesa ${c.cuenta.sesion_mesa.mesa.numero}`
      : p0
        ? { LLEVAR: 'Para llevar', DELIVERY: 'Delivery', APP_EXTERNA: 'App externa', SALON: 'Salón' }[p0.canal] + ` #${p0.numero}`
        : null;
    const totalSinBolsas = aCentimos(c.total) - aCentimos(c.icbper);
    const descuento = aCentimos(c.cuenta.descuento);
    const parcial = c.cuenta.comprobante.length > 1 || aCentimos(c.total) !== aCentimos(c.cuenta.total);
    let items: { cantidad: number; descripcion: string; importe: number }[];
    if (c.tipo === 'NOTA_CREDITO') {
      items = [{ cantidad: 1, descripcion: `Anulación de ${c.comprobante ? numeroComprobante(c.comprobante.serie, c.comprobante.correlativo) : ''}`, importe: aSoles(totalSinBolsas) }];
    } else if (parcial) {
      items = [{ cantidad: 1, descripcion: `Consumo ${origen ?? ''} (cuenta dividida)`, importe: aSoles(totalSinBolsas) }];
    } else {
      items = c.cuenta.pedido.flatMap((p) =>
        p.item_pedido.map((i) => ({
          cantidad: i.cantidad,
          descripcion: i.producto.nombre + (p.es_reposicion ? ' (reposición sin costo)' : ''),
          importe: aSoles(aCentimos(i.precio_unitario) * i.cantidad),
        })),
      );
    }
    // Líneas del XML: solo las que tienen precio, con su base e impuesto
    const conPrecio = items.filter((i) => i.importe > 0);
    const lineas: LineaCpe[] = conPrecio.map((i) => {
      const { base, impuesto } = desglosarImpuesto(aCentimos(i.importe), this.tasa);
      return { descripcion: i.descripcion, cantidad: i.cantidad, importe: i.importe, base: aSoles(base), impuesto: aSoles(impuesto) };
    });
    const sumaBases = lineas.reduce((s, l) => s + aCentimos(l.base), 0);
    const base = aCentimos(c.base_imponible);
    let descuentoBase = 0;
    if (!parcial && c.tipo !== 'NOTA_CREDITO' && descuento > 0) descuentoBase = Math.max(0, sumaBases - base);
    else if (lineas.length && sumaBases !== base) {
      // Ajuste de redondeo en la última línea para que cuadre con la cabecera
      const u = lineas[lineas.length - 1];
      u.base = aSoles(aCentimos(u.base) + base - sumaBases);
      u.impuesto = aSoles(aCentimos(u.importe) - aCentimos(u.base));
    }
    const doc: DocumentoCpe = {
      tipo: c.tipo as TipoCpe,
      serie: c.serie,
      correlativo: c.correlativo,
      emitidoEn: c.emitido_en,
      emisor: { ruc: this.config.texto('ruc_emisor'), razonSocial: this.config.texto('razon_social'), direccion: this.config.texto('direccion_local') },
      cliente: c.documento_cliente
        ? { tipoDocumento: c.documento_cliente.length === 11 ? '6' : '1', numero: c.documento_cliente, nombre: c.nombre_cliente ?? '' }
        : { tipoDocumento: '0', numero: '-', nombre: c.nombre_cliente ?? 'CLIENTES VARIOS' },
      lineas,
      descuentoBase: aSoles(descuentoBase),
      base: Number(c.base_imponible),
      impuesto: Number(c.impuesto),
      icbper: Number(c.icbper),
      bolsas: c.icbper.gt(0) ? Math.round(aCentimos(c.icbper) / Math.max(1, await icbperPorBolsa(this.prisma))) : 0,
      total: Number(c.total),
      tasa: this.tasa,
      referencia: c.comprobante ? { tipo: c.comprobante.tipo as TipoCpe, serie: c.comprobante.serie, correlativo: c.comprobante.correlativo } : null,
      motivo: c.motivo,
    };
    if (!parcial && c.tipo !== 'NOTA_CREDITO' && descuento > 0) items.push({ cantidad: 1, descripcion: `Descuento: ${c.cuenta.motivo_descuento ?? ''}`, importe: -aSoles(descuento) });
    if (doc.icbper > 0) items.push({ cantidad: doc.bolsas, descripcion: 'Bolsa plástica (ICBPER)', importe: doc.icbper });
    return { c, doc, items, origen };
  }

  /** Datos para la representación impresa del comprobante (ticket de 80 mm). */
  async ver(id: string) {
    const { c, doc, items, origen } = await this.documento(id);
    const numero = numeroComprobante(c.serie, c.correlativo);
    const fecha = c.emitido_en.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    return {
      id: c.id,
      tipo: c.tipo,
      numero,
      emitidoEn: c.emitido_en,
      emisor: doc.emisor,
      documento: c.documento_cliente,
      nombre: c.nombre_cliente,
      mesa: origen,
      items,
      base: Number(c.base_imponible),
      impuesto: Number(c.impuesto),
      icbper: Number(c.icbper),
      total: Number(c.total),
      tasa: this.tasa,
      estadoSunat: c.estado_sunat,
      codigoSunat: c.codigo_sunat,
      mensajeSunat: c.mensaje_sunat,
      hash: c.hash_cpe,
      motivo: c.motivo,
      referencia: c.comprobante ? numeroComprobante(c.comprobante.serie, c.comprobante.correlativo) : null,
      // Contenido del QR según SUNAT: RUC|TIPO|SERIE|NÚMERO|IGV|TOTAL|FECHA|TIPO DOC|NÚMERO DOC|HASH
      qr: [doc.emisor.ruc, CODIGO_TIPO[doc.tipo], c.serie, c.correlativo, Number(c.impuesto).toFixed(2), Number(c.total).toFixed(2), fecha, doc.cliente.tipoDocumento, doc.cliente.numero, c.hash_cpe ?? ''].join('|') + '|',
    };
  }

  /** XML UBL 2.1 del comprobante (lo que se envía al OSE, sin la firma). */
  async xml(id: string) {
    const { c, doc } = await this.documento(id);
    return { nombre: `${doc.emisor.ruc}-${CODIGO_TIPO[doc.tipo]}-${c.serie}-${c.correlativo}.xml`, xml: xmlUbl(doc) };
  }

  /** Imprime el comprobante en la ticketera de caja. */
  async imprimir(id: string) {
    const v = await this.ver(id);
    const nombreTipo = v.tipo === 'FACTURA' ? 'FACTURA ELECTRÓNICA' : v.tipo === 'BOLETA' ? 'BOLETA DE VENTA ELECTRÓNICA' : 'NOTA DE CRÉDITO ELECTRÓNICA';
    const t = new Ticket()
      .centro(v.emisor.razonSocial, true)
      .centro(`RUC ${v.emisor.ruc}`)
      .centro(v.emisor.direccion)
      .separador()
      .centro(nombreTipo, true)
      .centro(v.numero, true)
      .texto(`Fecha: ${new Date(v.emitidoEn).toLocaleString('es-PE', { timeZone: 'America/Lima' })}`);
    if (v.mesa) t.texto(`Atención: ${v.mesa}`);
    t.texto(v.documento ? `${v.documento.length === 11 ? 'RUC' : 'DNI'}: ${v.documento}  ${v.nombre ?? ''}` : 'Cliente: CLIENTES VARIOS');
    if (v.referencia) t.texto(`Modifica: ${v.referencia} · ${v.motivo ?? ''}`);
    t.separador();
    for (const i of v.items) t.par(`${i.cantidad} ${i.descripcion}`, i.importe.toFixed(2));
    t.separador()
      .par('Op. gravada', v.base.toFixed(2))
      .par(`IGV ${(v.tasa * 100).toFixed(1)}%`, v.impuesto.toFixed(2));
    if (v.icbper > 0) t.par('ICBPER', v.icbper.toFixed(2));
    t.texto(`TOTAL S/ ${v.total.toFixed(2)}`, { g: true, b: true, c: true })
      .separador()
      .centro(`Resumen: ${v.hash ?? 'pendiente de envío'}`)
      .centro(`Representación impresa de la ${nombreTipo.toLowerCase()}`)
      .centro('Consulte su comprobante escaneando el QR')
      .centro('Libro de Reclamaciones disponible');
    await this.impresion.imprimir('CAJA', v.tipo, t);
    return { ok: true };
  }

  // ---------------------------------------------------------------- Resumen diario de boletas (REQ-FAC-09)

  /** Envía al OSE el resumen de las boletas y notas de crédito de boletas de un día. */
  async resumenDiario(fecha: string | undefined, usuarioId: string | null) {
    const dia = fecha || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) throw new BadRequestException('Fecha inválida (AAAA-MM-DD).');
    if (this.config.booleano('sin_internet')) throw new ServiceUnavailableException('Sin internet: el resumen se enviará cuando vuelva la conexión.');
    const ini = new Date(`${dia}T00:00:00-05:00`);
    const fin = new Date(ini.getTime() + 86_400_000);
    const boletas = await this.prisma.comprobante.findMany({
      where: { emitido_en: { gte: ini, lt: fin }, serie: { startsWith: 'B' }, estado_sunat: { not: 'RECHAZADO' } },
      orderBy: [{ serie: 'asc' }, { correlativo: 'asc' }],
      include: { other_comprobante: { select: { id: true } } },
    });
    if (!boletas.length) throw new BadRequestException(`No hay boletas emitidas el ${dia}.`);
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' }).replace(/-/g, '');
    const previos = await this.prisma.resumen_diario.count({ where: { identificador: { startsWith: `RC-${hoy}-` } } });
    const identificador = `RC-${hoy}-${previos + 1}`;
    const { ticket } = await this.ose.enviarResumen({
      identificador,
      fecha: dia,
      boletas: boletas.map((b) => ({ serie: b.serie, correlativo: b.correlativo, total: Number(b.total), estado: b.other_comprobante.length ? 'ANULAR' : 'ADICIONAR' })),
    });
    const total = boletas.reduce((s, b) => s + (b.tipo === 'NOTA_CREDITO' ? -1 : 1) * aCentimos(b.total), 0);
    const r = await this.prisma.resumen_diario.create({ data: { identificador, fecha_referencia: ini, cantidad: boletas.length, total: aSoles(total), ticket, estado: 'ENVIADO' } });
    // SUNAT procesa el resumen de forma asíncrona: se consulta el ticket
    const resp = await this.ose.consultarTicket(ticket);
    await this.prisma.resumen_diario.update({ where: { id: r.id }, data: { estado: resp.aceptado ? 'ACEPTADO' : 'RECHAZADO', mensaje: resp.mensaje.slice(0, 250) } });
    await this.bitacora.registrar('RESUMEN_DIARIO', 'resumen_diario', r.id, usuarioId, { identificador, fecha: dia, boletas: boletas.length, total: aSoles(total) });
    return { identificador, ticket, cantidad: boletas.length, total: aSoles(total), estado: resp.aceptado ? 'ACEPTADO' : 'RECHAZADO', mensaje: resp.mensaje };
  }

  async resumenes() {
    const rs = await this.prisma.resumen_diario.findMany({ orderBy: { creado_en: 'desc' }, take: 30 });
    return rs.map((r) => ({
      identificador: r.identificador,
      fecha: r.fecha_referencia.toISOString().slice(0, 10),
      cantidad: r.cantidad,
      total: Number(r.total),
      ticket: r.ticket,
      estado: r.estado,
      mensaje: r.mensaje,
      creadoEn: r.creado_en,
    }));
  }

  /** Comprobantes con problemas para el panel del administrador. */
  async observados() {
    const cs = await this.prisma.comprobante.findMany({
      where: { estado_sunat: { in: ['PENDIENTE', 'RECHAZADO'] } },
      orderBy: { emitido_en: 'desc' },
      take: 50,
    });
    return cs.map((c) => ({ id: c.id, numero: numeroComprobante(c.serie, c.correlativo), tipo: c.tipo, total: Number(c.total), estado: c.estado_sunat, mensaje: c.mensaje_sunat, intentos: c.intentos, emitidoEn: c.emitido_en }));
  }
}
