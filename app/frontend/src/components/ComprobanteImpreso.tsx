'use client';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '@/lib/api';
import { soles } from '@/lib/util';

interface Comprobante {
  id: string;
  tipo: 'BOLETA' | 'FACTURA';
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
  qr: string;
}

/** Representación impresa del comprobante en formato ticket de 80 mm (simulada, sin envío real a SUNAT). */
export function ComprobanteImpreso({ id, vuelto, alCerrar }: { id: string; vuelto?: number; alCerrar: () => void }) {
  const [c, setC] = useState<Comprobante | null>(null);
  const [qr, setQr] = useState('');

  useEffect(() => {
    api<Comprobante>('GET', `/comprobantes/${id}`).then(async (x) => {
      setC(x);
      setQr(await QRCode.toDataURL(x.qr, { margin: 1, width: 160 }));
    });
  }, [id]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={alCerrar}>
      <div className="max-h-[94vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {vuelto !== undefined && vuelto > 0 && (
          <div className="no-imprimir mb-3 rounded-2xl bg-green-700 p-4 text-center text-white">
            <div className="text-sm">Entregar vuelto</div>
            <div className="text-4xl font-black">{soles(vuelto)}</div>
          </div>
        )}
        <div className="w-[320px] bg-white p-5 font-mono text-[13px] text-black shadow-xl">
          {!c ? (
            <p>Cargando…</p>
          ) : (
            <>
              <div className="text-center">
                <div className="text-base font-black">POLLERÍA Y BRASAS DEL SUR</div>
                <div>RUC 20000000001</div>
                <div>Puerto Maldonado - Madre de Dios</div>
                <div className="mt-2 font-black">{c.tipo === 'FACTURA' ? 'FACTURA' : 'BOLETA DE VENTA'} ELECTRÓNICA</div>
                <div className="font-black">{c.numero}</div>
              </div>
              <div className="mt-2 border-t border-dashed border-black pt-2">
                <div>Fecha: {new Date(c.emitidoEn).toLocaleString('es-PE')}</div>
                {c.mesa && <div>Mesa: {c.mesa}</div>}
                <div>
                  {c.tipo === 'FACTURA' ? 'RUC' : 'DNI'}: {c.documento ?? '-'}
                </div>
                <div>Cliente: {c.nombre ?? 'CLIENTES VARIOS'}</div>
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
                Estado SUNAT: {c.estadoSunat} (simulado)
              </div>
            </>
          )}
        </div>
        <div className="no-imprimir mt-3 grid grid-cols-2 gap-2">
          <button className="btn-secundario" onClick={() => window.print()}>
            🖨 Imprimir
          </button>
          <button className="btn-primario" onClick={alCerrar}>
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
