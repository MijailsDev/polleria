'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cerrarSesion, Sesion } from '@/lib/sesion';
import { useConexion } from '@/lib/util';

/** Barra superior fija de las pantallas del personal: usuario, rol y estado de la conexión. */
export function Encabezado({ titulo, sesion, extra }: { titulo: string; sesion: Sesion | null; extra?: React.ReactNode }) {
  const router = useRouter();
  const conectado = useConexion();
  return (
    <header className="no-imprimir sticky top-0 z-30 flex flex-wrap items-center gap-3 bg-slate-900 px-4 py-2 text-white">
      <Link href="/" className="mr-2 text-lg font-bold">
        🍗 <span className="text-brasa-200">Pollería</span>
      </Link>
      <h1 className="text-lg font-semibold">{titulo}</h1>
      <div className="flex-1" />
      {extra}
      <span className={`rounded-full px-3 py-1 text-xs font-bold ${conectado ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
        {conectado ? '● En línea' : '● Sin conexión'}
      </span>
      {sesion && (
        <div className="flex items-center gap-2">
          <div className="text-right leading-tight">
            <div className="text-sm font-semibold">{sesion.usuario.nombre}</div>
            <div className="text-xs text-slate-400">{sesion.usuario.rol.toLowerCase()}</div>
          </div>
          <button
            className="rounded-lg border border-slate-600 px-3 py-2 text-sm hover:bg-slate-800"
            onClick={() => {
              cerrarSesion();
              router.push('/login');
            }}
          >
            Salir
          </button>
        </div>
      )}
    </header>
  );
}

/** Mensaje flotante breve. */
export function Aviso({ texto, tipo = 'info', alCerrar }: { texto: string; tipo?: 'info' | 'error' | 'ok'; alCerrar: () => void }) {
  const color = tipo === 'error' ? 'bg-red-600' : tipo === 'ok' ? 'bg-green-700' : 'bg-slate-900';
  return (
    <div className={`no-imprimir fixed bottom-4 left-1/2 z-50 flex max-w-[92vw] -translate-x-1/2 items-center gap-3 rounded-xl px-4 py-3 text-white shadow-xl animar-entrada ${color}`}>
      <span>{texto}</span>
      <button className="text-white/80 hover:text-white" onClick={alCerrar} aria-label="Cerrar">
        ✕
      </button>
    </div>
  );
}
