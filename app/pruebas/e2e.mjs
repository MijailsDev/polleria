// Prueba de punta a punta del Sistema para Pollerías.
// Requiere la API encendida (npm run dev en backend) y la base con los datos iniciales.
// Uso:  node pruebas/e2e.mjs            (desde la carpeta app)
//       API_URL=http://otra:3001/api node pruebas/e2e.mjs
// Deja pedidos y comprobantes de prueba en la base: úsala en desarrollo, no en el local.
const API = process.env.API_URL ?? 'http://localhost:3001/api';
let pasos = 0, fallos = 0;
async function req(m, path, body, token, headers = {}) {
  const r = await fetch(API + path, { method: m, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers }, body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined });
  const t = await r.text(); let j; try { j = JSON.parse(t) } catch { j = t }
  return { status: r.status, body: j, headers: r.headers };
}
function check(nombre, cond, extra = '') { pasos++; if (!cond) fallos++; console.log(`${cond ? 'OK ' : 'XX '} ${nombre} ${extra}`); }
const salud = await fetch(API + '/salud').catch(() => null);
if (!salud?.ok) {
  console.error(`La API no responde en ${API}. Enciéndela con «npm run dev» en la carpeta backend.`);
  process.exit(2);
}
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const PIN = '1234';

const usuarios = (await req('GET', '/auth/usuarios')).body;
const id = (rol) => usuarios.find((u) => u.rol === rol).id;
const mozo = (await req('POST', '/auth/login', { usuarioId: id('MOZO'), pin: '1111' })).body.token;
const caja = (await req('POST', '/auth/login', { usuarioId: id('CAJERO'), pin: '2222' })).body.token;
const repa = (await req('POST', '/auth/login', { usuarioId: id('REPARTIDOR'), pin: '3333' })).body.token;
const sinPass = await req('POST', '/auth/login', { usuarioId: id('ADMINISTRADOR'), pin: PIN });
check('Admin sin contraseña rechazado', sinPass.status === 401, sinPass.body.message);
const admin = (await req('POST', '/auth/login', { usuarioId: id('ADMINISTRADOR'), pin: PIN, password: 'Admin2026!' })).body.token;
check('Login de mozo, cajera, repartidor y admin', !!(mozo && caja && repa && admin));

// Asegurar sin internet = false y stock suficiente
await req('PATCH', '/admin/config/sin_internet', { valor: false }, admin);
await req('POST', '/inventario/ingreso', { pollos: 20 }, caja);
if (!(await req('GET', '/turnos/actual', null, caja)).body) await req('POST', '/turnos/abrir', { fondoInicial: 100 }, caja);

const carta = (await req('GET', '/carta')).body;
const prods = carta.flatMap((c) => c.productos);
const cuarto = prods.find((p) => p.nombre === '1/4 Pollo a la brasa');
const gaseosa = prods.find((p) => p.nombre === 'Gaseosa personal 500 ml');
const pecho = cuarto.grupos.find((g) => g.nombre === 'Presa').opciones.find((o) => o.nombre === 'Pecho con ala');
const pierna = cuarto.grupos.find((g) => g.nombre === 'Presa').opciones.find((o) => o.nombre === 'Pierna con encuentro');
const itemCuarto = (op = pecho) => ({ productoId: cuarto.id, cantidad: 1, opciones: [op.id] });

// ---------------------------------------------------------------- Unir y separar mesas
let mesas = (await req('GET', '/mesas', null, mozo)).body;
const libres = mesas.filter((m) => m.estado === 'LIBRE');
const A = libres[0], B = libres[1], C = libres[2];
await req('POST', '/pedidos', { mesaId: A.id, items: [itemCuarto(), itemCuarto(pierna)] }, mozo);
await req('POST', '/pedidos', { mesaId: B.id, items: [{ productoId: gaseosa.id, cantidad: 2 }] }, mozo);
const unir = await req('POST', `/mesas/${A.id}/unir`, { otraId: B.id }, mozo);
check('Unir mesas', unir.status === 201, JSON.stringify(unir.body));
mesas = (await req('GET', '/mesas', null, mozo)).body;
check(`${B.numero} unida a ${A.numero}`, mesas.find((m) => m.id === B.id).unidaA === A.numero);
let cuentaA = (await req('GET', `/cuentas/mesa/${A.id}`, null, caja)).body;
check('Cuenta maestra = 24+24+9 = 57', cuentaA.total === 57, cuentaA.total);
const qrB = (await req('GET', `/qr/${B.numero}`)).body;
const pqB = await req('POST', '/qr/pedidos', { token: qrB.token, items: [{ productoId: gaseosa.id, cantidad: 1 }] });
await req('POST', `/pedidos/${pqB.body.pedidoId}/confirmar`, null, mozo);
cuentaA = (await req('GET', `/cuentas/mesa/${A.id}`, null, caja)).body;
check('Pedido QR de la mesa unida va a la cuenta maestra', cuentaA.total === 61.5, cuentaA.total);
const sep = await req('POST', `/mesas/${B.id}/separar`, null, mozo);
check('Separar mesas', sep.status === 201, JSON.stringify(sep.body));
cuentaA = (await req('GET', `/cuentas/mesa/${A.id}`, null, caja)).body;
const cuentaB = (await req('GET', `/cuentas/mesa/${B.id}`, null, caja)).body;
check('Al separar cada mesa recupera lo suyo', cuentaA.total === 52.5 && cuentaB.total === 9, `${cuentaA.total} / ${cuentaB.total}`);

// ---------------------------------------------------------------- Anulación, reposición y descuento (PIN)
const itemId = cuentaA.pedidos[0].items[0].id;
check('Anular sin PIN rechazado', (await req('POST', `/items/${itemId}/anular`, { motivo: 'cliente cambió' }, mozo)).status === 403);
check('Anular con PIN incorrecto rechazado', (await req('POST', `/items/${itemId}/anular`, { motivo: 'cliente cambió', pinAdmin: '0000' }, mozo)).status === 403);
const an = await req('POST', `/items/${itemId}/anular`, { motivo: 'cliente cambió', pinAdmin: PIN }, mozo);
check('Anular ítem con PIN del administrador', an.status === 201, JSON.stringify(an.body));
cuentaA = (await req('GET', `/cuentas/mesa/${A.id}`, null, caja)).body;
check('Total baja a 28.50', cuentaA.total === 28.5, cuentaA.total);
const itemPierna = cuentaA.pedidos.flatMap((p) => p.items).find((i) => i.producto === cuarto.nombre);
const repo = await req('POST', `/items/${itemPierna.id}/reponer`, { motivo: 'pollo frío', pinAdmin: PIN }, mozo);
check('Reposición sin costo', repo.status === 201);
cuentaA = (await req('GET', `/cuentas/mesa/${A.id}`, null, caja)).body;
check('La reposición no cambia el total', cuentaA.total === 28.5, cuentaA.total);
const cocina = (await req('GET', '/cocina')).body;
check('Comanda de reposición en cocina', cocina.some((c) => c.id === repo.body.pedidoId && c.reposicion));
const desc = await req('POST', `/cuentas/${cuentaA.cuentaId}/descuento`, { porcentaje: 10, motivo: 'cliente frecuente', pinAdmin: PIN }, caja);
check('Descuento 10 % con PIN', desc.status === 201, JSON.stringify(desc.body));
cuentaA = (await req('GET', `/cuentas/mesa/${A.id}`, null, caja)).body;
check('Total con descuento = 25.65', cuentaA.total === 25.65, cuentaA.total);
check('Reimprimir comanda', (await req('POST', `/pedidos/${cuentaA.pedidos[0].id}/reimprimir`, null, mozo)).status === 201);

