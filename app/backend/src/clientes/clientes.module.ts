import { Global, Module } from '@nestjs/common';
import { ClientesController } from './clientes.controller';
import { ClientesService } from './clientes.service';

/** Programa de clientes frecuentes; lo usan la carta, los pedidos QR, los pagos y la caja. */
@Global()
@Module({ controllers: [ClientesController], providers: [ClientesService], exports: [ClientesService] })
export class ClientesModule {}
