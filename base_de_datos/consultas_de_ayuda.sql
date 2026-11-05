-- =============================================================================
-- CONSULTAS DE AYUDA · Sistema para Pollerías
-- =============================================================================
-- Recetario de consultas listas para copiar y ejecutar. Todas son de solo
-- lectura (SELECT): no cambian nada en la base de datos.
--
-- CÓMO USARLO EN pgADMIN
--   1. Abre pgAdmin → Servers → PostgreSQL 18 → Databases → polleria.
--   2. Clic derecho en "polleria" → Query Tool.
--   3. Abre este archivo (ícono de carpeta) o pega la consulta que quieras.
--   4. Selecciona SOLO la consulta que quieres (desde SELECT hasta el ;)
--      y presiona F5. Si no seleccionas nada, se ejecuta todo el archivo.
--
-- CÓMO USARLO EN LA CONSOLA (psql)
--   psql -h localhost -U polleria_app -d polleria -f consultas_de_ayuda.sql
--
-- LO QUE PUEDES CAMBIAR está marcado con  -- ← cambia aquí
--
-- ÍNDICE
--   0. Chuleta de SQL en 1 minuto
--   1. Explorar la base (qué tablas hay, cuántas filas, qué columnas)
--   2. Carta y productos
--   3. Salón y mesas
--   4. Pedidos y cocina
--   5. Caja, pagos y turnos
--   6. Comprobantes (boletas, facturas, notas de crédito)
--   7. Delivery y clientes
--   8. Inventario de pollos
--   9. Reportes del dueño
--  10. Usuarios, bitácora y configuración
--  11. Errores comunes y cómo leerlos
-- =============================================================================


-- =============================================================================
-- 0. CHULETA DE SQL EN 1 MINUTO
-- =============================================================================
--   SELECT columnas         qué quiero ver               SELECT nombre, precio
--   FROM tabla              de dónde                     FROM producto
--   JOIN otra ON ...        juntar con otra tabla        JOIN categoria c ON c.id = p.categoria_id
--   WHERE condición         filtrar filas                WHERE precio > 20
--   GROUP BY columna        agrupar para sumar/contar    GROUP BY categoria
--   HAVING condición        filtrar los grupos           HAVING count(*) > 3
--   ORDER BY columna DESC   ordenar (DESC = mayor→menor) ORDER BY precio DESC
--   LIMIT 10                solo las primeras 10 filas
--
--   Funciones útiles:
--     count(*)  sum(x)  avg(x)  min(x)  max(x)  round(x, 2)
--     current_date          la fecha de hoy (hora de Lima)
--     fecha::date           quita la hora y deja solo el día
--     extract(hour FROM f)  la hora (0-23)
--     coalesce(x, 0)        si x está vacío, usa 0
--     ilike '%pollo%'       contiene "pollo" sin importar mayúsculas
--
--   Valores fijos que aceptan las columnas de estado:
--     mesa.estado            LIBRE · POR_CONFIRMAR · OCUPADA · CUENTA_SOLICITADA · POR_LIMPIAR
--     pedido.estado          REGISTRADO · PROGRAMADO · POR_CONFIRMAR · CONFIRMADO · EN_PREPARACION · SERVIDO · ANULADO
--     pedido.canal           SALON · LLEVAR · DELIVERY · APP_EXTERNA
--     cuenta.estado          ABIERTA · PAGADA · ANULADA
--     item_pedido.estado     ACTIVO · CORREGIDO · ANULADO
--     pago.medio             EFECTIVO · YAPE · PLIN · TARJETA · PLATAFORMA_EXTERNA
--     comprobante.tipo       BOLETA · FACTURA · NOTA_CREDITO
--     comprobante.estado_sunat  PENDIENTE · ACEPTADO · OBSERVADO · RECHAZADO
--     pedido_delivery.estado_despacho  PENDIENTE · EN_RUTA · ENTREGADO · FALLIDO
--     movimiento_inventario.tipo  INGRESO · VENTA · MERMA · REPOSICION · AJUSTE
--     usuario.rol            MOZO · CAJERO · REPARTIDOR · ADMINISTRADOR
--
--   Los montos están en soles (numeric 10,2). Las fechas, en hora de Lima.


