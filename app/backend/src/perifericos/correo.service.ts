import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../comun/prisma.service';
import { ConfigService } from '../comun/config.service';
import { EventosGateway } from '../eventos/eventos.gateway';

export const RE_CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

interface ProveedorCorreo {
  readonly nombre: string;
  readonly simulado: boolean;
  enviar(destino: string, asunto: string, texto: string): Promise<string>; // devuelve el id del correo
}

/** Simulación: el correo «llega» a la bandeja /correo a los pocos segundos. */
class CorreoSimulado implements ProveedorCorreo {
  readonly nombre = 'Simulado (bandeja /correo)';
  readonly simulado = true;
  async enviar() {
    await new Promise((r) => setTimeout(r, 150 + Math.random() * 350));
    return 'mail.SIM' + randomBytes(10).toString('hex').toUpperCase();
  }
}

/** Resend (https://resend.com). Se activa con RESEND_API_KEY y CORREO_REMITENTE («La Brasa Dorada <hola@tudominio.pe>»). */
class CorreoResend implements ProveedorCorreo {
  readonly nombre = 'Resend';
  readonly simulado = false;
  constructor(private llave: string, private remitente: string) {}
  async enviar(destino: string, asunto: string, texto: string) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.llave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.remitente, to: [destino], subject: asunto, text: texto }),
      signal: AbortSignal.timeout(8000),
    });
    const j = (await r.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!r.ok || !j.id) throw new Error(j.message ?? `HTTP ${r.status}`);
    return j.id;
  }
}

/** Bandeja de salida de correos: códigos de verificación y promociones del programa de clientes frecuentes. */
@Injectable()
export class CorreoService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Correo');
  private reloj?: NodeJS.Timeout;
  private trabajando = false;
  readonly proveedor: ProveedorCorreo =
    process.env.RESEND_API_KEY && process.env.CORREO_REMITENTE ? new CorreoResend(process.env.RESEND_API_KEY, process.env.CORREO_REMITENTE) : new CorreoSimulado();

  constructor(private prisma: PrismaService, private config: ConfigService, private eventos: EventosGateway) {}

  onModuleInit() {
    this.reloj = setInterval(() => this.procesar().catch((e) => this.log.error(e.message)), 3000);
  }
  onModuleDestroy() {
    clearInterval(this.reloj);
  }

  async encolar(destino: string, plantilla: string, asunto: string, texto: string) {
    const correo = (destino ?? '').trim().toLowerCase();
    if (!RE_CORREO.test(correo) || correo.length > 120) throw new BadRequestException('Escribe un correo válido, por ejemplo nombre@gmail.com.');
    const m = await this.prisma.correo_saliente.create({ data: { destino: correo, plantilla, asunto: asunto.slice(0, 150), texto } });
    return { id: m.id };
  }

  async procesar() {
    if (this.trabajando) return;
    this.trabajando = true;
    try {
      if (!this.config.booleano('sin_internet')) {
        const cola = await this.prisma.correo_saliente.findMany({ where: { estado: 'EN_COLA', intentos: { lt: 5 } }, orderBy: { creado_en: 'asc' }, take: 20 });
        for (const m of cola) {
          try {
            const id = await this.proveedor.enviar(m.destino, m.asunto, m.texto);
            await this.prisma.correo_saliente.update({ where: { id: m.id }, data: { estado: 'ENVIADO', id_externo: id, enviado_en: new Date(), intentos: { increment: 1 }, error: null } });
          } catch (e) {
            const intentos = m.intentos + 1;
            await this.prisma.correo_saliente.update({ where: { id: m.id }, data: { intentos, error: (e as Error).message.slice(0, 250), estado: intentos >= 5 ? 'FALLIDO' : 'EN_COLA' } });
          }
          this.eventos.emitir('correo:cambio', { destino: m.destino });
        }
      }
      // En la simulación, el correo se da por entregado a los 3 segundos
      if (this.proveedor.simulado) {
        const r = await this.prisma.correo_saliente.updateMany({ where: { estado: 'ENVIADO', enviado_en: { lte: new Date(Date.now() - 3000) } }, data: { estado: 'ENTREGADO' } });
        if (r.count) this.eventos.emitir('correo:cambio', {});
      }
    } finally {
      this.trabajando = false;
    }
  }

  /** Bandeja simulada (/correo): los correos de la última semana agrupados por destinatario. */
  async bandeja() {
    const ms = await this.prisma.correo_saliente.findMany({ orderBy: { creado_en: 'desc' }, take: 300, where: { creado_en: { gte: new Date(Date.now() - 7 * 86_400_000) } } });
    return {
      proveedor: this.proveedor.nombre,
      simulado: this.proveedor.simulado,
      correos: ms.map((m) => ({ id: m.id, destino: m.destino, asunto: m.asunto, texto: m.texto, plantilla: m.plantilla, estado: m.estado, hora: m.creado_en, error: m.error })),
    };
  }
}
