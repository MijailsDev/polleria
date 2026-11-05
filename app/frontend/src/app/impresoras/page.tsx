'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { EquipoNoVinculado } from '@/components/EquipoNoVinculado';
import { hora, pitido, useEventos } from '@/lib/util';

interface Linea { t: string; b?: boolean; g?: boolean; c?: boolean }
interface TicketImpreso { id: string; impresora: string; tipo: string; lineas: Linea[]; pitidos: number; estado: string; error: string | null; hora: string }
interface Rollo { impresora: 'COCINA' | 'CAJA'; destino: { tipo: 'RED' | 'VIRTUAL'; ip: string | null }; tickets: TicketImpreso[] }

const NOMBRE = { COCINA: 'Ticketera del pollero', CAJA: 'Ticketera de caja (con gaveta)' };

/**
 * Impresoras virtuales: muestran, tal como saldría en papel de 80 mm, lo que el sistema
 * manda a cada ticketera ESC/POS. Con una IP configurada en Administración → Configuración
 * los mismos tickets salen por la impresora real.
 */
export default function PaginaImpresoras() {
  const [rollos, setRollos] = useState<Rollo[]>([]);
  const [error, setError] = useState('');
  const [sonido, setSonido] = useState(false);

  const cargar = useCallback(() => {
    Promise.all([api<Rollo>('GET', '/impresoras/cocina'), api<Rollo>('GET', '/impresoras/caja')])
      .then(setRollos)
      .catch((e) => setError(e.codigo === 'EQUIPO_NO_VINCULADO' ? 'EQUIPO' : e.message));
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);
  useEventos(
    {
      'impresion:nueva': (t: TicketImpreso) => {
        if (sonido && t.pitidos) pitido(t.pitidos, t.impresora === 'CAJA' ? 660 : 880);
        cargar();
      },
    },
    [sonido],
  );

  if (error === 'EQUIPO') return <EquipoNoVinculado />;
  return (
    <main className="min-h-screen bg-stone-800 text-stone-900">
      <header className="flex flex-wrap items-center gap-3 bg-stone-950 px-4 py-3 text-white">
        <Link href="/" className="text-lg font-bold">
          🍗 <span className="text-brasa-200">Pollería</span>
        </Link>
        <h1 className="text-lg font-semibold">Impresoras térmicas</h1>
        <div className="flex-1" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-5 w-5" checked={sonido} onChange={(e) => setSonido(e.target.checked)} />
          Sonido del buzzer
        </label>
      </header>
      {error && <p className="m-4 rounded-xl bg-red-100 p-3 font-semibold text-red-800">{error}</p>}
      <div className="grid gap-6 p-4 lg:grid-cols-2">
        {rollos.map((r) => (
          <section key={r.impresora}>
            <div className="mb-3 flex flex-wrap items-baseline gap-2 text-white">
              <h2 className="text-xl font-bold">{NOMBRE[r.impresora]}</h2>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${r.destino.tipo === 'RED' ? 'bg-green-200 text-green-900' : 'bg-stone-600 text-stone-100'}`}>
                {r.destino.tipo === 'RED' ? `Impresora real en ${r.destino.ip}` : 'Virtual (sin impresora conectada)'}
              </span>
            </div>
            <div className="flex max-h-[80vh] flex-col items-center gap-4 overflow-y-auto pb-6">
              {r.tickets.length === 0 && <p className="text-stone-300">Todavía no se imprimió nada.</p>}
              {r.tickets.map((t) => (
                <article key={t.id} className="w-[340px] bg-[#fffdf7] px-3 pb-4 pt-3 font-mono text-[12px] leading-[1.35] shadow-xl">
                  <div className="mb-1 flex justify-between text-[10px] text-stone-500">
                    <span>
                      {t.tipo} · {hora(t.hora)}
                      {t.pitidos > 0 && ` · ${'♪'.repeat(t.pitidos)}`}
                    </span>
                    {t.estado === 'ERROR' && <span className="font-bold text-red-700">NO IMPRESO</span>}
                  </div>
                  {t.error && <div className="mb-1 bg-red-100 p-1 text-[10px] text-red-800">{t.error}</div>}
                  {t.lineas.map((l, i) => (
                    <div
                      key={i}
                      className={`whitespace-pre-wrap break-words ${l.c ? 'text-center' : ''} ${l.b ? 'font-black' : ''} ${l.g ? 'text-[18px] leading-tight' : ''}`}
                    >
                      {l.t || ' '}
                    </div>
                  ))}
                  {t.tipo !== 'GAVETA' && <div className="mt-3 border-t border-dashed border-stone-400 pt-1 text-center text-[10px] text-stone-400">✂ corte</div>}
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
