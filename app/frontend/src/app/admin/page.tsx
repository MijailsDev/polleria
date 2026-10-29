'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Rol, useSesion } from '@/lib/sesion';
import { soles } from '@/lib/util';
import { Aviso, Encabezado } from '@/components/Encabezado';
import { CartaAdmin } from '@/components/admin/CartaAdmin';
import { PedirPin } from '@/components/PedirPin';
import { Reporte, ReporteZ } from '@/components/caja/Turno';

type Pestana = 'usuarios' | 'carta' | 'mesas' | 'config' | 'turnos' | 'bitacora';
type Avisar = (a: { texto: string; tipo?: 'error' | 'ok' }) => void;
const PESTANAS: [Pestana, string][] = [
  ['usuarios', '👥 Usuarios'],
  ['carta', '🍗 Carta y precios'],
  ['mesas', '🪑 Mesas'],
  ['config', '⚙ Configuración'],
  ['turnos', '💵 Turnos'],
  ['bitacora', '📜 Bitácora'],
];
const ROLES: Rol[] = ['MOZO', 'CAJERO', 'REPARTIDOR', 'ADMINISTRADOR'];

/** Panel del administrador (F-01, F-02, REQ-SAL-06, REQ-TUR-06, REQ-REP-05). */
export default function PaginaAdmin() {
  const sesion = useSesion(['ADMINISTRADOR']);
  const [pestana, setPestana] = useState<Pestana>('usuarios');
  const [aviso, setAviso] = useState<{ texto: string; tipo?: 'error' | 'ok' } | null>(null);
  if (!sesion) return null;
  return (
    <div className="min-h-screen">
      <Encabezado titulo="Administración" sesion={sesion} />
      <div className="no-imprimir flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2">
        {PESTANAS.map(([k, t]) => (
          <button key={k} className={pestana === k ? 'chip-on whitespace-nowrap' : 'chip-off whitespace-nowrap'} onClick={() => setPestana(k)}>
            {t}
          </button>
        ))}
      </div>
      <main className="p-4">
        {pestana === 'usuarios' && <Usuarios alAviso={setAviso} miId={sesion.usuario.id} />}
        {pestana === 'carta' && <CartaAdmin alAviso={setAviso} />}
        {pestana === 'mesas' && <Mesas alAviso={setAviso} />}
        {pestana === 'config' && <Configuracion alAviso={setAviso} />}
        {pestana === 'turnos' && <Turnos alAviso={setAviso} />}
        {pestana === 'bitacora' && <Bitacora />}
      </main>
      {aviso && <Aviso texto={aviso.texto} tipo={aviso.tipo} alCerrar={() => setAviso(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------- Usuarios (REQ-USR-04)

interface Usuario { id: string; nombre: string; rol: Rol; activo: boolean; tienePassword: boolean }

function Usuarios({ alAviso, miId }: { alAviso: Avisar; miId: string }) {
  const [lista, setLista] = useState<Usuario[]>([]);
  const [nuevo, setNuevo] = useState({ nombre: '', rol: 'MOZO' as Rol, pin: '', password: '' });
  const [pinNuevo, setPinNuevo] = useState<Record<string, string>>({});
  const cargar = useCallback(() => api<Usuario[]>('GET', '/admin/usuarios').then(setLista).catch((e) => alAviso({ texto: e.message, tipo: 'error' })), [alAviso]);
  useEffect(() => {
    cargar();
  }, [cargar]);
  const guardar = (fn: () => Promise<unknown>, ok: string) =>
    fn()
      .then(() => (alAviso({ texto: ok, tipo: 'ok' }), cargar()))
      .catch((e) => alAviso({ texto: e.message, tipo: 'error' }));

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <section className="tarjeta overflow-x-auto p-4">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="py-1">Nombre</th>
              <th>Rol</th>
              <th>Restablecer PIN</th>
              <th>Activo</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((u) => (
              <tr key={u.id} className={`border-t border-slate-100 ${u.activo ? '' : 'text-slate-400'}`}>
                <td className="py-2 pr-2">
                  <input className="campo min-h-10" defaultValue={u.nombre} onBlur={(e) => e.target.value.trim() !== u.nombre && guardar(() => api('PATCH', `/admin/usuarios/${u.id}`, { nombre: e.target.value }), 'Nombre actualizado')} />
                </td>
                <td className="pr-2">
                  <select className="campo min-h-10" value={u.rol} disabled={u.id === miId} onChange={(e) => guardar(() => api('PATCH', `/admin/usuarios/${u.id}`, { rol: e.target.value }), 'Rol actualizado')}>
                    {ROLES.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </td>
                <td className="pr-2">
                  <div className="flex gap-1">
                    <input className="campo min-h-10 w-24" type="password" inputMode="numeric" maxLength={6} placeholder="PIN nuevo" value={pinNuevo[u.id] ?? ''} onChange={(e) => setPinNuevo({ ...pinNuevo, [u.id]: e.target.value.replace(/\D/g, '') })} />
                    <button
                      className="btn-secundario min-h-10 px-3"
                      disabled={(pinNuevo[u.id] ?? '').length < 4}
                      onClick={() => guardar(() => api('PATCH', `/admin/usuarios/${u.id}`, { pin: pinNuevo[u.id] }), `PIN de ${u.nombre} restablecido`).then(() => setPinNuevo({ ...pinNuevo, [u.id]: '' }))}
                    >
                      Guardar
                    </button>
                  </div>
                </td>
                <td>
                  <input type="checkbox" className="h-5 w-5" checked={u.activo} disabled={u.id === miId} onChange={(e) => guardar(() => api('PATCH', `/admin/usuarios/${u.id}`, { activo: e.target.checked }), e.target.checked ? 'Usuario activado' : 'Usuario desactivado')} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-slate-500">Un usuario desactivado no se borra: su historial queda en ventas, turnos y bitácora.</p>
      </section>
      <section className="tarjeta space-y-2 p-4">
        <h3 className="font-bold">Nuevo usuario</h3>
        <input className="campo" placeholder="Nombre" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
        <select className="campo" value={nuevo.rol} onChange={(e) => setNuevo({ ...nuevo, rol: e.target.value as Rol })}>
          {ROLES.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
        <input className="campo" type="password" inputMode="numeric" maxLength={6} placeholder="PIN (4 a 6 números)" value={nuevo.pin} onChange={(e) => setNuevo({ ...nuevo, pin: e.target.value.replace(/\D/g, '') })} />
        {nuevo.rol === 'ADMINISTRADOR' && <input className="campo" type="password" placeholder="Contraseña (mín. 8 caracteres)" value={nuevo.password} onChange={(e) => setNuevo({ ...nuevo, password: e.target.value })} />}
        <button
          className="btn-primario w-full"
          disabled={!nuevo.nombre.trim() || nuevo.pin.length < 4}
          onClick={() => guardar(() => api('POST', '/admin/usuarios', nuevo), `Usuario ${nuevo.nombre} creado`).then(() => setNuevo({ nombre: '', rol: 'MOZO', pin: '', password: '' }))}
        >
          Crear usuario
        </button>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- Mesas (REQ-SAL-06)

function Mesas({ alAviso }: { alAviso: Avisar }) {
  const [lista, setLista] = useState<{ id: string; numero: string; capacidad: number; activa: boolean; estado: string }[]>([]);
  const [cap, setCap] = useState('4');
  const cargar = useCallback(() => api('GET', '/admin/mesas').then(setLista).catch((e) => alAviso({ texto: e.message, tipo: 'error' })), [alAviso]);
  useEffect(() => {
    cargar();
  }, [cargar]);
  const guardar = (fn: () => Promise<unknown>, ok: string) =>
    fn()
      .then(() => (alAviso({ texto: ok, tipo: 'ok' }), cargar()))
      .catch((e) => alAviso({ texto: e.message, tipo: 'error' }));
  return (
    <div className="space-y-4">
      <div className="tarjeta flex flex-wrap items-center gap-2 p-4">
        <span className="font-semibold">Nueva mesa con</span>
        <input className="campo w-20" inputMode="numeric" value={cap} onChange={(e) => setCap(e.target.value.replace(/\D/g, ''))} />
        <span>sillas</span>
        <button className="btn-primario" onClick={() => guardar(() => api('POST', '/admin/mesas', { capacidad: Number(cap) }), 'Mesa creada · imprime su QR en /qr')}>
          + Agregar mesa
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {lista.map((m) => (
          <div key={m.id} className={`tarjeta p-4 ${m.activa ? '' : 'opacity-50'}`}>
            <div className="text-2xl font-extrabold">{m.numero}</div>
            <div className="text-xs text-slate-500">{m.estado.toLowerCase().replace('_', ' ')}</div>
            <label className="mt-2 block text-xs font-semibold">
              Sillas
              <input className="campo mt-1 min-h-10" inputMode="numeric" defaultValue={m.capacidad} onBlur={(e) => Number(e.target.value) !== m.capacidad && guardar(() => api('PATCH', `/admin/mesas/${m.id}`, { capacidad: Number(e.target.value) }), 'Capacidad actualizada')} />
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={m.activa} onChange={(e) => guardar(() => api('PATCH', `/admin/mesas/${m.id}`, { activa: e.target.checked }), e.target.checked ? 'Mesa activada' : 'Mesa desactivada')} />
              En el plano
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Configuración

const ETIQUETA: Record<string, string> = {
  limite_egreso: 'Egreso máximo sin PIN (S/)',
  margen_arqueo: 'Margen de arqueo sin comentario (S/)',
  anticipacion_programados: 'Programados: minutos antes a cocina',
  umbral_presas: 'Agotar presa con menos de (cuartos)',
  minimo_pollos: 'Alerta de stock con menos de (pollos)',
  umbral_cola_cocina: 'Avisar demora con más de (comandas)',
  minutos_correccion: 'Minutos para corrección sin PIN',
  sin_internet: 'Simular caída de internet',
};

function Configuracion({ alAviso }: { alAviso: Avisar }) {
  const [lista, setLista] = useState<{ clave: string; valor: unknown; descripcion: string | null }[]>([]);
  const cargar = useCallback(() => api('GET', '/admin/config').then(setLista).catch((e) => alAviso({ texto: e.message, tipo: 'error' })), [alAviso]);
  useEffect(() => {
    cargar();
  }, [cargar]);
  const guardar = (clave: string, valor: unknown) =>
    api('PATCH', `/admin/config/${clave}`, { valor })
      .then(() => (alAviso({ texto: 'Configuración guardada', tipo: 'ok' }), cargar()))
      .catch((e) => alAviso({ texto: e.message, tipo: 'error' }));
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {lista.map((c) => (
        <div key={c.clave} className={`tarjeta p-4 ${c.clave === 'sin_internet' && c.valor === true ? 'border-amber-400 bg-amber-50' : ''}`}>
          <div className="font-bold">{ETIQUETA[c.clave] ?? c.clave}</div>
          <p className="mb-2 text-sm text-slate-500">{c.descripcion}</p>
          {typeof c.valor === 'boolean' ? (
            <button className={c.valor ? 'btn-rojo' : 'btn-secundario'} onClick={() => guardar(c.clave, !c.valor)}>
              {c.valor ? '🔌 Sin internet (modo local) · tocar para reconectar' : '🌐 Con internet · tocar para simular caída'}
            </button>
          ) : (
            <input className="campo max-w-[10rem]" inputMode="decimal" defaultValue={String(c.valor)} onBlur={(e) => e.target.value !== String(c.valor) && guardar(c.clave, Number(e.target.value))} />
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- Turnos (REQ-TUR-06)

interface TurnoFila { id: string; cajero: string; apertura: string; cierre: string | null; fondoInicial: number; declarado: number | null; diferencia: number | null; comentario: string | null }

function Turnos({ alAviso }: { alAviso: Avisar }) {
  const [lista, setLista] = useState<TurnoFila[]>([]);
  const [reporte, setReporte] = useState<{ r: Reporte; titulo: string } | null>(null);
  const [reabrir, setReabrir] = useState<TurnoFila | null>(null);
  const cargar = useCallback(() => api<TurnoFila[]>('GET', '/turnos').then(setLista).catch((e) => alAviso({ texto: e.message, tipo: 'error' })), [alAviso]);
  useEffect(() => {
    cargar();
  }, [cargar]);
  if (reporte) return <ReporteZ r={reporte.r} titulo={reporte.titulo} alSalir={() => setReporte(null)} />;
  return (
    <section className="tarjeta overflow-x-auto p-4">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="font-bold">Turnos de caja</h3>
        <button
          className="btn-secundario ml-auto"
          onClick={() =>
            api<Reporte>('GET', '/turnos/reporte-x')
              .then((r) => setReporte({ r, titulo: 'REPORTE X · CORTE PARCIAL' }))
              .catch((e) => alAviso({ texto: e.message, tipo: 'error' }))
          }
        >
          Reporte X (turno abierto)
        </button>
      </div>
      <table className="w-full min-w-[700px] text-sm">
        <thead className="text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="py-1">Cajero</th>
            <th>Apertura</th>
            <th>Cierre</th>
            <th className="text-right">Declarado</th>
            <th className="text-right">Diferencia</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {lista.map((t) => (
            <tr key={t.id} className="border-t border-slate-100">
              <td className="py-2">{t.cajero}</td>
              <td>{new Date(t.apertura).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}</td>
              <td>{t.cierre ? new Date(t.cierre).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }) : <b className="text-green-700">abierto</b>}</td>
              <td className="text-right">{t.declarado === null ? '' : soles(t.declarado)}</td>
              <td className={`text-right font-bold ${t.diferencia && Math.abs(t.diferencia) > 1 ? 'text-red-700' : ''}`}>{t.diferencia === null ? '' : soles(t.diferencia)}</td>
              <td className="text-right">
                <button className="rounded px-2 py-1 text-xs font-semibold text-brasa-700 hover:bg-brasa-50" onClick={() => api<Reporte>('GET', `/turnos/${t.id}/reporte`).then((r) => setReporte({ r, titulo: t.cierre ? 'REPORTE Z · CIERRE DE TURNO' : 'REPORTE X · CORTE PARCIAL' }))}>
                  Ver reporte
                </button>
                {t.cierre && (
                  <button className="rounded px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50" onClick={() => setReabrir(t)}>
                    Reabrir
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {reabrir && (
        <PedirPin
          titulo={`Reabrir turno de ${reabrir.cajero}`}
          descripcion="El cajero podrá seguir cobrando y volver a declarar el arqueo. Queda registrado en la bitácora."
          pedirMotivo={false}
          textoBoton="Reabrir"
          alCerrar={() => setReabrir(null)}
          alConfirmar={async (pinAdmin) => {
            await api('POST', `/turnos/${reabrir.id}/reabrir`, { pinAdmin });
            alAviso({ texto: 'Turno reabierto', tipo: 'ok' });
            cargar();
          }}
        />
      )}
    </section>
  );
}

// ---------------------------------------------------------------- Bitácora de solo lectura (REQ-REP-05)

function Bitacora() {
  const [filtro, setFiltro] = useState('');
  const [filas, setFilas] = useState<{ id: string; fecha: string; usuario: string; accion: string; entidad: string; antes: unknown; despues: unknown }[]>([]);
  useEffect(() => {
    const t = setTimeout(() => api('GET', `/admin/bitacora?limite=300${filtro ? `&accion=${encodeURIComponent(filtro)}` : ''}`).then(setFilas).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [filtro]);
  const json = (v: unknown) => (v ? JSON.stringify(v).replace(/[{}"]/g, '').replace(/,/g, ', ').replace(/:/g, ': ') : '');
  return (
    <section className="tarjeta overflow-x-auto p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="font-bold">Bitácora de auditoría</h3>
        <span className="text-sm text-slate-500">Solo lectura · nadie puede modificarla desde el sistema</span>
        <input className="campo ml-auto max-w-xs" placeholder="Filtrar acción (ej.: ANULAR, PRECIO, LOGIN)" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
      </div>
      <table className="w-full min-w-[800px] text-sm">
        <thead className="text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="py-1">Fecha</th>
            <th>Usuario</th>
            <th>Acción</th>
            <th>Antes</th>
            <th>Después</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.id} className="border-t border-slate-100 align-top">
              <td className="whitespace-nowrap py-1.5 pr-2">{new Date(f.fecha).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'medium' })}</td>
              <td className="pr-2">{f.usuario}</td>
              <td className="pr-2 font-mono text-xs font-bold">{f.accion}</td>
              <td className="max-w-[16rem] pr-2 text-xs text-slate-500">{json(f.antes)}</td>
              <td className="max-w-[22rem] text-xs text-slate-700">{json(f.despues)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
