-- =============================================================================
-- 02 · Comentarios de tablas y columnas
-- Generado desde el diccionario de datos (diagramas/diccionario_de_datos.md).
-- Así la descripción de cada dato también se ve dentro de pgAdmin.
-- =============================================================================

BEGIN;

COMMENT ON TABLE usuario IS 'Personal que usa el sistema y sus credenciales.';
COMMENT ON COLUMN usuario.id IS 'Identificador único del usuario.';
COMMENT ON COLUMN usuario.nombre IS 'Nombre completo del trabajador.';
COMMENT ON COLUMN usuario.rol IS 'MOZO, CAJERO, REPARTIDOR o ADMINISTRADOR.';
COMMENT ON COLUMN usuario.pin_hash IS 'PIN de 4 a 6 dígitos cifrado con bcrypt.';
COMMENT ON COLUMN usuario.password_hash IS 'Contraseña cifrada (solo administrador).';
COMMENT ON COLUMN usuario.intentos_fallidos IS 'Intentos de PIN fallidos seguidos.';
COMMENT ON COLUMN usuario.activo IS 'Falso si el usuario fue desactivado.';
COMMENT ON COLUMN usuario.creado_en IS 'Fecha y hora de registro.';

COMMENT ON TABLE mesa IS 'Mesas físicas del salón.';
COMMENT ON COLUMN mesa.id IS 'Identificador único de la mesa.';
COMMENT ON COLUMN mesa.numero IS 'Código visible: M-01 a M-10.';
COMMENT ON COLUMN mesa.capacidad IS 'Cantidad de sillas.';
COMMENT ON COLUMN mesa.estado IS 'LIBRE, POR_CONFIRMAR, OCUPADA, CUENTA_SOLICITADA o POR_LIMPIAR.';
COMMENT ON COLUMN mesa.pos_x IS 'Posición horizontal en el plano.';
COMMENT ON COLUMN mesa.pos_y IS 'Posición vertical en el plano.';
COMMENT ON COLUMN mesa.activa IS 'Falso si la mesa se desactivó.';

COMMENT ON TABLE sesion_mesa IS 'Atención de una mesa desde que se abre hasta que se libera.';
COMMENT ON COLUMN sesion_mesa.id IS 'Identificador único de la sesión.';
COMMENT ON COLUMN sesion_mesa.mesa_id IS 'Mesa atendida (mesa.id).';
COMMENT ON COLUMN sesion_mesa.token IS 'Token aleatorio del QR; expira al cerrar.';
COMMENT ON COLUMN sesion_mesa.apertura IS 'Hora de apertura.';
COMMENT ON COLUMN sesion_mesa.cierre IS 'Hora de liberación de la mesa.';
COMMENT ON COLUMN sesion_mesa.comensales IS 'Número de personas.';

COMMENT ON TABLE categoria IS 'Secciones de la carta.';
COMMENT ON COLUMN categoria.id IS 'Identificador único de la categoría.';
COMMENT ON COLUMN categoria.nombre IS 'Pollos, mostritos, extras, bebidas, etc.';
COMMENT ON COLUMN categoria.orden IS 'Orden de aparición en la carta.';

COMMENT ON TABLE producto IS 'Platos, porciones y bebidas que se venden.';
COMMENT ON COLUMN producto.id IS 'Identificador único del producto.';
COMMENT ON COLUMN producto.categoria_id IS 'Categoría (categoria.id).';
COMMENT ON COLUMN producto.nombre IS 'Nombre en la carta.';
COMMENT ON COLUMN producto.precio IS 'Precio con impuestos incluidos (S/).';
COMMENT ON COLUMN producto.fraccion_pollo IS 'Pollo que consume: 0, 0.125, 0.25, 0.5 o 1.';
COMMENT ON COLUMN producto.destino_impresion IS 'POLLERO, CAJA o COCINA_INTERNA.';
COMMENT ON COLUMN producto.foto_url IS 'Ruta de la foto del producto.';
COMMENT ON COLUMN producto.activo IS 'Falso si ya no se vende.';
COMMENT ON COLUMN producto.agotado IS 'Verdadero si está agotado (Protocolo 86).';

