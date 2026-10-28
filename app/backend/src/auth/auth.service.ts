import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../comun/prisma.service';
import { BitacoraService } from '../comun/bitacora.service';
import { Rol } from './roles.decorator';

const MAX_INTENTOS = 5;
const BLOQUEO_MS = 5 * 60 * 1000;

@Injectable()
export class AuthService {
  // Bloqueo temporal tras 5 PIN fallidos (REQ-USR-01): usuario -> hora en que se desbloquea
  private bloqueados = new Map<string, number>();

  constructor(private prisma: PrismaService, private jwt: JwtService, private bitacora: BitacoraService) {}

  usuariosActivos() {
    return this.prisma.usuario.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, rol: true },
      orderBy: [{ rol: 'asc' }, { nombre: 'asc' }],
    });
  }

  private async verificarPin(usuarioId: string, pin: string) {
    const hasta = this.bloqueados.get(usuarioId);
    if (hasta && hasta > Date.now()) {
      const min = Math.ceil((hasta - Date.now()) / 60000);
      throw new ForbiddenException(`Usuario bloqueado por intentos fallidos. Intenta en ${min} min.`);
    }
    const u = await this.prisma.usuario.findUnique({ where: { id: usuarioId } });
    if (!u || !u.activo) throw new UnauthorizedException('PIN incorrecto');
    if (!(await bcrypt.compare(pin ?? '', u.pin_hash))) {
      const intentos = u.intentos_fallidos + 1;
      await this.prisma.usuario.update({ where: { id: u.id }, data: { intentos_fallidos: intentos >= MAX_INTENTOS ? 0 : intentos } });
      if (intentos >= MAX_INTENTOS) {
        this.bloqueados.set(u.id, Date.now() + BLOQUEO_MS);
        await this.bitacora.registrar('BLOQUEO_PIN', 'usuario', u.id, u.id);
        throw new ForbiddenException('Usuario bloqueado 5 minutos por 5 intentos fallidos.');
      }
      throw new UnauthorizedException('PIN incorrecto');
    }
    if (u.intentos_fallidos) await this.prisma.usuario.update({ where: { id: u.id }, data: { intentos_fallidos: 0 } });
    this.bloqueados.delete(u.id);
    return u;
  }

  async login(usuarioId: string, pin: string) {
    const u = await this.verificarPin(usuarioId, pin);
    await this.bitacora.registrar('LOGIN', 'usuario', u.id, u.id);
    const usuario = { id: u.id, nombre: u.nombre, rol: u.rol as Rol };
    const token = this.jwt.sign({ sub: u.id, nombre: u.nombre, rol: u.rol });
    return { token, usuario };
  }

  /** Autorización con PIN del administrador para acciones protegidas (RN-04). */
  async autorizarAdmin(pin: string) {
    const admins = await this.prisma.usuario.findMany({ where: { rol: 'ADMINISTRADOR', activo: true } });
    for (const a of admins) if (await bcrypt.compare(pin ?? '', a.pin_hash)) return a.id;
    throw new ForbiddenException('PIN de administrador incorrecto.');
  }
}
