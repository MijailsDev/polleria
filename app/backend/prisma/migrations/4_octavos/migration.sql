-- Presas del octavo de pollo: 09_octavos.
-- Generado por prisma/generar-migraciones.mjs: no editar a mano.

-- =============================================================================
-- 09 · Presas del octavo de pollo
-- Un cuarto de pollo se parte en dos para formar los octavos:
--   cuarto de pecho  → Pecho (bloque central de la pechuga) y Ala (ala con un trozo de pechuga)
--   cuarto de pierna → Pierna (pierna baja con media entrepierna) y Encuentro (cadera)
-- El 1/8 y el Mostrito 1/8 ofrecen estas cuatro presas; el 1/4 sigue con
-- «Pecho con ala» o «Pierna con encuentro». Cada octavo descuenta medio cuarto
-- de su parte en el inventario.
-- Se puede ejecutar varias veces sin error.
-- =============================================================================


-- Productos de un octavo (1/8 Pollo a la brasa y Mostrito 1/8)
CREATE TEMP TABLE octavos ON COMMIT DROP AS
SELECT g.id AS grupo_id
FROM grupo_modificador g
JOIN producto p ON p.id = g.producto_id
WHERE g.nombre = 'Presa' AND p.fraccion_pollo = 0.125;

UPDATE opcion_modificador SET nombre = 'Pecho'
WHERE grupo_id IN (SELECT grupo_id FROM octavos) AND nombre = 'Pecho con ala';

UPDATE opcion_modificador SET nombre = 'Pierna'
WHERE grupo_id IN (SELECT grupo_id FROM octavos) AND nombre = 'Pierna con encuentro';

INSERT INTO opcion_modificador (grupo_id, nombre, recargo, efecto_inventario)
SELECT o.grupo_id, 'Ala', 0, '{"cuartos_pecho": 0.5}'::jsonb
FROM octavos o
WHERE NOT EXISTS (SELECT 1 FROM opcion_modificador x WHERE x.grupo_id = o.grupo_id AND x.nombre = 'Ala');

INSERT INTO opcion_modificador (grupo_id, nombre, recargo, efecto_inventario)
SELECT o.grupo_id, 'Encuentro', 0, '{"cuartos_pierna": 0.5}'::jsonb
FROM octavos o
WHERE NOT EXISTS (SELECT 1 FROM opcion_modificador x WHERE x.grupo_id = o.grupo_id AND x.nombre = 'Encuentro');

