import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { PrismaService } from '../comun/prisma.service';
import { BitacoraService } from '../comun/bitacora.service';
import { ConfigService } from '../comun/config.service';
import { numeroComprobante, recalcularCuenta } from '../comun/cuentas';
import { aCentimos, aSoles } from '../comun/dinero';
import { EventosGateway } from '../eventos/eventos.gateway';
import { SalonService } from '../salon/salon.service';
import { ComprobantesService, RE_DNI, RE_RUC } from '../caja/comprobantes.service';
import { WhatsappService } from '../perifericos/whatsapp.service';

export interface EventoPasarela {
  intentoId: string;
  estado: 'APROBADO' | 'RECHAZADO';
  idTransaccion: string;
  medio: 'YAPE' | 'PLIN' | 'TARJETA';
  monto: number;
  propina?: number;
}

/** Lo que el comensal elige antes de ir a la pasarela. */
export interface OpcionesPago {
  token: string;
  monto?: number; // su parte; vacío = todo lo que falta pagar
  propina?: number;
  tipo?: 'BOLETA' | 'FACTURA';
  documento?: string;
  nombre?: string;
  celular?: string;
  enlaceBase?: string;
}

/** Algoritmo de Luhn para validar el número de tarjeta en la pasarela simulada. */
function luhn(numero: string) {
  let suma = 0;
  for (let i = 0; i < numero.length; i++) {
    let d = Number(numero[numero.length - 1 - i]);
    if (i % 2) d = d * 2 > 9 ? d * 2 - 9 : d * 2;
    suma += d;
  }
  return suma % 10 === 0;
}

/**
 * Pago en mesa desde el celular (F-09). La pasarela (Culqi / Izipay) está simulada:
 * procesa el pago y notifica al sistema con un webhook firmado con HMAC-SHA256.
 * Solo el webhook con firma válida da por pagada la cuenta (REQ-PAG-02).
 */
@Injectable()
export class PagosService implements OnModuleInit, OnModuleDestroy {
  private readonly secreto = process.env.PASARELA_SECRETO ?? 'secreto-de-prueba-de-la-pasarela';
  private readonly log = new Logger('Pasarela');
  /** En producción se reemplaza por Culqi o Izipay con sus llaves (CULQI_LLAVE_SECRETA); el flujo de webhook es el mismo. */
  readonly proveedor = { nombre: 'Pasarela simulada (flujo Culqi/Izipay)', simulado: true };
  private reloj?: NodeJS.Timeout;

  constructor(
    private prisma: PrismaService,
    private salon: SalonService,
    private comprobantes: ComprobantesService,
    private config: ConfigService,
    private eventos: EventosGateway,
    private bitacora: BitacoraService,
    private whatsapp: WhatsappService,
  ) {}

  onModuleInit() {
    this.reloj = setInterval(() => this.expirar().catch((e) => this.log.error(e.message)), 60_000);
  }
  onModuleDestroy() {
    clearInterval(this.reloj);
  }

  /** Libera las cuentas cuyo intento de pago pasó los 10 minutos (REQ-PAG-03). */
  async expirar() {
    const r = await this.prisma.pago_en_linea.updateMany({ where: { estado: 'PENDIENTE', expira_en: { lte: new Date() } }, data: { estado: 'EXPIRADO' } });
    if (r.count) this.eventos.emitir('mesas:cambio');
  }

  /** Saldo que aún se puede pagar: lo que falta menos lo que otros comensales están pagando ahora. */
  private async disponible(cuentaId: string, saldo: number) {
    const enCurso = await this.prisma.pago_en_linea.aggregate({ where: { cuenta_id: cuentaId, estado: 'PENDIENTE', expira_en: { gt: new Date() } }, _sum: { monto: true } });
    return Math.max(0, aCentimos(saldo) - aCentimos(enCurso._sum.monto));
  }

