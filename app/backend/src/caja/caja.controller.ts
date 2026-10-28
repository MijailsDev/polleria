import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { CajaService, ComprobanteEntrada, PagoEntrada } from './caja.service';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';

@Controller()
@UseGuards(AuthGuard)
export class CajaController {
  constructor(private caja: CajaService) {}

  @Get('turnos/actual')
  @Roles('CAJERO')
  turno(@Req() req) {
    return this.caja.turnoActual(req.usuario.sub);
  }

  @Post('turnos/abrir')
  @Roles('CAJERO')
  abrir(@Body() body: { fondoInicial: number }, @Req() req) {
    return this.caja.abrirTurno(req.usuario.sub, body.fondoInicial);
  }

  @Post('turnos/movimiento')
  @Roles('CAJERO')
  movimiento(@Body() b: { tipo: 'INGRESO' | 'EGRESO'; monto: number; motivo: string; pinAdmin?: string }, @Req() req) {
    return this.caja.movimiento(req.usuario.sub, b.tipo === 'INGRESO' ? 'INGRESO' : 'EGRESO', b.monto, b.motivo, b.pinAdmin);
  }

  @Post('turnos/cerrar')
  @Roles('CAJERO')
  cerrar(@Body() body: { efectivoDeclarado: number; comentario?: string }, @Req() req) {
    return this.caja.cerrarTurno(req.usuario.sub, body.efectivoDeclarado, body.comentario);
  }

  /** Reporte X: corte parcial sin cerrar el turno (solo administrador). */
  @Get('turnos/reporte-x')
  @Roles('ADMINISTRADOR')
  reporteX(@Req() req) {
    return this.caja.reporteX(req.usuario.sub);
  }

  @Get('cuentas/mesa/:mesaId')
  @Roles('MOZO', 'CAJERO')
  cuentaMesa(@Param('mesaId') mesaId: string) {
    return this.caja.cuentaDeMesa(mesaId);
  }

  @Post('cuentas/:id/cobrar')
  @Roles('CAJERO')
  cobrar(@Param('id') id: string, @Body() body: { pagos: PagoEntrada[]; comprobante: ComprobanteEntrada }, @Req() req) {
    return this.caja.cobrar(id, body.pagos, body.comprobante, req.usuario.sub);
  }

  @Get('documentos/:numero')
  @Roles('CAJERO')
  documento(@Param('numero') numero: string) {
    return this.caja.consultarDocumento(numero);
  }

  @Get('comprobantes/:id')
  @Roles('CAJERO')
  comprobante(@Param('id') id: string) {
    return this.caja.comprobante(id);
  }
}
