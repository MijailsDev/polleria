import type { Metadata, Viewport } from 'next';
import { RegistrarSW } from '@/components/RegistrarSW';
import { LecturaComensal } from '@/components/comensal/Lectura';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sistema para Pollerías',
  description: 'Carta QR, comandas, caja y comprobantes para la pollería',
  applicationName: 'Pollería',
  appleWebApp: { capable: true, title: 'Pollería', statusBarStyle: 'black-translucent' },
  icons: { icon: '/favicon.ico', apple: '/iconos/apple-touch-icon.png' },
};

// viewportFit cover: la página usa toda la pantalla en celulares con muesca o Dynamic Island
// (los márgenes seguros se agregan con env(safe-area-inset-*)). No se bloquea el zoom: el
// comensal puede ampliar con dos dedos. «only light» evita que el modo oscuro forzado del
// navegador invierta los colores y deje textos ilegibles.
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', colorScheme: 'only light', themeColor: '#c2410c' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">
        {children}
        <RegistrarSW />
        <LecturaComensal />
      </body>
    </html>
  );
}