  /**
   * El comensal pulsa «Pagar» en la carta QR: elige su parte (cuenta dividida), el comprobante
   * con su DNI o RUC, la propina y el celular donde recibirá la boleta (F-09).
   */
  async iniciar(o: OpcionesPago) {
    if (this.config.booleano('sin_internet')) throw new ServiceUnavailableException('El pago en línea no está disponible ahora. Pide la cuenta y paga en caja.');
    await this.expirar();
    const { sesion, maestra } = await this.salon.validarToken(o.token);
    const cuenta = await this.prisma.cuenta.findFirst({ where: { sesion_mesa_id: sesion.id, estado: 'ABIERTA' }, include: { pedido: { where: { estado: 'POR_CONFIRMAR' } } } });
    if (!cuenta || Number(cuenta.saldo) <= 0) throw new BadRequestException('Tu mesa no tiene saldo por pagar.');
    if (cuenta.pedido.length) throw new BadRequestException('Espera a que el mozo confirme tu último pedido para pagar.');
    const disponible = await this.disponible(cuenta.id, Number(cuenta.saldo));
    if (disponible <= 0) throw new BadRequestException('Otro comensal está pagando lo que falta. Espera unos segundos y vuelve a mirar la cuenta.');
    const monto = o.monto === undefined || o.monto === null ? disponible : aCentimos(o.monto);
    if (monto < 100) throw new BadRequestException('El pago mínimo en línea es S/ 1.00.');
    if (monto > disponible) throw new BadRequestException(`Solo quedan S/ ${aSoles(disponible).toFixed(2)} por pagar.`);
    const tipo = o.tipo === 'FACTURA' ? 'FACTURA' : 'BOLETA';
    const documento = o.documento?.trim() || null;
    if (documento && !RE_DNI.test(documento) && !RE_RUC.test(documento)) throw new BadRequestException('Escribe un DNI de 8 dígitos o un RUC de 11.');
    this.comprobantes.validarCliente(tipo, monto, documento);
    const nombre = o.nombre?.trim().slice(0, 120) || null;
    if (documento && !nombre) throw new BadRequestException('Escribe tu nombre o razón social (o búscalo con tu documento).');
    const propina = aCentimos(o.propina ?? 0);
    if (propina < 0 || propina > monto) throw new BadRequestException('La propina no puede ser mayor que tu consumo.');
    const celular = o.celular?.trim() || null;
    if (celular && !/^9[0-9]{8}$/.test(celular)) throw new BadRequestException('El celular debe tener 9 dígitos y empezar con 9.');
    const enlaceBase = o.enlaceBase && /^https?:\/\/[^\s/]+$/.test(o.enlaceBase) ? o.enlaceBase.slice(0, 120) : null;
    const intento = await this.prisma.pago_en_linea.create({
      data: {
        cuenta_id: cuenta.id,
        monto: aSoles(monto),
        propina: aSoles(propina),
        tipo_comprobante: tipo,
        documento,
        nombre_cliente: nombre,
        celular,
        enlace_base: enlaceBase,
        expira_en: new Date(Date.now() + 10 * 60_000),
      },
    });
    this.eventos.emitir('alerta', { tipo: 'PAGO_EN_CURSO', mesaId: maestra.id, mesa: maestra.numero, mensaje: `${maestra.numero} está pagando S/ ${aSoles(monto).toFixed(2)} en línea`, hora: new Date() });
    return { intentoId: intento.id, monto: aSoles(monto), propina: aSoles(propina), total: aSoles(monto + propina), expiraEn: intento.expira_en };
  }

  /** Datos que muestra la página de la pasarela. */
  async intento(id: string) {
    const i = await this.prisma.pago_en_linea.findUnique({ where: { id }, include: { cuenta: { include: { sesion_mesa: { include: { mesa: true } } } } } });
    if (!i) throw new NotFoundException('Pago no encontrado');
    return {
      id: i.id,
      monto: Number(i.monto),
      propina: Number(i.propina),
      total: aSoles(aCentimos(i.monto) + aCentimos(i.propina)),
      comprobante: i.tipo_comprobante,
      documento: i.documento,
      nombre: i.nombre_cliente,
      estado: i.estado,
      expiraEn: i.expira_en,
      mesa: i.cuenta.sesion_mesa?.mesa.numero ?? null,
      comprobanteId: i.comprobante_id,
    };
  }

