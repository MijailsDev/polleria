'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

/**
 * Portada del dominio del comensal: lo que ve quien borra el final del enlace del QR
 * o escribe la dirección a mano. Solo información del local; nada del personal.
 */
export function Portada() {
  const [local, setLocal] = useState<{ razonSocial: string; ruc: string; direccion: string } | null>(null);
  useEffect(() => {
    api('GET', '/reclamos/proveedor').then(setLocal).catch(() => {});
  }, []);
  return (
    <main className="alto-pantalla mx-auto flex max-w-lg flex-col bg-white">
      <header className="relleno-seguro-arriba bg-brasa-700 px-6 pb-10 pt-12 text-center text-white">
        <div className="text-7xl">🍗</div>
        <h1 className="mt-3 text-3xl font-extrabold leading-tight">Pollería y Brasas</h1>
        {local && <p className="mt-2 text-lg text-white">{local.direccion}</p>}
      </header>
      <section className="flex-1 px-6 py-8 text-center">
        <div className="text-5xl">📱</div>
        <h2 className="mt-3 text-2xl font-bold">¿Quieres pedir?</h2>
        <p className="mt-2 text-lg text-slate-700">
          Escanea el <b>código QR de tu mesa</b> con la cámara de tu celular. Verás la carta con fotos, podrás pedir, llamar al mozo y pagar desde tu mesa.
        </p>
        <ol className="mx-auto mt-6 max-w-xs space-y-3 text-left text-lg">
          <li className="flex gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brasa-700 font-bold text-white">1</span> Abre la cámara
          </li>
          <li className="flex gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brasa-700 font-bold text-white">2</span> Apunta al QR de la mesa
          </li>
          <li className="flex gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brasa-700 font-bold text-white">3</span> Toca el enlace que aparece
          </li>
        </ol>
      </section>
      <footer className="relleno-seguro-abajo border-t border-slate-200 px-6 py-5 text-center">
        <a href="/reclamaciones" className="btn-secundario w-full text-base">
          📕 Libro de Reclamaciones
        </a>
        <div className="mt-4 flex justify-center gap-6 text-base text-slate-700">
          <a className="inline-block min-h-11 py-2 underline" href="/privacidad">
            Privacidad
          </a>
          <a className="inline-block min-h-11 py-2 underline" href="/terminos">
            Términos
          </a>
        </div>
        {local && (
          <p className="mt-2 text-sm text-slate-600">
            {local.razonSocial} · RUC {local.ruc}
          </p>
        )}
      </footer>
    </main>
  );
}
