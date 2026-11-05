'use client';
import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ErrorApi, urlServidor } from '@/lib/api';
import { Categoria, Comanda, ItemCarrito, Opcion, precioItem, Producto } from '@/lib/tipos';
import { hora, pitido, soles, useEventos, uuid } from '@/lib/util';
import { SelectorProducto } from '@/components/SelectorProducto';
import { PanelPago } from '@/components/comensal/PanelPago';
import { Calificar } from '@/components/comensal/Calificar';
import { BotonLectura } from '@/components/comensal/Lectura';

interface PedidoQR extends Comanda {
  listoEnMin: number | null;
}
interface CuentaQR {
  mesa: string;
  maestra: string | null;
  estadoMesa: string;
  estadoCuenta: string;
  total: number;
  saldo: number;
  disponible: number;
  descuento: number;
  porConfirmar: boolean;
  pagoEnCurso: string | null;
  calificada: boolean;
  comprobantes: { id: string; numero: string }[];
  pedidos: PedidoQR[];
}

const ICONO: Record<string, string> = { Bebidas: '🥤', Extras: '🍟', Combos: '🎁' };
const sinTildes = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Foto del plato o, si no tiene, un ícono de su categoría. */
function FotoProducto({ p, categoria, grande = false }: { p: Producto; categoria: string; grande?: boolean }) {
  const tam = grande ? "h-24 w-24" : "h-16 w-16 min-[360px]:h-20 min-[360px]:w-20";
  if (p.fotoUrl) return <img src={`${urlServidor()}${p.fotoUrl}`} alt="" loading="lazy" decoding="async" className={`${tam} shrink-0 rounded-xl object-cover`} />;
  return <div aria-hidden className={`grid ${tam} shrink-0 place-items-center rounded-xl bg-brasa-100 text-3xl`}>{ICONO[categoria] ?? '🍗'}</div>;
}

