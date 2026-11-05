// Service worker de la app instalable.
// Guarda los archivos estáticos (JS, CSS, íconos) para que las pantallas abran rápido y,
// si el servidor del local no responde, muestra una página que explica qué revisar.
// Las llamadas a la API nunca se guardan: los datos siempre son los del servidor.
const VERSION = 'polleria-v1';
const OFFLINE = '/offline.html';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll([OFFLINE, '/iconos/icono-192.png'])));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Páginas: siempre de la red; si no hay conexión con el servidor, la página de aviso
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match(OFFLINE)));
    return;
  }
  // Estáticos versionados de Next.js e íconos: primero la caché
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/iconos/')) {
    e.respondWith(
      caches.match(e.request).then(
        (r) =>
          r ||
          fetch(e.request).then((res) => {
            const copia = res.clone();
            caches.open(VERSION).then((c) => c.put(e.request, copia));
            return res;
          }),
      ),
    );
  }
});
