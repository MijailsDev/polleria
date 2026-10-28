// Utilidades para montos: todo se calcula en céntimos enteros para no perder precisión.
import { Prisma } from '@prisma/client';

export const aCentimos = (v: Prisma.Decimal | number | string | null | undefined) =>
  Math.round(Number(v ?? 0) * 100);
export const aSoles = (c: number) => Math.round(c) / 100;

/** Separa un total con impuestos incluidos en base imponible e impuesto. */
export function desglosarImpuesto(totalCentimos: number, tasa: number) {
  const base = Math.round(totalCentimos / (1 + tasa));
  return { base, impuesto: totalCentimos - base };
}
