'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useSesion } from '@/lib/sesion';
import { CANAL, MEDIO } from '@/lib/tipos';
import { descargarCsv, soles } from '@/lib/util';
import { Aviso, Encabezado } from '@/components/Encabezado';

interface Reporte {
  desde: string;
  hasta: string;
  resumen: { ventas: number; notasCredito: number; ventasNetas: number; cuentas: number; ticketPromedio: number; pedidos: number };
  porDia: { dia: string; total: number; cuentas: number }[];
  porMedio: { medio: string; total: number; pagos: number }[];
  porCanal: { canal: keyof typeof CANAL; total: number }[];
  porCajero: { cajero: string; total: number; pagos: number }[];
  porMozo: { mozo: string; pedidos: number; total: number }[];
  productos: { producto: string; cantidad: number; total: number }[];
  presas: { presa: string; cantidad: number }[];
  franjas: { hora: number; pedidos: number; total: number }[];
  tiempos: { hora: number; pedidos: number; esperaProm: number | null; prepProm: number | null; prepMax: number | null; totalProm: number | null; totalMax: number | null }[];
  notasCredito: { numero: string; anula: string; total: number; motivo: string; fecha: string }[];
  mermas: { fecha: string; tipo: string; pollos: number; pecho: number; pierna: number; motivo: string; autorizo: string }[];
  eventos: { fecha: string; accion: string; solicito: string; autorizo: string; detalle: Record<string, unknown> }[];
  arqueos: { cajero: string; cierre: string; declarado: number; diferencia: number; comentario: string | null }[];
}

const hoy = () => new Date().toLocaleDateString('en-CA');
const ACCION: Record<string, string> = {
  ANULAR_ITEM: 'Anulación de ítem',
  DESCUENTO: 'Descuento',
  FUGA_COMENSAL: 'Fuga de comensal',
  REPOSICION: 'Reposición',
  REABRIR_TURNO: 'Reapertura de turno',
  ABRIR_GAVETA: 'Gaveta sin venta',
  CAMBIO_PRECIO: 'Cambio de precio',
  LIQUIDAR_REPARTIDOR: 'Liquidación de repartidor',
};

/** Barras horizontales simples (sin librerías) para comparar montos. */
function Barras({ filas, etiqueta, valor, formato = soles }: { filas: Record<string, any>[]; etiqueta: string; valor: string; formato?: (n: number) => string }) {
  const max = Math.max(1, ...filas.map((f) => Number(f[valor])));
  if (!filas.length) return <p className="text-sm text-slate-500">Sin datos en este rango.</p>;
  return (
    <div className="space-y-1.5">
      {filas.map((f, i) => (
        <div key={i} className="grid grid-cols-[minmax(7rem,30%)_1fr_auto] items-center gap-2 text-sm">
          <span className="truncate">{f[etiqueta]}</span>
          <div className="h-5 rounded bg-slate-100">
            <div className="h-5 rounded bg-brasa-600" style={{ width: `${(100 * Number(f[valor])) / max}%` }} />
          </div>
          <span className="w-24 text-right font-semibold tabular-nums">{formato(Number(f[valor]))}</span>
        </div>
      ))}
    </div>
  );
}

