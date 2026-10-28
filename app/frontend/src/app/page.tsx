import Link from 'next/link';

const PANTALLAS = [
  { href: '/mozo', icono: '📱', titulo: 'Mozo', texto: 'Plano de las 10 mesas, toma de pedidos y alertas de los comensales.', quien: 'Tablet del mozo' },
  { href: '/caja', icono: '💵', titulo: 'Caja', texto: 'Turno con arqueo ciego, cobro mixto o dividido, boletas y facturas, agotados.', quien: 'Terminal de caja' },
  { href: '/cocina', icono: '🔥', titulo: 'Cocina', texto: 'Comandas con alarma sonora (simula la ticketera del maestro pollero).', quien: 'Estación del pollero' },
  { href: '/qr', icono: '🔳', titulo: 'Códigos QR', texto: 'Los 10 códigos QR de las mesas para imprimir o escanear con el celular.', quien: 'Para el comensal' },
];

export default function Inicio() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8">
        <p className="mb-2 inline-block rounded-full bg-brasa-100 px-3 py-1 text-sm font-semibold text-brasa-800">
          Versión local de desarrollo
        </p>
        <h1 className="text-4xl font-extrabold tracking-tight">🍗 Sistema para Pollerías</h1>
        <p className="mt-2 max-w-2xl text-lg text-slate-600">
          Elige la pantalla según el equipo. Los pagos con Yape, la emisión ante SUNAT y la impresora de cocina están simulados.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
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
        <b>Usuarios de prueba:</b> Mozo (PIN 1111), Cajera (PIN 2222), Administrador (PIN 1234). Cámbialos antes de usar el sistema en el local.
      </div>
    </main>
  );
}
