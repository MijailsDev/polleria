'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '@/lib/api';
import { soles } from '@/lib/util';

export interface Comprobante {
  id: string;
  tipo: 'BOLETA' | 'FACTURA' | 'NOTA_CREDITO';
  numero: string;
  emitidoEn: string;
  documento: string | null;
  nombre: string | null;
  mesa: string | null;
  items: { cantidad: number; descripcion: string; importe: number }[];
  base: number;
  impuesto: number;
  total: number;
  tasa: number;
  estadoSunat: string;
  motivo: string | null;
  referencia: string | null;
  qr: string;
}

const TITULO = { BOLETA: 'BOLETA DE VENTA', FACTURA: 'FACTURA', NOTA_CREDITO: 'NOTA DE CRÉDITO' };

/** Ticket de 80 mm del comprobante electrónico (simulado, sin envío real a SUNAT). */
export function TicketComprobante({ c, qr }: { c: Comprobante; qr: string }) {
  return (
    <div className="w-[320px] bg-white p-5 font-mono text-[13px] text-black shadow-xl">
      <div className="text-center">
        <div className="text-base font-black">POLLERÍA Y BRASAS DEL SUR</div>
        <div>RUC 20000000001</div>
        <div>Puerto Maldonado - Madre de Dios</div>
        <div className="mt-2 font-black">{TITULO[c.tipo]} ELECTRÓNICA</div>
        <div className="font-black">{c.numero}</div>
      </div>
      <div className="mt-2 border-t border-dashed border-black pt-2">
        <div>Fecha: {new Date(c.emitidoEn).toLocaleString('es-PE')}</div>
        {c.mesa && <div>Origen: {c.mesa}</div>}
        <div>
          {c.documento?.length === 11 ? 'RUC' : 'DNI'}: {c.documento ?? '-'}
        </div>
        <div>Cliente: {c.nombre ?? 'CLIENTES VARIOS'}</div>
        {c.referencia && <div>Documento que modifica: {c.referencia}</div>}
        {c.motivo && <div>Motivo: {c.motivo}</div>}
      </div>
      <div className="mt-2 border-t border-dashed border-black pt-2">
        {c.items.map((i, k) => (
          <div key={k} className="flex justify-between gap-2">
            <span>
              {i.cantidad} {i.descripcion}
            </span>
            <span>{i.importe.toFixed(2)}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 border-t border-dashed border-black pt-2">
        <div className="flex justify-between">
          <span>OP. GRAVADA</span>
          <span>{c.base.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>IGV + IPM ({(c.tasa * 100).toFixed(1)}%)</span>
          <span>{c.impuesto.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-base font-black">
          <span>TOTAL</span>
          <span>{soles(c.total)}</span>
        </div>
      </div>
      {qr && <img src={qr} alt="Código QR tributario" className="mx-auto mt-3 h-32 w-32" />}
      <div className="mt-2 text-center text-[11px]">
        Representación impresa del comprobante electrónico.
        <br />
        Estado SUNAT: {c.estadoSunat === 'PENDIENTE' ? 'EN COLA, se enviará al volver internet' : c.estadoSunat} (simulado)
      </div>
    </div>
  );
}

export function useComprobante(id: string, publico = false) {
  const [c, setC] = useState<Comprobante | null>(null);
  const [qr, setQr] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    api<Comprobante>('GET', `${publico ? '/publico' : ''}/comprobantes/${id}`)
      .then(async (x) => {
        setC(x);
        setQr(await QRCode.toDataURL(x.qr, { margin: 1, width: 160 }));
      })
      .catch((e) => setError(e.message));
  }, [id, publico]);
  return { c, qr, error };
}

/** Ventana del comprobante con impresión y entrega digital por WhatsApp o QR de descarga (REQ-FAC-06). */
export function ComprobanteImpreso({ id, vuelto, alCerrar }: { id: string; vuelto?: number; alCerrar: () => void }) {
  const { c, qr } = useComprobante(id);
  const [celular, setCelular] = useState('');
  const [qrDescarga, setQrDescarga] = useState('');
  const enlace = typeof window !== 'undefined' ? `${window.location.origin}/c/${id}` : '';

  useEffect(() => {
    if (enlace) QRCode.toDataURL(enlace, { margin: 1, width: 140 }).then(setQrDescarga);
  }, [enlace]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={alCerrar}>
      <div className="flex max-h-[94vh] flex-col gap-3 overflow-y-auto md:flex-row md:items-start" onClick={(e) => e.stopPropagation()}>
        <div>
          {vuelto !== undefined && vuelto > 0 && (
            <div className="no-imprimir mb-3 rounded-2xl bg-green-700 p-4 text-center text-white">
              <div className="text-sm">Entregar vuelto</div>
              <div className="text-4xl font-black">{soles(vuelto)}</div>
            </div>
          )}
          {c ? <TicketComprobante c={c} qr={qr} /> : <div className="w-[320px] bg-white p-5">Cargando…</div>}
          <div className="no-imprimir mt-3 grid grid-cols-2 gap-2">
            <button className="btn-secundario" onClick={() => window.print()}>
              🖨 Imprimir
            </button>
            <button className="btn-primario" onClick={alCerrar}>
              Listo
            </button>
          </div>
        </div>
        <div className="no-imprimir w-[320px] rounded-2xl bg-white p-4 shadow-xl md:w-64">
          <h4 className="font-bold">Entrega sin imprimir</h4>
          <p className="mb-2 text-xs text-slate-500">El cliente escanea este QR para descargar su comprobante.</p>
          {qrDescarga && <img src={qrDescarga} alt="QR de descarga" className="mx-auto h-36 w-36" />}
          <label className="mt-3 block text-sm font-semibold">Enviar por WhatsApp</label>
          <div className="mt-1 flex gap-2">
            <input className="campo min-h-10 text-sm" inputMode="numeric" placeholder="987654321" maxLength={9} value={celular} onChange={(e) => setCelular(e.target.value.replace(/\D/g, ''))} />
            <a
              className={`btn-verde min-h-10 px-3 text-sm ${/^9\d{8}$/.test(celular) ? '' : 'pointer-events-none opacity-50'}`}
              target="_blank"
              rel="noreferrer"
              href={`https://wa.me/51${celular}?text=${encodeURIComponent(`Pollería y Brasas del Sur: tu comprobante ${c?.numero ?? ''} está aquí ${enlace}`)}`}
            >
              Enviar
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
