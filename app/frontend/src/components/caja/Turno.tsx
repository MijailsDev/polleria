'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { hora, soles } from '@/lib/util';
import { MEDIO } from '@/lib/tipos';
import { PedirPin } from '@/components/PedirPin';

type Avisar = (a: { texto: string; tipo?: 'error' | 'ok' }) => void;
export interface TurnoAbierto { id: string; apertura: string; fondoInicial: number; declarado: boolean }
export interface Reporte {
  cajero: string;
  apertura: string;
  cierre: string | null;
  fondoInicial: number;
  ventasPorMedio: Record<string, number>;
  ventasPorCanal: Record<string, number>;
  totalVentas: number;
  ingresos: number;
  egresos: number;
  efectivoDelivery: number;
  descuentos: number;
  anulaciones: { cantidad: number; importe: number };
  fugas: { cantidad: number; importe: number };
  notasCredito: { cantidad: number; importe: number };
  mermas: { cantidad: number; pollos: number };
  efectivoEsperado: number;
  efectivoDeclarado: number | null;
  diferencia: number | null;
  comentario: string | null;
  comprobantes: { numero: string; tipo: string; total: number }[];
}

// Billetes y monedas para el arqueo por denominación (REQ-TUR-03)
const DENOMINACIONES = [200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1];

/** Turno: movimientos de efectivo, apertura de gaveta, cierre ciego por denominación y Reporte Z (F-11). */
export function TurnoPanel({ turno, alAviso, alCerrar }: { turno: TurnoAbierto; alAviso: Avisar; alCerrar: () => void }) {
  const [mov, setMov] = useState({ tipo: 'EGRESO', monto: '', motivo: '', pinAdmin: '' });
  const [conteo, setConteo] = useState<Record<string, string>>({});
  const [comentario, setComentario] = useState('');
  const [pideComentario, setPideComentario] = useState<{ esperado: number; declarado: number; diferencia: number } | null>(null);
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [gaveta, setGaveta] = useState(false);

  const declarado = Math.round(DENOMINACIONES.reduce((s, d) => s + d * Number(conteo[d] || 0), 0) * 100) / 100;

  async function registrarMovimiento() {
    try {
      await api('POST', '/turnos/movimiento', { ...mov, monto: Number(mov.monto), pinAdmin: mov.pinAdmin || undefined });
      alAviso({ texto: 'Movimiento registrado', tipo: 'ok' });
      setMov({ tipo: 'EGRESO', monto: '', motivo: '', pinAdmin: '' });
    } catch (e: any) {
      alAviso({ texto: e.message, tipo: 'error' });
    }
  }

  async function cerrar() {
    try {
      const r = await api<any>('POST', '/turnos/cerrar', { efectivoDeclarado: declarado, comentario: comentario || undefined });
      if (r.requiereComentario) setPideComentario(r);
      else setReporte(r.reporte);
    } catch (e: any) {
      alAviso({ texto: e.message, tipo: 'error' });
    }
  }

  if (reporte) return <ReporteZ r={reporte} alSalir={alCerrar} />;

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-2">
      <section className="tarjeta p-5">
        <h2 className="text-lg font-bold">Turno abierto</h2>
        <p className="text-slate-500">
          Desde las {hora(turno.apertura)} · fondo inicial {soles(turno.fondoInicial)}
        </p>
        <h3 className="mb-2 mt-5 font-bold">Ingreso o egreso de efectivo</h3>
        <div className="mb-2 grid grid-cols-2 gap-2">
          {['EGRESO', 'INGRESO'].map((t) => (
            <button key={t} className={mov.tipo === t ? 'chip-on min-h-12' : 'chip-off min-h-12'} onClick={() => setMov({ ...mov, tipo: t })}>
              {t === 'EGRESO' ? 'Egreso (sale dinero)' : 'Ingreso'}
            </button>
          ))}
        </div>
        <input className="campo mb-2" inputMode="decimal" placeholder="Monto (S/)" value={mov.monto} onChange={(e) => setMov({ ...mov, monto: e.target.value })} />
        <input className="campo mb-2" placeholder="Motivo (ej.: compra de gas)" value={mov.motivo} onChange={(e) => setMov({ ...mov, motivo: e.target.value })} />
        {mov.tipo === 'EGRESO' && Number(mov.monto) > 50 && (
          <input className="campo mb-2" type="password" inputMode="numeric" placeholder="PIN del administrador (egresos grandes)" value={mov.pinAdmin} onChange={(e) => setMov({ ...mov, pinAdmin: e.target.value })} />
        )}
        <button className="btn-secundario w-full" onClick={registrarMovimiento}>
          Registrar
        </button>
        <button className="btn-secundario mt-4 w-full" onClick={() => setGaveta(true)}>
          🗄 Abrir gaveta sin venta
        </button>
      </section>

      <section className="tarjeta p-5">
        <h2 className="text-lg font-bold">Cerrar turno (arqueo ciego)</h2>
        <p className="mb-3 text-sm text-slate-500">Cuenta los billetes y monedas de la gaveta. El sistema no te muestra cuánto espera hasta que declares.</p>
        {!pideComentario ? (
          <>
            <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {DENOMINACIONES.map((d) => (
                <label key={d} className="rounded-xl bg-slate-50 p-2 text-xs font-semibold">
                  {d >= 10 ? '💵' : '🪙'} S/ {d < 1 ? d.toFixed(2) : d}
                  <input className="campo mt-1 min-h-10 text-center" inputMode="numeric" placeholder="0" value={conteo[d] ?? ''} onChange={(e) => setConteo({ ...conteo, [d]: e.target.value.replace(/\D/g, '') })} />
                </label>
              ))}
            </div>
            <div className="mb-3 flex justify-between rounded-xl bg-slate-900 p-3 text-lg font-bold text-white">
              <span>Efectivo contado</span>
              <span>{soles(declarado)}</span>
            </div>
            <button className="btn-rojo w-full" onClick={cerrar}>
              Declarar y cerrar turno
            </button>
          </>
        ) : (
          <div className="animar-entrada">
            <div className="mb-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-slate-100 p-3">
                <div className="text-xs text-slate-500">Esperado</div>
                <b>{soles(pideComentario.esperado)}</b>
              </div>
              <div className="rounded-xl bg-slate-100 p-3">
                <div className="text-xs text-slate-500">Declarado</div>
                <b>{soles(pideComentario.declarado)}</b>
              </div>
              <div className="rounded-xl bg-red-50 p-3 text-red-700">
                <div className="text-xs">Diferencia</div>
                <b>{soles(pideComentario.diferencia)}</b>
              </div>
            </div>
            <p className="mb-2 text-sm font-semibold">La diferencia supera el margen permitido: explica el motivo para cerrar.</p>
            <textarea className="campo mb-3 min-h-24 py-3" value={comentario} onChange={(e) => setComentario(e.target.value)} />
            <button className="btn-rojo w-full" disabled={!comentario.trim()} onClick={cerrar}>
              Cerrar turno con este comentario
            </button>
          </div>
        )}
      </section>

      {gaveta && (
        <PedirPin
          titulo="Abrir gaveta sin venta"
          motivos={['Cambio de sencillo', 'Revisión de caja']}
          alCerrar={() => setGaveta(false)}
          alConfirmar={(pinAdmin, motivo) => api('POST', '/gaveta/abrir', { pinAdmin, motivo })}
        />
      )}
    </div>
  );
}

