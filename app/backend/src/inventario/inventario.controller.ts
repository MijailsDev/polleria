import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { InventarioService } from './inventario.service';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('inventario')
@UseGuards(AuthGuard)
@Roles('CAJERO')
export class InventarioController {
  constructor(private inventario: InventarioService) {}

  @Get()
  resumen() {
    return this.inventario.resumen();
  }

  @Post('ingreso')
  ingreso(@Body() body: { pollos: number; motivo?: string }, @Req() req) {
    return this.inventario.ingreso(body.pollos, body.motivo, req.usuario.sub);
  }

  @Post('merma')
  merma(@Body() body: { pollos?: number; pecho?: number; pierna?: number; productoId?: string; motivo: string; detalle?: string; pinAdmin: string }, @Req() req) {
    return this.inventario.merma(body, req.usuario.sub);
  }

  @Post('conteo')
  conteo(@Body() body: { pollos: number; pecho: number; pierna: number; comentario?: string; pinAdmin: string }, @Req() req) {
    return this.inventario.conteo(body, req.usuario.sub);
  }
}
