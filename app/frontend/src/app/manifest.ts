import type { MetadataRoute } from 'next';
import { MODO } from '@/lib/modo';

/** App instalable (PWA): la tablet del mozo y el celular del repartidor la abren a pantalla completa. */
export default function manifest(): MetadataRoute.Manifest {
  // En el dominio del comensal no se ofrece instalar la app del personal
  if (MODO === 'comensal')
    return {
      name: 'Carta · Pollería y Brasas',
      short_name: 'Carta',
      start_url: '/',
      display: 'browser',
      background_color: '#ffffff',
      theme_color: '#c2410c',
      lang: 'es-PE',
      icons: [{ src: '/iconos/icono-192.png', sizes: '192x192', type: 'image/png' }],
    };
  return {
    name: 'Sistema para Pollerías',
    short_name: 'Pollería',
    description: 'Mesas, comandas, caja, delivery y comprobantes de la pollería',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#f8fafc',
    theme_color: '#c2410c',
    lang: 'es-PE',
    icons: [
      { src: '/iconos/icono-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/iconos/icono-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/iconos/icono-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Salón (mozo)', url: '/mozo', icons: [{ src: '/iconos/icono-192.png', sizes: '192x192' }] },
      { name: 'Caja', url: '/caja', icons: [{ src: '/iconos/icono-192.png', sizes: '192x192' }] },
      { name: 'Cocina', url: '/cocina', icons: [{ src: '/iconos/icono-192.png', sizes: '192x192' }] },
      { name: 'Reparto', url: '/reparto', icons: [{ src: '/iconos/icono-192.png', sizes: '192x192' }] },
    ],
  };
}
