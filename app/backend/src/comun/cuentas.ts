// Cálculo de totales de una cuenta a partir de sus pedidos, descuento y pagos.
// Se recalcula desde cero en cada cambio (pedido confirmado, anulación, descuento,
// cobro, fusión de mesas) para que el total nunca quede desfasado.
import { Prisma } from '@prisma/client';
import { aCentimos, aSoles } from './dinero';

type Tx = Prisma.TransactionClient;

/** Estados de pedido que ya forman parte de lo que se cobra. */
export const ESTADOS_COBRABLES = ['CONFIRMADO', 'EN_PREPARACION', 'SERVIDO', 'PROGRAMADO'];

export async function recalcularCuenta(tx: Tx, cuentaId: string) {
  const c = await tx.cuenta.findUniqueOrThrow({
    where: { id: cuentaId },
    include: {
      pedido: { where: { estado: { in: ESTADOS_COBRABLES } }, include: { item_pedido: { where: { estado: { not: 'ANULADO' } } } } },
      pago: true,
    },
  });
  const consumo = c.pedido.reduce((s, p) => s + p.item_pedido.reduce((t, i) => t + aCentimos(i.precio_unitario) * i.cantidad, 0), 0);
  const total = Math.max(0, consumo - aCentimos(c.descuento));
  const pagado = c.pago.reduce((s, p) => s + aCentimos(p.monto), 0);
  const saldo = Math.max(0, total - pagado);
  const estado = c.estado === 'ANULADA' ? 'ANULADA' : total > 0 && saldo === 0 ? 'PAGADA' : 'ABIERTA';
  await tx.cuenta.update({ where: { id: c.id }, data: { total: aSoles(total), saldo: aSoles(saldo), estado } });
  return { consumo, total, pagado, saldo, estado };
}

export const numeroComprobante = (serie: string, correlativo: number) => `${serie}-${String(correlativo).padStart(6, '0')}`;