function Seccion({ titulo, csv, filas, children }: { titulo: string; csv?: string; filas?: Record<string, unknown>[]; children: React.ReactNode }) {
  return (
    <section className="tarjeta break-inside-avoid p-5">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="font-bold">{titulo}</h3>
        {csv && filas && filas.length > 0 && (
          <button className="no-imprimir ml-auto rounded-lg px-2 py-1 text-xs font-semibold text-brasa-700 hover:bg-brasa-50" onClick={() => descargarCsv(csv, filas)}>
            ⬇ Excel (CSV)
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

/** Reportes del dueño (F-14): ventas, productos, presas, horas punta, tiempos de atención y pérdidas autorizadas. */
export default function PaginaReportes() {
  const sesion = useSesion(['ADMINISTRADOR']);
  const [desde, setDesde] = useState(hoy());
  const [hasta, setHasta] = useState(hoy());
  const [r, setR] = useState<Reporte | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; tipo?: 'error' | 'ok' } | null>(null);

  const cargar = useCallback(() => api<Reporte>('GET', `/reportes?desde=${desde}&hasta=${hasta}`).then(setR).catch((e) => setAviso({ texto: e.message, tipo: 'error' })), [desde, hasta]);
  useEffect(() => {
    if (sesion) cargar();
  }, [sesion, cargar]);

  if (!sesion) return null;
  const rango = (dias: number) => {
    const d = new Date();
    d.setDate(d.getDate() - dias);
    setDesde(d.toLocaleDateString('en-CA'));
    setHasta(hoy());
  };
  const kpi = (t: string, v: string, s?: string) => (
    <div className="tarjeta p-4">
      <div className="text-sm text-slate-500">{t}</div>
      <div className="text-2xl font-black tabular-nums">{v}</div>
      {s && <div className="text-xs text-slate-500">{s}</div>}
    </div>
  );

  return (
    <div className="min-h-screen">
      <Encabezado titulo="Reportes" sesion={sesion} />
      <div className="no-imprimir flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
        <input type="date" className="campo w-auto" value={desde} onChange={(e) => setDesde(e.target.value)} />
        <span>a</span>
        <input type="date" className="campo w-auto" value={hasta} onChange={(e) => setHasta(e.target.value)} />
        <button className="chip-off" onClick={() => rango(0)}>
          Hoy
        </button>
        <button className="chip-off" onClick={() => rango(6)}>
          7 días
        </button>
        <button className="chip-off" onClick={() => rango(29)}>
          30 días
        </button>
        <div className="flex-1" />
        <button className="btn-secundario" onClick={() => window.print()}>
          🖨 Imprimir o guardar PDF
        </button>
      </div>
      {r && (
        <main className="space-y-4 p-4">
          <h2 className="text-xl font-bold">
            Del {new Date(r.desde + 'T12:00').toLocaleDateString('es-PE')} al {new Date(r.hasta + 'T12:00').toLocaleDateString('es-PE')}
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {kpi('Ventas cobradas', soles(r.resumen.ventas))}
            {kpi('Notas de crédito', soles(r.resumen.notasCredito))}
            {kpi('Ventas netas', soles(r.resumen.ventasNetas))}
            {kpi('Cuentas cobradas', String(r.resumen.cuentas))}
            {kpi('Ticket promedio', soles(r.resumen.ticketPromedio))}
            {kpi('Pedidos', String(r.resumen.pedidos))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Seccion titulo="Ventas por día" csv="ventas_por_dia" filas={r.porDia}>
              <Barras filas={r.porDia.map((d) => ({ ...d, dia: new Date(d.dia + 'T12:00').toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: '2-digit' }) }))} etiqueta="dia" valor="total" />
            </Seccion>
            <Seccion titulo="Por medio de pago" csv="ventas_por_medio" filas={r.porMedio}>
              <Barras filas={r.porMedio.map((m) => ({ ...m, medio: MEDIO[m.medio] ?? m.medio }))} etiqueta="medio" valor="total" />
            </Seccion>
            <Seccion titulo="Por canal" csv="ventas_por_canal" filas={r.porCanal}>
              <Barras filas={r.porCanal.map((c) => ({ ...c, canal: `${CANAL[c.canal]?.icono ?? ''} ${CANAL[c.canal]?.texto ?? c.canal}` }))} etiqueta="canal" valor="total" />
            </Seccion>
            <Seccion titulo="Por cajero" csv="ventas_por_cajero" filas={r.porCajero}>
              <Barras filas={r.porCajero} etiqueta="cajero" valor="total" />
            </Seccion>
            <Seccion titulo="Por mozo (salón)" csv="ventas_por_mozo" filas={r.porMozo}>
              <Barras filas={r.porMozo.map((m) => ({ ...m, mozo: `${m.mozo} (${m.pedidos})` }))} etiqueta="mozo" valor="total" />
            </Seccion>
            <Seccion titulo="Pecho vs. pierna" csv="venta_por_presa" filas={r.presas}>
              <Barras filas={r.presas} etiqueta="presa" valor="cantidad" formato={(n) => `${n} u.`} />
            </Seccion>
          </div>

          <Seccion titulo="Productos más vendidos" csv="ranking_productos" filas={r.productos}>
            <Barras filas={r.productos.map((p, i) => ({ ...p, producto: `${i + 1}. ${p.producto} · ${p.cantidad} u.` }))} etiqueta="producto" valor="total" />
          </Seccion>

          <div className="grid gap-4 lg:grid-cols-2">
            <Seccion titulo="Horas punta" csv="venta_por_franja" filas={r.franjas}>
              <Barras filas={r.franjas.map((f) => ({ ...f, hora: `${String(f.hora).padStart(2, '0')}:00 · ${f.pedidos} ped.` }))} etiqueta="hora" valor="total" />
            </Seccion>
            <Seccion titulo="Tiempos de atención (minutos)" csv="tiempos_atencion" filas={r.tiempos}>
              {r.tiempos.length === 0 ? (
                <p className="text-sm text-slate-500">Sin datos en este rango.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th>Hora</th>
                      <th className="text-right">Pedidos</th>
                      <th className="text-right">Espera confirmación</th>
                      <th className="text-right">Preparación prom. / máx.</th>
                      <th className="text-right">Total prom. / máx.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.tiempos.map((t) => (
                      <tr key={t.hora} className="border-t border-slate-100">
                        <td className="py-1">{String(t.hora).padStart(2, '0')}:00</td>
                        <td className="text-right">{t.pedidos}</td>
                        <td className="text-right">{t.esperaProm ?? '-'}</td>
                        <td className="text-right">
                          {t.prepProm ?? '-'} / {t.prepMax ?? '-'}
                        </td>
                        <td className={`text-right ${(t.totalMax ?? 0) > 25 ? 'font-bold text-red-700' : ''}`}>
                          {t.totalProm ?? '-'} / {t.totalMax ?? '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Seccion>
          </div>

          <Seccion titulo="Anulaciones, descuentos y otras acciones autorizadas" csv="acciones_autorizadas" filas={r.eventos.map((e) => ({ fecha: e.fecha, accion: e.accion, solicito: e.solicito, autorizo: e.autorizo, detalle: e.detalle }))}>
            {r.eventos.length === 0 ? (
              <p className="text-sm text-slate-500">Sin acciones protegidas en este rango.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th>Fecha</th>
                      <th>Acción</th>
                      <th>Solicitó</th>
                      <th>Autorizó</th>
                      <th>Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.eventos.map((e, i) => (
                      <tr key={i} className="border-t border-slate-100 align-top">
                        <td className="whitespace-nowrap py-1 pr-2">{new Date(e.fecha).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}</td>
                        <td className="pr-2 font-semibold">{ACCION[e.accion] ?? e.accion}</td>
                        <td className="pr-2">{e.solicito}</td>
                        <td className="pr-2">{e.autorizo || '-'}</td>
                        <td className="text-xs text-slate-600">
                          {[e.detalle.producto, e.detalle.motivo, e.detalle.importe !== undefined ? soles(Number(e.detalle.importe)) : null, e.detalle.total !== undefined ? soles(Number(e.detalle.total)) : null, e.detalle.descuento !== undefined ? `- ${soles(Number(e.detalle.descuento))}` : null, e.detalle.precio !== undefined ? `nuevo precio ${soles(Number(e.detalle.precio))}` : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Seccion>

          <div className="grid gap-4 lg:grid-cols-3">
            <Seccion titulo="Notas de crédito" csv="notas_credito" filas={r.notasCredito}>
              {r.notasCredito.length === 0 && <p className="text-sm text-slate-500">Ninguna.</p>}
              {r.notasCredito.map((n) => (
                <div key={n.numero} className="flex justify-between border-b border-slate-100 py-1 text-sm">
                  <span>
                    {n.numero} anula {n.anula}
                    <span className="block text-xs text-slate-500">{n.motivo}</span>
                  </span>
                  <b>{soles(n.total)}</b>
                </div>
              ))}
            </Seccion>
            <Seccion titulo="Mermas y reposiciones" csv="mermas" filas={r.mermas}>
              {r.mermas.length === 0 && <p className="text-sm text-slate-500">Ninguna.</p>}
              {r.mermas.map((m, i) => (
                <div key={i} className="border-b border-slate-100 py-1 text-sm">
                  <b>{m.tipo === 'MERMA' ? 'Merma' : 'Reposición'}</b> · {Number(m.pollos.toFixed(3))} pollo{m.pecho ? ` · ${m.pecho} pecho` : ''}
                  {m.pierna ? ` · ${m.pierna} pierna` : ''}
                  <span className="block text-xs text-slate-500">
                    {m.motivo} · autorizó {m.autorizo ?? '-'}
                  </span>
                </div>
              ))}
            </Seccion>
            <Seccion titulo="Diferencias de arqueo" csv="arqueos" filas={r.arqueos}>
              {r.arqueos.length === 0 && <p className="text-sm text-slate-500">Ningún turno cerrado.</p>}
              {r.arqueos.map((a, i) => (
                <div key={i} className="flex justify-between border-b border-slate-100 py-1 text-sm">
                  <span>
                    {a.cajero}
                    <span className="block text-xs text-slate-500">{a.comentario ?? new Date(a.cierre).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}</span>
                  </span>
                  <b className={Math.abs(a.diferencia) > 1 ? 'text-red-700' : 'text-green-700'}>{soles(a.diferencia)}</b>
                </div>
              ))}
            </Seccion>
          </div>
        </main>
      )}
      {aviso && <Aviso texto={aviso.texto} tipo={aviso.tipo} alCerrar={() => setAviso(null)} />}
    </div>
  );
}
