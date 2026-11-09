import Link from 'next/link';
import { MODO } from '@/lib/modo';
import { foto, FOTOS } from '@/lib/imagenes';
import { Portada } from '@/components/comensal/Portada';
import { Foto } from '@/components/Foto';
import { Logo } from '@/components/Logo';
import { Flecha } from '@/components/Iconos';

const PANTALLAS = [
  { href: '/mozo', img: FOTOS.mozo, titulo: 'Mozo', texto: 'Plano de mesas, pedidos, unir mesas, precuenta, anulaciones con PIN y alertas.', quien: 'Tablet del mozo' },
  { href: '/caja', img: FOTOS.caja, titulo: 'Caja', texto: 'Cobro mixto, bebidas, comprobantes y notas de crédito, llevar y delivery, inventario y turno.', quien: 'Terminal de caja' },
  { href: '/cocina', img: FOTOS.cocina, titulo: 'Cocina', texto: 'Comandas con alarma, tickets de anulación, reimpresión y reposición.', quien: 'Estación del pollero' },
  { href: '/reparto', img: FOTOS.reparto, titulo: 'Reparto', texto: 'Pedidos en ruta, monto a cobrar, vuelto y entregas.', quien: 'Celular del repartidor' },
  { href: '/admin', img: FOTOS.administracion, titulo: 'Administración', texto: 'Usuarios, equipos, carta, combos y precios por canal, SUNAT, reclamos y bitácora.', quien: 'Dueño' },
  { href: '/reportes', img: FOTOS.reportes, titulo: 'Reportes', texto: 'Ventas, productos, pecho vs. pierna, horas punta, tiempos y pérdidas, en Excel o PDF.', quien: 'Dueño' },
  { href: '/qr', img: FOTOS.salon, titulo: 'Códigos QR', texto: 'Los QR de las mesas para imprimir. El comensal pide y paga desde su celular.', quien: 'Para el comensal' },
];

const SIMULADORES = [
  { href: '/impresoras', img: FOTOS.pagoPos, titulo: 'Impresoras térmicas', texto: 'Lo que sale por la ticketera del pollero y la de caja (ESC/POS de 80 mm).' },
  { href: '/whatsapp', img: FOTOS.atencion, titulo: 'WhatsApp de los clientes', texto: 'Comprobantes, avisos de delivery y respuestas a reclamos que envía el sistema.' },
  { href: '/reclamaciones', img: FOTOS.mesaFamiliar, titulo: 'Libro de Reclamaciones', texto: 'Formulario público para registrar un reclamo o queja y consultar la respuesta.' },
];

export default function Inicio() {
  // Dominio del comensal: portada del local, sin ninguna pantalla del personal
  if (MODO === 'comensal') return <Portada />;
  return (
    <main className="min-h-screen bg-slate-50">
      <header className="relative isolate overflow-hidden bg-brasa-900 text-white">
        <Foto src={foto(FOTOS.polloParrilla, 1600, 700)} prioridad className="absolute inset-0 -z-10 h-full w-full" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-black/85 via-black/60 to-black/30" />
        <div className="mx-auto max-w-6xl px-5 pb-12 pt-8">
          <Logo claro />
          <p className="mt-10 inline-block rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">{MODO === 'personal' ? 'Sistema del personal' : 'Versión local completa'}</p>
          <h1 className="mt-3 font-titulo text-5xl uppercase leading-none tracking-wide sm:text-6xl">Sistema para Pollerías</h1>
          <p className="mt-3 max-w-2xl text-lg text-white">
            Elige la pantalla según el equipo. SUNAT, la pasarela de pagos, la consulta de DNI y RUC, WhatsApp y las ticketeras están simulados con el mismo flujo que los servicios reales.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PANTALLAS.map((p) => (
            <Link key={p.href} href={p.href} className="tarjeta-plato group flex flex-col overflow-hidden">
              <div className="relative aspect-[16/9] overflow-hidden">
                <Foto src={foto(p.img, 640, 360)} inicial={p.titulo} className="h-full w-full transition duration-700 group-hover:scale-105" />
                <span className="absolute bottom-3 left-3 rounded-full bg-black/70 px-3 py-1 text-sm font-semibold text-white">{p.quien}</span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h2 className="font-titulo text-3xl uppercase tracking-wide text-slate-900 group-hover:text-brasa-700">{p.titulo}</h2>
                <p className="mt-1 flex-1 text-slate-600">{p.texto}</p>
                <span className="mt-4 inline-flex items-center gap-1 font-semibold text-brasa-700">
                  Abrir <Flecha className="h-4 w-4 transition group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          ))}
        </div>

        <h2 className="mb-4 mt-12 font-titulo text-3xl uppercase tracking-wide text-slate-900">Para ver lo que pasa fuera de la pantalla</h2>
        <div className="grid gap-5 sm:grid-cols-3">
          {SIMULADORES.map((p) => (
            <Link key={p.href} href={p.href} className="tarjeta-plato group flex items-center gap-4 overflow-hidden p-3">
              <Foto src={foto(p.img, 200, 200)} inicial={p.titulo} className="h-20 w-20 shrink-0 rounded-xl" />
              <div>
                <h3 className="text-lg font-bold group-hover:text-brasa-700">{p.titulo}</h3>
                <p className="mt-1 text-sm text-slate-600">{p.texto}</p>
              </div>
            </Link>
          ))}
        </div>

        {MODO === 'todo' && process.env.NODE_ENV !== 'production' && (
          <div className="tarjeta mt-8 p-5 text-sm text-slate-600">
            <b>Usuarios de prueba:</b> Mozo (PIN 1111) · Cajera (PIN 2222) · Repartidor (PIN 3333) · Administrador (PIN 1234 y contraseña Admin2026!). Cámbialos antes de usar el sistema en el
            local: en modo producción el servidor no arranca mientras sigan activos.
          </div>
        )}
        <footer className="mt-8 flex flex-wrap gap-4 text-sm text-slate-600">
          <Link className="underline" href="/vincular">
            Vincular este equipo
          </Link>
          <Link className="underline" href="/privacidad">
            Política de privacidad
          </Link>
          <Link className="underline" href="/terminos">
            Términos y condiciones
          </Link>
        </footer>
      </div>
    </main>
  );
}
