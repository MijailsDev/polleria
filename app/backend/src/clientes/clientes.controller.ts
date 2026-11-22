import { Body, Controller, Get, Headers, Patch, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ClientesService } from './clientes.service';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';

/** Programa de clientes frecuentes: el comensal se identifica desde la carta QR (sin contraseña). */
@Controller()
export class ClientesController {
  constructor(private clientes: ClientesService) {}

  /** Envía un código de 6 dígitos al celular (WhatsApp) o al correo. */
  @Post('frecuentes/codigo')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  codigo(@Body() b: { contacto: string }) {
    return this.clientes.pedirCodigo(b.contacto);
  }

  @Post('frecuentes/verificar')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verificar(@Body() b: { contacto: string; codigo: string; nombre?: string; aceptaPromociones?: boolean }) {
    return this.clientes.verificar(b);
  }

  /** Estado del cliente identificado (compras, meta y si ya es frecuente). Cabecera X-Cliente. */
  @Get('frecuentes/yo')
  yo(@Headers('x-cliente') token?: string) {
    return this.clientes.estado(this.id(token));
  }

  /** Dar o retirar el permiso para recibir promociones. */
  @Patch('frecuentes/yo/promociones')
  promociones(@Headers('x-cliente') token: string | undefined, @Body() b: { acepta: boolean }) {
    return this.clientes.promociones(this.id(token), !!b.acepta);
  }

  @Get('admin/clientes-frecuentes')
  @UseGuards(AuthGuard)
  @Roles('ADMINISTRADOR')
  resumen() {
    return this.clientes.resumen();
  }

  private id(token?: string) {
    const id = this.clientes.idDeToken(token);
    if (!id) throw new UnauthorizedException('Vuelve a identificarte con tu celular o correo.');
    return id;
  }
}
