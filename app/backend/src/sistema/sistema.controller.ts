import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { SistemaService } from './sistema.service';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';

@Controller()
export class SistemaController {
  constructor(private sistema: SistemaService) {}

  /** 200 si la API y la base responden; 503 si la base de datos no responde. */
  @Get('salud')
  @SkipThrottle()
  async salud(@Res() res: Response) {
    const s = await this.sistema.salud();
    res.status(s.ok ? 200 : 503).json(s);
  }

  @Get('admin/sistema')
  @UseGuards(AuthGuard)
  @Roles('ADMINISTRADOR')
  detalle() {
    return this.sistema.detalle();
  }
}
