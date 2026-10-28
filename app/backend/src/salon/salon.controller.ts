import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
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

  // Públicos: los usa el celular del comensal
  @Get('qr/:numero')
  sesionQR(@Param('numero') numero: string) {
    return this.salon.sesionQR(numero);
  }

  @Post('qr/llamar')
  llamar(@Body() body: { token: string; motivo: 'MOZO' | 'CUENTA' }) {
    return this.salon.llamar(body.token, body.motivo === 'CUENTA' ? 'CUENTA' : 'MOZO');
  }
}
