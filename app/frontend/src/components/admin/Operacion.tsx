'use client';
import { Ico } from '@/components/Ico';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { hora, soles, useEventos } from '@/lib/util';
import { Hoja, HojaReclamacion } from '@/components/HojaReclamacion';

type Avisar = (a: { texto: string; tipo?: 'error' | 'ok' }) => void;
const fechaHora = (d: string | null) => (d ? new Date(d).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }) : '—');

// ---------------------------------------------------------------- SUNAT: cola, rechazos y resumen diario

interface Observado { id: string; numero: string; tipo: string; total: number; estado: string; mensaje: string | null; intentos: number; emitidoEn: string }
interface Resumen { identificador: string; fecha: string; cantidad: number; total: number; ticket: string | null; estado: string; mensaje: string | null; creadoEn: string }

/** Comprobantes pendientes o rechazados y resumen diario de boletas (REQ-FAC-05/08/09). */
export function Sunat({ alAviso }: { alAviso: Avisar }) {
  const [observados, setObservados] = useState<Observado[]>([]);
  const [resumenes, setResumenes] = useState<Resumen[]>([]);
  const [fecha, setFecha] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [trabajando, setTrabajando] = useState(false);
  const cargar = useCallback(() => {
    api<Observado[]>('GET', '/sunat/observados').then(setObservados).catch(() => {});
    api<Resumen[]>('GET', '/sunat/resumenes').then(setResumenes).catch(() => {});
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);
  useEventos({ 'estado:cambio': cargar });

  async function accion(fn: () => Promise<string>) {
    setTrabajando(true);
    try {
      alAviso({ texto: await fn(), tipo: 'ok' });
      cargar();
    } catch (e: any) {
      alAviso({ texto: e.message, tipo: 'error' });
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="tarjeta p-5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-bold">Comprobantes por enviar o rechazados</h2>
          <div className="flex-1" />
          <button className="btn-secundario min-h-10 px-3 text-sm" disabled={trabajando} onClick={() => accion(async () => `${(await api<{ enviados: number }>('POST', '/sunat/reenviar')).enviados} comprobante(s) aceptados`)}>
            <Ico n="repetir" /> Reenviar cola
          </button>
        </div>
        <p className="mb-3 text-sm text-slate-500">Sin internet, los comprobantes se guardan con su número y se envían solos cada 20 segundos al volver la conexión.</p>
        {observados.length === 0 ? (
          <p className="rounded-xl bg-green-50 p-4 font-semibold text-green-800">✓ Todos los comprobantes fueron aceptados por SUNAT.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th>Número</th>
                <th>Total</th>
                <th>Estado</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {observados.map((o) => (
                <tr key={o.id} className="border-t border-slate-100 align-top">
                  <td className="py-1 font-semibold">{o.numero}</td>
                  <td>{soles(o.total)}</td>
                  <td>
                    <span className={`rounded px-1.5 text-xs font-bold ${o.estado === 'RECHAZADO' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900'}`}>{o.estado === 'PENDIENTE' ? 'en cola' : 'rechazado'}</span>
                  </td>
                  <td className="text-xs text-slate-600">
                    {o.mensaje ?? '—'} · {o.intentos} intento(s) · {fechaHora(o.emitidoEn)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="tarjeta p-5">
        <h2 className="text-lg font-bold">Resumen diario de boletas</h2>
        <p className="mb-3 text-sm text-slate-500">Informa a SUNAT las boletas del día y las anuladas con nota de crédito. Se envía al cierre del día; SUNAT responde con un ticket.</p>
        <div className="mb-3 flex flex-wrap gap-2">
          <input type="date" className="campo max-w-[12rem]" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          <button
            className="btn-primario"
            disabled={trabajando}
            onClick={() =>
              accion(async () => {
                const r = await api<{ identificador: string; cantidad: number; estado: string }>('POST', `/sunat/resumen-diario?fecha=${fecha}`);
                return `${r.identificador}: ${r.cantidad} boleta(s) · ${r.estado.toLowerCase()}`;
              })
            }
          >
            Enviar resumen
          </button>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-500">
            <tr>
              <th>Identificador</th>
              <th>Día</th>
              <th>Boletas</th>
              <th>Total</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {resumenes.map((r) => (
              <tr key={r.identificador} className="border-t border-slate-100" title={r.mensaje ?? ''}>
                <td className="py-1 font-semibold">{r.identificador}</td>
                <td>{r.fecha}</td>
                <td>{r.cantidad}</td>
                <td>{soles(r.total)}</td>
                <td>
                  <span className={`rounded px-1.5 text-xs font-bold ${r.estado === 'ACEPTADO' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900'}`}>{r.estado.toLowerCase()}</span>
                </td>
              </tr>
            ))}
            {resumenes.length === 0 && (
              <tr>
                <td colSpan={5} className="py-2 text-slate-500">
                  Aún no se envió ningún resumen.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- Libro de Reclamaciones

interface Reclamo extends Hoja { respondidoPor: string | null; vencido: boolean }

/** Bandeja de reclamos y quejas con su plazo legal de respuesta. */
export function Reclamos({ alAviso }: { alAviso: Avisar }) {
  const [lista, setLista] = useState<Reclamo[]>([]);
  const [abierto, setAbierto] = useState<Reclamo | null>(null);
  const [respuesta, setRespuesta] = useState('');
  const cargar = useCallback(() => api<Reclamo[]>('GET', '/reclamos').then(setLista).catch((e) => alAviso({ texto: e.message, tipo: 'error' })), [alAviso]);
  useEffect(() => {
    cargar();
  }, [cargar]);
  useEventos({ alerta: (a) => a.tipo === 'RECLAMO' && cargar() });

  const pendientes = lista.filter((r) => r.estado === 'PENDIENTE').length;
  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <section className="tarjeta p-4">
        <h2 className="text-lg font-bold">Hojas de reclamación</h2>
        <p className="mb-3 text-sm text-slate-500">
          {pendientes} pendiente(s). Formulario público en{' '}
          <a className="text-blue-700 underline" href="/reclamaciones" target="_blank">
            /reclamaciones
          </a>
          .
        </p>
        <div className="space-y-2">
          {lista.length === 0 && <p className="text-slate-500">No hay reclamos registrados.</p>}
          {lista.map((r) => (
            <button
              key={r.id}
              className={`w-full rounded-xl border-2 p-3 text-left ${abierto?.id === r.id ? 'border-slate-900' : 'border-slate-200'} ${r.vencido ? 'bg-red-50' : 'bg-white'}`}
              onClick={() => (setAbierto(r), setRespuesta(''))}
            >
              <div className="flex justify-between gap-2">
                <b>{r.codigo}</b>
                <span className={`rounded px-1.5 text-xs font-bold ${r.estado === 'RESPONDIDO' ? 'bg-green-100 text-green-800' : r.vencido ? 'bg-red-200 text-red-900' : 'bg-amber-100 text-amber-900'}`}>
                  {r.estado === 'RESPONDIDO' ? 'respondido' : r.vencido ? 'plazo vencido' : `vence ${new Date(r.plazo).toLocaleDateString('es-PE')}`}
                </span>
              </div>
              <div className="text-sm">
                {r.tipo === 'QUEJA' ? 'Queja' : 'Reclamo'} · {r.consumidor.nombre}
              </div>
              <div className="truncate text-xs text-slate-500">{r.descripcion}</div>
            </button>
          ))}
        </div>
      </section>
      <section className="space-y-3">
        {abierto ? (
          <>
            <HojaReclamacion h={abierto} />
            {abierto.estado === 'PENDIENTE' && (
              <div className="tarjeta p-4">
                <label className="mb-1 block font-semibold">Respuesta al consumidor</label>
                <textarea className="campo min-h-28" value={respuesta} onChange={(e) => setRespuesta(e.target.value)} placeholder="Explica lo que se hizo o lo que se ofrece al cliente." />
                <button
                  className="btn-primario mt-2"
                  onClick={() =>
                    api<Reclamo>('POST', `/reclamos/${abierto.id}/responder`, { respuesta })
                      .then((h) => {
                        alAviso({ texto: `Respuesta enviada${abierto.consumidor.celular ? ' por WhatsApp' : ''}`, tipo: 'ok' });
                        setAbierto({ ...abierto, ...h });
                        cargar();
                      })
                      .catch((e) => alAviso({ texto: e.message, tipo: 'error' }))
                  }
                >
                  Responder
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="tarjeta grid place-items-center p-10 text-slate-500">Elige una hoja para verla y responderla.</div>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- Estado del sistema (monitoreo)

interface Detalle {
  ok: boolean;
  db: boolean;
  latenciaDbMs: number;
  version: string;
  activoDesde: string;
  entorno: string;
  sinInternet: boolean;
  memoriaMb: number;
  baseDeDatos: string;
  sunat: { pendientes: number; rechazados: number; ose: string; padron: string };
  pasarela: { nombre: string; simulado: boolean };
  impresoras: { cocina: { tipo: string; ip: string | null }; caja: { tipo: string; ip: string | null }; errores24h: number; pendientes: number };
  whatsapp: { proveedor: string; simulado: boolean; enCola: number; fallidos: number; enviados24h: number };
  nube: { url: string; pendientes: number; pendienteDesde: string | null; ultimoEnvio: string | null; ultimoError: string | null };
  errores24h: number;
  ultimosErrores: { id: number; metodo: string; ruta: string; mensaje: string; fecha: string }[];
}
interface Nube { eventos: number; ultimaRecepcion: string | null; ventasPorDia: { dia: string; comprobantes: number; total: number }[] }

function Indicador({ titulo, ok, valor, detalle }: { titulo: string; ok: boolean | 'aviso'; valor: string; detalle?: string }) {
  const color = ok === true ? 'border-green-500' : ok === 'aviso' ? 'border-amber-400' : 'border-red-500';
  return (
    <div className={`tarjeta border-l-8 p-4 ${color}`}>
      <div className="text-sm font-semibold text-slate-500">{titulo}</div>
      <div className="text-xl font-extrabold">{valor}</div>
      {detalle && <div className="text-xs text-slate-500">{detalle}</div>}
    </div>
  );
}

/** Salud del servidor, colas pendientes (SUNAT, WhatsApp, impresoras, nube) y errores registrados. */
export function Sistema() {
  const [d, setD] = useState<Detalle | null>(null);
  const [nube, setNube] = useState<Nube | null>(null);
  const [error, setError] = useState('');
  const cargar = useCallback(() => {
    api<Detalle>('GET', '/admin/sistema')
      .then((x) => (setD(x), setError('')))
      .catch((e) => setError(e.message));
    api<Nube>('GET', '/nube/resumen').then(setNube).catch(() => {});
  }, []);
  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 10_000);
    return () => clearInterval(t);
  }, [cargar]);

  if (error) return <p className="rounded-xl bg-red-100 p-4 font-semibold text-red-800"><Ico n="alerta" /> El servidor no responde: {error}</p>;
  if (!d) return <p className="text-slate-500">Cargando…</p>;
  const horas = Math.floor((Date.now() - new Date(d.activoDesde).getTime()) / 3_600_000);
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador titulo="Servidor y base de datos" ok={d.ok} valor={d.ok ? 'Funcionando' : 'Base de datos caída'} detalle={`v${d.version} · ${d.entorno} · activo hace ${horas} h · BD ${d.latenciaDbMs} ms · ${d.baseDeDatos} · ${d.memoriaMb} MB RAM`} />
        <Indicador titulo="Internet" ok={d.sinInternet ? 'aviso' : true} valor={d.sinInternet ? 'Modo local (simulado)' : 'Conectado'} detalle="Se cambia en Configuración" />
        <Indicador
          titulo={`SUNAT · ${d.sunat.ose}`}
          ok={d.sunat.rechazados ? false : d.sunat.pendientes ? 'aviso' : true}
          valor={`${d.sunat.pendientes} en cola · ${d.sunat.rechazados} rechazados`}
          detalle={`Consulta DNI/RUC: ${d.sunat.padron}`}
        />
        <Indicador titulo="Errores del servidor (24 h)" ok={d.errores24h === 0 ? true : d.errores24h < 5 ? 'aviso' : false} valor={String(d.errores24h)} />
        <Indicador
          titulo="Sincronización con la nube"
          ok={d.nube.ultimoError ? false : d.nube.pendientes > 50 ? 'aviso' : true}
          valor={`${d.nube.pendientes} por subir`}
          detalle={d.nube.ultimoError ? `Error: ${d.nube.ultimoError}` : `Último envío: ${d.nube.ultimoEnvio ? hora(d.nube.ultimoEnvio) : 'aún no'}`}
        />
        <Indicador
          titulo={`WhatsApp · ${d.whatsapp.proveedor}`}
          ok={d.whatsapp.fallidos ? 'aviso' : true}
          valor={`${d.whatsapp.enviados24h} enviados hoy`}
          detalle={`${d.whatsapp.enCola} en cola · ${d.whatsapp.fallidos} fallidos`}
        />
        <Indicador
          titulo="Impresoras"
          ok={d.impresoras.errores24h ? 'aviso' : true}
          valor={`${d.impresoras.errores24h} errores hoy`}
          detalle={`Cocina: ${d.impresoras.cocina.ip ?? 'virtual'} · Caja: ${d.impresoras.caja.ip ?? 'virtual'}`}
        />
        <Indicador titulo="Pasarela de pagos" ok valor={d.pasarela.simulado ? 'Simulada' : 'Conectada'} detalle={d.pasarela.nombre} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="tarjeta p-5">
          <h2 className="text-lg font-bold"><Ico n="nube" /> Lo que ya está en la nube</h2>
          <p className="mb-3 text-sm text-slate-500">
            El dueño ve estas ventas aunque no esté en el local. {nube ? `${nube.eventos} eventos recibidos · última recepción ${nube.ultimaRecepcion ? fechaHora(nube.ultimaRecepcion) : 'ninguna'}.` : ''}
          </p>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th>Día</th>
                <th>Comprobantes</th>
                <th>Ventas netas</th>
              </tr>
            </thead>
            <tbody>
              {nube?.ventasPorDia.map((v) => (
                <tr key={v.dia} className="border-t border-slate-100">
                  <td className="py-1">{v.dia}</td>
                  <td>{v.comprobantes}</td>
                  <td className="font-semibold">{soles(v.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="tarjeta p-5">
          <h2 className="text-lg font-bold">Últimos errores</h2>
          <p className="mb-3 text-sm text-slate-500">Errores inesperados del servidor, con la ruta donde ocurrieron.</p>
          {d.ultimosErrores.length === 0 ? (
            <p className="rounded-xl bg-green-50 p-4 font-semibold text-green-800">✓ Sin errores registrados.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {d.ultimosErrores.map((e) => (
                <li key={e.id} className="rounded-lg bg-red-50 p-2">
                  <div className="font-mono text-xs text-slate-500">
                    {fechaHora(e.fecha)} · {e.metodo} {e.ruta}
                  </div>
                  <div className="font-semibold text-red-800">{e.mensaje}</div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-slate-500">
            Chequeo para servicios de monitoreo: <code>/api/salud</code> (responde 503 si la base de datos no responde).
          </p>
        </section>
      </div>
    </div>
  );
}
