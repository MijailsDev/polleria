'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { EquipoNoVinculado } from '@/components/EquipoNoVinculado';
import { hora, useEventos } from '@/lib/util';

interface Mensaje { id: string; texto: string; enlace: string | null; plantilla: string; estado: string; hora: string; error: string | null }
interface Chat { destino: string; ultimo: string; mensajes: Mensaje[] }
interface Bandeja { proveedor: string; simulado: boolean; chats: Chat[] }

const CHECKS: Record<string, { icono: string; color: string; texto: string }> = {
  EN_COLA: { icono: '🕓', color: 'text-stone-400', texto: 'en cola' },
  ENVIADO: { icono: '✓', color: 'text-stone-400', texto: 'enviado' },
  ENTREGADO: { icono: '✓✓', color: 'text-stone-400', texto: 'entregado' },
  LEIDO: { icono: '✓✓', color: 'text-sky-500', texto: 'leído' },
  FALLIDO: { icono: '⚠', color: 'text-red-600', texto: 'no enviado' },
};

/** Muestra el enlace del mensaje como vínculo que se puede abrir. */
function Texto({ m }: { m: Mensaje }) {
  if (!m.enlace) return <>{m.texto}</>;
  const [antes] = m.texto.split(m.enlace);
  return (
    <>
      {antes}
      <a className="break-all text-sky-700 underline" href={m.enlace} target="_blank" rel="noreferrer">
        {m.enlace}
      </a>
    </>
  );
}

/**
 * Celular simulado: recibe los mensajes que el sistema envía por WhatsApp (comprobantes,
 * avisos de delivery, reclamos y alertas al dueño), con los estados de entrega de Meta.
 */
export default function PaginaWhatsapp() {
  const [bandeja, setBandeja] = useState<Bandeja | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [error, setError] = useState('');

  const cargar = useCallback(() => api<Bandeja>('GET', '/whatsapp/chats').then(setBandeja).catch((e) => setError(e.codigo === 'EQUIPO_NO_VINCULADO' ? 'EQUIPO' : e.message)), []);
  useEffect(() => {
    cargar();
  }, [cargar]);
  useEventos({ 'whatsapp:cambio': cargar });

  const chat = bandeja?.chats.find((c) => c.destino === abierto) ?? null;

  if (error === 'EQUIPO') return <EquipoNoVinculado />;
  return (
    <main className="flex min-h-screen flex-col items-center bg-slate-200 p-4">
      <div className="mb-3 flex w-full max-w-md items-center gap-2">
        <Link href="/" className="font-bold">
          🍗 Pollería
        </Link>
        <span className="text-slate-500">· WhatsApp de los clientes</span>
      </div>
      {error && <p className="mb-3 rounded-xl bg-red-100 p-3 font-semibold text-red-800">{error}</p>}
      <div className="flex h-[78vh] w-full max-w-md flex-col overflow-hidden rounded-[2rem] border-8 border-slate-900 bg-[#efeae2] shadow-2xl">
        <div className="flex items-center gap-3 bg-[#075e54] px-4 py-3 text-white">
          {chat && (
            <button onClick={() => setAbierto(null)} aria-label="Volver" className="text-xl">
              ←
            </button>
          )}
          <div className="flex-1">
            <div className="font-bold">{chat ? `+51 ${chat.destino.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3')}` : 'Chats'}</div>
            <div className="text-xs text-white/80">{bandeja?.simulado ? 'Simulación de WhatsApp Business' : bandeja?.proveedor}</div>
          </div>
        </div>
        {!chat ? (
          <ul className="flex-1 divide-y divide-slate-200 overflow-y-auto bg-white">
            {bandeja?.chats.length === 0 && <li className="p-6 text-center text-slate-500">Aún no se envió ningún mensaje. Envía un comprobante desde la caja.</li>}
            {bandeja?.chats.map((c) => {
              const u = c.mensajes[c.mensajes.length - 1];
              return (
                <li key={c.destino}>
                  <button className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50" onClick={() => setAbierto(c.destino)}>
                    <span className="grid h-11 w-11 place-items-center rounded-full bg-slate-300 text-xl">👤</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex justify-between">
                        <b>+51 {c.destino}</b>
                        <span className="text-xs text-slate-500">{hora(c.ultimo)}</span>
                      </span>
                      <span className="block truncate text-sm text-slate-600">{u.texto}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            <div className="mx-auto w-fit rounded-lg bg-[#fff5c4] px-3 py-1 text-center text-xs text-slate-700">🔒 Mensajes de la cuenta de empresa de la pollería</div>
            {chat.mensajes.map((m) => (
              <div key={m.id} className="max-w-[85%] rounded-lg bg-white px-3 py-2 text-sm shadow">
                <div className="whitespace-pre-wrap break-words">
                  <Texto m={m} />
                </div>
                <div className="mt-1 flex items-center justify-end gap-1 text-[11px] text-slate-500">
                  <span className="mr-auto rounded bg-slate-100 px-1 text-[10px]">{m.plantilla}</span>
                  {hora(m.hora)}
                  <span className={CHECKS[m.estado]?.color} title={CHECKS[m.estado]?.texto}>
                    {CHECKS[m.estado]?.icono}
                  </span>
                </div>
                {m.error && <div className="text-[11px] text-red-600">{m.error}</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
