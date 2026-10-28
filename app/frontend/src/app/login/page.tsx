'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { guardarSesion, Rol, Sesion } from '@/lib/sesion';

interface Usuario { id: string; nombre: string; rol: Rol }
const DESTINO: Record<Rol, string> = { MOZO: '/mozo', CAJERO: '/caja', ADMINISTRADOR: '/caja', REPARTIDOR: '/' };

function Ingreso() {
  const router = useRouter();
  const params = useSearchParams();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [elegido, setElegido] = useState<Usuario | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(params.get('permiso') === '0' ? 'Tu rol no tiene acceso a esa pantalla.' : '');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    api<Usuario[]>('GET', '/auth/usuarios').then(setUsuarios).catch((e) => setError(e.message));
  }, []);

  async function ingresar(valor: string) {
    if (!elegido) return;
    setCargando(true);
    setError('');
    try {
      const s = await api<Sesion>('POST', '/auth/login', { usuarioId: elegido.id, pin: valor });
      guardarSesion(s);
      router.replace(params.get('volver') || DESTINO[s.usuario.rol]);
    } catch (e: any) {
      setError(e.message);
      setPin('');
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

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8">
      <Link href="/" className="mb-6 text-center text-2xl font-extrabold">
        🍗 Pollería
      </Link>
      {!elegido ? (
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
        </div>
      ) : (
        <div className="tarjeta p-6 animar-entrada">
          <button className="mb-2 text-sm text-slate-500" onClick={() => (setElegido(null), setPin(''), setError(''))}>
            ← Cambiar usuario
          </button>
          <h1 className="text-xl font-bold">{elegido.nombre}</h1>
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