// ---------------------------------------------------------------- Pago en mesa desde el celular (F-09)
const qrA = (await req('GET', `/qr/${A.numero}`)).body;
const ini = await req('POST', '/qr/pago/iniciar', { token: qrA.token });
check('Iniciar pago en línea', ini.status === 201 && ini.body.monto === 25.65, JSON.stringify(ini.body));
const bloq = await req('POST', `/cuentas/${cuentaA.cuentaId}/cobrar`, { pagos: [{ medio: 'YAPE', monto: 25.65, numeroOperacion: 'X1' }], comprobante: { tipo: 'BOLETA' } }, caja);
check('Caja bloqueada mientras se paga en línea', bloq.status === 400, bloq.body.message);
const bloqQR = await req('POST', '/qr/pedidos', { token: qrA.token, items: [{ productoId: gaseosa.id, cantidad: 1 }] });
check('Carta bloqueada mientras se paga en línea', bloqQR.status === 400);
const rech = await req('POST', `/pasarela/${ini.body.intentoId}/pagar`, { medio: 'YAPE', celular: '987654321', aprobacion: '000000' });
check('Pasarela rechaza código vencido', rech.body.estado === 'RECHAZADO', JSON.stringify(rech.body));
const ini2 = await req('POST', '/qr/pago/iniciar', { token: qrA.token });
const okp = await req('POST', `/pasarela/${ini2.body.intentoId}/pagar`, { medio: 'TARJETA', tarjeta: '4111 1111 1111 1111', vence: '12/29', cvv: '123' });
check('Pasarela aprueba tarjeta de prueba', okp.body.estado === 'APROBADO', JSON.stringify(okp.body));
const cqA = (await req('GET', `/qr-cuenta?token=${qrA.token}`)).body;
check('Cuenta pagada y boleta disponible para el comensal', cqA.estadoCuenta === 'PAGADA' && cqA.comprobantes.length === 1, JSON.stringify({ e: cqA.estadoCuenta, c: cqA.comprobantes }));
mesas = (await req('GET', '/mesas', null, mozo)).body;
check('Mesa pasa a por limpiar', mesas.find((m) => m.id === A.id).estado === 'POR_LIMPIAR');
const pub = await req('GET', `/publico/comprobantes/${cqA.comprobantes[0].id}`);
check('Comprobante público para descargar', pub.status === 200 && pub.body.total === 25.65, pub.body.numero);
const cuerpo = JSON.stringify({ intentoId: ini2.body.intentoId, estado: 'APROBADO', idTransaccion: 'FALSO', medio: 'YAPE', monto: 1 });
check('Webhook con firma falsa rechazado', (await req('POST', '/webhooks/pasarela', cuerpo, null, { 'x-firma': 'ab'.repeat(32) })).status === 401);

// ---------------------------------------------------------------- Fuga de comensal
const fuga = await req('POST', `/cuentas/${cuentaB.cuentaId}/fuga`, { motivo: 'se retiraron sin pagar', pinAdmin: PIN }, mozo);
check('Fuga de comensal con PIN', fuga.status === 201, JSON.stringify(fuga.body));
mesas = (await req('GET', '/mesas', null, mozo)).body;
check('Mesa con fuga queda por limpiar', mesas.find((m) => m.id === B.id).estado === 'POR_LIMPIAR');
await req('POST', `/mesas/${A.id}/liberar`, null, mozo);
await req('POST', `/mesas/${B.id}/liberar`, null, mozo);

// ---------------------------------------------------------------- Para llevar, programado, delivery y apps (F-12)
const llevar = await req('POST', '/despacho/pedidos', { canal: 'LLEVAR', nombreCliente: 'Carlos', items: [itemCuarto()] }, caja);
check('Pedido para llevar', llevar.status === 201 && llevar.body.origen.startsWith('PARA LLEVAR #') && llevar.body.origen.endsWith('Carlos'), llevar.body.origen ?? JSON.stringify(llevar.body));
const sinMesa = (await req('GET', '/cuentas/sin-mesa', null, caja)).body;
check('La caja ve la cuenta para llevar', sinMesa.some((c) => c.cuentaId === llevar.body.cuentaId));
const cobLlevar = await req('POST', `/cuentas/${llevar.body.cuentaId}/cobrar`, { pagos: [{ medio: 'YAPE', monto: 24, numeroOperacion: 'YP-' + Date.now() }], comprobante: { tipo: 'BOLETA' } }, caja);
check('Cobro del pedido para llevar', cobLlevar.status === 201, JSON.stringify(cobLlevar.body));

const prog = await req('POST', '/despacho/pedidos', { canal: 'LLEVAR', nombreCliente: 'Rosa', horaProgramada: new Date(Date.now() + 6 * 60000).toISOString(), items: [itemCuarto(pierna)] }, caja);
check('Pedido programado queda retenido', prog.body.estado === 'PROGRAMADO', prog.body.estado);

const del = await req('POST', '/despacho/pedidos', { canal: 'DELIVERY', celular: '987654321', nombreCliente: 'Lucía Torres', direccion: 'Jr. Loreto 345', referencia: 'frente al parque', pagaCon: 50, items: [itemCuarto(), { productoId: gaseosa.id, cantidad: 1 }] }, caja);
check('Pedido delivery', del.status === 201 && del.body.delivery?.pagaCon === 50, del.body.origen ?? JSON.stringify(del.body));
const cli = (await req('GET', '/clientes/987654321', null, caja)).body;
check('Cliente de delivery se autocompleta', cli?.nombre === 'Lucía Torres' && cli.direcciones[0].direccion === 'Jr. Loreto 345');
const enRutaAntes = await req('POST', `/despacho/${del.body.id}/estado`, { estado: 'EN_RUTA', repartidorId: id('REPARTIDOR') }, caja);
check('No sale a ruta si cocina no termina', enRutaAntes.status === 400);
await req('POST', `/cocina/${del.body.id}/listo`);
check('Sale a ruta con repartidor', (await req('POST', `/despacho/${del.body.id}/estado`, { estado: 'EN_RUTA', repartidorId: id('REPARTIDOR') }, caja)).status === 201);
const mis = (await req('GET', '/reparto/mis-pedidos', null, repa)).body;
check('El repartidor ve su pedido', mis.some((p) => p.id === del.body.id));
check('El repartidor marca entregado', (await req('POST', `/despacho/${del.body.id}/estado`, { estado: 'ENTREGADO' }, repa)).status === 201);
const pl = (await req('GET', '/repartidores/por-liquidar', null, caja)).body;
const g = pl.find((x) => x.repartidorId === id('REPARTIDOR'));
// El 1/4 de pollo cuesta S/ 26.00 en delivery (precio por canal de 06_produccion.sql) + gaseosa 4.50
check('Liquidación: cobrar 30.50 y vuelto 19.50 (precio de delivery)', g?.cobrar === 30.5 && g.pedidos.some((p) => p.vuelto === 19.5), JSON.stringify(g));
const liq = await req('POST', `/repartidores/${id('REPARTIDOR')}/liquidar`, { rendido: 30.5 }, caja);
check('Liquidar repartidor', liq.status === 201 && liq.body.diferencia === 0, JSON.stringify(liq.body));

