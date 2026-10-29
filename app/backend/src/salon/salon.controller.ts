import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { SalonService } from './salon.service';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';

@Controller()
export class SalonController {
  constructor(private salon: SalonService) {}

  @Get('mesas')
  @UseGuards(AuthGuard)
  mesas() {
    return this.salon.mesas();
  }

  @Post('mesas/:id/abrir')
  @UseGuards(AuthGuard)
  @Roles('MOZO', 'CAJERO')
  abrir(@Param('id') id: string) {
    return this.salon.abrir(id);
  }

  @Post('mesas/:id/liberar')
  @UseGuards(AuthGuard)
  @Roles('MOZO', 'CAJERO')
  liberar(@Param('id') id: string) {
    return this.salon.liberar(id);
  }

  @Post('mesas/:id/transferir')
  @UseGuards(AuthGuard)
  @Roles('MOZO', 'CAJERO')
  transferir(@Param('id') id: string, @Body() body: { destinoId: string }) {
    return this.salon.transferir(id, body.destinoId);
  }

  /** Une otra mesa ocupada a esta (cuenta maestra). */
  @Post('mesas/:id/unir')
  @UseGuards(AuthGuard)
  @Roles('MOZO', 'CAJERO')
  unir(@Param('id') id: string, @Body() body: { otraId: string }, @Req() req) {
    return this.salon.unir(id, body.otraId, req.usuario.sub);
  }

  @Post('mesas/:id/separar')
  @UseGuards(AuthGuard)
  @Roles('MOZO', 'CAJERO')
  separar(@Param('id') id: string, @Req() req) {
    return this.salon.separar(id, req.usuario.sub);
  }

  // Públicos: los usa el celular del comensal
  /** Números de las mesas activas, para imprimir sus códigos QR. */
  @Get('qr-mesas')
  numeros() {
    return this.salon.numeros();
  }

  @Get('qr/:numero')
  sesionQR(@Param('numero') numero: string) {
    return this.salon.sesionQR(numero);
  }

  @Post('qr/llamar')
  llamar(@Body() body: { token: string; motivo: 'MOZO' | 'CUENTA' }) {
    return this.salon.llamar(body.token, body.motivo === 'CUENTA' ? 'CUENTA' : 'MOZO');
  }
}
