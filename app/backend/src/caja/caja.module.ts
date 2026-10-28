import { Module } from '@nestjs/common';
import { CajaController } from './caja.controller';
import { CajaService } from './caja.service';
import { PedidosModule } from '../pedidos/pedidos.module';

@Module({ imports: [PedidosModule], controllers: [CajaController], providers: [CajaService] })
export class CajaModule {}
