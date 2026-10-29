import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { BitacoraService } from './bitacora.service';
import { ConfigService } from './config.service';

@Global()
@Module({
  providers: [PrismaService, BitacoraService, ConfigService],
  exports: [PrismaService, BitacoraService, ConfigService],
})
export class ComunModule {}
