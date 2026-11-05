import { NextRequest, NextResponse } from 'next/server';
import { esRutaComensal, MODO } from './lib/modo';

/**
 * Separa los dos dominios aunque usen el mismo código:
 *  · dominio del comensal: solo la portada, la carta QR, la pasarela, el comprobante,
 *    el Libro de Reclamaciones y los textos legales. Cualquier otra dirección responde
 *    «página no encontrada», sin revelar que existen pantallas del personal.
 *  · dominio del personal: las pantallas del personal; si alguien abre una dirección del
 *    comensal (por ejemplo /m/M-01), se le lleva al dominio del comensal.
 * En la laptop (sin NEXT_PUBLIC_MODO) todo convive en un mismo sitio.
 */
export function middleware(req: NextRequest) {
  if (MODO === 'todo') return NextResponse.next();
  const ruta = req.nextUrl.pathname;
  if (MODO === 'comensal') {
    return esRutaComensal(ruta) ? NextResponse.next() : NextResponse.rewrite(new URL('/no-encontrada', req.url), { status: 404 });
  }
  // Modo personal: la portada «/» y los textos legales son propios; el resto del comensal se redirige
  const soloComensal = esRutaComensal(ruta) && !['/', '/privacidad', '/terminos'].includes(ruta);
  if (!soloComensal) return NextResponse.next();
  const comensal = process.env.NEXT_PUBLIC_URL_COMENSAL?.replace(/\/$/, '');
  return comensal ? NextResponse.redirect(`${comensal}${ruta}${req.nextUrl.search}`) : NextResponse.rewrite(new URL('/no-encontrada', req.url), { status: 404 });
}

export const config = {
  // Archivos estáticos, íconos, manifiesto y service worker quedan fuera del filtro
  matcher: ['/((?!_next/|iconos/|favicon.ico|sw.js|offline.html|manifest.webmanifest|robots.txt).*)'],
};
