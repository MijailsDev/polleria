'use client';
import { Ico } from '@/components/Ico';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useSesion } from '@/lib/sesion';
import { Comanda } from '@/lib/tipos';
import { hora, pitido, soles, useEventos } from '@/lib/util';
import { Aviso, Encabezado } from '@/components/Encabezado';
import { urlComensal } from '@/lib/modo';

interface Pedido extends Comanda {
  total: number;
  saldo: number;
  comprobantes?: { tipo: 'BOLETA' | 'FACTURA'; numero: string }[];
}

/** Celular del repartidor (REQ-DEL-05): sus pedidos, cuánto cobrar, vuelto y cambio de estado. */
export default function PaginaReparto() {
  const sesion = useSesion(['REPARTIDOR']);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [aviso, setAviso] = useState<{ texto: string; tipo?: 'error' | 'ok' } | null>(null);

  const cargar = useCallback(
    () =>
      api<Pedido[]>('GET', '/reparto/mis-pedidos')
        .then((l) =>
          setPedidos((antes) => {
            // Pitido cuando la caja le asigna un pedido nuevo
            const ruta = (x: Pedido[]) => x.filter((p) => p.delivery?.estado === 'EN_RUTA').length;
            if (antes.length && ruta(l) > ruta(antes)) pitido(2);
            return l;
          }),
        )
        .catch((e) => setAviso({ texto: e.message, tipo: 'error' })),
    [],
  );
  useEffect(() => {
    if (sesion) cargar();
  }, [sesion, cargar]);
  useEventos({ 'despacho:cambio': cargar });

  async function estado(p: Pedido, e: 'ENTREGADO' | 'FALLIDO') {
    try {
      // Al entregar, el sistema le envía al cliente su boleta por WhatsApp con este enlace
      await api('POST', `/despacho/${p.id}/estado`, { estado: e, enlaceBase: urlComensal() });
      const conBoleta = e === 'ENTREGADO' && (p.comprobantes?.length ?? 0) > 0;
      setAviso({
        texto: e === 'ENTREGADO' ? (conBoleta ? 'Entrega registrada ✓ · boleta enviada al WhatsApp del cliente' : 'Entrega registrada ✓') : 'Entrega fallida registrada',
        tipo: e === 'ENTREGADO' ? 'ok' : 'error',
      });
      cargar();
    } catch (err: any) {
      setAviso({ texto: err.message, tipo: 'error' });
    }
  }

  if (!sesion) return null;
  const enRuta = pedidos.filter((p) => p.delivery?.estado === 'EN_RUTA');
  const hechos = pedidos.filter((p) => p.delivery?.estado !== 'EN_RUTA');
  const rendir = hechos.filter((p) => p.delivery?.estado === 'ENTREGADO').reduce((s, p) => s + p.saldo, 0);

  return (
    <div className="min-h-screen">
      <Encabezado titulo="Reparto" sesion={sesion} />
      <main className="mx-auto max-w-lg space-y-3 p-4">
        <div className="tarjeta flex items-center justify-between gap-3 p-4">
          <span className="font-semibold leading-tight">Efectivo por rendir en caja</span>
          <b className="text-2xl">{soles(rendir)}</b>
        </div>
        <h2 className="text-lg font-bold">En ruta ({enRuta.length})</h2>
        {enRuta.length === 0 && <p className="text-slate-500">No tienes pedidos en ruta. La caja te los asigna al salir.</p>}
        {enRuta.map((p) => {
          const d = p.delivery!;
          const vuelto = d.pagaCon && p.saldo > 0 ? d.pagaCon - p.saldo : 0;
          return (
            <article key={p.id} className="tarjeta p-4 animar-entrada">
              <div className="flex justify-between">
                <b className="text-lg">{p.origen}</b>
                <span className="text-sm text-slate-500">{hora(p.creadoEn)}</span>
              </div>
              <div className="font-semibold">{d.cliente}</div>
              <a className="text-blue-700 underline" href={`tel:${d.celular}`}>
                <Ico n="telefono" /> {d.celular}
              </a>
              <div className="mt-1">
                <Ico n="ubicacion" /> <b>{d.direccion}</b>
                {d.referencia && <span className="text-slate-600"> · {d.referencia}</span>}
              </div>
              <a className="text-sm text-blue-700 underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/${encodeURIComponent(d.direccion + ', Puerto Maldonado')}`}>
                Abrir en el mapa
              </a>
              <div className="mt-2 text-sm text-slate-600">{p.items.map((i) => `${i.cantidad}× ${i.producto}`).join(', ')}</div>
              {p.saldo > 0 ? (
                <div className="mt-3 overflow-hidden rounded-xl bg-slate-900 text-white">
                  <div className="p-3 text-center">
                    <div className="text-xs font-semibold uppercase tracking-wider text-white/60">Cobrar</div>
                    <div className="text-3xl font-black">{soles(p.saldo)}</div>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-white/15 border-t border-white/15 text-center">
                    <div className="p-2.5">
                      <div className="text-xs text-white/60">Paga con</div>
                      <div className="inline-flex items-center gap-1.5 text-lg font-bold text-amber-200">
                        <Ico n="billete" /> {d.pagaCon ? soles(d.pagaCon) : 'Exacto'}
                      </div>
                    </div>
                    <div className="p-2.5">
                      <div className="text-xs text-white/60">Llevar de vuelto</div>
                      <div className="text-lg font-bold">{vuelto > 0 ? soles(vuelto) : '—'}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-3 rounded-xl bg-green-700 p-3 text-center text-lg font-black text-white">PAGADO · NO COBRAR</div>
              )}
              {(p.comprobantes?.length ?? 0) > 0 && (
                <div className="mt-2 flex items-start gap-2 rounded-xl bg-brasa-50 p-2.5 text-sm text-brasa-900">
                  <Ico n="recibo" className="mt-0.5 shrink-0" />
                  <span>
                    <b>
                      {p.comprobantes!.map((c) => `${c.tipo === 'FACTURA' ? 'Factura' : 'Boleta'} ${c.numero}`).join(', ')}
                    </b>{' '}
                    va en la bolsa. Al marcar «Entregado» también le llega al cliente por WhatsApp.
                  </span>
                </div>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button className="btn-verde" onClick={() => estado(p, 'ENTREGADO')}>
                  ✓ Entregado
                </button>
                <button className="btn-secundario text-red-700" onClick={() => estado(p, 'FALLIDO')}>
                  No se pudo entregar
                </button>
              </div>
            </article>
          );
        })}
        {hechos.length > 0 && (
          <>
            <h2 className="pt-2 text-lg font-bold">Por liquidar en caja</h2>
            {hechos.map((p) => (
              <div key={p.id} className="tarjeta flex justify-between p-3 text-sm">
                <span>
                  {p.origen} · {p.delivery?.cliente}
                </span>
                <b className={p.delivery?.estado === 'FALLIDO' ? 'text-red-700' : ''}>{p.delivery?.estado === 'FALLIDO' ? 'fallido' : soles(p.saldo)}</b>
              </div>
            ))}
          </>
        )}
      </main>
      {aviso && <Aviso texto={aviso.texto} tipo={aviso.tipo} alCerrar={() => setAviso(null)} />}
    </div>
  );
}
