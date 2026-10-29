'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Comanda } from '@/lib/tipos';
import { hora, minutosDesde, pitido, useConexion, useEventos } from '@/lib/util';

interface Especial { id: string; tipo: 'ANULACIÓN' | 'REIMPRESIÓN'; detalle: string; comanda: Comanda; hora: string }

const PRESA = ['Presa', 'Presas', 'Corte'];
const CRITICO = /sin sal|bien doradas|sin ensalada|sin papas|8 presas/i;
const SIERRA =
  'polygon(0 0,100% 0,100% calc(100% - 8px),95% 100%,90% calc(100% - 8px),85% 100%,80% calc(100% - 8px),75% 100%,70% calc(100% - 8px),65% 100%,60% calc(100% - 8px),55% 100%,50% calc(100% - 8px),45% 100%,40% calc(100% - 8px),35% 100%,30% calc(100% - 8px),25% 100%,20% calc(100% - 8px),15% 100%,10% calc(100% - 8px),5% 100%,0 calc(100% - 8px))';

/** Cuerpo del ticket: origen en grande, presa en mayúsculas y opciones críticas resaltadas (REQ-COC-02). */
function Ticket({ c, marca, detalle }: { c: Comanda; marca?: string; detalle?: string }) {
  const items = c.items.filter((i) => i.destino !== 'CAJA');
  return (
    <>
      {marca && <div className="mb-2 bg-black py-1 text-center text-lg font-black text-white">*** {marca} ***</div>}
      <div className="border-b-2 border-dashed border-stone-400 pb-2 text-center text-2xl font-black leading-tight">{c.origen}</div>
      <div className="flex justify-between border-b-2 border-dashed border-stone-400 py-1 text-sm">
        <span>ORDEN #{c.numero}</span>
        <span>{hora(c.impresoEn ?? c.creadoEn)}</span>
      </div>
      <div className="py-1 text-xs">
        {c.canal === 'SALON' ? 'MOZO' : 'CAJA'}: {c.mozo.toUpperCase()}
        {c.horaProgramada && <b> · RECOJO {hora(c.horaProgramada)}</b>}
      </div>
      {detalle && <div className="bg-stone-200 px-1 py-1 text-sm font-black">{detalle.toUpperCase()}</div>}
      <div className="space-y-2 border-t-2 border-dashed border-stone-400 py-2">
        {items.map((it) => {
          const presa = it.opciones.filter((o) => PRESA.includes(o.grupo));
          const resto = it.opciones.filter((o) => !PRESA.includes(o.grupo));
          return (
            <div key={it.id}>
              <div className="text-lg font-black">
                {it.cantidad}× {it.producto.toUpperCase()}
              </div>
              {presa.map((o, j) => (
                <div key={j} className="bg-black px-1 text-lg font-black text-white">
                  &gt;&gt; {o.nombre.toUpperCase()} &lt;&lt;
                </div>
              ))}
              {resto.map((o, j) => (
                <div key={j} className={`pl-3 ${CRITICO.test(o.nombre) ? 'font-black underline' : ''}`}>
                  - {o.grupo}: {o.nombre.toUpperCase()}
                </div>
              ))}
              {it.nota && <div className="pl-3 font-black">NOTA: {it.nota.toUpperCase()}</div>}
            </div>
          );
        })}
      </div>
    </>
  );
}

/**
 * Simula la ticketera de la estación del maestro pollero (F-06): cada comanda nueva
 * suena como el buzzer; las anulaciones, reimpresiones y reposiciones usan doble pitido.
 * Las bebidas (destino CAJA) no aparecen aquí, igual que en la impresora real.
 */
