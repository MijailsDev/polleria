import { Module } from '@nestjs/common';
import { ComunModule } from './comun/comun.module';
import { EventosModule } from './eventos/eventos.module';
import { AuthModule } from './auth/auth.module';
import { CatalogoModule } from './catalogo/catalogo.module';
import { SalonModule } from './salon/salon.module';
import { PedidosModule } from './pedidos/pedidos.module';
import { CajaModule } from './caja/caja.module';

@Module({
  imports: [ComunModule, EventosModule, AuthModule, CatalogoModule, SalonModule, PedidosModule, CajaModule],
})
export class AppModule {}
