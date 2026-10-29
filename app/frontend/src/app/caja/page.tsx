'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useSesion } from '@/lib/sesion';
import { CANAL, Categoria, Comanda, CuentaDetalle, ESTADO_MESA, Mesa } from '@/lib/tipos';
import { pitido, soles, useEventos } from '@/lib/util';
import { Aviso, Encabezado } from '@/components/Encabezado';
import { ComprobanteImpreso } from '@/components/ComprobanteImpreso';
import { Cobro } from '@/components/caja/Cobro';
import { Despacho } from '@/components/caja/Despacho';
import { Inventario } from '@/components/caja/Inventario';
import { TurnoAbierto, TurnoPanel } from '@/components/caja/Turno';

type Pestana = 'cobrar' | 'despacho' | 'inventario' | 'agotados' | 'turno';
const PESTANAS: { clave: Pestana; texto: string }[] = [
  { clave: 'cobrar', texto: 'Cobrar' },
  { clave: 'despacho', texto: 'Llevar y delivery' },
  { clave: 'inventario', texto: 'Inventario' },
  { clave: 'agotados', texto: 'Agotados' },
  { clave: 'turno', texto: 'Turno' },
];
interface SinMesa { cuentaId: string; origen: string; canal: Comanda['canal']; saldo: number; total: number; despacho: string | null }
type Seleccion = { tipo: 'mesa'; id: string } | { tipo: 'cuenta'; id: string } | null;

