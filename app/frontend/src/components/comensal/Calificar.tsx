'use client';
import { Estrella } from '@/components/Iconos';
import { useState } from 'react';
import { api } from '@/lib/api';

const TEXTO = ['', 'Muy mala', 'Mala', 'Regular', 'Buena', '¡Excelente!'];

/** El comensal califica la atención con estrellas y un comentario opcional (lo ve el dueño en Reportes). */
export function Calificar({ token, alListo, alError }: { token: string; alListo: () => void; alError: (t: string) => void }) {
  const [estrellas, setEstrellas] = useState(0);
  const [comentario, setComentario] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setEnviando(true);
    try {
      await api('POST', '/qr/calificar', { token, estrellas, comentario: comentario.trim() || undefined });
      alListo();
    } catch (e: any) {
      alError(e.message);
      setEnviando(false);
    }
  }

  return (
    <div className="tarjeta p-4 text-center">
      <h3 className="font-bold">¿Cómo te atendimos?</h3>
      <div className="my-2 flex justify-center gap-1" role="radiogroup" aria-label="Calificación de 1 a 5 estrellas">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            role="radio"
            aria-checked={estrellas === n}
            aria-label={`${n} estrella${n > 1 ? 's' : ''}`}
            className={`grid min-h-12 min-w-12 place-items-center transition ${n <= estrellas ? 'scale-110 text-amber-500' : 'text-slate-300'}`}
            onClick={() => setEstrellas(n)}
          >
            <Estrella llena className="h-10 w-10" />
          </button>
        ))}
      </div>
      {estrellas > 0 && (
        <>
          <div className="mb-2 text-sm font-semibold text-slate-600">{TEXTO[estrellas]}</div>
          <textarea
            className="campo min-h-20 text-left"
            maxLength={500}
            placeholder={estrellas <= 3 ? '¿Qué podemos mejorar?' : '¿Qué fue lo que más te gustó? (opcional)'}
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
          />
          <button className="btn-primario mt-2 w-full" disabled={enviando} onClick={enviar}>
            Enviar
          </button>
        </>
      )}
    </div>
  );
}
