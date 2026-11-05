import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { Roles } from './roles.decorator';
import { EquiposService } from './equipos.service';
import { AlertasSeguridadService } from './alertas-seguridad.service';

@Controller()
export class AuthController {
  constructor(private auth: AuthService, private equipos: EquiposService, private alertas: AlertasSeguridadService) {}

  // ---------------------------------------------------------------- Ingreso

  /** Lista de nombres para elegir en la pantalla de ingreso (solo equipos vinculados, si se exige). */
  @Get('auth/usuarios')
  async usuarios(@Req() req) {
    return this.auth.usuariosActivos(await this.equipos.porLlave(req.headers['x-equipo'], req.ip), req.ip);
  }

  /** Máximo 10 intentos por minuto desde la misma IP, además del bloqueo de 5 min por usuario. */
  @Post('auth/login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(@Req() req, @Body() body: { usuarioId: string; pin: string; password?: string; codigo?: string }) {
    const equipo = await this.equipos.porLlave(req.headers['x-equipo'], req.ip);
    return this.auth.login(body.usuarioId, body.pin, body.password, body.codigo, equipo, req.ip);
  }

  /** Ingreso del dueño desde un equipo no vinculado: nombre, contraseña, PIN y código de su app. */
  @Post('auth/login-admin')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async loginAdmin(@Req() req, @Body() body: { nombre: string; password: string; pin: string; codigo?: string }) {
    const equipo = await this.equipos.porLlave(req.headers['x-equipo'], req.ip);
    return this.auth.loginAdmin(body.nombre, body.password, body.pin, body.codigo, equipo, req.ip);
  }

  // ---------------------------------------------------------------- Equipos vinculados

  /** Qué equipo es este navegador y si el local exige equipos vinculados. */
  @Get('equipos/actual')
  async equipoActual(@Req() req) {
    return { equipo: await this.equipos.porLlave(req.headers['x-equipo'], req.ip), exige: this.equipos.obligatorio() };
  }

  /** El equipo nuevo escribe el código que le dio el administrador. 5 intentos por minuto. */
  @Post('equipos/vincular')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  vincular(@Req() req, @Body() body: { codigo: string }) {
    return this.equipos.vincular(body.codigo, req.ip);
  }

  @Get('admin/equipos')
  @UseGuards(AuthGuard)
  @Roles('ADMINISTRADOR')
  async listar() {
    return { equipos: await this.equipos.listar(), exige: this.equipos.obligatorio(), intentos: this.alertas.resumen() };
  }

  @Post('admin/equipos')
  @UseGuards(AuthGuard)
  @Roles('ADMINISTRADOR')
  crear(@Req() req, @Body() body: { nombre: string; tipo: string }) {
    return this.equipos.crear(body.nombre, body.tipo, req.usuario.sub);
  }

  @Post('admin/equipos/:id/codigo')
  @UseGuards(AuthGuard)
  @Roles('ADMINISTRADOR')
  codigo(@Req() req, @Param('id') id: string) {
    return this.equipos.regenerarCodigo(id, req.usuario.sub);
  }

  @Post('admin/equipos/:id/desvincular')
  @UseGuards(AuthGuard)
  @Roles('ADMINISTRADOR')
  desvincular(@Req() req, @Param('id') id: string) {
    return this.equipos.desvincular(id, req.usuario.sub);
  }

  // ---------------------------------------------------------------- Verificación en dos pasos

  @Get('admin/2fa')
  @UseGuards(AuthGuard)
  @Roles('ADMINISTRADOR')
  estado2fa(@Req() req) {
    return this.auth.estado2fa(req.usuario.sub);
  }

  @Post('admin/2fa/iniciar')
  @UseGuards(AuthGuard)
  @Roles('ADMINISTRADOR')
  iniciar2fa(@Req() req) {
    return this.auth.iniciar2fa(req.usuario.sub);
  }

  @Post('admin/2fa/activar')
  @UseGuards(AuthGuard)
  @Roles('ADMINISTRADOR')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  activar2fa(@Req() req, @Body() body: { codigo: string }) {
    return this.auth.activar2fa(req.usuario.sub, body.codigo);
  }

  @Post('admin/2fa/desactivar')
  @UseGuards(AuthGuard)
  @Roles('ADMINISTRADOR')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  desactivar2fa(@Req() req, @Body() body: { codigo: string }) {
    return this.auth.desactivar2fa(req.usuario.sub, body.codigo);
  }
}