COMMENT ON TABLE grupo_modificador IS 'Grupos de opciones de un producto (presa, papas, cremas).';
COMMENT ON COLUMN grupo_modificador.id IS 'Identificador único del grupo.';
COMMENT ON COLUMN grupo_modificador.producto_id IS 'Producto al que pertenece (producto.id).';
COMMENT ON COLUMN grupo_modificador.nombre IS 'Presa, Papas, Ensalada, Cremas, Corte.';
COMMENT ON COLUMN grupo_modificador.obligatorio IS 'Verdadero si se debe elegir antes de enviar.';
COMMENT ON COLUMN grupo_modificador.minimo IS 'Opciones mínimas a elegir.';
COMMENT ON COLUMN grupo_modificador.maximo IS 'Opciones máximas a elegir.';

COMMENT ON TABLE opcion_modificador IS 'Opciones de cada grupo de modificadores.';
COMMENT ON COLUMN opcion_modificador.id IS 'Identificador único de la opción.';
COMMENT ON COLUMN opcion_modificador.grupo_id IS 'Grupo al que pertenece (grupo_modificador.id).';
COMMENT ON COLUMN opcion_modificador.nombre IS 'Pecho con ala, Pierna con encuentro, Bien doradas, etc.';
COMMENT ON COLUMN opcion_modificador.recargo IS 'Monto adicional (S/ 0.00 si no tiene).';
COMMENT ON COLUMN opcion_modificador.efecto_inventario IS 'Presas o porciones que descuenta.';
COMMENT ON COLUMN opcion_modificador.agotado IS 'Verdadero si la opción está agotada.';

COMMENT ON TABLE cuenta IS 'Cuenta por cobrar de una mesa o de un pedido para llevar.';
COMMENT ON COLUMN cuenta.id IS 'Identificador único de la cuenta.';
COMMENT ON COLUMN cuenta.sesion_mesa_id IS 'Sesión de mesa (nulo en llevar y delivery).';
COMMENT ON COLUMN cuenta.total IS 'Total con impuestos.';
COMMENT ON COLUMN cuenta.saldo IS 'Monto pendiente de pago.';
COMMENT ON COLUMN cuenta.estado IS 'ABIERTA, PAGADA o ANULADA.';
COMMENT ON COLUMN cuenta.creada_en IS 'Fecha y hora de creación.';

COMMENT ON TABLE pedido IS 'Cada envío de productos a cocina (ronda).';
COMMENT ON COLUMN pedido.id IS 'Identificador único del pedido.';
COMMENT ON COLUMN pedido.cuenta_id IS 'Cuenta a la que se carga (cuenta.id).';
COMMENT ON COLUMN pedido.registrado_por IS 'Mozo o cajero (usuario.id); nulo si es por QR.';
COMMENT ON COLUMN pedido.numero IS 'Número correlativo del día.';
COMMENT ON COLUMN pedido.canal IS 'SALON, LLEVAR, DELIVERY o APP_EXTERNA.';
COMMENT ON COLUMN pedido.estado IS 'REGISTRADO, PROGRAMADO, POR_CONFIRMAR, CONFIRMADO, EN_PREPARACION, SERVIDO o ANULADO.';
COMMENT ON COLUMN pedido.clave_idempotencia IS 'Evita registrar el mismo pedido dos veces.';
COMMENT ON COLUMN pedido.hora_programada IS 'Hora pactada en pedidos programados.';
COMMENT ON COLUMN pedido.creado_en IS 'Hora de registro.';
COMMENT ON COLUMN pedido.impreso_en IS 'Hora de impresión en cocina.';
COMMENT ON COLUMN pedido.servido_en IS 'Hora en que se sirvió o quedó listo.';

COMMENT ON TABLE item_pedido IS 'Productos de un pedido.';
COMMENT ON COLUMN item_pedido.id IS 'Identificador único del ítem.';
COMMENT ON COLUMN item_pedido.pedido_id IS 'Pedido al que pertenece (pedido.id).';
COMMENT ON COLUMN item_pedido.producto_id IS 'Producto vendido (producto.id).';
COMMENT ON COLUMN item_pedido.cantidad IS 'Unidades pedidas.';
COMMENT ON COLUMN item_pedido.precio_unitario IS 'Precio vigente al momento del pedido.';
COMMENT ON COLUMN item_pedido.nota IS 'Nota libre para cocina.';
COMMENT ON COLUMN item_pedido.estado IS 'ACTIVO, CORREGIDO o ANULADO.';

