import { Module } from '@nestjs/common';
import { ComunModule } from './comun/comun.module';
import { EventosModule } from './eventos/eventos.module';
import { AuthModule } from './auth/auth.module';
import { CatalogoModule } from './catalogo/catalogo.module';
import { SalonModule } from './salon/salon.module';
import { PedidosModule } from './pedidos/pedidos.module';
import { CajaModule } from './caja/caja.module';
import { DespachoModule } from './despacho/despacho.module';
import { InventarioModule } from './inventario/inventario.module';
import { PagosModule } from './pagos/pagos.module';
import { AdminModule } from './admin/admin.module';
import { ReportesModule } from './reportes/reportes.module';

@Module({
  imports: [
    ComunModule,
    EventosModule,
    AuthModule,
    CatalogoModule,
    SalonModule,
    PedidosModule,
    CajaModule,
    DespachoModule,
    InventarioModule,
    PagosModule,
    AdminModule,
    ReportesModule,
  ],
})
export class AppModule {}