const del2 = await req('POST', '/despacho/pedidos', { canal: 'DELIVERY', celular: '912345678', nombreCliente: 'Pedro', direccion: 'Av. Fitzcarrald 120', items: [itemCuarto()] }, caja);
await req('POST', `/cocina/${del2.body.id}/listo`);
await req('POST', `/despacho/${del2.body.id}/estado`, { estado: 'EN_RUTA', repartidorId: id('REPARTIDOR') }, caja);
await req('POST', `/despacho/${del2.body.id}/estado`, { estado: 'FALLIDO' }, repa);
const resF = await req('POST', `/despacho/${del2.body.id}/fallido`, { destino: 'MERMA', pinAdmin: PIN }, caja);
check('Entrega fallida resuelta como merma', resF.status === 201, JSON.stringify(resF.body));

const app = await req('POST', '/despacho/pedidos', { canal: 'APP_EXTERNA', codigoPlataforma: 'PY-' + (Date.now() % 100000), items: [itemCuarto()] }, caja);
check('Pedido de app externa prepagado', app.body.origen?.startsWith('APP #PY-'));
const cApp = (await req('GET', `/cuentas/${app.body.cuentaId}`, null, caja)).body;
check('Cuenta de app pagada por la plataforma', cApp.estado === 'PAGADA' && cApp.pagos[0].medio === 'PLATAFORMA_EXTERNA', cApp.estado);

// ---------------------------------------------------------------- Inventario y agotado automático (F-13)
let inv = (await req('GET', '/inventario', null, caja)).body;
check('Inventario con stock y kardex', inv.stock && inv.kardex.length > 0, JSON.stringify(inv.stock));
const merma = await req('POST', '/inventario/merma', { pollos: 0.25, pecho: 1, motivo: 'CAIDA', detalle: 'se cayó al piso', pinAdmin: PIN }, caja);
check('Merma con PIN', merma.status === 201);
check('Merma sin PIN rechazada', (await req('POST', '/inventario/merma', { pollos: 1, motivo: 'CAIDA' }, caja)).status === 403);
const conteo = await req('POST', '/inventario/conteo', { pollos: inv.stock.pollos, pecho: 1, pierna: inv.stock.pierna, comentario: 'prueba agotado', pinAdmin: PIN }, caja);
check('Conteo físico con diferencia', conteo.status === 201 && conteo.body.diferencia.pecho !== 0, JSON.stringify(conteo.body.diferencia));
let carta2 = (await req('GET', '/carta')).body.flatMap((c) => c.productos);
let opPecho = carta2.find((p) => p.id === cuarto.id).grupos[0].opciones.find((o) => o.nombre === 'Pecho con ala');
check('Pecho se agota solo con stock bajo (REQ-AGO-03)', opPecho.agotado === true);
const pedAgotado = await req('POST', '/pedidos', { mesaId: C.id, items: [itemCuarto()] }, mozo);
check('Pedido con presa agotada rechazado y sugiere la otra', pedAgotado.status === 400 && /Pierna/.test(pedAgotado.body.message), pedAgotado.body.message);
await req('POST', '/inventario/ingreso', { pollos: 10 }, caja);
carta2 = (await req('GET', '/carta')).body.flatMap((c) => c.productos);
opPecho = carta2.find((p) => p.id === cuarto.id).grupos[0].opciones.find((o) => o.nombre === 'Pecho con ala');
check('Ingreso de pollos vuelve a habilitar la presa', opPecho.agotado === false);

// ---------------------------------------------------------------- Sin internet: cola de comprobantes (F-15)
await req('PATCH', '/admin/config/sin_internet', { valor: true }, admin);
check('Consulta DNI sin internet pide ingreso manual', (await req('GET', '/documentos/12345678', null, caja)).status === 503);
const l2 = await req('POST', '/despacho/pedidos', { canal: 'LLEVAR', nombreCliente: 'Ana', items: [{ productoId: gaseosa.id, cantidad: 1 }] }, caja);
const cob2 = await req('POST', `/cuentas/${l2.body.cuentaId}/cobrar`, { pagos: [{ medio: 'EFECTIVO', monto: 4.5, recibido: 10 }], comprobante: { tipo: 'BOLETA', documento: '45678912', nombre: 'Ana Ruiz' } }, caja);
let comp2 = (await req('GET', `/comprobantes/${cob2.body.comprobanteId}`, null, caja)).body;
check('Comprobante queda en cola sin internet', comp2.estadoSunat === 'PENDIENTE', comp2.estadoSunat);
check('Estado muestra pendientes', (await req('GET', '/estado')).body.pendientes >= 1);
check('Pago en línea no disponible sin internet', (await req('POST', '/qr/pago/iniciar', { token: 'x' })).status === 503);
await req('PATCH', '/admin/config/sin_internet', { valor: false }, admin);
comp2 = (await req('GET', `/comprobantes/${cob2.body.comprobanteId}`, null, caja)).body;
check('Al volver internet la cola se envía', comp2.estadoSunat === 'ACEPTADO', comp2.estadoSunat);

// ---------------------------------------------------------------- Nota de crédito
const nc = await req('POST', `/comprobantes/${cob2.body.comprobanteId}/nota-credito`, { motivo: 'Anulación de la operación', pinAdmin: PIN, devolverEfectivo: true }, caja);
check('Nota de crédito BC01 con devolución', nc.status === 201 && nc.body.numero.startsWith('BC01-'), JSON.stringify(nc.body));
check('Segunda nota de crédito rechazada', (await req('POST', `/comprobantes/${cob2.body.comprobanteId}/nota-credito`, { motivo: 'x', pinAdmin: PIN }, caja)).status === 400);

