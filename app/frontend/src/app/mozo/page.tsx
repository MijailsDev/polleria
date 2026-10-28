'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useSesion } from '@/lib/sesion';
import { Comanda, ESTADO_MESA, Mesa } from '@/lib/tipos';
import { hora, minutosDesde, pitido, soles, useEventos } from '@/lib/util';
import { Aviso, Encabezado } from '@/components/Encabezado';
import { TomaPedido } from '@/components/TomaPedido';

interface Alerta { id: string; tipo: string; mesa: string; mesaId: string; mensaje: string; hora: string }
interface Cuenta { cuentaId: string; mesa: string; total: number; saldo: number; pedidos: Comanda[] }

export default function PaginaMozo() {
  const sesion = useSesion(['MOZO', 'CAJERO']);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [porConfirmar, setPorConfirmar] = useState<Comanda[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [sel, setSel] = useState<Mesa | null>(null);
  const [cuenta, setCuenta] = useState<Cuenta | null>(null);
  const [tomando, setTomando] = useState(false);
  const [transfiriendo, setTransfiriendo] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; tipo?: 'error' | 'ok' } | null>(null);
  const [, setTic] = useState(0);

  const cargar = useCallback(async () => {
    try {
      const [m, p] = await Promise.all([api<Mesa[]>('GET', '/mesas'), api<Comanda[]>('GET', '/pedidos/por-confirmar')]);
      setMesas(m);
      setPorConfirmar(p);
      setSel((s) => (s ? m.find((x) => x.id === s.id) ?? null : s));
    } catch (e: any) {
      setAviso({ texto: e.message, tipo: 'error' });
    }
  }, []);

  const cargarCuenta = useCallback(async (mesa: Mesa | null) => {
    if (!mesa || mesa.estado === 'LIBRE' || mesa.estado === 'POR_LIMPIAR') return setCuenta(null);
    try {
      setCuenta(await api<Cuenta>('GET', `/cuentas/mesa/${mesa.id}`));
    } catch {
      setCuenta(null);
    }
  }, []);

  useEffect(() => {
    if (sesion) cargar();
  }, [sesion, cargar]);
  useEffect(() => {
    cargarCuenta(sel);
  }, [sel?.id, sel?.estado, sel?.total, cargarCuenta]);
  useEffect(() => {
    const t = setInterval(() => setTic((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  useEventos(
    {
      'mesas:cambio': cargar,
      'cocina:actualizar': () => cargarCuenta(sel),
      alerta: (a) => {
        pitido(2, 1200);
        setAlertas((l) => [{ ...a, id: `${Date.now()}-${Math.random()}` }, ...l].slice(0, 20));
        cargar();
      },
    },
    [sel?.id],
  );

  async function accion(fn: () => Promise<unknown>, ok?: string) {
    try {
      await fn();
      if (ok) setAviso({ texto: ok, tipo: 'ok' });
      cargar();
      cargarCuenta(sel);
    } catch (e: any) {
      setAviso({ texto: e.message, tipo: 'error' });
    }
  }

  if (!sesion) return null;
  const libres = mesas.filter((m) => m.estado === 'LIBRE' && m.id !== sel?.id);
  const llamados = alertas.filter((a) => a.tipo !== 'PEDIDO_QR');
  const pendientes = porConfirmar.length + llamados.length;

  return (
    <div className="min-h-screen">
      <Encabezado titulo="Salón" sesion={sesion} />
      <div className="grid gap-4 p-4 xl:grid-cols-[1fr_380px]">
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-bold">Plano del salón</h2>
            <div className="flex flex-wrap gap-3 text-sm text-slate-600">
              {Object.entries(ESTADO_MESA).map(([k, v]) => (
                <span key={k} className="flex items-center gap-1">
                  <span className={`h-3 w-3 rounded ${v.punto}`} />
                  {v.texto}
                </span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
            {mesas.map((m) => {
              const e = ESTADO_MESA[m.estado];
              return (
                <button
                  key={m.id}
                  onClick={() => setSel(m)}
                  className={`min-h-36 rounded-2xl border-2 p-4 text-left transition ${e.caja} ${sel?.id === m.id ? 'ring-4 ring-slate-900/70' : ''} ${m.estado === 'POR_CONFIRMAR' ? 'parpadeo' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-extrabold text-slate-900">{m.numero}</span>
                    <span className={`h-3 w-3 rounded-full ${e.punto}`} />
                  </div>
                  <div className="mt-2 text-sm font-bold">
                    {e.icono} {e.texto}
                  </div>
                  <div className="text-xs text-slate-600">{m.apertura && m.estado !== 'LIBRE' ? `${minutosDesde(m.apertura)} en mesa` : `${m.capacidad} sillas`}</div>
                  {m.total > 0 && <div className="mt-3 text-lg font-bold text-slate-900">{soles(m.total)}</div>}
                </button>
              );
            })}
          </div>

          {sel && (
            <div className="tarjeta mt-4 p-5 animar-entrada">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-2xl font-extrabold">Mesa {sel.numero}</h3>
                <span className={`rounded-full border px-3 py-1 text-sm font-bold ${ESTADO_MESA[sel.estado].caja}`}>{ESTADO_MESA[sel.estado].texto}</span>
                <div className="flex-1" />
                {cuenta && <span className="text-xl font-bold">Total {soles(cuenta.total)}</span>}
              </div>
              {cuenta && (
                <div className="mt-3 space-y-2">
                  {cuenta.pedidos.map((p, i) => (
                    <div key={p.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                      <div className="mb-1 flex items-center gap-2 font-bold">
                        Ronda {i + 1} · {hora(p.creadoEn)} · {p.mozo}
                        <span className="rounded bg-white px-2 py-0.5 text-xs font-semibold text-slate-600">{p.estado.replace('_', ' ').toLowerCase()}</span>
                        <div className="flex-1" />
                        {p.estado === 'EN_PREPARACION' && (
                          <button className="btn-secundario min-h-9 px-3 text-xs" onClick={() => accion(() => api('POST', `/pedidos/${p.id}/servido`), 'Marcado como servido')}>
                            Servido
                          </button>
                        )}
                      </div>
                      {p.items.map((it, k) => (
                        <div key={k}>
                          {it.cantidad}× {it.producto}
                          {it.opciones.length > 0 && <span className="text-slate-500"> · {it.opciones.map((o) => o.nombre).join(', ')}</span>}
                          {it.nota && <span className="italic text-slate-500"> · {it.nota}</span>}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {sel.estado !== 'POR_LIMPIAR' && (
                  <button className="btn-primario" onClick={() => setTomando(true)}>
                    + {sel.estado === 'LIBRE' ? 'Abrir mesa y tomar pedido' : 'Agregar pedido'}
                  </button>
                )}
                {sel.estado !== 'LIBRE' && sel.estado !== 'POR_LIMPIAR' && (
                  <button className="btn-secundario" onClick={() => setTransfiriendo((v) => !v)}>
                    Transferir mesa
                  </button>
                )}
                {(sel.estado === 'POR_LIMPIAR' || (sel.estado !== 'LIBRE' && (cuenta?.total ?? 0) === 0)) && (
                  <button className="btn-verde" onClick={() => accion(() => api('POST', `/mesas/${sel.id}/liberar`), `Mesa ${sel.numero} libre`)}>
                    Marcar libre
                  </button>
                )}
              </div>
              {transfiriendo && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">Mover a:</span>
                  {libres.map((m) => (
                    <button
                      key={m.id}
                      className="chip-off"
                      onClick={() => {
                        setTransfiriendo(false);
                        accion(() => api('POST', `/mesas/${sel.id}/transferir`, { destinoId: m.id }), `Cuenta movida a ${m.numero}`).then(() => setSel(m));
                      }}
                    >
                      {m.numero}
                    </button>
                  ))}
                  {libres.length === 0 && <span className="text-sm text-slate-500">No hay mesas libres.</span>}
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="space-y-3">
          <h2 className="text-xl font-bold">
            Alertas {pendientes > 0 && <span className="ml-1 rounded-full bg-red-600 px-2 text-sm text-white">{pendientes}</span>}
          </h2>
          {porConfirmar.map((p) => (
            <div key={p.id} className="tarjeta border-l-4 border-l-amber-500 p-4 animar-entrada">
              <div className="font-bold">{p.origen} · Pedido QR por confirmar</div>
              {p.items.map((it, k) => (
                <div key={k} className="text-sm">
                  {it.cantidad}× {it.producto}
                  {it.opciones.length > 0 && <span className="text-slate-500"> · {it.opciones.map((o) => o.nombre).join(', ')}</span>}
                </div>
              ))}
              <div className="mt-1 text-xs text-slate-500">hace {minutosDesde(p.creadoEn)}</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button className="btn-verde" onClick={() => accion(() => api('POST', `/pedidos/${p.id}/confirmar`), 'Pedido confirmado y enviado a cocina')}>
                  Confirmar
                </button>
                <button className="btn-secundario" onClick={() => accion(() => api('POST', `/pedidos/${p.id}/rechazar`), 'Pedido rechazado')}>
                  Rechazar
                </button>
              </div>
            </div>
          ))}
          {alertas
            .filter((a) => a.tipo !== 'PEDIDO_QR')
            .map((a) => (
              <div key={a.id} className={`tarjeta border-l-4 p-4 animar-entrada ${a.tipo === 'CUENTA' ? 'border-l-blue-600' : 'border-l-brasa-600'}`}>
                <div className="font-bold">{a.mensaje}</div>
                <div className="text-xs text-slate-500">{hora(a.hora)}</div>
                <button className="btn-secundario mt-2 min-h-10" onClick={() => setAlertas((l) => l.filter((x) => x.id !== a.id))}>
                  Atendido
                </button>
              </div>
            ))}
          {porConfirmar.length + alertas.filter((a) => a.tipo !== 'PEDIDO_QR').length === 0 && <p className="text-slate-500">Sin alertas por ahora.</p>}
        </aside>
      </div>

      {tomando && sel && (
        <TomaPedido
          mesaId={sel.id}
          mesa={sel.numero}
          alCerrar={() => setTomando(false)}
          alTerminar={(msg) => {
            setTomando(false);
            setAviso({ texto: msg, tipo: 'ok' });
            cargar();
          }}
        />
      )}
      {aviso && <Aviso texto={aviso.texto} tipo={aviso.tipo} alCerrar={() => setAviso(null)} />}
    </div>
  );
}
