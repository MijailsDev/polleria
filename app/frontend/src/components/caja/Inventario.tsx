'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useEventos } from '@/lib/util';
import { PedirPin } from '@/components/PedirPin';

type Avisar = (a: { texto: string; tipo?: 'error' | 'ok' }) => void;
interface Resumen {
  stock: { pollos: number; pecho: number; pierna: number };
  minimoPollos: number;
  umbralPresas: number;
  alertas: string[];
  kardex: { id: string; fecha: string; tipo: string; pollos: number; pecho: number; pierna: number; motivo: string | null; autorizadoPor: string | null; pedido: string | null }[];
}

const MOTIVOS_MERMA = [
  ['SOBRECOCCION', 'Sobrecocción'],
  ['CAIDA', 'Caída'],
  ['CRUDO', 'Crudo'],
  ['ENTREGA_FALLIDA', 'Entrega fallida'],
  ['OTRO', 'Otro'],
] as const;

const COLOR_TIPO: Record<string, string> = {
  INGRESO: 'bg-green-100 text-green-800',
  VENTA: 'bg-slate-100 text-slate-700',
  MERMA: 'bg-red-100 text-red-800',
  REPOSICION: 'bg-amber-100 text-amber-800',
  AJUSTE: 'bg-blue-100 text-blue-800',
};

const n = (v: number, d = 3) => (Math.abs(v) < 1e-9 ? '' : (v > 0 ? '+' : '') + Number(v.toFixed(d)));

