import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../comun/prisma.service';
import { ConfigService } from '../comun/config.service';
import { EventosGateway } from '../eventos/eventos.gateway';

type Tx = Prisma.TransactionClient;
const RE_CELULAR = /^9[0-9]{8}$/;

interface ProveedorWhatsapp {
  readonly nombre: string;
  readonly simulado: boolean;
  enviar(destino: string, texto: string): Promise<string>; // devuelve el id del mensaje
}

/** Simulación con el mismo ciclo de estados que la API de Meta: enviado → entregado → leído. */
class WhatsappSimulado implements ProveedorWhatsapp {
  readonly nombre = 'Simulado (bandeja /whatsapp)';
  readonly simulado = true;
  async enviar() {
    await new Promise((r) => setTimeout(r, 150 + Math.random() * 350));
    return 'wamid.SIM' + randomBytes(12).toString('hex').toUpperCase();
  }
}

/**
 * WhatsApp Business Cloud API de Meta. Se activa con WHATSAPP_TOKEN y WHATSAPP_PHONE_ID.
 * Fuera de la ventana de 24 h Meta exige plantillas aprobadas; aquí se envía texto
 * (válido dentro de la ventana) y la plantilla se registra para el seguimiento.
 */
class WhatsappMeta implements ProveedorWhatsapp {
  readonly nombre = 'WhatsApp Business (Meta)';
  readonly simulado = false;
  constructor(private token: string, private telefonoId: string) {}
  async enviar(destino: string, texto: string) {
    const r = await fetch(`https://graph.facebook.com/v21.0/${this.telefonoId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: `51${destino}`, type: 'text', text: { body: texto, preview_url: true } }),
      signal: AbortSignal.timeout(8000),
    });
    const j = (await r.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message: string } };
    if (!r.ok || !j.messages?.[0]) throw new Error(j.error?.message ?? `HTTP ${r.status}`);
    return j.messages[0].id;
  }
}

/** Bandeja de salida de WhatsApp: comprobantes, avisos de delivery, reclamos y alertas al dueño. */
@Injectable()
export class WhatsappService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('WhatsApp');
  private reloj?: NodeJS.Timeout;
  private trabajando = false;
  readonly proveedor: ProveedorWhatsapp =
    process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID ? new WhatsappMeta(process.env.WHATSAPP_TOKEN, process.env.WHATSAPP_PHONE_ID) : new WhatsappSimulado();

  constructor(private prisma: PrismaService, private config: ConfigService, private eventos: EventosGateway) {}

  onModuleInit() {
    this.reloj = setInterval(() => this.procesar().catch((e) => this.log.error(e.message)), 3000);
  }
  onModuleDestroy() {
    clearInterval(this.reloj);
  }

  async encolar(destino: string, plantilla: string, texto: string, enlace?: string | null, tx: Tx = this.prisma) {
    if (!RE_CELULAR.test(destino ?? '')) throw new BadRequestException('El celular debe tener 9 dígitos y empezar con 9.');
    const m = await tx.mensaje_saliente.create({ data: { destino, plantilla, texto: enlace ? `${texto}\n${enlace}` : texto, enlace: enlace ?? null } });
    return { id: m.id };
  }

  /** Alerta al celular del dueño (si está configurado): cierres con diferencia, fugas, notas de crédito. */
  async alertaDueno(texto: string) {
    const cel = this.config.texto('celular_dueno');
    if (RE_CELULAR.test(cel)) await this.encolar(cel, 'ALERTA_DUENO', `⚠️ ${texto}`).catch(() => undefined);
  }

  async procesar() {
    if (this.trabajando) return;
    this.trabajando = true;
    try {
      if (!this.config.booleano('sin_internet')) {
        const cola = await this.prisma.mensaje_saliente.findMany({ where: { estado: 'EN_COLA', intentos: { lt: 5 } }, orderBy: { creado_en: 'asc' }, take: 20 });
        for (const m of cola) {
          try {
            const id = await this.proveedor.enviar(m.destino, m.texto);
            await this.prisma.mensaje_saliente.update({ where: { id: m.id }, data: { estado: 'ENVIADO', id_externo: id, enviado_en: new Date(), intentos: { increment: 1 }, error: null } });
          } catch (e) {
            const intentos = m.intentos + 1;
            await this.prisma.mensaje_saliente.update({
              where: { id: m.id },
              data: { intentos, error: (e as Error).message.slice(0, 250), estado: intentos >= 5 ? 'FALLIDO' : 'EN_COLA' },
            });
          }
          this.eventos.emitir('whatsapp:cambio', { destino: m.destino });
        }
      }
      if (this.proveedor.simulado) await this.avanzarSimulados();
    } finally {
      this.trabajando = false;
    }
  }

  /** En la simulación, el celular «recibe» a los 3 s y el cliente «lee» a los 10 s (doble check azul). */
  private async avanzarSimulados() {
    const ahora = Date.now();
    const entregados = await this.prisma.mensaje_saliente.updateMany({ where: { estado: 'ENVIADO', enviado_en: { lte: new Date(ahora - 3000) } }, data: { estado: 'ENTREGADO' } });
    const leidos = await this.prisma.mensaje_saliente.updateMany({ where: { estado: 'ENTREGADO', enviado_en: { lte: new Date(ahora - 10_000) } }, data: { estado: 'LEIDO', leido_en: new Date() } });
    if (entregados.count || leidos.count) this.eventos.emitir('whatsapp:cambio', {});
  }

  /** Conversaciones para el celular simulado (/whatsapp). */
  async chats() {
    const ms = await this.prisma.mensaje_saliente.findMany({ orderBy: { creado_en: 'asc' }, take: 500, where: { creado_en: { gte: new Date(Date.now() - 7 * 86_400_000) } } });
    const porDestino = new Map<string, typeof ms>();
    for (const m of ms) porDestino.set(m.destino, [...(porDestino.get(m.destino) ?? []), m]);
    return {
      proveedor: this.proveedor.nombre,
      simulado: this.proveedor.simulado,
      chats: [...porDestino.entries()]
        .map(([destino, lista]) => ({
          destino,
          ultimo: lista[lista.length - 1].creado_en,
          mensajes: lista.map((m) => ({ id: m.id, texto: m.texto, enlace: m.enlace, plantilla: m.plantilla, estado: m.estado, hora: m.creado_en, error: m.error })),
        }))
        .sort((a, b) => +b.ultimo - +a.ultimo),
    };
  }

  async estado() {
    const [enCola, fallidos, enviadosHoy] = await Promise.all([
      this.prisma.mensaje_saliente.count({ where: { estado: 'EN_COLA' } }),
      this.prisma.mensaje_saliente.count({ where: { estado: 'FALLIDO' } }),
      this.prisma.mensaje_saliente.count({ where: { enviado_en: { gte: new Date(Date.now() - 86_400_000) } } }),
    ]);
    return { proveedor: this.proveedor.nombre, simulado: this.proveedor.simulado, enCola, fallidos, enviados24h: enviadosHoy };
  }
}
