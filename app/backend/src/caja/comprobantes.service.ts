import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../comun/prisma.service';
import { BitacoraService } from '../comun/bitacora.service';
import { ConfigService } from '../comun/config.service';
import { numeroComprobante } from '../comun/cuentas';
import { aCentimos, aSoles, desglosarImpuesto } from '../comun/dinero';
import { EventosGateway } from '../eventos/eventos.gateway';
import { AuthService } from '../auth/auth.service';

type Tx = Prisma.TransactionClient;

export const RE_DNI = /^[0-9]{8}$/;
export const RE_RUC = /^(10|15|17|20)[0-9]{9}$/;

/**
 * Comprobantes electrónicos (F-10), con el envío a SUNAT simulado.
 * Sin internet, se emiten con serie y número reservados en estado PENDIENTE y quedan
 * en cola; al volver la conexión se «envían» y pasan a ACEPTADO (REQ-FAC-08, REQ-CON-03).
 */
@Injectable()
export class ComprobantesService implements OnModuleInit, OnModuleDestroy {
  readonly tasa = Number(process.env.TASA_IMPUESTO ?? 0.105);
  private readonly log = new Logger('SUNAT');
  private reloj?: NodeJS.Timeout;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private eventos: EventosGateway,
    private bitacora: BitacoraService,
    private auth: AuthService,
  ) {}

  onModuleInit() {
    this.reloj = setInterval(() => this.procesarCola().catch((e) => this.log.error(e.message)), 20_000);
  }
  onModuleDestroy() {
    clearInterval(this.reloj);
  }

  /** Reglas del adquirente (RN-11): factura con RUC; boleta de más de S/ 700 con documento. */
  validarCliente(tipo: string, totalCentimos: number, documento: string | null) {
    if (tipo === 'FACTURA' && !(documento && RE_RUC.test(documento))) throw new BadRequestException('La factura necesita un RUC válido de 11 dígitos.');
    if (documento && !RE_DNI.test(documento) && !RE_RUC.test(documento)) throw new BadRequestException('Número de documento inválido');
    if (tipo === 'BOLETA' && totalCentimos > 70000 && !documento) throw new BadRequestException('Las boletas de más de S/ 700.00 necesitan el DNI del cliente.');
  }

  async emitir(
    tx: Tx,
    d: { cuentaId: string; tipo: 'BOLETA' | 'FACTURA' | 'NOTA_CREDITO'; total: number; documento?: string | null; nombre?: string | null; referenciaId?: string; serieRef?: string; motivo?: string },
  ) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(4242)`; // correlativos sin choques
    const serie = d.tipo === 'FACTURA' ? 'F001' : d.tipo === 'BOLETA' ? 'B001' : d.serieRef?.startsWith('F') ? 'FC01' : 'BC01';
    const ultimo = await tx.comprobante.aggregate({ where: { serie }, _max: { correlativo: true } });
    const { base, impuesto } = desglosarImpuesto(d.total, this.tasa);
    return tx.comprobante.create({
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
        total: aSoles(d.total),
        motivo: d.motivo,
        estado_sunat: this.config.booleano('sin_internet') ? 'PENDIENTE' : 'ACEPTADO', // simulado: en producción lo devuelve el OSE
      },
    });
  }

  pendientes() {
    return this.prisma.comprobante.count({ where: { estado_sunat: 'PENDIENTE' } });
  }

  /** Envía la cola de comprobantes pendientes cuando hay internet (simulado). */
  async procesarCola() {
    if (this.config.booleano('sin_internet')) return 0;
    const r = await this.prisma.comprobante.updateMany({ where: { estado_sunat: 'PENDIENTE' }, data: { estado_sunat: 'ACEPTADO' } });
    if (r.count) {
      this.log.log(`${r.count} comprobante(s) enviados desde la cola`);
      await this.bitacora.registrar('ENVIAR_COLA_SUNAT', 'comprobante', null, null, { enviados: r.count });
      this.eventos.emitir('estado:cambio', await this.estado());
    }
    return r.count;
  }

  async estado() {
    return { sinInternet: this.config.booleano('sin_internet'), pendientes: await this.pendientes() };
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
      if (c.other_comprobante.length) throw new BadRequestException('Este comprobante ya tiene una nota de crédito.');
      const nc = await this.emitir(tx, {
        cuentaId: c.cuenta_id,
        tipo: 'NOTA_CREDITO',
        total: aCentimos(c.total),
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
      return nc;
    });
    if (devolverEfectivo) this.eventos.emitir('gaveta:abrir', { motivo: 'Devolución por nota de crédito' });
    return { id: nc.id, numero: numeroComprobante(nc.serie, nc.correlativo) };
  }

  /** Datos para la representación impresa del comprobante (ticket de 80 mm). */
  async ver(id: string) {
    const c = await this.prisma.comprobante.findUnique({
      where: { id },
      include: {
        comprobante: { select: { serie: true, correlativo: true } },
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
      },
    });
    if (!c) throw new NotFoundException('Comprobante no encontrado');
    const numero = numeroComprobante(c.serie, c.correlativo);
    const p0 = c.cuenta.pedido[0];
    const origen = c.cuenta.sesion_mesa
      ? `Mesa ${c.cuenta.sesion_mesa.mesa.numero}`
      : p0
        ? { LLEVAR: 'Para llevar', DELIVERY: 'Delivery', APP_EXTERNA: 'App externa', SALON: 'Salón' }[p0.canal] + ` #${p0.numero}`
        : null;
    const descuento = Number(c.cuenta.descuento);
    const parcial = c.cuenta.comprobante.length > 1 || aCentimos(c.total) !== aCentimos(c.cuenta.total);
    let items: { cantidad: number; descripcion: string; importe: number }[];
    if (c.tipo === 'NOTA_CREDITO') {
      items = [{ cantidad: 1, descripcion: `Anulación de ${c.comprobante ? numeroComprobante(c.comprobante.serie, c.comprobante.correlativo) : ''}`, importe: Number(c.total) }];
    } else if (parcial) {
      items = [{ cantidad: 1, descripcion: `Consumo ${origen ?? ''} (cuenta dividida)`, importe: Number(c.total) }];
    } else {
      items = c.cuenta.pedido.flatMap((p) =>
        p.item_pedido.map((i) => ({
          cantidad: i.cantidad,
          descripcion: i.producto.nombre + (p.es_reposicion ? ' (reposición)' : ''),
          importe: aSoles(aCentimos(i.precio_unitario) * i.cantidad),
        })),
      );
      if (descuento > 0) items.push({ cantidad: 1, descripcion: `Descuento: ${c.cuenta.motivo_descuento ?? ''}`, importe: -descuento });
    }
    return {
      id: c.id,
      tipo: c.tipo,
      numero,
      emitidoEn: c.emitido_en,
      documento: c.documento_cliente,
      nombre: c.nombre_cliente,
      mesa: origen,
      items,
      base: Number(c.base_imponible),
      impuesto: Number(c.impuesto),
      total: Number(c.total),
      tasa: this.tasa,
      estadoSunat: c.estado_sunat,
      motivo: c.motivo,
      referencia: c.comprobante ? numeroComprobante(c.comprobante.serie, c.comprobante.correlativo) : null,
      qr: `20000000001|${c.tipo === 'FACTURA' ? '01' : c.tipo === 'BOLETA' ? '03' : '07'}|${c.serie}|${c.correlativo}|${Number(c.impuesto).toFixed(2)}|${Number(c.total).toFixed(2)}`,
    };
  }
}
