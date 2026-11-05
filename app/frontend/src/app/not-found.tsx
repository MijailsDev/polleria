import { MODO } from '@/lib/modo';

/** Página no encontrada. En el dominio del comensal no menciona nada del personal. */
export default function NoEncontrada() {
  return (
    <main className="alto-pantalla grid place-items-center p-6 text-center">
      <div>
        <div className="text-6xl">🍗</div>
        <h1 className="mt-3 text-2xl font-extrabold">Página no encontrada</h1>
        <p className="mx-auto mt-2 max-w-sm text-lg text-slate-700">
          {MODO === 'comensal' ? 'Para ver la carta y pedir, escanea el código QR de tu mesa con la cámara de tu celular.' : 'La dirección no existe.'}
        </p>
        <a href="/" className="btn-primario mt-6">
          Ir al inicio
        </a>
      </div>
    </main>
  );
}
