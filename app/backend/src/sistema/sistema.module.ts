import { Module } from '@nestjs/common';
import { SistemaController } from './sistema.controller';
import { SistemaService } from './sistema.service';
import { CajaModule } from '../caja/caja.module';
import { PagosModule } from '../pagos/pagos.module';

@Module({ imports: [CajaModule, PagosModule], controllers: [SistemaController], providers: [SistemaService] })
export class SistemaModule {}
