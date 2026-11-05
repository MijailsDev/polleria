import Link from 'next/link';
import { MODO } from '@/lib/modo';
import { Portada } from '@/components/comensal/Portada';

const PANTALLAS = [
  { href: '/mozo', icono: '📱', titulo: 'Mozo', texto: 'Plano de mesas, pedidos, unir mesas, precuenta, anulaciones con PIN y alertas.', quien: 'Tablet del mozo' },
  { href: '/caja', icono: '💵', titulo: 'Caja', texto: 'Cobro mixto, bebidas, comprobantes y notas de crédito, llevar y delivery, inventario y turno.', quien: 'Terminal de caja' },
  { href: '/cocina', icono: '🔥', titulo: 'Cocina', texto: 'Comandas con alarma, tickets de anulación, reimpresión y reposición.', quien: 'Estación del pollero' },
  { href: '/reparto', icono: '🛵', titulo: 'Reparto', texto: 'Pedidos en ruta, monto a cobrar, vuelto y entregas.', quien: 'Celular del repartidor' },
  { href: '/admin', icono: '⚙️', titulo: 'Administración', texto: 'Usuarios, carta, combos y precios por canal, SUNAT, reclamos, estado del sistema y bitácora.', quien: 'Dueño' },
  { href: '/reportes', icono: '📊', titulo: 'Reportes', texto: 'Ventas, productos, pecho vs. pierna, horas punta, tiempos y pérdidas, en Excel o PDF.', quien: 'Dueño' },
  { href: '/qr', icono: '🔳', titulo: 'Códigos QR', texto: 'Los QR de las mesas para imprimir. El comensal pide y paga desde su celular.', quien: 'Para el comensal' },
];

const SIMULADORES = [
  { href: '/impresoras', icono: '🧾', titulo: 'Impresoras térmicas', texto: 'Lo que sale por la ticketera del pollero y la de caja (ESC/POS de 80 mm).' },
  { href: '/whatsapp', icono: '💬', titulo: 'WhatsApp de los clientes', texto: 'Comprobantes, avisos de delivery y respuestas a reclamos que envía el sistema.' },
  { href: '/reclamaciones', icono: '📕', titulo: 'Libro de Reclamaciones', texto: 'Formulario público para registrar un reclamo o queja y consultar la respuesta.' },
];

export default function Inicio() {
  // Dominio del comensal: portada del local, sin ninguna pantalla del personal
  if (MODO === 'comensal') return <Portada />;
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8">
        <p className="mb-2 inline-block rounded-full bg-brasa-100 px-3 py-1 text-sm font-semibold text-brasa-800">{MODO === 'personal' ? 'Sistema del personal' : 'Versión local completa'}</p>
        <h1 className="text-4xl font-extrabold tracking-tight">🍗 Sistema para Pollerías</h1>
        <p className="mt-2 max-w-2xl text-lg text-slate-600">
          Elige la pantalla según el equipo. SUNAT, la pasarela de pagos, la consulta de DNI y RUC, WhatsApp y las ticketeras están simulados con el mismo flujo que los servicios reales.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PANTALLAS.map((p) => (
          <Link key={p.href} href={p.href} className="tarjeta group p-6 transition hover:-translate-y-0.5 hover:border-brasa-500 hover:shadow-md">
            <div className="mb-3 text-4xl">{p.icono}</div>
            <h2 className="text-2xl font-bold group-hover:text-brasa-700">{p.titulo}</h2>
            <p className="mt-1 text-slate-600">{p.texto}</p>
            <p className="mt-3 text-sm font-semibold text-slate-400">{p.quien}</p>
          </Link>
        ))}
      </div>

      <h2 className="mb-3 mt-10 text-xl font-bold">Para ver lo que pasa fuera de la pantalla</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        {SIMULADORES.map((p) => (
          <Link key={p.href} href={p.href} className="tarjeta group p-5 transition hover:border-brasa-500">
            <div className="text-3xl">{p.icono}</div>
            <h3 className="mt-2 text-lg font-bold group-hover:text-brasa-700">{p.titulo}</h3>
            <p className="mt-1 text-sm text-slate-600">{p.texto}</p>
          </Link>
        ))}
      </div>

      {MODO === 'todo' && process.env.NODE_ENV !== 'production' && (
      <div className="tarjeta mt-6 p-5 text-sm text-slate-600">
        <b>Usuarios de prueba:</b> Mozo (PIN 1111) · Cajera (PIN 2222) · Repartidor (PIN 3333) · Administrador (PIN 1234 y contraseña Admin2026!). Cámbialos antes de usar el sistema en el
        local: en modo producción el servidor no arranca mientras sigan activos.
      </div>
      )}
      <footer className="mt-6 flex flex-wrap gap-4 text-sm text-slate-500">
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
    </main>
  );
}
