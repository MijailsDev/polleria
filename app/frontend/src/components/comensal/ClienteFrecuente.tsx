'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Ico } from '@/components/Ico';
import { api } from '@/lib/api';
import { EstadoCliente, guardarCliente, olvidarCliente } from '@/lib/cliente';
import { soles } from '@/lib/util';

const esCelular = (t: string) => /^[0-9\s]+$/.test(t.trim());

/** Barra de avance hacia «Cliente frecuente». */
export function AvanceFrecuente({ c }: { c: EstadoCliente }) {
  const pct = Math.min(100, Math.round((c.compras / c.meta) * 100));
  return (
    <div>
      <div className="h-3 overflow-hidden rounded-full bg-brasa-100" role="progressbar" aria-valuemin={0} aria-valuemax={c.meta} aria-valuenow={Math.min(c.compras, c.meta)}>
        <div className="h-full rounded-full bg-brasa-600 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 text-sm text-slate-600">
        {c.frecuente ? `${c.compras} compras en los últimos ${c.dias} días.` : `${c.compras} de ${c.meta} compras · te faltan ${c.faltan} para ser cliente frecuente.`}
      </p>
    </div>
  );
}

/**
 * Programa de clientes frecuentes (opcional, sin contraseña): el comensal escribe su celular o
 * su correo, confirma el código de 6 dígitos y desde entonces sus compras suman. Al llegar a la
 * meta ve combos exclusivos en la carta. Las promociones solo llegan si marca el permiso.
 */
