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

  /** Pantalla de cocina (simula la ticketera del pollero): solo lectura. */
  @Get('cocina')
  cocina() {
    return this.pedidos.cocina();
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