-- =============================================================================
-- 1. EXPLORAR LA BASE
-- =============================================================================

-- 1.1 Todas las tablas con su descripción y cuántas filas tienen (aproximado)
SELECT c.relname                       AS tabla,
       c.reltuples::bigint             AS filas_aprox,
       obj_description(c.oid)          AS descripcion
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;

-- 1.2 Las columnas de una tabla: tipo, si acepta vacío y para qué sirve
SELECT column_name                               AS columna,
       data_type                                 AS tipo,
       is_nullable                               AS acepta_vacio,
       column_default                            AS valor_por_defecto,
       col_description('pedido'::regclass, ordinal_position) AS descripcion
FROM information_schema.columns
WHERE table_name = 'pedido'                      -- ← cambia aquí (en las 2 líneas)
ORDER BY ordinal_position;

-- 1.3 Con qué tablas se relaciona cada tabla (claves foráneas)
SELECT tc.table_name   AS tabla,
       kcu.column_name AS columna,
       ccu.table_name  AS apunta_a
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
ORDER BY tabla, columna;

-- 1.4 Las reglas (CHECK) que la base hace cumplir en una tabla
SELECT conname AS regla, pg_get_constraintdef(oid) AS que_exige
FROM pg_constraint
WHERE conrelid = 'comprobante'::regclass AND contype = 'c'   -- ← cambia aquí
ORDER BY conname;


-- =============================================================================
-- 2. CARTA Y PRODUCTOS
-- =============================================================================

-- 2.1 La carta completa ordenada por categoría
SELECT c.nombre AS categoria, p.nombre AS producto, p.precio,
       p.fraccion_pollo, p.destino_impresion,
       CASE WHEN NOT p.activo THEN 'oculto'
            WHEN p.agotado     THEN 'AGOTADO'
            ELSE 'disponible' END AS disponibilidad
FROM producto p
JOIN categoria c ON c.id = p.categoria_id
ORDER BY c.orden, p.nombre;

-- 2.2 Productos agotados u ocultos ahora mismo
SELECT nombre, precio, agotado, activo
FROM producto
WHERE agotado OR NOT activo;

-- 2.3 Opciones (modificadores) de cada producto: presa, cremas, bebida…
SELECT p.nombre AS producto, g.nombre AS grupo,
       CASE WHEN g.obligatorio THEN 'obligatorio' ELSE 'opcional' END AS tipo,
       g.minimo, g.maximo,
       o.nombre AS opcion, o.recargo, o.agotado
FROM grupo_modificador g
JOIN producto p ON p.id = g.producto_id
JOIN opcion_modificador o ON o.grupo_id = g.id
ORDER BY p.nombre, g.nombre, o.nombre;

-- 2.4 Buscar un producto por parte del nombre
SELECT nombre, precio, agotado
FROM producto
WHERE nombre ILIKE '%cuarto%';                   -- ← cambia aquí


-- =============================================================================
-- 3. SALÓN Y MESAS
-- =============================================================================

-- 3.1 Plano de mesas: estado actual y desde qué hora están ocupadas
SELECT m.numero, m.capacidad, m.estado,
       to_char(s.apertura, 'HH24:MI') AS ocupada_desde,
       s.comensales,
       (SELECT mm.numero FROM sesion_mesa sm JOIN mesa mm ON mm.id = sm.mesa_id
         WHERE sm.id = s.unida_a)    AS unida_a_mesa
FROM mesa m
LEFT JOIN sesion_mesa s ON s.mesa_id = m.id AND s.cierre IS NULL
WHERE m.activa
ORDER BY m.numero;

-- 3.2 Mesas abiertas con cuánto llevan consumido y cuánto deben
SELECT m.numero, m.estado, cu.total, cu.descuento, cu.saldo,
       round(extract(epoch FROM now() - s.apertura) / 60) AS minutos_sentados