/** Inventario de pollos y presas (F-13): stock en tiempo real, ingresos, mermas con PIN y conteo físico. */
export function Inventario({ alAviso }: { alAviso: Avisar }) {
  const [r, setR] = useState<Resumen | null>(null);
  const [ingreso, setIngreso] = useState('');
  const [merma, setMerma] = useState(false);
  const [m, setM] = useState({ motivo: 'CAIDA', pollos: '', pecho: '', pierna: '', detalle: '' });
  const [conteo, setConteo] = useState(false);
  const [c, setC] = useState({ pollos: '', pecho: '', pierna: '' });
  const [resultado, setResultado] = useState<{ diferencia: Resumen['stock'] } | null>(null);

  const cargar = useCallback(() => api<Resumen>('GET', '/inventario').then(setR).catch((e) => alAviso({ texto: e.message, tipo: 'error' })), [alAviso]);
  useEffect(() => {
    cargar();
  }, [cargar]);
  useEventos({ 'inventario:cambio': cargar, 'cocina:comanda': cargar });

  if (!r) return null;
  const tarjeta = (titulo: string, valor: number, unidad: string, bajo: boolean) => (
    <div className={`tarjeta p-5 ${bajo ? 'border-red-400 bg-red-50' : ''}`}>
      <div className="text-sm font-semibold text-slate-500">{titulo}</div>
      <div className={`text-4xl font-black ${bajo ? 'text-red-700' : ''}`}>{Number(valor.toFixed(3))}</div>
      <div className="text-xs text-slate-500">{unidad}</div>
    </div>
  );

  return (
    <div className="space-y-4 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {tarjeta('Pollos', r.stock.pollos, `mínimo ${r.minimoPollos}`, r.stock.pollos < r.minimoPollos)}
        {tarjeta('Cuartos de pecho con ala', r.stock.pecho, `se agota bajo ${r.umbralPresas}`, r.stock.pecho < r.umbralPresas)}
        {tarjeta('Cuartos de pierna con encuentro', r.stock.pierna, `se agota bajo ${r.umbralPresas}`, r.stock.pierna < r.umbralPresas)}
      </div>
      {r.alertas.length > 0 && <div className="rounded-xl bg-red-600 p-3 font-semibold text-white">⚠ {r.alertas.join(' · ')}</div>}

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="tarjeta p-5">
          <h3 className="font-bold">Ingreso de pollos</h3>
          <p className="mb-2 text-sm text-slate-500">Cada pollo suma 2 cuartos de pecho y 2 de pierna.</p>
          <div className="flex gap-2">
            <input className="campo" inputMode="numeric" placeholder="Cantidad" value={ingreso} onChange={(e) => setIngreso(e.target.value.replace(/\D/g, ''))} />
            <button
              className="btn-verde"
              disabled={!ingreso}
              onClick={() =>
                api('POST', '/inventario/ingreso', { pollos: Number(ingreso) })
                  .then(() => (alAviso({ texto: `Ingresaron ${ingreso} pollos`, tipo: 'ok' }), setIngreso(''), cargar()))
                  .catch((e) => alAviso({ texto: e.message, tipo: 'error' }))
              }
            >
              Registrar
            </button>
          </div>
        </section>
        <section className="tarjeta p-5">
          <h3 className="font-bold">Merma</h3>
          <p className="mb-2 text-sm text-slate-500">Pollo que se perdió (caída, sobrecocción…). Requiere PIN del administrador.</p>
          <button className="btn-secundario w-full" onClick={() => setMerma(true)}>
            Registrar merma
          </button>
        </section>
        <section className="tarjeta p-5">
          <h3 className="font-bold">Conteo físico (cierre del día)</h3>
          <p className="mb-2 text-sm text-slate-500">Compara lo que hay con el stock teórico y ajusta la diferencia.</p>
          <button className="btn-secundario w-full" onClick={() => setConteo(true)}>
            Registrar conteo
          </button>
          {resultado && (
            <p className="mt-2 text-sm">
              Diferencia no justificada: <b>{n(resultado.diferencia.pollos) || '0'}</b> pollos · <b>{n(resultado.diferencia.pecho, 2) || '0'}</b> pecho ·{' '}
              <b>{n(resultado.diferencia.pierna, 2) || '0'}</b> pierna
            </p>
          )}
        </section>
      </div>

      <section className="tarjeta overflow-x-auto p-5">
        <h3 className="mb-2 font-bold">Kardex (últimos movimientos)</h3>
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="py-1">Fecha</th>
              <th>Tipo</th>
              <th className="text-right">Pollos</th>
              <th className="text-right">Pecho</th>
              <th className="text-right">Pierna</th>
              <th className="pl-3">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {r.kardex.map((k) => (
              <tr key={k.id} className="border-t border-slate-100">
                <td className="py-1.5">{new Date(k.fecha).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td>
                  <span className={`rounded px-2 text-xs font-bold ${COLOR_TIPO[k.tipo]}`}>{k.tipo}</span>
                </td>
                <td className="text-right font-mono">{n(k.pollos)}</td>
                <td className="text-right font-mono">{n(k.pecho, 2)}</td>
                <td className="text-right font-mono">{n(k.pierna, 2)}</td>
                <td className="pl-3 text-slate-600">
                  {k.pedido && `Pedido ${k.pedido} `}
                  {k.motivo}
                  {k.autorizadoPor && <span className="text-xs text-slate-400"> · {k.autorizadoPor}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {merma && (
        <PedirPin
          titulo="Registrar merma"
          pedirMotivo={false}
          peligro
          alCerrar={() => setMerma(false)}
          alConfirmar={async (pinAdmin) => {
            await api('POST', '/inventario/merma', {
              motivo: m.motivo,
              detalle: m.detalle,
              pollos: Number(m.pollos || 0),
              pecho: Number(m.pecho || 0),
              pierna: Number(m.pierna || 0),
              pinAdmin,
            });
            alAviso({ texto: 'Merma registrada', tipo: 'ok' });
            setM({ motivo: 'CAIDA', pollos: '', pecho: '', pierna: '', detalle: '' });
            cargar();
          }}
        >
          <div className="mb-2 flex flex-wrap gap-1">
            {MOTIVOS_MERMA.map(([k, t]) => (
              <button key={k} className={m.motivo === k ? 'chip-on' : 'chip-off'} onClick={() => setM({ ...m, motivo: k })}>
                {t}
              </button>
            ))}
          </div>
          <div className="mb-2 grid grid-cols-3 gap-2 text-xs font-semibold">
            <label>
              Pollos (ej. 0.25)
              <input className="campo mt-1" inputMode="decimal" value={m.pollos} onChange={(e) => setM({ ...m, pollos: e.target.value })} />
            </label>
            <label>
              Cuartos pecho
              <input className="campo mt-1" inputMode="decimal" value={m.pecho} onChange={(e) => setM({ ...m, pecho: e.target.value })} />
            </label>
            <label>
              Cuartos pierna
              <input className="campo mt-1" inputMode="decimal" value={m.pierna} onChange={(e) => setM({ ...m, pierna: e.target.value })} />
            </label>
          </div>
          <input className="campo mb-3" placeholder="Detalle (opcional)" value={m.detalle} onChange={(e) => setM({ ...m, detalle: e.target.value })} />
        </PedirPin>
      )}
      {conteo && (
        <PedirPin
          titulo="Conteo físico"
          descripcion={`Teórico: ${r.stock.pollos} pollos · ${r.stock.pecho} pecho · ${r.stock.pierna} pierna`}
          pedirMotivo={false}
          textoBoton="Registrar conteo"
          alCerrar={() => setConteo(false)}
          alConfirmar={async (pinAdmin) => {
            const x = await api<{ diferencia: Resumen['stock'] }>('POST', '/inventario/conteo', { pollos: Number(c.pollos), pecho: Number(c.pecho), pierna: Number(c.pierna), pinAdmin });
            setResultado(x);
            setC({ pollos: '', pecho: '', pierna: '' });
            alAviso({ texto: 'Conteo registrado', tipo: 'ok' });
            cargar();
          }}
        >
          <div className="mb-3 grid grid-cols-3 gap-2 text-xs font-semibold">
            {(['pollos', 'pecho', 'pierna'] as const).map((k) => (
              <label key={k}>
                {k === 'pollos' ? 'Pollos' : k === 'pecho' ? 'Cuartos pecho' : 'Cuartos pierna'}
                <input className="campo mt-1" inputMode="decimal" value={c[k]} onChange={(e) => setC({ ...c, [k]: e.target.value })} />
              </label>
            ))}
          </div>
        </PedirPin>
      )}
    </div>
  );
}
