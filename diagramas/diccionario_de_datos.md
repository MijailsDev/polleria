# 1.3.2 Diccionario de datos

Base de datos PostgreSQL 16 del Sistema para Pollerías. **Nulo:** S = admite vacío, N = obligatorio. **Clave:** PK = primaria, FK = foránea, UQ = única.

## 1. Tabla `usuario`

Personal que usa el sistema y sus credenciales.

| Campo | Tipo | Nulo | Clave | Descripción |
| :--- | :--- | :---: | :---: | :--- |
| `id` | uuid | N | PK | Identificador único del usuario. |
| `nombre` | varchar(80) | N |  | Nombre completo del trabajador. |
| `rol` | varchar(20) | N |  | MOZO, CAJERO, REPARTIDOR o ADMINISTRADOR. |
| `pin_hash` | varchar(100) | N |  | PIN de 4 a 6 dígitos cifrado con bcrypt. |
| `password_hash` | varchar(100) | S |  | Contraseña cifrada (solo administrador). |
| `intentos_fallidos` | smallint | N |  | Intentos de PIN fallidos seguidos. |
| `activo` | boolean | N |  | Falso si el usuario fue desactivado. |
| `creado_en` | timestamptz | N |  | Fecha y hora de registro. |

## 2. Tabla `mesa`

Mesas físicas del salón.

| Campo | Tipo | Nulo | Clave | Descripción |
| :--- | :--- | :---: | :---: | :--- |
| `id` | uuid | N | PK | Identificador único de la mesa. |
| `numero` | varchar(5) | N | UQ | Código visible: M-01 a M-10. |
| `capacidad` | smallint | N |  | Cantidad de sillas. |
| `estado` | varchar(20) | N |  | LIBRE, POR_CONFIRMAR, OCUPADA, CUENTA_SOLICITADA o POR_LIMPIAR. |
| `pos_x` | integer | N |  | Posición horizontal en el plano. |
| `pos_y` | integer | N |  | Posición vertical en el plano. |
| `activa` | boolean | N |  | Falso si la mesa se desactivó. |

## 3. Tabla `sesion_mesa`

Atención de una mesa desde que se abre hasta que se libera.

| Campo | Tipo | Nulo | Clave | Descripción |
| :--- | :--- | :---: | :---: | :--- |
| `id` | uuid | N | PK | Identificador único de la sesión. |
| `mesa_id` | uuid | N | FK | Mesa atendida (mesa.id). |
| `token` | varchar(64) | N | UQ | Token aleatorio del QR; expira al cerrar. |
| `apertura` | timestamptz | N |  | Hora de apertura. |
| `cierre` | timestamptz | S |  | Hora de liberación de la mesa. |
| `comensales` | smallint | S |  | Número de personas. |

## 4. Tabla `categoria`

Secciones de la carta.

| Campo | Tipo | Nulo | Clave | Descripción |
| :--- | :--- | :---: | :---: | :--- |
| `id` | uuid | N | PK | Identificador único de la categoría. |
| `nombre` | varchar(50) | N |  | Pollos, mostritos, extras, bebidas, etc. |
| `orden` | smallint | N |  | Orden de aparición en la carta. |

## 5. Tabla `producto`

Platos, porciones y bebidas que se venden.

| Campo | Tipo | Nulo | Clave | Descripción |
| :--- | :--- | :---: | :---: | :--- |
| `id` | uuid | N | PK | Identificador único del producto. |
| `categoria_id` | uuid | N | FK | Categoría (categoria.id). |
| `nombre` | varchar(80) | N |  | Nombre en la carta. |
| `precio` | numeric(10,2) | N |  | Precio con impuestos incluidos (S/). |
| `fraccion_pollo` | numeric(4,3) | N |  | Pollo que consume: 0, 0.125, 0.25, 0.5 o 1. |
| `destino_impresion` | varchar(20) | N |  | POLLERO, CAJA o COCINA_INTERNA. |
| `foto_url` | varchar(255) | S |  | Ruta de la foto del producto. |
| `activo` | boolean | N |  | Falso si ya no se vende. |
| `agotado` | boolean | N |  | Verdadero si está agotado (Protocolo 86). |

## 6. Tabla `grupo_modificador`

Grupos de opciones de un producto (presa, papas, cremas).