FROM sesion_mesa s
JOIN mesa m    ON m.id = s.mesa_id
JOIN cuenta cu ON cu.sesion_mesa_id = s.id AND cu.estado = 'ABIERTA'
WHERE s.cierre IS NULL
ORDER BY minutos_sentados DESC;

-- 3.3 Historial de una mesa: todas sus atenciones de hoy
SELECT to_char(s.apertura, 'HH24:MI') AS desde,
       to_char(s.cierre,   'HH24:MI') AS hasta,
       cu.total, cu.estado
FROM sesion_mesa s
JOIN mesa m ON m.id = s.mesa_id
LEFT JOIN cuenta cu ON cu.sesion_mesa_id = s.id
WHERE m.numero = 'M-04'                          -- ← cambia aquí
  AND s.apertura::date = current_date
ORDER BY s.apertura;


-- =============================================================================
-- 4. PEDIDOS Y COCINA
-- =============================================================================

-- 4.1 Pedidos de hoy con su origen (mesa, para llevar, delivery o app)
SELECT pe.numero, pe.canal, pe.estado,
       coalesce(m.numero, pe.nombre_cliente, pe.codigo_plataforma, '-') AS origen,
       u.nombre AS registrado_por,
       to_char(pe.creado_en, 'HH24:MI') AS hora,
       pe.es_reposicion
FROM pedido pe
JOIN cuenta cu           ON cu.id = pe.cuenta_id
LEFT JOIN sesion_mesa s  ON s.id = cu.sesion_mesa_id
LEFT JOIN mesa m         ON m.id = s.mesa_id
LEFT JOIN usuario u      ON u.id = pe.registrado_por
WHERE pe.creado_en::date = current_date
ORDER BY pe.creado_en DESC;

-- 4.2 Detalle de un pedido: platos, opciones elegidas, notas y subtotal
SELECT pr.nombre AS plato, i.cantidad, i.precio_unitario,
       string_agg(o.nombre, ', ') AS opciones,
       i.nota, i.estado,
       i.cantidad * (i.precio_unitario + coalesce(sum(io.recargo), 0)) AS subtotal
FROM item_pedido i
JOIN producto pr          ON pr.id = i.producto_id
LEFT JOIN item_opcion io  ON io.item_id = i.id
LEFT JOIN opcion_modificador o ON o.id = io.opcion_id
WHERE i.pedido_id = (SELECT id FROM pedido ORDER BY creado_en DESC LIMIT 1)  -- ← el último; o pon el id entre comillas
GROUP BY i.id, pr.nombre
ORDER BY pr.nombre;

-- 4.3 Cola de cocina: lo que falta preparar, del más antiguo al más nuevo
SELECT pe.numero, pe.canal,
       coalesce(m.numero, pe.nombre_cliente, pe.codigo_plataforma) AS origen,
       to_char(pe.impreso_en, 'HH24:MI') AS impreso,
       round(extract(epoch FROM now() - pe.impreso_en) / 60) AS minutos_esperando
FROM pedido pe
JOIN cuenta cu          ON cu.id = pe.cuenta_id
LEFT JOIN sesion_mesa s ON s.id = cu.sesion_mesa_id
LEFT JOIN mesa m        ON m.id = s.mesa_id
WHERE pe.estado IN ('CONFIRMADO', 'EN_PREPARACION')
ORDER BY pe.impreso_en;

-- 4.4 Pedidos programados pendientes y a qué hora salen
SELECT numero, canal, nombre_cliente,
       to_char(hora_programada, 'DD/MM HH24:MI') AS para_las
FROM pedido
WHERE estado = 'PROGRAMADO'
ORDER BY hora_programada;

-- 4.5 Pedidos por QR esperando que el mozo los confirme
SELECT m.numero AS mesa, pe.numero, to_char(pe.creado_en, 'HH24:MI') AS hora
FROM pedido pe
JOIN cuenta cu      ON cu.id = pe.cuenta_id
JOIN sesion_mesa s  ON s.id = cu.sesion_mesa_id
JOIN mesa m         ON m.id = s.mesa_id
WHERE pe.estado = 'POR_CONFIRMAR';

