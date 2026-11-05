import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
import { PerifericosModule } from './perifericos/perifericos.module';
import { ReclamosModule } from './reclamos/reclamos.module';
import { SistemaModule } from './sistema/sistema.module';

@Module({
  imports: [
    // Límite general por IP: 600 solicitudes por minuto (una tablet activa usa ~60)
    // En desarrollo no se limita a la propia laptop (pruebas automáticas y de carga)
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: Number(process.env.LIMITE_SOLICITUDES ?? 600) }],
      skipIf: (ctx) => process.env.NODE_ENV !== 'production' && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ctx.switchToHttp().getRequest().ip),
    }),
    ComunModule,
    PerifericosModule,
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
    ReclamosModule,
    SistemaModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