| Campo | Tipo | Nulo | Clave | Descripción |
| :--- | :--- | :---: | :---: | :--- |
| `id` | uuid | N | PK | Identificador único del grupo. |
| `producto_id` | uuid | N | FK | Producto al que pertenece (producto.id). |
| `nombre` | varchar(40) | N |  | Presa, Papas, Ensalada, Cremas, Corte. |
| `obligatorio` | boolean | N |  | Verdadero si se debe elegir antes de enviar. |
| `minimo` | smallint | N |  | Opciones mínimas a elegir. |
| `maximo` | smallint | N |  | Opciones máximas a elegir. |

## 7. Tabla `opcion_modificador`

Opciones de cada grupo de modificadores.

| Campo | Tipo | Nulo | Clave | Descripción |
| :--- | :--- | :---: | :---: | :--- |
| `id` | uuid | N | PK | Identificador único de la opción. |
| `grupo_id` | uuid | N | FK | Grupo al que pertenece (grupo_modificador.id). |
| `nombre` | varchar(60) | N |  | Pecho con ala, Pierna con encuentro, Bien doradas, etc. |
| `recargo` | numeric(10,2) | N |  | Monto adicional (S/ 0.00 si no tiene). |
| `efecto_inventario` | jsonb | S |  | Presas o porciones que descuenta. |
| `agotado` | boolean | N |  | Verdadero si la opción está agotada. |

## 8. Tabla `cuenta`

Cuenta por cobrar de una mesa o de un pedido para llevar.

| Campo | Tipo | Nulo | Clave | Descripción |
| :--- | :--- | :---: | :---: | :--- |
| `id` | uuid | N | PK | Identificador único de la cuenta. |
| `sesion_mesa_id` | uuid | S | FK | Sesión de mesa (nulo en llevar y delivery). |
| `total` | numeric(10,2) | N |  | Total con impuestos. |
| `saldo` | numeric(10,2) | N |  | Monto pendiente de pago. |
| `estado` | varchar(20) | N |  | ABIERTA, PAGADA o ANULADA. |
| `creada_en` | timestamptz | N |  | Fecha y hora de creación. |

## 9. Tabla `pedido`

Cada envío de productos a cocina (ronda).

| Campo | Tipo | Nulo | Clave | Descripción |
| :--- | :--- | :---: | :---: | :--- |
| `id` | uuid | N | PK | Identificador único del pedido. |
| `cuenta_id` | uuid | N | FK | Cuenta a la que se carga (cuenta.id). |
| `registrado_por` | uuid | S | FK | Mozo o cajero (usuario.id); nulo si es por QR. |
| `numero` | integer | N |  | Número correlativo del día. |
| `canal` | varchar(15) | N |  | SALON, LLEVAR, DELIVERY o APP_EXTERNA. |
| `estado` | varchar(20) | N |  | REGISTRADO, PROGRAMADO, POR_CONFIRMAR, CONFIRMADO, EN_PREPARACION, SERVIDO o ANULADO. |
| `clave_idempotencia` | uuid | N | UQ | Evita registrar el mismo pedido dos veces. |
| `hora_programada` | timestamptz | S |  | Hora pactada en pedidos programados. |
| `creado_en` | timestamptz | N |  | Hora de registro. |
| `impreso_en` | timestamptz | S |  | Hora de impresión en cocina. |
| `servido_en` | timestamptz | S |  | Hora en que se sirvió o quedó listo. |

## 10. Tabla `item_pedido`

Productos de un pedido.

| Campo | Tipo | Nulo | Clave | Descripción |
| :--- | :--- | :---: | :---: | :--- |
| `id` | uuid | N | PK | Identificador único del ítem. |
| `pedido_id` | uuid | N | FK | Pedido al que pertenece (pedido.id). |
| `producto_id` | uuid | N | FK | Producto vendido (producto.id). |
| `cantidad` | smallint | N |  | Unidades pedidas. |
| `precio_unitario` | numeric(10,2) | N |  | Precio vigente al momento del pedido. |
| `nota` | varchar(100) | S |  | Nota libre para cocina. |
| `estado` | varchar(20) | N |  | ACTIVO, CORREGIDO o ANULADO. |

## 11. Tabla `item_opcion`

Opciones elegidas en cada ítem.

| Campo | Tipo | Nulo | Clave | Descripción |
| :--- | :--- | :---: | :---: | :--- |
| `item_id` | uuid | N | PK/FK | Ítem del pedido (item_pedido.id). |
| `opcion_id` | uuid | N | PK/FK | Opción elegida (opcion_modificador.id). |
| `recargo` | numeric(10,2) | N |  | Recargo aplicado al momento del pedido. |

## 12. Tabla `cliente`

Clientes de delivery y pedidos para llevar.