-- 4.6 Platos anulados hoy y cuánto dinero representan
SELECT pr.nombre, i.cantidad, i.precio_unitario * i.cantidad AS monto,
       to_char(pe.creado_en, 'HH24:MI') AS hora_pedido
FROM item_pedido i
JOIN pedido pe   ON pe.id = i.pedido_id
JOIN producto pr ON pr.id = i.producto_id
WHERE i.estado = 'ANULADO' AND pe.creado_en::date = current_date;


-- =============================================================================
-- 5. CAJA, PAGOS Y TURNOS
-- =============================================================================

-- 5.1 ¿Hay un turno abierto? ¿De quién y con cuánto fondo?
SELECT u.nombre AS cajero, to_char(t.apertura, 'DD/MM HH24:MI') AS abierto,
       t.fondo_inicial
FROM turno t
JOIN usuario u ON u.id = t.usuario_id
WHERE t.cierre IS NULL;

-- 5.2 Cobros de hoy por medio de pago
SELECT medio, count(*) AS pagos, sum(monto) AS total
FROM pago
WHERE fecha::date = current_date
GROUP BY medio
ORDER BY total DESC;

-- 5.3 Efectivo que debería haber en la gaveta del turno abierto
--     fondo + cobros en efectivo + ingresos − egresos
SELECT t.fondo_inicial,
       coalesce((SELECT sum(monto) FROM pago p WHERE p.turno_id = t.id AND p.medio = 'EFECTIVO'), 0) AS cobros_efectivo,
       coalesce((SELECT sum(monto) FROM movimiento_caja mc WHERE mc.turno_id = t.id AND mc.tipo = 'INGRESO'), 0) AS ingresos,
       coalesce((SELECT sum(monto) FROM movimiento_caja mc WHERE mc.turno_id = t.id AND mc.tipo = 'EGRESO'), 0)  AS egresos,
       t.fondo_inicial
         + coalesce((SELECT sum(monto) FROM pago p WHERE p.turno_id = t.id AND p.medio = 'EFECTIVO'), 0)
         + coalesce((SELECT sum(monto) FROM movimiento_caja mc WHERE mc.turno_id = t.id AND mc.tipo = 'INGRESO'), 0)
         - coalesce((SELECT sum(monto) FROM movimiento_caja mc WHERE mc.turno_id = t.id AND mc.tipo = 'EGRESO'), 0) AS esperado_en_gaveta
FROM turno t
WHERE t.cierre IS NULL;

-- 5.4 Cuentas que todavía deben dinero (de cualquier canal)
SELECT cu.id, coalesce(m.numero, 'sin mesa') AS mesa, cu.total, cu.saldo,
       to_char(cu.creada_en, 'DD/MM HH24:MI') AS creada
FROM cuenta cu
LEFT JOIN sesion_mesa s ON s.id = cu.sesion_mesa_id
LEFT JOIN mesa m        ON m.id = s.mesa_id
WHERE cu.estado = 'ABIERTA' AND cu.saldo > 0
ORDER BY cu.creada_en;

-- 5.5 Ingresos y egresos de caja (gastos, vueltos, gaveta) con quién autorizó
SELECT to_char(mc.fecha, 'DD/MM HH24:MI') AS fecha, mc.tipo, mc.monto, mc.motivo,
       a.nombre AS autorizado_por
FROM movimiento_caja mc
LEFT JOIN usuario a ON a.id = mc.autorizado_por
ORDER BY mc.fecha DESC
LIMIT 30;

