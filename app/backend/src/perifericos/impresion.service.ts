import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Socket } from 'net';
import { PrismaService } from '../comun/prisma.service';
import { ConfigService } from '../comun/config.service';
import { EventosGateway } from '../eventos/eventos.gateway';
import { aEscPos, LineaTicket, Ticket } from './escpos';

export type Impresora = 'COCINA' | 'CAJA';

/**
 * Cola de impresión hacia las ticketeras térmicas.
 * Si en Configuración hay una IP (impresora_cocina / impresora_caja), el ticket se envía
 * por la red al puerto 9100 en formato ESC/POS, como lo haría el agente de impresión.
 * Si está vacía, se usa la impresora virtual: el ticket se ve en la pantalla /impresoras.
 */
@Injectable()
export class ImpresionService {
  private readonly log = new Logger('Impresoras');

  constructor(private prisma: PrismaService, private config: ConfigService, private eventos: EventosGateway) {}

  destino(impresora: Impresora) {
    const ip = this.config.texto(impresora === 'COCINA' ? 'impresora_cocina' : 'impresora_caja');
    return ip ? { tipo: 'RED' as const, ip } : { tipo: 'VIRTUAL' as const, ip: null };
  }

  async imprimir(impresora: Impresora, tipo: string, ticket: Ticket | LineaTicket[], opciones: { pitidos?: number; gaveta?: boolean } = {}) {
    const lineas = Array.isArray(ticket) ? ticket : ticket.lineas;
    const fila = await this.prisma.impresion.create({
      data: { impresora, tipo, contenido: JSON.stringify(lineas), pitidos: opciones.pitidos ?? 0 },
    });
    // Se envía fuera de la transacción del pedido: una impresora apagada no debe frenar la venta
    void this.entregar(fila.id, lineas, opciones);
    return fila.id;
  }

  /** Pulso de la gaveta de dinero (va por la ticketera de caja) y aviso en pantalla. */
  async abrirGaveta(motivo: string) {
    this.eventos.emitir('gaveta:abrir', { motivo });
    await this.imprimir('CAJA', 'GAVETA', [{ t: `[Pulso a la gaveta] ${motivo}`, c: true }], { gaveta: true });
  }

  private async entregar(id: string, lineas: LineaTicket[], opciones: { pitidos?: number; gaveta?: boolean }) {
    const impresion = await this.prisma.impresion.findUniqueOrThrow({ where: { id } });
    const d = this.destino(impresion.impresora as Impresora);
    let error: string | null = null;
    if (d.tipo === 'RED') {
      const soloGaveta = impresion.tipo === 'GAVETA';
      try {
        await enviarRed(d.ip, aEscPos(soloGaveta ? [] : lineas, { ...opciones, cortar: !soloGaveta }));
      } catch (e) {
        error = `No responde la impresora ${d.ip}: ${(e as Error).message}`.slice(0, 250);
        this.log.warn(error);
      }
    }
    const fila = await this.prisma.impresion.update({
      where: { id },
      data: error ? { estado: 'ERROR', error } : { estado: 'IMPRESO', impreso_en: new Date(), error: null },
    });
    this.eventos.emitir('impresion:nueva', this.formato(fila));
    if (error) this.eventos.emitir('alerta', { tipo: 'IMPRESORA', mensaje: `Impresora de ${fila.impresora.toLowerCase()} sin respuesta. Revisa el papel y el cable.`, hora: new Date() });
  }

  async reintentar(id: string) {
    const f = await this.prisma.impresion.findUnique({ where: { id } });
    if (!f) throw new NotFoundException('Impresión no encontrada');
    await this.prisma.impresion.update({ where: { id }, data: { estado: 'PENDIENTE', error: null } });
    await this.entregar(id, JSON.parse(f.contenido), { pitidos: f.pitidos, gaveta: f.tipo === 'GAVETA' });
    return { ok: true };
  }

  async listar(impresora: Impresora, limite = 30) {
    const filas = await this.prisma.impresion.findMany({ where: { impresora }, orderBy: { creado_en: 'desc' }, take: Math.min(limite, 100) });
    return { impresora, destino: this.destino(impresora), tickets: filas.map((f) => this.formato(f)) };
  }

  async estado() {
    const [errores, pendientes] = await Promise.all([
      this.prisma.impresion.count({ where: { estado: 'ERROR', creado_en: { gte: new Date(Date.now() - 86_400_000) } } }),
      this.prisma.impresion.count({ where: { estado: 'PENDIENTE' } }),
    ]);
    return { cocina: this.destino('COCINA'), caja: this.destino('CAJA'), errores24h: errores, pendientes };
  }

  private formato(f: { id: string; impresora: string; tipo: string; contenido: string; pitidos: number; estado: string; error: string | null; creado_en: Date }) {
    return { id: f.id, impresora: f.impresora, tipo: f.tipo, lineas: JSON.parse(f.contenido) as LineaTicket[], pitidos: f.pitidos, estado: f.estado, error: f.error, hora: f.creado_en };
  }
}

/** Envía los bytes a una ticketera de red (puerto RAW 9100 por defecto). */
function enviarRed(destino: string, datos: Buffer) {
  const [host, puerto] = destino.split(':');
  return new Promise<void>((resolve, reject) => {
    const s = new Socket();
    s.setTimeout(3000);
    s.once('timeout', () => s.destroy(new Error('tiempo de espera agotado')));
    s.once('error', reject);
    s.connect(Number(puerto ?? 9100), host, () => s.end(datos, () => resolve()));
  });
}