| Campo | Tipo | Nulo | Clave | Descripción |
| :--- | :--- | :---: | :---: | :--- |
| `id` | uuid | N | PK | Identificador único del cliente. |
| `celular` | varchar(9) | N | UQ | Celular de 9 dígitos. |
| `nombre` | varchar(80) | N |  | Nombre del cliente. |
| `documento` | varchar(11) | S |  | DNI o RUC para comprobantes. |

## 13. Tabla `pedido_delivery`

Datos de entrega de un pedido a domicilio.

| Campo | Tipo | Nulo | Clave | Descripción |
| :--- | :--- | :---: | :---: | :--- |
| `pedido_id` | uuid | N | PK/FK | Pedido entregado (pedido.id). |
| `cliente_id` | uuid | N | FK | Cliente que recibe (cliente.id). |
| `repartidor_id` | uuid | S | FK | Repartidor asignado (usuario.id). |
| `direccion` | varchar(200) | N |  | Dirección de entrega. |
| `referencia` | varchar(150) | S |  | Referencia para ubicar la casa. |
| `paga_con` | numeric(10,2) | S |  | Billete con el que pagará el cliente. |
| `estado_despacho` | varchar(20) | N |  | PENDIENTE, EN_RUTA, ENTREGADO o FALLIDO. |

## 14. Tabla `turno`

Turno de caja de un cajero.

| Campo | Tipo | Nulo | Clave | Descripción |
| :--- | :--- | :---: | :---: | :--- |
| `id` | uuid | N | PK | Identificador único del turno. |
| `usuario_id` | uuid | N | FK | Cajero que abre el turno (usuario.id). |
| `apertura` | timestamptz | N |  | Hora de apertura. |
| `cierre` | timestamptz | S |  | Hora de cierre. |
| `fondo_inicial` | numeric(10,2) | N |  | Sencillo al abrir. |
| `efectivo_declarado` | numeric(10,2) | S |  | Efectivo contado a ciegas al cerrar. |
| `diferencia` | numeric(10,2) | S |  | Declarado menos esperado. |
| `comentario` | varchar(200) | S |  | Justificación de la diferencia. |

## 15. Tabla `pago`

Pagos recibidos para una cuenta.

| Campo | Tipo | Nulo | Clave | Descripción |
| :--- | :--- | :---: | :---: | :--- |
| `id` | uuid | N | PK | Identificador único del pago. |
| `cuenta_id` | uuid | N | FK | Cuenta pagada (cuenta.id). |
| `turno_id` | uuid | S | FK | Turno en que se cobró (turno.id); nulo si fue en línea. |
| `medio` | varchar(20) | N |  | EFECTIVO, YAPE, PLIN, TARJETA o PLATAFORMA_EXTERNA. |
| `monto` | numeric(10,2) | N |  | Monto aplicado a la cuenta. |
| `recibido` | numeric(10,2) | S |  | Efectivo entregado por el cliente. |
| `numero_operacion` | varchar(30) | S | UQ | Número de operación Yape, Plin o POS. |
| `id_transaccion` | varchar(60) | S |  | Identificador de la pasarela de pagos. |
| `fecha` | timestamptz | N |  | Fecha y hora del pago. |

## 16. Tabla `comprobante`

Boletas, facturas y notas de crédito electrónicas.

| Campo | Tipo | Nulo | Clave | Descripción |
| :--- | :--- | :---: | :---: | :--- |
| `id` | uuid | N | PK | Identificador único del comprobante. |
| `cuenta_id` | uuid | N | FK | Cuenta facturada (cuenta.id). |
| `referencia_id` | uuid | S | FK | Comprobante que anula una nota de crédito. |
| `tipo` | varchar(15) | N |  | BOLETA, FACTURA o NOTA_CREDITO. |
| `serie` | varchar(4) | N | UQ | Serie: B001, F001, BC01, FC01. |
| `correlativo` | integer | N | UQ | Número correlativo dentro de la serie. |
| `documento_cliente` | varchar(11) | S |  | DNI (8) o RUC (11) del adquirente. |
| `nombre_cliente` | varchar(120) | S |  | Nombre o razón social. |
| `base_imponible` | numeric(10,2) | N |  | Monto sin impuestos. |
| `impuesto` | numeric(10,2) | N |  | IGV + IPM según la tasa configurada. |
| `total` | numeric(10,2) | N |  | Total del comprobante. |
| `estado_sunat` | varchar(20) | N |  | PENDIENTE, ACEPTADO, OBSERVADO o RECHAZADO. |
| `emitido_en` | timestamptz | N |  | Fecha y hora de emisión. |

