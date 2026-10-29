import Link from 'next/link';

const PANTALLAS = [
  { href: '/mozo', icono: '📱', titulo: 'Mozo', texto: 'Plano de mesas, pedidos, unir mesas, precuenta, anulaciones con PIN y alertas.', quien: 'Tablet del mozo' },
  { href: '/caja', icono: '💵', titulo: 'Caja', texto: 'Cobro mixto, comprobantes y notas de crédito, llevar y delivery, inventario y turno.', quien: 'Terminal de caja' },
  { href: '/cocina', icono: '🔥', titulo: 'Cocina', texto: 'Comandas con alarma, tickets de anulación, reimpresión y reposición.', quien: 'Estación del pollero' },
  { href: '/reparto', icono: '🛵', titulo: 'Reparto', texto: 'Pedidos en ruta, monto a cobrar, vuelto y entregas.', quien: 'Celular del repartidor' },
  { href: '/admin', icono: '⚙️', titulo: 'Administración', texto: 'Usuarios, carta y precios, mesas, configuración, turnos y bitácora.', quien: 'Dueño' },
  { href: '/reportes', icono: '📊', titulo: 'Reportes', texto: 'Ventas, productos, pecho vs. pierna, horas punta, tiempos y pérdidas.', quien: 'Dueño' },
  { href: '/qr', icono: '🔳', titulo: 'Códigos QR', texto: 'Los QR de las mesas para imprimir. El comensal pide y paga desde su celular.', quien: 'Para el comensal' },
];

export default function Inicio() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8">
        <p className="mb-2 inline-block rounded-full bg-brasa-100 px-3 py-1 text-sm font-semibold text-brasa-800">Versión local completa</p>
        <h1 className="text-4xl font-extrabold tracking-tight">🍗 Sistema para Pollerías</h1>
        <p className="mt-2 max-w-2xl text-lg text-slate-600">
          Elige la pantalla según el equipo. La pasarela de pagos, la emisión ante SUNAT, la consulta de DNI y la impresora de cocina están simuladas.
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
      <div className="tarjeta mt-6 p-5 text-sm text-slate-600">
        <b>Usuarios de prueba:</b> Mozo (PIN 1111) · Cajera (PIN 2222) · Repartidor (PIN 3333) · Administrador (PIN 1234 y contraseña Admin2026!). Cámbialos antes de usar el sistema en el
        local.
      </div>
    </main>
  );
}
