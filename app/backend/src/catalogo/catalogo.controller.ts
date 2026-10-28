import { Body, Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { CatalogoService } from './catalogo.service';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';

@Controller()
export class CatalogoController {
  constructor(private catalogo: CatalogoService) {}

  /** Pública: la usa la carta QR del comensal. */
  @Get('carta')
  carta() {
    return this.catalogo.carta();
  }

  @Patch('agotados/:tipo/:id')
  @UseGuards(AuthGuard)
  @Roles('CAJERO')
  agotado(@Param('tipo') tipo: 'producto' | 'opcion', @Param('id') id: string, @Body() body: { agotado: boolean }, @Req() req) {
    return this.catalogo.marcarAgotado(tipo === 'opcion' ? 'opcion' : 'producto', id, !!body.agotado, req.usuario.sub);
  }
}