-- 5.6 Turnos cerrados: cuánto declararon y cuánto faltó o sobró
SELECT u.nombre AS cajero,
       to_char(t.apertura, 'DD/MM HH24:MI') AS desde,
       to_char(t.cierre,   'DD/MM HH24:MI') AS hasta,
       t.fondo_inicial, t.efectivo_declarado, t.diferencia,
       CASE WHEN t.diferencia < 0 THEN 'FALTANTE'
            WHEN t.diferencia > 0 THEN 'SOBRANTE'
            ELSE 'cuadra' END AS resultado,
       t.comentario
FROM turno t
JOIN usuario u ON u.id = t.usuario_id
WHERE t.cierre IS NOT NULL
ORDER BY t.cierre DESC;

-- 5.7 Descuentos y cortesías con su motivo
SELECT to_char(creada_en, 'DD/MM HH24:MI') AS fecha, total, descuento, motivo_descuento
FROM cuenta
WHERE descuento > 0
ORDER BY creada_en DESC;

-- 5.8 Pagos en línea desde el QR (pasarela) y cómo terminaron
SELECT to_char(creado_en, 'DD/MM HH24:MI') AS fecha, medio, monto, estado, id_transaccion
FROM pago_en_linea
ORDER BY creado_en DESC
LIMIT 20;


-- =============================================================================
-- 6. COMPROBANTES
-- =============================================================================

-- 6.1 Comprobantes de hoy
SELECT tipo, serie || '-' || lpad(correlativo::text, 6, '0') AS numero,
       coalesce(nombre_cliente, 'CLIENTES VARIOS') AS cliente,
       documento_cliente, total, estado_sunat,
       to_char(emitido_en, 'HH24:MI') AS hora
FROM comprobante
WHERE emitido_en::date = current_date
ORDER BY emitido_en DESC;

-- 6.2 Buscar un comprobante por su número (ej. B001-000020)
SELECT tipo, serie, correlativo, nombre_cliente, documento_cliente,
       base_imponible, impuesto, total, estado_sunat, emitido_en
FROM comprobante
WHERE serie = 'B001' AND correlativo = 20;      -- ← cambia aquí

-- 6.3 Comprobantes que aún no llegan a SUNAT (modo sin internet)
SELECT tipo, serie || '-' || lpad(correlativo::text, 6, '0') AS numero, total,
       round(extract(epoch FROM now() - emitido_en) / 60) AS minutos_en_cola
FROM comprobante
WHERE estado_sunat = 'PENDIENTE'
ORDER BY emitido_en;

-- 6.4 Notas de crédito con el comprobante que anulan
SELECT nc.serie || '-' || lpad(nc.correlativo::text, 6, '0')  AS nota_credito,
       o.serie  || '-' || lpad(o.correlativo::text, 6, '0')   AS anula_a,
       nc.total, nc.motivo, to_char(nc.emitido_en, 'DD/MM HH24:MI') AS fecha
FROM comprobante nc
JOIN comprobante o ON o.id = nc.referencia_id
WHERE nc.tipo = 'NOTA_CREDITO'
ORDER BY nc.emitido_en DESC;

-- 6.5 Total facturado por tipo de comprobante (IGV + base)
SELECT tipo, count(*) AS cantidad,
       sum(base_imponible) AS base, sum(impuesto) AS impuesto, sum(total) AS total
FROM comprobante
GROUP BY tipo;

-- 6.6 ¿Hay saltos en la numeración? (SUNAT exige correlativos seguidos)
SELECT serie, correlativo + 1 AS falta_desde, siguiente - 1 AS falta_hasta
FROM (SELECT serie, correlativo,
             lead(correlativo) OVER (PARTITION BY serie ORDER BY correlativo) AS siguiente
      FROM comprobante) x
WHERE siguiente > correlativo + 1;


-- =============================================================================
-- 7. DELIVERY Y CLIENTES
-- =============================================================================

-- 7.1 Tablero de delivery: estado, repartidor y cuánto cobrar
SELECT pe.numero, d.estado_despacho, cl.nombre AS cliente, cl.celular,
       d.direccion, u.nombre AS repartidor, cu.saldo AS cobrar, d.paga_con,
       d.paga_con - cu.saldo AS vuelto
