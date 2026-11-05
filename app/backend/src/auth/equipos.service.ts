import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes, randomInt } from 'crypto';
import { PrismaService } from '../comun/prisma.service';
import { ConfigService } from '../comun/config.service';
import { BitacoraService } from '../comun/bitacora.service';
import { enProduccion } from '../comun/produccion';
import { AlertasSeguridadService } from './alertas-seguridad.service';
import { Rol } from './roles.decorator';

export type TipoEquipo = 'SALON' | 'CAJA' | 'COCINA' | 'REPARTO' | 'ADMINISTRACION';
export interface EquipoActivo { id: string; nombre: string; tipo: TipoEquipo }

/** Quién puede ingresar en cada tipo de equipo. El administrador puede en cualquiera (con su contraseña). */
export const ROLES_EQUIPO: Record<TipoEquipo, Rol[]> = {
  SALON: ['MOZO'],
  CAJA: ['CAJERO'],
  COCINA: [],
  REPARTO: ['REPARTIDOR'],
  ADMINISTRACION: ['MOZO', 'CAJERO', 'REPARTIDOR'],
};
export const NOMBRE_TIPO: Record<TipoEquipo, string> = {
  SALON: 'tablet del salón',
  CAJA: 'terminal de caja',
  COCINA: 'pantalla de cocina',
  REPARTO: 'celular de reparto',
  ADMINISTRACION: 'equipo de administración',
};

/** Error que la web reconoce para mostrar «Este equipo no está vinculado». */
export const equipoNoVinculado = () =>
  new ForbiddenException({ statusCode: 403, codigo: 'EQUIPO_NO_VINCULADO', message: 'Este equipo no está autorizado para el personal. Pide al administrador un código de vinculación.' });

