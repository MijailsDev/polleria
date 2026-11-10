'use client';
import { Ico } from '@/components/Ico';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { CANAL, Comanda } from '@/lib/tipos';
import { hora, minutosDesde, pitido, useEventos } from '@/lib/util';

/** Pedidos con bebidas por entregar: sus cantidades para la pestaña de la caja. */
export function useBebidasPendientes() {
  const [pedidos, setPedidos] = useState<Comanda[]>([]);
  const cargar = () => api<Comanda[]>('GET', '/bebidas').then(setPedidos).catch(() => {});
  useEffect(() => {
    cargar();
  }, []);
  useEventos({
    'bebidas:cambio': (d) => {
      if (d?.nuevo) pitido(1, 660);
      cargar();
    },
  });
  return { pedidos, cargar };
}

/**
 * Bebidas que salen de la refrigeradora de caja (destino de impresión CAJA).
 * El pollero no las ve; la cajera las entrega al mozo o las empaca y marca «Entregado».
 */
export function Bebidas({ pedidos, alCambio, alAviso }: { pedidos: Comanda[]; alCambio: () => void; alAviso: (a: { texto: string; tipo?: 'error' | 'ok' }) => void }) {
  const [, refrescar] = useState(0);
  useEffect(() => {
    const t = setInterval(() => refrescar((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  async function entregar(p: Comanda) {
    try {
      await api('POST', `/bebidas/${p.id}/entregar`);
      alAviso({ texto: `Bebidas de ${p.origen} entregadas${p.canal === 'SALON' ? ': se avisó al mozo' : ''}`, tipo: 'ok' });
      alCambio();
    } catch (e: any) {
      alAviso({ texto: e.message, tipo: 'error' });
    }
  }

  return (
    <div className="p-4">
      <div className="mb-3 flex flex-wrap items-baseline gap-2">
        <h2 className="text-xl font-bold">Bebidas por entregar</h2>
        <p className="text-sm text-slate-500">Las bebidas no van al pollero: salen de la refrigeradora de caja. La ticketera de caja imprime cada pedido con un pitido.</p>
      </div>
      {pedidos.length === 0 ? (
        <div className="tarjeta grid place-items-center p-10 text-slate-500">No hay bebidas pendientes.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {pedidos.map((p) => {
            const espera = Math.floor((Date.now() - new Date(p.impresoEn ?? p.creadoEn).getTime()) / 60000);
            return (
              <article key={p.id} className={`tarjeta flex flex-col border-2 p-4 ${espera >= 5 ? 'border-red-500' : 'border-transparent'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xl font-extrabold">{p.origen}</div>
                    <div className="text-xs text-slate-500">
                      Orden #{p.numero} · {hora(p.creadoEn)} · {p.mozo}
                    </div>
                  </div>
                  <span className={`rounded px-1.5 text-xs font-bold ${CANAL[p.canal].color}`}>
                    <Ico n={CANAL[p.canal].icono} /> {CANAL[p.canal].texto}
                  </span>
                </div>
                <ul className="my-3 flex-1 space-y-1">
                  {p.items.map((i) => (
                    <li key={i.id}>
                      {i.destino === 'CAJA' ? (
                        <>
                          <span className="text-lg font-bold">
                            {i.cantidad} × {i.producto}
                          </span>
                          {i.opciones.length > 0 && <div className="text-sm text-slate-600">{i.opciones.map((o) => o.nombre).join(', ')}</div>}
                        </>
                      ) : (
                        // Combo: solo sus bebidas
                        i.componentes
                          .filter((c) => c.destino === 'CAJA')
                          .map((c) => (
                            <div key={c.nombre}>
                              <span className="text-lg font-bold">
                                {c.cantidad} × {c.nombre}
                              </span>
                              <div className="text-sm text-slate-600">
                                del {i.producto}
                                {i.opciones.length > 0 && ` · ${i.opciones.map((o) => o.nombre).join(', ')}`}
                              </div>
                            </div>
                          ))
                      )}
                      {i.nota && <div className="text-sm font-semibold text-amber-700">Nota: {i.nota}</div>}
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-semibold ${espera >= 5 ? 'text-red-600' : 'text-slate-500'}`}><Ico n="reloj" /> {minutosDesde(p.impresoEn ?? p.creadoEn)}</span>
                  <button className="btn-primario min-h-12 px-5" onClick={() => entregar(p)}>
                    Entregado ✓
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