FROM pedido_delivery d
JOIN pedido pe    ON pe.id = d.pedido_id
JOIN cuenta cu    ON cu.id = pe.cuenta_id
JOIN cliente cl   ON cl.id = d.cliente_id
LEFT JOIN usuario u ON u.id = d.repartidor_id
ORDER BY pe.creado_en DESC;

-- 7.2 Efectivo que cada repartidor todavía debe rendir en caja
SELECT u.nombre AS repartidor, count(*) AS entregas, sum(cu.total) AS por_rendir
FROM pedido_delivery d
JOIN pedido pe ON pe.id = d.pedido_id
JOIN cuenta cu ON cu.id = pe.cuenta_id
JOIN usuario u ON u.id = d.repartidor_id
WHERE d.estado_despacho = 'ENTREGADO' AND NOT d.liquidado
GROUP BY u.nombre;

-- 7.3 Clientes frecuentes de delivery
SELECT cl.nombre, cl.celular, count(*) AS pedidos, sum(cu.total) AS gastado,
       max(pe.creado_en)::date AS ultimo_pedido
FROM pedido_delivery d
JOIN cliente cl ON cl.id = d.cliente_id
JOIN pedido pe  ON pe.id = d.pedido_id
JOIN cuenta cu  ON cu.id = pe.cuenta_id
GROUP BY cl.id
ORDER BY pedidos DESC
LIMIT 10;

-- 7.4 Buscar un cliente por celular y ver sus direcciones usadas
SELECT cl.nombre, cl.documento, d.direccion, d.referencia, pe.creado_en::date AS fecha
FROM cliente cl
LEFT JOIN pedido_delivery d ON d.cliente_id = cl.id
LEFT JOIN pedido pe         ON pe.id = d.pedido_id
WHERE cl.celular = '987654321'                   -- ← cambia aquí
ORDER BY fecha DESC;

-- 7.5 Entregas fallidas y qué se hizo con la comida
SELECT pe.numero, cl.nombre, d.direccion, d.destino_fallido
FROM pedido_delivery d
JOIN pedido pe  ON pe.id = d.pedido_id
JOIN cliente cl ON cl.id = d.cliente_id
WHERE d.estado_despacho = 'FALLIDO';


-- =============================================================================
-- 8. INVENTARIO DE POLLOS
-- =============================================================================
-- Cada movimiento suma (+) o resta (−). El stock es la suma de todos.
-- Un pollo = 4 cuartos: 2 de pecho y 2 de pierna.

-- 8.1 Stock actual (la vista ya hace la suma)
SELECT * FROM v_stock_pollos;

-- 8.2 Kardex de hoy: cada entrada y salida con el saldo acumulado
SELECT to_char(mi.fecha, 'HH24:MI') AS hora, mi.tipo, pr.nombre AS producto,
       mi.pollos, mi.cuartos_pecho, mi.cuartos_pierna,
       sum(mi.pollos) OVER (ORDER BY mi.fecha) AS saldo_pollos_del_dia,
       mi.motivo
FROM movimiento_inventario mi
LEFT JOIN producto pr ON pr.id = mi.producto_id
WHERE mi.fecha::date = current_date
ORDER BY mi.fecha;

-- 8.3 Resumen del día por tipo de movimiento
SELECT tipo, sum(pollos) AS pollos, sum(cuartos_pecho) AS pecho, sum(cuartos_pierna) AS pierna
FROM movimiento_inventario
WHERE fecha::date = current_date
GROUP BY tipo;

-- 8.4 Mermas y ajustes con su motivo y quién los autorizó
SELECT to_char(mi.fecha, 'DD/MM HH24:MI') AS fecha, mi.tipo, mi.pollos,
       mi.motivo, a.nombre AS autorizado_por
FROM movimiento_inventario mi
LEFT JOIN usuario a ON a.id = mi.autorizado_por
WHERE mi.tipo IN ('MERMA', 'AJUSTE', 'REPOSICION')
ORDER BY mi.fecha DESC;


