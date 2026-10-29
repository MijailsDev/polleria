'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { CuentaDetalle, ItemComanda } from '@/lib/tipos';
import { hora, soles } from '@/lib/util';
import { PedirPin } from './PedirPin';

const MOTIVOS_ANULAR = ['Cliente cambió de opinión', 'Error al tomar el pedido', 'Demora excesiva'];
const MOTIVOS_REPONER = ['Pollo frío', 'Presa equivocada', 'Producto en mal estado'];

/**
 * Rondas de una cuenta con sus acciones: servido, reimprimir comanda (REQ-COC-06),
 * anular ítem y reposición por reclamo con PIN del administrador (REQ-MOZ-05, REQ-INV-05).
 */
export function DetalleCuenta({
  cuenta,
  alCambio,
  alAviso,
  compacto = false,
}: {
  cuenta: CuentaDetalle;
  alCambio: () => void;
  alAviso: (a: { texto: string; tipo?: 'error' | 'ok' }) => void;
  compacto?: boolean;
}) {
  const [accion, setAccion] = useState<{ tipo: 'anular' | 'reponer'; item: ItemComanda } | null>(null);
  const editable = cuenta.estado !== 'ANULADA';

  async function ejecutar(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      alAviso({ texto: ok, tipo: 'ok' });
      alCambio();
    } catch (e: any) {
      alAviso({ texto: e.message, tipo: 'error' });
    }
  }

  return (
    <div className="space-y-2">
      {cuenta.pedidos.length === 0 && <p className="text-sm text-slate-500">Sin pedidos todavía.</p>}
      {cuenta.pedidos.map((p, i) => (
        <div key={p.id} className={`rounded-xl p-3 text-sm ${p.reposicion ? 'border border-dashed border-amber-400 bg-amber-50' : 'bg-slate-50'}`}>
          <div className="mb-1 flex flex-wrap items-center gap-2 font-bold">
            {p.reposicion ? '↺ Reposición sin costo' : `Ronda ${i + 1}`} · {hora(p.creadoEn)} · {p.mozo}
            <span className="rounded bg-white px-2 py-0.5 text-xs font-semibold text-slate-600">
              {p.estado === 'PROGRAMADO' ? `programado ${hora(p.horaProgramada)}` : p.estado.replace('_', ' ').toLowerCase()}
            </span>
            <div className="flex-1" />
            {!compacto && p.estado !== 'POR_CONFIRMAR' && p.estado !== 'PROGRAMADO' && (
              <button className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-white" onClick={() => ejecutar(() => api('POST', `/pedidos/${p.id}/reimprimir`), 'Comanda reimpresa en cocina')}>
                🖨 Reimprimir
              </button>
            )}
            {p.estado === 'EN_PREPARACION' && (
              <button className="btn-secundario min-h-9 px-3 text-xs" onClick={() => ejecutar(() => api('POST', `/pedidos/${p.id}/servido`), 'Marcado como servido')}>
                Servido
              </button>
            )}
          </div>
          {p.items.map((it) => (
            <div key={it.id} className="group flex items-start gap-2 py-0.5">
              <div className="flex-1">
                {it.cantidad}× {it.producto}
                {it.opciones.length > 0 && <span className="text-slate-500"> · {it.opciones.map((o) => o.nombre).join(', ')}</span>}
                {it.nota && <span className="italic text-slate-500"> · {it.nota}</span>}
              </div>
              <span className="font-semibold">{soles(it.precio * it.cantidad)}</span>
              {editable && p.estado !== 'POR_CONFIRMAR' && !compacto && (
                <span className="flex gap-1">
                  {!p.reposicion && (
                    <button title="Reposición por reclamo" className="rounded px-1.5 text-xs text-amber-700 hover:bg-amber-100" onClick={() => setAccion({ tipo: 'reponer', item: it })}>
                      ↺
                    </button>
                  )}
                  {cuenta.estado === 'ABIERTA' && (
                    <button title="Anular ítem" className="rounded px-1.5 text-xs text-red-600 hover:bg-red-100" onClick={() => setAccion({ tipo: 'anular', item: it })}>
                      ✕
                    </button>
                  )}
                </span>
              )}
            </div>
          ))}
        </div>
      ))}
      {cuenta.descuento > 0 && (
        <div className="flex justify-between rounded-xl bg-green-50 p-3 text-sm text-green-800">
          <span>Descuento · {cuenta.motivoDescuento}</span>
          <b>- {soles(cuenta.descuento)}</b>
        </div>
      )}

      {accion && (
        <PedirPin
          titulo={accion.tipo === 'anular' ? 'Anular ítem' : 'Reposición sin costo'}
          descripcion={
            accion.tipo === 'anular'
              ? `${accion.item.cantidad}× ${accion.item.producto}: se descuenta de la cuenta y la cocina recibe un ticket ANULACIÓN.`
              : `${accion.item.cantidad}× ${accion.item.producto}: se vuelve a preparar sin costo con el ticket REPOSICIÓN.`
          }
          motivos={accion.tipo === 'anular' ? MOTIVOS_ANULAR : MOTIVOS_REPONER}
          peligro={accion.tipo === 'anular'}
          textoBoton={accion.tipo === 'anular' ? 'Anular' : 'Reponer'}
          alCerrar={() => setAccion(null)}
          alConfirmar={async (pinAdmin, motivo) => {
            await api('POST', `/items/${accion.item.id}/${accion.tipo === 'anular' ? 'anular' : 'reponer'}`, { pinAdmin, motivo });
            alAviso({ texto: accion.tipo === 'anular' ? 'Ítem anulado' : 'Reposición enviada a cocina', tipo: 'ok' });
            alCambio();
          }}
        />
      )}
    </div>
  );
}

