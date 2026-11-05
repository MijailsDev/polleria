import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../comun/prisma.service';
import { BitacoraService } from '../comun/bitacora.service';
import { ConfigService } from '../comun/config.service';
import { Rol } from './roles.decorator';
import { EquipoActivo, EquiposService, equipoNoVinculado, NOMBRE_TIPO, ROLES_EQUIPO } from './equipos.service';
import { AlertasSeguridadService } from './alertas-seguridad.service';
import { enlaceOtpauth, nuevoSecreto, verificarTotp } from './totp';

const MAX_INTENTOS = 5;
const BLOQUEO_MS = 5 * 60 * 1000;
const HASH_FALSO = bcrypt.hashSync('usuario-inexistente', 10); // iguala el tiempo de respuesta

export type RespuestaLogin = { token: string; usuario: { id: string; nombre: string; rol: Rol } } | { requiere2fa: true };

@Injectable()
export class AuthService {
  // Bloqueo temporal tras 5 PIN fallidos (REQ-USR-01): usuario -> hora en que se desbloquea
  private bloqueados = new Map<string, number>();
  // Último intervalo TOTP usado por cada administrador: un código no se puede usar dos veces
  private ultimoPaso = new Map<string, number>();

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private bitacora: BitacoraService,
    private config: ConfigService,
    private equipos: EquiposService,
    private alertas: AlertasSeguridadService,
  ) {}

  /**
   * Nombres para la pantalla de ingreso. Si se exigen equipos vinculados, solo un equipo
   * vinculado ve la lista, y solo con el personal que trabaja en ese tipo de equipo.
   */
  async usuariosActivos(equipo: EquipoActivo | null, ip?: string) {
    if (!equipo && this.equipos.obligatorio()) {
      this.alertas.registrar('EQUIPO_NO_VINCULADO', ip);
      throw equipoNoVinculado();
    }
    const roles: Rol[] | null = equipo ? [...ROLES_EQUIPO[equipo.tipo], 'ADMINISTRADOR'] : null;
    return this.prisma.usuario.findMany({
      where: { activo: true, ...(roles ? { rol: { in: roles } } : {}) },
      select: { id: true, nombre: true, rol: true },
      orderBy: [{ rol: 'asc' }, { nombre: 'asc' }],
    });
  }

  private async verificarPin(usuarioId: string, pin: string, ip?: string) {
    const hasta = this.bloqueados.get(usuarioId);
    if (hasta && hasta > Date.now()) {
      const min = Math.ceil((hasta - Date.now()) / 60000);
      throw new ForbiddenException(`Usuario bloqueado por intentos fallidos. Intenta en ${min} min.`);
    }
    const u = /^[0-9a-f-]{36}$/i.test(usuarioId ?? '') ? await this.prisma.usuario.findUnique({ where: { id: usuarioId } }) : null;
    if (!u || !u.activo) throw new UnauthorizedException('PIN incorrecto');
    if (!(await bcrypt.compare(pin ?? '', u.pin_hash))) {
      this.alertas.registrar('PIN_FALLIDO', ip);
      const intentos = u.intentos_fallidos + 1;
      await this.prisma.usuario.update({ where: { id: u.id }, data: { intentos_fallidos: intentos >= MAX_INTENTOS ? 0 : intentos } });
      if (intentos >= MAX_INTENTOS) {
        this.bloqueados.set(u.id, Date.now() + BLOQUEO_MS);
        await this.bitacora.registrar('BLOQUEO_PIN', 'usuario', u.id, u.id, { ip });
        this.alertas.avisar(`BLOQUEO_${u.id}`, `«${u.nombre}» quedó bloqueado 5 minutos por 5 PIN incorrectos seguidos (${ip ?? 'IP desconocida'}).`);
        throw new ForbiddenException('Usuario bloqueado 5 minutos por 5 intentos fallidos.');
      }
      throw new UnauthorizedException('PIN incorrecto');
    }
    if (u.intentos_fallidos) await this.prisma.usuario.update({ where: { id: u.id }, data: { intentos_fallidos: 0 } });
    this.bloqueados.delete(u.id);
    return u;
  }

  /** Contraseña y, si la activó, código de la app autenticadora del administrador. */
  private async verificarAdmin(u: { id: string; password_hash: string | null; totp_activo: boolean; totp_secreto: string | null }, password: string | undefined, codigo: string | undefined, ip?: string) {
    if (!password) throw new UnauthorizedException('El administrador ingresa con PIN y contraseña.');
    if (!u.password_hash || !(await bcrypt.compare(password, u.password_hash))) {
      this.alertas.registrar('ADMIN_FALLIDO', ip);
      await this.bitacora.registrar('LOGIN_FALLIDO', 'usuario', u.id, u.id, { motivo: 'contraseña', ip });
      throw new UnauthorizedException('Contraseña incorrecta.');
    }
    if (!u.totp_activo || !u.totp_secreto) return true;
    if (!codigo) return false; // la web pide entonces el código de 6 dígitos
    const paso = verificarTotp(u.totp_secreto, codigo);
    if (paso === null || paso <= (this.ultimoPaso.get(u.id) ?? -1)) {
      this.alertas.registrar('ADMIN_FALLIDO', ip);
      await this.bitacora.registrar('LOGIN_FALLIDO', 'usuario', u.id, u.id, { motivo: 'código de verificación', ip });
      throw new UnauthorizedException('Código de verificación incorrecto o ya usado. Escribe el que muestra ahora tu app.');
    }
    this.ultimoPaso.set(u.id, paso);
    return true;
  }

  private emitir(u: { id: string; nombre: string; rol: string }, equipo: EquipoActivo | null) {
    const usuario = { id: u.id, nombre: u.nombre, rol: u.rol as Rol };
    const token = this.jwt.sign({ sub: u.id, nombre: u.nombre, rol: u.rol, ...(equipo ? { eq: equipo.id } : {}) });
    return { token, usuario };
  }

  /** Ingreso con PIN desde la lista de nombres (equipo vinculado, o cualquier equipo si no se exige). */
  async login(usuarioId: string, pin: string, password: string | undefined, codigo: string | undefined, equipo: EquipoActivo | null, ip?: string): Promise<RespuestaLogin> {
    if (!equipo && this.equipos.obligatorio()) {
      this.alertas.registrar('EQUIPO_NO_VINCULADO', ip);
      throw equipoNoVinculado();
    }
    const u = await this.verificarPin(usuarioId, pin, ip);
    if (equipo && u.rol !== 'ADMINISTRADOR' && !ROLES_EQUIPO[equipo.tipo].includes(u.rol as Rol)) {
      throw new ForbiddenException(`Este equipo es la ${NOMBRE_TIPO[equipo.tipo]}: ${u.nombre} (${u.rol.toLowerCase()}) no ingresa aquí.`);
    }
    // REQ-USR-01: el administrador usa además una contraseña para entrar al panel
    if (u.rol === 'ADMINISTRADOR' && !(await this.verificarAdmin(u, password, codigo, ip))) return { requiere2fa: true };
    await this.bitacora.registrar('LOGIN', 'usuario', u.id, u.id, { equipo: equipo?.nombre ?? null, ip });
    return this.emitir(u, equipo);
  }

  /**
   * Ingreso del dueño desde un equipo no vinculado (su celular o una laptop nueva):
   * nombre de usuario, contraseña, PIN y, si la activó, verificación en dos pasos.
   * Siempre se le avisa por WhatsApp, como los avisos de «nuevo inicio de sesión».
   */
  async loginAdmin(nombre: string, password: string, pin: string, codigo: string | undefined, equipo: EquipoActivo | null, ip?: string): Promise<RespuestaLogin> {
    const n = String(nombre ?? '').trim();
    const u = n ? await this.prisma.usuario.findFirst({ where: { nombre: { equals: n, mode: 'insensitive' }, rol: 'ADMINISTRADOR', activo: true } }) : null;
    if (!u) {
      await bcrypt.compare(password ?? '', HASH_FALSO);
      this.alertas.registrar('ADMIN_FALLIDO', ip);
      throw new UnauthorizedException('Usuario, contraseña o PIN incorrectos.');
    }
    await this.verificarPin(u.id, pin, ip);
    if (!(await this.verificarAdmin(u, password, codigo, ip))) return { requiere2fa: true };
    await this.bitacora.registrar('LOGIN', 'usuario', u.id, u.id, { equipo: equipo?.nombre ?? 'no vinculado', ip });
    if (!equipo) {
      this.alertas.avisar(`ADMIN_REMOTO_${u.id}`, `Ingreso de «${u.nombre}» al panel desde un equipo no vinculado (${ip ?? 'IP desconocida'}). Si no fuiste tú, cambia tu contraseña.`);
    }
    return this.emitir(u, equipo);
  }

  /** Autorización con PIN del administrador para acciones protegidas (RN-04). */
  async autorizarAdmin(pin: string) {
    const admins = await this.prisma.usuario.findMany({ where: { rol: 'ADMINISTRADOR', activo: true } });
    for (const a of admins) if (await bcrypt.compare(pin ?? '', a.pin_hash)) return a.id;
    throw new ForbiddenException('PIN de administrador incorrecto.');
  }

  // ---------------------------------------------------------------- Verificación en dos pasos

  async estado2fa(usuarioId: string) {
    const u = await this.prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
    return { activo: u.totp_activo };
  }

  /** Paso 1: secreto nuevo para escanear con la app (aún no se exige). */
  async iniciar2fa(usuarioId: string) {
    const u = await this.prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
    if (u.totp_activo) throw new BadRequestException('La verificación en dos pasos ya está activa. Desactívala primero para cambiar de celular.');
    const secreto = nuevoSecreto();
    await this.prisma.usuario.update({ where: { id: u.id }, data: { totp_secreto: secreto } });
    const emisor = this.config.texto('razon_social').replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9 .]/g, '').slice(0, 40) || 'Polleria';
    return { secreto, enlace: enlaceOtpauth(secreto, u.nombre, emisor) };
  }

  /** Paso 2: el primer código correcto confirma que la app quedó configurada. */
  async activar2fa(usuarioId: string, codigo: string) {
    const u = await this.prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
    if (!u.totp_secreto) throw new BadRequestException('Primero escanea el código QR.');
    const paso = verificarTotp(u.totp_secreto, codigo);
    if (paso === null) throw new BadRequestException('El código no coincide. Revisa que la hora del celular sea automática y escribe el código actual.');
    this.ultimoPaso.set(u.id, paso);
    await this.prisma.usuario.update({ where: { id: u.id }, data: { totp_activo: true } });
    await this.bitacora.registrar('2FA_ACTIVADO', 'usuario', u.id, u.id);
    return { activo: true };
  }

  async desactivar2fa(usuarioId: string, codigo: string) {
    const u = await this.prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
    if (!u.totp_activo || !u.totp_secreto) return { activo: false };
    if (verificarTotp(u.totp_secreto, codigo) === null) throw new BadRequestException('Código incorrecto: para desactivarla escribe el código actual de tu app.');
    await this.prisma.usuario.update({ where: { id: u.id }, data: { totp_activo: false, totp_secreto: null } });
    await this.bitacora.registrar('2FA_DESACTIVADO', 'usuario', u.id, u.id);
    this.alertas.avisar(`2FA_OFF_${u.id}`, `Se desactivó la verificación en dos pasos de «${u.nombre}».`, false);
    return { activo: false };
  }
}
