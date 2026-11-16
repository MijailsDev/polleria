import { Module } from '@nestjs/common';
import { DespachoController } from './despacho.controller';
import { DespachoService } from './despacho.service';
import { PedidosModule } from '../pedidos/pedidos.module';
import { CajaModule } from '../caja/caja.module';

@Module({ imports: [PedidosModule, CajaModule], controllers: [DespachoController], providers: [DespachoService] })
export class DespachoModule {}
