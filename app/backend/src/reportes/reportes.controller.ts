import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ReportesService } from './reportes.service';
import { reporteExcel } from './excel';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { ConfigService } from '../comun/config.service';

@Controller('reportes')
@UseGuards(AuthGuard)
@Roles('ADMINISTRADOR')
export class ReportesController {
  constructor(private reportes: ReportesService, private config: ConfigService) {}

  @Get()
  generar(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.reportes.generar(desde, hasta);
  }

  /** El mismo reporte en un libro de Excel con una hoja por sección. */
  @Get('excel')
  async excel(@Res() res: Response, @Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    const r = await this.reportes.generar(desde, hasta);
    const archivo = await reporteExcel(r, this.config.texto('razon_social'));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="reporte_${r.desde}${r.hasta !== r.desde ? '_' + r.hasta : ''}.xlsx"`);
    res.send(archivo);
  }
}
