import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../comun/prisma.service';
import { BitacoraService } from '../comun/bitacora.service';
import { EventosGateway } from '../eventos/eventos.gateway';

@Injectable()
export class CatalogoService {
  constructor(private prisma: PrismaService, private eventos: EventosGateway, private bitacora: BitacoraService) {}

  /** Carta completa: categorías con productos activos, sus grupos y opciones. */
  async carta() {
    const categorias = await this.prisma.categoria.findMany({
      orderBy: { orden: 'asc' },
      include: {
        producto: {
          where: { activo: true },
          orderBy: { precio: 'asc' },
          include: {
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
        precio: Number(p.precio),
        fraccionPollo: Number(p.fraccion_pollo),
        destino: p.destino_impresion,
        fotoUrl: p.foto_url,
        agotado: p.agotado,
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
