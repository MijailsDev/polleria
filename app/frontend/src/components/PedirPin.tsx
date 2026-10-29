'use client';
import { useState } from 'react';

/**
 * Ventana para autorizar una acción protegida con el PIN del administrador (RN-04).
 * Opcionalmente pide un motivo, con botones de motivos frecuentes.
 */
export function PedirPin({
  titulo,
  descripcion,
  motivos,
  pedirMotivo = true,
  textoBoton = 'Autorizar',
  peligro = false,
  alConfirmar,
  alCerrar,
  children,
}: {
  titulo: string;
  descripcion?: string;
  motivos?: string[];
  pedirMotivo?: boolean;
  textoBoton?: string;
  peligro?: boolean;
  alConfirmar: (pin: string, motivo: string) => Promise<unknown>;
  alCerrar: () => void;
  children?: React.ReactNode;
}) {
  const [pin, setPin] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function confirmar() {
    setEnviando(true);
    setError('');
    try {
      await alConfirmar(pin, motivo.trim());
      alCerrar();
    } catch (e: any) {
      setError(e.message);
      setPin('');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={alCerrar}>
      <div className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl animar-entrada sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-amber-100 text-lg">🔐</span>
          <h3 className="text-lg font-bold">{titulo}</h3>
        </div>
        {descripcion && <p className="mb-3 text-sm text-slate-600">{descripcion}</p>}
        {children}
        {pedirMotivo && (
          <>
            {motivos && (
              <div className="mb-2 flex flex-wrap gap-2">
                {motivos.map((m) => (
                  <button key={m} className={motivo === m ? 'chip-on' : 'chip-off'} onClick={() => setMotivo(m)}>
                    {m}
                  </button>
                ))}
              </div>
            )}
            <input className="campo mb-3" placeholder="Motivo" value={motivo} maxLength={140} onChange={(e) => setMotivo(e.target.value)} />
          </>
        )}
        <label className="mb-1 block text-sm font-semibold">PIN del administrador</label>
        <input
          className="campo mb-3 text-center text-2xl tracking-[0.5em]"
          type="password"
          inputMode="numeric"
          autoFocus
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => e.key === 'Enter' && pin.length >= 4 && confirmar()}
        />
        {error && <p className="mb-3 font-semibold text-red-600">{error}</p>}
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-secundario" onClick={alCerrar}>
            Cancelar
          </button>
          <button className={peligro ? 'btn-rojo' : 'btn-primario'} disabled={pin.length < 4 || (pedirMotivo && !motivo.trim()) || enviando} onClick={confirmar}>
            {enviando ? 'Autorizando…' : textoBoton}
          </button>
        </div>
      </div>
    </div>
  );
}