const fila = (t: string, v: string | number, negrita = false) => (
  <div className={`flex justify-between ${negrita ? 'font-black' : ''}`}>
    <span>{t}</span>
    <span>{typeof v === 'number' ? v.toFixed(2) : v}</span>
  </div>
);

/** Reporte Z (o X) del turno en formato ticket (REQ-TUR-05). */
export function ReporteZ({ r, alSalir, titulo = 'REPORTE Z · CIERRE DE TURNO' }: { r: Reporte; alSalir: () => void; titulo?: string }) {
  return (
    <div className="mx-auto my-6 max-w-md px-4">
      <div className="bg-white p-6 font-mono text-sm shadow-xl">
        <div className="text-center text-lg font-black">{titulo}</div>
        <div className="mt-2 border-t border-dashed border-black pt-2">
          <div>Cajero: {r.cajero}</div>
          <div>Apertura: {new Date(r.apertura).toLocaleString('es-PE')}</div>
          <div>Cierre: {r.cierre ? new Date(r.cierre).toLocaleString('es-PE') : 'turno abierto'}</div>
        </div>
        <div className="mt-2 border-t border-dashed border-black pt-2">
          <div className="font-bold">VENTAS POR MEDIO DE PAGO</div>
          {Object.entries(r.ventasPorMedio).map(([m, v]) => fila(MEDIO[m] ?? m, v))}
          {fila('TOTAL VENTAS', soles(r.totalVentas), true)}
        </div>
        {Object.keys(r.ventasPorCanal).length > 0 && (
          <div className="mt-2 border-t border-dashed border-black pt-2">
            <div className="font-bold">VENTAS POR CANAL</div>
            {Object.entries(r.ventasPorCanal).map(([c, v]) => fila(c, v))}
          </div>
        )}
        <div className="mt-2 border-t border-dashed border-black pt-2">
          {fila('Fondo inicial', r.fondoInicial)}
          {fila('Ingresos', r.ingresos)}
          {fila('Egresos', -r.egresos)}
          {r.efectivoDelivery > 0 && fila('Efectivo de repartidores', r.efectivoDelivery)}
          {fila('Efectivo esperado', r.efectivoEsperado, true)}
          {fila('Efectivo declarado', r.efectivoDeclarado ?? 0, true)}
          {fila('DIFERENCIA', r.diferencia ?? 0, true)}
          {r.comentario && <div className="mt-1">Motivo: {r.comentario}</div>}
        </div>
        <div className="mt-2 border-t border-dashed border-black pt-2">
          <div className="font-bold">CONTROL</div>
          {fila('Descuentos', r.descuentos)}
          {fila(`Anulaciones (${r.anulaciones.cantidad})`, r.anulaciones.importe)}
          {fila(`Notas de crédito (${r.notasCredito.cantidad})`, r.notasCredito.importe)}
          {fila(`Fugas de comensal (${r.fugas.cantidad})`, r.fugas.importe)}
          {fila(`Mermas y reposiciones (${r.mermas.cantidad})`, `${r.mermas.pollos.toFixed(3)} pollos`)}
        </div>
        <div className="mt-2 border-t border-dashed border-black pt-2">
          <div className="font-bold">Comprobantes ({r.comprobantes.length})</div>
          {r.comprobantes.map((c) => fila(c.numero, c.tipo === 'NOTA_CREDITO' ? -c.total : c.total))}
        </div>
      </div>
      <div className="no-imprimir mt-3 grid grid-cols-2 gap-2">
        <button className="btn-secundario" onClick={() => window.print()}>
          🖨 Imprimir
        </button>
        <button className="btn-primario" onClick={alSalir}>
          Listo
        </button>
      </div>
    </div>
  );
}
