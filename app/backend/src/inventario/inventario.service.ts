import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../comun/prisma.service';
import { BitacoraService } from '../comun/bitacora.service';
import { ConfigService } from '../comun/config.service';
import { EventosGateway } from '../eventos/eventos.gateway';
import { AuthService } from '../auth/auth.service';
import { PedidosService } from '../pedidos/pedidos.service';

const redondear = (n: number, d = 3) => Math.round(n * 10 ** d) / 10 ** d;

/** Inventario de pollos por fracción y por presa, mermas y conteo físico (F-13). */
@Injectable()
export class InventarioService {
  constructor(
    private prisma: PrismaService,
    private pedidos: PedidosService,
    private config: ConfigService,
    private auth: AuthService,
    private bitacora: BitacoraService,
    private eventos: EventosGateway,
  ) {}

  /** Stock en tiempo real con alertas y el kardex reciente (REQ-INV-03). */
  async resumen() {
    const st = await this.pedidos.stock();
    const kardex = await this.prisma.movimiento_inventario.findMany({
      orderBy: { fecha: 'desc' },
      take: 60,
      include: { usuario: { select: { nombre: true } }, producto: { select: { nombre: true } }, pedido: { select: { numero: true, canal: true } } },
    });
    const minimo = this.config.numero('minimo_pollos');
    const umbral = this.config.numero('umbral_presas');
    return {
      stock: { pollos: redondear(st.pollos), pecho: redondear(st.pecho, 2), pierna: redondear(st.pierna, 2) },
      minimoPollos: minimo,
      umbralPresas: umbral,
      alertas: [
        ...(st.pollos < minimo ? [`Quedan ${redondear(st.pollos)} pollos (mínimo ${minimo})`] : []),
        ...(st.pecho < umbral ? ['Sin cuartos de pecho suficientes'] : []),
        ...(st.pierna < umbral ? ['Sin cuartos de pierna suficientes'] : []),
      ],
      kardex: kardex.map((m) => ({
        id: m.id,
        fecha: m.fecha,
        tipo: m.tipo,
        pollos: Number(m.pollos),
        pecho: Number(m.cuartos_pecho),
        pierna: Number(m.cuartos_pierna),
        motivo: m.motivo,
        autorizadoPor: m.usuario?.nombre ?? null,
        producto: m.producto?.nombre ?? null,
        pedido: m.pedido ? `#${m.pedido.numero}` : null,
      })),
    };
  }

  /** Ingreso de pollos enteros: 1 pollo = 2 cuartos de pecho + 2 de pierna (REQ-INV-01). */
  async ingreso(pollos: number, motivo: string | undefined, usuarioId: string) {
    const n = Number(pollos);
    if (!(n > 0 && n <= 500 && Number.isInteger(n))) throw new BadRequestException('Ingresa una cantidad entera de pollos (1 a 500).');
    await this.prisma.movimiento_inventario.create({
      data: { tipo: 'INGRESO', pollos: n, cuartos_pecho: 2 * n, cuartos_pierna: 2 * n, motivo: motivo?.trim() || 'Ingreso de pollos', autorizado_por: usuarioId },
    });
    await this.bitacora.registrar('INGRESO_POLLOS', 'movimiento_inventario', null, usuarioId, { pollos: n });
    await this.pedidos.controlarStock(true);
    this.eventos.emitir('inventario:cambio');
    return this.resumen();
  }

  /** Merma justificada con motivo y PIN del administrador (REQ-INV-04). */
  async merma(d: { pollos?: number; pecho?: number; pierna?: number; productoId?: string; motivo: string; detalle?: string; pinAdmin: string }, usuarioId: string) {
    const motivos = ['SOBRECOCCION', 'CAIDA', 'CRUDO', 'ENTREGA_FALLIDA', 'OTRO'];
    if (!motivos.includes(d.motivo)) throw new BadRequestException('Elige el motivo de la merma.');
    const pollos = Number(d.pollos ?? 0);
    const pecho = Number(d.pecho ?? 0);
    const pierna = Number(d.pierna ?? 0);
    if (pollos < 0 || pecho < 0 || pierna < 0 || pollos + pecho + pierna <= 0) throw new BadRequestException('Indica cuánto pollo o cuántas presas se perdieron.');
    const autorizadoPor = await this.auth.autorizarAdmin(d.pinAdmin);
    const motivo = `${d.motivo}${d.detalle?.trim() ? ': ' + d.detalle.trim() : ''}`.slice(0, 150);
    await this.prisma.movimiento_inventario.create({
      data: { tipo: 'MERMA', producto_id: d.productoId || null, pollos: -pollos, cuartos_pecho: -pecho, cuartos_pierna: -pierna, motivo, autorizado_por: autorizadoPor },
    });
    await this.bitacora.registrar('MERMA', 'movimiento_inventario', null, usuarioId, { pollos, pecho, pierna, motivo, autorizadoPor });
    await this.pedidos.controlarStock();
    this.eventos.emitir('inventario:cambio');
    return this.resumen();
  }

  /**
   * Conteo físico al cierre (REQ-INV-07): compara con el stock teórico, muestra la diferencia
   * no justificada y ajusta el kardex al conteo real (con PIN del administrador).
   */
  async conteo(d: { pollos: number; pecho: number; pierna: number; comentario?: string; pinAdmin: string }, usuarioId: string) {
    const fisico = { pollos: Number(d.pollos), pecho: Number(d.pecho), pierna: Number(d.pierna) };
    if (Object.values(fisico).some((v) => !(v >= 0))) throw new BadRequestException('Ingresa el conteo de pollos y presas.');
    const autorizadoPor = await this.auth.autorizarAdmin(d.pinAdmin);
    const teorico = await this.pedidos.stock();
    const dif = { pollos: redondear(fisico.pollos - teorico.pollos), pecho: redondear(fisico.pecho - teorico.pecho, 2), pierna: redondear(fisico.pierna - teorico.pierna, 2) };
    if (dif.pollos || dif.pecho || dif.pierna) {
      await this.prisma.movimiento_inventario.create({
        data: {
          tipo: 'AJUSTE',
          pollos: dif.pollos,
          cuartos_pecho: dif.pecho,
          cuartos_pierna: dif.pierna,
          motivo: `Conteo físico${d.comentario?.trim() ? ': ' + d.comentario.trim() : ''}`.slice(0, 150),
          autorizado_por: autorizadoPor,
        },
      });
    }
    await this.bitacora.registrar('CONTEO_FISICO', 'movimiento_inventario', null, usuarioId, { teorico, fisico, diferencia: dif, autorizadoPor });
    await this.pedidos.controlarStock(true);
    this.eventos.emitir('inventario:cambio');
    return { teorico, fisico, diferencia: dif };
  }
}
