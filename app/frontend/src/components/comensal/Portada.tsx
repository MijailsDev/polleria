'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Categoria } from '@/lib/tipos';
import { soles } from '@/lib/util';
import { foto, FOTOS, fotoDeCategoria } from '@/lib/imagenes';
import { Foto } from '@/components/Foto';
import { Logo } from '@/components/Logo';
import { Celular, Libro, Ubicacion } from '@/components/Iconos';
import { BotonLectura } from '@/components/comensal/Lectura';

const PASOS = [
  { titulo: 'Escanea el QR', texto: 'Está en tu mesa. Ábrelo con la cámara del celular, sin instalar nada.', img: FOTOS.salon },
  { titulo: 'Elige y pide', texto: 'Mira la carta con fotos y envía tu pedido; el mozo lo confirma.', img: FOTOS.atencion },
  { titulo: 'Paga a tu ritmo', texto: 'Con Yape, Plin o tarjeta desde tu mesa, o pide la cuenta.', img: FOTOS.pagoPos },
];

/**
 * Portada del dominio del comensal: lo que ve quien borra el final del enlace del QR
 * o escribe la dirección a mano. Muestra el local y su carta; nada del personal.
 */
export function Portada() {
  const [local, setLocal] = useState<{ razonSocial: string; ruc: string; direccion: string } | null>(null);
  const [carta, setCarta] = useState<Categoria[]>([]);
  useEffect(() => {
    api('GET', '/reclamos/proveedor').then(setLocal).catch(() => {});
    api<Categoria[]>('GET', '/carta').then(setCarta).catch(() => {});
  }, []);

  return (
    <main className="alto-pantalla bg-white">
      {/* Portada con la foto del pollo en el asador */}
      <section className="relative isolate flex min-h-[78svh] flex-col overflow-hidden bg-brasa-900 text-white">
        <Foto src={foto(FOTOS.polloAsador, 1400, 1000)} prioridad className="absolute inset-0 -z-10 h-full w-full" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-black/70 via-black/35 to-black/85" />
        <div className="relleno-seguro-arriba mx-auto flex w-full max-w-5xl items-start justify-between gap-3 px-5">
          <Logo claro />
          <BotonLectura claro />
        </div>
        <div className="mx-auto mt-auto w-full max-w-5xl px-5 pb-10 pt-16">
          <p className="inline-block rounded-full bg-brasa-700 px-4 py-1.5 text-sm font-bold uppercase tracking-wider">Pollo a la brasa</p>
          <h1 className="mt-4 max-w-2xl font-titulo text-5xl uppercase leading-[0.95] tracking-wide sm:text-7xl">
            El sabor de la brasa, <span className="text-amber-300">directo a tu mesa</span>
          </h1>
          <p className="mt-4 max-w-xl text-lg text-white">Escanea el código QR de tu mesa para ver la carta, pedir y pagar desde tu celular.</p>
          {local && (
            <p className="mt-5 flex items-start gap-2 text-base text-white">
              <Ubicacion className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" /> {local.direccion}
            </p>
          )}
        </div>
      </section>

      {/* La carta en fotos */}
      <section className="mx-auto max-w-5xl px-5 py-12">
        <h2 className="font-titulo text-4xl uppercase tracking-wide text-slate-900">Nuestra carta</h2>
        <p className="mt-2 text-lg text-slate-700">Pollo dorado a la brasa, papas crocantes, cremas de la casa y chicha bien helada.</p>
        <div className="mt-6 grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 lg:grid-cols-3">
          {carta.map((c, i) => {
            const desde = Math.min(...c.productos.map((p) => p.precio));
            return (
              <article key={c.id} className={`group relative isolate overflow-hidden rounded-2xl bg-brasa-900 shadow-md ${i === 0 ? 'min-[360px]:col-span-2 lg:col-span-1' : ''}`}>
                <div className="aspect-[4/3]">
                  <Foto src={foto(fotoDeCategoria(c.nombre), 700, 525)} inicial={c.nombre} className="h-full w-full transition duration-700 group-hover:scale-105" />
                </div>
                <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                  <h3 className="font-titulo text-2xl uppercase leading-none tracking-wide">{c.nombre}</h3>
                  {Number.isFinite(desde) && <p className="mt-1 text-base font-semibold text-amber-200">Desde {soles(desde)}</p>}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Cómo pedir */}
      <section className="bg-brasa-50">
        <div className="mx-auto max-w-5xl px-5 py-12">
          <h2 className="font-titulo text-4xl uppercase tracking-wide text-slate-900">¿Cómo pedir?</h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-3">
            {PASOS.map((p, i) => (
              <li key={p.titulo} className="overflow-hidden rounded-2xl bg-white shadow-sm">
                <div className="relative aspect-[16/10]">
                  <Foto src={foto(p.img, 600, 375)} className="h-full w-full" />
                  <span className="absolute left-3 top-3 grid h-11 w-11 place-items-center rounded-full bg-brasa-700 font-titulo text-2xl text-white shadow">{i + 1}</span>
                </div>
                <div className="p-4">
                  <h3 className="text-lg font-bold text-slate-900">{p.titulo}</h3>
                  <p className="mt-1 text-base text-slate-700">{p.texto}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-6 flex items-center gap-2 text-base font-semibold text-brasa-800">
            <Celular className="h-5 w-5 shrink-0" /> Funciona en cualquier celular con cámara: Android o iPhone.
          </p>
        </div>
      </section>

      {/* Pie con los datos del local */}
      <footer className="relleno-seguro-abajo bg-brasa-900 text-white">
        <div className="mx-auto grid max-w-5xl gap-6 px-5 py-10 sm:grid-cols-2">
          <div>
            <Logo claro />
            {local && (
              <p className="mt-4 text-base text-white">
                {local.razonSocial}
                <br />
                RUC {local.ruc}
                <br />
                {local.direccion}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <a href="/reclamaciones" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-5 font-bold text-brasa-900 hover:bg-amber-50">
              <Libro className="h-5 w-5" /> Libro de Reclamaciones
            </a>
            <div className="flex gap-6 text-base">
              <a className="inline-flex min-h-11 items-center text-white underline" href="/privacidad">
                Privacidad
              </a>
              <a className="inline-flex min-h-11 items-center text-white underline" href="/terminos">
                Términos
              </a>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