export default function PaginaCaja() {
  const sesion = useSesion(['CAJERO']);
  const [pestana, setPestana] = useState<Pestana>('cobrar');
  const [turno, setTurno] = useState<TurnoAbierto | null | undefined>(undefined);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [sinMesa, setSinMesa] = useState<SinMesa[]>([]);
  const [sel, setSel] = useState<Seleccion>(null);
  const [cuenta, setCuenta] = useState<CuentaDetalle | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; tipo?: 'error' | 'ok' } | null>(null);
  const [impreso, setImpreso] = useState<{ id: string; vuelto?: number } | null>(null);

  const cargarTurno = useCallback(() => api<TurnoAbierto | null>('GET', '/turnos/actual').then(setTurno).catch(() => setTurno(null)), []);
  const cargarListas = useCallback(() => {
    api<Mesa[]>('GET', '/mesas').then(setMesas).catch(() => {});
    api<SinMesa[]>('GET', '/cuentas/sin-mesa').then(setSinMesa).catch(() => {});
  }, []);
  const cargarCuenta = useCallback(async (s: Seleccion) => {
    if (!s) return setCuenta(null);
    try {
      setCuenta(await api<CuentaDetalle>('GET', s.tipo === 'mesa' ? `/cuentas/mesa/${s.id}` : `/cuentas/${s.id}`));
    } catch {
      setCuenta(null);
    }
  }, []);

  useEffect(() => {
    if (sesion) {
      cargarTurno();
      cargarListas();
    }
  }, [sesion, cargarTurno, cargarListas]);
  useEffect(() => {
    cargarCuenta(sel);
  }, [sel, cargarCuenta]);
  useEventos(
    {
      'mesas:cambio': () => {
        cargarListas();
        cargarCuenta(sel);
      },
      'despacho:cambio': () => {
        cargarListas();
        cargarCuenta(sel);
      },
      'gaveta:abrir': (d) => setAviso({ texto: `🗄 Gaveta abierta (${d?.motivo ?? 'cobro'})`, tipo: 'ok' }),
      alerta: (a) => {
        if (['PAGO_EN_LINEA', 'STOCK', 'DELIVERY'].includes(a.tipo)) {
          pitido(2, 1000);
          setAviso({ texto: a.mensaje, tipo: a.tipo === 'PAGO_EN_LINEA' ? 'ok' : 'error' });
        }
      },
      'inventario:alerta': (a) => setAviso({ texto: `⚠ ${a.mensaje}`, tipo: 'error' }),
    },
    [sel],
  );

  if (!sesion || turno === undefined) return null;
  const conCuenta = mesas.filter((m) => m.estado !== 'LIBRE' && m.estado !== 'POR_LIMPIAR' && !m.unidaA);
  const elegido = (s: Seleccion) => sel && s && sel.tipo === s.tipo && sel.id === s.id;

  return (
    <div className="min-h-screen">
      <Encabezado
        titulo="Caja"
        sesion={sesion}
        extra={
          <nav className="flex flex-wrap gap-1">
            {PESTANAS.map((p) => (
              <button key={p.clave} className={`rounded-lg px-3 py-2 text-sm font-semibold ${pestana === p.clave ? 'bg-brasa-700' : 'hover:bg-slate-800'}`} onClick={() => setPestana(p.clave)}>
                {p.texto}
              </button>
            ))}
          </nav>
        }
      />

      {!turno && pestana !== 'agotados' && pestana !== 'inventario' ? (
        <AbrirTurno
          alAbrir={() => {
            cargarTurno();
            setAviso({ texto: 'Turno abierto', tipo: 'ok' });
          }}
        />
      ) : pestana === 'cobrar' ? (
        <div className="grid gap-4 p-4 lg:grid-cols-[300px_1fr]">
          <aside className="space-y-4">
            <div>
              <h2 className="mb-2 text-lg font-bold">Mesas por cobrar</h2>
              <div className="grid gap-2">
                {conCuenta.length === 0 && <p className="text-sm text-slate-500">No hay mesas con cuenta abierta.</p>}
                {conCuenta.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSel({ tipo: 'mesa', id: m.id })}
                    className={`flex items-center justify-between rounded-xl border-2 p-3 text-left ${ESTADO_MESA[m.estado].caja} ${elegido({ tipo: 'mesa', id: m.id }) ? 'ring-4 ring-slate-900/60' : ''}`}
                  >
                    <span>
                      <span className="text-xl font-extrabold text-slate-900">
                        {m.numero}
                        {m.unidas.length > 0 && <span className="text-sm"> + {m.unidas.join(' + ')}</span>}
                      </span>
                      <span className="block text-xs font-semibold">{ESTADO_MESA[m.estado].texto}</span>
                    </span>
                    <span className="text-lg font-bold text-slate-900">{soles(m.saldo)}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h2 className="mb-2 text-lg font-bold">Llevar y delivery por cobrar</h2>
              <div className="grid gap-2">
                {sinMesa.length === 0 && <p className="text-sm text-slate-500">Nada pendiente.</p>}
                {sinMesa.map((c) => (
                  <button
                    key={c.cuentaId}
                    onClick={() => setSel({ tipo: 'cuenta', id: c.cuentaId })}
                    className={`flex items-center justify-between rounded-xl border-2 border-slate-300 bg-white p-3 text-left ${elegido({ tipo: 'cuenta', id: c.cuentaId }) ? 'ring-4 ring-slate-900/60' : ''}`}
                  >
                    <span>
                      <span className="font-bold">{c.origen}</span>
                      <span className={`mt-1 block w-fit rounded px-1.5 text-xs font-bold ${CANAL[c.canal].color}`}>
                        {CANAL[c.canal].icono} {CANAL[c.canal].texto}
                        {c.despacho ? ` · ${c.despacho.toLowerCase().replace('_', ' ')}` : ''}
                      </span>
                    </span>
                    <span className="text-lg font-bold">{soles(c.saldo)}</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>
          {cuenta && sel ? (
            <Cobro
              key={cuenta.cuentaId + cuenta.saldo + cuenta.total + cuenta.estado}
              cuenta={cuenta}
              alCobrar={(r) => {
                setImpreso({ id: r.comprobanteId, vuelto: r.vuelto });
                cargarListas();
                cargarCuenta(sel);
              }}
              alCambio={() => (cargarListas(), cargarCuenta(sel))}
              alAviso={setAviso}
              alVerComprobante={(id) => setImpreso({ id })}
            />
          ) : (
            <div className="tarjeta grid place-items-center p-10 text-slate-500">Elige una mesa o un pedido para ver su cuenta y cobrar.</div>
          )}
        </div>
      ) : pestana === 'despacho' ? (
        <Despacho
          alAviso={setAviso}
          alCobrar={(cuentaId) => {
            setSel({ tipo: 'cuenta', id: cuentaId });
            setPestana('cobrar');
          }}
        />
      ) : pestana === 'inventario' ? (
        <Inventario alAviso={setAviso} />
      ) : pestana === 'agotados' ? (
        <Agotados alAviso={setAviso} />
      ) : (
        turno && <TurnoPanel turno={turno} alAviso={setAviso} alCerrar={cargarTurno} />
      )}

      {impreso && <ComprobanteImpreso id={impreso.id} vuelto={impreso.vuelto} alCerrar={() => setImpreso(null)} />}
      {aviso && <Aviso texto={aviso.texto} tipo={aviso.tipo} alCerrar={() => setAviso(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------- Abrir turno

function AbrirTurno({ alAbrir }: { alAbrir: () => void }) {
  const [fondo, setFondo] = useState('100');
  const [error, setError] = useState('');
  return (
    <div className="mx-auto mt-16 max-w-sm px-4">
      <div className="tarjeta p-6">
        <h2 className="text-xl font-bold">Abrir turno de caja</h2>
        <p className="mb-4 text-slate-500">Cuenta el sencillo con el que empiezas.</p>
        <label className="mb-1 block text-sm font-semibold">Fondo inicial (S/)</label>
        <input className="campo mb-4 text-xl" inputMode="decimal" value={fondo} onChange={(e) => setFondo(e.target.value)} />
        {error && <p className="mb-3 font-semibold text-red-600">{error}</p>}
        <button
          className="btn-primario w-full"
          onClick={() =>
            api('POST', '/turnos/abrir', { fondoInicial: Number(fondo) })
              .then(alAbrir)
              .catch((e) => setError(e.message))
          }
        >
          Abrir turno
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Agotados (Protocolo 86)

function Agotados({ alAviso }: { alAviso: (a: { texto: string; tipo?: 'error' | 'ok' }) => void }) {
  const [carta, setCarta] = useState<Categoria[]>([]);
  const cargar = () => api<Categoria[]>('GET', '/carta').then(setCarta);
  useEffect(() => {
    cargar();
  }, []);
  useEventos({ 'carta:actualizada': cargar });

  async function cambiar(tipo: 'producto' | 'opcion', id: string, agotado: boolean, nombre: string) {
    try {
      await api('PATCH', `/agotados/${tipo}/${id}`, { agotado });
      alAviso({ texto: `${nombre}: ${agotado ? 'AGOTADO' : 'disponible'}`, tipo: 'ok' });
    } catch (e: any) {
      alAviso({ texto: e.message, tipo: 'error' });
    }
  }

  // Las presas se agotan una sola vez para todos los productos que las usan
  const presas = carta
    .flatMap((c) => c.productos)
    .flatMap((p) => p.grupos.filter((g) => g.nombre === 'Presa').flatMap((g) => g.opciones.map((o) => ({ ...o, producto: p.nombre }))));
  return (
    <div className="grid gap-4 p-4 lg:grid-cols-2">
      <section className="tarjeta p-5">
        <h2 className="mb-1 text-lg font-bold">Productos</h2>
        <p className="mb-3 text-sm text-slate-500">Al marcarlo, deja de poder pedirse en la carta QR y en las tablets al instante.</p>
        {carta.map((c) => (
          <div key={c.id} className="mb-3">
            <div className="mb-1 text-sm font-bold text-slate-500">{c.nombre}</div>
            {c.productos.map((p) => (
              <label key={p.id} className="flex min-h-12 items-center justify-between border-b border-slate-100">
                <span className={p.agotado ? 'text-slate-400 line-through' : ''}>{p.nombre}</span>
                <input type="checkbox" className="h-6 w-6 accent-red-600" checked={p.agotado} onChange={(e) => cambiar('producto', p.id, e.target.checked, p.nombre)} />
              </label>
            ))}
          </div>
        ))}
      </section>
      <section className="tarjeta p-5">
        <h2 className="mb-1 text-lg font-bold">Presas</h2>
        <p className="mb-3 text-sm text-slate-500">Se agotan solas cuando el stock baja del umbral; también puedes marcarlas aquí.</p>
        {presas.map((o) => (
          <label key={o.id} className="flex min-h-12 items-center justify-between border-b border-slate-100">
            <span className={o.agotado ? 'text-slate-400 line-through' : ''}>
              {o.nombre} <span className="text-xs text-slate-500">· {o.producto}</span>
            </span>
            <input type="checkbox" className="h-6 w-6 accent-red-600" checked={o.agotado} onChange={(e) => cambiar('opcion', o.id, e.target.checked, `${o.nombre} (${o.producto})`)} />
          </label>
        ))}
      </section>
    </div>
  );
}
