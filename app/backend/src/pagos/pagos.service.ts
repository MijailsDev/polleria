import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { PrismaService } from '../comun/prisma.service';
import { BitacoraService } from '../comun/bitacora.service';
import { ConfigService } from '../comun/config.service';
import { numeroComprobante, recalcularCuenta } from '../comun/cuentas';
import { aCentimos, aSoles } from '../comun/dinero';
import { EventosGateway } from '../eventos/eventos.gateway';
import { SalonService } from '../salon/salon.service';
import { ComprobantesService } from '../caja/comprobantes.service';

export interface EventoPasarela {
  intentoId: string;
  estado: 'APROBADO' | 'RECHAZADO';
  idTransaccion: string;
  medio: 'YAPE' | 'PLIN' | 'TARJETA';
  monto: number;
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
  private reloj?: NodeJS.Timeout;

  constructor(
    private prisma: PrismaService,
    private salon: SalonService,
    private comprobantes: ComprobantesService,
    private config: ConfigService,
    private eventos: EventosGateway,
    private bitacora: BitacoraService,
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

  /** El comensal pulsa «Pagar ahora» en la carta QR. */
  async iniciar(token: string) {
    if (this.config.booleano('sin_internet')) throw new ServiceUnavailableException('El pago en línea no está disponible ahora. Pide la cuenta y paga en caja.');
    await this.expirar();
    const { sesion, maestra } = await this.salon.validarToken(token);
    const cuenta = await this.prisma.cuenta.findFirst({ where: { sesion_mesa_id: sesion.id, estado: 'ABIERTA' }, include: { pedido: { where: { estado: 'POR_CONFIRMAR' } } } });
    if (!cuenta || Number(cuenta.saldo) <= 0) throw new BadRequestException('Tu mesa no tiene saldo por pagar.');
    if (cuenta.pedido.length) throw new BadRequestException('Espera a que el mozo confirme tu último pedido para pagar.');
    if (Number(cuenta.saldo) > 700) throw new BadRequestException('Las cuentas de más de S/ 700 se pagan en caja con tu DNI.');
    const previo = await this.prisma.pago_en_linea.findFirst({ where: { cuenta_id: cuenta.id, estado: 'PENDIENTE' } });
    const intento =
      previo ?? (await this.prisma.pago_en_linea.create({ data: { cuenta_id: cuenta.id, monto: cuenta.saldo, expira_en: new Date(Date.now() + 10 * 60_000) } }));
    this.eventos.emitir('alerta', { tipo: 'PAGO_EN_CURSO', mesaId: maestra.id, mesa: maestra.numero, mensaje: `${maestra.numero} está pagando en línea`, hora: new Date() });
    return { intentoId: intento.id, monto: Number(intento.monto), expiraEn: intento.expira_en };
  }

  /** Datos que muestra la página de la pasarela. */
  async intento(id: string) {
    const i = await this.prisma.pago_en_linea.findUnique({ where: { id }, include: { cuenta: { include: { sesion_mesa: { include: { mesa: true } } } } } });
    if (!i) throw new NotFoundException('Pago no encontrado');
    return { id: i.id, monto: Number(i.monto), estado: i.estado, expiraEn: i.expira_en, mesa: i.cuenta.sesion_mesa?.mesa.numero ?? null };
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
      await tx.pago.create({ data: { cuenta_id: cuenta.id, medio: ev.medio, monto: aSoles(monto), id_transaccion: ev.idTransaccion } });
      const comp = await this.comprobantes.emitir(tx, { cuentaId: cuenta.id, tipo: 'BOLETA', total: monto });
      const c = await recalcularCuenta(tx, cuenta.id);
      const mesa = cuenta.sesion_mesa?.mesa;
      if (c.estado === 'PAGADA' && mesa) await this.salon.estadoMesa(tx, mesa.id, 'POR_LIMPIAR');
      await this.bitacora.registrar('PAGO_EN_LINEA', 'cuenta', cuenta.id, null, { monto: aSoles(monto), medio: ev.medio, transaccion: ev.idTransaccion, comprobante: numeroComprobante(comp.serie, comp.correlativo) }, tx);
      return { mesa, monto };
    });
    if (r?.mesa) {
      this.eventos.emitir('alerta', { tipo: 'PAGO_EN_LINEA', mesaId: r.mesa.id, mesa: r.mesa.numero, mensaje: `${r.mesa.numero} pagó S/ ${aSoles(r.monto).toFixed(2)} en línea (${ev.medio.toLowerCase()})`, hora: new Date() });
      this.eventos.emitir('cuenta:actualizada', { mesaId: r.mesa.id });
    }
    this.eventos.emitir('mesas:cambio');
    this.eventos.emitir('estado:cambio', await this.comprobantes.estado());
    return { ok: true };
  }
}
