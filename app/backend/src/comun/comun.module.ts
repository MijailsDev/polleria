import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { BitacoraService } from './bitacora.service';

@Global()
@Module({
  providers: [PrismaService, BitacoraService],
  exports: [PrismaService, BitacoraService],
})
export class ComunModule {}