// ---------------------------------------------------------------- Administración (F-01, F-02)
const nu = await req('POST', '/admin/usuarios', { nombre: 'Mozo nuevo ' + Date.now() % 1000, rol: 'MOZO', pin: '5678' }, admin);
check('Crear usuario', nu.status === 201);
check('El nuevo mozo inicia sesión', (await req('POST', '/auth/login', { usuarioId: nu.body.id, pin: '5678' })).status === 201);
await req('PATCH', `/admin/usuarios/${nu.body.id}`, { activo: false }, admin);
check('Usuario desactivado no inicia sesión', (await req('POST', '/auth/login', { usuarioId: nu.body.id, pin: '5678' })).status === 401);
check('Mozo no entra al panel admin', (await req('GET', '/admin/usuarios', null, mozo)).status === 403);
const cat = (await req('GET', '/admin/carta', null, admin)).body;
const extras = cat.find((c) => c.nombre === 'Extras');
const np = await req('POST', '/admin/productos', { nombre: 'Arroz chaufa', precio: 10, categoriaId: extras.id, destino: 'COCINA_INTERNA' }, admin);
check('Crear producto', np.status === 201);
await req('PATCH', `/admin/productos/${np.body.id}`, { precio: 11.5 }, admin);
const bit = (await req('GET', '/admin/bitacora?accion=CAMBIO_PRECIO', null, admin)).body;
check('Cambio de precio queda en la bitácora con antes y después', bit[0]?.antes?.precio === 10 && bit[0]?.despues?.precio === 11.5);
await req('PATCH', `/admin/productos/${np.body.id}`, { activo: false }, admin);
const nm = await req('POST', '/admin/mesas', { capacidad: 6 }, admin);
check('Crear mesa nueva', nm.status === 201, nm.body.numero);
await req('PATCH', `/admin/mesas/${nm.body.id}`, { activa: false }, admin);

// ---------------------------------------------------------------- Reportes (F-14)
const rep = await req('GET', '/reportes', null, admin);
check('Reporte del día', rep.status === 200 && rep.body.resumen.ventas > 0, JSON.stringify(rep.body.resumen));
check('Ranking de productos y venta por presa', rep.body.productos.length > 0 && rep.body.presas.length > 0);
check('Eventos con quién autorizó', rep.body.eventos.some((e) => e.accion === 'ANULAR_ITEM' && e.autorizo));
const rx = await req('GET', '/turnos/reporte-x', null, admin);
check('Reporte X con ventas por canal', rx.status === 200 && Object.keys(rx.body.ventasPorCanal).length > 0, JSON.stringify(rx.body.ventasPorCanal));

// ================================================================ Preparación para producción

// ---------------------------------------------------------------- Bebidas: las despacha la caja, no el pollero
const pedC = await req('POST', '/pedidos', { mesaId: C.id, items: [itemCuarto(pierna), { productoId: gaseosa.id, cantidad: 2 }] }, mozo);
check('Pedido de mesa con pollo y gaseosas', pedC.status === 201, JSON.stringify(pedC.body));
let bebidas = (await req('GET', '/bebidas', null, caja)).body;
const bebC = bebidas.find((b) => b.id === pedC.body.pedidoId);
check('Las gaseosas aparecen en el panel de bebidas de caja', bebC?.items.length === 1 && bebC.items[0].producto === gaseosa.nombre, JSON.stringify(bebC?.items));
const comandaC = (await req('GET', '/cocina')).body.find((c) => c.id === pedC.body.pedidoId);
check('La comanda del pollero no trae las bebidas como propias', comandaC && comandaC.items.find((i) => i.producto === gaseosa.nombre)?.cocina === false);
check('Entregar bebidas', (await req('POST', `/bebidas/${pedC.body.pedidoId}/entregar`, null, caja)).status === 201);
bebidas = (await req('GET', '/bebidas', null, caja)).body;
check('Las bebidas entregadas salen del panel', !bebidas.some((b) => b.id === pedC.body.pedidoId));
check('No se entregan dos veces', (await req('POST', `/bebidas/${pedC.body.pedidoId}/entregar`, null, caja)).status === 400);
const soloChicha = await req('POST', '/pedidos', { mesaId: C.id, items: [{ productoId: prods.find((p) => p.nombre.startsWith('Jarra de chicha')).id, cantidad: 1 }] }, mozo);
check('Un pedido solo de bebidas no cuenta como carga de cocina', !(await req('GET', '/cocina')).body.some((c) => c.id === soloChicha.body.pedidoId));
await req('POST', `/bebidas/${soloChicha.body.pedidoId}/entregar`, null, caja);
const cuentaC = (await req('GET', `/cuentas/mesa/${C.id}`, null, caja)).body;
check('Pedido solo de bebidas queda servido al entregarlo', cuentaC.pedidos.find((p) => p.id === soloChicha.body.pedidoId)?.estado === 'SERVIDO');

// ---------------------------------------------------------------- Bloqueo de mesa mientras un mozo toma el pedido (REQ-SAL-05)
check('El mozo reserva la mesa', (await req('POST', `/mesas/${C.id}/bloqueo`, null, mozo)).status === 201);
mesas = (await req('GET', '/mesas', null, caja)).body;
check('El plano muestra quién la está editando', mesas.find((m) => m.id === C.id).editandoPor?.nombre === 'Mozo de prueba');
const choque = await req('POST', '/pedidos', { mesaId: C.id, items: [itemCuarto(pierna)] }, caja);
check('Otro usuario no puede enviar un pedido a la mesa reservada', choque.status === 409, choque.body.message);
check('Ni reservarla', (await req('POST', `/mesas/${C.id}/bloqueo`, null, caja)).status === 409);
await req('DELETE', `/mesas/${C.id}/bloqueo`, null, mozo);
check('Al soltarla, el otro usuario sí puede', (await req('POST', `/mesas/${C.id}/bloqueo`, null, caja)).status === 201);
await req('DELETE', `/mesas/${C.id}/bloqueo`, null, caja);

// ---------------------------------------------------------------- Combos con descuento de cada componente (REQ-CAT-03)
const combo = prods.find((p) => p.nombre.startsWith('Combo familiar'));
check('El combo está en la carta con sus componentes', combo?.componentes?.length === 3, JSON.stringify(combo?.componentes));
const opc = (g, n) => combo.grupos.find((x) => x.nombre === g).opciones.find((o) => o.nombre === n).id;
const stockAntes = (await req('GET', '/inventario', null, caja)).body.stock;
const pCombo = await req('POST', '/despacho/pedidos', { canal: 'LLEVAR', nombreCliente: 'Familia Rojas', items: [{ productoId: combo.id, cantidad: 1, opciones: [opc('Corte', 'Corte en 8 presas'), opc('Sabor de la gaseosa', 'Inca Kola')] }] }, caja);
check('Pedido de combo', pCombo.status === 201, JSON.stringify(pCombo.body.message ?? pCombo.body.origen));
const stockDespues = (await req('GET', '/inventario', null, caja)).body.stock;
check('El combo descuenta 1 pollo, 2 cuartos de pecho y 2 de pierna', Math.abs(stockAntes.pollos - stockDespues.pollos - 1) < 0.001 && stockAntes.pecho - stockDespues.pecho === 2 && stockAntes.pierna - stockDespues.pierna === 2, JSON.stringify({ stockAntes, stockDespues }));
check('La gaseosa del combo va al panel de bebidas', (await req('GET', '/bebidas', null, caja)).body.some((b) => b.id === pCombo.body.id));
const papas = prods.find((p) => p.nombre === 'Porción de papas fritas');
await req('PATCH', `/agotados/producto/${papas.id}`, { agotado: true }, caja);
const comboAgotado = (await req('GET', '/carta')).body.flatMap((c) => c.productos).find((p) => p.id === combo.id);
check('Si se agota un componente, el combo se muestra agotado', comboAgotado.agotado === true);
const pComboNo = await req('POST', '/despacho/pedidos', { canal: 'LLEVAR', nombreCliente: 'X', items: [{ productoId: combo.id, cantidad: 1, opciones: [opc('Corte', 'Corte en 4 presas'), opc('Sabor de la gaseosa', 'Coca-Cola')] }] }, caja);
check('Y no se puede pedir', pComboNo.status === 400, pComboNo.body.message);
await req('PATCH', `/agotados/producto/${papas.id}`, { agotado: false }, caja);

