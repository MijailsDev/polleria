'use client';
import { useEffect, useState } from 'react';
import { api, ErrorApi } from '@/lib/api';
import { Categoria, ItemCarrito, precioItem, Producto } from '@/lib/tipos';
import { soles, useEventos, uuid } from '@/lib/util';
import { SelectorProducto } from './SelectorProducto';

export interface ItemEnvio { productoId: string; cantidad: number; nota: string; opciones: string[] }

/**
 * Toma de pedido táctil (F-05). La usa el mozo para su mesa y la caja para llevar y delivery.
 * Solo se imprime en cocina lo nuevo de cada ronda; la clave evita duplicados al reintentar.
 */
export function TomaPedido({
  titulo,
  alEnviar,
  alCerrar,
  textoBoton = 'Comandar',
  panelExtra,
  mesaId,
  mesa,
  alTerminar,
}: {
  titulo?: string;
  alEnviar?: (items: ItemEnvio[], clave: string) => Promise<string>;
  alCerrar: () => void;
  textoBoton?: string;
  panelExtra?: React.ReactNode;
  mesaId?: string;
  mesa?: string;
  alTerminar: (msg: string) => void;
}) {
  const [carta, setCarta] = useState<Categoria[]>([]);
  const [cat, setCat] = useState(0);
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [elegido, setElegido] = useState<Producto | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [clave, setClave] = useState(uuid); // la misma clave en los reintentos evita pedidos duplicados

  const cargar = () => api<Categoria[]>('GET', '/carta').then(setCarta).catch((e) => setError(e.message));
  useEffect(() => {
    cargar();
  }, []);
  useEventos({ 'carta:actualizada': cargar });

  const total = carrito.reduce((s, i) => s + precioItem(i), 0);

  async function comandar() {
    setEnviando(true);
    setError('');
    const items = carrito.map((i) => ({ productoId: i.producto.id, cantidad: i.cantidad, nota: i.nota, opciones: i.opciones.map((o) => o.id) }));
    try {
      const msg = alEnviar
        ? await alEnviar(items, clave)
        : await api('POST', '/pedidos', { mesaId, clave, items }).then(() => `Comanda de ${mesa} enviada a cocina`);
      setCarrito([]);
      setClave(uuid());
      alTerminar(msg);
    } catch (e) {
      const err = e as ErrorApi;
      setError(err.status === 0 ? 'Sin conexión: el pedido sigue guardado aquí. Pulsa el botón otra vez cuando vuelva la señal.' : err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-slate-50 lg:flex-row">
      <section className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-3 bg-slate-900 px-4 py-3 text-white">
          <button className="rounded-lg border border-slate-600 px-3 py-2" onClick={alCerrar}>
            ← Volver
          </button>
          <h2 className="text-lg font-bold">{titulo ?? `Pedido · Mesa ${mesa}`}</h2>
        </div>
        <div className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white p-3">
          {carta.map((c, i) => (
            <button key={c.id} className={i === cat ? 'chip-on min-h-12 text-base' : 'chip-off min-h-12 text-base'} onClick={() => setCat(i)}>
              {c.nombre}
            </button>
          ))}
        </div>
        <div className="grid flex-1 auto-rows-min grid-cols-2 gap-3 overflow-y-auto p-3 sm:grid-cols-3 xl:grid-cols-4">
          {carta[cat]?.productos.map((p) => (
            <button
              key={p.id}
              disabled={p.agotado}
              onClick={() => (p.grupos.length ? setElegido(p) : setCarrito((c) => [...c, { clave: uuid(), producto: p, cantidad: 1, opciones: [], nota: '' }]))}
              className={`tarjeta min-h-28 p-4 text-left transition ${p.agotado ? 'opacity-50' : 'hover:border-brasa-500 active:scale-[0.98]'}`}
            >
              <div className="font-bold">{p.nombre}</div>
              <div className="mt-1 font-bold text-brasa-700">{soles(p.precio)}</div>
              {p.agotado && <div className="mt-1 text-xs font-bold text-slate-500">AGOTADO</div>}
              {p.grupos.some((g) => g.obligatorio) && !p.agotado && <div className="mt-1 text-xs text-slate-500">elige presa u opciones</div>}
            </button>
          ))}
        </div>
      </section>

      <aside className="flex max-h-[55vh] w-full flex-col border-t border-slate-200 bg-white lg:max-h-none lg:w-[400px] lg:border-l lg:border-t-0">
        {panelExtra && <div className="max-h-[45%] overflow-y-auto border-b border-slate-100 p-4">{panelExtra}</div>}
        <h3 className="border-b border-slate-100 px-4 py-3 text-lg font-bold">{panelExtra ? 'Productos' : 'Nueva ronda'}</h3>
        <div className="flex-1 space-y-2 overflow-y-auto p-4">
          {carrito.length === 0 && <p className="text-slate-500">Toca los productos para agregarlos.</p>}
          {carrito.map((i) => (
            <div key={i.clave} className="flex items-start gap-2 rounded-xl bg-slate-50 p-3">
              <div className="flex-1">
                <div className="font-semibold">
                  {i.cantidad}× {i.producto.nombre}
                </div>
                {i.opciones.length > 0 && <div className="text-sm text-slate-600">{i.opciones.map((o) => o.nombre).join(' · ')}</div>}
                {i.nota && <div className="text-sm italic text-slate-500">Nota: {i.nota}</div>}
              </div>
              <div className="font-semibold">{soles(precioItem(i))}</div>
              <button className="px-2 text-red-600" onClick={() => setCarrito((c) => c.filter((x) => x.clave !== i.clave))} aria-label="Quitar">
                ✕
              </button>
            </div>
          ))}
        </div>
        {error && <p className="px-4 pb-2 text-sm font-semibold text-red-600">{error}</p>}
        <div className="border-t border-slate-100 p-4">
          <button className="btn-primario w-full text-lg" disabled={!carrito.length || enviando} onClick={comandar}>
            {enviando ? 'Enviando…' : `${textoBoton} · ${soles(total)}`}
          </button>
        </div>
      </aside>

      {elegido && (
        <SelectorProducto
          producto={elegido}
          notasRapidas
          alCerrar={() => setElegido(null)}
          alAgregar={(cantidad, opciones, nota) => {
            setCarrito((c) => [...c, { clave: uuid(), producto: elegido, cantidad, opciones, nota }]);
            setElegido(null);
          }}
        />
      )}
    </div>
  );
}
