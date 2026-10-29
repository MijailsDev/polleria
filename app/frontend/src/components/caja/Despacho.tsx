'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { CANAL, Comanda } from '@/lib/tipos';
import { fechaLocal, hora, soles, useEventos } from '@/lib/util';
import { TomaPedido } from '@/components/TomaPedido';
import { PedirPin } from '@/components/PedirPin';

type Avisar = (a: { texto: string; tipo?: 'error' | 'ok' }) => void;
interface PedidoTablero extends Comanda { total: number; saldo: number; estadoCuenta: string }
interface Grupo { repartidorId: string; repartidor: string; cobrar: number; vueltos: number; pedidos: { pedidoId: string; numero: number; cliente: string; estado: string; saldo: number; pagaCon: number | null; vuelto: number }[] }
interface Cliente { nombre: string; documento: string | null; direcciones: { direccion: string; referencia: string | null }[] }

const COLUMNAS = [
  { clave: 'programado', titulo: '⏰ Programados' },
  { clave: 'cocina', titulo: '🔥 En cocina' },
  { clave: 'listo', titulo: '✅ Listos' },
  { clave: 'ruta', titulo: '🛵 En ruta' },
  { clave: 'fin', titulo: '🏁 Entregados hoy' },
] as const;

function columna(p: PedidoTablero) {
  if (p.estado === 'PROGRAMADO') return 'programado';
  if (p.estado === 'EN_PREPARACION' || p.estado === 'CONFIRMADO') return 'cocina';
  if (p.delivery) {
    if (p.delivery.estado === 'EN_RUTA') return 'ruta';
    if (p.delivery.estado === 'ENTREGADO' || (p.delivery.estado === 'FALLIDO' && p.delivery.destinoFallido)) return 'fin';
    return 'listo';
  }
  return p.estadoCuenta === 'PAGADA' || p.estadoCuenta === 'ANULADA' ? 'fin' : 'listo';
}