// ---------------------------------------------------------------- Precios por canal (REQ-CAT-06)
const cartaDelivery = (await req('GET', '/carta?canal=DELIVERY')).body.flatMap((c) => c.productos);
check('La carta de delivery muestra su precio (1/4 a S/ 26.00)', cartaDelivery.find((p) => p.id === cuarto.id).precio === 26);
await req('PATCH', `/admin/productos/${cuarto.id}/precios/LLEVAR`, { precio: 25 }, admin);
const llevar25 = await req('POST', '/despacho/pedidos', { canal: 'LLEVAR', nombreCliente: 'Mario', items: [itemCuarto(pierna)] }, caja);
check('Para llevar usa su propio precio (S/ 25.00)', llevar25.body.items?.[0]?.precio === 25, JSON.stringify(llevar25.body.items?.[0]));
await req('PATCH', `/admin/productos/${cuarto.id}/precios/LLEVAR`, { precio: null }, admin);
const cartaLlevar = (await req('GET', '/carta?canal=LLEVAR')).body.flatMap((c) => c.productos);
check('Sin precio de canal vuelve al del salón', cartaLlevar.find((p) => p.id === cuarto.id).precio === 24);

// ---------------------------------------------------------------- ICBPER y comprobante electrónico
check('Bolsas: 2 bolsas suman S/ 1.00', (await req('POST', `/cuentas/${llevar25.body.cuentaId}/bolsas`, { cantidad: 2 }, caja)).status === 201);
const cLlevar = (await req('GET', `/cuentas/${llevar25.body.cuentaId}`, null, caja)).body;
check('Total con ICBPER = 26.00', cLlevar.total === 26 && cLlevar.bolsas === 2, cLlevar.total);
const cobICB = await req('POST', `/cuentas/${llevar25.body.cuentaId}/cobrar`, { pagos: [{ medio: 'EFECTIVO', monto: 26, recibido: 30 }], comprobante: { tipo: 'BOLETA' } }, caja);
check('Cobro con bolsas y vuelto S/ 4.00', cobICB.status === 201 && cobICB.body.vuelto === 4, JSON.stringify(cobICB.body));
const bolICB = (await req('GET', `/publico/comprobantes/${cobICB.body.comprobanteId}`)).body;
check('La boleta separa el ICBPER y suma bien', bolICB.icbper === 1 && Math.abs(bolICB.base + bolICB.impuesto + bolICB.icbper - bolICB.total) < 0.001, JSON.stringify({ b: bolICB.base, i: bolICB.impuesto, icb: bolICB.icbper }));
check('SUNAT (OSE) aceptó la boleta con código 0 y resumen (hash)', bolICB.estadoSunat === 'ACEPTADO' && bolICB.codigoSunat === '0' && bolICB.hash?.length > 20, `${bolICB.estadoSunat} ${bolICB.mensajeSunat}`);
check('El QR sigue el formato de SUNAT (RUC|tipo|serie|...)', bolICB.qr.startsWith('20000000001|03|B001|') && bolICB.qr.includes(bolICB.hash));
const xml = await fetch(`${API}/publico/comprobantes/${cobICB.body.comprobanteId}/xml`);
const xmlTexto = await xml.text();
check('XML UBL 2.1 descargable', xml.ok && xmlTexto.includes('<cbc:UBLVersionID>2.1</cbc:UBLVersionID>') && xmlTexto.includes('<cbc:ID>7152</cbc:ID>'), xml.headers.get('content-disposition'));
const rucMalo = await req('POST', `/cuentas/${cApp.cuentaId}/cobrar`, { pagos: [{ medio: 'EFECTIVO', monto: 1 }], comprobante: { tipo: 'FACTURA', documento: '20123456788', nombre: 'X' } }, caja);
check('Factura con RUC de dígito verificador inválido rechazada', rucMalo.status === 400 && /RUC/.test(rucMalo.body.message), rucMalo.body.message);
const ruc = await req('GET', '/documentos/20100047218', null, caja);
check('Consulta de RUC devuelve razón social y dirección', ruc.status === 200 && !!ruc.body.nombre && !!ruc.body.direccion, ruc.body.nombre);
const dni = await req('GET', '/documentos/45678912', null, caja);
const dni2 = await req('GET', '/documentos/45678912', null, caja);
check('Consulta de DNI devuelve siempre el mismo nombre', dni.status === 200 && dni.body.nombre === dni2.body.nombre, dni.body.nombre);
check('DNI inexistente: 404', (await req('GET', '/documentos/00012345', null, caja)).status === 404);
const resumen = await req('POST', '/sunat/resumen-diario', null, admin);
check('Resumen diario de boletas aceptado', resumen.status === 201 && resumen.body.estado === 'ACEPTADO' && /^RC-\d{8}-\d+$/.test(resumen.body.identificador), JSON.stringify(resumen.body));
check('Lista de resúmenes', (await req('GET', '/sunat/resumenes', null, admin)).body.some((r) => r.identificador === resumen.body.identificador));

