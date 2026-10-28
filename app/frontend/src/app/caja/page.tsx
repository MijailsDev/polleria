'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useSesion } from '@/lib/sesion';
import { Categoria, Comanda, ESTADO_MESA, Mesa } from '@/lib/tipos';
import { hora, soles, useEventos } from '@/lib/util';
import { Aviso, Encabezado } from '@/components/Encabezado';
import { ComprobanteImpreso } from '@/components/ComprobanteImpreso';

type Medio = 'EFECTIVO' | 'YAPE' | 'PLIN' | 'TARJETA';
interface LineaPago { medio: Medio; monto: string; recibido: string; numeroOperacion: string }
interface Cuenta {
  cuentaId: string;
  mesa: string;
  total: number;
  saldo: number;
  pedidos: Comanda[];
  pagos: { medio: string; monto: number; numeroOperacion: string | null }[];
  comprobantes: { id: string; numero: string; total: number }[];
}
interface Turno { id: string; apertura: string; fondoInicial: number; declarado: boolean }
interface Reporte {
  cajero: string;
  apertura: string;
  cierre: string | null;
  fondoInicial: number;
  ventasPorMedio: Record<string, number>;
  totalVentas: number;
  ingresos: number;
  egresos: number;
  efectivoEsperado: number;
  efectivoDeclarado: number | null;
  diferencia: number | null;
  comentario: string | null;
  comprobantes: { numero: string; tipo: string; total: number }[];
}

const cent = (v: string | number) => Math.round(Number(v || 0) * 100);
const BILLETES = [10, 20, 50, 100, 200];

