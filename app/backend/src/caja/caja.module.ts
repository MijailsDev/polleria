import { Module } from '@nestjs/common';
import { CajaController } from './caja.controller';
import { CajaService } from './caja.service';
import { ComprobantesService } from './comprobantes.service';
import { PedidosModule } from '../pedidos/pedidos.module';
import { SalonModule } from '../salon/salon.module';

@Module({
  imports: [PedidosModule, SalonModule],
  controllers: [CajaController],
  providers: [CajaService, ComprobantesService],
  exports: [CajaService, ComprobantesService],
})
export class CajaModule {}
