'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';

const MESAS = Array.from({ length: 10 }, (_, i) => `M-${String(i + 1).padStart(2, '0')}`);

/**
 * Códigos QR de las 10 mesas, listos para imprimir y pegar en los parantes acrílicos.
 * Usan la dirección con la que se abrió esta página: ábrela con la IP de la laptop
 * (por ejemplo http://192.168.1.20:3000/qr) para que los celulares de la red puedan entrar.
 */
export default function PaginaQR() {
  const [base, setBase] = useState('');
  const [imagenes, setImagenes] = useState<Record<string, string>>({});

  useEffect(() => {
    const b = window.location.origin;
    setBase(b);
    Promise.all(MESAS.map(async (m) => [m, await QRCode.toDataURL(`${b}/m/${m}`, { margin: 1, width: 280 })] as const)).then((l) =>
      setImagenes(Object.fromEntries(l)),
    );
  }, []);

  const esLocalhost = base.includes('localhost') || base.includes('127.0.0.1');

  return (
    <main className="mx-auto max-w-5xl p-4">
      <div className="no-imprimir mb-4 flex flex-wrap items-center gap-3">
        <Link href="/" className="font-bold">
          ← Inicio
        </Link>
        <h1 className="text-2xl font-extrabold">Códigos QR de las mesas</h1>
        <div className="flex-1" />
        <button className="btn-primario" onClick={() => window.print()}>
          🖨 Imprimir
        </button>
      </div>
      {esLocalhost && (
        <div className="no-imprimir mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Estás en <b>localhost</b>: estos QR solo funcionan en esta laptop. Para probar con tu celular, abre esta página con la IP de la laptop en tu red
          WiFi (por ejemplo <code>http://192.168.1.20:3000/qr</code>). Puedes ver la IP con el comando <code>ipconfig</code>.
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {MESAS.map((m) => (
          <Link key={m} href={`/m/${m}`} className="tarjeta flex flex-col items-center p-4 text-center">
            <div className="text-sm font-semibold text-slate-500">Escanea y pide desde tu celular</div>
            {imagenes[m] ? <img src={imagenes[m]} alt={`QR mesa ${m}`} className="my-2 h-40 w-40" /> : <div className="my-2 h-40 w-40 animate-pulse bg-slate-100" />}
            <div className="text-2xl font-extrabold">Mesa {m}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
