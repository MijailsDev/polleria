import { Module } from '@nestjs/common';
import { PagosController } from './pagos.controller';
import { PagosService } from './pagos.service';
import { SalonModule } from '../salon/salon.module';
import { CajaModule } from '../caja/caja.module';

@Module({ imports: [SalonModule, CajaModule], controllers: [PagosController], providers: [PagosService] })
export class PagosModule {}
