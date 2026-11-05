import { Body, Controller, Get, Headers, Param, Post, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { OpcionesPago, PagosService } from './pagos.service';
import { ComprobantesService } from '../caja/comprobantes.service';
import { SalonService } from '../salon/salon.service';

/** Endpoints públicos: los usa el celular del comensal y la pasarela de pagos. */
@Controller()
export class PagosController {
  constructor(private pagos: PagosService, private comprobantes: ComprobantesService, private salon: SalonService) {}

  @Post('qr/pago/iniciar')
  iniciar(@Body() body: OpcionesPago) {
    return this.pagos.iniciar(body);
  }

  /** El comensal busca su nombre con su DNI o RUC para el comprobante (solo con el token de su mesa). */
  @Get('qr/documentos/:numero')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async documento(@Param('numero') numero: string, @Query('token') token: string) {
    await this.salon.validarToken(token);
    return this.comprobantes.consultarDocumento(numero);
  }

  @Get('pasarela/:id')
  intento(@Param('id') id: string) {
    return this.pagos.intento(id);
  }

  @Post('pasarela/:id/pagar')
  pagar(@Param('id') id: string, @Body() body: { medio: 'YAPE' | 'PLIN' | 'TARJETA'; celular?: string; aprobacion?: string; tarjeta?: string; vence?: string; cvv?: string }) {
    return this.pagos.procesar(id, body);
  }

  @Post('pasarela/:id/cancelar')
  cancelar(@Param('id') id: string) {
    return this.pagos.cancelar(id);
  }

  /** Webhook de la pasarela (firma HMAC-SHA256 en la cabecera x-firma). */
  @Post('webhooks/pasarela')
  webhook(@Req() req: { rawBody?: Buffer; body: unknown }, @Headers('x-firma') firma: string) {
    return this.pagos.webhook(req.rawBody?.toString('utf8') ?? JSON.stringify(req.body), firma);
  }
}
