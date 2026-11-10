'use client';
import { Ico } from '@/components/Ico';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { EquipoGuardado, guardarEquipo, leerEquipo, olvidarEquipo, tipoEquipo } from '@/lib/equipo';
import { cerrarSesion } from '@/lib/sesion';

/**
 * Vincular este equipo: se escribe (o se escanea en QR) el código de un solo uso que
 * generó el administrador en Administración → Equipos. Dura 10 minutos.
 */
function Vincular() {
  const router = useRouter();
  const params = useSearchParams();
  const [codigo, setCodigo] = useState(params.get('codigo') ?? '');
  const [actual, setActual] = useState<EquipoGuardado | null>(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => setActual(leerEquipo()), []);

  async function vincular() {
    setEnviando(true);
    setError('');
    try {
      const r = await api<EquipoGuardado>('POST', '/equipos/vincular', { codigo });
      cerrarSesion(); // una sesión abierta antes de vincular no lleva la llave del equipo
      guardarEquipo(r);
      // La cocina no usa PIN; los demás pasan a elegir quién ingresa
      router.replace(r.equipo.tipo === 'COCINA' ? '/cocina' : r.equipo.tipo === 'ADMINISTRACION' ? '/' : '/login');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  const formato = (t: string) => {
    const c = t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    return c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8">
      <div className="tarjeta p-6">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brasa-100 text-3xl text-brasa-800">
          <Ico n="enlace" />
        </div>
        <h1 className="mt-2 text-center text-xl font-bold">Vincular este equipo</h1>
        {actual && (
          <div className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-900">
            Este equipo ya está vinculado como <b>{actual.equipo.nombre}</b> ({tipoEquipo(actual.equipo.tipo).nombre.toLowerCase()}). Si escribes un código nuevo, se reemplaza.
            <button
              className="mt-2 block font-semibold text-red-700 underline"
              onClick={() => {
                olvidarEquipo();
                cerrarSesion();
                setActual(null);
              }}
            >
              Olvidar la vinculación en este equipo
            </button>
          </div>
        )}
        <p className="mt-4 text-slate-600">Escribe el código de 8 caracteres que te dio el administrador. Vence a los 10 minutos y sirve una sola vez.</p>
        <input
          className="campo mt-4 text-center font-mono text-2xl tracking-[0.3em] uppercase"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="one-time-code"
          placeholder="XXXX-XXXX"
          value={codigo}
          onChange={(e) => setCodigo(formato(e.target.value))}
          onKeyDown={(e) => e.key === 'Enter' && codigo.length === 9 && vincular()}
        />
        <button className="btn-primario mt-4 w-full" disabled={codigo.length !== 9 || enviando} onClick={vincular}>
          {enviando ? 'Vinculando…' : 'Vincular'}
        </button>
        {error && <p className="mt-3 text-center font-semibold text-red-600">{error}</p>}
      </div>
    </main>
  );
}

export default function PaginaVincular() {
  return (
    <Suspense>
      <Vincular />
    </Suspense>
  );
}
