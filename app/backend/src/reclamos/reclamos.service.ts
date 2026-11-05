import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../comun/prisma.service';
import { BitacoraService } from '../comun/bitacora.service';
import { ConfigService } from '../comun/config.service';
import { EventosGateway } from '../eventos/eventos.gateway';
import { WhatsappService } from '../perifericos/whatsapp.service';
import { SincronizacionService } from '../perifericos/sincronizacion.service';

export interface ReclamoEntrada {
  tipo: 'RECLAMO' | 'QUEJA';
  nombre: string;
  tipoDocumento: 'DNI' | 'CE' | 'PAS';
  documento: string;
  domicilio: string;
  celular?: string;
  email?: string;
  menorDeEdad?: boolean;
  apoderado?: string;
  bien: 'PRODUCTO' | 'SERVICIO';
  monto?: number;
  descripcion: string;
  detalle: string;
  pedido: string;
  aceptaDatos: boolean;
}

const PLAZO_DIAS_HABILES = 15;

/** Fecha límite de respuesta: 15 días hábiles (sin sábados ni domingos). */
function plazo(desde: Date) {
  const d = new Date(desde);
  let habiles = 0;
  while (habiles < PLAZO_DIAS_HABILES) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) habiles++;
  }
  return d;
}

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * Libro de Reclamaciones virtual (Código de Protección y Defensa del Consumidor, Ley 29571).
 * El consumidor registra su hoja, recibe el código y una copia; el local responde en el plazo legal.
 */
@Injectable()
export class ReclamosService {
  constructor(
    private prisma: PrismaService,
    private bitacora: BitacoraService,
    private config: ConfigService,
    private eventos: EventosGateway,
    private whatsapp: WhatsappService,
    private sync: SincronizacionService,
  ) {}

  proveedor() {
    return { razonSocial: this.config.texto('razon_social'), ruc: this.config.texto('ruc_emisor'), direccion: this.config.texto('direccion_local') };
  }