/** Precuenta impresa (REQ-CAJ-01, REQ-MOZ-06). */
export function PrecuentaImpresa({ cuenta, alCerrar }: { cuenta: CuentaDetalle; alCerrar: () => void }) {
  const items = cuenta.pedidos.filter((p) => p.estado !== 'POR_CONFIRMAR').flatMap((p) => p.items.map((i) => ({ ...i, reposicion: p.reposicion })));
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={alCerrar}>
      <div className="max-h-[94vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="w-[320px] bg-white p-5 font-mono text-[13px] text-black shadow-xl">
          <div className="text-center">
            <div className="text-base font-black">POLLERÍA Y BRASAS DEL SUR</div>
            <div className="mt-1 font-black">PRECUENTA · {cuenta.mesa}</div>
            <div>{new Date().toLocaleString('es-PE')}</div>
          </div>
          <div className="mt-2 border-t border-dashed border-black pt-2">
            {items.map((i) => (
              <div key={i.id} className="flex justify-between gap-2">
                <span>
                  {i.cantidad} {i.producto}
                  {i.reposicion ? ' (repos.)' : ''}
                </span>
                <span>{(i.precio * i.cantidad).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 border-t border-dashed border-black pt-2">
            {cuenta.descuento > 0 && (
              <div className="flex justify-between">
                <span>DESCUENTO</span>
                <span>-{cuenta.descuento.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-black">
              <span>TOTAL</span>
              <span>{soles(cuenta.total)}</span>
            </div>
            {cuenta.saldo !== cuenta.total && (
              <div className="flex justify-between">
                <span>SALDO</span>
                <span>{soles(cuenta.saldo)}</span>
              </div>
            )}
          </div>
          <div className="mt-3 border-y border-black py-1 text-center text-[11px] font-black">PRECUENTA – NO VÁLIDA COMO COMPROBANTE DE PAGO</div>
        </div>
        <div className="no-imprimir mt-3 grid grid-cols-2 gap-2">
          <button className="btn-secundario" onClick={() => window.print()}>
            🖨 Imprimir
          </button>
          <button className="btn-primario" onClick={alCerrar}>
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
