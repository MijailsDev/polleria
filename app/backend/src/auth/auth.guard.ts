import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ROLES_KEY, Rol } from './roles.decorator';

export interface UsuarioToken { sub: string; nombre: string; rol: Rol }

/** Verifica el token JWT del personal y su rol (RNF-SEG-02). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwt: JwtService, private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const [tipo, token] = (req.headers.authorization ?? '').split(' ');
    if (tipo !== 'Bearer' || !token) throw new UnauthorizedException('Inicia sesión para continuar.');
    try {
      req.usuario = this.jwt.verify<UsuarioToken>(token);
    } catch {
      throw new UnauthorizedException('Tu sesión expiró. Vuelve a ingresar tu PIN.');
    }
    const roles = this.reflector.getAllAndOverride<Rol[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (roles?.length && req.usuario.rol !== 'ADMINISTRADOR' && !roles.includes(req.usuario.rol)) {
      throw new ForbiddenException('No tienes permisos para esta operación.');
    }
    return true;
  }
}
