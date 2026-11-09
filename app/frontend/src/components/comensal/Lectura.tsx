'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MODO } from '@/lib/modo';

/** Preferencias de lectura del comensal: se guardan en su celular para la próxima visita. */
interface Preferencias { escala: number; contraste: boolean }
const CLAVE = 'polleria.lectura';
const TAMANOS = [
  { escala: 1, texto: 'A', nombre: 'Normal' },
  { escala: 1.15, texto: 'A+', nombre: 'Grande' },
  { escala: 1.3, texto: 'A++', nombre: 'Muy grande' },
];

function leer(): Preferencias {
  try {
    const p = JSON.parse(localStorage.getItem(CLAVE) ?? 'null');
    if (p && TAMANOS.some((t) => t.escala === p.escala)) return { escala: p.escala, contraste: !!p.contraste };
  } catch {
    /* sin almacenamiento */
  }
  return { escala: 1, contraste: false };
}

function aplicar(p: Preferencias | null) {
  const html = document.documentElement;
  html.classList.toggle('comensal', !!p);
  html.classList.toggle('alto-contraste', !!p?.contraste);
  html.classList.toggle('letra-grande', !!p && p.escala > 1);
  if (p && p.escala !== 1) html.style.setProperty('--escala', String(p.escala));
  else html.style.removeProperty('--escala');
}

const esPaginaComensal = (ruta: string) => MODO === 'comensal' || ['/m/', '/pasarela/', '/c/'].some((r) => ruta.startsWith(r)) || ruta === '/reclamaciones';

/** En el layout: aplica las preferencias solo en las páginas del comensal. */
export function LecturaComensal() {
  const ruta = usePathname();
  useEffect(() => {
    aplicar(esPaginaComensal(ruta) ? leer() : null);
  }, [ruta]);
  return null;
}

/** Botón «Aa» de la carta: tamaño de letra y alto contraste. */
export function BotonLectura({ claro = false }: { claro?: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [p, setP] = useState<Preferencias>({ escala: 1, contraste: false });
  useEffect(() => setP(leer()), []);

  function cambiar(n: Preferencias) {
    setP(n);
    try {
      localStorage.setItem(CLAVE, JSON.stringify(n));
    } catch {
      /* modo privado */
    }
    aplicar(n);
  }

  return (
    <div className="relative">
      <button
        className={`grid h-12 min-w-12 place-items-center rounded-full px-3 text-lg font-extrabold ${claro ? 'bg-white/20 text-white' : 'border border-slate-300 bg-white text-slate-800'}`}
        aria-label="Tamaño de letra y contraste"
        aria-expanded={abierto}
        onClick={() => setAbierto((a) => !a)}
      >
        Aa
      </button>
      {abierto && (
        <div role="dialog" aria-label="Ajustes de lectura" className="absolute right-0 top-14 z-50 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 shadow-xl animar-entrada">
          <div className="text-base font-bold">Tamaño de letra</div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {TAMANOS.map((t, i) => (
              <button
                key={t.escala}
                aria-pressed={p.escala === t.escala}
                className={`min-h-12 rounded-xl border-2 font-extrabold ${p.escala === t.escala ? 'border-brasa-700 bg-brasa-700 text-white' : 'border-slate-300 bg-white text-slate-800'}`}
                style={{ fontSize: `${1 + i * 0.2}rem` }}
                onClick={() => cambiar({ ...p, escala: t.escala })}
              >
                {t.texto}
                <span className="sr-only"> {t.nombre}</span>
              </button>
            ))}
          </div>
          <button
            role="switch"
            aria-checked={p.contraste}
            className="mt-4 flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border-2 border-slate-300 px-3 text-left font-bold"
            onClick={() => cambiar({ ...p, contraste: !p.contraste })}
          >
            <span>Alto contraste</span>
            <span className={`relative h-7 w-12 shrink-0 rounded-full transition ${p.contraste ? 'bg-brasa-700' : 'bg-slate-300'}`}>
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${p.contraste ? 'left-6' : 'left-1'}`} />
            </span>
          </button>
          <button className="mt-3 min-h-11 w-full text-sm font-semibold text-slate-600 underline" onClick={() => setAbierto(false)}>
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
}