COMMENT ON TABLE item_opcion IS 'Opciones elegidas en cada ítem.';
COMMENT ON COLUMN item_opcion.item_id IS 'Ítem del pedido (item_pedido.id).';
COMMENT ON COLUMN item_opcion.opcion_id IS 'Opción elegida (opcion_modificador.id).';
COMMENT ON COLUMN item_opcion.recargo IS 'Recargo aplicado al momento del pedido.';

COMMENT ON TABLE cliente IS 'Clientes de delivery y pedidos para llevar.';
COMMENT ON COLUMN cliente.id IS 'Identificador único del cliente.';
COMMENT ON COLUMN cliente.celular IS 'Celular de 9 dígitos.';
COMMENT ON COLUMN cliente.nombre IS 'Nombre del cliente.';
COMMENT ON COLUMN cliente.documento IS 'DNI o RUC para comprobantes.';

COMMENT ON TABLE pedido_delivery IS 'Datos de entrega de un pedido a domicilio.';
COMMENT ON COLUMN pedido_delivery.pedido_id IS 'Pedido entregado (pedido.id).';
COMMENT ON COLUMN pedido_delivery.cliente_id IS 'Cliente que recibe (cliente.id).';
COMMENT ON COLUMN pedido_delivery.repartidor_id IS 'Repartidor asignado (usuario.id).';
COMMENT ON COLUMN pedido_delivery.direccion IS 'Dirección de entrega.';
COMMENT ON COLUMN pedido_delivery.referencia IS 'Referencia para ubicar la casa.';
COMMENT ON COLUMN pedido_delivery.paga_con IS 'Billete con el que pagará el cliente.';
COMMENT ON COLUMN pedido_delivery.estado_despacho IS 'PENDIENTE, EN_RUTA, ENTREGADO o FALLIDO.';

COMMENT ON TABLE turno IS 'Turno de caja de un cajero.';
COMMENT ON COLUMN turno.id IS 'Identificador único del turno.';
COMMENT ON COLUMN turno.usuario_id IS 'Cajero que abre el turno (usuario.id).';
COMMENT ON COLUMN turno.apertura IS 'Hora de apertura.';
COMMENT ON COLUMN turno.cierre IS 'Hora de cierre.';
COMMENT ON COLUMN turno.fondo_inicial IS 'Sencillo al abrir.';
COMMENT ON COLUMN turno.efectivo_declarado IS 'Efectivo contado a ciegas al cerrar.';
COMMENT ON COLUMN turno.diferencia IS 'Declarado menos esperado.';
COMMENT ON COLUMN turno.comentario IS 'Justificación de la diferencia.';

COMMENT ON TABLE pago IS 'Pagos recibidos para una cuenta.';
COMMENT ON COLUMN pago.id IS 'Identificador único del pago.';
COMMENT ON COLUMN pago.cuenta_id IS 'Cuenta pagada (cuenta.id).';
COMMENT ON COLUMN pago.turno_id IS 'Turno en que se cobró (turno.id); nulo si fue en línea.';
COMMENT ON COLUMN pago.medio IS 'EFECTIVO, YAPE, PLIN, TARJETA o PLATAFORMA_EXTERNA.';
COMMENT ON COLUMN pago.monto IS 'Monto aplicado a la cuenta.';
COMMENT ON COLUMN pago.recibido IS 'Efectivo entregado por el cliente.';
COMMENT ON COLUMN pago.numero_operacion IS 'Número de operación Yape, Plin o POS.';
COMMENT ON COLUMN pago.id_transaccion IS 'Identificador de la pasarela de pagos.';
COMMENT ON COLUMN pago.fecha IS 'Fecha y hora del pago.';