  /**
   * La pasarela simulada procesa el pago. Nunca se guarda la tarjeta ni el código de aprobación
   * (REQ-PAG-06): solo el identificador de la transacción que «devuelve» la pasarela.
   */
  async procesar(id: string, d: { medio: 'YAPE' | 'PLIN' | 'TARJETA'; celular?: string; aprobacion?: string; tarjeta?: string; vence?: string; cvv?: string }) {
    const i = await this.prisma.pago_en_linea.findUnique({ where: { id } });
    if (!i) throw new NotFoundException('Pago no encontrado');
    if (i.estado !== 'PENDIENTE' || i.expira_en <= new Date()) throw new BadRequestException('Este pago ya no está disponible. Vuelve a la carta e inténtalo otra vez.');
    if (!['YAPE', 'PLIN', 'TARJETA'].includes(d.medio)) throw new BadRequestException('Elige cómo pagar.');
    let aprobado = true;
    let motivo = '';
    if (d.medio === 'TARJETA') {
      const num = (d.tarjeta ?? '').replace(/\s/g, '');
      if (!/^[0-9]{15,16}$/.test(num) || !luhn(num)) throw new BadRequestException('Número de tarjeta inválido.');
      if (!/^(0[1-9]|1[0-2])\/[0-9]{2}$/.test(d.vence ?? '')) throw new BadRequestException('Fecha de vencimiento inválida (MM/AA).');
      if (!/^[0-9]{3,4}$/.test(d.cvv ?? '')) throw new BadRequestException('CVV inválido.');
      if (num === '4000000000000002') (aprobado = false), (motivo = 'Tarjeta rechazada por el banco');
    } else {
      if (!/^9[0-9]{8}$/.test(d.celular ?? '')) throw new BadRequestException('Ingresa tu número de celular.');
      if (!/^[0-9]{6}$/.test(d.aprobacion ?? '')) throw new BadRequestException(`Ingresa el código de aprobación de 6 dígitos de ${d.medio === 'YAPE' ? 'Yape' : 'Plin'}.`);
      if (d.aprobacion === '000000') (aprobado = false), (motivo = 'Código de aprobación vencido');
    }
    const evento: EventoPasarela = {
      intentoId: i.id,
      estado: aprobado ? 'APROBADO' : 'RECHAZADO',
      idTransaccion: `SIM-${randomBytes(8).toString('hex').toUpperCase()}`,
      medio: d.medio,
      monto: Number(i.monto),
      propina: Number(i.propina),
    };
    // La pasarela notifica al servidor con su firma (servidor a servidor)
    const cuerpo = JSON.stringify(evento);
    await this.webhook(cuerpo, this.firmar(cuerpo));
    return { estado: evento.estado, motivo };
  }

  /** El comensal cancela: la cuenta se desbloquea de inmediato. */
  async cancelar(id: string) {
    await this.prisma.pago_en_linea.updateMany({ where: { id, estado: 'PENDIENTE' }, data: { estado: 'EXPIRADO' } });
    this.eventos.emitir('mesas:cambio');
    return { ok: true };
  }

  firmar(cuerpo: string) {
    return createHmac('sha256', this.secreto).update(cuerpo).digest('hex');
  }

