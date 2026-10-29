import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../comun/prisma.service';

type Fila = Record<string, unknown>;
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const ZONA = 'America/Lima';
const COBRABLES = Prisma.sql`('CONFIRMADO', 'EN_PREPARACION', 'SERVIDO')`;

/** Reportes del dueño (F-14): ventas, productos, presas, horas punta, tiempos y pérdidas. */
@Injectable()
export class ReportesService {
  constructor(private prisma: PrismaService) {}

  private rango(desde?: string, hasta?: string) {
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: ZONA });
    const d = desde || hoy;
    const h = hasta || d;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !/^\d{4}-\d{2}-\d{2}$/.test(h)) throw new BadRequestException('Fechas inválidas (AAAA-MM-DD).');
    if (h < d) throw new BadRequestException('La fecha final es anterior a la inicial.');
    // Medianoche de Lima (UTC-5, sin horario de verano)
    const ini = new Date(`${d}T00:00:00-05:00`);
    const fin = new Date(new Date(`${h}T00:00:00-05:00`).getTime() + 86_400_000);
    return { desde: d, hasta: h, ini, fin };
  }

  async generar(desde?: string, hasta?: string) {
    const { ini, fin, ...r } = this.rango(desde, hasta);
    const q = <T = Fila>(s: Prisma.Sql) => this.prisma.$queryRaw<T[]>(s);

    const [porDia, porMedio, porCanal, porCajero, porMozo, productos, presas, franjas, tiempos, nc, mermas, eventos, arqueos] = await Promise.all([
      q(Prisma.sql`
        SELECT to_char(fecha AT TIME ZONE ${ZONA}, 'YYYY-MM-DD') AS dia, sum(monto) AS total, count(DISTINCT cuenta_id) AS cuentas
        FROM pago WHERE fecha >= ${ini} AND fecha < ${fin} GROUP BY 1 ORDER BY 1`),
      q(Prisma.sql`SELECT medio, sum(monto) AS total, count(*) AS pagos FROM pago WHERE fecha >= ${ini} AND fecha < ${fin} GROUP BY 1 ORDER BY 2 DESC`),
      q(Prisma.sql`
        SELECT coalesce((SELECT p.canal FROM pedido p WHERE p.cuenta_id = g.cuenta_id OR p.cuenta_original_id = g.cuenta_id ORDER BY p.creado_en LIMIT 1), 'SALON') AS canal,
               sum(g.monto) AS total
        FROM pago g WHERE g.fecha >= ${ini} AND g.fecha < ${fin} GROUP BY 1 ORDER BY 2 DESC`),
      q(Prisma.sql`
        SELECT coalesce(u.nombre, 'Pago en línea (QR)') AS cajero, sum(g.monto) AS total, count(*) AS pagos
        FROM pago g LEFT JOIN turno t ON t.id = g.turno_id LEFT JOIN usuario u ON u.id = t.usuario_id
        WHERE g.fecha >= ${ini} AND g.fecha < ${fin} GROUP BY 1 ORDER BY 2 DESC`),
      q(Prisma.sql`
        SELECT coalesce(u.nombre, 'Sin asignar') AS mozo, count(DISTINCT p.id) AS pedidos, sum(i.precio_unitario * i.cantidad) AS total
        FROM pedido p JOIN item_pedido i ON i.pedido_id = p.id JOIN cuenta c ON c.id = p.cuenta_id LEFT JOIN usuario u ON u.id = p.registrado_por
        WHERE p.canal = 'SALON' AND p.estado IN ${COBRABLES} AND i.estado <> 'ANULADO' AND c.estado <> 'ANULADA' AND NOT p.es_reposicion
          AND p.creado_en >= ${ini} AND p.creado_en < ${fin}
        GROUP BY 1 ORDER BY 3 DESC`),
      q(Prisma.sql`
        SELECT pr.nombre AS producto, sum(i.cantidad) AS cantidad, sum(i.precio_unitario * i.cantidad) AS total
        FROM item_pedido i JOIN pedido p ON p.id = i.pedido_id JOIN producto pr ON pr.id = i.producto_id JOIN cuenta c ON c.id = p.cuenta_id
        WHERE p.estado IN ${COBRABLES} AND i.estado <> 'ANULADO' AND c.estado <> 'ANULADA' AND NOT p.es_reposicion
          AND p.creado_en >= ${ini} AND p.creado_en < ${fin}
        GROUP BY 1 ORDER BY 2 DESC, 3 DESC LIMIT 20`),
      q(Prisma.sql`
        SELECT o.nombre AS presa, sum(i.cantidad) AS cantidad
        FROM item_opcion io JOIN opcion_modificador o ON o.id = io.opcion_id JOIN grupo_modificador g ON g.id = o.grupo_id
        JOIN item_pedido i ON i.id = io.item_id JOIN pedido p ON p.id = i.pedido_id
        WHERE g.nombre IN ('Presa', 'Presas') AND p.estado IN ${COBRABLES} AND i.estado <> 'ANULADO'
          AND p.creado_en >= ${ini} AND p.creado_en < ${fin}
        GROUP BY 1 ORDER BY 2 DESC`),
      q(Prisma.sql`
        SELECT extract(hour FROM p.creado_en AT TIME ZONE ${ZONA})::int AS hora, count(DISTINCT p.id) AS pedidos, sum(i.precio_unitario * i.cantidad) AS total
        FROM pedido p JOIN item_pedido i ON i.pedido_id = p.id
        WHERE p.estado IN ${COBRABLES} AND i.estado <> 'ANULADO' AND NOT p.es_reposicion AND p.creado_en >= ${ini} AND p.creado_en < ${fin}
        GROUP BY 1 ORDER BY 1`),
      q(Prisma.sql`
        SELECT extract(hour FROM creado_en AT TIME ZONE ${ZONA})::int AS hora,
               avg(extract(epoch FROM impreso_en - creado_en)) / 60 AS espera_prom,
               avg(extract(epoch FROM servido_en - impreso_en)) / 60 AS prep_prom,
               max(extract(epoch FROM servido_en - impreso_en)) / 60 AS prep_max,
               avg(extract(epoch FROM servido_en - creado_en)) / 60 AS total_prom,
               max(extract(epoch FROM servido_en - creado_en)) / 60 AS total_max,
               count(*) AS pedidos
        FROM pedido WHERE impreso_en IS NOT NULL AND creado_en >= ${ini} AND creado_en < ${fin} AND NOT es_reposicion
        GROUP BY 1 ORDER BY 1`),
      q(Prisma.sql`
        SELECT n.serie || '-' || lpad(n.correlativo::text, 6, '0') AS numero, o.serie || '-' || lpad(o.correlativo::text, 6, '0') AS anula,
               n.total, n.motivo, n.emitido_en AS fecha
        FROM comprobante n LEFT JOIN comprobante o ON o.id = n.referencia_id
        WHERE n.tipo = 'NOTA_CREDITO' AND n.emitido_en >= ${ini} AND n.emitido_en < ${fin} ORDER BY n.emitido_en`),
      q(Prisma.sql`
        SELECT m.fecha, m.tipo, -m.pollos AS pollos, -m.cuartos_pecho AS pecho, -m.cuartos_pierna AS pierna, m.motivo, u.nombre AS autorizo
        FROM movimiento_inventario m LEFT JOIN usuario u ON u.id = m.autorizado_por
        WHERE m.tipo IN ('MERMA', 'REPOSICION') AND m.fecha >= ${ini} AND m.fecha < ${fin} ORDER BY m.fecha`),
      this.prisma.bitacora.findMany({
        where: { fecha: { gte: ini, lt: fin }, accion: { in: ['ANULAR_ITEM', 'DESCUENTO', 'FUGA_COMENSAL', 'REPOSICION', 'REABRIR_TURNO', 'ABRIR_GAVETA', 'CAMBIO_PRECIO', 'LIQUIDAR_REPARTIDOR'] } },
        include: { usuario: { select: { nombre: true } } },
        orderBy: { fecha: 'asc' },
      }),
      q(Prisma.sql`
        SELECT u.nombre AS cajero, t.apertura, t.cierre, t.efectivo_declarado AS declarado, t.diferencia, t.comentario
        FROM turno t JOIN usuario u ON u.id = t.usuario_id
        WHERE t.cierre >= ${ini} AND t.cierre < ${fin} ORDER BY t.cierre`),
    ]);

    // Nombre de quien autorizó cada evento sensible (REQ-REP-04)
    const ids = [...new Set(eventos.map((e) => (e.valores_despues as Fila | null)?.autorizadoPor).filter(Boolean) as string[])];
    const autoriza = new Map((await this.prisma.usuario.findMany({ where: { id: { in: ids } }, select: { id: true, nombre: true } })).map((u) => [u.id, u.nombre]));

    const totalVentas = porMedio.reduce((s, x) => s + num(x.total), 0);
    const cuentas = porDia.reduce((s, x) => s + num(x.cuentas), 0);
    const totalNc = nc.reduce((s, x) => s + num(x.total), 0);
    const redondear = (n: number) => Math.round(n * 100) / 100;
    return {
      ...r,
      resumen: {
        ventas: redondear(totalVentas),
        notasCredito: redondear(totalNc),
        ventasNetas: redondear(totalVentas - totalNc),
        cuentas,
        ticketPromedio: cuentas ? redondear(totalVentas / cuentas) : 0,
        pedidos: franjas.reduce((s, x) => s + num(x.pedidos), 0),
      },
      porDia: porDia.map((x) => ({ dia: x.dia, total: num(x.total), cuentas: num(x.cuentas) })),
      porMedio: porMedio.map((x) => ({ medio: x.medio, total: num(x.total), pagos: num(x.pagos) })),
      porCanal: porCanal.map((x) => ({ canal: x.canal, total: num(x.total) })),
      porCajero: porCajero.map((x) => ({ cajero: x.cajero, total: num(x.total), pagos: num(x.pagos) })),
      porMozo: porMozo.map((x) => ({ mozo: x.mozo, pedidos: num(x.pedidos), total: num(x.total) })),
      productos: productos.map((x) => ({ producto: x.producto, cantidad: num(x.cantidad), total: num(x.total) })),
      presas: presas.map((x) => ({ presa: x.presa, cantidad: num(x.cantidad) })),
      franjas: franjas.map((x) => ({ hora: num(x.hora), pedidos: num(x.pedidos), total: num(x.total) })),
      tiempos: tiempos.map((x) => ({
        hora: num(x.hora),
        pedidos: num(x.pedidos),
        esperaProm: x.espera_prom === null ? null : redondear(num(x.espera_prom)),
        prepProm: x.prep_prom === null ? null : redondear(num(x.prep_prom)),
        prepMax: x.prep_max === null ? null : redondear(num(x.prep_max)),
        totalProm: x.total_prom === null ? null : redondear(num(x.total_prom)),
        totalMax: x.total_max === null ? null : redondear(num(x.total_max)),
      })),
      notasCredito: nc.map((x) => ({ numero: x.numero, anula: x.anula, total: num(x.total), motivo: x.motivo, fecha: x.fecha })),
      mermas: mermas.map((x) => ({ fecha: x.fecha, tipo: x.tipo, pollos: num(x.pollos), pecho: num(x.pecho), pierna: num(x.pierna), motivo: x.motivo, autorizo: x.autorizo })),
      eventos: eventos.map((e) => {
        const v = (e.valores_despues ?? {}) as Fila;
        return { fecha: e.fecha, accion: e.accion, solicito: e.usuario?.nombre ?? 'Sistema', autorizo: v.autorizadoPor ? autoriza.get(v.autorizadoPor as string) ?? '' : '', detalle: v, antes: e.valores_antes };
      }),
      arqueos: arqueos.map((x) => ({ cajero: x.cajero, apertura: x.apertura, cierre: x.cierre, declarado: num(x.declarado), diferencia: num(x.diferencia), comentario: x.comentario })),
    };
  }
}