// ---------------------------------------------------------------- WhatsApp e impresoras
const wa = await req('POST', `/comprobantes/${cobICB.body.comprobanteId}/whatsapp`, { celular: '987111222', enlace: 'http://localhost:3000/c/' + cobICB.body.comprobanteId }, caja);
check('Enviar comprobante por WhatsApp', wa.status === 201, JSON.stringify(wa.body));
check('Celular inválido rechazado', (await req('POST', `/comprobantes/${cobICB.body.comprobanteId}/whatsapp`, { celular: '12345', enlace: 'http://x.pe' }, caja)).status === 400);
let chats, chat;
for (let i = 0; i < 8; i++) {
  await espera(2000);
  chats = (await req('GET', '/whatsapp/chats')).body;
  chat = chats.chats.find((c) => c.destino === '987111222');
  if (['ENTREGADO', 'LEIDO'].includes(chat?.mensajes.at(-1).estado)) break;
}
check('El mensaje llega al celular (entregado)', ['ENTREGADO', 'LEIDO'].includes(chat?.mensajes.at(-1).estado), chat?.mensajes.at(-1).estado);
check('Aviso de delivery en ruta al cliente', chats.chats.find((c) => c.destino === '987654321')?.mensajes.some((m) => m.plantilla === 'DELIVERY_EN_RUTA'));
const impCocina = (await req('GET', '/impresoras/cocina')).body;
check('Ticketera de cocina imprimió comandas, anulación y reimpresión', ['COMANDA', 'ANULACION', 'REIMPRESION'].every((t) => impCocina.tickets.some((x) => x.tipo === t)), impCocina.destino.tipo);
const impCaja = (await req('GET', '/impresoras/caja')).body;
check('Ticketera de caja imprimió bebidas, boleta y abrió la gaveta', ['BEBIDAS', 'BOLETA', 'GAVETA'].every((t) => impCaja.tickets.some((x) => x.tipo === t)));
check('La boleta impresa lleva el total y el ICBPER', impCaja.tickets.some((t) => t.tipo === 'BOLETA' && t.lineas.some((l) => l.t.startsWith('ICBPER'))));
check('IP de impresora inválida rechazada', (await req('PATCH', '/admin/config/impresora_cocina', { valor: 'impresora' }, admin)).status >= 400);

// ---------------------------------------------------------------- Libro de Reclamaciones
const hojaBase = { tipo: 'RECLAMO', nombre: 'Rosa Quispe', tipoDocumento: 'DNI', documento: '41234567', domicilio: 'Jr. Cusco 120', celular: '987333444', bien: 'PRODUCTO', monto: 24, descripcion: '1/4 de pollo para llevar', detalle: 'El pollo llegó frío y sin cremas.', pedido: 'Que me repongan el pedido.' };
check('Reclamo sin aceptar el uso de datos rechazado', (await req('POST', '/reclamos', hojaBase)).status === 400);
const rec = await req('POST', '/reclamos', { ...hojaBase, aceptaDatos: true });
check('Registrar reclamo con código LR-AAAA-NNNNNN', rec.status === 201 && /^LR-\d{4}-\d{6}$/.test(rec.body.codigo), rec.body.codigo);
check('Plazo de respuesta de 15 días hábiles', new Date(rec.body.plazo) - new Date(rec.body.fecha) >= 19 * 86400000);
check('El consumidor consulta su hoja', (await req('GET', `/reclamos/consulta?codigo=${rec.body.codigo}&documento=41234567`)).status === 200);
check('Con otro documento no la ve', (await req('GET', `/reclamos/consulta?codigo=${rec.body.codigo}&documento=40000000`)).status === 404);
const resp = await req('POST', `/reclamos/${rec.body.id}/responder`, { respuesta: 'Lamentamos lo ocurrido. Le reponemos el pedido sin costo.' }, admin);
check('El administrador responde', resp.status === 201 && resp.body.estado === 'RESPONDIDO');
check('La caja no ve los reclamos', (await req('GET', '/reclamos', null, caja)).status === 403);

// ---------------------------------------------------------------- Seguridad, monitoreo y nube
const s = await req('GET', '/salud');
check('Salud: API y base de datos responden', s.status === 200 && s.body.db === true, `${s.body.latenciaDbMs} ms`);
check('Cabeceras de seguridad (helmet)', s.headers.get('x-content-type-options') === 'nosniff');
const sis = await req('GET', '/admin/sistema', null, admin);
check('Panel de sistema con colas y errores', sis.status === 200 && sis.body.sunat && sis.body.nube && sis.body.impresoras && sis.body.whatsapp, JSON.stringify({ sunat: sis.body.sunat?.pendientes, nube: sis.body.nube?.pendientes }));
check('El mozo no ve el panel de sistema', (await req('GET', '/admin/sistema', null, mozo)).status === 403);
check('La nube rechaza lotes sin firma', (await req('POST', '/nube/eventos', JSON.stringify({ eventos: [] }), null, { 'x-firma': 'falsa' })).status === 401);
let nube;
for (let i = 0; i < 8; i++) {
  nube = (await req('GET', '/admin/sistema', null, admin)).body.nube;
  if (nube.pendientes === 0) break;
  await espera(3000);
}
check('Las ventas se sincronizan con la nube', nube.pendientes === 0 && !nube.ultimoError, JSON.stringify(nube));
const enNube = (await req('GET', '/nube/resumen', null, admin)).body;
check('La nube tiene las ventas del día', enNube.eventos > 0 && enNube.ventasPorDia.length > 0, JSON.stringify(enNube.ventasPorDia[0]));
const xlsx = await fetch(`${API}/reportes/excel`, { headers: { Authorization: 'Bearer ' + admin } });
const bytes = new Uint8Array(await xlsx.arrayBuffer());
check('Reporte en Excel (.xlsx real)', xlsx.ok && bytes[0] === 0x50 && bytes[1] === 0x4b && /spreadsheetml/.test(xlsx.headers.get('content-type')), `${bytes.length} bytes`);

// ================================================================ Experiencia del comensal (carta QR)
mesas = (await req('GET', '/mesas', null, mozo)).body;
const D = mesas.find((m) => m.estado === 'LIBRE' && m.id !== C.id);
const qrD = (await req('GET', `/qr/${D.numero}`)).body;
const tk = qrD.token;

// 3 y 9: fotos, descripción y lo más pedido
const JPEG_1PX = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
check('Subir foto del plato', (await req('PATCH', `/admin/productos/${cuarto.id}/foto`, { imagen: JPEG_1PX }, admin)).status === 200);
await req('PATCH', `/admin/productos/${cuarto.id}`, { descripcion: 'Con papas y ensalada' }, admin);
let pCarta = (await req('GET', '/carta')).body.flatMap((c) => c.productos).find((p) => p.id === cuarto.id);
check('La carta trae la foto y la descripción', !!pCarta.fotoUrl && pCarta.descripcion === 'Con papas y ensalada', pCarta.fotoUrl);
const fotoRes = await fetch(API.replace(/\/api$/, '') + pCarta.fotoUrl);
check('La foto se descarga como imagen', fotoRes.ok && fotoRes.headers.get('content-type') === 'image/jpeg');
check('Foto con formato inválido rechazada', (await req('PATCH', `/admin/productos/${cuarto.id}/foto`, { imagen: 'data:text/html;base64,PGI+' }, admin)).status === 400);
const dest = await req('GET', '/carta/destacados');
check('Lo más pedido: hasta 4 productos', dest.status === 200 && Array.isArray(dest.body) && dest.body.length > 0 && dest.body.length <= 4, JSON.stringify(dest.body.length));

