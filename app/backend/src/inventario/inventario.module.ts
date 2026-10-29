import { Module } from '@nestjs/common';
import { InventarioController } from './inventario.controller';
import { InventarioService } from './inventario.service';
import { PedidosModule } from '../pedidos/pedidos.module';

@Module({ imports: [PedidosModule], controllers: [InventarioController], providers: [InventarioService] })
export class InventarioModule {}
