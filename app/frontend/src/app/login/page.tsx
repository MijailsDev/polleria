'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api, ErrorApi } from '@/lib/api';
import { guardarSesion, Rol, Sesion } from '@/lib/sesion';
import { EquipoGuardado, leerEquipo, tipoEquipo } from '@/lib/equipo';
import { EquipoNoVinculado } from '@/components/EquipoNoVinculado';

interface Usuario { id: string; nombre: string; rol: Rol }
type Respuesta = Sesion | { requiere2fa: true };
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
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8">
      <Link href="/" className="mb-2 text-center text-2xl font-extrabold">
        🍗 Pollería
      </Link>
      {equipo && (
        <p className="mb-4 text-center text-sm text-slate-600">
          {tipoEquipo(equipo.equipo.tipo).icono} {equipo.equipo.nombre} · equipo vinculado
        </p>
      )}

      {modoAdmin ? (
        <div className="tarjeta p-6 animar-entrada">
          <button className="mb-2 text-sm text-slate-600" onClick={() => (setModoAdmin(false), volver())}>
            ← Volver
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
          <h1 className="mb-4 text-xl font-bold">¿Quién eres?</h1>
          <div className="grid gap-3">
            {usuarios.map((u) => (
              <button key={u.id} className="btn-secundario justify-between" onClick={() => setElegido(u)}>
                <span>{u.nombre}</span>
                <span className="text-xs text-slate-500">{u.rol.toLowerCase()}</span>
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
          <button className="mb-2 text-sm text-slate-500" onClick={volver}>
            ← Cambiar usuario
          </button>
          <h1 className="text-xl font-bold">{elegido.nombre}</h1>
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
              <p className="mb-4 text-slate-500">Ingresa tu PIN</p>
              <div className="mb-4 flex justify-center gap-3">
                {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
                  <span key={i} className={`h-4 w-4 rounded-full ${i < pin.length ? 'bg-brasa-700' : 'bg-slate-200'}`} />
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'OK'].map((t) => (
                  <button
                    key={t}
                    className={`h-16 rounded-2xl text-2xl font-bold ${t === 'OK' ? 'bg-brasa-700 text-white' : 'bg-slate-100 hover:bg-slate-200'}`}
                    onClick={() => tecla(t)}
                    disabled={cargando}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </>
          )}
          {error && <p className="mt-4 text-center font-semibold text-red-600">{error}</p>}
        </div>
      )}
    </main>
  );
}

export default function PaginaLogin() {
  return (
    <Suspense>
      <Ingreso />
    </Suspense>
  );
}