// 4: cancelar o corregir antes de que el mozo confirme
const pq1 = await req('POST', '/qr/pedidos', { token: tk, items: [itemCuarto(pierna)] });
check('Otra mesa no puede cancelar mi pedido', (await req('POST', `/qr/pedidos/${pq1.body.pedidoId}/cancelar`, { token: qrB.token })).status >= 400);
check('El comensal cancela su pedido sin confirmar', (await req('POST', `/qr/pedidos/${pq1.body.pedidoId}/cancelar`, { token: tk })).status === 201);
mesas = (await req('GET', '/mesas', null, mozo)).body;
check('La mesa vuelve a libre', mesas.find((m) => m.id === D.id).estado === 'LIBRE');
const pq2 = await req('POST', '/qr/pedidos', { token: tk, items: [itemCuarto(pierna), itemCuarto(pierna)] });
await req('POST', `/pedidos/${pq2.body.pedidoId}/confirmar`, null, mozo);
check('Ya confirmado no se puede cancelar', (await req('POST', `/qr/pedidos/${pq2.body.pedidoId}/cancelar`, { token: tk })).status === 400);

// 7 y 9: tiempo estimado y datos para repetir la ronda
let cqD = (await req('GET', `/qr-cuenta?token=${tk}`)).body;
const rondaD = cqD.pedidos.find((p) => p.id === pq2.body.pedidoId);
check('Tiempo estimado de preparación en minutos', Number.isInteger(rondaD.listoEnMin) && rondaD.listoEnMin >= 1, `${rondaD.listoEnMin} min`);
check('La ronda trae producto y opciones para repetirla', rondaD.items[0].productoId === cuarto.id && rondaD.items[0].opcionIds.includes(pierna.id));
await req('POST', `/cocina/${pq2.body.pedidoId}/listo`);
cqD = (await req('GET', `/qr-cuenta?token=${tk}`)).body;
check('Al salir de cocina el comensal lo ve listo', cqD.pedidos.find((p) => p.id === pq2.body.pedidoId).estado === 'SERVIDO');

// 1, 2, 5 y 6: cuenta dividida, comprobante con DNI/RUC, propina y WhatsApp
check('Consulta de DNI desde el celular con el token de la mesa', (await req('GET', `/qr/documentos/45678912?token=${tk}`)).status === 200);
check('Sin token no se consulta', (await req('GET', '/qr/documentos/45678912?token=falso')).status >= 400);
check('Factura sin RUC rechazada', (await req('POST', '/qr/pago/iniciar', { token: tk, monto: 24, tipo: 'FACTURA' })).status === 400);
const parte1 = await req('POST', '/qr/pago/iniciar', { token: tk, monto: 24, tipo: 'BOLETA', documento: '45678912', nombre: 'Ana Ruiz', propina: 2.4, celular: '987555666', enlaceBase: 'http://localhost:3000' });
check('Pagar solo mi parte con boleta, DNI y propina', parte1.status === 201 && parte1.body.monto === 24 && parte1.body.total === 26.4, JSON.stringify(parte1.body));
cqD = (await req('GET', `/qr-cuenta?token=${tk}`)).body;
check('El resto de la mesa ve cuánto queda disponible', cqD.disponible === 24, cqD.disponible);
check('No se puede pagar más de lo disponible', (await req('POST', '/qr/pago/iniciar', { token: tk, monto: 30 })).status === 400);
const pas1 = await req('POST', `/pasarela/${parte1.body.intentoId}/pagar`, { medio: 'YAPE', celular: '987555666', aprobacion: '123456' });
check('Pasarela cobra consumo + propina', pas1.body.estado === 'APROBADO');
const parte2 = await req('POST', '/qr/pago/iniciar', { token: tk, tipo: 'FACTURA', documento: '20100047218', nombre: 'Inversiones Demo S.A.C.' });
check('El otro comensal paga lo que falta con factura', parte2.status === 201 && parte2.body.monto === 24, JSON.stringify(parte2.body));
await req('POST', `/pasarela/${parte2.body.intentoId}/pagar`, { medio: 'TARJETA', tarjeta: '4111 1111 1111 1111', vence: '12/29', cvv: '123' });
cqD = (await req('GET', `/qr-cuenta?token=${tk}`)).body;
check('Cuenta pagada con dos comprobantes', cqD.estadoCuenta === 'PAGADA' && cqD.comprobantes.length === 2, JSON.stringify(cqD.comprobantes));
const comps = await Promise.all(cqD.comprobantes.map((c) => req('GET', `/publico/comprobantes/${c.id}`).then((r) => r.body)));
check('Boleta con DNI y nombre del comensal', comps.some((c) => c.tipo === 'BOLETA' && c.documento === '45678912' && c.nombre === 'Ana Ruiz' && c.total === 24));
check('Factura con RUC', comps.some((c) => c.tipo === 'FACTURA' && c.documento === '20100047218' && c.numero.startsWith('F001-')));
let waD;
for (let i = 0; i < 6 && !waD; i++) {
  await espera(1500);
  waD = (await req('GET', '/whatsapp/chats')).body.chats.find((c) => c.destino === '987555666');
}
check('La boleta llegó al WhatsApp del comensal', waD?.mensajes.some((m) => m.plantilla === 'COMPROBANTE' && m.enlace?.includes('/c/')));

// 10: calificación
check('Calificación inválida rechazada', (await req('POST', '/qr/calificar', { token: tk, estrellas: 7 })).status === 400);
check('El comensal califica la atención', (await req('POST', '/qr/calificar', { token: tk, estrellas: 5, comentario: 'Muy rico el pollo' })).status === 201);
check('Solo una calificación por cuenta', (await req('POST', '/qr/calificar', { token: tk, estrellas: 4 })).status === 400);
const repD = (await req('GET', '/reportes', null, admin)).body;
check('Reportes con calificaciones y propinas', repD.calificaciones.cantidad >= 1 && repD.calificaciones.comentarios.some((c) => c.comentario === 'Muy rico el pollo') && repD.resumen.propinas >= 2.4, JSON.stringify({ c: repD.calificaciones.promedio, p: repD.resumen.propinas }));
await req('PATCH', `/admin/productos/${cuarto.id}/foto`, { imagen: null }, admin);
await req('POST', `/mesas/${D.id}/liberar`, null, mozo);

