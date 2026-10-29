import { Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';

/** Valores por defecto si la tabla configuracion aún no tiene la clave (ver 05_ampliacion.sql). */
const POR_DEFECTO: Record<string, unknown> = {
  limite_egreso: 50,
  margen_arqueo: 1,
  anticipacion_programados: 15,
  umbral_presas: 2,
  minimo_pollos: 5,
  umbral_cola_cocina: 12,
  minutos_correccion: 2,
  sin_internet: false,
};

/** Parámetros del local que el administrador cambia sin programar (tabla configuracion). */
@Injectable()
export class ConfigService implements OnModuleInit {
  private valores = new Map<string, unknown>(Object.entries(POR_DEFECTO));

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    const filas = await this.prisma.configuracion.findMany();
    for (const f of filas) this.valores.set(f.clave, f.valor);
  }

  numero(clave: string) {
    return Number(this.valores.get(clave) ?? POR_DEFECTO[clave] ?? 0);
  }

  booleano(clave: string) {
    return this.valores.get(clave) === true;
  }

  async todas() {
    const filas = await this.prisma.configuracion.findMany({ orderBy: { clave: 'asc' } });
    return filas.map((f) => ({ clave: f.clave, valor: f.valor, descripcion: f.descripcion }));
  }

  async guardar(clave: string, valor: unknown) {
    const actual = this.valores.get(clave);
    if (actual === undefined) throw new Error(`Parámetro desconocido: ${clave}`);
    const v = typeof actual === 'boolean' ? valor === true || valor === 'true' : Number(valor);
    if (typeof v === 'number' && !(v >= 0)) throw new Error('El valor debe ser un número mayor o igual a cero.');
    await this.prisma.configuracion.upsert({
      where: { clave },
      update: { valor: v as Prisma.InputJsonValue, actualizado_en: new Date() },
      create: { clave, valor: v as Prisma.InputJsonValue },
    });
    this.valores.set(clave, v);
    return { antes: actual, despues: v };
  }
}
