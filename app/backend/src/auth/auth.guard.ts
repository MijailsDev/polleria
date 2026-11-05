import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ROLES_KEY, Rol } from './roles.decorator';
import { EquiposService, equipoNoVinculado } from './equipos.service';

export interface UsuarioToken { sub: string; nombre: string; rol: Rol; eq?: string }

/**
 * Verifica el token JWT del personal y su rol (RNF-SEG-02). Si la sesión se abrió en un
 * equipo vinculado, el token solo sirve junto con la llave de ese mismo equipo: copiar el
 * token a otro celular no funciona, y al desvincular el equipo la sesión se cierra.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwt: JwtService, private reflector: Reflector, private equipos: EquiposService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const [tipo, token] = (req.headers.authorization ?? '').split(' ');
    if (tipo !== 'Bearer' || !token) throw new UnauthorizedException('Inicia sesión para continuar.');
    try {
      req.usuario = this.jwt.verify<UsuarioToken>(token);
    } catch {
      throw new UnauthorizedException('Tu sesión expiró. Vuelve a ingresar tu PIN.');
    }
    if (req.usuario.eq) {
      const equipo = await this.equipos.porLlave(req.headers['x-equipo'], req.ip);
      if (!equipo || equipo.id !== req.usuario.eq) throw new UnauthorizedException('Este equipo fue desvinculado o la sesión es de otro equipo. Vuelve a ingresar.');
      req.equipo = equipo;
    } else if (req.usuario.rol !== 'ADMINISTRADOR' && this.equipos.obligatorio()) {
      throw new UnauthorizedException('Ingresa desde un equipo vinculado.');
    }
    const roles = this.reflector.getAllAndOverride<Rol[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (roles?.length && req.usuario.rol !== 'ADMINISTRADOR' && !roles.includes(req.usuario.rol)) {
      throw new ForbiddenException('No tienes permisos para esta operación.');
    }
    return true;
  }
}

/**
 * Pantallas sin PIN (cocina) y simuladores (impresoras, WhatsApp): basta un equipo vinculado
 * o una sesión del personal. Si no se exigen equipos (desarrollo), quedan abiertas como antes.
 */
@Injectable()
export class EquipoGuard implements CanActivate {
  constructor(private jwt: JwtService, private equipos: EquiposService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (!this.equipos.obligatorio()) return true;
    const req = ctx.switchToHttp().getRequest();
    const equipo = await this.equipos.porLlave(req.headers['x-equipo'], req.ip);
    if (equipo) return (req.equipo = equipo), true;
    const [tipo, token] = (req.headers.authorization ?? '').split(' ');
    if (tipo === 'Bearer' && token) {
      try {
        const u = this.jwt.verify<UsuarioToken>(token);
        if (!u.eq && u.rol === 'ADMINISTRADOR') return true;
      } catch {
        /* token inválido */
      }
    }
    throw equipoNoVinculado();
  }
}
