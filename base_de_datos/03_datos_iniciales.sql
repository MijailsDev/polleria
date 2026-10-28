-- =============================================================================
-- 03 · Datos iniciales
-- Carta y precios de la entrevista (Puerto Maldonado, setiembre 2026),
-- las 10 mesas del salón, los modificadores de cada plato y usuarios de prueba.
--
-- USUARIOS DE PRUEBA (solo para desarrollo; cámbialos antes de usar el sistema
-- en el local):
--   Administrador (prueba)  PIN 1234   contraseña del panel: Admin2026!
--   Mozo de prueba          PIN 1111
--   Cajera de prueba        PIN 2222
--   Repartidor de prueba    PIN 3333
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Usuarios (PIN y contraseña cifrados con bcrypt)
-- -----------------------------------------------------------------------------
INSERT INTO usuario (nombre, rol, pin_hash, password_hash) VALUES
  ('Administrador (prueba)', 'ADMINISTRADOR', crypt('1234', gen_salt('bf')), crypt('Admin2026!', gen_salt('bf'))),
  ('Mozo de prueba',         'MOZO',          crypt('1111', gen_salt('bf')), NULL),
  ('Cajera de prueba',       'CAJERO',        crypt('2222', gen_salt('bf')), NULL),
  ('Repartidor de prueba',   'REPARTIDOR',    crypt('3333', gen_salt('bf')), NULL);

-- -----------------------------------------------------------------------------
-- Mesas M-01 a M-10 (dos filas de cinco en el plano)
-- -----------------------------------------------------------------------------
INSERT INTO mesa (numero, capacidad, pos_x, pos_y)
SELECT 'M-' || lpad(n::text, 2, '0'),
       CASE WHEN n IN (1, 9) THEN 2 ELSE 4 END,
       ((n - 1) % 5) * 150,
       ((n - 1) / 5) * 170
FROM generate_series(1, 10) AS n;

-- -----------------------------------------------------------------------------
-- Carta
-- -----------------------------------------------------------------------------
INSERT INTO categoria (nombre, orden) VALUES
  ('Pollos a la brasa', 1),
  ('Mostritos',         2),
  ('Extras',            3),
  ('Bebidas',           4);

INSERT INTO producto (categoria_id, nombre, precio, fraccion_pollo, destino_impresion)
SELECT c.id, p.nombre, p.precio, p.fraccion, p.destino
FROM (VALUES
  ('Pollos a la brasa', '1/8 Pollo a la brasa',          14.00, 0.125, 'POLLERO'),
  ('Pollos a la brasa', '1/4 Pollo a la brasa',          24.00, 0.250, 'POLLERO'),
  ('Pollos a la brasa', '1/2 Pollo a la brasa',          45.00, 0.500, 'POLLERO'),
  ('Pollos a la brasa', '1 Pollo entero a la brasa',     80.00, 1.000, 'POLLERO'),
  ('Mostritos',         'Mostrito 1/8',                  18.00, 0.125, 'POLLERO'),
  ('Mostritos',         'Mostrito 1/4',                  28.00, 0.250, 'POLLERO'),
  ('Extras',            'Porción de papas fritas',       12.00, 0,     'POLLERO'),
  ('Extras',            'Porción de ensalada',            8.00, 0,     'POLLERO'),
  ('Extras',            'Pote de ají extra',              1.50, 0,     'POLLERO'),
  ('Bebidas',           'Gaseosa personal 500 ml',        4.50, 0,     'CAJA'),
  ('Bebidas',           'Gaseosa 1.5 L',                 12.00, 0,     'CAJA'),
  ('Bebidas',           'Jarra de chicha morada 1 L',    12.00, 0,     'CAJA')
) AS p (categoria, nombre, precio, fraccion, destino)
JOIN categoria c ON c.nombre = p.categoria;

-- -----------------------------------------------------------------------------
-- Modificadores. Procedimiento temporal que crea un grupo con sus opciones:
--   opciones = [["nombre", recargo, {efecto en inventario}], ...]
-- El efecto se mide en cuartos de pollo (1 pollo = 2 de pecho + 2 de pierna).
-- -----------------------------------------------------------------------------
CREATE PROCEDURE pg_temp.agregar_grupo(p_productos text[], p_grupo text, p_obligatorio boolean,
                                      p_min int, p_max int, p_opciones jsonb)
LANGUAGE plpgsql AS $$
DECLARE
  v_producto uuid;
  v_grupo    uuid;
  v_op       jsonb;