// ---------------------------------------------------------------- Equipos vinculados, alertas y verificación en dos pasos
const { createHmac } = await import('crypto');
function totp(secreto, ahora = Date.now()) {
  const A32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, valor = 0; const bytes = [];
  for (const c of secreto) { valor = (valor << 5) | A32.indexOf(c); bits += 5; if (bits >= 8) { bytes.push((valor >>> (bits - 8)) & 255); bits -= 8; } }
  const cont = Buffer.alloc(8); cont.writeBigUInt64BE(BigInt(Math.floor(ahora / 30000)));
  const h = createHmac('sha1', Buffer.from(bytes)).update(cont).digest(); const o = h[19] & 15;
  return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, '0');
}
const nuevoEq = await req('POST', '/admin/equipos', { nombre: 'Tablet prueba e2e', tipo: 'SALON' }, admin);
check('Crear equipo con código de 8 caracteres', nuevoEq.status === 201 && /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(nuevoEq.body.codigo), nuevoEq.body.codigo);
check('El mozo no puede crear equipos', (await req('POST', '/admin/equipos', { nombre: 'Intruso', tipo: 'SALON' }, mozo)).status === 403);
check('Código de vinculación incorrecto rechazado', (await req('POST', '/equipos/vincular', { codigo: 'AAAA-BBBB' })).status === 400);
const vin = await req('POST', '/equipos/vincular', { codigo: nuevoEq.body.codigo.toLowerCase() });
check('Vincular la tablet con el código', vin.status === 201 && vin.body.llave?.length >= 40 && vin.body.equipo.tipo === 'SALON');
check('El código sirve una sola vez', (await req('POST', '/equipos/vincular', { codigo: nuevoEq.body.codigo })).status === 400);
const X = { 'X-Equipo': vin.body.llave };
await req('PATCH', '/admin/config/exigir_equipo_vinculado', { valor: true }, admin);
const sinEq = await req('GET', '/auth/usuarios');
check('Equipo no vinculado: no ve los nombres del personal', sinEq.status === 403 && sinEq.body.codigo === 'EQUIPO_NO_VINCULADO');
check('Equipo no vinculado: no puede intentar un PIN', (await req('POST', '/auth/login', { usuarioId: id('MOZO'), pin: '1111' })).status === 403);
const usTablet = (await req('GET', '/auth/usuarios', null, null, X)).body;
check('La tablet del salón solo lista mozos y administrador', Array.isArray(usTablet) && usTablet.some((u) => u.rol === 'MOZO') && usTablet.every((u) => ['MOZO', 'ADMINISTRADOR'].includes(u.rol)));
check('La cajera no ingresa en la tablet del salón', (await req('POST', '/auth/login', { usuarioId: id('CAJERO'), pin: '2222' }, null, X)).status === 403);
const mozoEq = (await req('POST', '/auth/login', { usuarioId: id('MOZO'), pin: '1111' }, null, X)).body.token;
check('El mozo ingresa desde la tablet vinculada', !!mozoEq && (await req('GET', '/mesas', null, mozoEq, X)).status === 200);
check('Su sesión copiada a otro equipo no sirve', (await req('GET', '/mesas', null, mozoEq)).status === 401);
check('Una sesión abierta sin equipo deja de servir', (await req('GET', '/mesas', null, mozo)).status === 401);
check('Cocina y simuladores piden equipo vinculado', (await req('GET', '/cocina')).status === 403 && (await req('GET', '/whatsapp/chats')).status === 403 && (await req('GET', '/cocina', null, null, X)).status === 200);
check('La carta QR del comensal sigue pública', (await req('GET', '/carta')).status === 200 && (await req('GET', `/qr/${A.numero}`)).status === 200);
const nombreAdmin = usuarios.find((u) => u.rol === 'ADMINISTRADOR').nombre;
check('Admin remoto con PIN incorrecto rechazado', (await req('POST', '/auth/login-admin', { nombre: nombreAdmin, password: 'Admin2026!', pin: '9999' })).status === 401);
check('Admin remoto con usuario inexistente rechazado', (await req('POST', '/auth/login-admin', { nombre: 'nadie', password: 'x', pin: '1234' })).status === 401);
const adm2 = (await req('POST', '/auth/login-admin', { nombre: nombreAdmin.toUpperCase(), password: 'Admin2026!', pin: PIN })).body.token;
check('El dueño entra desde un equipo no vinculado con usuario, contraseña y PIN', !!adm2 && (await req('GET', '/admin/equipos', null, adm2)).status === 200);
const ini2fa = (await req('POST', '/admin/2fa/iniciar', null, adm2)).body;
check('2FA: secreto Base32 y enlace otpauth para la app', ini2fa.secreto?.length === 32 && ini2fa.enlace?.startsWith('otpauth://totp/'));
check('2FA: un código incorrecto no la activa', (await req('POST', '/admin/2fa/activar', { codigo: '000000' }, adm2)).status === 400);
check('2FA: se activa con el código de la app', (await req('POST', '/admin/2fa/activar', { codigo: totp(ini2fa.secreto) }, adm2)).status === 201);
const pide = await req('POST', '/auth/login-admin', { nombre: nombreAdmin, password: 'Admin2026!', pin: PIN });
check('Con 2FA, el ingreso pide el código', pide.body.requiere2fa === true && !pide.body.token);
const cod = totp(ini2fa.secreto, Date.now() + 30000);
const con2fa = await req('POST', '/auth/login-admin', { nombre: nombreAdmin, password: 'Admin2026!', pin: PIN, codigo: cod });
check('Con el código correcto entra', !!con2fa.body.token);
check('El mismo código no sirve dos veces', (await req('POST', '/auth/login-admin', { nombre: nombreAdmin, password: 'Admin2026!', pin: PIN, codigo: cod })).status === 401);
check('2FA: desactivar pide el código actual', (await req('POST', '/admin/2fa/desactivar', { codigo: '000000' }, adm2)).status === 400 && (await req('POST', '/admin/2fa/desactivar', { codigo: totp(ini2fa.secreto) }, adm2)).status === 201);
const eqs = (await req('GET', '/admin/equipos', null, adm2)).body;
check('La tablet figura como vinculada', eqs.equipos.find((e) => e.id === vin.body.equipo.id)?.estado === 'VINCULADO' && eqs.exige === true);
await req('POST', `/admin/equipos/${vin.body.equipo.id}/desvincular`, null, adm2);
check('Al desvincular, la sesión de la tablet se cierra al instante', (await req('GET', '/mesas', null, mozoEq, X)).status === 401);
await req('PATCH', '/admin/config/exigir_equipo_vinculado', { valor: false }, adm2);
check('Modo abierto otra vez (desarrollo)', (await req('GET', '/auth/usuarios')).status === 200);
let aviso;
for (let i = 0; i < 6 && !aviso; i++) {
  await espera(1500);
  aviso = (await req('GET', '/whatsapp/chats')).body.chats.find((c) => c.destino === '999888777')?.mensajes.find((m) => m.texto.includes('Tablet prueba e2e'));
}
check('El dueño recibe por WhatsApp el aviso del equipo vinculado', !!aviso);
const bitEq = (await req('GET', '/admin/bitacora?accion=EQUIPO_VINCULADO', null, admin)).body;
check('La vinculación queda en la bitácora', Array.isArray(bitEq) && bitEq.length > 0);

// ---------------------------------------------------------------- Programado liberado por el reloj
let liberado = false;
for (let i = 0; i < 8 && !liberado; i++) {
  await espera(5000);
  liberado = (await req('GET', '/cocina')).body.some((c) => c.id === prog.body.id);
}
check('El pedido programado pasa solo a cocina 15 min antes', liberado);

console.log(`\n${pasos - fallos}/${pasos} pruebas correctas`);
