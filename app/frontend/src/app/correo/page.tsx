'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { EquipoNoVinculado } from '@/components/EquipoNoVinculado';
import { hora, useEventos } from '@/lib/util';

interface Correo { id: string; destino: string; asunto: string; texto: string; plantilla: string; estado: string; hora: string; error: string | null }
interface Bandeja { proveedor: string; simulado: boolean; correos: Correo[] }

const ESTADO: Record<string, { texto: string; clase: string }> = {
  EN_COLA: { texto: 'En cola', clase: 'bg-slate-100 text-slate-700' },
  ENVIADO: { texto: 'Enviado', clase: 'bg-sky-100 text-sky-800' },
  ENTREGADO: { texto: 'Entregado', clase: 'bg-green-100 text-green-800' },
  FALLIDO: { texto: 'No enviado', clase: 'bg-red-100 text-red-800' },
};

/**
 * Bandeja de correo simulada: recibe los correos que envía el sistema (códigos de verificación
 * y avisos del programa de clientes frecuentes). Con RESEND_API_KEY se envían de verdad.
 */
export default function PaginaCorreo() {
  const [bandeja, setBandeja] = useState<Bandeja | null>(null);
  const [filtro, setFiltro] = useState('');
  const [abierto, setAbierto] = useState<string | null>(null);
  const [error, setError] = useState('');

  const cargar = useCallback(() => api<Bandeja>('GET', '/correo/bandeja').then(setBandeja).catch((e) => setError(e.codigo === 'EQUIPO_NO_VINCULADO' ? 'EQUIPO' : e.message)), []);
  useEffect(() => {
    cargar();
  }, [cargar]);
  useEventos({ 'correo:cambio': cargar });

  const correos = useMemo(() => (bandeja?.correos ?? []).filter((c) => !filtro || c.destino.includes(filtro.trim().toLowerCase())), [bandeja, filtro]);

  if (error === 'EQUIPO') return <EquipoNoVinculado />;
  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-slate-50 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Link href="/" className="font-bold">
          La Brasa Dorada
        </Link>
        <span className="text-slate-500">· Correo de los clientes</span>
        {bandeja && <span className="etiqueta ml-auto bg-slate-200 text-slate-700">{bandeja.proveedor}</span>}
      </div>
      {error && <p className="mb-3 rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
      <input className="campo mb-3" type="search" placeholder="Buscar por correo del cliente" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
      <div className="tarjeta divide-y divide-slate-100 overflow-hidden">
        {bandeja && correos.length === 0 && <p className="p-6 text-center text-slate-500">No hay correos todavía. Aparecen aquí cuando un cliente pide su código con su correo.</p>}
        {correos.map((c) => {
          const e = ESTADO[c.estado] ?? ESTADO.EN_COLA;
          const ver = abierto === c.id;
          return (
            <article key={c.id}>
              <button className="flex w-full items-start gap-3 p-4 text-left hover:bg-slate-50" onClick={() => setAbierto(ver ? null : c.id)} aria-expanded={ver}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brasa-100 font-bold text-brasa-800">{c.destino[0]?.toUpperCase()}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold">{c.destino}</span>
                    <span className="shrink-0 text-xs text-slate-500">{hora(c.hora)}</span>
                  </span>
                  <span className="block truncate text-base">{c.asunto}</span>
                  <span className={`etiqueta mt-1 text-xs ${e.clase}`}>{e.texto}</span>
                </span>
              </button>
              {ver && (
                <div className="whitespace-pre-wrap border-t border-slate-100 bg-white px-4 py-4 text-base leading-relaxed text-slate-800">
                  <p className="mb-2 text-sm text-slate-500">
                    De: La Brasa Dorada · Para: {c.destino}
                  </p>
                  {c.texto}
                  {c.error && <p className="mt-2 text-sm text-red-700">Error: {c.error}</p>}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </main>
  );
}
