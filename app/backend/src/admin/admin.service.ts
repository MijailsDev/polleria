import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../comun/prisma.service';
import { BitacoraService } from '../comun/bitacora.service';
import { ConfigService } from '../comun/config.service';
import { EventosGateway } from '../eventos/eventos.gateway';
import { ComprobantesService } from '../caja/comprobantes.service';

const ROLES = ['MOZO', 'CAJERO', 'REPARTIDOR', 'ADMINISTRADOR'];
const FRACCIONES = [0, 0.125, 0.25, 0.5, 1];
const DESTINOS = ['POLLERO', 'CAJA', 'COCINA_INTERNA'];

const validarPin = (pin: string) => {
  if (!/^[0-9]{4,6}$/.test(pin)) throw new BadRequestException('El PIN debe tener de 4 a 6 números.');
};
const validarPassword = (p: string) => {
  if (!p || p.length < 8) throw new BadRequestException('La contraseña del administrador debe tener al menos 8 caracteres.');
};

/** Panel del administrador: usuarios, carta, mesas, configuración y bitácora (F-01, F-02, REQ-SAL-06, REQ-REP-05). */
@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private bitacora: BitacoraService,
    private config: ConfigService,
    private eventos: EventosGateway,
    private comprobantes: ComprobantesService,
  ) {}

  // ---------------------------------------------------------------- Usuarios (REQ-USR-04)

  async usuarios() {
    const us = await this.prisma.usuario.findMany({ orderBy: [{ activo: 'desc' }, { rol: 'asc' }, { nombre: 'asc' }] });
    return us.map((u) => ({ id: u.id, nombre: u.nombre, rol: u.rol, activo: u.activo, creadoEn: u.creado_en, tienePassword: !!u.password_hash }));
  }

  async crearUsuario(d: { nombre: string; rol: string; pin: string; password?: string }, adminId: string) {
    if (!d.nombre?.trim()) throw new BadRequestException('Escribe el nombre.');
    if (!ROLES.includes(d.rol)) throw new BadRequestException('Elige un rol.');
    validarPin(d.pin);
    if (d.rol === 'ADMINISTRADOR') validarPassword(d.password ?? '');
    const u = await this.prisma.usuario.create({
      data: {
        nombre: d.nombre.trim().slice(0, 80),
        rol: d.rol,
        pin_hash: await bcrypt.hash(d.pin, 10),
        password_hash: d.rol === 'ADMINISTRADOR' ? await bcrypt.hash(d.password!, 10) : null,
      },
    });
    await this.bitacora.cambio('CREAR_USUARIO', 'usuario', u.id, adminId, null, { nombre: u.nombre, rol: u.rol });
    return { id: u.id };
  }

  /** Cambia nombre, rol, PIN o contraseña; desactivar no borra para conservar el historial. */
  async editarUsuario(id: string, d: { nombre?: string; rol?: string; activo?: boolean; pin?: string; password?: string }, adminId: string) {
    const u = await this.prisma.usuario.findUnique({ where: { id } });
    if (!u) throw new NotFoundException('Usuario no encontrado');
    const rol = d.rol ?? u.rol;
    if (!ROLES.includes(rol)) throw new BadRequestException('Rol no válido.');
    if (id === adminId && (d.activo === false || rol !== 'ADMINISTRADOR')) throw new BadRequestException('No puedes quitarte el acceso de administrador a ti mismo.');
    if (d.pin) validarPin(d.pin);
    if (d.password) validarPassword(d.password);
    if (rol === 'ADMINISTRADOR' && !u.password_hash && !d.password) throw new BadRequestException('Para darle el rol de administrador, asígnale una contraseña.');
    await this.prisma.usuario.update({
      where: { id },
      data: {
        nombre: d.nombre?.trim() || undefined,
        rol,
        activo: d.activo ?? undefined,
        pin_hash: d.pin ? await bcrypt.hash(d.pin, 10) : undefined,
        password_hash: d.password ? await bcrypt.hash(d.password, 10) : undefined,
        intentos_fallidos: d.pin ? 0 : undefined,
      },
    });
    await this.bitacora.cambio('EDITAR_USUARIO', 'usuario', id, adminId, { nombre: u.nombre, rol: u.rol, activo: u.activo }, {
      nombre: d.nombre ?? u.nombre,
      rol,
      activo: d.activo ?? u.activo,
      pinRestablecido: !!d.pin,
      passwordCambiada: !!d.password,
    });
    return { ok: true };
  }

  // ---------------------------------------------------------------- Carta (F-02)

  async carta() {
    const cats = await this.prisma.categoria.findMany({
      orderBy: { orden: 'asc' },
      include: {
        producto: {
          orderBy: [{ activo: 'desc' }, { precio: 'asc' }],
          include: { grupo_modificador: { orderBy: { nombre: 'asc' }, include: { opcion_modificador: { orderBy: { recargo: 'asc' } } } } },
        },
      },
    });
    return cats.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      orden: c.orden,
      productos: c.producto.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        precio: Number(p.precio),
        fraccionPollo: Number(p.fraccion_pollo),
        destino: p.destino_impresion,
        activo: p.activo,
        agotado: p.agotado,
        grupos: p.grupo_modificador.map((g) => ({
          id: g.id,
          nombre: g.nombre,
          obligatorio: g.obligatorio,
          minimo: g.minimo,
          maximo: g.maximo,
          opciones: g.opcion_modificador.map((o) => ({ id: o.id, nombre: o.nombre, recargo: Number(o.recargo), agotado: o.agotado, efecto: o.efecto_inventario })),
        })),
      })),
    }));
  }

  private avisarCarta() {
    this.eventos.emitir('carta:actualizada');
  }

  async guardarCategoria(id: string | null, d: { nombre: string; orden?: number }, adminId: string) {
    if (!d.nombre?.trim()) throw new BadRequestException('Escribe el nombre de la categoría.');
    const datos = { nombre: d.nombre.trim().slice(0, 50), orden: Math.trunc(Number(d.orden ?? 0)) };
    const c = id ? await this.prisma.categoria.update({ where: { id }, data: datos }) : await this.prisma.categoria.create({ data: datos });
    await this.bitacora.cambio(id ? 'EDITAR_CATEGORIA' : 'CREAR_CATEGORIA', 'categoria', c.id, adminId, null, datos);
    this.avisarCarta();
    return { id: c.id };
  }

  private datosProducto(d: { nombre?: string; precio?: number; categoriaId?: string; fraccionPollo?: number; destino?: string; activo?: boolean }, nuevo: boolean) {
    if (nuevo && !d.nombre?.trim()) throw new BadRequestException('Escribe el nombre del producto.');
    if (d.precio !== undefined && !(Number(d.precio) >= 0)) throw new BadRequestException('El precio debe ser un número mayor o igual a cero.');
    if (d.fraccionPollo !== undefined && !FRACCIONES.includes(Number(d.fraccionPollo))) throw new BadRequestException('La fracción de pollo debe ser 0, 1/8, 1/4, 1/2 o 1.');
    if (d.destino !== undefined && !DESTINOS.includes(d.destino)) throw new BadRequestException('Destino de impresión no válido.');
    return {
      nombre: d.nombre?.trim().slice(0, 80),
      precio: d.precio === undefined ? undefined : Math.round(Number(d.precio) * 100) / 100,
      categoria_id: d.categoriaId,
      fraccion_pollo: d.fraccionPollo === undefined ? undefined : Number(d.fraccionPollo),
      destino_impresion: d.destino,
      activo: d.activo,
    };
  }

  async crearProducto(d: { nombre: string; precio: number; categoriaId: string; fraccionPollo?: number; destino?: string }, adminId: string) {
    if (!d.categoriaId) throw new BadRequestException('Elige la categoría.');
    if (d.precio === undefined) throw new BadRequestException('Escribe el precio.');
    const datos = this.datosProducto(d, true);
    const p = await this.prisma.producto.create({
      data: { nombre: datos.nombre!, precio: datos.precio!, categoria_id: d.categoriaId, fraccion_pollo: datos.fraccion_pollo ?? 0, destino_impresion: datos.destino_impresion ?? 'POLLERO' },
    });
    await this.bitacora.cambio('CREAR_PRODUCTO', 'producto', p.id, adminId, null, { nombre: p.nombre, precio: Number(p.precio) });
    this.avisarCarta();
    return { id: p.id };
  }

  /** Al cambiar un precio, los pedidos anteriores conservan el suyo y el cambio queda en la bitácora (REQ-CAT-07). */
  async editarProducto(id: string, d: { nombre?: string; precio?: number; categoriaId?: string; fraccionPollo?: number; destino?: string; activo?: boolean }, adminId: string) {
    const antes = await this.prisma.producto.findUnique({ where: { id } });
    if (!antes) throw new NotFoundException('Producto no encontrado');
    const datos = this.datosProducto(d, false);
    const p = await this.prisma.producto.update({ where: { id }, data: datos });
    const accion = d.precio !== undefined && Number(antes.precio) !== Number(p.precio) ? 'CAMBIO_PRECIO' : 'EDITAR_PRODUCTO';
    await this.bitacora.cambio(
      accion,
      'producto',
      id,
      adminId,
      { nombre: antes.nombre, precio: Number(antes.precio), activo: antes.activo, fraccion: Number(antes.fraccion_pollo), destino: antes.destino_impresion },
      { nombre: p.nombre, precio: Number(p.precio), activo: p.activo, fraccion: Number(p.fraccion_pollo), destino: p.destino_impresion },
    );
    this.avisarCarta();
    return { ok: true };
  }

  async crearGrupo(productoId: string, d: { nombre: string; obligatorio: boolean; minimo: number; maximo: number }, adminId: string) {
    if (!d.nombre?.trim()) throw new BadRequestException('Escribe el nombre del grupo (ej.: Presa, Cremas).');
    const minimo = Math.trunc(Number(d.minimo ?? 0));
    const maximo = Math.trunc(Number(d.maximo ?? 1));
    const obligatorio = !!d.obligatorio;
    if (maximo < 1 || minimo < 0 || maximo < minimo) throw new BadRequestException('Revisa el mínimo y el máximo de opciones.');
    if (obligatorio && minimo < 1) throw new BadRequestException('Un grupo obligatorio debe pedir al menos 1 opción.');
    const g = await this.prisma.grupo_modificador.create({ data: { producto_id: productoId, nombre: d.nombre.trim().slice(0, 40), obligatorio, minimo, maximo } });
    await this.bitacora.cambio('CREAR_GRUPO', 'grupo_modificador', g.id, adminId, null, { nombre: g.nombre, obligatorio, minimo, maximo });
    this.avisarCarta();
    return { id: g.id };
  }

  async crearOpcion(grupoId: string, d: { nombre: string; recargo?: number; pecho?: number; pierna?: number }, adminId: string) {
    if (!d.nombre?.trim()) throw new BadRequestException('Escribe el nombre de la opción.');
    const recargo = Number(d.recargo ?? 0);
    if (!(recargo >= 0)) throw new BadRequestException('El recargo no puede ser negativo.');
    const efecto = Number(d.pecho) || Number(d.pierna) ? { ...(Number(d.pecho) ? { cuartos_pecho: Number(d.pecho) } : {}), ...(Number(d.pierna) ? { cuartos_pierna: Number(d.pierna) } : {}) } : undefined;
    const o = await this.prisma.opcion_modificador.create({ data: { grupo_id: grupoId, nombre: d.nombre.trim().slice(0, 60), recargo, efecto_inventario: efecto } });
    await this.bitacora.cambio('CREAR_OPCION', 'opcion_modificador', o.id, adminId, null, { nombre: o.nombre, recargo });
    this.avisarCarta();
    return { id: o.id };
  }

  async editarOpcion(id: string, d: { nombre?: string; recargo?: number }, adminId: string) {
    const antes = await this.prisma.opcion_modificador.findUnique({ where: { id } });
    if (!antes) throw new NotFoundException('Opción no encontrada');
    if (d.recargo !== undefined && !(Number(d.recargo) >= 0)) throw new BadRequestException('El recargo no puede ser negativo.');
    const o = await this.prisma.opcion_modificador.update({
      where: { id },
      data: { nombre: d.nombre?.trim().slice(0, 60) || undefined, recargo: d.recargo === undefined ? undefined : Number(d.recargo) },
    });
    await this.bitacora.cambio('EDITAR_OPCION', 'opcion_modificador', id, adminId, { nombre: antes.nombre, recargo: Number(antes.recargo) }, { nombre: o.nombre, recargo: Number(o.recargo) });
    this.avisarCarta();
    return { ok: true };
  }

  // ---------------------------------------------------------------- Mesas (REQ-SAL-06)

  async mesas() {
    const ms = await this.prisma.mesa.findMany({ orderBy: { numero: 'asc' } });
    return ms.map((m) => ({ id: m.id, numero: m.numero, capacidad: m.capacidad, activa: m.activa, estado: m.estado }));
  }

  async crearMesa(capacidad: number, adminId: string) {
    const ms = await this.prisma.mesa.findMany({ select: { numero: true } });
    const siguiente = Math.max(0, ...ms.map((m) => Number(m.numero.slice(2)))) + 1;
    if (siguiente > 99) throw new BadRequestException('Se alcanzó el máximo de 99 mesas.');
    const cap = Math.trunc(Number(capacidad) || 4);
    if (cap < 1 || cap > 20) throw new BadRequestException('La capacidad debe ser de 1 a 20 sillas.');
    const m = await this.prisma.mesa.create({ data: { numero: `M-${String(siguiente).padStart(2, '0')}`, capacidad: cap } });
    await this.bitacora.cambio('CREAR_MESA', 'mesa', m.id, adminId, null, { numero: m.numero, capacidad: cap });
    this.eventos.emitir('mesas:cambio');
    return { id: m.id, numero: m.numero };
  }

  async editarMesa(id: string, d: { capacidad?: number; activa?: boolean }, adminId: string) {
    const m = await this.prisma.mesa.findUnique({ where: { id } });
    if (!m) throw new NotFoundException('Mesa no encontrada');
    if (d.activa === false && m.estado !== 'LIBRE') throw new BadRequestException(`La mesa ${m.numero} está en uso; libérala antes de desactivarla.`);
    const cap = d.capacidad === undefined ? undefined : Math.trunc(Number(d.capacidad));
    if (cap !== undefined && (cap < 1 || cap > 20)) throw new BadRequestException('La capacidad debe ser de 1 a 20 sillas.');
    await this.prisma.mesa.update({ where: { id }, data: { capacidad: cap, activa: d.activa } });
    await this.bitacora.cambio('EDITAR_MESA', 'mesa', id, adminId, { capacidad: m.capacidad, activa: m.activa }, { capacidad: cap ?? m.capacidad, activa: d.activa ?? m.activa });
    this.eventos.emitir('mesas:cambio');
    return { ok: true };
  }

  // ---------------------------------------------------------------- Configuración

  config_() {
    return this.config.todas();
  }

  async guardarConfig(clave: string, valor: unknown, adminId: string) {
    let r: { antes: unknown; despues: unknown };
    try {
      r = await this.config.guardar(clave, valor);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    await this.bitacora.cambio('CAMBIAR_CONFIGURACION', 'configuracion', null, adminId, { [clave]: r.antes }, { [clave]: r.despues });
    if (clave === 'sin_internet') {
      // Al volver internet se envía la cola de comprobantes (REQ-CON-03)
      if (r.despues === false) await this.comprobantes.procesarCola();
      this.eventos.emitir('estado:cambio', await this.comprobantes.estado());
    }
    if (clave === 'umbral_cola_cocina') this.eventos.emitir('cocina:actualizar', {});
    return { ok: true };
  }

  // ---------------------------------------------------------------- Bitácora de solo lectura (REQ-REP-05)

  async bitacora_(limite = 200, accion?: string) {
    const filas = await this.prisma.bitacora.findMany({
      where: accion ? { accion: { contains: accion.toUpperCase() } } : undefined,
      orderBy: { fecha: 'desc' },
      take: Math.min(500, Math.max(1, limite)),
      include: { usuario: { select: { nombre: true } } },
    });
    return filas.map((b) => ({
      id: String(b.id),
      fecha: b.fecha,
      usuario: b.usuario?.nombre ?? 'Sistema',
      accion: b.accion,
      entidad: b.entidad,
      antes: b.valores_antes,
      despues: b.valores_despues,
    }));
  }
}
