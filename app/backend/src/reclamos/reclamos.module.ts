import { Module } from '@nestjs/common';
import { ReclamosController } from './reclamos.controller';
import { ReclamosService } from './reclamos.service';

@Module({ controllers: [ReclamosController], providers: [ReclamosService] })
export class ReclamosModule {}