-- =============================================================================
-- 9. REPORTES DEL DUEÑO
-- =============================================================================
-- Se cuentan como venta los pedidos que no fueron anulados ni son reposición.

-- 9.1 Ventas por día (últimos 30 días)
SELECT fecha::date AS dia, count(DISTINCT cuenta_id) AS cuentas, sum(monto) AS cobrado
FROM pago
WHERE fecha >= current_date - 30
GROUP BY dia
ORDER BY dia DESC;

-- 9.2 Ventas por canal
SELECT pe.canal, count(DISTINCT pe.id) AS pedidos,
       sum(i.cantidad * i.precio_unitario) AS vendido
FROM pedido pe
JOIN item_pedido i ON i.pedido_id = pe.id AND i.estado = 'ACTIVO'
WHERE pe.estado <> 'ANULADO' AND NOT pe.es_reposicion
GROUP BY pe.canal
ORDER BY vendido DESC;

-- 9.3 Top 10 productos más vendidos
SELECT pr.nombre, sum(i.cantidad) AS unidades,
       sum(i.cantidad * i.precio_unitario) AS vendido
FROM item_pedido i
JOIN pedido pe   ON pe.id = i.pedido_id
JOIN producto pr ON pr.id = i.producto_id
WHERE i.estado = 'ACTIVO' AND pe.estado <> 'ANULADO' AND NOT pe.es_reposicion
GROUP BY pr.nombre
ORDER BY unidades DESC
LIMIT 10;

-- 9.4 ¿Sale más pecho o pierna? (salidas por venta, en cuartos)
SELECT -sum(cuartos_pecho)  AS cuartos_pecho_vendidos,
       -sum(cuartos_pierna) AS cuartos_pierna_vendidos
FROM movimiento_inventario
WHERE tipo = 'VENTA';

-- 9.5 Horas punta: pedidos por hora del día
SELECT extract(hour FROM creado_en) AS hora, count(*) AS pedidos,
       repeat('█', count(*)::int) AS grafico
FROM pedido
WHERE estado <> 'ANULADO'
GROUP BY hora
ORDER BY hora;

-- 9.6 Ventas por mozo (quién registró los pedidos)
SELECT coalesce(u.nombre, 'QR del comensal') AS registrado_por,
       count(DISTINCT pe.id) AS pedidos,
       sum(i.cantidad * i.precio_unitario) AS vendido
FROM pedido pe
JOIN item_pedido i  ON i.pedido_id = pe.id AND i.estado = 'ACTIVO'
LEFT JOIN usuario u ON u.id = pe.registrado_por
WHERE pe.estado <> 'ANULADO'
GROUP BY 1
ORDER BY vendido DESC;

-- 9.7 Ventas por cajero (quién cobró)
SELECT u.nombre AS cajero, p.medio, count(*) AS cobros, sum(p.monto) AS total
FROM pago p
JOIN turno t   ON t.id = p.turno_id
JOIN usuario u ON u.id = t.usuario_id
GROUP BY u.nombre, p.medio
ORDER BY u.nombre, total DESC;

-- 9.8 Tiempo promedio de atención: desde que se pide hasta que se sirve
SELECT canal,
       round(avg(extract(epoch FROM servido_en - creado_en) / 60), 1) AS minutos_promedio,
       round(max(extract(epoch FROM servido_en - creado_en) / 60), 1) AS el_mas_lento
FROM pedido
WHERE servido_en IS NOT NULL
GROUP BY canal;

-- 9.9 Ticket promedio: cuánto gasta en promedio cada cuenta pagada
SELECT count(*) AS cuentas_pagadas, round(avg(total), 2) AS ticket_promedio
FROM cuenta
WHERE estado = 'PAGADA';

