import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { DespachoService, PedidoDespachoEntrada } from './despacho.service';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';

@Controller()
@UseGuards(AuthGuard)
export class DespachoController {
  constructor(private despacho: DespachoService) {}

  @Get('clientes/:celular')
  @Roles('CAJERO')
  cliente(@Param('celular') celular: string) {
    return this.despacho.cliente(celular);
  }

  @Get('repartidores')
  @Roles('CAJERO')
  repartidores() {
    return this.despacho.repartidores();
  }

  @Post('despacho/pedidos')
  @Roles('CAJERO')
  crear(@Body() body: PedidoDespachoEntrada, @Req() req) {
    return this.despacho.crear(body, req.usuario.sub);
  }

  @Get('despacho/tablero')
  @Roles('CAJERO')
  tablero() {
    return this.despacho.tablero();
  }

  @Post('despacho/:id/estado')
  @Roles('CAJERO', 'REPARTIDOR')
  estado(@Param('id') id: string, @Body() body: { estado: string; repartidorId?: string }, @Req() req) {
    return this.despacho.estado(id, body.estado, body.repartidorId, req.usuario);
  }

  @Post('despacho/:id/fallido')
  @Roles('CAJERO')
  fallido(@Param('id') id: string, @Body() body: { destino: 'REINGRESO' | 'CONSUMO' | 'MERMA'; pinAdmin: string }, @Req() req) {
    return this.despacho.resolverFallido(id, body.destino, body.pinAdmin, req.usuario.sub);
  }

  @Get('reparto/mis-pedidos')
  @Roles('REPARTIDOR')
  misPedidos(@Req() req) {
    return this.despacho.misPedidos(req.usuario.sub);
  }
}
