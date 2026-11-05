import { Injectable } from '@nestjs/common';
import { PrismaService } from '../comun/prisma.service';
import { ConfigService } from '../comun/config.service';
import { ImpresionService } from '../perifericos/impresion.service';
import { WhatsappService } from '../perifericos/whatsapp.service';
import { SincronizacionService } from '../perifericos/sincronizacion.service';
import { ComprobantesService } from '../caja/comprobantes.service';
import { PagosService } from '../pagos/pagos.service';

const INICIO = Date.now();
export const VERSION = process.env.npm_package_version ?? '1.1.0';

/** Monitoreo del servidor del local: base de datos, colas pendientes y errores (operación diaria). */
@Injectable()
export class SistemaService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private impresion: ImpresionService,
    private whatsapp: WhatsappService,
    private sync: SincronizacionService,
    private comprobantes: ComprobantesService,
    private pagos: PagosService,
  ) {}

  /** Chequeo liviano para balanceadores, Render y el aviso «sin conexión» de las pantallas. */
  async salud() {
    const t0 = Date.now();
    let db = true;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      db = false;
    }
    return { ok: db, db, latenciaDbMs: Date.now() - t0, version: VERSION, activoDesde: new Date(INICIO), hora: new Date() };
  }

  async detalle() {
    const salud = await this.salud();
    const hace24 = new Date(Date.now() - 86_400_000);
    const [sunat, impresoras, whatsapp, nube, errores24h, ultimosErrores, tamano] = await Promise.all([
      this.comprobantes.estado(),
      this.impresion.estado(),
      this.whatsapp.estado(),
      this.sync.estado(),
      this.prisma.error_registro.count({ where: { fecha: { gte: hace24 } } }),
      this.prisma.error_registro.findMany({ orderBy: { fecha: 'desc' }, take: 20, select: { id: true, metodo: true, ruta: true, mensaje: true, fecha: true } }),
      this.prisma.$queryRaw<{ tamano: string }[]>`SELECT pg_size_pretty(pg_database_size(current_database())) AS tamano`,
    ]);
    const memoria = process.memoryUsage();
    return {
      ...salud,
      entorno: process.env.NODE_ENV ?? 'development',
      sinInternet: this.config.booleano('sin_internet'),
      memoriaMb: Math.round(memoria.rss / 1048576),
      baseDeDatos: tamano[0]?.tamano ?? '?',
      sunat,
      pasarela: this.pagos.proveedor,
      impresoras,
      whatsapp,
      nube,
      errores24h,
      ultimosErrores: ultimosErrores.map((e) => ({ ...e, id: Number(e.id) })),
    };
  }
}
