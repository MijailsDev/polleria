import { Body, Controller, Get, Headers, Param, Post, Req } from '@nestjs/common';
import { PagosService } from './pagos.service';

/** Endpoints públicos: los usa el celular del comensal y la pasarela de pagos. */
@Controller()
export class PagosController {
  constructor(private pagos: PagosService) {}

  @Post('qr/pago/iniciar')
  iniciar(@Body() body: { token: string }) {
    return this.pagos.iniciar(body.token);
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
