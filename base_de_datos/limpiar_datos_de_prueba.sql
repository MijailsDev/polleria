-- =============================================================================
-- Limpiar los datos de prueba
--
-- Borra TODOS los pedidos, cuentas, pagos, comprobantes, turnos, clientes,
-- reclamos, mensajes, impresiones, kardex y bitácora; deja la carta, las mesas,
-- la configuración y los usuarios. Sirve para empezar de cero antes de una
-- demostración o antes de usar el sistema en el local.
--
--   psql -h localhost -U polleria_app -d polleria -f limpiar_datos_de_prueba.sql
--
-- NO SE PUEDE DESHACER. Haz antes un respaldo: .\respaldo.ps1
-- La bitácora es de solo lectura para el sistema; TRUNCATE (que solo puede ejecutar
-- el dueño de la tabla) la vacía sin pasar por esa regla.
-- =============================================================================

BEGIN;

TRUNCATE
  item_opcion, item_pedido, pedido_delivery, pedido, pago, pago_en_linea, comprobante,
  cuenta, sesion_mesa, movimiento_caja, turno, movimiento_inventario, cliente,
  reclamo, resumen_diario, mensaje_saliente, impresion, evento_sync, nube_evento,
  error_registro, calificacion, bitacora
RESTART IDENTITY;

-- Restos de las pruebas automáticas (productos, mesas y usuarios creados y desactivados)
DELETE FROM grupo_modificador WHERE producto_id IN (SELECT id FROM producto WHERE NOT activo AND nombre = 'Arroz chaufa');
DELETE FROM producto WHERE NOT activo AND nombre = 'Arroz chaufa';
DELETE FROM mesa WHERE NOT activa AND numero > 'M-10';
DELETE FROM usuario WHERE NOT activo AND nombre LIKE 'Mozo nuevo %';

-- Todo vuelve a estar disponible y las mesas libres
UPDATE mesa SET estado = 'LIBRE';
UPDATE producto SET agotado = false;
UPDATE opcion_modificador SET agotado = false;
UPDATE usuario SET intentos_fallidos = 0;
UPDATE configuracion SET valor = 'false' WHERE clave = 'sin_internet';

-- Stock de arranque para la demostración (en el local, la cajera registra el ingreso real)
INSERT INTO movimiento_inventario (tipo, pollos, cuartos_pecho, cuartos_pierna, motivo)
VALUES ('INGRESO', 30, 60, 60, 'Inventario inicial');

COMMIT;

\echo 'Datos de prueba borrados. Carta, mesas, usuarios y configuración se conservan; stock inicial: 30 pollos.'
