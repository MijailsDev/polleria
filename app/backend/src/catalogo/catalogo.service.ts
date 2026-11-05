import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../comun/prisma.service';
import { BitacoraService } from '../comun/bitacora.service';
import { EventosGateway } from '../eventos/eventos.gateway';

@Injectable()
export class CatalogoService {
  constructor(private prisma: PrismaService, private eventos: EventosGateway, private bitacora: BitacoraService) {}

  /** Carta completa: categorías con productos activos, sus grupos y opciones, con el precio del canal (REQ-CAT-06). */
  async carta(canal = 'SALON') {
    const categorias = await this.prisma.categoria.findMany({
      orderBy: { orden: 'asc' },
      include: {
        producto: {
          where: { activo: true },
          orderBy: { precio: 'asc' },
          include: {
            precio_canal: { where: { canal } },
            producto_foto: { select: { actualizado_en: true } },
            componentes: { include: { componente: { select: { nombre: true, agotado: true, activo: true } } } },
            grupo_modificador: {
              orderBy: [{ obligatorio: 'desc' }, { nombre: 'asc' }],
              include: { opcion_modificador: { orderBy: { recargo: 'asc' } } },
            },
          },
        },
      },
    });
    return categorias.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      productos: c.producto.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        precio: Number(p.precio_canal[0]?.precio ?? p.precio),
        fraccionPollo: Number(p.fraccion_pollo),
        destino: p.destino_impresion,
        descripcion: p.descripcion,
        // La foto se sirve desde la API; la fecha evita que el celular muestre una foto vieja
        fotoUrl: p.producto_foto ? `/api/productos/${p.id}/foto?v=${+p.producto_foto.actualizado_en}` : p.foto_url,
        // Un combo se muestra agotado si falta alguno de sus componentes
        agotado: p.agotado || p.componentes.some((c) => c.componente.agotado || !c.componente.activo),
        componentes: p.componentes.map((c) => `${c.cantidad} ${c.componente.nombre}`),
        grupos: p.grupo_modificador.map((g) => ({
          id: g.id,
          nombre: g.nombre,
          obligatorio: g.obligatorio,
          minimo: g.minimo,
          maximo: g.maximo,
          opciones: g.opcion_modificador.map((o) => ({ id: o.id, nombre: o.nombre, recargo: Number(o.recargo), agotado: o.agotado })),
        })),
      })),
    }));
  }

  /** «Lo más pedido» de los últimos 30 días para destacar en la carta QR. */
  async destacados() {
    const filas = await this.prisma.$queryRaw<{ producto_id: string }[]>`
      SELECT i.producto_id
      FROM item_pedido i JOIN pedido p ON p.id = i.pedido_id JOIN producto pr ON pr.id = i.producto_id
      WHERE p.creado_en >= now() - interval '30 days' AND p.estado NOT IN ('ANULADO', 'POR_CONFIRMAR')
        AND i.estado <> 'ANULADO' AND NOT p.es_reposicion AND pr.activo AND NOT pr.agotado
      GROUP BY i.producto_id ORDER BY sum(i.cantidad) DESC LIMIT 4`;
    return filas.map((f) => f.producto_id);
  }

  /** Foto del plato (pública, con caché de un día en el celular). */
  async foto(productoId: string) {
    const f = await this.prisma.producto_foto.findUnique({ where: { producto_id: productoId } });
    if (!f) throw new NotFoundException('El producto no tiene foto');
    return f;
  }

  /** Protocolo 86: marca o desmarca un producto o una opción como agotado (F-07). */
  async marcarAgotado(tipo: 'producto' | 'opcion', id: string, agotado: boolean, usuarioId: string) {
    if (tipo === 'producto') {
      const p = await this.prisma.producto.update({ where: { id }, data: { agotado } }).catch(() => null);
      if (!p) throw new NotFoundException('Producto no encontrado');
    } else {
      const o = await this.prisma.opcion_modificador.update({ where: { id }, data: { agotado } }).catch(() => null);
      if (!o) throw new NotFoundException('Opción no encontrada');
    }
    await this.bitacora.registrar(agotado ? 'MARCAR_AGOTADO' : 'QUITAR_AGOTADO', tipo, id, usuarioId);
    this.eventos.emitir('carta:actualizada');
    return { ok: true };
  }
}
