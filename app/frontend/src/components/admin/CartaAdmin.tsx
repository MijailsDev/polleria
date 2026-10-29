'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { soles } from '@/lib/util';

type Avisar = (a: { texto: string; tipo?: 'error' | 'ok' }) => void;
interface OpcionA { id: string; nombre: string; recargo: number; agotado: boolean; efecto: Record<string, number> | null }
interface GrupoA { id: string; nombre: string; obligatorio: boolean; minimo: number; maximo: number; opciones: OpcionA[] }
interface ProductoA { id: string; nombre: string; precio: number; fraccionPollo: number; destino: string; activo: boolean; agotado: boolean; grupos: GrupoA[] }
interface CategoriaA { id: string; nombre: string; orden: number; productos: ProductoA[] }

const FRACCIONES = [
  [0, 'Sin pollo'],
  [0.125, '1/8'],
  [0.25, '1/4'],
  [0.5, '1/2'],
  [1, 'Entero'],
] as const;
const DESTINOS = [
  ['POLLERO', 'Estación del pollero'],
  ['CAJA', 'Caja / bebidas'],
  ['COCINA_INTERNA', 'Cocina interna'],
] as const;

/** Administración de la carta: categorías, productos, precios, fracción de pollo, destino y modificadores (F-02). */
export function CartaAdmin({ alAviso }: { alAviso: Avisar }) {
  const [carta, setCarta] = useState<CategoriaA[]>([]);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [nuevaCat, setNuevaCat] = useState('');
  const [nuevoProd, setNuevoProd] = useState<Record<string, { nombre: string; precio: string }>>({});

  const cargar = useCallback(() => api<CategoriaA[]>('GET', '/admin/carta').then(setCarta).catch((e) => alAviso({ texto: e.message, tipo: 'error' })), [alAviso]);
  useEffect(() => {
    cargar();
  }, [cargar]);

  async function guardar(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      alAviso({ texto: ok, tipo: 'ok' });
      cargar();
    } catch (e: any) {
      alAviso({ texto: e.message, tipo: 'error' });
    }
  }

  return (
    <div className="space-y-4">
      <div className="tarjeta flex flex-wrap items-center gap-2 p-4">
        <input className="campo max-w-xs" placeholder="Nueva categoría (ej.: Parrillas)" value={nuevaCat} onChange={(e) => setNuevaCat(e.target.value)} />
        <button
          className="btn-primario"
          disabled={!nuevaCat.trim()}
          onClick={() => guardar(() => api('POST', '/admin/categorias', { nombre: nuevaCat, orden: carta.length + 1 }), 'Categoría creada').then(() => setNuevaCat(''))}
        >
          + Categoría
        </button>
        <p className="text-sm text-slate-500">Los cambios se ven al instante en la carta QR y en las tablets. Los pedidos anteriores conservan su precio.</p>
      </div>

      {carta.map((c) => (
        <section key={c.id} className="tarjeta p-4">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <input
              className="campo max-w-xs text-lg font-bold"
              defaultValue={c.nombre}
              onBlur={(e) => e.target.value.trim() !== c.nombre && guardar(() => api('PATCH', `/admin/categorias/${c.id}`, { nombre: e.target.value, orden: c.orden }), 'Categoría renombrada')}
            />
            <span className="text-sm text-slate-500">{c.productos.length} productos</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-1">Producto</th>
                  <th>Precio (S/)</th>
                  <th>Pollo</th>
                  <th>Se imprime en</th>
                  <th>Activo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {c.productos.map((p) => (
                  <FilaProducto key={p.id} p={p} abierto={abierto === p.id} alAbrir={() => setAbierto(abierto === p.id ? null : p.id)} guardar={guardar} />
                ))}
                <tr className="border-t border-slate-100">
                  <td className="py-2 pr-2">
                    <input
                      className="campo min-h-10"
                      placeholder="Nuevo producto"
                      value={nuevoProd[c.id]?.nombre ?? ''}
                      onChange={(e) => setNuevoProd({ ...nuevoProd, [c.id]: { nombre: e.target.value, precio: nuevoProd[c.id]?.precio ?? '' } })}
                    />
                  </td>
                  <td className="pr-2">
                    <input
                      className="campo min-h-10 w-24"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={nuevoProd[c.id]?.precio ?? ''}
                      onChange={(e) => setNuevoProd({ ...nuevoProd, [c.id]: { nombre: nuevoProd[c.id]?.nombre ?? '', precio: e.target.value } })}
                    />
                  </td>
                  <td colSpan={4}>
                    <button
                      className="btn-secundario min-h-10"
                      disabled={!nuevoProd[c.id]?.nombre || !nuevoProd[c.id]?.precio}
                      onClick={() =>
                        guardar(() => api('POST', '/admin/productos', { nombre: nuevoProd[c.id].nombre, precio: Number(nuevoProd[c.id].precio), categoriaId: c.id }), 'Producto creado').then(() =>
                          setNuevoProd({ ...nuevoProd, [c.id]: { nombre: '', precio: '' } }),
                        )
                      }
                    >
                      + Agregar
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

function FilaProducto({ p, abierto, alAbrir, guardar }: { p: ProductoA; abierto: boolean; alAbrir: () => void; guardar: (fn: () => Promise<unknown>, ok: string) => Promise<void> }) {
  const editar = (datos: Record<string, unknown>, ok = 'Producto actualizado') => guardar(() => api('PATCH', `/admin/productos/${p.id}`, datos), ok);
  const [grupo, setGrupo] = useState({ nombre: '', obligatorio: false, minimo: '0', maximo: '1' });
  const [opcion, setOpcion] = useState<Record<string, { nombre: string; recargo: string }>>({});
  return (
    <>
      <tr className={`border-t border-slate-100 ${p.activo ? '' : 'text-slate-400'}`}>
        <td className="py-2 pr-2">
          <input className="campo min-h-10" defaultValue={p.nombre} onBlur={(e) => e.target.value.trim() !== p.nombre && editar({ nombre: e.target.value })} />
        </td>
        <td className="pr-2">
          <input
            className="campo min-h-10 w-24 font-semibold"
            inputMode="decimal"
            defaultValue={p.precio.toFixed(2)}
            onBlur={(e) => Number(e.target.value) !== p.precio && editar({ precio: Number(e.target.value) }, `Precio de ${p.nombre}: ${soles(Number(e.target.value))}`)}
          />
        </td>
        <td className="pr-2">
          <select className="campo min-h-10" value={p.fraccionPollo} onChange={(e) => editar({ fraccionPollo: Number(e.target.value) })}>
            {FRACCIONES.map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </td>
        <td className="pr-2">
          <select className="campo min-h-10" value={p.destino} onChange={(e) => editar({ destino: e.target.value })}>
            {DESTINOS.map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </td>
        <td>
          <input type="checkbox" className="h-5 w-5" checked={p.activo} onChange={(e) => editar({ activo: e.target.checked }, e.target.checked ? 'Producto activado' : 'Producto oculto de la carta')} />
        </td>
        <td>
          <button className="rounded-lg px-2 py-1 text-xs font-semibold text-brasa-700 hover:bg-brasa-50" onClick={alAbrir}>
            {abierto ? 'Cerrar' : `Opciones (${p.grupos.length})`}
          </button>
        </td>
      </tr>
      {abierto && (
        <tr>
          <td colSpan={6} className="bg-slate-50 p-3">
            <div className="grid gap-3 md:grid-cols-2">
              {p.grupos.map((g) => (
                <div key={g.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="mb-1 font-bold">
                    {g.nombre} <span className="text-xs font-normal text-slate-500">{g.obligatorio ? `obligatorio · elige ${g.minimo} a ${g.maximo}` : `opcional · hasta ${g.maximo}`}</span>
                  </div>
                  {g.opciones.map((o) => (
                    <div key={o.id} className="flex items-center gap-2 py-0.5">
                      <input className="campo min-h-9 flex-1 text-sm" defaultValue={o.nombre} onBlur={(e) => e.target.value.trim() !== o.nombre && guardar(() => api('PATCH', `/admin/opciones/${o.id}`, { nombre: e.target.value }), 'Opción actualizada')} />
                      <span className="text-xs">+S/</span>
                      <input
                        className="campo min-h-9 w-20 text-sm"
                        inputMode="decimal"
                        defaultValue={o.recargo.toFixed(2)}
                        onBlur={(e) => Number(e.target.value) !== o.recargo && guardar(() => api('PATCH', `/admin/opciones/${o.id}`, { recargo: Number(e.target.value) }), 'Recargo actualizado')}
                      />
                      {o.efecto && <span title="Descuenta del inventario" className="text-xs text-slate-500">🍗</span>}
                    </div>
                  ))}
                  <div className="mt-2 flex gap-2">
                    <input className="campo min-h-9 flex-1 text-sm" placeholder="Nueva opción" value={opcion[g.id]?.nombre ?? ''} onChange={(e) => setOpcion({ ...opcion, [g.id]: { nombre: e.target.value, recargo: opcion[g.id]?.recargo ?? '0' } })} />
                    <input className="campo min-h-9 w-20 text-sm" inputMode="decimal" placeholder="+0.00" value={opcion[g.id]?.recargo ?? ''} onChange={(e) => setOpcion({ ...opcion, [g.id]: { nombre: opcion[g.id]?.nombre ?? '', recargo: e.target.value } })} />
                    <button
                      className="btn-secundario min-h-9 px-3 text-sm"
                      disabled={!opcion[g.id]?.nombre}
                      onClick={() =>
                        guardar(() => api('POST', `/admin/grupos/${g.id}/opciones`, { nombre: opcion[g.id].nombre, recargo: Number(opcion[g.id].recargo || 0) }), 'Opción agregada').then(() =>
                          setOpcion({ ...opcion, [g.id]: { nombre: '', recargo: '' } }),
                        )
                      }
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-3">
                <div className="mb-2 font-bold">Nuevo grupo de opciones</div>
                <input className="campo mb-2 min-h-10" placeholder="Ej.: Cremas, Bebida, Término" value={grupo.nombre} onChange={(e) => setGrupo({ ...grupo, nombre: e.target.value })} />
                <div className="mb-2 flex flex-wrap items-center gap-3 text-sm">
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={grupo.obligatorio} onChange={(e) => setGrupo({ ...grupo, obligatorio: e.target.checked, minimo: e.target.checked ? '1' : '0' })} /> Obligatorio
                  </label>
                  <label>
                    Mín. <input className="campo inline min-h-9 w-14" value={grupo.minimo} onChange={(e) => setGrupo({ ...grupo, minimo: e.target.value })} />
                  </label>
                  <label>
                    Máx. <input className="campo inline min-h-9 w-14" value={grupo.maximo} onChange={(e) => setGrupo({ ...grupo, maximo: e.target.value })} />
                  </label>
                </div>
                <button
                  className="btn-secundario min-h-10 w-full"
                  disabled={!grupo.nombre.trim()}
                  onClick={() =>
                    guardar(
                      () => api('POST', `/admin/productos/${p.id}/grupos`, { nombre: grupo.nombre, obligatorio: grupo.obligatorio, minimo: Number(grupo.minimo), maximo: Number(grupo.maximo) }),
                      'Grupo creado',
                    ).then(() => setGrupo({ nombre: '', obligatorio: false, minimo: '0', maximo: '1' }))
                  }
                >
                  Crear grupo
                </button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