BEGIN
  FOR v_producto IN SELECT id FROM producto WHERE nombre = ANY (p_productos) LOOP
    INSERT INTO grupo_modificador (producto_id, nombre, obligatorio, minimo, maximo)
    VALUES (v_producto, p_grupo, p_obligatorio, p_min, p_max)
    RETURNING id INTO v_grupo;
    FOR v_op IN SELECT * FROM jsonb_array_elements(p_opciones) LOOP
      INSERT INTO opcion_modificador (grupo_id, nombre, recargo, efecto_inventario)
      VALUES (v_grupo, v_op ->> 0, (v_op ->> 1)::numeric, nullif(v_op -> 2, 'null'::jsonb));
    END LOOP;
  END LOOP;
END;
$$;

-- RN-01: presa obligatoria en octavos y cuartos (un 1/8 consume medio cuarto)
CALL pg_temp.agregar_grupo(ARRAY['1/8 Pollo a la brasa', 'Mostrito 1/8'], 'Presa', true, 1, 1,
  '[["Pecho con ala", 0, {"cuartos_pecho": 0.5}],
    ["Pierna con encuentro", 0, {"cuartos_pierna": 0.5}]]');

CALL pg_temp.agregar_grupo(ARRAY['1/4 Pollo a la brasa', 'Mostrito 1/4'], 'Presa', true, 1, 1,
  '[["Pecho con ala", 0, {"cuartos_pecho": 1}],
    ["Pierna con encuentro", 0, {"cuartos_pierna": 1}]]');

-- RN-15: combinaciones del 1/2 pollo (2 pechos con recargo de S/ 2.00)
CALL pg_temp.agregar_grupo(ARRAY['1/2 Pollo a la brasa'], 'Presas', true, 1, 1,
  '[["1 pecho + 1 pierna", 0, {"cuartos_pecho": 1, "cuartos_pierna": 1}],
    ["2 pechos", 2.00, {"cuartos_pecho": 2}],
    ["2 piernas", 0, {"cuartos_pierna": 2}]]');

CALL pg_temp.agregar_grupo(ARRAY['1 Pollo entero a la brasa'], 'Corte', true, 1, 1,
  '[["Corte en 4 presas", 0, {"cuartos_pecho": 2, "cuartos_pierna": 2}],
    ["Corte en 8 presas", 0, {"cuartos_pecho": 2, "cuartos_pierna": 2}]]');

CALL pg_temp.agregar_grupo(
  ARRAY['1/8 Pollo a la brasa', '1/4 Pollo a la brasa', '1/2 Pollo a la brasa', '1 Pollo entero a la brasa', 'Mostrito 1/8', 'Mostrito 1/4'],
  'Papas', false, 0, 1,
  '[["Normales", 0, null], ["Bien doradas", 0, null], ["Sin sal", 0, null]]');

CALL pg_temp.agregar_grupo(
  ARRAY['1/8 Pollo a la brasa', '1/4 Pollo a la brasa', '1/2 Pollo a la brasa', '1 Pollo entero a la brasa'],
  'Ensalada', false, 0, 1,
  '[["Clásica", 0, null], ["Cocida", 0, null],
    ["Sin ensalada (más papas)", 0, null], ["Sin papas (más ensalada)", 0, null]]');

CALL pg_temp.agregar_grupo(
  ARRAY['1/8 Pollo a la brasa', '1/4 Pollo a la brasa', '1/2 Pollo a la brasa', '1 Pollo entero a la brasa', 'Mostrito 1/8', 'Mostrito 1/4'],
  'Cremas', false, 0, 5,
  '[["Ají", 0, null], ["Mayonesa", 0, null], ["Mostaza", 0, null], ["Kétchup", 0, null], ["Tártara", 0, null]]');

CALL pg_temp.agregar_grupo(ARRAY['Porción de ensalada'], 'Tipo', false, 0, 1,
  '[["Clásica", 0, null], ["Cocida", 0, null]]');

CALL pg_temp.agregar_grupo(ARRAY['Gaseosa personal 500 ml', 'Gaseosa 1.5 L'], 'Sabor', false, 0, 1,
  '[["Inca Kola", 0, null], ["Coca-Cola", 0, null]]');

-- -----------------------------------------------------------------------------
-- Stock inicial de prueba: 30 pollos = 60 cuartos de pecho + 60 de pierna
-- -----------------------------------------------------------------------------
INSERT INTO movimiento_inventario (tipo, pollos, cuartos_pecho, cuartos_pierna, motivo)
VALUES ('INGRESO', 30, 60, 60, 'Stock inicial de prueba');

COMMIT;

\echo 'Datos iniciales cargados: carta, 10 mesas, modificadores y usuarios de prueba.'
