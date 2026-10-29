'use client';
import { Suspense, use, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { soles } from '@/lib/util';

interface Intento { id: string; monto: number; estado: string; expiraEn: string; mesa: string | null }
type Medio = 'YAPE' | 'PLIN' | 'TARJETA';

/**
 * Pasarela de pagos SIMULADA (en producción: el formulario embebido de Culqi o Izipay).
 * No guarda la tarjeta ni el código de aprobación: solo envía los datos a la «pasarela»,
 * que notifica al sistema con un webhook firmado (REQ-PAG-02, REQ-PAG-06).
 */
function Pasarela({ id }: { id: string }) {
  const params = useSearchParams();
  const volver = params.get('volver') || '/';
  const [i, setI] = useState<Intento | null>(null);
  const [medio, setMedio] = useState<Medio>('YAPE');
  const [d, setD] = useState({ celular: '', aprobacion: '', tarjeta: '', vence: '', cvv: '' });
  const [resultado, setResultado] = useState<{ estado: string; motivo: string } | null>(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [restante, setRestante] = useState(0);

  useEffect(() => {
    api<Intento>('GET', `/pasarela/${id}`).then(setI).catch((e) => setError(e.message));
  }, [id]);
  useEffect(() => {
    if (!i) return;
    const t = setInterval(() => setRestante(Math.max(0, Math.floor((new Date(i.expiraEn).getTime() - Date.now()) / 1000))), 1000);
    return () => clearInterval(t);
  }, [i]);

  async function pagar() {
    setEnviando(true);
    setError('');
    try {
      setResultado(await api('POST', `/pasarela/${id}/pagar`, { medio, ...d }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  }

  const set = (k: keyof typeof d, v: string) => setD((x) => ({ ...x, [k]: v }));
  const tarjeta = d.tarjeta.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ');

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-sm">
        <div className="mb-4 text-center">
          <div className="text-sm font-semibold uppercase tracking-wide text-slate-500">Pasarela de pagos · modo prueba</div>
          <div className="mt-1 text-xs text-slate-400">Simulación local: no se realiza ningún cobro real</div>
        </div>
        <div className="overflow-hidden rounded-3xl bg-white shadow-xl">
          <div className="bg-indigo-700 p-5 text-white">
            <div className="text-sm opacity-80">Pollería y Brasas del Sur{i?.mesa ? ` · Mesa ${i.mesa}` : ''}</div>
            <div className="text-4xl font-black">{i ? soles(i.monto) : '…'}</div>
            {i && !resultado && i.estado === 'PENDIENTE' && (
              <div className="mt-1 text-xs opacity-80">
                Tiempo para pagar: {Math.floor(restante / 60)}:{String(restante % 60).padStart(2, '0')}
              </div>
            )}
          </div>

          {resultado ? (
            <div className="p-6 text-center">
              <div className="text-6xl">{resultado.estado === 'APROBADO' ? '✅' : '❌'}</div>
              <h1 className="mt-2 text-xl font-bold">{resultado.estado === 'APROBADO' ? 'Pago aprobado' : 'Pago rechazado'}</h1>
              {resultado.motivo && <p className="text-slate-500">{resultado.motivo}</p>}
              <a href={volver} className="btn-primario mt-5 w-full bg-indigo-700 hover:bg-indigo-800">
                {resultado.estado === 'APROBADO' ? 'Ver mi boleta' : 'Volver e intentar otra vez'}
              </a>
            </div>
          ) : i && i.estado !== 'PENDIENTE' ? (
            <div className="p-6 text-center">
              <p className="font-semibold">Este pago ya no está disponible ({i.estado.toLowerCase()}).</p>
              <a href={volver} className="btn-secundario mt-4 w-full">
                Volver a la carta
              </a>
            </div>
          ) : (
            <div className="space-y-3 p-5">
              <div className="grid grid-cols-3 gap-2">
                {(['YAPE', 'PLIN', 'TARJETA'] as Medio[]).map((m) => (
                  <button
                    key={m}
                    className={`min-h-12 rounded-xl border-2 font-bold ${medio === m ? 'border-indigo-700 bg-indigo-50 text-indigo-800' : 'border-slate-200'}`}
                    onClick={() => setMedio(m)}
                  >
                    {m === 'YAPE' ? 'Yape' : m === 'PLIN' ? 'Plin' : 'Tarjeta'}
                  </button>
                ))}
              </div>
              {medio === 'TARJETA' ? (
                <>
                  <input className="campo font-mono" inputMode="numeric" placeholder="Número de tarjeta" value={tarjeta} onChange={(e) => set('tarjeta', e.target.value)} />
                  <div className="grid grid-cols-2 gap-2">
                    <input className="campo" placeholder="MM/AA" maxLength={5} value={d.vence} onChange={(e) => set('vence', e.target.value)} />
                    <input className="campo" type="password" inputMode="numeric" placeholder="CVV" maxLength={4} value={d.cvv} onChange={(e) => set('cvv', e.target.value.replace(/\D/g, ''))} />
                  </div>
                  <p className="text-xs text-slate-500">Prueba: 4111 1111 1111 1111 (aprobada) · 4000 0000 0000 0002 (rechazada)</p>
                </>
              ) : (
                <>
                  <input className="campo" inputMode="numeric" maxLength={9} placeholder="Tu celular" value={d.celular} onChange={(e) => set('celular', e.target.value.replace(/\D/g, ''))} />
                  <input
                    className="campo text-center text-2xl tracking-[0.4em]"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="······"
                    value={d.aprobacion}
                    onChange={(e) => set('aprobacion', e.target.value.replace(/\D/g, ''))}
                  />
                  <p className="text-xs text-slate-500">
                    Abre {medio === 'YAPE' ? 'Yape' : 'Plin'} → «Código de aprobación» y escribe los 6 dígitos. Prueba: cualquier código aprueba; 000000 se rechaza.
                  </p>
                </>
              )}
              {error && <p className="font-semibold text-red-600">{error}</p>}
              <button className="btn-primario w-full bg-indigo-700 text-lg hover:bg-indigo-800" disabled={enviando || !i} onClick={pagar}>
                {enviando ? 'Procesando…' : `Pagar ${i ? soles(i.monto) : ''}`}
              </button>
              <button
                className="block w-full text-center text-sm text-slate-500 underline"
                onClick={() => api('POST', `/pasarela/${id}/cancelar`).finally(() => (window.location.href = volver))}
              >
                Cancelar y volver
              </button>
            </div>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">🔒 El sistema no guarda tu tarjeta ni tu código de aprobación.</p>
      </div>
    </main>
  );
}

export default function PaginaPasarela({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense>
      <Pasarela id={id} />
    </Suspense>
  );
}