  /** Webhook de la pasarela: solo una firma HMAC válida confirma el pago. Es idempotente. */
  async webhook(cuerpo: string, firma: string | undefined) {
    const esperada = Buffer.from(this.firmar(cuerpo), 'hex');
    const recibida = Buffer.from(firma ?? '', 'hex');
    if (recibida.length !== esperada.length || !timingSafeEqual(recibida, esperada)) {
      this.log.warn('Webhook con firma inválida rechazado');
      throw new UnauthorizedException('Firma inválida');
    }
    const ev = JSON.parse(cuerpo) as EventoPasarela;
    const i = await this.prisma.pago_en_linea.findUnique({ where: { id: ev.intentoId } });
    if (!i) throw new NotFoundException('Pago no encontrado');
    if (i.estado !== 'PENDIENTE') return { ok: true, repetido: true };
    if (ev.estado === 'RECHAZADO') {
      await this.prisma.pago_en_linea.update({ where: { id: i.id }, data: { estado: 'RECHAZADO', medio: ev.medio, id_transaccion: ev.idTransaccion } });
      this.eventos.emitir('mesas:cambio');
      return { ok: true };
    }
    const r = await this.prisma.$transaction(async (tx) => {
      const cuenta = await tx.cuenta.findUniqueOrThrow({ where: { id: i.cuenta_id }, include: { sesion_mesa: { include: { mesa: true } } } });
      const monto = Math.min(aCentimos(ev.monto), aCentimos(cuenta.saldo));
      await tx.pago_en_linea.update({ where: { id: i.id }, data: { estado: 'APROBADO', medio: ev.medio, id_transaccion: ev.idTransaccion } });
      if (monto <= 0) return null;
      await tx.pago.create({ data: { cuenta_id: cuenta.id, medio: ev.medio, monto: aSoles(monto), propina: aSoles(aCentimos(ev.propina ?? 0)), id_transaccion: ev.idTransaccion } });
      const comp = await this.comprobantes.emitir(tx, { cuentaId: cuenta.id, tipo: i.tipo_comprobante === 'FACTURA' ? 'FACTURA' : 'BOLETA', total: monto, documento: i.documento, nombre: i.nombre_cliente });
      await tx.pago_en_linea.update({ where: { id: i.id }, data: { comprobante_id: comp.id } });
      const c = await recalcularCuenta(tx, cuenta.id);
      const mesa = cuenta.sesion_mesa?.mesa;
      if (c.estado === 'PAGADA' && mesa) await this.salon.estadoMesa(tx, mesa.id, 'POR_LIMPIAR');
      await this.bitacora.registrar('PAGO_EN_LINEA', 'cuenta', cuenta.id, null, { monto: aSoles(monto), medio: ev.medio, transaccion: ev.idTransaccion, comprobante: numeroComprobante(comp.serie, comp.correlativo) }, tx);
      return { mesa, monto, comprobanteId: comp.id };
    });
    if (r) {
      await this.comprobantes.enviarAhora([r.comprobanteId]);
      // REQ-FAC-06: la boleta llega al WhatsApp del comensal si dejó su celular
      if (i.celular && i.enlace_base) {
        const nombreComp = i.tipo_comprobante === 'FACTURA' ? 'factura' : 'boleta';
        await this.whatsapp
          .encolar(i.celular, 'COMPROBANTE', `${this.config.texto('razon_social')}: gracias por tu visita. Tu ${nombreComp} de la ${r.mesa?.numero ?? 'mesa'} por S/ ${aSoles(r.monto).toFixed(2)} está aquí:`, `${i.enlace_base}/c/${r.comprobanteId}`)
          .catch(() => undefined);
      }
    }
    if (r?.mesa) {
      this.eventos.emitir('alerta', { tipo: 'PAGO_EN_LINEA', mesaId: r.mesa.id, mesa: r.mesa.numero, mensaje: `${r.mesa.numero} pagó S/ ${aSoles(r.monto).toFixed(2)} en línea (${ev.medio.toLowerCase()})`, hora: new Date() });
      this.eventos.emitir('cuenta:actualizada', { mesaId: r.mesa.id });
    }
    this.eventos.emitir('mesas:cambio');
    this.eventos.emitir('estado:cambio', await this.comprobantes.estado());
    return { ok: true };
  }
}
