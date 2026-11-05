'use client';
import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '@/lib/api';
import { hora, useEventos } from '@/lib/util';
import { leerEquipo, TIPOS_EQUIPO, TipoEquipo, tipoEquipo } from '@/lib/equipo';

type Avisar = (a: { texto: string; tipo?: 'error' | 'ok' }) => void;
interface Equipo {
  id: string;
  nombre: string;
  tipo: TipoEquipo;
  activo: boolean;
  estado: 'VINCULADO' | 'ESPERANDO_CODIGO' | 'CODIGO_VENCIDO' | 'DESVINCULADO';
  vinculadoEn: string | null;
  ultimoUso: string | null;
  ultimaIp: string | null;
}
interface Intento { tipo: string; ultimos10min: number; umbral: number }
interface Codigo { id: string; nombre: string; tipo: TipoEquipo; codigo: string; vence: string }
interface AlertaSeg { tipo: string; texto: string; hora: string }

const fecha = (d: string | null) => (d ? new Date(d).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const ESTADO: Record<Equipo['estado'], [string, string]> = {
  VINCULADO: ['Vinculado', 'bg-green-100 text-green-800'],
  ESPERANDO_CODIGO: ['Esperando código', 'bg-amber-100 text-amber-900'],
  CODIGO_VENCIDO: ['Código vencido', 'bg-slate-200 text-slate-700'],
  DESVINCULADO: ['Desvinculado', 'bg-red-100 text-red-800'],
};
const INTENTO: Record<string, string> = {
  PIN_FALLIDO: 'PIN incorrectos',
  EQUIPO_NO_VINCULADO: 'Intentos desde equipos no vinculados',
  CODIGO_EQUIPO: 'Códigos de vinculación incorrectos',
  ADMIN_FALLIDO: 'Ingresos fallidos del administrador',
};

/** Código de vinculación recién generado, con QR para escanearlo desde el equipo nuevo. */
function VentanaCodigo({ c, alCerrar }: { c: Codigo; alCerrar: () => void }) {
  const [qr, setQr] = useState('');
  const [resta, setResta] = useState(0);
  useEffect(() => {
    QRCode.toDataURL(`${window.location.origin}/vincular?codigo=${c.codigo}`, { margin: 1, width: 220 }).then(setQr);
    const t = setInterval(() => setResta(Math.max(0, new Date(c.vence).getTime() - Date.now())), 1000);
    setResta(Math.max(0, new Date(c.vence).getTime() - Date.now()));
    return () => clearInterval(t);
  }, [c]);
  const min = Math.floor(resta / 60000);
  const seg = Math.floor((resta % 60000) / 1000);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={alCerrar}>
      <div className="tarjeta w-full max-w-sm p-6 text-center animar-entrada" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm font-semibold text-slate-600">
          {tipoEquipo(c.tipo).icono} {c.nombre}
        </div>
        <h2 className="mt-1 text-lg font-bold">Código de vinculación</h2>
        <div className="my-3 rounded-xl bg-slate-900 py-3 font-mono text-4xl font-black tracking-widest text-white">{c.codigo}</div>
        {qr && <img src={qr} alt="QR para vincular" className="mx-auto h-44 w-44" />}
        <p className="mt-2 text-sm text-slate-600">
          En el equipo nuevo abre <b>/vincular</b> y escribe el código, o escanea este QR con su cámara. Sirve una sola vez.
        </p>
        <p className={`mt-2 font-bold ${resta ? 'text-brasa-700' : 'text-red-600'}`}>{resta ? `Vence en ${min}:${String(seg).padStart(2, '0')}` : 'Venció: genera uno nuevo'}</p>
        <button className="btn-secundario mt-4 w-full" onClick={alCerrar}>
          Listo
        </button>
      </div>
    </div>
  );
}

