// Dos dominios con el mismo código: el del comensal (carta QR, pago, comprobante,
// reclamos) y el del personal (mozo, caja, cocina, reparto, administración).
// En Vercel cada proyecto define NEXT_PUBLIC_MODO; en la laptop, sin la variable, todo junto.

export type Modo = 'comensal' | 'personal' | 'todo';
export const MODO: Modo = process.env.NEXT_PUBLIC_MODO === 'comensal' || process.env.NEXT_PUBLIC_MODO === 'personal' ? process.env.NEXT_PUBLIC_MODO : 'todo';

/** Rutas que existen en el dominio del comensal. Todo lo demás es del personal. */
const PREFIJOS_COMENSAL = ['/m/', '/pasarela/', '/c/'];
const PAGINAS_COMENSAL = ['/', '/reclamaciones', '/privacidad', '/terminos'];
export const esRutaComensal = (ruta: string) => PAGINAS_COMENSAL.includes(ruta) || PREFIJOS_COMENSAL.some((p) => ruta.startsWith(p));

/** Dirección del sitio del comensal: la que llevan los QR de las mesas y los comprobantes por WhatsApp. */
export function urlComensal() {
  const u = process.env.NEXT_PUBLIC_URL_COMENSAL?.replace(/\/$/, '');
  if (u) return u;
  return typeof window === 'undefined' ? '' : window.location.origin;
}
