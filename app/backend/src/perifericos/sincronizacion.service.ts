import { Injectable, Logger, OnModuleDestroy, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../comun/prisma.service';
import { ConfigService } from '../comun/config.service';
import { EventosGateway } from '../eventos/eventos.gateway';

type Tx = Prisma.TransactionClient;

export const SECRETO_SYNC = process.env.SYNC_SECRET ?? 'sync-local-polleria';
export const firmar = (cuerpo: string) => createHmac('sha256', SECRETO_SYNC).update(cuerpo).digest('hex');

/**
 * Arquitectura híbrida (diagrama de despliegue): el servidor del local vende aunque no haya
 * internet y guarda en evento_sync lo que la nube debe recibir. Cuando hay conexión, sube los
 * eventos en lotes firmados con HMAC a NUBE_URL. Si no hay NUBE_URL, se usa el receptor de
 * prueba de esta misma API (/api/nube/eventos), que hace de servidor en la nube.
 */
@Injectable()
export class SincronizacionService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Nube');
  private reloj?: NodeJS.Timeout;
  private trabajando = false;
  private ultimoEnvio: Date | null = null;
  private ultimoError: string | null = null;
  readonly url = process.env.NUBE_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3001}/api/nube/eventos`;

  constructor(private prisma: PrismaService, private config: ConfigService, private eventos: EventosGateway) {}

  onModuleInit() {
    this.reloj = setInterval(() => this.subir().catch((e) => this.log.error(e.message)), 15_000);
  }
  onModuleDestroy() {
    clearInterval(this.reloj);
  }

  /** Se llama dentro de la misma transacción de la venta: si la venta se revierte, el evento también. */
  registrar(tx: Tx, entidad: string, entidadId: string, operacion: string, datos: unknown) {
    return tx.evento_sync.create({ data: { entidad, entidad_id: entidadId, operacion, datos: JSON.parse(JSON.stringify(datos)) as Prisma.InputJsonValue } });
  }

  async subir() {
    if (this.trabajando || this.config.booleano('sin_internet')) return 0;
    this.trabajando = true;
    try {
      let total = 0;
      for (;;) {
        const lote = await this.prisma.evento_sync.findMany({ where: { enviado_en: null }, orderBy: { id: 'asc' }, take: 50 });
        if (!lote.length) break;
        const cuerpo = JSON.stringify({ local: 'polleria-01', eventos: lote.map((e) => ({ id: Number(e.id), entidad: e.entidad, entidadId: e.entidad_id, operacion: e.operacion, datos: e.datos, creadoEn: e.creado_en })) });
        try {
          const r = await fetch(this.url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-firma': firmar(cuerpo) }, body: cuerpo, signal: AbortSignal.timeout(10_000) });
          if (!r.ok) throw new Error(`La nube respondió HTTP ${r.status}`);
          await this.prisma.evento_sync.updateMany({ where: { id: { in: lote.map((e) => e.id) } }, data: { enviado_en: new Date(), error: null } });
          total += lote.length;
          this.ultimoEnvio = new Date();
          this.ultimoError = null;
        } catch (e) {
          this.ultimoError = (e as Error).message.slice(0, 250);
          await this.prisma.evento_sync.updateMany({ where: { id: { in: lote.map((e) => e.id) } }, data: { intentos: { increment: 1 }, error: this.ultimoError } });
          break;
        }
      }
      if (total) {
        this.log.log(`${total} evento(s) sincronizados con la nube`);
        this.eventos.emitir('estado:cambio', {});
      }
      return total;
    } finally {
      this.trabajando = false;
    }
  }

  async estado() {
    const [pendientes, masAntiguo] = await Promise.all([
      this.prisma.evento_sync.count({ where: { enviado_en: null } }),
      this.prisma.evento_sync.findFirst({ where: { enviado_en: null }, orderBy: { id: 'asc' }, select: { creado_en: true } }),
    ]);
    return { url: this.url, pendientes, pendienteDesde: masAntiguo?.creado_en ?? null, ultimoEnvio: this.ultimoEnvio, ultimoError: this.ultimoError };
  }

  // ---------------------------------------------------------------- Receptor en la nube (simulado)

  async recibir(cuerpoCrudo: Buffer | undefined, firma: string | undefined) {
    const cuerpo = cuerpoCrudo?.toString('utf8') ?? '';
    const esperada = Buffer.from(firmar(cuerpo));
    const recibida = Buffer.from(String(firma ?? ''));
    if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) throw new UnauthorizedException('Firma inválida');
    const { eventos } = JSON.parse(cuerpo) as { eventos: { id: number; entidad: string; entidadId: string; operacion: string; datos: Prisma.InputJsonValue }[] };
    // Idempotente: si un lote llega dos veces (reintento), no se duplica
    const r = await this.prisma.nube_evento.createMany({
      data: eventos.map((e) => ({ local_id: e.id, entidad: e.entidad, entidad_id: e.entidadId, operacion: e.operacion, datos: e.datos })),
      skipDuplicates: true,
    });
    return { recibidos: r.count };
  }

  /** Lo que el dueño vería desde su celular en la nube: ventas por día ya sincronizadas. */
  async resumenNube() {
    const filas = await this.prisma.$queryRaw<{ dia: string; comprobantes: bigint; total: number }[]>`
      SELECT to_char((datos->>'emitidoEn')::timestamptz AT TIME ZONE 'America/Lima', 'YYYY-MM-DD') AS dia,
             count(*) AS comprobantes,
             sum(CASE WHEN datos->>'tipo' = 'NOTA_CREDITO' THEN -(datos->>'total')::numeric ELSE (datos->>'total')::numeric END)::float AS total
      FROM nube_evento WHERE entidad = 'comprobante'
      GROUP BY 1 ORDER BY 1 DESC LIMIT 14`;
    const ultimo = await this.prisma.nube_evento.findFirst({ orderBy: { id: 'desc' }, select: { recibido_en: true } });
    const total = await this.prisma.nube_evento.count();
    return { eventos: total, ultimaRecepcion: ultimo?.recibido_en ?? null, ventasPorDia: filas.map((f) => ({ dia: f.dia, comprobantes: Number(f.comprobantes), total: Number(f.total ?? 0) })) };
  }
}
