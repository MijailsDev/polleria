"use client";
import { Emblema } from "@/components/Logo";
import { Ico, NombreIcono } from "@/components/Ico";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { EquipoNoVinculado } from "@/components/EquipoNoVinculado";
import { Comanda, ItemComanda } from "@/lib/tipos";
import { hora, pitido, useConexion, useEventos } from "@/lib/util";

interface Especial {
  id: string;
  tipo: "ANULACIÓN" | "REIMPRESIÓN";
  detalle: string;
  comanda: Comanda;
  hora: string;
  llegada: number;
}

const PRESA = ["Presa", "Presas", "Corte"];
const CRITICO = /sin sal|bien doradas|sin ensalada|sin papas|8 presas/i;
const CANAL: Record<Comanda["canal"], { texto: string; icono: NombreIcono }> = {
  SALON: { texto: "Salón", icono: "mesa" },
  LLEVAR: { texto: "Para llevar", icono: "bolsa" },
  DELIVERY: { texto: "Delivery", icono: "moto" },
  APP_EXTERNA: { texto: "App", icono: "celular" },
};
/** Semáforo de espera: verde hasta 8 min, ámbar hasta 15, rojo después (REQ-COC-02). */
const semaforo = (min: number) =>
  min >= 15
    ? { barra: "bg-red-600", texto: "text-red-400", borde: "border-red-600" }
    : min >= 8
      ? {
          barra: "bg-amber-500",
          texto: "text-amber-300",
          borde: "border-amber-500",
        }
      : {
          barra: "bg-emerald-600",
          texto: "text-emerald-300",
          borde: "border-slate-700",
        };