/** Pedidos para llevar, programados, delivery y apps (F-12): nuevo pedido, tablero, hoja de ruta y liquidación. */
export function Despacho({ alAviso, alCobrar }: { alAviso: Avisar; alCobrar: (cuentaId: string) => void }) {
  const [tablero, setTablero] = useState<PedidoTablero[]>([]);
  const [repartidores, setRepartidores] = useState<{ id: string; nombre: string }[]>([]);
  const [liquidar, setLiquidar] = useState<Grupo[]>([]);
  const [nuevo, setNuevo] = useState<'LLEVAR' | 'DELIVERY' | 'APP_EXTERNA' | null>(null);
  const [hoja, setHoja] = useState<PedidoTablero | null>(null);
  const [fallido, setFallido] = useState<PedidoTablero | null>(null);
  const [destino, setDestino] = useState<'REINGRESO' | 'CONSUMO' | 'MERMA'>('MERMA');
  const [asignar, setAsignar] = useState<Record<string, string>>({});
  const [rendido, setRendido] = useState<Record<string, string>>({});

  const cargar = useCallback(() => {
    api<PedidoTablero[]>('GET', '/despacho/tablero').then(setTablero).catch(() => {});
    api<Grupo[]>('GET', '/repartidores/por-liquidar').then(setLiquidar).catch(() => {});
  }, []);
  useEffect(() => {
    cargar();
    api('GET', '/repartidores').then(setRepartidores).catch(() => {});
  }, [cargar]);
  useEventos({ 'despacho:cambio': cargar, 'cocina:actualizar': cargar, 'cocina:comanda': cargar });

  async function accion(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      alAviso({ texto: ok, tipo: 'ok' });
      cargar();
    } catch (e: any) {
      alAviso({ texto: e.message, tipo: 'error' });
    }
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-2 text-xl font-bold">Llevar, delivery y apps</h2>
        {(['LLEVAR', 'DELIVERY', 'APP_EXTERNA'] as const).map((c) => (
          <button key={c} className="btn-primario" onClick={() => setNuevo(c)}>
            + {CANAL[c].icono} {CANAL[c].texto}
          </button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-5">
        {COLUMNAS.map((col) => {
          const lista = tablero.filter((p) => columna(p) === col.clave);
          return (
            <section key={col.clave} className="rounded-2xl bg-slate-100 p-3">
              <h3 className="mb-2 flex justify-between font-bold">
                {col.titulo} <span className="text-slate-500">{lista.length}</span>
              </h3>
              <div className="space-y-2">
                {lista.map((p) => (
                  <article key={p.id} className="tarjeta p-3 text-sm animar-entrada">
                    <div className="flex items-start justify-between gap-2">
                      <b className="leading-tight">{p.origen}</b>
                      <span className={`shrink-0 rounded px-1.5 text-xs font-bold ${CANAL[p.canal].color}`}>{CANAL[p.canal].icono}</span>
                    </div>
                    {p.delivery && (
                      <div className="text-xs text-slate-600">
                        {p.delivery.cliente} · {p.delivery.direccion}
                      </div>
                    )}
                    <div className="mt-1 text-xs text-slate-500">
                      {p.items.map((i) => `${i.cantidad}× ${i.producto}`).join(', ')}
                    </div>
                    <div className="mt-1 flex justify-between text-xs">
                      <span>{p.estado === 'PROGRAMADO' ? `para las ${hora(p.horaProgramada)}` : hora(p.creadoEn)}</span>
                      <b className={p.estadoCuenta === 'ANULADA' ? 'text-slate-500' : p.saldo > 0 ? 'text-brasa-700' : 'text-green-700'}>
                        {p.estadoCuenta === 'ANULADA' ? 'anulado' : p.saldo > 0 ? `debe ${soles(p.saldo)}` : 'pagado'}
                      </b>
                    </div>
                    {p.delivery?.repartidor && <div className="text-xs text-slate-600">🛵 {p.delivery.repartidor}</div>}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {p.saldo > 0 && p.estadoCuenta === 'ABIERTA' && p.canal !== 'DELIVERY' && (
                        <button className="btn-verde min-h-9 px-2 text-xs" onClick={() => alCobrar(p.cuentaId)}>
                          Cobrar
                        </button>
                      )}
                      {p.saldo > 0 && p.estadoCuenta === 'ABIERTA' && p.canal === 'DELIVERY' && col.clave !== 'ruta' && col.clave !== 'fin' && (
                        <button className="btn-secundario min-h-9 px-2 text-xs" onClick={() => alCobrar(p.cuentaId)}>
                          Cobrar ya (Yape)
                        </button>
                      )}
                      {col.clave === 'cocina' && (
                        <button className="btn-secundario min-h-9 px-2 text-xs" onClick={() => accion(() => api('POST', `/pedidos/${p.id}/servido`), 'Pedido listo')}>
                          Listo
                        </button>
                      )}
                      {p.delivery && col.clave === 'listo' && p.delivery.estado === 'PENDIENTE' && (
                        <>
                          <select className="campo min-h-9 w-full py-0 text-xs" value={asignar[p.id] ?? ''} onChange={(e) => setAsignar({ ...asignar, [p.id]: e.target.value })}>
                            <option value="">Repartidor…</option>
                            {repartidores.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.nombre}
                              </option>
                            ))}
                          </select>
                          <button
                            className="btn-primario min-h-9 px-2 text-xs"
                            disabled={!asignar[p.id]}
                            onClick={() => accion(() => api('POST', `/despacho/${p.id}/estado`, { estado: 'EN_RUTA', repartidorId: asignar[p.id] }), 'Pedido en ruta').then(() => setHoja(p))}
                          >
                            Salir a ruta
                          </button>
                        </>
                      )}
                      {p.delivery && (
                        <button className="btn-secundario min-h-9 px-2 text-xs" onClick={() => setHoja(p)}>
                          Hoja de ruta
                        </button>
                      )}
                      {p.delivery?.estado === 'EN_RUTA' && (
                        <>
                          <button className="btn-secundario min-h-9 px-2 text-xs" onClick={() => accion(() => api('POST', `/despacho/${p.id}/estado`, { estado: 'ENTREGADO' }), 'Entregado')}>
                            Entregado
                          </button>
                          <button className="btn-secundario min-h-9 px-2 text-xs text-red-700" onClick={() => accion(() => api('POST', `/despacho/${p.id}/estado`, { estado: 'FALLIDO' }), 'Marcado como fallido')}>
                            Falló
                          </button>
                        </>
                      )}
                      {p.delivery?.estado === 'FALLIDO' && !p.delivery.destinoFallido && (
                        <button className="btn-rojo min-h-9 px-2 text-xs" onClick={() => setFallido(p)}>
                          Resolver entrega fallida
                        </button>
                      )}
                      {p.delivery?.destinoFallido && <span className="text-xs font-semibold text-red-700">Fallido · {p.delivery.destinoFallido.toLowerCase()}</span>}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <section className="tarjeta p-5">
        <h3 className="text-lg font-bold">Liquidación de repartidores</h3>
        <p className="mb-3 text-sm text-slate-500">Al volver, el repartidor rinde el efectivo de las entregas. Se emite la boleta de cada pedido.</p>
        {liquidar.length === 0 && <p className="text-slate-500">No hay entregas pendientes de liquidar.</p>}
        <div className="grid gap-3 md:grid-cols-2">
          {liquidar.map((g) => (
            <div key={g.repartidorId} className="rounded-xl border border-slate-200 p-4">
              <div className="flex justify-between font-bold">
                <span>🛵 {g.repartidor}</span>
                <span>Debe rendir {soles(g.cobrar)}</span>
              </div>
              {g.pedidos.map((p) => (
                <div key={p.pedidoId} className="flex justify-between text-sm">
                  <span>
                    #D-{String(p.numero).padStart(2, '0')} · {p.cliente} · {p.estado === 'EN_RUTA' ? 'en ruta' : 'entregado'}
                  </span>
                  <span>
                    {soles(p.saldo)}
                    {p.vuelto > 0 && ` (vuelto ${soles(p.vuelto)})`}
                  </span>
                </div>
              ))}
              <div className="mt-3 flex gap-2">
                <input className="campo" inputMode="decimal" placeholder="Efectivo que entrega" value={rendido[g.repartidorId] ?? ''} onChange={(e) => setRendido({ ...rendido, [g.repartidorId]: e.target.value })} />
                <button
                  className="btn-verde"
                  disabled={!rendido[g.repartidorId] || g.cobrar === 0}
                  onClick={() =>
                    api<{ diferencia: number }>('POST', `/repartidores/${g.repartidorId}/liquidar`, { rendido: Number(rendido[g.repartidorId]) })
                      .then((r) => {
                        alAviso({ texto: r.diferencia === 0 ? 'Liquidación cuadrada ✓' : `Liquidado con diferencia de ${soles(r.diferencia)}`, tipo: r.diferencia === 0 ? 'ok' : 'error' });
                        setRendido({ ...rendido, [g.repartidorId]: '' });
                        cargar();
                      })
                      .catch((e) => alAviso({ texto: e.message, tipo: 'error' }))
                  }
                >
                  Liquidar
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {nuevo && <NuevoPedido canal={nuevo} alCerrar={() => setNuevo(null)} alTerminar={(m) => (setNuevo(null), alAviso({ texto: m, tipo: 'ok' }), cargar())} />}
      {hoja && <HojaDeRuta p={hoja} alCerrar={() => setHoja(null)} />}
      {fallido && (
        <PedirPin
          titulo={`Entrega fallida · ${fallido.origen}`}
          descripcion={fallido.saldo > 0 ? 'La cuenta se anulará. Indica qué pasó con el producto.' : 'El pedido ya estaba pagado: emite también una nota de crédito desde Cobrar.'}
          pedirMotivo={false}
          peligro
          textoBoton="Registrar"
          alCerrar={() => setFallido(null)}
          alConfirmar={async (pinAdmin) => {
            await api('POST', `/despacho/${fallido.id}/fallido`, { destino, pinAdmin });
            alAviso({ texto: 'Entrega fallida resuelta', tipo: 'ok' });
            cargar();
          }}
        >
          <div className="mb-3 grid gap-2">
            {(
              [
                ['REINGRESO', 'Vuelve al stock (en buen estado)'],
                ['CONSUMO', 'Consumo del personal'],
                ['MERMA', 'Merma (se desecha)'],
              ] as const
            ).map(([k, t]) => (
              <button key={k} className={destino === k ? 'chip-on min-h-11 text-left' : 'chip-off min-h-11 text-left'} onClick={() => setDestino(k)}>
                {t}
              </button>
            ))}
          </div>
        </PedirPin>
      )}
    </div>
  );
}

/** Nuevo pedido de llevar, delivery o app: datos del cliente, programación y carta. */
function NuevoPedido({ canal, alCerrar, alTerminar }: { canal: 'LLEVAR' | 'DELIVERY' | 'APP_EXTERNA'; alCerrar: () => void; alTerminar: (m: string) => void }) {
  const [d, setD] = useState({ nombreCliente: '', celular: '', direccion: '', referencia: '', pagaCon: '', codigoPlataforma: '', hora: '' });
  const [programar, setProgramar] = useState(false);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const set = (k: keyof typeof d, v: string) => setD((x) => ({ ...x, [k]: v }));

  async function buscar(cel: string) {
    set('celular', cel);
    if (!/^9\d{8}$/.test(cel)) return setCliente(null);
    const c = await api<Cliente | null>('GET', `/clientes/${cel}`).catch(() => null);
    setCliente(c);
    if (c) {
      setD((x) => ({ ...x, celular: cel, nombreCliente: c.nombre, direccion: c.direcciones[0]?.direccion ?? x.direccion, referencia: c.direcciones[0]?.referencia ?? x.referencia }));
    }
  }

  const panel = (
    <div className="space-y-2 text-sm">
      <h3 className="text-lg font-bold">
        {CANAL[canal].icono} {CANAL[canal].texto}
      </h3>
      {canal === 'DELIVERY' && (
        <>
          <input className="campo" inputMode="numeric" maxLength={9} placeholder="Celular (9 dígitos)" value={d.celular} onChange={(e) => buscar(e.target.value.replace(/\D/g, ''))} />
          {cliente && <p className="text-xs font-semibold text-green-700">✓ Cliente frecuente: {cliente.nombre}</p>}
        </>
      )}
      {canal !== 'APP_EXTERNA' && <input className="campo" placeholder="Nombre del cliente" value={d.nombreCliente} onChange={(e) => set('nombreCliente', e.target.value)} />}
      {canal === 'DELIVERY' && (
        <>
          <input className="campo" placeholder="Dirección" value={d.direccion} onChange={(e) => set('direccion', e.target.value)} />
          {cliente && cliente.direcciones.length > 1 && (
            <div className="flex flex-wrap gap-1">
              {cliente.direcciones.map((x) => (
                <button key={x.direccion} className="chip-off min-h-8 text-xs" onClick={() => setD((v) => ({ ...v, direccion: x.direccion, referencia: x.referencia ?? '' }))}>
                  {x.direccion}
                </button>
              ))}
            </div>
          )}
          <input className="campo" placeholder="Referencia" value={d.referencia} onChange={(e) => set('referencia', e.target.value)} />
          <input className="campo" inputMode="decimal" placeholder="Paga con (S/) · contra entrega" value={d.pagaCon} onChange={(e) => set('pagaCon', e.target.value)} />
        </>
      )}
      {canal === 'APP_EXTERNA' && <input className="campo" placeholder="Código de la app (ej.: PY-9421)" value={d.codigoPlataforma} onChange={(e) => set('codigoPlataforma', e.target.value.toUpperCase())} />}
      {canal !== 'APP_EXTERNA' && (
        <label className="flex items-center gap-2 font-semibold">
          <input type="checkbox" className="h-5 w-5" checked={programar} onChange={(e) => (setProgramar(e.target.checked), set('hora', fechaLocal(new Date(Date.now() + 60 * 60000))))} />
          Programar para más tarde
        </label>
      )}
      {programar && <input className="campo" type="datetime-local" value={d.hora} onChange={(e) => set('hora', e.target.value)} />}
    </div>
  );

  return (
    <TomaPedido
      titulo={`Nuevo pedido · ${CANAL[canal].texto}`}
      textoBoton={programar ? 'Programar' : 'Enviar a cocina'}
      panelExtra={panel}
      alCerrar={alCerrar}
      alTerminar={alTerminar}
      alEnviar={async (items, clave) => {
        const r = await api<Comanda>('POST', '/despacho/pedidos', {
          canal,
          items,
          clave,
          nombreCliente: d.nombreCliente || undefined,
          celular: d.celular || undefined,
          direccion: d.direccion || undefined,
          referencia: d.referencia || undefined,
          pagaCon: d.pagaCon ? Number(d.pagaCon) : undefined,
          codigoPlataforma: d.codigoPlataforma || undefined,
          horaProgramada: programar && d.hora ? new Date(d.hora).toISOString() : undefined,
        });
        return r.estado === 'PROGRAMADO' ? `${r.origen} programado para las ${hora(r.horaProgramada)}` : `${r.origen} enviado a cocina`;
      }}
    />
  );
}

/** Hoja de ruta del delivery con monto a cobrar y vuelto (REQ-DEL-04). */
function HojaDeRuta({ p, alCerrar }: { p: PedidoTablero; alCerrar: () => void }) {
  const d = p.delivery!;
  const vuelto = d.pagaCon && p.saldo > 0 ? Math.max(0, d.pagaCon - p.saldo) : 0;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={alCerrar}>
      <div onClick={(e) => e.stopPropagation()}>
        <div className="w-[320px] bg-white p-5 font-mono text-[13px] text-black shadow-xl">
          <div className="text-center text-lg font-black">HOJA DE RUTA</div>
          <div className="text-center text-xl font-black">{p.origen}</div>
          <div className="mt-2 border-t border-dashed border-black pt-2">
            <div className="font-black">{d.cliente}</div>
            <div>Tel: {d.celular}</div>
            <div className="font-black">{d.direccion}</div>
            {d.referencia && <div>Ref: {d.referencia}</div>}
            {d.repartidor && <div>Repartidor: {d.repartidor}</div>}
          </div>
          <div className="mt-2 border-t border-dashed border-black pt-2">
            {p.items.map((i) => (
              <div key={i.id}>
                {i.cantidad} {i.producto}
                {i.opciones.length > 0 && ` (${i.opciones.map((o) => o.nombre).join(', ')})`}
              </div>
            ))}
          </div>
          <div className="mt-2 border-y-2 border-black py-2 text-center text-base font-black">
            {p.saldo > 0 ? `COBRAR: ${soles(p.saldo)}${vuelto ? ` | VUELTO: ${soles(vuelto)}` : ''}` : 'PAGADO · NO COBRAR'}
          </div>
          {d.pagaCon && p.saldo > 0 && <div className="mt-1 text-center">Paga con {soles(d.pagaCon)}</div>}
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
