import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportesService } from './reportes.service';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('reportes')
@UseGuards(AuthGuard)
@Roles('ADMINISTRADOR')
export class ReportesController {
  constructor(private reportes: ReportesService) {}

  @Get()
  generar(@Query('desde') desde?: string, @Query('hasta') hasta?: string) {
    return this.reportes.generar(desde, hasta);
  }
}