const deCocina = (i: ItemComanda) => i.cocina ?? i.destino !== "CAJA";
const espera = (m: number) => (m < 60 ? `${m}′` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}`);
const minutos = (c: Comanda) =>
  Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(c.impresoEn ?? c.creadoEn).getTime()) / 60000,
    ),
  );

/** Lo que el pollero tiene que sacar ahora, sumado entre todas las comandas. */
function porPreparar(comandas: Comanda[]) {
  const total = new Map<string, number>();
  const sumar = (k: string, n: number) => total.set(k, (total.get(k) ?? 0) + n);
  for (const c of comandas)
    for (const it of c.items.filter(deCocina)) {
      const comp = it.componentes?.filter((x) => x.destino !== "CAJA") ?? [];
      const presa = it.opciones
        .filter((o) => PRESA.includes(o.grupo))
        .map((o) => o.nombre);
      if (comp.length)
        comp.forEach((x) => sumar(x.nombre, x.cantidad * it.cantidad));
      else
        sumar(
          presa.length ? `${it.producto} · ${presa.join(", ")}` : it.producto,
          it.cantidad,
        );
    }
  return [...total.entries()].sort((a, b) => b[1] - a[1]);
}

/** Cuerpo de la comanda en letra grande para leerla a 3 metros. */
function Items({ c }: { c: Comanda }) {
  return (
    <ul className="space-y-2.5">
      {c.items.filter(deCocina).map((it) => {
        const presa = it.opciones.filter((o) => PRESA.includes(o.grupo));
        const resto = it.opciones.filter((o) => !PRESA.includes(o.grupo));
        return (
          <li key={it.id}>
            <div className="flex items-baseline gap-2 text-xl font-extrabold leading-tight text-white">
              <span className="text-brasa-300">{it.cantidad}×</span>
              <span>{it.producto}</span>
            </div>
            {presa.map((o, j) => (
              <span
                key={j}
                className="mt-1 mr-1.5 inline-block rounded-md bg-amber-400 px-2 py-0.5 text-lg font-black uppercase text-slate-950"
              >
                {o.nombre}
              </span>
            ))}
            {resto.map((o, j) => (
              <div
                key={j}
                className={`pl-7 text-base ${CRITICO.test(o.nombre) ? "font-black text-amber-300 underline" : "text-slate-300"}`}
              >
                {o.grupo}: {o.nombre}
              </div>
            ))}
            {it.componentes
              ?.filter((x) => x.destino !== "CAJA")
              .map((x) => (
                <div
                  key={x.nombre}
                  className="pl-7 text-base font-semibold text-slate-200"
                >
                  + {x.cantidad} {x.nombre}
                </div>
              ))}
            {it.nota && (
              <div className="mt-1 ml-7 rounded bg-yellow-300 px-2 py-0.5 text-base font-black uppercase text-slate-950">
                Nota: {it.nota}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Pantalla de cocina para un televisor (F-06): se lee a distancia, ordena las comandas de la más
 * antigua a la más nueva y las pinta según el tiempo de espera. Se maneja sin tocar la pantalla con
 * un teclado numérico USB o inalámbrico: el número de la comanda + Enter la marca como lista.
 * Las bebidas (destino CAJA) no aparecen aquí.
 */
export default function PaginaCocina() {
  const [comandas, setComandas] = useState<Comanda[]>([]);
  const [especiales, setEspeciales] = useState<Especial[]>([]);
  const [sonido, setSonido] = useState(false);
  const [nuevas, setNuevas] = useState<Set<string>>(new Set());
  const [carga, setCarga] = useState({
    pendientes: 0,
    umbral: 12,
    demora: false,
  });
  const [elegida, setElegida] = useState<string | null>(null);
  const [ocultas, setOcultas] = useState(0);
  const [cursor, setCursor] = useState(true);
  const [pantallaCompleta, setPantallaCompleta] = useState(false);
  const [ahora, setAhora] = useState(() => new Date());
  const conectado = useConexion();
  const [noVinculado, setNoVinculado] = useState(false);
  const tablero = useRef<HTMLDivElement>(null);

  const cargar = useCallback(() => {
    api<Comanda[]>("GET", "/cocina")
      .then(setComandas)
      .catch((e) => e.codigo === "EQUIPO_NO_VINCULADO" && setNoVinculado(true));
    api("GET", "/cocina/carga")
      .then(setCarga)
      .catch(() => {});
  }, []);

  // Letra proporcional al ancho: en un televisor 4K todo crece sin romper la distribución
  useEffect(() => {
    const raiz = document.documentElement;
    const antes = raiz.style.fontSize;
    raiz.style.fontSize = "clamp(15px, 0.95vw, 30px)";
    return () => {
      raiz.style.fontSize = antes;
    };
  }, []);

  // Reloj, refresco de tiempos y retiro automático de tickets especiales a los 3 minutos
  useEffect(() => {
    cargar();
    const t = setInterval(() => {
      setAhora(new Date());
      setEspeciales((l) => l.filter((e) => Date.now() - e.llegada < 180_000));
    }, 15_000);
    return () => clearInterval(t);
  }, [cargar]);

  // El televisor no se apaga ni entra en reposo mientras la pantalla está abierta
  useEffect(() => {
    let bloqueo: { release: () => Promise<void> } | null = null;
    const pedir = () => {
      if (document.visibilityState === "visible")
        (navigator as any).wakeLock
          ?.request("screen")
          .then((b: any) => (bloqueo = b))
          .catch(() => {});
    };
    pedir();
    document.addEventListener("visibilitychange", pedir);
    return () => {
      document.removeEventListener("visibilitychange", pedir);
      bloqueo?.release().catch(() => {});
    };
  }, []);

  // El puntero del mouse se esconde si nadie lo mueve
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const mover = () => {
      setCursor(true);
      clearTimeout(t);
      t = setTimeout(() => setCursor(false), 3000);
    };
    mover();
    window.addEventListener("mousemove", mover);
    const pc = () => setPantallaCompleta(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", pc);
    return () => {
      clearTimeout(t);
      window.removeEventListener("mousemove", mover);
      document.removeEventListener("fullscreenchange", pc);
    };
  }, []);

  useEventos(
    {
      "cocina:comanda": (c: Comanda) => {
        if (sonido) c.reposicion ? pitido(2, 660) : pitido(3);
        setNuevas((n) => new Set(n).add(c.id));
        setTimeout(
          () =>
            setNuevas((n) => {
              const x = new Set(n);
              x.delete(c.id);
              return x;
            }),
          8000,
        );
        cargar();
      },
      "cocina:especial": (e: Omit<Especial, "id" | "llegada">) => {
        if (sonido) pitido(2, 660); // patrón distinto para tickets especiales (REQ-COC-03)
        setEspeciales((l) =>
          [
            { ...e, id: `${Date.now()}-${Math.random()}`, llegada: Date.now() },
            ...l,
          ].slice(0, 6),
        );
      },
      "cocina:actualizar": cargar,
    },
    [sonido],
  );

  const visibles = comandas.filter((c) => c.items.some(deCocina));
  const listo = useCallback(
    (id: string) => {
      setElegida(null);
      setComandas((l) => l.filter((c) => c.id !== id));
      api("POST", `/cocina/${id}/listo`).then(cargar).catch(cargar);
    },
    [cargar],
  );

  // Teclado numérico: 1‑9 elige la comanda, Enter la marca lista, Esc cancela, 0 retira un aviso, F pantalla completa
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (!sonido) {
        setSonido(true);
        pitido(1);
      }
      if (/^[1-9]$/.test(e.key)) {
        const c = visibles[Number(e.key) - 1];
        if (c) setElegida((x) => (x === c.id ? null : c.id));
      } else if ((e.key === "Enter" || e.key === "+") && elegida) {
        e.preventDefault();
        listo(elegida);
      } else if (e.key === "Escape" || e.key === "Backspace" || e.key === "-") {
        setElegida(null);
      } else if (e.key === "0" || e.key === "Delete") {
        setEspeciales((l) => l.slice(0, -1));
      } else if (e.key.toLowerCase() === "f") {
        document.fullscreenElement
          ? document.exitFullscreen()
          : document.documentElement.requestFullscreen().catch(() => {});
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [visibles, elegida, sonido, listo]);

  // Una comanda elegida y olvidada se suelta sola
  useEffect(() => {
    if (!elegida) return;
    const t = setTimeout(() => setElegida(null), 8000);
    return () => clearTimeout(t);
  }, [elegida]);

  // El televisor no tiene barra de desplazamiento: se cuentan las comandas que no caben
  useLayoutEffect(() => {
    const medir = () => {
      const t = tablero.current;
      if (!t) return;
      const ancho = t.clientWidth;
      setOcultas(
        [...t.querySelectorAll<HTMLElement>("[data-comanda]")].filter(
          (el) => el.offsetLeft >= ancho - 4,
        ).length,
      );
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  });

  if (noVinculado) return <EquipoNoVinculado />;
  const resumen = porPreparar(visibles);
  const atrasadas = visibles.filter((c) => minutos(c) >= 15).length;

  return (
    <div
      className={`flex h-dvh flex-col overflow-hidden bg-slate-950 text-white ${cursor ? "" : "cursor-none"}`}
    >
      {/* Barra superior */}
      <header className="flex shrink-0 items-center gap-4 border-b border-white/10 bg-black/40 px-5 py-2.5">
        <Link href="/" className="inline-flex items-center gap-3">
          <Emblema className="h-11 w-11" />
          <span className="font-titulo text-3xl uppercase tracking-wide">
            Cocina
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="etiqueta bg-white/10 text-base text-white">
            <Ico n="llama" className="text-brasa-400" />{" "}
            <b className="text-xl">{visibles.length}</b> en preparación
          </span>
          {atrasadas > 0 && (
            <span className="etiqueta parpadeo bg-red-600 text-base text-white">
              <Ico n="reloj" /> <b className="text-xl">{atrasadas}</b> con más
              de 15 min
            </span>
          )}
          {carga.demora && (
            <span className="etiqueta bg-amber-500 text-base text-slate-950">
              La carta avisa demora
            </span>
          )}
        </div>
        <div className="flex-1" />
        <span
          role="status"
          className={`etiqueta text-base ${conectado ? "bg-green-900/60 text-green-200" : "parpadeo bg-red-600 text-white"}`}
        >
          <span
            className={`h-2.5 w-2.5 rounded-full ${conectado ? "bg-green-400" : "bg-white"}`}
          />{" "}
          {conectado ? "En línea" : "Sin conexión"}
        </span>
        <button
          className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-base font-bold ${sonido ? "bg-white/10 text-white" : "parpadeo bg-amber-400 text-slate-950"}`}
          onClick={() => {
            setSonido((s) => !s);
            if (!sonido) pitido(1);
          }}
        >
          <Ico n={sonido ? "sonido" : "silencio"} />{" "}
          {sonido ? "Alarma" : "Activar alarma"}
        </button>
        {!pantallaCompleta && (
          <button
            className="inline-flex min-h-11 items-center rounded-xl bg-white/10 px-4 text-base font-bold"
            title="Tecla F"
            onClick={() =>
              document.documentElement.requestFullscreen().catch(() => {})
            }
          >
            Pantalla completa
          </button>
        )}
        <time className="min-w-[6ch] text-right font-titulo text-4xl tabular-nums tracking-wide">
          {ahora.toLocaleTimeString("es-PE", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })}
        </time>
      </header>

      {/* Avisos de anulación o reimpresión: arriba y en rojo para que nadie los pase por alto */}
      {especiales.length > 0 && (
        <div className="flex shrink-0 gap-3 overflow-hidden bg-red-700 px-5 py-2.5">
          {especiales.map((e) => (
            <div
              key={e.id}
              className="flex min-w-0 items-center gap-3 rounded-xl bg-black/30 px-4 py-2 animar-entrada"
            >
              <Ico n="alerta" className="shrink-0 text-2xl text-yellow-300" />
              <div className="min-w-0">
                <div className="text-lg font-black uppercase">
                  {e.tipo} · {e.comanda.origen}
                </div>
                <div className="truncate text-base text-white/85">
                  {e.tipo === "ANULACIÓN"
                    ? `Anular: ${e.detalle}`
                    : `Orden #${e.comanda.numero} reimpresa`}
                </div>
              </div>
              <button
                className="shrink-0 rounded-lg bg-white/15 px-3 py-1.5 text-sm font-bold"
                onClick={() =>
                  setEspeciales((l) => l.filter((x) => x.id !== e.id))
                }
              >
                Visto <kbd className="ml-1 opacity-70">0</kbd>
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* Comandas: de la más antigua (izquierda) a la más nueva, en columnas que se llenan hacia abajo */}
        <main className="relative min-h-0 flex-1 overflow-hidden">
          {visibles.length === 0 && (
            <div className="grid h-full place-items-center text-center text-slate-400">
              <div>
                <Ico n="checkCirculo" className="text-8xl text-emerald-500" />
                <p className="mt-4 text-4xl font-bold text-white">
                  Todo despachado
                </p>
                <p className="mt-2 text-xl">
                  Las comandas nuevas aparecerán aquí con la alarma.
                </p>
              </div>
            </div>
          )}
          <div
            ref={tablero}
            className="relative h-full overflow-hidden p-4"
            style={{
              columnWidth: "21rem",
              columnGap: "1rem",
              columnFill: "auto",
            }}
          >
            {visibles.map((c, i) => {
              const min = minutos(c);
              const s = semaforo(min);
              const tecla = i < 9 ? i + 1 : null;
              const sel = elegida === c.id;
              const canal = CANAL[c.canal];
              return (
                <article
                  key={c.id}
                  data-comanda
                  className={`mb-4 overflow-hidden rounded-2xl border-2 bg-slate-900 shadow-xl transition ${sel ? "border-white ring-4 ring-white/60" : s.borde} ${nuevas.has(c.id) ? "animar-entrada ring-4 ring-brasa-400" : ""}`}
                  style={{ breakInside: "avoid" }}
                >
                  <header
                    className={`flex items-center gap-3 px-3 py-2 ${s.barra} ${min >= 15 ? "parpadeo" : ""}`}
                  >
                    {tecla && (
                      <kbd className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-black/35 font-titulo text-3xl">
                        {tecla}
                      </kbd>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-titulo text-3xl uppercase leading-none tracking-wide">
                        {c.origen}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-white/85">
                        <Ico n={canal.icono} /> {canal.texto} · #{c.numero}
                      </div>
                    </div>
                    <div className="text-right leading-none">
                      <div className="font-titulo text-4xl tabular-nums">
                        {espera(min)}
                      </div>
                      <div className="text-xs font-semibold text-white/80">
                        {hora(c.impresoEn ?? c.creadoEn)}
                      </div>
                    </div>
                  </header>
                  {(c.reposicion || c.horaProgramada || nuevas.has(c.id)) && (
                    <div className="flex flex-wrap gap-1.5 px-3 pt-2">
                      {nuevas.has(c.id) && (
                        <span className="rounded bg-brasa-500 px-2 py-0.5 text-sm font-black uppercase">
                          Nueva
                        </span>
                      )}
                      {c.reposicion && (
                        <span className="rounded bg-sky-500 px-2 py-0.5 text-sm font-black uppercase text-slate-950">
                          Reposición · sin costo
                        </span>
                      )}
                      {c.horaProgramada && (
                        <span className="rounded bg-violet-500 px-2 py-0.5 text-sm font-black uppercase">
                          Recojo {hora(c.horaProgramada)}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="px-3 py-3">
                    <Items c={c} />
                  </div>
                  <footer className="flex items-center gap-2 border-t border-white/10 px-3 py-2">
                    <span className={`flex-1 truncate text-sm ${s.texto}`}>
                      {c.canal === "SALON" ? "Mozo" : "Caja"}: {c.mozo}
                    </span>
                    <button
                      className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-lg font-bold ${sel ? "bg-white text-slate-950" : "bg-emerald-600 text-white hover:bg-emerald-500"}`}
                      onClick={() => listo(c.id)}
                    >
                      <Ico n="check" /> {sel ? "Enter = Listo" : "Listo"}
                    </button>
                  </footer>
                </article>
              );
            })}
          </div>
          {ocultas > 0 && (
            <div className="absolute right-4 bottom-4 rounded-2xl bg-brasa-600 px-5 py-3 text-2xl font-black shadow-2xl parpadeo">
              +{ocultas} en espera
            </div>
          )}
        </main>

        {/* Resumen de producción: cuánto sacar de cada cosa */}
        <aside className="flex w-[19rem] shrink-0 flex-col border-l border-white/10 bg-black/30">
          <h2 className="flex items-center gap-2 border-b border-white/10 px-4 py-3 text-xl font-extrabold uppercase tracking-wide text-brasa-300">
            <Ico n="llama" /> Por preparar
          </h2>
          <ul className="min-h-0 flex-1 divide-y divide-white/5 overflow-hidden">
            {resumen.length === 0 && (
              <li className="px-4 py-6 text-lg text-slate-500">
                Nada pendiente
              </li>
            )}
            {resumen.map(([nombre, n]) => (
              <li key={nombre} className="flex items-center gap-3 px-4 py-2.5">
                <span className="grid h-11 min-w-11 place-items-center rounded-lg bg-white/10 px-2 font-titulo text-3xl tabular-nums text-amber-300">
                  {n}
                </span>
                <span className="text-lg font-semibold leading-tight">
                  {nombre}
                </span>
              </li>
            ))}
          </ul>
          <div className="border-t border-white/10 px-4 py-3 text-sm leading-relaxed text-slate-400">
            <b className="text-slate-200">Teclado:</b> número de la comanda +{" "}
            <kbd className="rounded bg-white/10 px-1.5">Enter</kbd> = lista ·{" "}
            <kbd className="rounded bg-white/10 px-1.5">Esc</kbd> cancela ·{" "}
            <kbd className="rounded bg-white/10 px-1.5">0</kbd> quita un aviso ·{" "}
            <kbd className="rounded bg-white/10 px-1.5">F</kbd> pantalla
            completa
          </div>
        </aside>
      </div>
    </div>
  );
}
