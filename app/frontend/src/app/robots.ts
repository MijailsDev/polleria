import type { MetadataRoute } from 'next';
import { MODO } from '@/lib/modo';

/** Google puede mostrar la portada y el Libro de Reclamaciones del comensal; nunca el sitio del personal. */
export default function robots(): MetadataRoute.Robots {
  if (MODO === 'comensal') return { rules: [{ userAgent: '*', allow: ['/', '/reclamaciones', '/privacidad', '/terminos'], disallow: ['/m/', '/pasarela/', '/c/'] }] };
  return { rules: [{ userAgent: '*', disallow: '/' }] };
}
