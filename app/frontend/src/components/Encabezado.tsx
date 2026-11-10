'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cerrarSesion, Rol, Sesion } from '@/lib/sesion';
import { useConexion, useEstadoSistema } from '@/lib/util';
import { Emblema } from '@/components/Logo';
import { Ico, NombreIcono } from '@/components/Ico';

const ENLACES: { href: string; texto: string; icono: NombreIcono; roles: Rol[] }[] = [
  { href: '/mozo', texto: 'Salón', icono: 'mesa', roles: ['MOZO', 'CAJERO'] },
  { href: '/caja', texto: 'Caja', icono: 'billete', roles: ['CAJERO'] },
  { href: '/reparto', texto: 'Reparto', icono: 'moto', roles: ['REPARTIDOR'] },
  { href: '/admin', texto: 'Administración', icono: 'ajustes', roles: [] },
  { href: '/reportes', texto: 'Reportes', icono: 'grafico', roles: [] },
];
const ROL: Record<Rol, string> = { MOZO: 'Mozo', CAJERO: 'Caja', REPARTIDOR: 'Reparto', ADMINISTRADOR: 'Administrador' };
const iniciales = (nombre: string) =>
  nombre
    .split(/\s+/)
    .filter((p) => /^[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(p))
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

/** Barra superior fija de las pantallas del personal: marca, navegación, conexión y usuario (REQ-CON-02). */
export function Encabezado({ titulo, sesion, extra }: { titulo: string; sesion: Sesion | null; extra?: React.ReactNode }) {
  const router = useRouter();
  const ruta = usePathname();
  const conectado = useConexion();
  const sistema = useEstadoSistema();
  const rol = sesion?.usuario.rol;
  const enlaces = ENLACES.filter((e) => rol && (rol === 'ADMINISTRADOR' || e.roles.includes(rol)));
  const estado = !conectado
    ? { texto: 'Sin conexión', clase: 'bg-red-100 text-red-800', punto: 'bg-red-600' }
    : sistema.sinInternet
      ? { texto: `Modo local · ${sistema.pendientes} en cola`, clase: 'bg-amber-100 text-amber-900', punto: 'bg-amber-500' }
      : sistema.pendientes
        ? { texto: `Sincronizando ${sistema.pendientes}`, clase: 'bg-green-100 text-green-800', punto: 'bg-green-600' }
        : { texto: 'En línea', clase: 'bg-green-100 text-green-800', punto: 'bg-green-600' };

  return (
    <>
      <header className="no-imprimir sticky top-0 z-30 bg-brasa-950 text-white shadow-md" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 sm:px-4">
          <Link href="/" className="inline-flex shrink-0 items-center gap-2" aria-label="Inicio">
            <Emblema className="h-9 w-9" />
            <span className="hidden font-titulo text-lg uppercase tracking-wide text-amber-200 lg:inline">Brasa Dorada</span>
          </Link>
          <h1 className="min-w-0 truncate border-l border-white/20 pl-3 text-lg font-semibold">{titulo}</h1>

          {enlaces.length > 1 && (
            <nav aria-label="Pantallas" className="hidden items-center gap-1 md:flex">
              {enlaces.map((e) => (
                <Link
                  key={e.href}
                  href={e.href}
                  aria-current={e.href === ruta ? 'page' : undefined}
                  className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition ${e.href === ruta ? 'bg-white/15 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'}`}
                >
                  <Ico n={e.icono} /> {e.texto}
                </Link>
              ))}
            </nav>
          )}

          <div className="flex-1" />
          {extra}
          <span
            role="status"
            title={sistema.sinInternet ? 'Sin internet: los comprobantes se envían a SUNAT cuando vuelva la conexión' : undefined}
            className={`etiqueta ${estado.clase}`}
          >
            <span className={`h-2 w-2 rounded-full ${estado.punto}`} /> {estado.texto}
          </span>
          {sesion && (
            <div className="flex items-center gap-2">
              <span aria-hidden className="grid h-10 w-10 place-items-center rounded-full bg-brasa-700 text-sm font-bold">
                {iniciales(sesion.usuario.nombre) || <Ico n="persona" />}
              </span>
              <div className="hidden leading-tight sm:block">
                <div className="max-w-40 truncate text-sm font-semibold">{sesion.usuario.nombre}</div>
                <div className="text-xs text-white/70">{ROL[sesion.usuario.rol]}</div>
              </div>
              <button
                className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-white/25 px-3 text-sm font-medium hover:bg-white/10"
                onClick={() => {
                  cerrarSesion();
                  router.push('/login');
                }}
              >
                <Ico n="salir" /> <span className="max-[480px]:sr-only">Salir</span>
              </button>
            </div>
          )}
        </div>

        {/* En celulares y tablets pequeñas, la navegación va en una segunda fila deslizable */}
        {enlaces.length > 1 && (
          <nav aria-label="Pantallas" className="flex gap-1 overflow-x-auto border-t border-white/10 px-2 py-1.5 md:hidden">
            {enlaces.map((e) => (
              <Link
                key={e.href}
                href={e.href}
                aria-current={e.href === ruta ? 'page' : undefined}
                className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium ${e.href === ruta ? 'bg-white/15 text-white' : 'text-white/75'}`}
              >
                <Ico n={e.icono} /> {e.texto}
              </Link>
            ))}
          </nav>
        )}
      </header>
      <BannerSinConexion conectado={conectado} />
    </>
  );
}

/**
 * Alerta visible si se pierde la conexión con el servidor del local (servidor apagado,
 * cable o WiFi). Espera unos segundos para no parpadear en una reconexión breve.
 */
function BannerSinConexion({ conectado }: { conectado: boolean }) {
  const [mostrar, setMostrar] = useState(false);
  useEffect(() => {
    if (conectado) return setMostrar(false);
    const t = setTimeout(() => setMostrar(true), 4000);
    return () => clearTimeout(t);
  }, [conectado]);
  if (!mostrar) return null;
  return (
    <div role="alert" className="no-imprimir flex items-start justify-center gap-2 bg-red-700 px-4 py-2 text-center text-sm font-semibold text-white">
      <Ico n="sinWifi" className="mt-0.5" /> Sin conexión con el servidor del local. Revisa que la computadora del servidor esté encendida y conectada al router. Reintentando…
    </div>
  );
}

/** Mensaje flotante breve. */
export function Aviso({ texto, tipo = 'info', alCerrar }: { texto: string; tipo?: 'info' | 'error' | 'ok'; alCerrar: () => void }) {
  const color = tipo === 'error' ? 'bg-red-700' : tipo === 'ok' ? 'bg-green-700' : 'bg-slate-900';
  return (
    <div
      role={tipo === 'error' ? 'alert' : 'status'}
      className={`no-imprimir fixed bottom-4 left-1/2 z-[60] flex w-max max-w-[92vw] -translate-x-1/2 items-center gap-3 rounded-2xl px-4 py-3 font-medium text-white shadow-xl animar-entrada ${color}`}
      style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
    >
      <Ico n={tipo === 'error' ? 'alerta' : tipo === 'ok' ? 'checkCirculo' : 'campana'} className="text-lg" />
      <span>{texto}</span>
      <button className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/80 hover:bg-white/15 hover:text-white" onClick={alCerrar} aria-label="Cerrar">
        <Ico n="x" />
      </button>
    </div>
  );
}