  async registrar(e: ReclamoEntrada) {
    if (e.aceptaDatos !== true) throw new BadRequestException('Debes aceptar el tratamiento de tus datos personales para registrar la hoja.');
    if (e.tipo !== 'RECLAMO' && e.tipo !== 'QUEJA') throw new BadRequestException('Elige si es un reclamo o una queja.');
    if (e.bien !== 'PRODUCTO' && e.bien !== 'SERVICIO') throw new BadRequestException('Indica si se trata de un producto o un servicio.');
    if (!['DNI', 'CE', 'PAS'].includes(e.tipoDocumento)) throw new BadRequestException('Tipo de documento no válido.');
    const nombre = texto(e.nombre, 120);
    const documento = texto(e.documento, 12);
    const domicilio = texto(e.domicilio, 200);
    const descripcion = texto(e.descripcion, 250);
    const detalle = texto(e.detalle, 3000);
    const pedido = texto(e.pedido, 2000);
    const celular = texto(e.celular, 9) || null;
    const email = texto(e.email, 120) || null;
    if (!nombre || !domicilio || !descripcion || !detalle || !pedido) throw new BadRequestException('Completa todos los campos obligatorios.');
    if (e.tipoDocumento === 'DNI' ? !/^[0-9]{8}$/.test(documento) : !/^[A-Z0-9]{6,12}$/i.test(documento)) throw new BadRequestException('Número de documento inválido.');
    if (!celular && !email) throw new BadRequestException('Deja un celular o un correo para enviarte la respuesta.');
    if (celular && !/^9[0-9]{8}$/.test(celular)) throw new BadRequestException('El celular debe tener 9 dígitos y empezar con 9.');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Correo inválido.');
    if (e.menorDeEdad && !texto(e.apoderado, 120)) throw new BadRequestException('Si eres menor de edad, escribe el nombre de tu padre, madre o apoderado.');
    const monto = e.monto === undefined || e.monto === null || (e.monto as unknown) === '' ? null : Number(e.monto);
    if (monto !== null && !(monto >= 0 && monto < 100000)) throw new BadRequestException('Monto inválido.');

    const r = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(4343)`;
      const anio = new Date().getFullYear();
      const n = await tx.reclamo.count({ where: { codigo: { startsWith: `LR-${anio}-` } } });
      const codigo = `LR-${anio}-${String(n + 1).padStart(6, '0')}`;
      const ahora = new Date();
      const r = await tx.reclamo.create({
        data: {
          codigo,
          tipo: e.tipo,
          nombre,
          tipo_documento: e.tipoDocumento,
          documento,
          domicilio,
          celular,
          email,
          menor_de_edad: !!e.menorDeEdad,
          apoderado: e.menorDeEdad ? texto(e.apoderado, 120) : null,
          bien: e.bien,
          monto,
          descripcion,
          detalle,
          pedido,
          plazo: plazo(ahora),
        },
      });
      await this.sync.registrar(tx, 'reclamo', r.id, 'REGISTRAR', { codigo, tipo: r.tipo, plazo: r.plazo, creadoEn: r.creado_en });
      return r;
    });
    if (celular) {
      await this.whatsapp.encolar(
        celular,
        'RECLAMO_REGISTRADO',
        `${this.proveedor().razonSocial}: registramos tu ${r.tipo === 'QUEJA' ? 'queja' : 'reclamo'} ${r.codigo}. Te responderemos hasta el ${r.plazo.toLocaleDateString('es-PE')}.`,
      );
    }
    await this.whatsapp.alertaDueno(`Nuevo ${r.tipo.toLowerCase()} ${r.codigo} en el Libro de Reclamaciones. Plazo: ${r.plazo.toLocaleDateString('es-PE')}.`);
    this.eventos.emitir('alerta', { tipo: 'RECLAMO', mensaje: `Nuevo ${r.tipo.toLowerCase()} ${r.codigo} en el Libro de Reclamaciones`, hora: new Date() });
    return this.hoja(r);
  }

  /** El consumidor consulta su hoja con el código y su número de documento. */
  async consultar(codigo: string, documento: string) {
    const r = await this.prisma.reclamo.findUnique({ where: { codigo: codigo?.trim().toUpperCase() ?? '' } });
    if (!r || r.documento !== documento?.trim()) throw new NotFoundException('No encontramos una hoja con ese código y documento.');
    return this.hoja(r);
  }

  async listar() {
    const rs = await this.prisma.reclamo.findMany({ orderBy: [{ estado: 'asc' }, { creado_en: 'desc' }], take: 200, include: { usuario: { select: { nombre: true } } } });
    return rs.map((r) => ({ ...this.hoja(r), respondidoPor: r.usuario?.nombre ?? null, vencido: r.estado === 'PENDIENTE' && r.plazo < new Date() }));
  }

  async responder(id: string, respuesta: string, usuarioId: string) {
    const t = texto(respuesta, 3000);
    if (t.length < 10) throw new BadRequestException('Escribe la respuesta al consumidor.');
    const r0 = await this.prisma.reclamo.findUnique({ where: { id } });
    if (!r0) throw new NotFoundException('Reclamo no encontrado');
    if (r0.estado === 'RESPONDIDO') throw new BadRequestException('Este reclamo ya fue respondido.');
    const r = await this.prisma.reclamo.update({ where: { id }, data: { estado: 'RESPONDIDO', respuesta: t, respondido_por: usuarioId, respondido_en: new Date() } });
    await this.bitacora.registrar('RESPONDER_RECLAMO', 'reclamo', r.id, usuarioId, { codigo: r.codigo });
    if (r.celular) await this.whatsapp.encolar(r.celular, 'RECLAMO_RESPUESTA', `${this.proveedor().razonSocial} – respuesta a tu ${r.tipo.toLowerCase()} ${r.codigo}:\n${t}`);
    return this.hoja(r);
  }

  private hoja(r: Awaited<ReturnType<PrismaService['reclamo']['findUniqueOrThrow']>>) {
    return {
      id: r.id,
      codigo: r.codigo,
      fecha: r.creado_en,
      proveedor: this.proveedor(),
      tipo: r.tipo,
      consumidor: { nombre: r.nombre, tipoDocumento: r.tipo_documento, documento: r.documento, domicilio: r.domicilio, celular: r.celular, email: r.email, menorDeEdad: r.menor_de_edad, apoderado: r.apoderado },
      bien: r.bien,
      monto: r.monto === null ? null : Number(r.monto),
      descripcion: r.descripcion,
      detalle: r.detalle,
      pedido: r.pedido,
      estado: r.estado,
      respuesta: r.respuesta,
      respondidoEn: r.respondido_en,
      plazo: r.plazo,
    };
  }
}
