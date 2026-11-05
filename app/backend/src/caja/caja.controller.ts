import { Body, Controller, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { CajaService, ComprobanteEntrada, PagoEntrada } from './caja.service';
import { ComprobantesService } from './comprobantes.service';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';

@Controller()
export class CajaController {
  constructor(private caja: CajaService, private comprobantes: ComprobantesService) {}

  // ---------------------------------------------------------------- Públicos

  /** Estado de la conexión con SUNAT y la pasarela (indicador En línea / Modo local, REQ-CON-02). */
  @Get('estado')
  estado() {
    return this.comprobantes.estado();
  }

  /** Comprobante para el cliente: se abre con el QR de descarga o el enlace de WhatsApp (REQ-FAC-06). */
  @Get('publico/comprobantes/:id')
  comprobantePublico(@Param('id') id: string) {
    return this.comprobantes.ver(id);
  }

  /** XML UBL 2.1 del comprobante, para descargar desde la representación impresa. */
  @Get('publico/comprobantes/:id/xml')
  async xmlPublico(@Param('id') id: string, @Res() res: Response) {
    const { nombre, xml } = await this.comprobantes.xml(id);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
    res.send(xml);
  }

  // ---------------------------------------------------------------- Turnos

  @Get('turnos/actual')
  @UseGuards(AuthGuard)
  @Roles('CAJERO')
  turno(@Req() req) {
    return this.caja.turnoActual(req.usuario.sub);
  }

  @Post('turnos/abrir')
  @UseGuards(AuthGuard)
  @Roles('CAJERO')
  abrir(@Body() body: { fondoInicial: number }, @Req() req) {
    return this.caja.abrirTurno(req.usuario.sub, body.fondoInicial);
  }

  @Post('turnos/movimiento')
  @UseGuards(AuthGuard)
  @Roles('CAJERO')
  movimiento(@Body() b: { tipo: 'INGRESO' | 'EGRESO'; monto: number; motivo: string; pinAdmin?: string }, @Req() req) {
    return this.caja.movimiento(req.usuario.sub, b.tipo === 'INGRESO' ? 'INGRESO' : 'EGRESO', b.monto, b.motivo, b.pinAdmin);
  }

  @Post('turnos/cerrar')
  @UseGuards(AuthGuard)
  @Roles('CAJERO')
  cerrar(@Body() body: { efectivoDeclarado: number; comentario?: string }, @Req() req) {
    return this.caja.cerrarTurno(req.usuario.sub, body.efectivoDeclarado, body.comentario);
  }

  /** Reporte X: corte parcial sin cerrar el turno (solo administrador). */
  @Get('turnos/reporte-x')
  @UseGuards(AuthGuard)
  @Roles('ADMINISTRADOR')
  reporteX() {
    return this.caja.reporteX();
  }

  @Get('turnos')
  @UseGuards(AuthGuard)
  @Roles('ADMINISTRADOR')
  turnos() {
    return this.caja.turnos();
  }

  @Get('turnos/:id/reporte')
  @UseGuards(AuthGuard)
  @Roles('ADMINISTRADOR')
  reporteTurno(@Param('id') id: string) {
    return this.caja.reporteZ(id);
  }

  @Post('turnos/:id/reabrir')
  @UseGuards(AuthGuard)
  @Roles('ADMINISTRADOR')
  reabrir(@Param('id') id: string, @Body() body: { pinAdmin: string }, @Req() req) {
    return this.caja.reabrirTurno(id, body.pinAdmin, req.usuario.sub);
  }

  @Post('gaveta/abrir')
  @UseGuards(AuthGuard)
  @Roles('CAJERO')
  gaveta(@Body() body: { motivo: string; pinAdmin: string }, @Req() req) {
    return this.caja.abrirGaveta(req.usuario.sub, body.motivo, body.pinAdmin);
  }

  // ---------------------------------------------------------------- Cuentas y cobro

  @Get('cuentas/mesa/:mesaId')
  @UseGuards(AuthGuard)
  @Roles('MOZO', 'CAJERO')
  cuentaMesa(@Param('mesaId') mesaId: string) {
    return this.caja.cuentaDeMesa(mesaId);
  }

  @Get('cuentas/sin-mesa')
  @UseGuards(AuthGuard)
  @Roles('CAJERO')
  sinMesa() {
    return this.caja.cuentasSinMesa();
  }

  @Get('cuentas/:id')
  @UseGuards(AuthGuard)
  @Roles('MOZO', 'CAJERO')
  cuenta(@Param('id') id: string) {
    return this.caja.cuenta(id);
  }

  @Post('cuentas/:id/cobrar')
  @UseGuards(AuthGuard)
  @Roles('CAJERO')
  cobrar(@Param('id') id: string, @Body() body: { pagos: PagoEntrada[]; comprobante: ComprobanteEntrada }, @Req() req) {
    return this.caja.cobrar(id, body.pagos, body.comprobante, req.usuario.sub);
  }

  @Post('cuentas/:id/descuento')
  @UseGuards(AuthGuard)
  @Roles('CAJERO')
  descuento(@Param('id') id: string, @Body() body: { monto?: number; porcentaje?: number; motivo: string; pinAdmin: string }, @Req() req) {
    return this.caja.descuento(id, body, req.usuario.sub);
  }

  @Post('cuentas/:id/fuga')
  @UseGuards(AuthGuard)
  @Roles('MOZO', 'CAJERO')
  fuga(@Param('id') id: string, @Body() body: { motivo: string; pinAdmin: string }, @Req() req) {
    return this.caja.fuga(id, body.motivo, body.pinAdmin, req.usuario.sub);
  }

  @Post('cuentas/:id/bolsas')
  @UseGuards(AuthGuard)
  @Roles('CAJERO')
  bolsas(@Param('id') id: string, @Body() body: { cantidad: number }, @Req() req) {
    return this.caja.bolsas(id, body.cantidad, req.usuario.sub);
  }

  @Get('documentos/:numero')
  @UseGuards(AuthGuard)
  @Roles('CAJERO')
  documento(@Param('numero') numero: string) {
    return this.caja.consultarDocumento(numero);
  }

  @Get('comprobantes/:id')
  @UseGuards(AuthGuard)
  @Roles('CAJERO')
  comprobante(@Param('id') id: string) {
    return this.comprobantes.ver(id);
  }

  @Post('comprobantes/:id/nota-credito')
  @UseGuards(AuthGuard)
  @Roles('CAJERO')
  notaCredito(@Param('id') id: string, @Body() body: { motivo: string; pinAdmin: string; devolverEfectivo?: boolean }, @Req() req) {
    return this.comprobantes.notaCredito(id, body.motivo, body.pinAdmin, !!body.devolverEfectivo, req.usuario.sub);
  }

  @Post('comprobantes/:id/imprimir')
  @UseGuards(AuthGuard)
  @Roles('CAJERO')
  imprimir(@Param('id') id: string) {
    return this.comprobantes.imprimir(id);
  }

  @Post('comprobantes/:id/whatsapp')
  @UseGuards(AuthGuard)
  @Roles('CAJERO')
  whatsapp(@Param('id') id: string, @Body() body: { celular: string; enlace: string }) {
    return this.caja.whatsappComprobante(id, body.celular, body.enlace);
  }

  // ---------------------------------------------------------------- SUNAT (administrador)

  @Get('sunat/observados')
  @UseGuards(AuthGuard)
  @Roles('ADMINISTRADOR')
  observados() {
    return this.comprobantes.observados();
  }

  @Post('sunat/reenviar')
  @UseGuards(AuthGuard)
  @Roles('ADMINISTRADOR')
  reenviar() {
    return this.comprobantes.procesarCola().then((enviados) => ({ enviados }));
  }

  @Get('sunat/resumenes')
  @UseGuards(AuthGuard)
  @Roles('ADMINISTRADOR')
  resumenes() {
    return this.comprobantes.resumenes();
  }

  @Post('sunat/resumen-diario')
  @UseGuards(AuthGuard)
  @Roles('ADMINISTRADOR')
  resumenDiario(@Query('fecha') fecha: string | undefined, @Req() req) {
    return this.comprobantes.resumenDiario(fecha, req.usuario.sub);
  }

  // ---------------------------------------------------------------- Repartidores

  @Get('repartidores/por-liquidar')
  @UseGuards(AuthGuard)
  @Roles('CAJERO')
  porLiquidar() {
    return this.caja.porLiquidar();
  }

  @Post('repartidores/:id/liquidar')
  @UseGuards(AuthGuard)
  @Roles('CAJERO')
  liquidar(@Param('id') id: string, @Body() body: { rendido: number }, @Req() req) {
    return this.caja.liquidar(id, Number(body.rendido), req.usuario.sub);
  }
}
