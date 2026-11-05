import { BadRequestException, Controller, ForbiddenException, Get, Headers, HttpCode, Param, Post, Query, RawBodyRequest, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthGuard, EquipoGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { Impresora, ImpresionService } from './impresion.service';
import { WhatsappService } from './whatsapp.service';
import { SincronizacionService } from './sincronizacion.service';

/** Los simuladores (impresora virtual y celular de WhatsApp) se apagan con SIMULADORES=false. */
const simuladores = () => process.env.SIMULADORES !== 'false';

@Controller()
export class PerifericosController {
  constructor(private impresion: ImpresionService, private whatsapp: WhatsappService, private sync: SincronizacionService) {}

  /** Rollo de papel de la impresora virtual (pantalla /impresoras). */
  @Get('impresoras/:impresora')
  @UseGuards(EquipoGuard)
  impresora(@Param('impresora') impresora: string, @Query('limite') limite?: string) {
    if (!simuladores()) throw new ForbiddenException('Simuladores desactivados.');
    const i = impresora.toUpperCase();
    if (i !== 'COCINA' && i !== 'CAJA') throw new BadRequestException('Impresora no válida.');
    return this.impresion.listar(i as Impresora, Number(limite) || 30);
  }

  @Post('impresiones/:id/reintentar')
  @UseGuards(AuthGuard)
  @Roles('CAJERO')
  reintentar(@Param('id') id: string) {
    return this.impresion.reintentar(id);
  }

  /** Celular simulado que recibe los mensajes de WhatsApp (pantalla /whatsapp). */
  @Get('whatsapp/chats')
  @UseGuards(EquipoGuard)
  chats() {
    if (!simuladores()) throw new ForbiddenException('Simuladores desactivados.');
    return this.whatsapp.chats();
  }

  /** Receptor del servidor en la nube: recibe los lotes firmados del local. */
  @Post('nube/eventos')
  @HttpCode(200)
  recibir(@Req() req: RawBodyRequest<Request>, @Headers('x-firma') firma?: string) {
    return this.sync.recibir(req.rawBody, firma);
  }

  @Get('nube/resumen')
  @UseGuards(AuthGuard)
  @Roles('ADMINISTRADOR')
  resumenNube() {
    return this.sync.resumenNube();
  }
}
