'use client';
import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ErrorApi } from '@/lib/api';
import { Categoria, Comanda, ItemCarrito, precioItem, Producto } from '@/lib/tipos';
import { hora, soles, useEventos, uuid } from '@/lib/util';
import { SelectorProducto } from '@/components/SelectorProducto';

interface CuentaQR {
  mesa: string;
  maestra: string | null;
  estadoMesa: string;
  estadoCuenta: string;
  total: number;
  saldo: number;
  descuento: number;
  porConfirmar: boolean;
  pagoEnCurso: string | null;
  comprobantes: { id: string; numero: string }[];
  pedidos: Comanda[];
}

/** Carta digital del comensal (F-04): se abre al escanear el QR de la mesa, sin instalar nada. */
export default function CartaQR({ params }: { params: Promise<{ numero: string }> }) {
  const { numero } = use(params);
  const router = useRouter();
  const [demora, setDemora] = useState(false);
  const [pagando, setPagando] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [mesaId, setMesaId] = useState<string | null>(null);
  const [carta, setCarta] = useState<Categoria[]>([]);
  const [cat, setCat] = useState(0);
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [elegido, setElegido] = useState<Producto | null>(null);
  const [vista, setVista] = useState<'carta' | 'pedido' | 'cuenta'>('carta');
  const [cuenta, setCuenta] = useState<CuentaQR | null>(null);
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: 'ok' | 'error' } | null>(null);
  const [error, setError] = useState('');
  const [clave, setClave] = useState(uuid);
  const [enviando, setEnviando] = useState(false);

  const cargarCarta = () => api<Categoria[]>('GET', '/carta').then(setCarta);
  const cargarCuenta = useCallback(async (t = token) => {
    if (!t) return;
    try {
      setCuenta(await api<CuentaQR>('GET', `/qr-cuenta?token=${t}`));
    } catch (e: any) {
      setError(e.message);
    }
  }, [token]);

  useEffect(() => {
    api<{ mesa: { id: string; numero: string }; token: string }>('GET', `/qr/${numero}`)
      .then((r) => {
        setToken(r.token);
        setMesaId(r.mesa.id);
        cargarCuenta(r.token);
      })
      .catch((e) => setError(e.message));
    cargarCarta().catch(() => {});
    if (window.location.hash === '#cuenta') setVista('cuenta'); // al volver de la pasarela
    api<{ demora: boolean }>('GET', '/cocina/carga').then((c) => setDemora(c.demora)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numero]);

  useEventos(
    {
      'carta:actualizada': () => {
        cargarCarta();
        // Si algo del carrito se agotó, se avisará al enviar (el servidor vuelve a validar)
      },
      'cuenta:actualizada': (d) => d?.mesaId === mesaId && cargarCuenta(),
      'mesas:cambio': () => cargarCuenta(),
      'cocina:actualizar': () => api<{ demora: boolean }>('GET', '/cocina/carga').then((c) => setDemora(c.demora)).catch(() => {}),
    },
    [mesaId, token],
  );

  function avisar(texto: string, tipo: 'ok' | 'error' = 'ok') {
    setMensaje({ texto, tipo });
    setTimeout(() => setMensaje(null), 4000);
  }

  async function enviar() {
    if (!token) return;
    setEnviando(true);
    try {
      await api('POST', '/qr/pedidos', {
        token,
        clave,
        items: carrito.map((i) => ({ productoId: i.producto.id, cantidad: i.cantidad, nota: i.nota, opciones: i.opciones.map((o) => o.id) })),
      });
      setCarrito([]);
      setClave(uuid());
      setVista('cuenta');
      avisar('¡Pedido enviado! El mozo lo confirmará en un momento.');
      cargarCuenta();
    } catch (e) {
      const err = e as ErrorApi;
      avisar(err.status === 0 ? 'Sin conexión. Tu pedido sigue aquí; inténtalo de nuevo.' : err.message, 'error');
      cargarCarta();
    } finally {
      setEnviando(false);
    }
  }

  /** F-09: pagar el total de la mesa desde el celular con la pasarela. */
  async function pagarEnLinea() {
    setPagando(true);
    try {
      const r = await api<{ intentoId: string }>('POST', '/qr/pago/iniciar', { token });
      router.push(`/pasarela/${r.intentoId}?volver=${encodeURIComponent('/m/' + numero + '#cuenta')}`);
    } catch (e: any) {
      avisar(e.message, 'error');
      setPagando(false);
    }
  }

  async function llamar(motivo: 'MOZO' | 'CUENTA') {
    try {
      await api('POST', '/qr/llamar', { token, motivo });
      avisar(motivo === 'CUENTA' ? 'Pedimos tu cuenta. El mozo te la traerá.' : 'El mozo viene en camino.');
      cargarCuenta();
    } catch (e: any) {
      avisar(e.message, 'error');
    }
  }

  if (error && !token)
    return (
      <main className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <div className="text-5xl">🍗</div>
          <h1 className="mt-3 text-xl font-bold">Mesa {numero}</h1>
          <p className="mt-2 text-slate-600">{error}</p>
        </div>
      </main>
    );

  const total = carrito.reduce((s, i) => s + precioItem(i), 0);
  const cantidad = carrito.reduce((s, i) => s + i.cantidad, 0);

  return (
    <main className="mx-auto min-h-screen max-w-lg bg-white pb-40">
      <header className="bg-brasa-700 px-5 pb-5 pt-6 text-white">
        <h1 className="text-2xl font-extrabold">🍗 Pollería y Brasas</h1>
        <span className="mt-2 inline-block rounded-full bg-white/20 px-3 py-1 text-sm font-semibold">Mesa {numero}{cuenta?.maestra ? ` · unida a ${cuenta.maestra}` : ''} · Salón</span>
      </header>

      <nav className="sticky top-0 z-20 flex gap-2 border-b border-slate-100 bg-white px-4 py-3">
        {(['carta', 'pedido', 'cuenta'] as const).map((v) => (
          <button key={v} className={vista === v ? 'chip-on flex-1' : 'chip-off flex-1'} onClick={() => (setVista(v), v === 'cuenta' && cargarCuenta())}>
            {v === 'carta' ? 'Carta' : v === 'pedido' ? `Mi pedido${cantidad ? ` (${cantidad})` : ''}` : 'Mi cuenta'}
          </button>
        ))}
      </nav>

      {demora && (
        <div className="mx-4 mt-3 rounded-xl bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900">⏱ Tiempo estimado de preparación: 25 a 35 min</div>
      )}

      {vista === 'carta' && (
        <>
          <div className="flex gap-2 overflow-x-auto px-4 py-3">
            {carta.map((c, i) => (
              <button key={c.id} className={i === cat ? 'chip-on whitespace-nowrap' : 'chip-off whitespace-nowrap'} onClick={() => setCat(i)}>
                {c.nombre}
              </button>
            ))}
          </div>
          <div className="space-y-3 px-4">
            {carta[cat]?.productos.map((p) => (
              <button
                key={p.id}
                disabled={p.agotado}
                onClick={() => setElegido(p)}
                className={`tarjeta flex w-full items-center gap-3 p-3 text-left ${p.agotado ? 'opacity-50' : 'active:scale-[0.99]'}`}
              >
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-brasa-100 text-3xl">
                  {carta[cat].nombre === 'Bebidas' ? '🥤' : carta[cat].nombre === 'Extras' ? '🍟' : '🍗'}
                </div>
                <div className="flex-1">
                  <div className="font-bold">{p.nombre}</div>
                  <div className="text-sm text-slate-500">
                    {p.agotado ? 'Agotado por ahora' : p.grupos.some((g) => g.nombre.startsWith('Presa')) ? 'Elige tu presa y cremas' : p.grupos.length ? 'Elige tus opciones' : ' '}
                  </div>
                  <div className="font-bold text-brasa-700">{soles(p.precio)}</div>
                </div>
                {!p.agotado && <span className="grid h-9 w-9 place-items-center rounded-full bg-brasa-700 text-xl text-white">+</span>}
              </button>
            ))}
          </div>
          <p className="mt-6 px-4 text-center text-xs text-slate-400">
            Precios incluyen IGV. <a className="underline" href="https://reclamos.servicios.gob.pe" target="_blank" rel="noreferrer">Libro de Reclamaciones</a>
          </p>
        </>
      )}

      {vista === 'pedido' && (
        <div className="space-y-3 p-4">
          {carrito.length === 0 && <p className="py-10 text-center text-slate-500">Aún no agregas productos. Ve a la carta 🍗</p>}
          {carrito.map((i) => (
            <div key={i.clave} className="tarjeta flex gap-3 p-3">
              <div className="flex-1">
                <div className="font-bold">
                  {i.cantidad}× {i.producto.nombre}
                </div>
                {i.opciones.length > 0 && <div className="text-sm text-slate-600">{i.opciones.map((o) => o.nombre).join(' · ')}</div>}
                {i.nota && <div className="text-sm italic text-slate-500">{i.nota}</div>}
              </div>
              <div className="text-right">
                <div className="font-bold">{soles(precioItem(i))}</div>
                <button className="text-sm text-red-600" onClick={() => setCarrito((c) => c.filter((x) => x.clave !== i.clave))}>
                  Quitar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {vista === 'cuenta' && cuenta && (
        <div className="p-4">
          <div className="tarjeta p-4">
            <h2 className="mb-2 text-lg font-bold">Cuenta de la mesa {cuenta.mesa}</h2>
            {cuenta.pedidos.length === 0 && <p className="text-slate-500">Todavía no hay pedidos.</p>}
            {cuenta.pedidos.map((p, k) => (
              <div key={p.id} className="border-b border-slate-100 py-2">
                <div className="flex items-center justify-between text-xs font-bold uppercase text-slate-400">
                  <span>Ronda {k + 1} · {hora(p.creadoEn)}</span>
                  <span className={p.estado === 'POR_CONFIRMAR' ? 'text-amber-600' : p.estado === 'SERVIDO' ? 'text-green-700' : 'text-brasa-700'}>
                    {p.estado === 'POR_CONFIRMAR' ? 'esperando al mozo' : p.estado === 'EN_PREPARACION' ? 'en preparación' : p.estado.toLowerCase()}
                  </span>
                </div>
                {p.items.map((it, j) => (
                  <div key={j} className="flex justify-between text-sm">
                    <span>
                      {it.cantidad}× {it.producto}
                      {it.opciones.length > 0 && <span className="text-slate-500"> · {it.opciones.map((o) => o.nombre).join(', ')}</span>}
                    </span>
                    <span>{(it.precio * it.cantidad).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            ))}
            {cuenta.descuento > 0 && (
              <div className="mt-2 flex justify-between text-sm text-green-700">
                <span>Descuento</span>
                <span>- {soles(cuenta.descuento)}</span>
              </div>
            )}
            <div className="mt-3 flex justify-between text-xl font-extrabold">
              <span>Total</span>
              <span>{soles(cuenta.total)}</span>
            </div>
            {cuenta.saldo !== cuenta.total && cuenta.estadoCuenta !== 'PAGADA' && (
              <div className="flex justify-between font-bold text-brasa-700">
                <span>Por pagar</span>
                <span>{soles(cuenta.saldo)}</span>
              </div>
            )}
          </div>
          {cuenta.estadoCuenta === 'PAGADA' ? (
            <div className="mt-4 rounded-2xl bg-green-50 p-4 text-center">
              <div className="text-4xl">✅</div>
              <p className="font-bold text-green-800">¡Cuenta pagada! Gracias por tu visita.</p>
              {cuenta.comprobantes.map((c) => (
                <a key={c.id} href={`/c/${c.id}`} className="btn-verde mt-3 w-full">
                  🧾 Ver mi boleta {c.numero}
                </a>
              ))}
            </div>
          ) : cuenta.saldo > 0 ? (
            <div className="mt-4">
              <button className="btn-verde w-full rounded-full text-lg" disabled={pagando || cuenta.porConfirmar} onClick={pagarEnLinea}>
                {cuenta.pagoEnCurso ? 'Continuar con el pago' : `💳 Pagar ahora ${soles(cuenta.saldo)}`}
              </button>
              <p className="mt-2 text-center text-xs text-slate-500">
                {cuenta.porConfirmar ? 'Espera a que el mozo confirme tu último pedido para pagar.' : 'Yape, Plin o tarjeta. También puedes pedir la cuenta y pagar en caja.'}
              </p>
            </div>
          ) : null}
        </div>
      )}

      <footer className="fixed bottom-0 left-1/2 w-full max-w-lg -translate-x-1/2 space-y-2 border-t border-slate-100 bg-white p-3">
        <div className="grid grid-cols-2 gap-2">
          <button className="btn-secundario border-brasa-700 text-brasa-700" onClick={() => llamar('MOZO')}>
            🛎 Llamar al mozo
          </button>
          <button className="btn-secundario border-brasa-700 text-brasa-700" onClick={() => llamar('CUENTA')}>
            🧾 Pedir la cuenta
          </button>
        </div>
        {carrito.length > 0 &&
          (vista === 'pedido' ? (
            <button className="btn-primario w-full rounded-full text-lg" disabled={enviando} onClick={enviar}>
              {enviando ? 'Enviando…' : `Enviar pedido · ${soles(total)}`}
            </button>
          ) : (
            <button className="btn-primario w-full justify-between rounded-full text-lg" onClick={() => setVista('pedido')}>
              <span className="rounded-full bg-white/20 px-3">{cantidad}</span>
              <span>Ver mi pedido</span>
              <span>{soles(total)}</span>
            </button>
          ))}
      </footer>

      {elegido && (
        <SelectorProducto
          producto={elegido}
          alCerrar={() => setElegido(null)}
          alAgregar={(cant, opciones, nota) => {
            setCarrito((c) => [...c, { clave: uuid(), producto: elegido, cantidad: cant, opciones, nota }]);
            setElegido(null);
            avisar(`${elegido.nombre} agregado`);
          }}
        />
      )}
      {mensaje && (
        <div className={`fixed left-1/2 top-4 z-50 w-[92%] max-w-md -translate-x-1/2 rounded-xl px-4 py-3 text-center font-semibold text-white shadow-lg animar-entrada ${mensaje.tipo === 'error' ? 'bg-red-600' : 'bg-green-700'}`}>
          {mensaje.texto}
        </div>
      )}
    </main>
  );
}
