// Prueba de carga: simula un viernes en la noche con muchos equipos a la vez.
// Cada «cliente» abre la carta, hace un pedido para llevar, la caja lo cobra con Yape
// y la cocina lo marca listo. Mide cuánto tarda cada operación y cuántas fallan.
//
// Uso (con la API encendida):   node pruebas/carga.mjs [clientes] [rondas]
//   node pruebas/carga.mjs            → 30 clientes × 5 rondas = 150 pedidos
//   node pruebas/carga.mjs 60 10      → 600 pedidos
// Deja pedidos y boletas de prueba en la base: úsala en desarrollo.
const API = process.env.API_URL ?? 'http://localhost:3001/api';
const CLIENTES = Number(process.argv[2] ?? 30);
const RONDAS = Number(process.argv[3] ?? 5);

const tiempos = {};
const errores = {};
async function medir(nombre, fn) {
  const t0 = performance.now();
  try {
    return await fn();
  } catch (e) {
    errores[nombre] = (errores[nombre] ?? 0) + 1;
    if ((errores[nombre] ?? 0) <= 3) console.error(`  ✗ ${nombre}: ${e.message}`);
    return null;
  } finally {
    (tiempos[nombre] ??= []).push(performance.now() - t0);
  }
}
async function req(m, ruta, cuerpo, token) {
  const r = await fetch(API + ruta, { method: m, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  const j = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`${r.status} ${j?.message ?? ''}`);
  return j;
}

const salud = await fetch(API + '/salud').catch(() => null);
if (!salud?.ok) {
  console.error(`La API no responde en ${API}.`);
  process.exit(2);
}
const usuarios = await req('GET', '/auth/usuarios');
const caja = (await req('POST', '/auth/login', { usuarioId: usuarios.find((u) => u.rol === 'CAJERO').id, pin: '2222' })).token;
if (!(await req('GET', '/turnos/actual', null, caja))) await req('POST', '/turnos/abrir', { fondoInicial: 100 }, caja);
await req('POST', '/inventario/ingreso', { pollos: Math.ceil((CLIENTES * RONDAS) / 4) + 5, motivo: 'Prueba de carga' }, caja);

const carta = (await req('GET', '/carta')).flatMap((c) => c.productos);
const cuarto = carta.find((p) => p.nombre === '1/4 Pollo a la brasa');
const gaseosa = carta.find((p) => p.nombre === 'Gaseosa personal 500 ml');
const presas = cuarto.grupos.find((g) => g.nombre === 'Presa').opciones;

console.log(`Simulando ${CLIENTES} clientes × ${RONDAS} rondas contra ${API}…`);
const inicio = performance.now();
let pedidos = 0;
await Promise.all(
  Array.from({ length: CLIENTES }, async (_, c) => {
    for (let r = 0; r < RONDAS; r++) {
      await medir('Abrir la carta', () => req('GET', '/carta'));
      const p = await medir('Registrar pedido', () =>
        req('POST', '/despacho/pedidos', { canal: 'LLEVAR', nombreCliente: `Carga ${c}-${r}`, items: [{ productoId: cuarto.id, cantidad: 1, opciones: [presas[(c + r) % 2].id] }, { productoId: gaseosa.id, cantidad: 1 }] }, caja),
      );
      if (!p) continue;
      pedidos++;
      const cuenta = await medir('Ver la cuenta', () => req('GET', `/cuentas/${p.cuentaId}`, null, caja));
      if (cuenta) {
        await medir('Cobrar y emitir boleta', () =>
          req('POST', `/cuentas/${p.cuentaId}/cobrar`, { pagos: [{ medio: 'YAPE', monto: cuenta.saldo, numeroOperacion: `CARGA-${Date.now()}-${c}-${r}-${Math.random().toString(36).slice(2, 7)}` }], comprobante: { tipo: 'BOLETA' } }, caja),
        );
      }
      await medir('Cocina marca listo', () => req('POST', `/cocina/${p.id}/listo`));
      await medir('Entregar bebidas', () => req('POST', `/bebidas/${p.id}/entregar`, null, caja));
    }
  }),
);
const segundos = (performance.now() - inicio) / 1000;

const pct = (lista, p) => {
  const o = [...lista].sort((a, b) => a - b);
  return o[Math.min(o.length - 1, Math.floor((p / 100) * o.length))];
};
console.log(`\n${pedidos} pedidos en ${segundos.toFixed(1)} s (${(pedidos / segundos).toFixed(1)} pedidos/s)\n`);
console.log('Operación                 Veces   p50 ms   p95 ms   máx ms   errores');
for (const [nombre, lista] of Object.entries(tiempos)) {
  console.log(
    `${nombre.padEnd(24)} ${String(lista.length).padStart(6)} ${pct(lista, 50).toFixed(0).padStart(8)} ${pct(lista, 95).toFixed(0).padStart(8)} ${Math.max(...lista).toFixed(0).padStart(8)} ${String(errores[nombre] ?? 0).padStart(9)}`,
  );
}
const totalErrores = Object.values(errores).reduce((s, n) => s + n, 0);
const p95Cobro = pct(tiempos['Cobrar y emitir boleta'] ?? [0], 95);
console.log(`\n${totalErrores === 0 ? '✓ Sin errores' : `✗ ${totalErrores} errores`} · cobro p95 ${p95Cobro.toFixed(0)} ms (meta: menos de 3000 ms con el OSE simulado)`);
process.exit(totalErrores ? 1 : 0);
