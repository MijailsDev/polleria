'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api, ErrorApi } from '@/lib/api';
import { guardarSesion, Rol, Sesion } from '@/lib/sesion';
import { EquipoGuardado, leerEquipo, tipoEquipo } from '@/lib/equipo';
import { EquipoNoVinculado } from '@/components/EquipoNoVinculado';
import { Logo } from '@/components/Logo';
import { Foto } from '@/components/Foto';
import { Ico, NombreIcono } from '@/components/Ico';
import { foto, FOTOS } from '@/lib/imagenes';

interface Usuario { id: string; nombre: string; rol: Rol }
type Respuesta = Sesion | { requiere2fa: true };
const ROL: Record<Rol, { texto: string; icono: NombreIcono; color: string }> = {
  MOZO: { texto: 'Mozo', icono: 'mesa', color: 'bg-brasa-100 text-brasa-800' },
  CAJERO: { texto: 'Caja', icono: 'billete', color: 'bg-green-100 text-green-800' },
  REPARTIDOR: { texto: 'Reparto', icono: 'moto', color: 'bg-sky-100 text-sky-800' },
  ADMINISTRADOR: { texto: 'Administrador', icono: 'escudo', color: 'bg-slate-900 text-white' },
};
const iniciales = (n: string) => n.split(/\s+/).filter((p) => /^[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(p)).slice(0, 2).map((p) => p[0].toUpperCase()).join('');
const DESTINO: Record<Rol, string> = { MOZO: '/mozo', CAJERO: '/caja', ADMINISTRADOR: '/admin', REPARTIDOR: '/reparto' };

/** Campo para el código de 6 dígitos de la app autenticadora (Google o Microsoft Authenticator). */
function Codigo2fa({ valor, cambiar, alEnviar }: { valor: string; cambiar: (v: string) => void; alEnviar: () => void }) {
  return (
    <div className="mb-3 rounded-xl border border-brasa-200 bg-brasa-50 p-3 animar-entrada">
      <label className="mb-1 block text-sm font-semibold text-brasa-800">Código de tu app autenticadora</label>
      <input
        className="campo text-center font-mono text-2xl tracking-[0.4em]"
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        maxLength={6}
        placeholder="000000"
        value={valor}
        onChange={(e) => cambiar(e.target.value.replace(/\D/g, ''))}
        onKeyDown={(e) => e.key === 'Enter' && valor.length === 6 && alEnviar()}
      />
      <p className="mt-1 text-xs text-slate-600">Ábrela en tu celular: cambia cada 30 segundos.</p>
    </div>
  );
}

function Ingreso() {
  const router = useRouter();
  const params = useSearchParams();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [equipo, setEquipo] = useState<EquipoGuardado | null>(null);
  const [bloqueado, setBloqueado] = useState(false);
  const [modoAdmin, setModoAdmin] = useState(params.get('admin') === '1');
  const [elegido, setElegido] = useState<Usuario | null>(null);
  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [pide2fa, setPide2fa] = useState(false);
  const [error, setError] = useState(params.get('permiso') === '0' ? 'Tu rol no tiene acceso a esa pantalla.' : '');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    setEquipo(leerEquipo());
    api<Usuario[]>('GET', '/auth/usuarios')
      .then(setUsuarios)
      .catch((e: ErrorApi) => (e.codigo === 'EQUIPO_NO_VINCULADO' ? setBloqueado(true) : setError(e.message)));
  }, []);

  function terminar(r: Respuesta, pinUsado: string) {
    if ('requiere2fa' in r) {
      setPide2fa(true);
      setPin(pinUsado);
      return;
    }
    guardarSesion(r);
    router.replace(params.get('volver') || DESTINO[r.usuario.rol]);
  }

  async function ingresar(valor: string) {
    if (!elegido) return;
    setCargando(true);
    setError('');
    try {
      const esAdmin = elegido.rol === 'ADMINISTRADOR';
      const r = await api<Respuesta>('POST', '/auth/login', { usuarioId: elegido.id, pin: valor, password: esAdmin ? password : undefined, codigo: pide2fa ? codigo : undefined });
      terminar(r, valor);
    } catch (e: any) {
      setError(e.message);
      if (!pide2fa) setPin('');
      setCodigo('');
    } finally {
      setCargando(false);
    }
  }

  async function ingresarAdmin() {
    setCargando(true);
    setError('');
    try {
      terminar(await api<Respuesta>('POST', '/auth/login-admin', { nombre, password, pin, codigo: pide2fa ? codigo : undefined }), pin);
    } catch (e: any) {
      setError(e.message);
      setCodigo('');
    } finally {
      setCargando(false);
    }
  }

  function tecla(t: string) {
    if (cargando) return;
    if (t === '⌫') return setPin((p) => p.slice(0, -1));
    if (t === 'OK') return pin.length >= 4 && ingresar(pin);
    if (pin.length < 6) setPin((p) => p + t);
  }

  function volver() {
    setElegido(null);
    setPin('');
    setPassword('');
    setCodigo('');
    setPide2fa(false);
    setError('');
  }

  // Equipo no vinculado: no se muestra ningún nombre del personal
  if (bloqueado && !modoAdmin) return <EquipoNoVinculado alAdmin={() => setModoAdmin(true)} />;

  return (
    <div className="alto-pantalla grid lg:grid-cols-[1.1fr_1fr]">
      {/* Panel con foto: solo en pantallas anchas (caja, laptop, tablet apaisada) */}
      <aside className="relative isolate hidden overflow-hidden bg-brasa-950 text-white lg:block">
        <Foto src={foto(FOTOS.polloAsador, 1200, 1400)} prioridad className="absolute inset-0 -z-10 h-full w-full" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/85 via-black/40 to-black/60" />
        <div className="flex h-full flex-col justify-between p-10">
          <Logo claro />
          <div>
            <h2 className="font-titulo text-6xl uppercase leading-[0.95] tracking-wide">
              Buen turno, <span className="text-amber-300">equipo</span>
            </h2>
            <p className="mt-4 max-w-md text-lg text-white/90">Mesas, comandas, caja y delivery en un solo lugar.</p>
          </div>
        </div>
      </aside>

    <main className="mx-auto flex w-full max-w-md flex-col justify-center px-4 py-8">
      <Link href="/" className="mx-auto mb-5 lg:hidden">
        <Logo />
      </Link>
      {equipo && (
        <p className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full bg-green-100 px-4 py-1.5 text-sm font-semibold text-green-800">
          <Ico n="escudo" /> {equipo.equipo.nombre} · equipo vinculado
        </p>
      )}

      {modoAdmin ? (
        <div className="tarjeta p-6 animar-entrada">
          <button className="-ml-2 mb-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-slate-600 hover:bg-slate-100" onClick={() => (setModoAdmin(false), volver())}>
            <Ico n="atras" /> Volver
          </button>
          <h1 className="text-xl font-bold">Ingreso del administrador</h1>
          <p className="mb-4 text-sm text-slate-600">Desde un equipo no vinculado. Te avisaremos por WhatsApp de este ingreso.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ingresarAdmin();
            }}
          >
            <input className="campo mb-3" placeholder="Nombre de usuario" autoComplete="username" value={nombre} onChange={(e) => setNombre(e.target.value)} disabled={pide2fa} />
            <input className="campo mb-3" type="password" placeholder="Contraseña" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={pide2fa} />
            <input
              className="campo mb-3"
              type="password"
              inputMode="numeric"
              placeholder="PIN"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              disabled={pide2fa}
            />
            {pide2fa && <Codigo2fa valor={codigo} cambiar={setCodigo} alEnviar={ingresarAdmin} />}
            <button className="btn-primario w-full" disabled={cargando || !nombre || !password || pin.length < 4 || (pide2fa && codigo.length !== 6)}>
              {cargando ? 'Verificando…' : pide2fa ? 'Verificar' : 'Ingresar'}
            </button>
          </form>
          {error && <p className="mt-4 text-center font-semibold text-red-600">{error}</p>}
        </div>
      ) : !elegido ? (
        <div className="tarjeta p-6">
          <h1 className="text-2xl font-bold">¿Quién eres?</h1>
          <p className="mb-4 text-slate-600">Toca tu nombre para ingresar con tu PIN.</p>
          <div className="grid gap-2.5">
            {usuarios.map((u) => (
              <button
                key={u.id}
                className="flex min-h-16 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-brasa-500 hover:bg-brasa-50 active:scale-[0.99]"
                onClick={() => setElegido(u)}
              >
                <span aria-hidden className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-base font-bold ${ROL[u.rol].color}`}>
                  {iniciales(u.nombre) || <Ico n="persona" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold text-slate-900">{u.nombre}</span>
                  <span className="flex items-center gap-1.5 text-sm text-slate-600">
                    <Ico n={ROL[u.rol].icono} /> {ROL[u.rol].texto}
                  </span>
                </span>
                <Ico n="atras" className="rotate-180 text-slate-400" />
              </button>
            ))}
          </div>
          {error && <p className="mt-4 font-semibold text-red-600">{error}</p>}
          {equipo && (
            <Link href="/vincular" className="mt-5 block text-center text-xs text-slate-500 underline">
              Datos de la vinculación de este equipo
            </Link>
          )}
        </div>
      ) : (
        <div className="tarjeta p-6 animar-entrada">
          <button className="-ml-2 mb-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-slate-600 hover:bg-slate-100" onClick={volver}>
            <Ico n="atras" /> Cambiar usuario
          </button>
          <div className="mb-4 flex items-center gap-3">
            <span aria-hidden className={`grid h-12 w-12 shrink-0 place-items-center rounded-full text-lg font-bold ${ROL[elegido.rol].color}`}>
              {iniciales(elegido.nombre) || <Ico n="persona" />}
            </span>
            <div>
              <h1 className="text-xl font-bold leading-tight">{elegido.nombre}</h1>
              <p className="text-sm text-slate-600">{ROL[elegido.rol].texto}</p>
            </div>
          </div>
          {elegido.rol === 'ADMINISTRADOR' && (
            <input className="campo mb-3" type="password" placeholder="Contraseña del administrador" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" disabled={pide2fa} />
          )}
          {pide2fa ? (
            <>
              <Codigo2fa valor={codigo} cambiar={setCodigo} alEnviar={() => ingresar(pin)} />
              <button className="btn-primario w-full" disabled={cargando || codigo.length !== 6} onClick={() => ingresar(pin)}>
                {cargando ? 'Verificando…' : 'Verificar'}
              </button>
            </>
          ) : (
            <>
              <p className="mb-3 text-center font-medium text-slate-600">Ingresa tu PIN</p>
              <div className="mb-5 flex justify-center gap-3" role="status" aria-label={`${pin.length} dígitos ingresados`}>
                {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
                  <span key={i} className={`h-4 w-4 rounded-full transition ${i < pin.length ? 'scale-110 bg-brasa-700' : 'bg-slate-200'}`} />
                ))}
              </div>
              <div className="mx-auto grid max-w-72 grid-cols-3 gap-3">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK'].map((t) => (
                  <button
                    key={t}
                    aria-label={t === '⌫' ? 'Borrar' : t === 'OK' ? 'Ingresar' : t}
                    className={`grid h-16 place-items-center rounded-2xl text-2xl font-semibold transition active:scale-95 disabled:opacity-50 ${
                      t === 'OK' ? 'bg-brasa-700 text-white shadow-sm hover:bg-brasa-800' : t === '⌫' ? 'bg-white text-slate-600 hover:bg-slate-100' : 'border border-slate-200 bg-white hover:border-brasa-500 hover:bg-brasa-50'
                    }`}
                    onClick={() => tecla(t)}
                    disabled={cargando || (t === 'OK' && pin.length < 4)}
                  >
                    {t === '⌫' ? <Ico n="borrar" /> : t === 'OK' ? <Ico n="check" /> : t}
                  </button>
                ))}
              </div>
            </>
          )}
          {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-center font-semibold text-red-700">{error}</p>}
        </div>
      )}
    </main>
    </div>
  );
}

export default function PaginaLogin() {
  return (
    <Suspense>
      <Ingreso />
    </Suspense>
  );
}
