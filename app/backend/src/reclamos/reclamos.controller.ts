import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ReclamoEntrada, ReclamosService } from './reclamos.service';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('reclamos')
export class ReclamosController {
  constructor(private reclamos: ReclamosService) {}

  /** Datos del proveedor que encabezan la hoja de reclamación. */
  @Get('proveedor')
  proveedor() {
    return this.reclamos.proveedor();
  }

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  registrar(@Body() body: ReclamoEntrada) {
    return this.reclamos.registrar(body);
  }

  @Get('consulta')
  consultar(@Query('codigo') codigo: string, @Query('documento') documento: string) {
    return this.reclamos.consultar(codigo, documento);
  }

  @Get()
  @UseGuards(AuthGuard)
  @Roles('ADMINISTRADOR')
  listar() {
    return this.reclamos.listar();
  }

  @Post(':id/responder')
  @UseGuards(AuthGuard)
  @Roles('ADMINISTRADOR')
  responder(@Param('id') id: string, @Body() body: { respuesta: string }, @Req() req) {
    return this.reclamos.responder(id, body.respuesta, req.usuario.sub);
  }
}
