import { Global, Module } from '@nestjs/common';
import { ImpresionService } from './impresion.service';
import { WhatsappService } from './whatsapp.service';
import { SincronizacionService } from './sincronizacion.service';
import { PerifericosController } from './perifericos.controller';

/** Ticketeras ESC/POS, WhatsApp y sincronización con la nube (servicios de salida). */
@Global()
@Module({
  controllers: [PerifericosController],
  providers: [ImpresionService, WhatsappService, SincronizacionService],
  exports: [ImpresionService, WhatsappService, SincronizacionService],
})
export class PerifericosModule {}