-- 9.10 Resumen de pérdidas: anulaciones, mermas, descuentos y fugas
SELECT 'Platos anulados' AS concepto, count(*) AS veces, sum(i.cantidad * i.precio_unitario) AS soles
FROM item_pedido i WHERE i.estado = 'ANULADO'
UNION ALL
SELECT 'Descuentos', count(*), sum(descuento) FROM cuenta WHERE descuento > 0
UNION ALL
SELECT 'Cuentas anuladas (fugas)', count(*), sum(total) FROM cuenta WHERE estado = 'ANULADA'
UNION ALL
SELECT 'Notas de crédito', count(*), sum(total) FROM comprobante WHERE tipo = 'NOTA_CREDITO'
UNION ALL
SELECT 'Mermas (en pollos)', count(*), -sum(pollos) FROM movimiento_inventario WHERE tipo = 'MERMA';


-- =============================================================================
-- 10. USUARIOS, BITÁCORA Y CONFIGURACIÓN
-- =============================================================================

-- 10.1 Usuarios (los PIN y contraseñas están cifrados; nunca se ven)
SELECT nombre, rol, activo, intentos_fallidos,
       to_char(creado_en, 'DD/MM/YYYY') AS creado
FROM usuario
ORDER BY rol, nombre;

-- 10.2 Últimas 30 acciones registradas en la bitácora
SELECT to_char(b.fecha, 'DD/MM HH24:MI') AS fecha,
       coalesce(u.nombre, 'sistema') AS usuario,
       b.accion, b.entidad
FROM bitacora b
LEFT JOIN usuario u ON u.id = b.usuario_id
ORDER BY b.fecha DESC
LIMIT 30;

-- 10.3 Cambios de precio: precio antes y después
SELECT to_char(b.fecha, 'DD/MM HH24:MI') AS fecha, u.nombre AS quien,
       b.valores_antes ->> 'nombre'   AS producto,
       b.valores_antes ->> 'precio'   AS antes,
       b.valores_despues ->> 'precio' AS despues
FROM bitacora b
LEFT JOIN usuario u ON u.id = b.usuario_id
WHERE b.accion = 'CAMBIO_PRECIO'
ORDER BY b.fecha DESC;

-- 10.4 Qué acciones protegidas hizo cada usuario (cuántas veces)
SELECT coalesce(u.nombre, 'sistema') AS usuario, b.accion, count(*) AS veces
FROM bitacora b
LEFT JOIN usuario u ON u.id = b.usuario_id
GROUP BY 1, 2          -- 1 y 2 = la primera y segunda columna del SELECT
ORDER BY usuario, veces DESC;

-- 10.5 Configuración del local
SELECT clave, valor, descripcion,
       to_char(actualizado_en, 'DD/MM HH24:MI') AS cambiado
FROM configuracion
ORDER BY clave;


-- =============================================================================
-- 11. ERRORES COMUNES Y CÓMO LEERLOS
-- =============================================================================
--   relation "pedidos" does not exist
--       La tabla se llama en singular: pedido, mesa, cuenta, pago…
--
--   column "precio" does not exist  (en una consulta con JOIN)
--       Hay varias tablas: escribe de cuál es, por ejemplo p.precio.
--
--   column reference "estado" is ambiguous
--       Dos tablas tienen esa columna: usa el alias (pe.estado, m.estado).
--
--   column "x" must appear in the GROUP BY clause
--       Si usas sum() o count(), toda columna sin función va en GROUP BY.
--
--   invalid input syntax for type uuid
--       Los id son uuid: van entre comillas simples y completos,
--       por ejemplo '3f1c…-…'. Cópialos desde otra consulta.
--
--   permission denied / la bitácora es de solo lectura
--       La bitácora no se puede modificar ni borrar, ni siquiera desde aquí.
--       Es a propósito (RNF-SEG-05).
--
--   La consulta no devuelve filas
--       Revisa mayúsculas en los estados ('SERVIDO', no 'servido') y si el
--       filtro de fecha es de hoy (current_date) cuando los datos son de otro día.
--
-- CONSEJO: para cambiar datos (precios, usuarios, mesas) usa la pantalla de
-- Administración del sistema, no UPDATE a mano: así queda en la bitácora y se
-- respetan las reglas del negocio.
-- =============================================================================
