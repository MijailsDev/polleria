import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ItemEntrada, PedidosService } from './pedidos.service';
import { AuthGuard } from '../auth/auth.guard';
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
  cocina() {
    return this.pedidos.cocina();
  }

  /** El pollero marca la comanda como lista (pantalla de cocina, sin sesión como la ticketera). */
  @Post('cocina/:id/listo')
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

  @Get('qr-cuenta')
  cuentaQR(@Query('token') token: string) {
    return this.pedidos.cuentaQR(token);
  }
}