const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/I/L para dictarlo sin confusiones
const CODIGO_MIN = 10;
const sha = (t: string) => createHash('sha256').update(t).digest('hex');
const normalizar = (c: string) => String(c ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * Equipos vinculados: el dueño autoriza cada tablet, caja, cocina o celular con un
 * código de un solo uso. Solo desde esos equipos se ve la lista del personal y se ingresa
 * con PIN; así un PIN de 4 dígitos no sirve desde el celular de un extraño.
 */
@Injectable()
export class EquiposService {
  private cache = new Map<string, { equipo: EquipoActivo | null; hasta: number }>();

  constructor(private prisma: PrismaService, private config: ConfigService, private bitacora: BitacoraService, private alertas: AlertasSeguridadService) {}

  /** En producción siempre se exige; en desarrollo, según Administración → Configuración. */
  obligatorio() {
    return enProduccion() || this.config.booleano('exigir_equipo_vinculado');
  }

  /** Equipo de la llave que envía el navegador (cabecera X-Equipo), o null. Se recuerda 30 s. */
  async porLlave(llave?: string | string[], ip?: string): Promise<EquipoActivo | null> {
    const l = Array.isArray(llave) ? llave[0] : llave;
    if (!l || l.length < 20 || l.length > 100) return null;
    const h = sha(l);
    const c = this.cache.get(h);
    if (c && c.hasta > Date.now()) return c.equipo;
    const e = await this.prisma.equipo.findUnique({ where: { llave_hash: h } });
    const equipo = e && e.activo ? { id: e.id, nombre: e.nombre, tipo: e.tipo as TipoEquipo } : null;
    this.cache.set(h, { equipo, hasta: Date.now() + 30_000 });
    if (e && equipo) this.prisma.equipo.update({ where: { id: e.id }, data: { ultimo_uso: new Date(), ultima_ip: ip?.slice(0, 60) } }).catch(() => undefined);
    return equipo;
  }

  async listar() {
    const lista = await this.prisma.equipo.findMany({ orderBy: [{ activo: 'desc' }, { creado_en: 'asc' }] });
    const ahora = new Date();
    return lista.map((e) => ({
      id: e.id,
      nombre: e.nombre,
      tipo: e.tipo,
      activo: e.activo,
      estado: !e.activo ? 'DESVINCULADO' : e.llave_hash ? 'VINCULADO' : e.codigo_vence && e.codigo_vence > ahora ? 'ESPERANDO_CODIGO' : 'CODIGO_VENCIDO',
      vinculadoEn: e.vinculado_en,
      ultimoUso: e.ultimo_uso,
      ultimaIp: e.ultima_ip,
      codigoVence: e.codigo_vence,
    }));
  }

  private nuevoCodigo() {
    let c = '';
    for (let i = 0; i < 8; i++) c += ALFABETO[randomInt(ALFABETO.length)];
    return { codigo: `${c.slice(0, 4)}-${c.slice(4)}`, hash: sha(c), vence: new Date(Date.now() + CODIGO_MIN * 60_000) };
  }

  async crear(nombre: string, tipo: string, adminId: string) {
    const n = String(nombre ?? '').trim().slice(0, 60);
    if (n.length < 2) throw new BadRequestException('Escribe un nombre para el equipo, por ejemplo «Tablet salón 1».');
    if (!(tipo in ROLES_EQUIPO)) throw new BadRequestException('Tipo de equipo no válido.');
    const { codigo, hash, vence } = this.nuevoCodigo();
    const e = await this.prisma.equipo.create({ data: { nombre: n, tipo, codigo_hash: hash, codigo_vence: vence, creado_por: adminId } });
    await this.bitacora.registrar('EQUIPO_CREADO', 'equipo', e.id, adminId, { nombre: n, tipo });
    return { id: e.id, nombre: n, tipo, codigo, vence };
  }

  /** Código nuevo para un equipo existente (si borraron los datos del navegador o se cambió la tablet). */
  async regenerarCodigo(id: string, adminId: string) {
    const e = await this.prisma.equipo.findUnique({ where: { id } });
    if (!e) throw new NotFoundException('Equipo no encontrado.');
    const { codigo, hash, vence } = this.nuevoCodigo();
    // La llave anterior deja de servir: solo queda autorizado el equipo que use este código
    await this.prisma.equipo.update({ where: { id }, data: { codigo_hash: hash, codigo_vence: vence, llave_hash: null, activo: true } });
    this.cache.clear();
    await this.bitacora.registrar('EQUIPO_CODIGO', 'equipo', id, adminId, { nombre: e.nombre });
    return { id, nombre: e.nombre, tipo: e.tipo, codigo, vence };
  }

  async desvincular(id: string, adminId: string) {
    const e = await this.prisma.equipo.update({ where: { id }, data: { activo: false, llave_hash: null, codigo_hash: null, codigo_vence: null } });
    this.cache.clear(); // las sesiones abiertas en ese equipo dejan de funcionar al instante
    await this.bitacora.registrar('EQUIPO_DESVINCULADO', 'equipo', id, adminId, { nombre: e.nombre });
    return { ok: true };
  }

  /** El equipo nuevo canjea el código por su llave permanente. */
  async vincular(codigo: string, ip?: string) {
    const c = normalizar(codigo);
    const e = c.length === 8 ? await this.prisma.equipo.findFirst({ where: { codigo_hash: sha(c), activo: true, codigo_vence: { gt: new Date() } } }) : null;
    if (!e) {
      this.alertas.registrar('CODIGO_EQUIPO', ip);
      throw new BadRequestException('Código incorrecto o vencido. Pide uno nuevo al administrador (dura 10 minutos).');
    }
    const llave = randomBytes(32).toString('base64url');
    await this.prisma.equipo.update({ where: { id: e.id }, data: { llave_hash: sha(llave), codigo_hash: null, codigo_vence: null, vinculado_en: new Date(), ultimo_uso: new Date(), ultima_ip: ip?.slice(0, 60) } });
    this.cache.clear();
    await this.bitacora.registrar('EQUIPO_VINCULADO', 'equipo', e.id, null, { nombre: e.nombre, ip });
    this.alertas.avisar(`VINCULADO_${e.id}`, `Se vinculó el equipo «${e.nombre}» (${NOMBRE_TIPO[e.tipo as TipoEquipo]}). Si no fuiste tú, desvincúlalo en Administración → Equipos.`, false);
    return { llave, equipo: { id: e.id, nombre: e.nombre, tipo: e.tipo as TipoEquipo } };
  }
}