/** Carta digital del comensal (F-04): se abre al escanear el QR de la mesa, sin instalar nada. */
export default function CartaQR({ params }: { params: Promise<{ numero: string }> }) {
  const { numero } = use(params);
  const [demora, setDemora] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [mesaId, setMesaId] = useState<string | null>(null);
  const [carta, setCarta] = useState<Categoria[]>([]);
  const [destacados, setDestacados] = useState<string[]>([]);
  const [cat, setCat] = useState(0);
  const [buscar, setBuscar] = useState('');
  const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
  const [elegido, setElegido] = useState<Producto | null>(null);
  const [vista, setVista] = useState<'carta' | 'pedido' | 'cuenta'>('carta');
  const [cuenta, setCuenta] = useState<CuentaQR | null>(null);
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: 'ok' | 'error' } | null>(null);
  const [listo, setListo] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [clave, setClave] = useState(uuid);
  const [enviando, setEnviando] = useState(false);
  const [, setTic] = useState(0);
  const pie = useRef<HTMLElement>(null);
  const [altoPie, setAltoPie] = useState(140);

  useEffect(() => {
    const el = pie.current;
    if (!el) return;
    setAltoPie(el.offsetHeight);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setAltoPie(el.offsetHeight));
    ro.observe(el, { box: 'border-box' });
    // Por si el tamaño de letra guardado se aplica después del primer dibujo
    const t = setTimeout(() => setAltoPie(el.offsetHeight), 400);
    return () => (ro.disconnect(), clearTimeout(t));
  }, []);

  const cargarCarta = () => api<Categoria[]>('GET', '/carta').then(setCarta);
  const cargarCuenta = useCallback(
    async (t = token) => {
      if (!t) return;
      try {
        setCuenta(await api<CuentaQR>('GET', `/qr-cuenta?token=${t}`));
      } catch (e: any) {
        setError(e.message);
      }
    },
    [token],
  );

  useEffect(() => {
    api<{ mesa: { id: string; numero: string }; token: string }>('GET', `/qr/${numero}`)
      .then((r) => {
        setToken(r.token);
        setMesaId(r.mesa.id);
        cargarCuenta(r.token);
      })
      .catch((e) => setError(e.message));
    cargarCarta().catch(() => {});
    api<string[]>('GET', '/carta/destacados').then(setDestacados).catch(() => {});
    if (window.location.hash === '#cuenta') setVista('cuenta'); // al volver de la pasarela
    api<{ demora: boolean }>('GET', '/cocina/carga').then((c) => setDemora(c.demora)).catch(() => {});
    // El tiempo estimado se actualiza solo cada minuto
    const t = setInterval(() => setTic((x) => x + 1), 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numero]);

  useEventos(
    {
      'carta:actualizada': () => cargarCarta(),
      'cuenta:actualizada': (d) => d?.mesaId === mesaId && cargarCuenta(),
      'mesas:cambio': () => cargarCuenta(),
      'cocina:actualizar': () => api<{ demora: boolean }>('GET', '/cocina/carga').then((c) => setDemora(c.demora)).catch(() => {}),
      // Punto 8: el celular avisa con vibración y sonido cuando el pedido sale de cocina
      'pedido:listo': (d) => {
        if (d?.mesaId !== mesaId) return;
        setListo(d.numero);
        try {
          navigator.vibrate?.([300, 120, 300, 120, 300]);
        } catch {
          /* sin vibración */
        }
        pitido(3, 990);
        cargarCuenta();
      },
    },
    [mesaId, token],
  );

  function avisar(texto: string, tipo: 'ok' | 'error' = 'ok') {
    setMensaje({ texto, tipo });
    setTimeout(() => setMensaje(null), 4000);
  }

  const productos = useMemo(() => carta.flatMap((c) => c.productos.map((p) => ({ p, categoria: c.nombre }))), [carta]);
  const porId = useMemo(() => new Map(productos.map((x) => [x.p.id, x])), [productos]);

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

  /** Vuelve a poner en el carrito los productos de una ronda (repetir o corregir). */
  function alCarrito(p: PedidoQR) {
    let faltan = 0;
    const nuevos: ItemCarrito[] = [];
    for (const it of p.items) {
      const x = it.productoId ? porId.get(it.productoId) : undefined;
      if (!x || x.p.agotado) {
        faltan++;
        continue;
      }
      const opciones = (it.opcionIds ?? []).map((id) => x.p.grupos.flatMap((g) => g.opciones).find((o) => o.id === id)).filter((o): o is Opcion => !!o && !o.agotado);
      nuevos.push({ clave: uuid(), producto: x.p, cantidad: it.cantidad, opciones, nota: it.nota ?? '' });
    }
    setCarrito((c) => [...c, ...nuevos]);
    setVista('pedido');
    avisar(faltan ? `Agregamos ${nuevos.length} producto(s). ${faltan} ya no está(n) disponible(s).` : 'Revisa tu pedido y envíalo.', faltan ? 'error' : 'ok');
  }

  /** Punto 4: cancelar una ronda que el mozo aún no confirma, para corregirla. */
  async function cancelar(p: PedidoQR, corregir: boolean) {
    if (!token) return;
    try {
      await api('POST', `/qr/pedidos/${p.id}/cancelar`, { token });
      if (corregir) alCarrito(p);
      else avisar('Pedido cancelado.');
      cargarCuenta();
    } catch (e: any) {
      avisar(e.message, 'error');
      cargarCuenta();
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
      <main className="alto-pantalla grid place-items-center p-6 text-center">
        <div>
          <div className="text-5xl">🍗</div>
          <h1 className="mt-3 text-xl font-bold">Mesa {numero}</h1>
          <p className="mt-2 text-lg text-slate-700">{error}</p>
        </div>
      </main>
    );

  const total = carrito.reduce((s, i) => s + precioItem(i), 0);
  const cantidad = carrito.reduce((s, i) => s + i.cantidad, 0);
  const termino = sinTildes(buscar.trim());
  const resultados = termino ? productos.filter((x) => sinTildes(`${x.p.nombre} ${x.p.descripcion ?? ''}`).includes(termino)) : [];
  const masPedidos = destacados.map((id) => porId.get(id)).filter((x): x is { p: Producto; categoria: string } => !!x && !x.p.agotado);
  const rondasPrevias = cuenta?.pedidos.filter((p) => p.estado !== 'POR_CONFIRMAR' && !p.reposicion) ?? [];

  const tarjeta = (x: { p: Producto; categoria: string }) => (
    <button
      key={x.p.id}
      disabled={x.p.agotado}
      onClick={() => setElegido(x.p)}
      className={`tarjeta flex w-full items-center gap-3 p-3 text-left ${x.p.agotado ? 'opacity-60' : 'active:scale-[0.99]'}`}
    >
      <FotoProducto p={x.p} categoria={x.categoria} />
      <div className="min-w-0 flex-1">
        <div className="break-words text-lg font-bold leading-snug">{x.p.nombre}</div>
        {x.p.descripcion && <div className="line-clamp-3 text-base leading-snug text-slate-600">{x.p.descripcion}</div>}
        {x.p.componentes && x.p.componentes.length > 0 && <div className="text-sm text-slate-600">Incluye: {x.p.componentes.join(' + ')}</div>}
        {x.p.agotado && <div className="text-base font-semibold text-slate-700">Agotado por ahora</div>}
        <div className="mt-0.5 text-lg font-extrabold text-brasa-700">{soles(x.p.precio)}</div>
      </div>
      {!x.p.agotado && (
        <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brasa-700 text-2xl text-white">
          +
        </span>
      )}
    </button>
  );

  return (
    <main className="alto-pantalla lados-seguros mx-auto max-w-lg bg-white sm:max-w-2xl" style={{ paddingBottom: altoPie + 16 }}>
      <header className="relleno-seguro-arriba flex items-start justify-between gap-3 bg-brasa-700 px-5 pb-5 text-white apaisado:pb-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold leading-tight apaisado:text-xl">🍗 Pollería y Brasas</h1>
          <span className="mt-2 inline-block rounded-full bg-white/20 px-3 py-1 text-base font-semibold">
            Mesa {numero}
            {cuenta?.maestra ? ` · unida a ${cuenta.maestra}` : ''} · Salón
          </span>
        </div>
        <BotonLectura claro />
      </header>

      <nav aria-label="Secciones" className="sticky top-0 z-20 flex gap-2 border-b border-slate-200 bg-white px-4 py-3 apaisado:static apaisado:py-2">
        {(['carta', 'pedido', 'cuenta'] as const).map((v) => (
          <button key={v} aria-current={vista === v ? 'page' : undefined} className={vista === v ? 'chip-on flex-1 px-2 text-base' : 'chip-off flex-1 px-2 text-base'} onClick={() => (setVista(v), v === 'cuenta' && cargarCuenta())}>
            {v === 'carta' ? 'Carta' : v === 'pedido' ? `Mi pedido${cantidad ? ` (${cantidad})` : ''}` : 'Mi cuenta'}
          </button>
        ))}
      </nav>

      {listo !== null && (
        <button className="mx-4 mt-3 block w-[calc(100%-2rem)] rounded-2xl bg-green-600 p-4 text-left text-white shadow-lg animar-entrada" onClick={() => setListo(null)}>
          <div className="text-lg font-extrabold">🔔 ¡Tu pedido #{listo} está listo!</div>
          <div className="text-sm">El mozo te lo lleva a la mesa en un momento. Toca para cerrar.</div>
        </button>
      )}
      {demora && <div role="status" className="mx-4 mt-3 rounded-xl bg-amber-100 px-4 py-2 text-base font-semibold text-amber-900">⏱ La cocina tiene muchos pedidos ahora: el tuyo puede demorar un poco más.</div>}

      {vista === 'carta' && (
        <>
          <div className="px-4 pt-3">
            <input className="campo text-lg" type="search" enterKeyHint="search" aria-label="Buscar en la carta" placeholder="🔍 Buscar (ej.: chicha, mostrito)" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
          </div>
          {termino ? (
            <div className="grid grid-cols-1 gap-3 px-4 pt-3 sm:grid-cols-2">
              {resultados.length === 0 && <p className="py-6 text-center text-slate-500">No encontramos «{buscar}».</p>}
              {resultados.map(tarjeta)}
            </div>
          ) : (
            <>
              {rondasPrevias.length > 0 && (
                <div className="mx-4 mt-3 flex items-center justify-between gap-2 rounded-xl bg-brasa-50 p-3">
                  <span className="text-base font-semibold text-brasa-800">¿Otra ronda igual?</span>
                  <button className="chip-on whitespace-nowrap" onClick={() => alCarrito(rondasPrevias[rondasPrevias.length - 1])}>
                    ↻ Repetir lo último
                  </button>
                </div>
              )}
              {masPedidos.length > 0 && (
                <section className="pt-3">
                  <h2 className="px-4 text-base font-bold uppercase text-slate-700">⭐ Lo más pedido</h2>
                  <div className="flex gap-3 overflow-x-auto px-4 py-2">
                    {masPedidos.map((x) => (
                      <button key={x.p.id} onClick={() => setElegido(x.p)} className="tarjeta w-40 shrink-0 p-2 text-left active:scale-[0.98]">
                        <FotoProducto p={x.p} categoria={x.categoria} grande />
                        <div className="mt-1 line-clamp-2 text-base font-bold leading-snug">{x.p.nombre}</div>
                        <div className="text-base font-extrabold text-brasa-700">{soles(x.p.precio)}</div>
                      </button>
                    ))}
                  </div>
                </section>
              )}
              <div role="tablist" aria-label="Categorías" className="flex gap-2 overflow-x-auto px-4 py-3">
                {carta.map((c, i) => (
                  <button key={c.id} role="tab" aria-selected={i === cat} className={i === cat ? 'chip-on whitespace-nowrap text-base' : 'chip-off whitespace-nowrap text-base'} onClick={() => setCat(i)}>
                    {c.nombre}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-3 px-4 sm:grid-cols-2">{carta[cat]?.productos.map((p) => tarjeta({ p, categoria: carta[cat].nombre }))}</div>
            </>
          )}
          <p className="mt-6 px-4 text-center text-sm text-slate-600">Precios incluyen IGV.</p>
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
                {i.opciones.length > 0 && <div className="text-base text-slate-700">{i.opciones.map((o) => o.nombre).join(' · ')}</div>}
                {i.nota && <div className="text-base italic text-slate-600">{i.nota}</div>}
              </div>
              <div className="text-right">
                <div className="font-bold">{soles(precioItem(i))}</div>
                <button className="min-h-11 px-2 text-base font-semibold text-red-700 underline" aria-label={`Quitar ${i.producto.nombre}`} onClick={() => setCarrito((c) => c.filter((x) => x.clave !== i.clave))}>
                  Quitar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {vista === 'cuenta' && cuenta && (
        <div className="space-y-4 p-4">
          <div className="tarjeta p-4">
            <h2 className="mb-2 text-lg font-bold">Cuenta de la mesa {cuenta.mesa}</h2>
            {cuenta.pedidos.length === 0 && <p className="text-slate-500">Todavía no hay pedidos.</p>}
            {cuenta.pedidos.map((p, k) => (
              <div key={p.id} className="border-b border-slate-100 py-2">
                <div className="flex flex-wrap items-center justify-between gap-x-2 text-sm font-bold uppercase text-slate-600">
                  <span>
                    Ronda {k + 1} · {hora(p.creadoEn)}
                  </span>
                  <span className={p.estado === 'POR_CONFIRMAR' ? 'text-amber-600' : p.estado === 'SERVIDO' ? 'text-green-700' : 'text-brasa-700'}>
                    {p.estado === 'POR_CONFIRMAR'
                      ? 'esperando al mozo'
                      : p.estado === 'EN_PREPARACION'
                        ? p.listoEnMin
                          ? `en preparación · listo en ~${p.listoEnMin} min`
                          : 'en preparación'
                        : p.estado === 'SERVIDO'
                          ? 'listo ✓'
                          : p.estado.toLowerCase()}
                  </span>
                </div>
                {p.items.map((it, j) => (
                  <div key={j} className="flex justify-between gap-2 text-base">
                    <span>
                      {it.cantidad}× {it.producto}
                      {it.opciones.length > 0 && <span className="text-slate-500"> · {it.opciones.map((o) => o.nombre).join(', ')}</span>}
                    </span>
                    <span>{(it.precio * it.cantidad).toFixed(2)}</span>
                  </div>
                ))}
                {p.estado === 'POR_CONFIRMAR' && (
                  <div className="mt-2 flex gap-2">
                    <button className="chip-off text-base" onClick={() => cancelar(p, true)}>
                      ✏️ Corregir
                    </button>
                    <button className="chip-off text-base text-red-700" onClick={() => cancelar(p, false)}>
                      Cancelar
                    </button>
                  </div>
                )}
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
            {cuenta.comprobantes.length > 0 && (
              <div className="mt-3 space-y-1 border-t border-slate-100 pt-2">
                {cuenta.comprobantes.map((c) => (
                  <a key={c.id} href={`/c/${c.id}`} className="flex min-h-11 items-center text-base font-semibold text-blue-700 underline">
                    🧾 Comprobante {c.numero}
                  </a>
                ))}
              </div>
            )}
          </div>

          {cuenta.estadoCuenta === 'PAGADA' ? (
            <div className="rounded-2xl bg-green-50 p-4 text-center">
              <div className="text-4xl">✅</div>
              <p className="font-bold text-green-800">¡Cuenta pagada! Gracias por tu visita.</p>
            </div>
          ) : cuenta.saldo > 0 && token ? (
            <PanelPago token={token} numero={numero} saldo={cuenta.saldo} totalCuenta={cuenta.total} disponible={cuenta.disponible} bloqueado={cuenta.porConfirmar} alError={(t) => avisar(t, 'error')} />
          ) : null}

          {token && cuenta.pedidos.some((p) => p.estado === 'SERVIDO') && !cuenta.calificada && <Calificar token={token} alListo={() => (avisar('¡Gracias por tu opinión!'), cargarCuenta())} alError={(t) => avisar(t, 'error')} />}
        </div>
      )}

      <footer
        ref={pie}
        className="relleno-seguro-abajo lados-seguros fixed bottom-0 left-1/2 z-20 grid w-full max-w-lg -translate-x-1/2 grid-cols-2 gap-2 border-t border-slate-200 bg-white px-3 pt-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] sm:max-w-2xl apaisado:grid-cols-4"
      >
        <button className="btn-secundario border-2 border-brasa-700 px-2 text-base leading-tight text-brasa-700" onClick={() => llamar('MOZO')}>
          🛎 Llamar al mozo
        </button>
        <button className="btn-secundario border-2 border-brasa-700 px-2 text-base leading-tight text-brasa-700" onClick={() => llamar('CUENTA')}>
          🧾 Pedir la cuenta
        </button>
        {carrito.length > 0 &&
          (vista === 'pedido' ? (
            <button className="btn-primario col-span-2 w-full rounded-full text-lg" disabled={enviando} onClick={enviar}>
              {enviando ? 'Enviando…' : `Enviar pedido · ${soles(total)}`}
            </button>
          ) : (
            <button className="btn-primario col-span-2 w-full justify-between rounded-full text-lg" onClick={() => setVista('pedido')}>
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
      <footer className="mt-8 flex flex-wrap justify-center gap-x-5 px-4 text-sm text-slate-600">
        <a className="flex min-h-11 items-center gap-1 font-semibold underline" href="/reclamaciones">
          📕 Libro de Reclamaciones
        </a>
        <a className="flex min-h-11 items-center underline" href="/privacidad">
          Privacidad
        </a>
        <a className="flex min-h-11 items-center underline" href="/terminos">
          Términos
        </a>
      </footer>
      {mensaje && (
        <div role="status" aria-live="polite" className={`arriba-seguro fixed left-1/2 z-50 w-[92%] max-w-md -translate-x-1/2 rounded-xl px-4 py-3 text-center text-lg font-semibold text-white shadow-lg animar-entrada ${mensaje.tipo === 'error' ? 'bg-red-700' : 'bg-green-700'}`}>
          {mensaje.texto}
        </div>
      )}
    </main>
  );
}