/** Verificación en dos pasos del administrador con Google o Microsoft Authenticator. */
function DosPasos({ alAviso }: { alAviso: Avisar }) {
  const [activo, setActivo] = useState<boolean | null>(null);
  const [alta, setAlta] = useState<{ secreto: string; qr: string } | null>(null);
  const [codigo, setCodigo] = useState('');
  const cargar = useCallback(() => api<{ activo: boolean }>('GET', '/admin/2fa').then((r) => setActivo(r.activo)), []);
  useEffect(() => {
    cargar().catch(() => {});
  }, [cargar]);

  async function iniciar() {
    try {
      const r = await api<{ secreto: string; enlace: string }>('POST', '/admin/2fa/iniciar');
      setAlta({ secreto: r.secreto, qr: await QRCode.toDataURL(r.enlace, { margin: 1, width: 220 }) });
    } catch (e: any) {
      alAviso({ texto: e.message, tipo: 'error' });
    }
  }
  async function confirmar(ruta: 'activar' | 'desactivar') {
    try {
      await api('POST', `/admin/2fa/${ruta}`, { codigo });
      alAviso({ texto: ruta === 'activar' ? 'Verificación en dos pasos activada' : 'Verificación en dos pasos desactivada', tipo: 'ok' });
      setAlta(null);
      setCodigo('');
      cargar();
    } catch (e: any) {
      alAviso({ texto: e.message, tipo: 'error' });
    }
  }
  const campo = (
    <input
      className="campo w-40 text-center font-mono text-xl tracking-[0.3em]"
      inputMode="numeric"
      maxLength={6}
      placeholder="000000"
      value={codigo}
      onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
    />
  );

  return (
    <section className="tarjeta p-5">
      <h2 className="text-lg font-bold">🔐 Verificación en dos pasos (tu cuenta)</h2>
      <p className="mt-1 text-sm text-slate-600">
        Además de tu contraseña y PIN, al ingresar te pedirá el código de 6 dígitos de una app autenticadora gratuita (Google Authenticator o Microsoft Authenticator). Si alguien roba tu contraseña, igual no puede entrar sin tu celular.
      </p>
      {activo === null ? null : activo ? (
        <div className="mt-4">
          <p className="rounded-xl bg-green-50 p-3 font-semibold text-green-800">✓ Activa: se pide el código en cada ingreso.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {campo}
            <button className="btn-secundario text-red-700" disabled={codigo.length !== 6} onClick={() => confirmar('desactivar')}>
              Desactivar
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">Para desactivarla escribe el código actual de tu app.</p>
        </div>
      ) : !alta ? (
        <button className="btn-primario mt-4" onClick={iniciar}>
          Activar verificación en dos pasos
        </button>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr]">
          <img src={alta.qr} alt="QR para la app autenticadora" className="h-44 w-44 rounded-xl border border-slate-200" />
          <div>
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              <li>Instala Google Authenticator o Microsoft Authenticator en tu celular.</li>
              <li>Toca «+» → «Escanear código QR» y escanea este código.</li>
              <li>Escribe aquí los 6 dígitos que aparecen para confirmar.</li>
            </ol>
            <p className="mt-2 text-xs text-slate-500">
              ¿No puedes escanear? Escribe esta clave en la app: <span className="break-all font-mono font-bold">{alta.secreto}</span>
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {campo}
              <button className="btn-primario" disabled={codigo.length !== 6} onClick={() => confirmar('activar')}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/** Equipos vinculados, intentos sospechosos y verificación en dos pasos. */
export function Seguridad({ alAviso }: { alAviso: Avisar }) {
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [exige, setExige] = useState(false);
  const [intentos, setIntentos] = useState<Intento[]>([]);
  const [alertas, setAlertas] = useState<AlertaSeg[]>([]);
  const [nuevo, setNuevo] = useState<{ nombre: string; tipo: TipoEquipo }>({ nombre: '', tipo: 'SALON' });
  const [codigo, setCodigo] = useState<Codigo | null>(null);
  const [esteEquipo, setEsteEquipo] = useState<string | null>(null);

  const cargar = useCallback(
    () =>
      api<{ equipos: Equipo[]; exige: boolean; intentos: Intento[] }>('GET', '/admin/equipos')
        .then((r) => (setEquipos(r.equipos), setExige(r.exige), setIntentos(r.intentos)))
        .catch((e) => alAviso({ texto: e.message, tipo: 'error' })),
    [alAviso],
  );
  useEffect(() => {
    cargar();
    setEsteEquipo(leerEquipo()?.equipo.id ?? null);
  }, [cargar]);
  useEventos({ 'seguridad:alerta': (a: AlertaSeg) => (setAlertas((l) => [a, ...l].slice(0, 10)), cargar()) }, [cargar]);

  async function accion(fn: () => Promise<unknown>, ok?: string) {
    try {
      const r = await fn();
      if (r && typeof r === 'object' && 'codigo' in r) setCodigo(r as Codigo);
      if (ok) alAviso({ texto: ok, tipo: 'ok' });
      cargar();
    } catch (e: any) {
      alAviso({ texto: e.message, tipo: 'error' });
    }
  }

  const vinculados = equipos.filter((e) => e.estado === 'VINCULADO').length;

  return (
    <div className="grid gap-4 xl:grid-cols-[3fr_2fr]">
      <div className="space-y-4">
        <section className={`rounded-2xl border p-4 ${exige ? 'border-green-300 bg-green-50' : 'border-amber-300 bg-amber-50'}`}>
          {exige ? (
            <p className="font-semibold text-green-900">🔒 Solo los equipos vinculados ven al personal e ingresan con PIN. Desde cualquier otro equipo solo entra el administrador, con contraseña.</p>
          ) : (
            <>
              <p className="font-semibold text-amber-900">⚠ Modo abierto: cualquier equipo puede ver la lista del personal e intentar un PIN.</p>
              <p className="mt-1 text-sm text-amber-900">
                En la nube (producción) siempre se exige. Vincula primero este equipo y los demás, y luego actívalo.
                {vinculados === 0 && ' Aún no hay equipos vinculados.'}
              </p>
            </>
          )}
          <button
            className={`${exige ? 'btn-secundario' : 'btn-primario'} mt-3 min-h-10`}
            onClick={() => accion(() => api('PATCH', '/admin/config/exigir_equipo_vinculado', { valor: !exige }), exige ? 'Modo abierto (solo en desarrollo)' : 'Ahora solo entran los equipos vinculados')}
          >
            {exige ? 'Volver al modo abierto' : 'Exigir equipos vinculados'}
          </button>
        </section>

        <section className="tarjeta p-5">
          <h2 className="text-lg font-bold">🔗 Equipos vinculados</h2>
          <p className="mt-1 text-sm text-slate-600">Cada tablet, caja, pantalla de cocina o celular de reparto se autoriza una vez con un código de un solo uso. Si se pierde o lo roban, desvincúlalo y sus sesiones se cierran al instante.</p>
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <label className="min-w-48 flex-1">
              <span className="text-xs font-semibold text-slate-600">Nombre</span>
              <input className="campo" placeholder="Ej.: Tablet salón 1" value={nuevo.nombre} maxLength={60} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
            </label>
            <label>
              <span className="text-xs font-semibold text-slate-600">Tipo</span>
              <select className="campo" value={nuevo.tipo} onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value as TipoEquipo })}>
                {TIPOS_EQUIPO.map((t) => (
                  <option key={t.tipo} value={t.tipo}>
                    {t.icono} {t.nombre} · {t.quien}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="btn-primario"
              disabled={nuevo.nombre.trim().length < 2}
              onClick={() => accion(() => api('POST', '/admin/equipos', nuevo)).then(() => setNuevo({ nombre: '', tipo: nuevo.tipo }))}
            >
              Generar código
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {equipos.length === 0 && <p className="text-slate-500">Todavía no hay equipos.</p>}
            {equipos.map((e) => (
              <div key={e.id} className={`flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-3 ${e.activo ? '' : 'opacity-60'}`}>
                <div className="text-2xl">{tipoEquipo(e.tipo).icono}</div>
                <div className="min-w-40 flex-1">
                  <div className="font-bold">
                    {e.nombre} {esteEquipo === e.id && <span className="ml-1 rounded-full bg-slate-900 px-2 py-0.5 text-xs text-white">este equipo</span>}
                  </div>
                  <div className="text-xs text-slate-600">
                    {tipoEquipo(e.tipo).nombre} · último uso {fecha(e.ultimoUso)}
                    {e.ultimaIp ? ` · ${e.ultimaIp}` : ''}
                  </div>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${ESTADO[e.estado][1]}`}>{ESTADO[e.estado][0]}</span>
                <button className="btn-secundario min-h-10 px-3 text-sm" onClick={() => accion(() => api('POST', `/admin/equipos/${e.id}/codigo`))}>
                  {e.estado === 'VINCULADO' ? 'Volver a vincular' : 'Nuevo código'}
                </button>
                {e.activo && (
                  <button
                    className="btn-secundario min-h-10 px-3 text-sm text-red-700"
                    onClick={() => confirm(`¿Desvincular «${e.nombre}»? Sus sesiones se cerrarán y necesitará un código nuevo.`) && accion(() => api('POST', `/admin/equipos/${e.id}/desvincular`), `«${e.nombre}» desvinculado`)}
                  >
                    Desvincular
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="space-y-4">
        <DosPasos alAviso={alAviso} />
        <section className="tarjeta p-5">
          <h2 className="text-lg font-bold">🚨 Intentos sospechosos (últimos 10 min)</h2>
          <p className="mt-1 text-sm text-slate-600">Al pasar el límite te llega un WhatsApp al celular del dueño (Configuración → celular_dueno) y queda en la bitácora.</p>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {intentos.map((i) => (
                <tr key={i.tipo} className="border-t border-slate-100">
                  <td className="py-2">{INTENTO[i.tipo] ?? i.tipo}</td>
                  <td className={`py-2 text-right font-bold ${i.ultimos10min >= i.umbral ? 'text-red-600' : ''}`}>
                    {i.ultimos10min} / {i.umbral}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {alertas.length > 0 && (
            <ul className="mt-3 space-y-2">
              {alertas.map((a, k) => (
                <li key={k} className="rounded-xl bg-red-50 p-3 text-sm text-red-900">
                  <b>{hora(a.hora)}</b> · {a.texto}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {codigo && <VentanaCodigo c={codigo} alCerrar={() => setCodigo(null)} />}
    </div>
  );
}
