-- =============================================================================
-- 04 · Verificación: muestra que todo quedó creado
-- =============================================================================

\echo ''
\echo '== Tablas y cantidad de filas =='
SELECT t.table_name AS tabla,
       (xpath('/row/n/text()', query_to_xml(format('SELECT count(*) AS n FROM %I', t.table_name), false, true, '')))[1]::text::int AS filas
FROM information_schema.tables t
WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
ORDER BY t.table_name;

\echo '== Carta =='
SELECT c.nombre AS categoria, p.nombre AS producto, 'S/ ' || to_char(p.precio, 'FM990.00') AS precio,
       (SELECT string_agg(g.nombre || CASE WHEN g.obligatorio THEN ' (obligatorio)' ELSE '' END, ', ' ORDER BY g.nombre)
        FROM grupo_modificador g WHERE g.producto_id = p.id) AS modificadores
FROM producto p JOIN categoria c ON c.id = p.categoria_id
ORDER BY c.orden, p.precio;

\echo '== Mesas =='
SELECT string_agg(numero || ' (' || capacidad || ')', '  ' ORDER BY numero) AS mesas FROM mesa;

\echo '== Stock de pollos =='
SELECT * FROM v_stock_pollos;

\echo '== Usuarios de prueba =='
SELECT nombre, rol, activo FROM usuario ORDER BY rol;
