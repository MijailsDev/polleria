import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ItemEntrada, PedidosService } from './pedidos.service';
import { AuthGuard, EquipoGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';

@Controller()
export class PedidosController {
  constructor(private pedidos: PedidosService) {}

  @Post('pedidos')
  @UseGuards(AuthGuard)
  @Roles('MOZO', 'CAJERO')
  crear(@Body() body: { mesaId: string; items: ItemEntrada[]; clave?: string }, @Req() req) {
    return this.pedidos.crearDesdePersonal(body.mesaId, body.items, req.usuario.sub, body.clave);
  }

  /** Bebidas que la caja debe entregar (no pasan por el pollero). */
  @Get('bebidas')
  @UseGuards(AuthGuard)
  @Roles('CAJERO')
  bebidas() {
    return this.pedidos.bebidas();
  }

  @Post('bebidas/:pedidoId/entregar')
  @UseGuards(AuthGuard)
  @Roles('CAJERO')
  entregarBebidas(@Param('pedidoId') pedidoId: string, @Req() req) {
    return this.pedidos.entregarBebidas(pedidoId, req.usuario.sub);
  }

  @Get('pedidos/por-confirmar')
  @UseGuards(AuthGuard)
  porConfirmar() {
    return this.pedidos.porConfirmar();
  }

  @Post('pedidos/:id/confirmar')
  @UseGuards(AuthGuard)
  @Roles('MOZO', 'CAJERO')
  confirmar(@Param('id') id: string, @Req() req) {
    return this.pedidos.confirmar(id, req.usuario.sub);
  }

  @Post('pedidos/:id/rechazar')
  @UseGuards(AuthGuard)
  @Roles('MOZO', 'CAJERO')
  rechazar(@Param('id') id: string, @Req() req) {
    return this.pedidos.rechazar(id, req.usuario.sub);
  }

  @Post('pedidos/:id/servido')
  @UseGuards(AuthGuard)
  @Roles('MOZO', 'CAJERO')
  servido(@Param('id') id: string) {
    return this.pedidos.servido(id);
  }

  @Post('pedidos/:id/reimprimir')
  @UseGuards(AuthGuard)
  @Roles('MOZO', 'CAJERO')
  reimprimir(@Param('id') id: string, @Req() req) {
    return this.pedidos.reimprimir(id, req.usuario.sub);
  }

  /** Anulación de un ítem ya comandado: requiere PIN del administrador (RN-04). */
  @Post('items/:id/anular')
  @UseGuards(AuthGuard)
  @Roles('MOZO', 'CAJERO')
  anular(@Param('id') id: string, @Body() body: { motivo: string; pinAdmin: string }, @Req() req) {
    return this.pedidos.anularItem(id, body.motivo, body.pinAdmin, req.usuario.sub);
  }

  /** Reposición por reclamo, sin costo para el cliente (REQ-INV-05). */
  @Post('items/:id/reponer')
  @UseGuards(AuthGuard)
  @Roles('MOZO', 'CAJERO')
  reponer(@Param('id') id: string, @Body() body: { motivo: string; pinAdmin: string }, @Req() req) {
    return this.pedidos.reponer(id, body.motivo, body.pinAdmin, req.usuario.sub);
  }

  /** Pantalla de cocina (simula la ticketera del pollero): solo lectura. */
  @Get('cocina')
  @UseGuards(EquipoGuard)
  cocina() {
    return this.pedidos.cocina();
  }

  /** El pollero marca la comanda como lista (pantalla de cocina, sin PIN como la ticketera; con equipos exigidos, solo desde un equipo vinculado). */
  @Post('cocina/:id/listo')
  @UseGuards(EquipoGuard)
  listo(@Param('id') id: string) {
    return this.pedidos.servido(id);
  }

  @Get('cocina/carga')
  carga() {
    return this.pedidos.carga();
  }

  // Públicos: celular del comensal
  @Post('qr/pedidos')
  crearQR(@Body() body: { token: string; items: ItemEntrada[]; clave?: string }) {
    return this.pedidos.crearDesdeQR(body.token, body.items, body.clave);
  }

  @Post('qr/pedidos/:id/cancelar')
  cancelarQR(@Param('id') id: string, @Body() body: { token: string }) {
    return this.pedidos.cancelarDesdeQR(body.token, id);
  }

  @Post('qr/calificar')
  calificar(@Body() body: { token: string; estrellas: number; comentario?: string }) {
    return this.pedidos.calificar(body.token, body.estrellas, body.comentario);
  }

  @Get('qr-cuenta')
  cuentaQR(@Query('token') token: string) {
    return this.pedidos.cuentaQR(token);
  }
}