## 17. Tabla `movimiento_caja`

Ingresos y egresos de efectivo del turno.

| Campo | Tipo | Nulo | Clave | Descripción |
| :--- | :--- | :---: | :---: | :--- |
| `id` | uuid | N | PK | Identificador único del movimiento. |
| `turno_id` | uuid | N | FK | Turno afectado (turno.id). |
| `autorizado_por` | uuid | S | FK | Administrador que autorizó (usuario.id). |
| `tipo` | varchar(10) | N |  | INGRESO o EGRESO. |
| `monto` | numeric(10,2) | N |  | Monto del movimiento. |
| `motivo` | varchar(150) | N |  | Justificación. |
| `fecha` | timestamptz | N |  | Fecha y hora. |

## 18. Tabla `movimiento_inventario`

Kardex de pollos y presas.

| Campo | Tipo | Nulo | Clave | Descripción |
| :--- | :--- | :---: | :---: | :--- |
| `id` | uuid | N | PK | Identificador único del movimiento. |
| `producto_id` | uuid | S | FK | Producto vendido o mermado (producto.id). |
| `pedido_id` | uuid | S | FK | Pedido que originó la salida (pedido.id). |
| `autorizado_por` | uuid | S | FK | Administrador que autorizó (usuario.id). |
| `tipo` | varchar(15) | N |  | INGRESO, VENTA, MERMA, REPOSICION o AJUSTE. |
| `pollos` | numeric(6,3) | N |  | Fracción de pollo (positiva o negativa). |
| `cuartos_pecho` | numeric(6,2) | N |  | Cuartos de pecho con ala. |
| `cuartos_pierna` | numeric(6,2) | N |  | Cuartos de pierna con encuentro. |
| `motivo` | varchar(150) | S |  | Motivo en mermas y ajustes. |
| `fecha` | timestamptz | N |  | Fecha y hora. |

## 19. Tabla `bitacora`

Registro de auditoría de acciones sensibles.

| Campo | Tipo | Nulo | Clave | Descripción |
| :--- | :--- | :---: | :---: | :--- |
| `id` | bigserial | N | PK | Identificador correlativo. |
| `usuario_id` | uuid | S | FK | Usuario que realizó la acción (usuario.id). |
| `accion` | varchar(50) | N |  | LOGIN, CAMBIO_PRECIO, ANULACION, APERTURA_GAVETA, etc. |
| `entidad` | varchar(40) | N |  | Tabla afectada. |
| `entidad_id` | uuid | S |  | Registro afectado. |
| `valores_antes` | jsonb | S |  | Valores antes del cambio. |
| `valores_despues` | jsonb | S |  | Valores después del cambio. |
| `fecha` | timestamptz | N |  | Fecha y hora de la acción. |

## Relaciones

| Tabla hija | Columna | Tabla padre |
| :--- | :--- | :--- |
| `sesion_mesa` | `mesa_id` | `mesa` |
| `cuenta` | `sesion_mesa_id` | `sesion_mesa` |
| `pedido` | `cuenta_id` | `cuenta` |
| `pedido` | `registrado_por` | `usuario` |
| `item_pedido` | `pedido_id` | `pedido` |
| `item_pedido` | `producto_id` | `producto` |
| `item_opcion` | `item_id` | `item_pedido` |
| `item_opcion` | `opcion_id` | `opcion_modificador` |
| `producto` | `categoria_id` | `categoria` |
| `grupo_modificador` | `producto_id` | `producto` |
| `opcion_modificador` | `grupo_id` | `grupo_modificador` |
| `pedido_delivery` | `pedido_id` | `pedido` |
| `pedido_delivery` | `cliente_id` | `cliente` |
| `pedido_delivery` | `repartidor_id` | `usuario` |
| `turno` | `usuario_id` | `usuario` |
| `pago` | `cuenta_id` | `cuenta` |
| `pago` | `turno_id` | `turno` |
| `comprobante` | `cuenta_id` | `cuenta` |
| `comprobante` | `referencia_id` | `comprobante` |
| `movimiento_caja` | `turno_id` | `turno` |
| `movimiento_caja` | `autorizado_por` | `usuario` |
| `movimiento_inventario` | `producto_id` | `producto` |
| `movimiento_inventario` | `pedido_id` | `pedido` |
| `movimiento_inventario` | `autorizado_por` | `usuario` |
| `bitacora` | `usuario_id` | `usuario` |
