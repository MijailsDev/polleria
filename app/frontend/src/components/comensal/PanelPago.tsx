'use client';
import { Ico } from '@/components/Ico';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { soles } from '@/lib/util';

type Parte = 'todo' | 'dividir' | 'monto';
type Comprobante = 'BOLETA' | 'DNI' | 'FACTURA';
const PROPINAS = [0, 5, 10] as const;
const cent = (v: number) => Math.round(v * 100);

/**
 * Pago desde el celular (F-09): el comensal elige cuánto paga (todo, su parte o un monto),
 * el comprobante con su DNI o RUC, una propina opcional y el celular para recibir la boleta.
 */
export function PanelPago({
  token,
  numero,
  saldo,
  totalCuenta,
  disponible,
  bloqueado,
  alError,
}: {
  token: string;
  numero: string;
  saldo: number;
  totalCuenta: number;
  disponible: number;
  bloqueado: boolean;
  alError: (t: string) => void;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [parte, setParte] = useState<Parte>('todo');
  const [personas, setPersonas] = useState(2);
  const [otroMonto, setOtroMonto] = useState('');
  const [comp, setComp] = useState<Comprobante>('BOLETA');
  const [documento, setDocumento] = useState('');
  const [nombre, setNombre] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [propina, setPropina] = useState<number | 'otra'>(0);
  const [otraPropina, setOtraPropina] = useState('');
  const [celular, setCelular] = useState('');
  const [enviando, setEnviando] = useState(false);

  // Partes iguales: se redondea hacia arriba al céntimo; la última persona paga lo que quede
  const monto = parte === 'todo' ? disponible : parte === 'dividir' ? Math.min(disponible, Math.ceil(cent(totalCuenta) / personas) / 100) : Math.min(disponible, Number(otroMonto) || 0);
  const montoPropina = propina === 'otra' ? Math.max(0, Number(otraPropina) || 0) : Math.round(monto * propina) / 100;
  const total = monto + montoPropina;
  const largoDoc = comp === 'FACTURA' ? 11 : 8;
  const docValido = comp === 'BOLETA' || new RegExp(`^[0-9]{${largoDoc}}$`).test(documento);

  async function buscar() {
    setBuscando(true);
    try {
      const d = await api<{ nombre: string }>('GET', `/qr/documentos/${documento}?token=${token}`);
      setNombre(d.nombre);
    } catch (e: any) {
      alError(e.message);
    } finally {
      setBuscando(false);
    }
  }

  async function pagar() {
    setEnviando(true);
    try {
      const r = await api<{ intentoId: string }>('POST', '/qr/pago/iniciar', {
        token,
        monto: parte === 'todo' ? undefined : monto,
        propina: montoPropina,
        tipo: comp === 'FACTURA' ? 'FACTURA' : 'BOLETA',
        documento: comp === 'BOLETA' ? undefined : documento,
        nombre: comp === 'BOLETA' ? undefined : nombre,
        celular: celular || undefined,
        enlaceBase: window.location.origin,
      });
      router.push(`/pasarela/${r.intentoId}?volver=${encodeURIComponent('/m/' + numero + '#cuenta')}`);
    } catch (e: any) {
      alError(e.message);
      setEnviando(false);
    }
  }

  if (!abierto)
    return (
      <div>
        <button className="btn-verde w-full rounded-full text-lg" disabled={bloqueado || disponible <= 0} onClick={() => setAbierto(true)}>
          <Ico n="tarjeta" /> Pagar desde mi celular
        </button>
        <p className="mt-2 text-center text-xs text-slate-500">
          {bloqueado
            ? 'Espera a que el mozo confirme tu último pedido para pagar.'
            : disponible < saldo
              ? `Otro comensal está pagando S/ ${(saldo - disponible).toFixed(2)}. Puedes pagar el resto.`
              : 'Yape, Plin o tarjeta. Puedes pagar todo o solo tu parte. También puedes pedir la cuenta y pagar en caja.'}
        </p>
      </div>
    );

  const chip = (activo: boolean) => (activo ? 'chip-on' : 'chip-off');
  return (
    <div className="tarjeta space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Pagar desde mi celular</h3>
        <button className="min-h-11 px-2 text-base text-slate-600 underline" onClick={() => setAbierto(false)}>
          Cerrar
        </button>
      </div>

      <section>
        <div className="mb-2 text-sm font-semibold">¿Cuánto pagas?</div>
        <div className="flex flex-wrap gap-2">
          <button className={chip(parte === 'todo')} onClick={() => setParte('todo')}>
            Todo {soles(disponible)}
          </button>
          <button className={chip(parte === 'dividir')} onClick={() => setParte('dividir')}>
            Dividir entre…
          </button>
          <button className={chip(parte === 'monto')} onClick={() => setParte('monto')}>
            Otro monto
          </button>
        </div>
        {parte === 'dividir' && (
          <div className="mt-2 flex items-center gap-3 rounded-xl bg-slate-50 p-2">
            <button className="btn-secundario h-12 w-12 p-0 text-xl" aria-label="Menos personas" disabled={personas <= 2} onClick={() => setPersonas((n) => n - 1)}>
              −
            </button>
            <span className="flex-1 text-center">
              <b>{personas} personas</b> · {soles(Math.ceil(cent(totalCuenta) / personas) / 100)} cada una
            </span>
            <button className="btn-secundario h-12 w-12 p-0 text-xl" aria-label="Más personas" disabled={personas >= 12} onClick={() => setPersonas((n) => n + 1)}>
              +
            </button>
          </div>
        )}
        {parte === 'monto' && (
          <input className="campo mt-2" inputMode="decimal" placeholder={`Hasta ${soles(disponible)}`} value={otroMonto} onChange={(e) => setOtroMonto(e.target.value.replace(',', '.'))} />
        )}
        {parte !== 'todo' && <p className="mt-1 text-xs text-slate-500">Cada persona recibe su propio comprobante. El resto de la mesa puede pagar lo que falta desde su celular o en caja.</p>}
      </section>

      <section>
        <div className="mb-2 text-sm font-semibold">Comprobante</div>
        <div className="flex flex-wrap gap-2">
          <button className={chip(comp === 'BOLETA')} onClick={() => setComp('BOLETA')}>
            Boleta simple
          </button>
          <button className={chip(comp === 'DNI')} onClick={() => (setComp('DNI'), setDocumento(''), setNombre(''))}>
            Boleta con DNI
          </button>
          <button className={chip(comp === 'FACTURA')} onClick={() => (setComp('FACTURA'), setDocumento(''), setNombre(''))}>
            Factura con RUC
          </button>
        </div>
        {comp !== 'BOLETA' && (
          <div className="mt-2 space-y-2">
            <div className="flex gap-2">
              <input
                className="campo"
                inputMode="numeric"
                maxLength={largoDoc}
                placeholder={comp === 'FACTURA' ? 'RUC (11 dígitos)' : 'DNI (8 dígitos)'}
                value={documento}
                onChange={(e) => (setDocumento(e.target.value.replace(/\D/g, '')), setNombre(''))}
              />
              <button className="btn-secundario whitespace-nowrap px-3" disabled={!docValido || buscando} onClick={buscar}>
                {buscando ? '…' : 'Buscar'}
              </button>
            </div>
            <input className="campo" placeholder={comp === 'FACTURA' ? 'Razón social' : 'Nombre completo'} value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </div>
        )}
      </section>

      <section>
        <div className="mb-2 text-sm font-semibold">Propina para el equipo (opcional)</div>
        <div className="flex flex-wrap gap-2">
          {PROPINAS.map((p) => (
            <button key={p} className={chip(propina === p)} onClick={() => setPropina(p)}>
              {p === 0 ? 'Sin propina' : `${p} % · ${soles(Math.round(monto * p) / 100)}`}
            </button>
          ))}
          <button className={chip(propina === 'otra')} onClick={() => setPropina('otra')}>
            Otra
          </button>
        </div>
        {propina === 'otra' && <input className="campo mt-2" inputMode="decimal" placeholder="S/ 0.00" value={otraPropina} onChange={(e) => setOtraPropina(e.target.value.replace(',', '.'))} />}
      </section>

      <section>
        <div className="mb-1 text-sm font-semibold">Recibe tu comprobante por WhatsApp (opcional)</div>
        <input className="campo" inputMode="numeric" maxLength={9} placeholder="Tu celular: 987654321" value={celular} onChange={(e) => setCelular(e.target.value.replace(/\D/g, ''))} />
      </section>

      <div className="rounded-xl bg-slate-50 p-3 text-sm">
        <div className="flex justify-between">
          <span>Consumo</span>
          <span>{soles(monto)}</span>
        </div>
        {montoPropina > 0 && (
          <div className="flex justify-between">
            <span>Propina</span>
            <span>{soles(montoPropina)}</span>
          </div>
        )}
        <div className="flex justify-between text-lg font-extrabold">
          <span>A pagar</span>
          <span>{soles(total)}</span>
        </div>
      </div>
      <button
        className="btn-verde w-full rounded-full text-lg"
        disabled={enviando || monto < 1 || !docValido || (comp !== 'BOLETA' && !nombre.trim()) || (!!celular && !/^9\d{8}$/.test(celular))}
        onClick={pagar}
      >
        {enviando ? 'Abriendo la pasarela…' : `Pagar ${soles(total)}`}
      </button>
      {monto > 0 && monto < 1 && <p className="text-center text-xs text-red-600">El pago mínimo es S/ 1.00.</p>}
    </div>
  );
}
