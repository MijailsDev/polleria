'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { soles } from '@/lib/util';
import { Ico } from '@/components/Ico';

interface Resumen {
  regla: { compras: number; dias: number; montoMinimo: number };
  registrados: number;
  conPermiso: number;
  frecuentes: number;
  mejores: { nombre: string; contacto: string; compras: number; total: number; frecuente: boolean }[];
  combosVendidos: { nombre: string; cantidad: number }[];
}

/** Programa de clientes frecuentes: cuántos hay, quiénes compran más y qué combos exclusivos se venden. */
export function ClientesFrecuentes({ alAviso }: { alAviso: (a: { texto: string; tipo?: 'error' | 'ok' }) => void }) {
  const [r, setR] = useState<Resumen | null>(null);
  useEffect(() => {
    api<Resumen>('GET', '/admin/clientes-frecuentes')
      .then(setR)
      .catch((e) => alAviso({ texto: e.message, tipo: 'error' }));
  }, [alAviso]);
  if (!r) return <p className="text-slate-500">Cargando…</p>;

  const dato = (titulo: string, valor: string | number, detalle: string) => (
    <div className="tarjeta p-4">
      <div className="text-sm font-semibold text-slate-500">{titulo}</div>
      <div className="text-3xl font-extrabold">{valor}</div>
      <div className="text-sm text-slate-500">{detalle}</div>
    </div>
  );
  return (
    <div className="space-y-4">
      <div className="tarjeta flex flex-wrap items-center gap-3 bg-amber-50 p-4">
        <Ico n="estrella" className="text-2xl text-amber-600" />
        <p className="flex-1 text-sm text-amber-900">
          <b>Regla actual:</b> {r.regla.compras} compras de al menos {soles(r.regla.montoMinimo)} en los últimos {r.regla.dias} días. Se cambia en <b>Configuración</b>. Los combos exclusivos se marcan en <b>Carta y precios</b> → Opciones del producto.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {dato('Clientes registrados', r.registrados, 'Con celular o correo confirmado')}
        {dato('Clientes frecuentes', r.frecuentes, `Cumplen la regla hoy`)}
        {dato('Aceptan promociones', r.conPermiso, 'Solo a ellos se les envían mensajes')}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="tarjeta p-4">
          <h3 className="mb-2 font-bold">Quiénes compran más ({r.regla.dias} días)</h3>
          {r.mejores.length === 0 ? (
            <p className="text-sm text-slate-500">Aún no hay compras de clientes identificados.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-1">Cliente</th>
                  <th>Compras</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {r.mejores.map((m, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className="py-2">
                      <div className="font-semibold">
                        {m.nombre} {m.frecuente && <span className="etiqueta ml-1 bg-amber-100 text-xs text-amber-800">Frecuente</span>}
                      </div>
                      <div className="text-xs text-slate-500">{m.contacto}</div>
                    </td>
                    <td>{m.compras}</td>
                    <td className="text-right font-semibold">{soles(m.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="tarjeta p-4">
          <h3 className="mb-2 font-bold">Combos exclusivos vendidos ({r.regla.dias} días)</h3>
          {r.combosVendidos.length === 0 ? (
            <p className="text-sm text-slate-500">Todavía no se vendió ningún combo exclusivo.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {r.combosVendidos.map((c) => (
                <li key={c.nombre} className="flex justify-between gap-2 py-2">
                  <span>{c.nombre}</span>
                  <b>{c.cantidad}</b>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <p className="text-xs text-slate-500">
        Los contactos se muestran a medias para proteger los datos personales (Ley 29733). El cliente puede retirar su permiso de promociones desde la carta.
      </p>
    </div>
  );
}