COMMENT ON TABLE comprobante IS 'Boletas, facturas y notas de crédito electrónicas.';
COMMENT ON COLUMN comprobante.id IS 'Identificador único del comprobante.';
COMMENT ON COLUMN comprobante.cuenta_id IS 'Cuenta facturada (cuenta.id).';
COMMENT ON COLUMN comprobante.referencia_id IS 'Comprobante que anula una nota de crédito.';
COMMENT ON COLUMN comprobante.tipo IS 'BOLETA, FACTURA o NOTA_CREDITO.';
COMMENT ON COLUMN comprobante.serie IS 'Serie: B001, F001, BC01, FC01.';
COMMENT ON COLUMN comprobante.correlativo IS 'Número correlativo dentro de la serie.';
COMMENT ON COLUMN comprobante.documento_cliente IS 'DNI (8) o RUC (11) del adquirente.';
COMMENT ON COLUMN comprobante.nombre_cliente IS 'Nombre o razón social.';
COMMENT ON COLUMN comprobante.base_imponible IS 'Monto sin impuestos.';
COMMENT ON COLUMN comprobante.impuesto IS 'IGV + IPM según la tasa configurada.';
COMMENT ON COLUMN comprobante.total IS 'Total del comprobante.';
COMMENT ON COLUMN comprobante.estado_sunat IS 'PENDIENTE, ACEPTADO, OBSERVADO o RECHAZADO.';
COMMENT ON COLUMN comprobante.emitido_en IS 'Fecha y hora de emisión.';

COMMENT ON TABLE movimiento_caja IS 'Ingresos y egresos de efectivo del turno.';
COMMENT ON COLUMN movimiento_caja.id IS 'Identificador único del movimiento.';
COMMENT ON COLUMN movimiento_caja.turno_id IS 'Turno afectado (turno.id).';
COMMENT ON COLUMN movimiento_caja.autorizado_por IS 'Administrador que autorizó (usuario.id).';
COMMENT ON COLUMN movimiento_caja.tipo IS 'INGRESO o EGRESO.';
COMMENT ON COLUMN movimiento_caja.monto IS 'Monto del movimiento.';
COMMENT ON COLUMN movimiento_caja.motivo IS 'Justificación.';
COMMENT ON COLUMN movimiento_caja.fecha IS 'Fecha y hora.';

COMMENT ON TABLE movimiento_inventario IS 'Kardex de pollos y presas.';
COMMENT ON COLUMN movimiento_inventario.id IS 'Identificador único del movimiento.';
COMMENT ON COLUMN movimiento_inventario.producto_id IS 'Producto vendido o mermado (producto.id).';
COMMENT ON COLUMN movimiento_inventario.pedido_id IS 'Pedido que originó la salida (pedido.id).';
COMMENT ON COLUMN movimiento_inventario.autorizado_por IS 'Administrador que autorizó (usuario.id).';
COMMENT ON COLUMN movimiento_inventario.tipo IS 'INGRESO, VENTA, MERMA, REPOSICION o AJUSTE.';
COMMENT ON COLUMN movimiento_inventario.pollos IS 'Fracción de pollo (positiva o negativa).';
COMMENT ON COLUMN movimiento_inventario.cuartos_pecho IS 'Cuartos de pecho con ala.';
COMMENT ON COLUMN movimiento_inventario.cuartos_pierna IS 'Cuartos de pierna con encuentro.';
COMMENT ON COLUMN movimiento_inventario.motivo IS 'Motivo en mermas y ajustes.';
COMMENT ON COLUMN movimiento_inventario.fecha IS 'Fecha y hora.';

COMMENT ON TABLE bitacora IS 'Registro de auditoría de acciones sensibles.';
COMMENT ON COLUMN bitacora.id IS 'Identificador correlativo.';
COMMENT ON COLUMN bitacora.usuario_id IS 'Usuario que realizó la acción (usuario.id).';
COMMENT ON COLUMN bitacora.accion IS 'LOGIN, CAMBIO_PRECIO, ANULACION, APERTURA_GAVETA, etc.';
COMMENT ON COLUMN bitacora.entidad IS 'Tabla afectada.';
COMMENT ON COLUMN bitacora.entidad_id IS 'Registro afectado.';
COMMENT ON COLUMN bitacora.valores_antes IS 'Valores antes del cambio.';
COMMENT ON COLUMN bitacora.valores_despues IS 'Valores después del cambio.';
COMMENT ON COLUMN bitacora.fecha IS 'Fecha y hora de la acción.';

COMMENT ON VIEW v_stock_pollos IS 'Stock actual de pollos y de cuartos de pecho y pierna (suma del kardex).';

COMMIT;

\echo 'Comentarios del diccionario de datos agregados.'
