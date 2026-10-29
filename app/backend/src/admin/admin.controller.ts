import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('admin')
@UseGuards(AuthGuard)
@Roles('ADMINISTRADOR')
export class AdminController {
  constructor(private admin: AdminService) {}

  @Get('usuarios')
  usuarios() {
    return this.admin.usuarios();
  }

  @Post('usuarios')
  crearUsuario(@Body() b: { nombre: string; rol: string; pin: string; password?: string }, @Req() req) {
    return this.admin.crearUsuario(b, req.usuario.sub);
  }

  @Patch('usuarios/:id')
  editarUsuario(@Param('id') id: string, @Body() b: { nombre?: string; rol?: string; activo?: boolean; pin?: string; password?: string }, @Req() req) {
    return this.admin.editarUsuario(id, b, req.usuario.sub);
  }

  @Get('carta')
  carta() {
    return this.admin.carta();
  }

  @Post('categorias')
  crearCategoria(@Body() b: { nombre: string; orden?: number }, @Req() req) {
    return this.admin.guardarCategoria(null, b, req.usuario.sub);
  }

  @Patch('categorias/:id')
  editarCategoria(@Param('id') id: string, @Body() b: { nombre: string; orden?: number }, @Req() req) {
    return this.admin.guardarCategoria(id, b, req.usuario.sub);
  }

  @Post('productos')
  crearProducto(@Body() b: { nombre: string; precio: number; categoriaId: string; fraccionPollo?: number; destino?: string }, @Req() req) {
    return this.admin.crearProducto(b, req.usuario.sub);
  }

  @Patch('productos/:id')
  editarProducto(@Param('id') id: string, @Body() b: { nombre?: string; precio?: number; categoriaId?: string; fraccionPollo?: number; destino?: string; activo?: boolean }, @Req() req) {
    return this.admin.editarProducto(id, b, req.usuario.sub);
  }

  @Post('productos/:id/grupos')
  crearGrupo(@Param('id') id: string, @Body() b: { nombre: string; obligatorio: boolean; minimo: number; maximo: number }, @Req() req) {
    return this.admin.crearGrupo(id, b, req.usuario.sub);
  }

  @Post('grupos/:id/opciones')
  crearOpcion(@Param('id') id: string, @Body() b: { nombre: string; recargo?: number; pecho?: number; pierna?: number }, @Req() req) {
    return this.admin.crearOpcion(id, b, req.usuario.sub);
  }

  @Patch('opciones/:id')
  editarOpcion(@Param('id') id: string, @Body() b: { nombre?: string; recargo?: number }, @Req() req) {
    return this.admin.editarOpcion(id, b, req.usuario.sub);
  }

  @Get('mesas')
  mesas() {
    return this.admin.mesas();
  }

  @Post('mesas')
  crearMesa(@Body() b: { capacidad: number }, @Req() req) {
    return this.admin.crearMesa(b.capacidad, req.usuario.sub);
  }

  @Patch('mesas/:id')
  editarMesa(@Param('id') id: string, @Body() b: { capacidad?: number; activa?: boolean }, @Req() req) {
    return this.admin.editarMesa(id, b, req.usuario.sub);
  }

  @Get('config')
  config() {
    return this.admin.config_();
  }

  @Patch('config/:clave')
  guardarConfig(@Param('clave') clave: string, @Body() b: { valor: unknown }, @Req() req) {
    return this.admin.guardarConfig(clave, b.valor, req.usuario.sub);
  }

  @Get('bitacora')
  bitacora(@Query('limite') limite?: string, @Query('accion') accion?: string) {
    return this.admin.bitacora_(Number(limite) || 200, accion);
  }
}
