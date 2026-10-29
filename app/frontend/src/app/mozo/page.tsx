'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useSesion } from '@/lib/sesion';
import { Comanda, CuentaDetalle, ESTADO_MESA, Mesa } from '@/lib/tipos';
import { hora, minutosDesde, pitido, soles, useEventos } from '@/lib/util';
import { Aviso, Encabezado } from '@/components/Encabezado';
import { TomaPedido } from '@/components/TomaPedido';
import { DetalleCuenta, PrecuentaImpresa } from '@/components/DetalleCuenta';
import { PedirPin } from '@/components/PedirPin';

interface Alerta { id: string; tipo: string; mesa?: string; mesaId?: string; mensaje: string; hora: string }

const COLOR_ALERTA: Record<string, string> = {
  CUENTA: 'border-l-blue-600',
  LLAMADO: 'border-l-brasa-600',
  PAGO_EN_LINEA: 'border-l-green-600',
  PAGO_EN_CURSO: 'border-l-green-400',
  STOCK: 'border-l-red-600',
};

export default function PaginaMozo() {
  const sesion = useSesion(['MOZO', 'CAJERO']);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [porConfirmar, setPorConfirmar] = useState<Comanda[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [sel, setSel] = useState<Mesa | null>(null);
  const [cuenta, setCuenta] = useState<CuentaDetalle | null>(null);
  const [tomando, setTomando] = useState(false);
  const [modo, setModo] = useState<'transferir' | 'unir' | null>(null);
  const [precuenta, setPrecuenta] = useState(false);
  const [fuga, setFuga] = useState(false);
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
    if (!mesa || mesa.estado === 'LIBRE') return setCuenta(null);
    try {
      setCuenta(await api<CuentaDetalle>('GET', `/cuentas/mesa/${mesa.id}`));
    } catch {
      setCuenta(null);
    }
  }, []);

  useEffect(() => {
    if (sesion) cargar();
  }, [sesion, cargar]);
  useEffect(() => {
    cargarCuenta(sel);
    setModo(null);
  }, [sel?.id, sel?.estado, sel?.total, sel?.unidaA, cargarCuenta]);
  useEffect(() => {
    const t = setInterval(() => setTic((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  useEventos(
    {
      'mesas:cambio': cargar,
      'cocina:actualizar': () => cargarCuenta(sel),
      alerta: (a) => {
        if (a.tipo === 'DELIVERY') return; // las entregas fallidas las atiende la caja
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
  const ocupadas = mesas.filter((m) => m.id !== sel?.id && !m.unidaA && !m.unidas.length && ['OCUPADA', 'POR_CONFIRMAR', 'CUENTA_SOLICITADA'].includes(m.estado));
  const llamados = alertas.filter((a) => a.tipo !== 'PEDIDO_QR');
  const pendientes = porConfirmar.length + llamados.length;
  const enUso = sel && sel.estado !== 'LIBRE' && sel.estado !== 'POR_LIMPIAR';

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
                  {m.unidaA && <div className="mt-1 text-xs font-bold text-slate-700">🔗 Unida a {m.unidaA}</div>}
                  {m.unidas.length > 0 && <div className="mt-1 text-xs font-bold text-slate-700">🔗 + {m.unidas.join(', ')}</div>}
                  {m.total > 0 && !m.unidaA && <div className="mt-2 text-lg font-bold text-slate-900">{soles(m.total)}</div>}
                </button>
              );
            })}
          </div>

          {sel && (
            <div className="tarjeta mt-4 p-5 animar-entrada">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-2xl font-extrabold">Mesa {cuenta?.mesa ?? sel.numero}</h3>
                <span className={`rounded-full border px-3 py-1 text-sm font-bold ${ESTADO_MESA[sel.estado].caja}`}>{ESTADO_MESA[sel.estado].texto}</span>
                {cuenta?.pagoEnLinea && <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-bold text-green-800">💳 Pagando en línea…</span>}
                <div className="flex-1" />
                {cuenta && <span className="text-xl font-bold">Total {soles(cuenta.total)}</span>}
              </div>
              {cuenta && (
                <div className="mt-3">
                  <DetalleCuenta cuenta={cuenta} alCambio={() => (cargar(), cargarCuenta(sel))} alAviso={setAviso} />
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {sel.estado !== 'POR_LIMPIAR' && (
                  <button className="btn-primario" onClick={() => setTomando(true)}>
                    + {sel.estado === 'LIBRE' ? 'Abrir mesa y tomar pedido' : 'Agregar pedido'}
                  </button>
                )}
                {cuenta && cuenta.total > 0 && (
                  <button className="btn-secundario" onClick={() => setPrecuenta(true)}>
                    🧾 Precuenta
                  </button>
                )}
                {enUso && !sel.unidaA && sel.unidas.length === 0 && (
                  <button className="btn-secundario" onClick={() => setModo((v) => (v === 'transferir' ? null : 'transferir'))}>
                    Transferir
                  </button>
                )}
                {enUso && !sel.unidaA && (
                  <button className="btn-secundario" onClick={() => setModo((v) => (v === 'unir' ? null : 'unir'))}>
                    🔗 Unir otra mesa
                  </button>
                )}
                {sel.unidaA && sel.estado !== 'POR_LIMPIAR' && (
                  <button className="btn-secundario" onClick={() => accion(() => api('POST', `/mesas/${sel.id}/separar`), `Mesa ${sel.numero} separada`)}>
                    Separar de {sel.unidaA}
                  </button>
                )}
                {(sel.estado === 'POR_LIMPIAR' || (enUso && !sel.unidaA && (cuenta?.total ?? 0) === 0 && sel.unidas.length === 0)) && (
                  <button className="btn-verde" onClick={() => accion(() => api('POST', `/mesas/${sel.id}/liberar`), `Mesa ${sel.numero} libre`)}>
                    Marcar libre
                  </button>
                )}
                {enUso && cuenta && cuenta.estado === 'ABIERTA' && cuenta.total > 0 && cuenta.pagos.length === 0 && !sel.unidaA && (
                  <button className="btn-secundario ml-auto border-red-300 text-red-700" onClick={() => setFuga(true)}>
                    Fuga de comensal
                  </button>
                )}
              </div>
              {modo && (
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3">
                  <span className="text-sm font-semibold">{modo === 'transferir' ? 'Mover la cuenta a:' : `Unir a ${sel.numero} la mesa:`}</span>
                  {(modo === 'transferir' ? libres : ocupadas).map((m) => (
                    <button
                      key={m.id}
                      className="chip-off"
                      onClick={() => {
                        setModo(null);
                        if (modo === 'transferir') accion(() => api('POST', `/mesas/${sel.id}/transferir`, { destinoId: m.id }), `Cuenta movida a ${m.numero}`).then(() => setSel(m));
                        else accion(() => api('POST', `/mesas/${sel.id}/unir`, { otraId: m.id }), `${m.numero} unida a ${sel.numero}`);
                      }}
                    >
                      {m.numero}
                    </button>
                  ))}
                  {(modo === 'transferir' ? libres : ocupadas).length === 0 && (
                    <span className="text-sm text-slate-500">{modo === 'transferir' ? 'No hay mesas libres.' : 'No hay otras mesas ocupadas.'}</span>
                  )}
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
              {p.items.map((it) => (
                <div key={it.id} className="text-sm">
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
          {llamados.map((a) => (
            <div key={a.id} className={`tarjeta border-l-4 p-4 animar-entrada ${COLOR_ALERTA[a.tipo] ?? 'border-l-slate-400'}`}>
              <div className="font-bold">{a.mensaje}</div>
              <div className="text-xs text-slate-500">{hora(a.hora)}</div>
              <button className="btn-secundario mt-2 min-h-10" onClick={() => setAlertas((l) => l.filter((x) => x.id !== a.id))}>
                Atendido
              </button>
            </div>
          ))}
          {pendientes === 0 && <p className="text-slate-500">Sin alertas por ahora.</p>}
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
      {precuenta && cuenta && <PrecuentaImpresa cuenta={cuenta} alCerrar={() => setPrecuenta(false)} />}
      {fuga && cuenta && sel && (
        <PedirPin
          titulo={`Fuga de comensal · ${sel.numero}`}
          descripcion={`La cuenta de ${soles(cuenta.total)} se anula como pérdida y la mesa pasa a «Por limpiar».`}
          motivos={['Se retiraron sin pagar']}
          peligro
          textoBoton="Registrar fuga"
          alCerrar={() => setFuga(false)}
          alConfirmar={async (pinAdmin, motivo) => {
            await api('POST', `/cuentas/${cuenta.cuentaId}/fuga`, { pinAdmin, motivo });
            setAviso({ texto: 'Fuga registrada', tipo: 'ok' });
            cargar();
          }}
        />
      )}
      {aviso && <Aviso texto={aviso.texto} tipo={aviso.tipo} alCerrar={() => setAviso(null)} />}
    </div>
  );
}
