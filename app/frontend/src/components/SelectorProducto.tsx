'use client';
import { useMemo, useState } from 'react';
import { Opcion, Producto } from '@/lib/tipos';
import { soles } from '@/lib/util';

const NOTAS_RAPIDAS = ['Vinagreta aparte', 'Retirar pellejo', 'Bastante ají', 'Para compartir'];

/**
 * Ventana para elegir las opciones de un producto. No deja agregar el producto
 * hasta completar los grupos obligatorios, como la presa del 1/4 de pollo (RN-01).
 */
export function SelectorProducto({
  producto,
  alAgregar,
  alCerrar,
  notasRapidas = false,
}: {
  producto: Producto;
  alAgregar: (cantidad: number, opciones: Opcion[], nota: string) => void;
  alCerrar: () => void;
  notasRapidas?: boolean;
}) {
  const [elegidas, setElegidas] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(producto.grupos.map((g) => [g.id, []])),
  );
  const [cantidad, setCantidad] = useState(1);
  const [nota, setNota] = useState('');
  const [intento, setIntento] = useState(false);

  const faltantes = producto.grupos.filter((g) => (elegidas[g.id]?.length ?? 0) < g.minimo);
  const opciones = useMemo(
    () => producto.grupos.flatMap((g) => g.opciones.filter((o) => elegidas[g.id]?.includes(o.id))),
    [elegidas, producto],
  );
  const precio = (producto.precio + opciones.reduce((s, o) => s + o.recargo, 0)) * cantidad;

  function alternar(grupoId: string, op: Opcion, maximo: number) {
    if (op.agotado) return;
    setElegidas((e) => {
      const act = e[grupoId] ?? [];
      if (act.includes(op.id)) return { ...e, [grupoId]: act.filter((x) => x !== op.id) };
      if (maximo === 1) return { ...e, [grupoId]: [op.id] };
      if (act.length >= maximo) return e;
      return { ...e, [grupoId]: [...act, op.id] };
    });
  }

  function agregar() {
    setIntento(true);
    if (faltantes.length) return;
    alAgregar(cantidad, opciones, nota.trim());
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center" onClick={alCerrar}>
      <div
        className="animar-entrada flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
          <div>
            <h2 className="text-xl font-bold">{producto.nombre}</h2>
            <p className="font-bold text-brasa-700">{soles(producto.precio)}</p>
          </div>
          <button className="btn-secundario min-h-10 px-3" onClick={alCerrar} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {producto.grupos.map((g) => {
            const falta = intento && (elegidas[g.id]?.length ?? 0) < g.minimo;
            return (
              <section key={g.id}>
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="font-bold">{g.nombre}</h3>
                  {g.obligatorio ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">OBLIGATORIO</span>
                  ) : (
                    <span className="text-xs text-slate-500">{g.maximo > 1 ? `opcional · hasta ${g.maximo}` : 'opcional'}</span>
                  )}
                </div>
                <div className={`flex flex-wrap gap-2 rounded-xl ${falta ? 'p-2 ring-2 ring-red-500' : ''}`}>
                  {g.opciones.map((o) => {
                    const on = elegidas[g.id]?.includes(o.id);
                    return (
                      <button
                        key={o.id}
                        disabled={o.agotado}
                        onClick={() => alternar(g.id, o, g.maximo)}
                        className={o.agotado ? 'chip border-slate-200 bg-slate-100 text-slate-400 line-through' : on ? 'chip-on' : 'chip-off'}
                      >
                        {o.nombre}
                        {o.recargo > 0 && ` (+${soles(o.recargo)})`}
                        {o.agotado && ' · AGOTADO'}
                      </button>
                    );
                  })}
                </div>
                {falta && <p className="mt-1 text-sm font-semibold text-red-600">Elige {g.nombre.toLowerCase()} para continuar.</p>}
              </section>
            );
          })}

          <section>
            <h3 className="mb-2 font-bold">Nota para cocina</h3>
            {notasRapidas && (
              <div className="mb-2 flex flex-wrap gap-2">
                {NOTAS_RAPIDAS.map((n) => (
                  <button key={n} className="chip-off" onClick={() => setNota((v) => (v ? `${v}, ${n.toLowerCase()}` : n))}>
                    + {n}
                  </button>
                ))}
              </div>
            )}
            <input className="campo" maxLength={100} placeholder="Ej.: vinagreta aparte" value={nota} onChange={(e) => setNota(e.target.value)} />
          </section>
        </div>

        <div className="flex items-center gap-3 border-t border-slate-100 p-4">
          <div className="flex items-center rounded-xl border border-slate-300">
            <button className="h-12 w-12 text-xl font-bold" onClick={() => setCantidad((c) => Math.max(1, c - 1))} aria-label="Menos">
              −
            </button>
            <span className="w-8 text-center text-lg font-bold">{cantidad}</span>
            <button className="h-12 w-12 text-xl font-bold" onClick={() => setCantidad((c) => Math.min(50, c + 1))} aria-label="Más">
              +
            </button>
          </div>
          <button className="btn-primario flex-1" onClick={agregar}>
            Agregar · {soles(precio)}
          </button>
        </div>
      </div>
    </div>
  );
}
