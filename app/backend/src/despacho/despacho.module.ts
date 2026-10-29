import { Module } from '@nestjs/common';
import { DespachoController } from './despacho.controller';
import { DespachoService } from './despacho.service';
import { PedidosModule } from '../pedidos/pedidos.module';

@Module({ imports: [PedidosModule], controllers: [DespachoController], providers: [DespachoService] })
export class DespachoModule {}