export function ClienteFrecuente({ cliente, alCambiar, alCerrar }: { cliente: EstadoCliente | null; alCambiar: (c: EstadoCliente | null) => void; alCerrar: () => void }) {
  const [paso, setPaso] = useState<'contacto' | 'codigo'>('contacto');
  const [contacto, setContacto] = useState('');
  const [nombre, setNombre] = useState('');
  const [promociones, setPromociones] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [destino, setDestino] = useState<{ canal: 'WHATSAPP' | 'CORREO'; destino: string } | null>(null);
  const [espera, setEspera] = useState(0);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (espera <= 0) return;
    const t = setTimeout(() => setEspera((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [espera]);

  async function accion(fn: () => Promise<void>) {
    setTrabajando(true);
    setError('');
    try {
      await fn();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setTrabajando(false);
    }
  }

  const pedirCodigo = () =>
    accion(async () => {
      const r = await api<{ canal: 'WHATSAPP' | 'CORREO'; destino: string }>('POST', '/frecuentes/codigo', { contacto: contacto.replace(/\s/g, esCelular(contacto) ? '' : ' ').trim() });
      setDestino(r);
      setPaso('codigo');
      setCodigo('');
      setEspera(60);
    });

  const confirmar = () =>
    accion(async () => {
      const r = await api<{ token: string; cliente: EstadoCliente }>('POST', '/frecuentes/verificar', {
        contacto: contacto.replace(/\s/g, esCelular(contacto) ? '' : ' ').trim(),
        codigo,
        nombre: nombre.trim() || undefined,
        aceptaPromociones: promociones,
      });
      guardarCliente(r.token);
      alCambiar(r.cliente);
    });

  const cambiarPermiso = (acepta: boolean) =>
    accion(async () => {
      alCambiar(await api<EstadoCliente>('PATCH', '/frecuentes/yo/promociones', { acepta }));
    });

  const contactoValido = esCelular(contacto) ? /^9\d{8}$/.test(contacto.replace(/\s/g, '')) : /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contacto.trim());

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 sm:items-center" onClick={alCerrar}>
      <div className="animar-entrada alto-hoja flex w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white sm:rounded-3xl" role="dialog" aria-modal="true" aria-label="Clientes frecuentes" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-100 text-2xl text-amber-600">
              <Ico n="estrella" />
            </span>
            <div>
              <h2 className="text-xl font-bold">Clientes frecuentes</h2>
              <p className="text-sm text-slate-600">Combos exclusivos por venir seguido</p>
            </div>
          </div>
          <button className="btn-secundario h-12 w-12 shrink-0 px-0 text-lg" onClick={alCerrar} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {cliente ? (
            <>
              <div className={`rounded-2xl p-4 ${cliente.frecuente ? 'bg-amber-50 ring-2 ring-amber-300' : 'bg-brasa-50'}`}>
                <p className="text-lg font-bold">
                  {cliente.frecuente ? '¡Eres Cliente frecuente!' : `Hola${cliente.nombre ? `, ${cliente.nombre.split(' ')[0]}` : ''}`}
                </p>
                <p className="mb-3 text-sm text-slate-600">
                  {cliente.canal === 'WHATSAPP' ? 'Celular' : 'Correo'}: {cliente.contacto}
                </p>
                <AvanceFrecuente c={cliente} />
                {cliente.frecuente && <p className="mt-2 text-sm font-semibold text-amber-800">Mira la sección «Para clientes frecuentes» en la carta.</p>}
              </div>
              <p className="text-sm text-slate-600">
                Suma una compra cada vez que pagas desde la carta (o dictas tu {cliente.canal === 'WHATSAPP' ? 'celular' : 'correo'} en caja), desde {soles(cliente.montoMinimo)}. Se cuentan las de los últimos {cliente.dias} días.
              </p>
              <label className="flex min-h-11 items-start gap-3 rounded-xl border border-slate-200 p-3">
                <input type="checkbox" className="mt-1 h-5 w-5 accent-brasa-700" checked={cliente.aceptaPromociones} disabled={trabajando} onChange={(e) => cambiarPermiso(e.target.checked)} />
                <span className="text-base">
                  Quiero recibir promociones por {cliente.canal === 'WHATSAPP' ? 'WhatsApp' : 'correo'}
                  <span className="block text-sm text-slate-500">Puedes desactivarlo cuando quieras.</span>
                </span>
              </label>
              <button
                className="btn-secundario w-full"
                onClick={() => {
                  olvidarCliente();
                  alCambiar(null);
                }}
              >
                No soy yo · salir
              </button>
            </>
          ) : paso === 'contacto' ? (
            <>
              <p className="text-base text-slate-700">
                Identifícate con tu <b>celular</b> o tu <b>correo</b>. No necesitas contraseña: te enviamos un código para confirmar que es tuyo.
              </p>
              <div>
                <label className="mb-1 block text-sm font-semibold" htmlFor="contacto-frecuente">
                  Celular o correo
                </label>
                <input
                  id="contacto-frecuente"
                  className="campo text-lg"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="987654321 o tucorreo@gmail.com"
                  value={contacto}
                  onChange={(e) => setContacto(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold" htmlFor="nombre-frecuente">
                  Tu nombre (opcional)
                </label>
                <input id="nombre-frecuente" className="campo" autoComplete="given-name" maxLength={80} placeholder="Para saludarte" value={nombre} onChange={(e) => setNombre(e.target.value)} />
              </div>
              <label className="flex min-h-11 items-start gap-3 rounded-xl border border-slate-200 p-3">
                <input type="checkbox" className="mt-1 h-5 w-5 accent-brasa-700" checked={promociones} onChange={(e) => setPromociones(e.target.checked)} />
                <span className="text-base">
                  Acepto recibir promociones
                  <span className="block text-sm text-slate-500">Opcional. Sin esto igual acumulas compras y ves tus combos.</span>
                </span>
              </label>
              <p className="text-sm text-slate-500">
                Usamos tu dato solo para este programa. Más detalles en la{' '}
                <Link href="/privacidad" className="underline">
                  política de privacidad
                </Link>
                .
              </p>
              <button className="btn-primario w-full" disabled={!contactoValido || trabajando} onClick={pedirCodigo}>
                {trabajando ? 'Enviando…' : 'Enviarme el código'}
              </button>
            </>
          ) : (
            <>
              <p className="text-base text-slate-700">
                Te enviamos un código de 6 dígitos por <b>{destino?.canal === 'CORREO' ? 'correo' : 'WhatsApp'}</b> a <b>{destino?.destino}</b>.
              </p>
              <input
                className="campo text-center text-2xl tracking-[0.4em]"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                aria-label="Código de 6 dígitos"
                placeholder="000000"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && codigo.length === 6 && confirmar()}
              />
              <button className="btn-primario w-full" disabled={codigo.length !== 6 || trabajando} onClick={confirmar}>
                {trabajando ? 'Confirmando…' : 'Confirmar'}
              </button>
              <div className="flex justify-between gap-2 text-sm">
                <button className="min-h-11 font-semibold text-slate-600 underline" onClick={() => (setPaso('contacto'), setError(''))}>
                  Cambiar mi dato
                </button>
                <button className="min-h-11 font-semibold text-brasa-700 underline disabled:text-slate-400 disabled:no-underline" disabled={espera > 0 || trabajando} onClick={pedirCodigo}>
                  {espera > 0 ? `Reenviar en ${espera} s` : 'Reenviar código'}
                </button>
              </div>
            </>
          )}
          {error && (
            <p role="alert" className="rounded-xl bg-red-50 p-3 text-base font-semibold text-red-700">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
