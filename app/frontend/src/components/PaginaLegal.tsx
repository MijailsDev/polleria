'use client';
import { Logo } from '@/components/Logo';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Proveedor { razonSocial: string; ruc: string; direccion: string }

/** Marco común de las páginas legales con los datos del local tomados de la configuración. */
export function PaginaLegal({ titulo, actualizado, children }: { titulo: string; actualizado: string; children: (p: Proveedor) => React.ReactNode }) {
  const [p, setP] = useState<Proveedor>({ razonSocial: 'La pollería', ruc: '', direccion: '' });
  useEffect(() => {
    api<Proveedor>('GET', '/reclamos/proveedor').then(setP).catch(() => {});
  }, []);
  return (
    <main className="mx-auto min-h-screen max-w-3xl p-4">
      <Link href="/" className="font-bold">
        <Logo compacto />
      </Link>
      <article className="tarjeta mt-3 space-y-3 p-6 leading-relaxed [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc">
        <h1 className="text-2xl font-extrabold">{titulo}</h1>
        <p className="text-sm text-slate-500">
          {p.razonSocial}
          {p.ruc && ` · RUC ${p.ruc}`} · Última actualización: {actualizado}
        </p>
        {children(p)}
        <p className="mt-6 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
          Texto modelo del proyecto académico. Antes de usarlo en un negocio real debe revisarlo un abogado y registrarse el banco de datos personales ante la Autoridad Nacional de Protección de Datos Personales.
        </p>
      </article>
    </main>
  );
}