export default function PaginaCaja() {
  const sesion = useSesion(['CAJERO']);
  const [pestana, setPestana] = useState<'cobrar' | 'agotados' | 'turno'>('cobrar');
  const [turno, setTurno] = useState<Turno | null | undefined>(undefined);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [cuenta, setCuenta] = useState<Cuenta | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; tipo?: 'error' | 'ok' } | null>(null);
  const [impreso, setImpreso] = useState<{ id: string; vuelto?: number } | null>(null);

  const cargarTurno = useCallback(() => api<Turno | null>('GET', '/turnos/actual').then(setTurno).catch(() => setTurno(null)), []);
  const cargarMesas = useCallback(() => api<Mesa[]>('GET', '/mesas').then(setMesas).catch(() => {}), []);
  const cargarCuenta = useCallback(async (mesaId: string | null) => {
    if (!mesaId) return setCuenta(null);
    try {
      setCuenta(await api<Cuenta>('GET', `/cuentas/mesa/${mesaId}`));
    } catch {
      setCuenta(null);
    }
  }, []);

  useEffect(() => {
    if (sesion) {
      cargarTurno();
      cargarMesas();
    }
  }, [sesion, cargarTurno, cargarMesas]);
  useEffect(() => {
    cargarCuenta(sel);
  }, [sel, cargarCuenta]);
  useEventos(
    {
      'mesas:cambio': () => {
        cargarMesas();
        cargarCuenta(sel);
      },
      'gaveta:abrir': (d) => setAviso({ texto: `🗄 Gaveta abierta (${d?.motivo ?? 'cobro'})`, tipo: 'ok' }),
    },
    [sel],
  );

  if (!sesion || turno === undefined) return null;
  const conCuenta = mesas.filter((m) => m.estado !== 'LIBRE' && m.estado !== 'POR_LIMPIAR');

  return (
    <div className="min-h-screen">
      <Encabezado
        titulo="Caja"
        sesion={sesion}
        extra={
          <nav className="flex gap-1">
            {(['cobrar', 'agotados', 'turno'] as const).map((p) => (
              <button key={p} className={`rounded-lg px-3 py-2 text-sm font-semibold ${pestana === p ? 'bg-brasa-700' : 'hover:bg-slate-800'}`} onClick={() => setPestana(p)}>
                {p === 'cobrar' ? 'Cobrar' : p === 'agotados' ? 'Agotados' : 'Turno'}
              </button>
            ))}
          </nav>
        }
      />

      {!turno ? (
        <AbrirTurno
          alAbrir={() => {
            cargarTurno();
            setAviso({ texto: 'Turno abierto', tipo: 'ok' });
          }}
        />
      ) : pestana === 'cobrar' ? (
        <div className="grid gap-4 p-4 lg:grid-cols-[300px_1fr]">
          <aside>
            <h2 className="mb-3 text-lg font-bold">Mesas por cobrar</h2>
            <div className="grid gap-2">
              {conCuenta.length === 0 && <p className="text-slate-500">No hay cuentas abiertas.</p>}
              {conCuenta.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSel(m.id)}
                  className={`flex items-center justify-between rounded-xl border-2 p-3 text-left ${ESTADO_MESA[m.estado].caja} ${sel === m.id ? 'ring-4 ring-slate-900/60' : ''}`}
                >
                  <span>
                    <span className="text-xl font-extrabold text-slate-900">{m.numero}</span>
                    <span className="block text-xs font-semibold">{ESTADO_MESA[m.estado].texto}</span>
                  </span>
                  <span className="text-lg font-bold text-slate-900">{soles(m.saldo)}</span>
                </button>
              ))}
            </div>
          </aside>
          {cuenta && sel ? (
            <Cobro
              key={cuenta.cuentaId + cuenta.saldo}
              cuenta={cuenta}
              alCobrar={(r) => {
                setImpreso({ id: r.comprobanteId, vuelto: r.vuelto });
                cargarMesas();
                cargarCuenta(sel);
              }}
              alError={(m) => setAviso({ texto: m, tipo: 'error' })}
              alVerComprobante={(id) => setImpreso({ id })}
            />
          ) : (
            <div className="tarjeta grid place-items-center p-10 text-slate-500">Elige una mesa para ver su cuenta y cobrar.</div>
          )}
        </div>
      ) : pestana === 'agotados' ? (
        <Agotados alAviso={setAviso} />
      ) : (
        <TurnoPanel
          turno={turno}
          alAviso={setAviso}
          alCerrar={() => {
            cargarTurno();
          }}
        />
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

// ---------------------------------------------------------------- Cobro

function Cobro({
  cuenta,
  alCobrar,
  alError,
  alVerComprobante,
}: {
  cuenta: Cuenta;
  alCobrar: (r: { comprobanteId: string; vuelto: number }) => void;
  alError: (m: string) => void;
  alVerComprobante: (id: string) => void;
}) {
  const [aCobrar, setACobrar] = useState(cuenta.saldo.toFixed(2));
  const [partes, setPartes] = useState(2);
  const [pagos, setPagos] = useState<LineaPago[]>([]);
  const [tipo, setTipo] = useState<'BOLETA' | 'FACTURA'>('BOLETA');
  const [documento, setDocumento] = useState('');
  const [nombre, setNombre] = useState('');
  const [enviando, setEnviando] = useState(false);

  const objetivo = cent(aCobrar);
  const pagado = pagos.reduce((s, p) => s + cent(p.monto), 0);
  const falta = objetivo - pagado;
  const vuelto = pagos.filter((p) => p.medio === 'EFECTIVO').reduce((s, p) => s + Math.max(0, cent(p.recibido || p.monto) - cent(p.monto)), 0);
  const items = useMemo(() => cuenta.pedidos.flatMap((p) => p.items.map((i) => ({ ...i, ronda: hora(p.creadoEn), estado: p.estado }))), [cuenta]);

  function agregarPago(medio: Medio) {
    if (falta <= 0) return;
    setPagos((l) => [...l, { medio, monto: (falta / 100).toFixed(2), recibido: '', numeroOperacion: '' }]);
  }
  const cambiar = (i: number, campo: keyof LineaPago, v: string) => setPagos((l) => l.map((p, k) => (k === i ? { ...p, [campo]: v } : p)));

  async function buscarDocumento() {
    try {
      const d = await api<{ nombre: string }>('GET', `/documentos/${documento.trim()}`);
      setNombre(d.nombre);
    } catch (e: any) {
      alError(e.message);
    }
  }

  async function cobrar() {
    setEnviando(true);
    try {
      const r = await api<{ comprobanteId: string; vuelto: number }>('POST', `/cuentas/${cuenta.cuentaId}/cobrar`, {
        pagos: pagos.map((p) => ({
          medio: p.medio,
          monto: Number(p.monto),
          recibido: p.medio === 'EFECTIVO' && p.recibido ? Number(p.recibido) : undefined,
          numeroOperacion: p.medio !== 'EFECTIVO' ? p.numeroOperacion : undefined,
        })),
        comprobante: { tipo, documento: documento.trim() || undefined, nombre: nombre.trim() || undefined },
      });
      alCobrar(r);
    } catch (e: any) {
      alError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="tarjeta p-5">
        <h2 className="text-2xl font-extrabold">Cuenta · Mesa {cuenta.mesa}</h2>
        <div className="mt-3 divide-y divide-slate-100">
          {items.map((i, k) => (
            <div key={k} className="flex justify-between gap-3 py-2">
              <div>
                <div className="font-semibold">
                  {i.cantidad}× {i.producto}
                </div>
                <div className="text-xs text-slate-500">
                  {i.opciones.map((o) => o.nombre).join(' · ')}
                  {i.estado === 'POR_CONFIRMAR' ? ' · por confirmar (no se cobra aún)' : ''}
                </div>
              </div>
              <div className="font-semibold">{soles(i.precio * i.cantidad)}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-between text-lg">
          <span>Total</span>
          <b>{soles(cuenta.total)}</b>
        </div>
        {cuenta.pagos.length > 0 && (
          <div className="mt-1 text-sm text-slate-600">
            Pagado: {cuenta.pagos.map((p) => `${p.medio.toLowerCase()} ${soles(p.monto)}`).join(' + ')}
          </div>
        )}
        <div className="mt-1 flex justify-between text-2xl font-extrabold text-brasa-700">
          <span>Saldo</span>
          <span>{soles(cuenta.saldo)}</span>
        </div>
        {cuenta.comprobantes.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {cuenta.comprobantes.map((c) => (
              <button key={c.id} className="chip-off" onClick={() => alVerComprobante(c.id)}>
                🧾 {c.numero}
              </button>
            ))}
          </div>
        )}
      </section>

      {cuenta.saldo <= 0 ? (
        <section className="tarjeta grid place-items-center p-8 text-center">
          <div>
            <div className="text-5xl">✅</div>
            <h3 className="mt-2 text-xl font-bold">Cuenta pagada</h3>
            <p className="text-slate-500">La mesa pasó a «Por limpiar». El mozo la marcará como libre.</p>
          </div>
        </section>
      ) : (
      <section className="tarjeta space-y-4 p-5">
        <div>
          <h3 className="mb-2 font-bold">Monto a cobrar ahora</h3>
          <div className="flex flex-wrap items-center gap-2">
            <input className="campo w-36 text-xl font-bold" inputMode="decimal" value={aCobrar} onChange={(e) => (setACobrar(e.target.value), setPagos([]))} />
            <button className="chip-off" onClick={() => (setACobrar(cuenta.saldo.toFixed(2)), setPagos([]))}>
              Todo
            </button>
            <span className="text-sm text-slate-500">Dividir en</span>
            <select className="campo w-20" value={partes} onChange={(e) => setPartes(Number(e.target.value))}>
              {[2, 3, 4, 5, 6].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
            <button
              className="chip-off"
              onClick={() => {
                // La última parte se lleva los céntimos del redondeo (REQ-CAJ-05)
                const restantes = Math.max(1, partes - cuenta.comprobantes.length);
                const parte = Math.floor(cent(cuenta.saldo) / restantes);
                setACobrar(((restantes === 1 ? cent(cuenta.saldo) : parte) / 100).toFixed(2));
                setPagos([]);
              }}
            >
              Partes iguales
            </button>
          </div>
        </div>

        <div>
          <h3 className="mb-2 font-bold">Pagos</h3>
          <div className="grid grid-cols-4 gap-2">
            {(['EFECTIVO', 'YAPE', 'PLIN', 'TARJETA'] as Medio[]).map((m) => (
              <button key={m} className="btn-secundario px-2 text-sm" disabled={falta <= 0} onClick={() => agregarPago(m)}>
                + {m === 'EFECTIVO' ? 'Efectivo' : m === 'TARJETA' ? 'Tarjeta' : m[0] + m.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          <div className="mt-3 space-y-2">
            {pagos.map((p, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center gap-2">
                  <b className="w-20">{p.medio}</b>
                  <input className="campo w-28" inputMode="decimal" value={p.monto} onChange={(e) => cambiar(i, 'monto', e.target.value)} />
                  <div className="flex-1" />
                  <button className="text-red-600" onClick={() => setPagos((l) => l.filter((_, k) => k !== i))}>
                    Quitar
                  </button>
                </div>
                {p.medio === 'EFECTIVO' ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    <span>Recibido:</span>
                    {BILLETES.filter((b) => b * 100 >= cent(p.monto)).map((b) => (
                      <button key={b} className={p.recibido === String(b) ? 'chip-on' : 'chip-off'} onClick={() => cambiar(i, 'recibido', String(b))}>
                        S/ {b}
                      </button>
                    ))}
                    <input className="campo w-24" inputMode="decimal" placeholder="exacto" value={p.recibido} onChange={(e) => cambiar(i, 'recibido', e.target.value)} />
                    {cent(p.recibido) > cent(p.monto) && <b className="text-green-700">Vuelto {soles((cent(p.recibido) - cent(p.monto)) / 100)}</b>}
                  </div>
                ) : (
                  <input
                    className="campo mt-2"
                    placeholder={`N.° de operación ${p.medio === 'TARJETA' ? 'del POS' : 'de ' + p.medio.toLowerCase()}`}
                    value={p.numeroOperacion}
                    onChange={(e) => cambiar(i, 'numeroOperacion', e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
          <div className={`mt-2 text-right font-bold ${falta === 0 ? 'text-green-700' : 'text-brasa-700'}`}>
            {falta === 0 ? 'Saldo pendiente S/ 0.00 ✓' : falta > 0 ? `Falta asignar ${soles(falta / 100)}` : `Sobra ${soles(-falta / 100)}`}
          </div>
        </div>

        <div>
          <h3 className="mb-2 font-bold">Comprobante</h3>
          <div className="mb-2 grid grid-cols-2 gap-2">
            {(['BOLETA', 'FACTURA'] as const).map((t) => (
              <button key={t} className={tipo === t ? 'chip-on min-h-12' : 'chip-off min-h-12'} onClick={() => setTipo(t)}>
                {t === 'BOLETA' ? 'Boleta' : 'Factura (RUC)'}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input className="campo" inputMode="numeric" placeholder={tipo === 'FACTURA' ? 'RUC (11 dígitos)' : 'DNI (opcional hasta S/ 700)'} value={documento} onChange={(e) => setDocumento(e.target.value)} />
            <button className="btn-secundario" disabled={!documento.trim()} onClick={buscarDocumento}>
              Buscar
            </button>
          </div>
          <input className="campo mt-2" placeholder="Nombre o razón social" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>

        <button className="btn-verde w-full text-lg" disabled={falta !== 0 || objetivo <= 0 || enviando} onClick={cobrar}>
          {enviando ? 'Cobrando…' : `Cobrar ${soles(objetivo / 100)} y emitir ${tipo === 'FACTURA' ? 'factura' : 'boleta'}`}
          {vuelto > 0 && ` · vuelto ${soles(vuelto / 100)}`}
        </button>
      </section>
      )}
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
        <p className="mb-3 text-sm text-slate-500">Ejemplo: si se acaban las piernas, márcalas aquí y el sistema ofrecerá solo pecho.</p>
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

// ---------------------------------------------------------------- Turno: movimientos, arqueo ciego y Reporte Z

function TurnoPanel({ turno, alAviso, alCerrar }: { turno: Turno; alAviso: (a: { texto: string; tipo?: 'error' | 'ok' }) => void; alCerrar: () => void }) {
  const [mov, setMov] = useState({ tipo: 'EGRESO', monto: '', motivo: '', pinAdmin: '' });
  const [declarado, setDeclarado] = useState('');
  const [comentario, setComentario] = useState('');
  const [pideComentario, setPideComentario] = useState<{ esperado: number; declarado: number; diferencia: number } | null>(null);
  const [reporte, setReporte] = useState<Reporte | null>(null);

  async function registrarMovimiento() {
    try {
      await api('POST', '/turnos/movimiento', { ...mov, monto: Number(mov.monto), pinAdmin: mov.pinAdmin || undefined });
      alAviso({ texto: 'Movimiento registrado', tipo: 'ok' });
      setMov({ tipo: 'EGRESO', monto: '', motivo: '', pinAdmin: '' });
    } catch (e: any) {
      alAviso({ texto: e.message, tipo: 'error' });
    }
  }

  async function cerrar() {
    try {
      const r = await api<any>('POST', '/turnos/cerrar', { efectivoDeclarado: Number(declarado), comentario: comentario || undefined });
      if (r.requiereComentario) setPideComentario(r);
      else setReporte(r.reporte);
    } catch (e: any) {
      alAviso({ texto: e.message, tipo: 'error' });
    }
  }

  if (reporte) return <ReporteZ r={reporte} alSalir={alCerrar} />;

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-2">
      <section className="tarjeta p-5">
        <h2 className="text-lg font-bold">Turno abierto</h2>
        <p className="text-slate-500">
          Desde las {hora(turno.apertura)} · fondo inicial {soles(turno.fondoInicial)}
        </p>
        <h3 className="mt-5 mb-2 font-bold">Ingreso o egreso de efectivo</h3>
        <div className="mb-2 grid grid-cols-2 gap-2">
          {['EGRESO', 'INGRESO'].map((t) => (
            <button key={t} className={mov.tipo === t ? 'chip-on min-h-12' : 'chip-off min-h-12'} onClick={() => setMov({ ...mov, tipo: t })}>
              {t === 'EGRESO' ? 'Egreso (sale dinero)' : 'Ingreso'}
            </button>
          ))}
        </div>
        <input className="campo mb-2" inputMode="decimal" placeholder="Monto (S/)" value={mov.monto} onChange={(e) => setMov({ ...mov, monto: e.target.value })} />
        <input className="campo mb-2" placeholder="Motivo (ej.: compra de gas)" value={mov.motivo} onChange={(e) => setMov({ ...mov, motivo: e.target.value })} />
        {mov.tipo === 'EGRESO' && Number(mov.monto) > 50 && (
          <input className="campo mb-2" type="password" inputMode="numeric" placeholder="PIN del administrador (egresos > S/ 50)" value={mov.pinAdmin} onChange={(e) => setMov({ ...mov, pinAdmin: e.target.value })} />
        )}
        <button className="btn-secundario w-full" onClick={registrarMovimiento}>
          Registrar
        </button>
      </section>

      <section className="tarjeta p-5">
        <h2 className="text-lg font-bold">Cerrar turno (arqueo ciego)</h2>
        <p className="mb-3 text-sm text-slate-500">Cuenta los billetes y monedas de la gaveta y escribe el total. El sistema no te muestra cuánto espera hasta que declares.</p>
        {!pideComentario ? (
          <>
            <input className="campo mb-3 text-xl" inputMode="decimal" placeholder="Efectivo contado (S/)" value={declarado} onChange={(e) => setDeclarado(e.target.value)} />
            <button className="btn-rojo w-full" disabled={declarado === ''} onClick={cerrar}>
              Declarar y cerrar turno
            </button>
          </>
        ) : (
          <div className="animar-entrada">
            <div className="mb-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-slate-100 p-3">
                <div className="text-xs text-slate-500">Esperado</div>
                <b>{soles(pideComentario.esperado)}</b>
              </div>
              <div className="rounded-xl bg-slate-100 p-3">
                <div className="text-xs text-slate-500">Declarado</div>
                <b>{soles(pideComentario.declarado)}</b>
              </div>
              <div className="rounded-xl bg-red-50 p-3 text-red-700">
                <div className="text-xs">Diferencia</div>
                <b>{soles(pideComentario.diferencia)}</b>
              </div>
            </div>
            <p className="mb-2 text-sm font-semibold">La diferencia supera S/ 1.00: explica el motivo para cerrar.</p>
            <textarea className="campo mb-3 min-h-24 py-3" value={comentario} onChange={(e) => setComentario(e.target.value)} />
            <button className="btn-rojo w-full" disabled={!comentario.trim()} onClick={cerrar}>
              Cerrar turno con este comentario
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function ReporteZ({ r, alSalir }: { r: Reporte; alSalir: () => void }) {
  return (
    <div className="mx-auto my-6 max-w-md px-4">
      <div className="bg-white p-6 font-mono text-sm shadow-xl">
        <div className="text-center text-lg font-black">REPORTE Z · CIERRE DE TURNO</div>
        <div className="mt-2 border-t border-dashed border-black pt-2">
          <div>Cajero: {r.cajero}</div>
          <div>Apertura: {new Date(r.apertura).toLocaleString('es-PE')}</div>
          <div>Cierre: {r.cierre ? new Date(r.cierre).toLocaleString('es-PE') : '-'}</div>
        </div>
        <div className="mt-2 border-t border-dashed border-black pt-2">
          {Object.entries(r.ventasPorMedio).map(([m, v]) => (
            <div key={m} className="flex justify-between">
              <span>{m}</span>
              <span>{v.toFixed(2)}</span>
            </div>
          ))}
          <div className="flex justify-between font-black">
            <span>TOTAL VENTAS</span>
            <span>{soles(r.totalVentas)}</span>
          </div>
        </div>
        <div className="mt-2 border-t border-dashed border-black pt-2">
          <div className="flex justify-between"><span>Fondo inicial</span><span>{r.fondoInicial.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Ingresos</span><span>{r.ingresos.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Egresos</span><span>-{r.egresos.toFixed(2)}</span></div>
          <div className="flex justify-between font-bold"><span>Efectivo esperado</span><span>{r.efectivoEsperado.toFixed(2)}</span></div>
          <div className="flex justify-between font-bold"><span>Efectivo declarado</span><span>{(r.efectivoDeclarado ?? 0).toFixed(2)}</span></div>
          <div className="flex justify-between font-black"><span>DIFERENCIA</span><span>{(r.diferencia ?? 0).toFixed(2)}</span></div>
          {r.comentario && <div className="mt-1">Motivo: {r.comentario}</div>}
        </div>
        <div className="mt-2 border-t border-dashed border-black pt-2">
          <div className="font-bold">Comprobantes ({r.comprobantes.length})</div>
          {r.comprobantes.map((c) => (
            <div key={c.numero} className="flex justify-between">
              <span>{c.numero}</span>
              <span>{c.total.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="no-imprimir mt-3 grid grid-cols-2 gap-2">
        <button className="btn-secundario" onClick={() => window.print()}>
          🖨 Imprimir
        </button>
        <button className="btn-primario" onClick={alSalir}>
          Listo
        </button>
      </div>
    </div>
  );
}
