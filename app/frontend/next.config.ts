import type { NextConfig } from 'next';

const personal = process.env.NEXT_PUBLIC_MODO !== 'comensal';

const nextConfig: NextConfig = {
  // Permite levantar en la laptop el sitio del comensal y el del personal a la vez (scripts/dos-dominios.mjs)
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Cabeceras de seguridad para todas las páginas (la API agrega las suyas con helmet)
  async headers() {
    return [
      {
        source: '/:ruta*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // La cámara solo la usaría el escáner; geolocalización y micrófono no se usan
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
          // El sitio del personal no debe aparecer en buscadores
          ...(personal ? [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] : []),
        ],
      },
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
    ];
  },
};

export default nextConfig;
