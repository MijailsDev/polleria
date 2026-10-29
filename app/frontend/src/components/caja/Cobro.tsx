'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { CuentaDetalle, MEDIO } from '@/lib/tipos';
import { soles } from '@/lib/util';
import { DetalleCuenta, PrecuentaImpresa } from '@/components/DetalleCuenta';
import { PedirPin } from '@/components/PedirPin';

type Medio = 'EFECTIVO' | 'YAPE' | 'PLIN' | 'TARJETA';
interface LineaPago { medio: Medio; monto: string; recibido: string; numeroOperacion: string }
type Avisar = (a: { texto: string; tipo?: 'error' | 'ok' }) => void;

const cent = (v: string | number) => Math.round(Number(v || 0) * 100);
const BILLETES = [10, 20, 50, 100, 200];
const MOTIVOS_NC = ['Anulación de la operación', 'Devolución total', 'Error en el RUC o DNI', 'Descuento posterior'];

/** Cobro de una cuenta: pago mixto, división, descuento con PIN, comprobante y notas de crédito (F-08, F-10). */
export function Cobro({
  cuenta,
  alCobrar,
  alCambio,
  alAviso,
  alVerComprobante,
}: {
  cuenta: CuentaDetalle;
  alCobrar: (r: { comprobanteId: string; vuelto: number }) => void;
  alCambio: () => void;
  alAviso: Avisar;
  alVerComprobante: (id: string) => void;
}) {
  const [aCobrar, setACobrar] = useState(cuenta.saldo.toFixed(2));
  const [partes, setPartes] = useState(2);
  const [pagos, setPagos] = useState<LineaPago[]>([]);
  const [tipo, setTipo] = useState<'BOLETA' | 'FACTURA'>('BOLETA');
  const [documento, setDocumento] = useState('');
  const [nombre, setNombre] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [precuenta, setPrecuenta] = useState(false);
  const [descuento, setDescuento] = useState(false);
  const [desc, setDesc] = useState({ modo: '%', valor: '10' });
  const [nc, setNc] = useState<{ id: string; numero: string; total: number } | null>(null);
  const [devolver, setDevolver] = useState(true);

  const objetivo = cent(aCobrar);
  const pagado = pagos.reduce((s, p) => s + cent(p.monto), 0);
  const falta = objetivo - pagado;
  const vuelto = pagos.filter((p) => p.medio === 'EFECTIVO').reduce((s, p) => s + Math.max(0, cent(p.recibido || p.monto) - cent(p.monto)), 0);
  const emitidos = cuenta.comprobantes.filter((c) => c.tipo !== 'NOTA_CREDITO');

  function agregarPago(medio: Medio) {
    if (falta <= 0) return;
    setPagos((l) => [...l, { medio, monto: (falta / 100).toFixed(2), recibido: '', numeroOperacion: '' }]);
  }
  const cambiar = (i: number, campo: keyof LineaPago, v: string) => setPagos((l) => l.map((p, k) => (k === i ? { ...p, [campo]: v } : p)));

  async function buscarDocumento() {
    try {
      const d = await api<{ nombre: string }>('GET', `/documentos/${documento.trim()}`);
      setNombre(d.nombre);
    } catch (e: any) {
      alAviso({ texto: e.message, tipo: 'error' });
    }
  }

  async function cobrar() {
    setEnviando(true);
    try {
      const r = await api<{ comprobanteId: string; vuelto: number }>('POST', `/cuentas/${cuenta.cuentaId}/cobrar`, {
        pagos: pagos.map((p) => ({
          medio: p.medio,
          monto: Number(p.monto),
          recibido: p.medio === 'EFECTIVO' && p.recibido ? Number(p.recibido) : undefined,
          numeroOperacion: p.medio !== 'EFECTIVO' ? p.numeroOperacion : undefined,
        })),
        comprobante: { tipo, documento: documento.trim() || undefined, nombre: nombre.trim() || undefined },
      });
      alCobrar(r);
    } catch (e: any) {
      alAviso({ texto: e.message, tipo: 'error' });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <section className="tarjeta p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-extrabold">Cuenta · {cuenta.mesa}</h2>
          <div className="flex-1" />
          {cuenta.total > 0 && (
            <button className="btn-secundario min-h-10 px-3 text-sm" onClick={() => setPrecuenta(true)}>
              🧾 Precuenta
            </button>
          )}
          {cuenta.estado === 'ABIERTA' && cuenta.pagos.length === 0 && cuenta.total > 0 && (
            <button className="btn-secundario min-h-10 px-3 text-sm" onClick={() => setDescuento(true)}>
              % Descuento
            </button>
          )}
        </div>
        <div className="mt-3">
          <DetalleCuenta cuenta={cuenta} alCambio={alCambio} alAviso={alAviso} />
        </div>
        <div className="mt-3 flex justify-between text-lg">
          <span>Total</span>
          <b>{soles(cuenta.total)}</b>
        </div>
        {cuenta.pagos.length > 0 && (
          <div className="mt-1 text-sm text-slate-600">Pagado: {cuenta.pagos.map((p) => `${MEDIO[p.medio] ?? p.medio} ${soles(p.monto)}`).join(' + ')}</div>
        )}
        <div className="mt-1 flex justify-between text-2xl font-extrabold text-brasa-700">
          <span>Saldo</span>
          <span>{soles(cuenta.saldo)}</span>
        </div>
        {cuenta.comprobantes.length > 0 && (
          <div className="mt-3 space-y-1">
            {cuenta.comprobantes.map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-sm">
                <button className="chip-off" onClick={() => alVerComprobante(c.id)}>
                  {c.tipo === 'NOTA_CREDITO' ? '↩' : '🧾'} {c.numero}
                </button>
                <span className={c.anulado ? 'text-slate-400 line-through' : ''}>{soles(c.total)}</span>
                {c.estadoSunat === 'PENDIENTE' && <span className="rounded bg-amber-100 px-2 text-xs font-bold text-amber-800">en cola</span>}
                {c.anulado && <span className="text-xs font-semibold text-red-600">anulado con NC</span>}
                {c.tipo !== 'NOTA_CREDITO' && !c.anulado && (
                  <button className="ml-auto text-xs font-semibold text-red-600 hover:underline" onClick={() => setNc(c)}>
                    Nota de crédito
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {cuenta.estado === 'ANULADA' ? (
        <section className="tarjeta grid place-items-center p-8 text-center">
          <div>
            <div className="text-5xl">🚫</div>
            <h3 className="mt-2 text-xl font-bold">Cuenta anulada</h3>
          </div>
        </section>
      ) : cuenta.saldo <= 0 ? (
        <section className="tarjeta grid place-items-center p-8 text-center">
          <div>
            <div className="text-5xl">✅</div>
            <h3 className="mt-2 text-xl font-bold">Cuenta pagada</h3>
            <p className="text-slate-500">{cuenta.mesaId ? 'La mesa pasó a «Por limpiar». El mozo la marcará como libre.' : 'Entrega el pedido cuando esté listo.'}</p>
          </div>
        </section>
      ) : cuenta.pagoEnLinea ? (
        <section className="tarjeta grid place-items-center p-8 text-center">
          <div>
            <div className="text-5xl">💳</div>
            <h3 className="mt-2 text-xl font-bold">El comensal está pagando desde su celular</h3>
            <p className="text-slate-500">La cuenta queda bloqueada hasta 10 minutos mientras se confirma el pago.</p>
          </div>
        </section>
      ) : (
        <section className="tarjeta space-y-4 p-5">
          <div>
            <h3 className="mb-2 font-bold">Monto a cobrar ahora</h3>
            <div className="flex flex-wrap items-center gap-2">
              <input className="campo w-36 text-xl font-bold" inputMode="decimal" value={aCobrar} onChange={(e) => (setACobrar(e.target.value), setPagos([]))} />
              <button className="chip-off" onClick={() => (setACobrar(cuenta.saldo.toFixed(2)), setPagos([]))}>
                Todo
              </button>
              <span className="text-sm text-slate-500">Dividir en</span>
              <select className="campo w-20" value={partes} onChange={(e) => setPartes(Number(e.target.value))}>
                {[2, 3, 4, 5, 6].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
              <button
                className="chip-off"
                onClick={() => {
                  // La última parte se lleva los céntimos del redondeo (REQ-CAJ-05)
                  const restantes = Math.max(1, partes - emitidos.length);
                  const parte = Math.floor(cent(cuenta.saldo) / restantes);
                  setACobrar(((restantes === 1 ? cent(cuenta.saldo) : parte) / 100).toFixed(2));
                  setPagos([]);
                }}
              >
                Partes iguales
              </button>
            </div>
          </div>

          <div>
            <h3 className="mb-2 font-bold">Pagos</h3>
            <div className="grid grid-cols-4 gap-2">
              {(['EFECTIVO', 'YAPE', 'PLIN', 'TARJETA'] as Medio[]).map((m) => (
                <button key={m} className="btn-secundario px-2 text-sm" disabled={falta <= 0} onClick={() => agregarPago(m)}>
                  + {MEDIO[m]}
                </button>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              {pagos.map((p, i) => (
                <div key={i} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-2">
                    <b className="w-20">{MEDIO[p.medio]}</b>
                    <input className="campo w-28" inputMode="decimal" value={p.monto} onChange={(e) => cambiar(i, 'monto', e.target.value)} />
                    <div className="flex-1" />
                    <button className="text-red-600" onClick={() => setPagos((l) => l.filter((_, k) => k !== i))}>
                      Quitar
                    </button>
                  </div>
                  {p.medio === 'EFECTIVO' ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                      <span>Recibido:</span>
                      <button className={p.recibido === p.monto ? 'chip-on' : 'chip-off'} onClick={() => cambiar(i, 'recibido', p.monto)}>
                        Exacto
                      </button>
                      {BILLETES.filter((b) => b * 100 >= cent(p.monto)).map((b) => (
                        <button key={b} className={p.recibido === String(b) ? 'chip-on' : 'chip-off'} onClick={() => cambiar(i, 'recibido', String(b))}>
                          S/ {b}
                        </button>
                      ))}
                      <input className="campo w-24" inputMode="decimal" placeholder="otro" value={p.recibido} onChange={(e) => cambiar(i, 'recibido', e.target.value)} />
                      {cent(p.recibido) > cent(p.monto) && <b className="text-green-700">Vuelto {soles((cent(p.recibido) - cent(p.monto)) / 100)}</b>}
                    </div>
                  ) : (
                    <input
                      className="campo mt-2"
                      placeholder={`N.° de operación ${p.medio === 'TARJETA' ? 'del POS' : 'de ' + MEDIO[p.medio]}`}
                      value={p.numeroOperacion}
                      onChange={(e) => cambiar(i, 'numeroOperacion', e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className={`mt-2 text-right font-bold ${falta === 0 ? 'text-green-700' : 'text-brasa-700'}`}>
              {falta === 0 ? 'Saldo pendiente S/ 0.00 ✓' : falta > 0 ? `Falta asignar ${soles(falta / 100)}` : `Sobra ${soles(-falta / 100)}`}
            </div>
          </div>

          <div>
            <h3 className="mb-2 font-bold">Comprobante</h3>
            <div className="mb-2 grid grid-cols-2 gap-2">
              {(['BOLETA', 'FACTURA'] as const).map((t) => (
                <button key={t} className={tipo === t ? 'chip-on min-h-12' : 'chip-off min-h-12'} onClick={() => setTipo(t)}>
                  {t === 'BOLETA' ? 'Boleta' : 'Factura (RUC)'}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input className="campo" inputMode="numeric" placeholder={tipo === 'FACTURA' ? 'RUC (11 dígitos)' : 'DNI (opcional hasta S/ 700)'} value={documento} onChange={(e) => setDocumento(e.target.value)} />
              <button className="btn-secundario" disabled={!documento.trim()} onClick={buscarDocumento}>
                Buscar
              </button>
            </div>
            <input className="campo mt-2" placeholder="Nombre o razón social" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>

          <button className="btn-verde w-full text-lg" disabled={falta !== 0 || objetivo <= 0 || enviando} onClick={cobrar}>
            {enviando ? 'Cobrando…' : `Cobrar ${soles(objetivo / 100)} y emitir ${tipo === 'FACTURA' ? 'factura' : 'boleta'}`}
            {vuelto > 0 && ` · vuelto ${soles(vuelto / 100)}`}
          </button>
        </section>
      )}

      {precuenta && <PrecuentaImpresa cuenta={cuenta} alCerrar={() => setPrecuenta(false)} />}
      {descuento && (
        <PedirPin
          titulo="Descuento o cortesía"
          descripcion="Se aplica sobre el total consumido, antes del primer cobro."
          motivos={['Cliente frecuente', 'Cortesía de la casa', 'Compensación por demora']}
          alCerrar={() => setDescuento(false)}
          alConfirmar={async (pinAdmin, motivo) => {
            await api('POST', `/cuentas/${cuenta.cuentaId}/descuento`, {
              pinAdmin,
              motivo,
              ...(desc.modo === '%' ? { porcentaje: Number(desc.valor) } : { monto: Number(desc.valor) }),
            });
            alAviso({ texto: 'Descuento aplicado', tipo: 'ok' });
            alCambio();
          }}
        >
          <div className="mb-3 flex gap-2">
            {['%', 'S/'].map((m) => (
              <button key={m} className={desc.modo === m ? 'chip-on' : 'chip-off'} onClick={() => setDesc({ ...desc, modo: m })}>
                {m === '%' ? 'Porcentaje' : 'Monto fijo'}
              </button>
            ))}
            <input className="campo w-28" inputMode="decimal" value={desc.valor} onChange={(e) => setDesc({ ...desc, valor: e.target.value })} />
            <span className="self-center font-bold">{desc.modo}</span>
          </div>
        </PedirPin>
      )}
      {nc && (
        <PedirPin
          titulo={`Nota de crédito · ${nc.numero}`}
          descripcion={`Anula el comprobante por ${soles(nc.total)} ante SUNAT.`}
          motivos={MOTIVOS_NC}
          peligro
          textoBoton="Emitir nota de crédito"
          alCerrar={() => setNc(null)}
          alConfirmar={async (pinAdmin, motivo) => {
            const r = await api<{ id: string; numero: string }>('POST', `/comprobantes/${nc.id}/nota-credito`, { pinAdmin, motivo, devolverEfectivo: devolver });
            alAviso({ texto: `Nota de crédito ${r.numero} emitida`, tipo: 'ok' });
            alCambio();
            alVerComprobante(r.id);
          }}
        >
          <label className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" className="h-5 w-5" checked={devolver} onChange={(e) => setDevolver(e.target.checked)} />
            Devolver el dinero en efectivo (sale de la caja)
          </label>
        </PedirPin>
      )}
    </div>
  );
}
