import { Body, Controller, Get, Param, Patch, Query, Req, Res, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { CatalogoService } from './catalogo.service';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';

@Controller()
export class CatalogoController {
  constructor(private catalogo: CatalogoService) {}

  /** Pública: la usa la carta QR del comensal. */
  @Get('carta')
  carta(@Query('canal') canal?: string) {
    return this.catalogo.carta(['LLEVAR', 'DELIVERY', 'APP_EXTERNA'].includes(canal ?? '') ? canal : 'SALON');
  }

  @Get('carta/destacados')
  destacados() {
    return this.catalogo.destacados();
  }

  @Get('productos/:id/foto')
  @SkipThrottle()
  async foto(@Param('id') id: string, @Res() res: Response) {
    const f = await this.catalogo.foto(id);
    res.setHeader('Content-Type', f.tipo);
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.send(Buffer.from(f.contenido));
  }

  @Patch('agotados/:tipo/:id')
  @UseGuards(AuthGuard)
  @Roles('CAJERO')
  agotado(@Param('tipo') tipo: 'producto' | 'opcion', @Param('id') id: string, @Body() body: { agotado: boolean }, @Req() req) {
    return this.catalogo.marcarAgotado(tipo === 'opcion' ? 'opcion' : 'producto', id, !!body.agotado, req.usuario.sub);
  }
}
