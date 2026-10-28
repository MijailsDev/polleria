import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

/** Registra acciones sensibles en la bitácora (RNF-SEG-05). */
@Injectable()
export class BitacoraService {
  constructor(private prisma: PrismaService) {}

  registrar(
    accion: string,
    entidad: string,
    entidadId: string | null,
    usuarioId: string | null,
    despues?: unknown,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    return tx.bitacora.create({
      data: {
        accion,
        entidad,
        entidad_id: entidadId,
        usuario_id: usuarioId,
        valores_despues: despues === undefined ? undefined : (JSON.parse(JSON.stringify(despues)) as Prisma.InputJsonValue),
      },
    });
  }
}
