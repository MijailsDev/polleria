'use client';
import { use } from 'react';
import { TicketComprobante, useComprobante } from '@/components/ComprobanteImpreso';

/** Página pública del comprobante: se abre desde el QR de descarga o el enlace de WhatsApp (REQ-FAC-06). */
export default function PaginaComprobante({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { c, qr, error } = useComprobante(id, true);
  return (
    <main className="flex min-h-screen flex-col items-center gap-4 bg-slate-100 p-4">
      <h1 className="no-imprimir mt-4 text-xl font-extrabold">🍗 Tu comprobante</h1>
      {error && <p className="font-semibold text-red-600">{error}</p>}
      {!c && !error && <p>Cargando…</p>}
      {c && <TicketComprobante c={c} qr={qr} />}
      {c && (
        <button className="btn-primario no-imprimir" onClick={() => window.print()}>
          ⬇ Guardar como PDF
        </button>
      )}
    </main>
  );
}
