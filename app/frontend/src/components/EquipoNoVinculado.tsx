'use client';
import { Ico } from '@/components/Ico';
import Link from 'next/link';

/** Pantalla que ve un equipo que el dueño aún no autorizó (o un curioso en su celular). */
export function EquipoNoVinculado({ alAdmin }: { alAdmin?: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8">
      <div className="tarjeta p-6 text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brasa-100 text-3xl text-brasa-800">
          <Ico n="candado" />
        </div>
        <h1 className="mt-3 text-xl font-bold">Este equipo no está autorizado</h1>
        <p className="mt-2 text-slate-600">
          Las pantallas del personal solo funcionan en los equipos que el administrador vinculó. Si trabajas aquí, pídele un código de vinculación.
        </p>
        <Link href="/vincular" className="btn-primario mt-5 w-full">
          Tengo un código de vinculación
        </Link>
        {alAdmin ? (
          <button className="mt-4 block w-full text-sm font-semibold text-slate-600 underline" onClick={alAdmin}>
            Soy el administrador
          </button>
        ) : (
          <Link href="/login?admin=1" className="mt-4 block text-sm font-semibold text-slate-600 underline">
            Soy el administrador
          </Link>
        )}
      </div>
    </main>
  );
}
