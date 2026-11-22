import { Global, Module } from '@nestjs/common';
import { ImpresionService } from './impresion.service';
import { WhatsappService } from './whatsapp.service';
import { CorreoService } from './correo.service';
import { SincronizacionService } from './sincronizacion.service';
import { PerifericosController } from './perifericos.controller';

/** Ticketeras ESC/POS, WhatsApp, correo y sincronización con la nube (servicios de salida). */
@Global()
@Module({
  controllers: [PerifericosController],
  providers: [ImpresionService, WhatsappService, CorreoService, SincronizacionService],
  exports: [ImpresionService, WhatsappService, CorreoService, SincronizacionService],
})
export class PerifericosModule {}