export default function PaginaCocina() {
  const [comandas, setComandas] = useState<Comanda[]>([]);
  const [especiales, setEspeciales] = useState<Especial[]>([]);
  const [sonido, setSonido] = useState(false);
  const [nuevas, setNuevas] = useState<Set<string>>(new Set());
  const [carga, setCarga] = useState({ pendientes: 0, umbral: 12, demora: false });
  const conectado = useConexion();
  const [, setTic] = useState(0);

  const cargar = () => {
    api<Comanda[]>('GET', '/cocina').then(setComandas).catch(() => {});
    api('GET', '/cocina/carga').then(setCarga).catch(() => {});
  };
  useEffect(() => {
    cargar();
    const t = setInterval(() => setTic((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  useEventos(
    {
      'cocina:comanda': (c: Comanda) => {
        if (sonido) c.reposicion ? pitido(2, 660) : pitido(3);
        setNuevas((n) => new Set(n).add(c.id));
        setTimeout(() => setNuevas((n) => { const x = new Set(n); x.delete(c.id); return x; }), 6000);
        cargar();
      },
      'cocina:especial': (e: Omit<Especial, 'id'>) => {
        if (sonido) pitido(2, 660); // patrón distinto para tickets especiales (REQ-COC-03)
        setEspeciales((l) => [{ ...e, id: `${Date.now()}-${Math.random()}` }, ...l].slice(0, 12));
      },
      'cocina:actualizar': cargar,
    },
    [sonido],
  );

  const visibles = comandas.filter((c) => c.items.some((i) => i.destino !== 'CAJA'));

  return (
    <div className="min-h-screen bg-stone-800 text-stone-900">
      <header className="flex flex-wrap items-center gap-3 bg-stone-950 px-4 py-3 text-white">
        <Link href="/" className="text-lg font-bold">
          🔥 Estación del pollero
        </Link>
        <span className="text-sm text-stone-400">Simulación de la ticketera con buzzer</span>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${carga.demora ? 'bg-red-500' : 'bg-stone-700'}`}>
          {carga.pendientes} en cola{carga.demora ? ' · la carta avisa demora' : ''}
        </span>
        <div className="flex-1" />
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${conectado ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {conectado ? '● En línea' : '● Sin conexión'}
        </span>
        <button
          className={`rounded-lg px-4 py-2 font-bold ${sonido ? 'bg-green-600' : 'bg-amber-500 text-black'}`}
          onClick={() => {
            setSonido((s) => !s);
            if (!sonido) pitido(1);
          }}
        >
          {sonido ? '🔊 Alarma activada' : '🔇 Toca para activar la alarma'}
        </button>
      </header>
      <main className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {especiales.map((e) => (
          <article key={e.id} className="relative border-4 border-red-600 bg-amber-50 p-4 font-mono shadow-lg animar-entrada" style={{ clipPath: SIERRA }}>
            <Ticket c={e.comanda} marca={e.tipo} detalle={e.tipo === 'ANULACIÓN' ? `ANULAR: ${e.detalle}` : undefined} />
            <button className="mt-2 w-full rounded bg-stone-900 py-2 font-sans font-bold text-white" onClick={() => setEspeciales((l) => l.filter((x) => x.id !== e.id))}>
              Retirar ticket
            </button>
          </article>
        ))}
        {visibles.length === 0 && especiales.length === 0 && <p className="col-span-full mt-20 text-center text-xl text-stone-300">Sin comandas pendientes 👍</p>}
        {visibles.map((c) => {
          const min = Math.floor((Date.now() - new Date(c.impresoEn ?? c.creadoEn).getTime()) / 60000);
          return (
            <article key={c.id} className={`bg-white p-4 font-mono shadow-lg ${nuevas.has(c.id) ? 'parpadeo' : ''}`} style={{ clipPath: SIERRA }}>
              <Ticket c={c} marca={c.reposicion ? 'REPOSICIÓN – SIN COSTO' : c.horaProgramada ? 'PROGRAMADO' : undefined} />
              <div className={`mt-1 border-t-2 border-dashed border-stone-400 pt-2 text-center text-sm font-bold ${min >= 15 ? 'text-red-600' : 'text-stone-500'}`}>
                {min >= 15 ? `⚠ ${minutosDesde(c.impresoEn)} esperando` : `hace ${minutosDesde(c.impresoEn)}`}
              </div>
              <button className="mt-2 w-full rounded bg-green-700 py-2 font-sans font-bold text-white" onClick={() => api('POST', `/cocina/${c.id}/listo`).then(cargar).catch(() => {})}>
                ✓ Listo
              </button>
            </article>
          );
        })}
      </main>
    </div>
  );
}
