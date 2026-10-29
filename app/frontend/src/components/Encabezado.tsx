'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cerrarSesion, Rol, Sesion } from '@/lib/sesion';
import { useConexion, useEstadoSistema } from '@/lib/util';

const ENLACES: { href: string; texto: string; roles: Rol[] }[] = [
  { href: '/mozo', texto: 'Salón', roles: ['MOZO', 'CAJERO'] },
  { href: '/caja', texto: 'Caja', roles: ['CAJERO'] },
  { href: '/reparto', texto: 'Reparto', roles: ['REPARTIDOR'] },
  { href: '/admin', texto: 'Administración', roles: [] },
  { href: '/reportes', texto: 'Reportes', roles: [] },
];

/** Barra superior fija de las pantallas del personal: usuario, rol y estado de la conexión (REQ-CON-02). */
export function Encabezado({ titulo, sesion, extra }: { titulo: string; sesion: Sesion | null; extra?: React.ReactNode }) {
  const router = useRouter();
  const ruta = usePathname();
  const conectado = useConexion();
  const sistema = useEstadoSistema();
  const rol = sesion?.usuario.rol;
  const enlaces = ENLACES.filter((e) => rol && e.href !== ruta && (rol === 'ADMINISTRADOR' || e.roles.includes(rol)));
  return (
    <header className="no-imprimir sticky top-0 z-30 flex flex-wrap items-center gap-2 bg-slate-900 px-4 py-2 text-white">
      <Link href="/" className="mr-1 text-lg font-bold">
        🍗 <span className="text-brasa-200">Pollería</span>
      </Link>
      <h1 className="text-lg font-semibold">{titulo}</h1>
      {enlaces.length > 0 && (
        <nav className="hidden gap-1 md:flex">
          {enlaces.map((e) => (
            <Link key={e.href} href={e.href} className="rounded-lg px-2 py-1 text-sm text-slate-300 hover:bg-slate-800 hover:text-white">
              {e.texto}
            </Link>
          ))}
        </nav>
      )}
      <div className="flex-1" />
      {extra}
      <span
        title={sistema.sinInternet ? 'Sin internet: los comprobantes se envían a SUNAT cuando vuelva la conexión' : undefined}
        className={`rounded-full px-3 py-1 text-xs font-bold ${!conectado ? 'bg-red-100 text-red-800' : sistema.sinInternet ? 'bg-amber-100 text-amber-900' : 'bg-green-100 text-green-800'}`}
      >
        {!conectado ? '● Sin conexión' : sistema.sinInternet ? `● Modo local · ${sistema.pendientes} en cola` : sistema.pendientes ? `● Sincronizando ${sistema.pendientes}` : '● En línea'}
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
    <div className={`no-imprimir fixed bottom-4 left-1/2 z-[60] flex max-w-[92vw] -translate-x-1/2 items-center gap-3 rounded-xl px-4 py-3 text-white shadow-xl animar-entrada ${color}`}>
      <span>{texto}</span>
      <button className="text-white/80 hover:text-white" onClick={alCerrar} aria-label="Cerrar">
        ✕
      </button>
    </div>
  );
}
