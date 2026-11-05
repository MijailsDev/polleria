-- Base del sistema: 01_esquema, 02_comentarios y 05_ampliacion.
-- Generado por prisma/generar-migraciones.mjs: no editar a mano.

-- =============================================================================
-- 01 · Esquema de la base de datos (19 tablas)
-- Sistema para Pollerías · PostgreSQL 16 o superior
--
-- Corresponde al diagrama diagramas/13_modelo_fisico.drawio y al diccionario
-- diagramas/diccionario_de_datos.md. A las columnas del modelo se agregan:
--   · valores por defecto (fechas, estados iniciales, contadores),
--   · restricciones CHECK con los valores permitidos y las reglas de negocio,
--   · índices para las claves foráneas y las búsquedas frecuentes.
--
-- Se ejecuta conectado a la base "polleria" como polleria_app.
-- Es para una base vacía: si las tablas ya existen, falla sin cambiar nada.
-- =============================================================================


CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid(), crypt() para PIN

-- -----------------------------------------------------------------------------
-- Seguridad
-- -----------------------------------------------------------------------------
CREATE TABLE usuario (
  id                uuid         NOT NULL DEFAULT gen_random_uuid(),
  nombre            varchar(80)  NOT NULL,
  rol               varchar(20)  NOT NULL,
  pin_hash          varchar(100) NOT NULL,
  password_hash     varchar(100),
  intentos_fallidos smallint     NOT NULL DEFAULT 0,
  activo            boolean      NOT NULL DEFAULT true,
  creado_en         timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT pk_usuario PRIMARY KEY (id),
  CONSTRAINT ck_usuario_rol CHECK (rol IN ('MOZO', 'CAJERO', 'REPARTIDOR', 'ADMINISTRADOR')),
  CONSTRAINT ck_usuario_intentos CHECK (intentos_fallidos >= 0),
  -- REQ-USR-01: el administrador usa además una contraseña para el panel
  CONSTRAINT ck_usuario_admin_password CHECK (rol <> 'ADMINISTRADOR' OR password_hash IS NOT NULL)
);

-- -----------------------------------------------------------------------------
-- Salón
-- -----------------------------------------------------------------------------
CREATE TABLE mesa (
  id        uuid        NOT NULL DEFAULT gen_random_uuid(),
  numero    varchar(5)  NOT NULL,
  capacidad smallint    NOT NULL DEFAULT 4,
  estado    varchar(20) NOT NULL DEFAULT 'LIBRE',
  pos_x     integer     NOT NULL DEFAULT 0,
  pos_y     integer     NOT NULL DEFAULT 0,
  activa    boolean     NOT NULL DEFAULT true,
  CONSTRAINT pk_mesa PRIMARY KEY (id),
  CONSTRAINT uq_mesa_numero UNIQUE (numero),
  CONSTRAINT ck_mesa_numero CHECK (numero ~ '^M-[0-9]{2}$'),
  CONSTRAINT ck_mesa_capacidad CHECK (capacidad BETWEEN 1 AND 20),
  CONSTRAINT ck_mesa_estado CHECK (estado IN ('LIBRE', 'POR_CONFIRMAR', 'OCUPADA', 'CUENTA_SOLICITADA', 'POR_LIMPIAR'))
);

CREATE TABLE sesion_mesa (
  id         uuid        NOT NULL DEFAULT gen_random_uuid(),
  mesa_id    uuid        NOT NULL,
  token      varchar(64) NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),  -- 256 bits (RNF-SEG-04)
  apertura   timestamptz NOT NULL DEFAULT now(),
  cierre     timestamptz,
  comensales smallint,
  CONSTRAINT pk_sesion_mesa PRIMARY KEY (id),
  CONSTRAINT uq_sesion_mesa_token UNIQUE (token),
  CONSTRAINT fk_sesion_mesa_mesa_id FOREIGN KEY (mesa_id) REFERENCES mesa (id),
  CONSTRAINT ck_sesion_mesa_comensales CHECK (comensales IS NULL OR comensales > 0),
  CONSTRAINT ck_sesion_mesa_cierre CHECK (cierre IS NULL OR cierre >= apertura)
);
-- Una mesa solo puede tener una sesión abierta a la vez
CREATE UNIQUE INDEX uq_sesion_mesa_abierta ON sesion_mesa (mesa_id) WHERE cierre IS NULL;

-- -----------------------------------------------------------------------------
-- Carta
-- -----------------------------------------------------------------------------
CREATE TABLE categoria (
  id     uuid        NOT NULL DEFAULT gen_random_uuid(),
  nombre varchar(50) NOT NULL,
  orden  smallint    NOT NULL DEFAULT 0,
  CONSTRAINT pk_categoria PRIMARY KEY (id)
);

CREATE TABLE producto (
  id                uuid          NOT NULL DEFAULT gen_random_uuid(),
  categoria_id      uuid          NOT NULL,
  nombre            varchar(80)   NOT NULL,
  precio            numeric(10,2) NOT NULL,
  fraccion_pollo    numeric(4,3)  NOT NULL DEFAULT 0,
  destino_impresion varchar(20)   NOT NULL DEFAULT 'POLLERO',
  foto_url          varchar(255),
  activo            boolean       NOT NULL DEFAULT true,
  agotado           boolean       NOT NULL DEFAULT false,
  CONSTRAINT pk_producto PRIMARY KEY (id),
  CONSTRAINT fk_producto_categoria_id FOREIGN KEY (categoria_id) REFERENCES categoria (id),
  CONSTRAINT ck_producto_precio CHECK (precio >= 0),
  CONSTRAINT ck_producto_fraccion CHECK (fraccion_pollo IN (0, 0.125, 0.25, 0.5, 1)),
  CONSTRAINT ck_producto_destino CHECK (destino_impresion IN ('POLLERO', 'CAJA', 'COCINA_INTERNA'))
);

CREATE TABLE grupo_modificador (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  producto_id uuid        NOT NULL,
  nombre      varchar(40) NOT NULL,
  obligatorio boolean     NOT NULL DEFAULT false,
  minimo      smallint    NOT NULL DEFAULT 0,
  maximo      smallint    NOT NULL DEFAULT 1,
  CONSTRAINT pk_grupo_modificador PRIMARY KEY (id),
  CONSTRAINT fk_grupo_modificador_producto_id FOREIGN KEY (producto_id) REFERENCES producto (id) ON DELETE CASCADE,
  CONSTRAINT ck_grupo_modificador_rango CHECK (minimo >= 0 AND maximo >= 1 AND maximo >= minimo),
  -- RN-01: un grupo obligatorio exige elegir al menos una opción
  CONSTRAINT ck_grupo_modificador_obligatorio CHECK (NOT obligatorio OR minimo >= 1)
);

CREATE TABLE opcion_modificador (
  id                uuid          NOT NULL DEFAULT gen_random_uuid(),
  grupo_id          uuid          NOT NULL,
  nombre            varchar(60)   NOT NULL,
  recargo           numeric(10,2) NOT NULL DEFAULT 0,
  efecto_inventario jsonb,
  agotado           boolean       NOT NULL DEFAULT false,
  CONSTRAINT pk_opcion_modificador PRIMARY KEY (id),
  CONSTRAINT fk_opcion_modificador_grupo_id FOREIGN KEY (grupo_id) REFERENCES grupo_modificador (id) ON DELETE CASCADE,
  CONSTRAINT ck_opcion_modificador_recargo CHECK (recargo >= 0)
);

-- -----------------------------------------------------------------------------
-- Pedidos
-- -----------------------------------------------------------------------------
CREATE TABLE cuenta (
  id             uuid          NOT NULL DEFAULT gen_random_uuid(),
  sesion_mesa_id uuid,
  total          numeric(10,2) NOT NULL DEFAULT 0,
  saldo          numeric(10,2) NOT NULL DEFAULT 0,
  estado         varchar(20)   NOT NULL DEFAULT 'ABIERTA',
  creada_en      timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT pk_cuenta PRIMARY KEY (id),
  CONSTRAINT fk_cuenta_sesion_mesa_id FOREIGN KEY (sesion_mesa_id) REFERENCES sesion_mesa (id),
  CONSTRAINT ck_cuenta_montos CHECK (total >= 0 AND saldo >= 0 AND saldo <= total),
  CONSTRAINT ck_cuenta_estado CHECK (estado IN ('ABIERTA', 'PAGADA', 'ANULADA'))
);

CREATE TABLE pedido (
  id                 uuid        NOT NULL DEFAULT gen_random_uuid(),
  cuenta_id          uuid        NOT NULL,
  registrado_por     uuid,
  numero             integer     NOT NULL,
  canal              varchar(15) NOT NULL,
  estado             varchar(20) NOT NULL DEFAULT 'REGISTRADO',
  clave_idempotencia uuid        NOT NULL DEFAULT gen_random_uuid(),
  hora_programada    timestamptz,
  creado_en          timestamptz NOT NULL DEFAULT now(),
  impreso_en         timestamptz,
  servido_en         timestamptz,
  CONSTRAINT pk_pedido PRIMARY KEY (id),
  CONSTRAINT uq_pedido_clave_idempotencia UNIQUE (clave_idempotencia),
  CONSTRAINT fk_pedido_cuenta_id FOREIGN KEY (cuenta_id) REFERENCES cuenta (id),
  CONSTRAINT fk_pedido_registrado_por FOREIGN KEY (registrado_por) REFERENCES usuario (id),
  CONSTRAINT ck_pedido_numero CHECK (numero > 0),
  CONSTRAINT ck_pedido_canal CHECK (canal IN ('SALON', 'LLEVAR', 'DELIVERY', 'APP_EXTERNA')),
  CONSTRAINT ck_pedido_estado CHECK (estado IN ('REGISTRADO', 'PROGRAMADO', 'POR_CONFIRMAR', 'CONFIRMADO', 'EN_PREPARACION', 'SERVIDO', 'ANULADO')),
  -- RN-19: un pedido programado necesita su hora pactada
  CONSTRAINT ck_pedido_programado CHECK (estado <> 'PROGRAMADO' OR hora_programada IS NOT NULL)
);

CREATE TABLE item_pedido (
  id              uuid          NOT NULL DEFAULT gen_random_uuid(),
  pedido_id       uuid          NOT NULL,
  producto_id     uuid          NOT NULL,
  cantidad        smallint      NOT NULL DEFAULT 1,
  precio_unitario numeric(10,2) NOT NULL,
  nota            varchar(100),
  estado          varchar(20)   NOT NULL DEFAULT 'ACTIVO',
  CONSTRAINT pk_item_pedido PRIMARY KEY (id),
  -- Composición: el ítem no existe sin su pedido
  CONSTRAINT fk_item_pedido_pedido_id FOREIGN KEY (pedido_id) REFERENCES pedido (id) ON DELETE CASCADE,
  CONSTRAINT fk_item_pedido_producto_id FOREIGN KEY (producto_id) REFERENCES producto (id),
  CONSTRAINT ck_item_pedido_cantidad CHECK (cantidad > 0),
  CONSTRAINT ck_item_pedido_precio CHECK (precio_unitario >= 0),
  CONSTRAINT ck_item_pedido_estado CHECK (estado IN ('ACTIVO', 'CORREGIDO', 'ANULADO'))
);

CREATE TABLE item_opcion (
  item_id   uuid          NOT NULL,
  opcion_id uuid          NOT NULL,
  recargo   numeric(10,2) NOT NULL DEFAULT 0,
  CONSTRAINT pk_item_opcion PRIMARY KEY (item_id, opcion_id),
  CONSTRAINT fk_item_opcion_item_id FOREIGN KEY (item_id) REFERENCES item_pedido (id) ON DELETE CASCADE,
  CONSTRAINT fk_item_opcion_opcion_id FOREIGN KEY (opcion_id) REFERENCES opcion_modificador (id),
  CONSTRAINT ck_item_opcion_recargo CHECK (recargo >= 0)
);

CREATE TABLE cliente (
  id        uuid        NOT NULL DEFAULT gen_random_uuid(),
  celular   varchar(9)  NOT NULL,
  nombre    varchar(80) NOT NULL,
  documento varchar(11),
  CONSTRAINT pk_cliente PRIMARY KEY (id),
  CONSTRAINT uq_cliente_celular UNIQUE (celular),
  CONSTRAINT ck_cliente_celular CHECK (celular ~ '^9[0-9]{8}$'),
  CONSTRAINT ck_cliente_documento CHECK (documento IS NULL OR documento ~ '^([0-9]{8}|(10|15|17|20)[0-9]{9})$')
);

CREATE TABLE pedido_delivery (
  pedido_id       uuid          NOT NULL,
  cliente_id      uuid          NOT NULL,
  repartidor_id   uuid,
  direccion       varchar(200)  NOT NULL,
  referencia      varchar(150),
  paga_con        numeric(10,2),
  estado_despacho varchar(20)   NOT NULL DEFAULT 'PENDIENTE',
  CONSTRAINT pk_pedido_delivery PRIMARY KEY (pedido_id),
  CONSTRAINT fk_pedido_delivery_pedido_id FOREIGN KEY (pedido_id) REFERENCES pedido (id) ON DELETE CASCADE,
  CONSTRAINT fk_pedido_delivery_cliente_id FOREIGN KEY (cliente_id) REFERENCES cliente (id),
  CONSTRAINT fk_pedido_delivery_repartidor_id FOREIGN KEY (repartidor_id) REFERENCES usuario (id),
  CONSTRAINT ck_pedido_delivery_paga_con CHECK (paga_con IS NULL OR paga_con >= 0),
  CONSTRAINT ck_pedido_delivery_estado CHECK (estado_despacho IN ('PENDIENTE', 'EN_RUTA', 'ENTREGADO', 'FALLIDO'))
);

-- -----------------------------------------------------------------------------
-- Caja y facturación
-- -----------------------------------------------------------------------------
CREATE TABLE turno (
  id                 uuid          NOT NULL DEFAULT gen_random_uuid(),
  usuario_id         uuid          NOT NULL,
  apertura           timestamptz   NOT NULL DEFAULT now(),
  cierre             timestamptz,
  fondo_inicial      numeric(10,2) NOT NULL,
  efectivo_declarado numeric(10,2),
  diferencia         numeric(10,2),
  comentario         varchar(200),
  CONSTRAINT pk_turno PRIMARY KEY (id),
  CONSTRAINT fk_turno_usuario_id FOREIGN KEY (usuario_id) REFERENCES usuario (id),
  CONSTRAINT ck_turno_montos CHECK (fondo_inicial >= 0 AND (efectivo_declarado IS NULL OR efectivo_declarado >= 0)),
  CONSTRAINT ck_turno_cierre CHECK (cierre IS NULL OR cierre >= apertura)
);
-- RN-07: un cajero tiene un solo turno abierto a la vez
CREATE UNIQUE INDEX uq_turno_abierto ON turno (usuario_id) WHERE cierre IS NULL;

CREATE TABLE pago (
  id               uuid          NOT NULL DEFAULT gen_random_uuid(),
  cuenta_id        uuid          NOT NULL,
  turno_id         uuid,
  medio            varchar(20)   NOT NULL,
  monto            numeric(10,2) NOT NULL,
  recibido         numeric(10,2),
  numero_operacion varchar(30),
  id_transaccion   varchar(60),
  fecha            timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT pk_pago PRIMARY KEY (id),
  CONSTRAINT uq_pago_numero_operacion UNIQUE (numero_operacion),
  CONSTRAINT fk_pago_cuenta_id FOREIGN KEY (cuenta_id) REFERENCES cuenta (id),
  CONSTRAINT fk_pago_turno_id FOREIGN KEY (turno_id) REFERENCES turno (id),
  CONSTRAINT ck_pago_medio CHECK (medio IN ('EFECTIVO', 'YAPE', 'PLIN', 'TARJETA', 'PLATAFORMA_EXTERNA')),
  CONSTRAINT ck_pago_monto CHECK (monto > 0),
  CONSTRAINT ck_pago_recibido CHECK (recibido IS NULL OR recibido >= monto),
  -- RN-07: el efectivo solo se cobra con un turno de caja abierto
  CONSTRAINT ck_pago_efectivo_turno CHECK (medio <> 'EFECTIVO' OR turno_id IS NOT NULL),
  -- RN-13: un pago digital necesita número de operación o el id de la pasarela
  CONSTRAINT ck_pago_digital_operacion CHECK (medio NOT IN ('YAPE', 'PLIN', 'TARJETA') OR numero_operacion IS NOT NULL OR id_transaccion IS NOT NULL)
);

CREATE TABLE comprobante (
  id                uuid          NOT NULL DEFAULT gen_random_uuid(),
  cuenta_id         uuid          NOT NULL,
  referencia_id     uuid,
  tipo              varchar(15)   NOT NULL,
  serie             varchar(4)    NOT NULL,
  correlativo       integer       NOT NULL,
  documento_cliente varchar(11),
  nombre_cliente    varchar(120),
  base_imponible    numeric(10,2) NOT NULL,
  impuesto          numeric(10,2) NOT NULL,
  total             numeric(10,2) NOT NULL,
  estado_sunat      varchar(20)   NOT NULL DEFAULT 'PENDIENTE',
  emitido_en        timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT pk_comprobante PRIMARY KEY (id),
  CONSTRAINT uq_comprobante_serie_correlativo UNIQUE (serie, correlativo),
  CONSTRAINT fk_comprobante_cuenta_id FOREIGN KEY (cuenta_id) REFERENCES cuenta (id),
  CONSTRAINT fk_comprobante_referencia_id FOREIGN KEY (referencia_id) REFERENCES comprobante (id),
  CONSTRAINT ck_comprobante_tipo CHECK (tipo IN ('BOLETA', 'FACTURA', 'NOTA_CREDITO')),
  CONSTRAINT ck_comprobante_serie CHECK (serie ~ '^[BF][A-Z0-9]{3}$'),
  CONSTRAINT ck_comprobante_correlativo CHECK (correlativo > 0),
  CONSTRAINT ck_comprobante_montos CHECK (base_imponible >= 0 AND impuesto >= 0 AND total = base_imponible + impuesto),
  CONSTRAINT ck_comprobante_estado CHECK (estado_sunat IN ('PENDIENTE', 'ACEPTADO', 'OBSERVADO', 'RECHAZADO')),
  CONSTRAINT ck_comprobante_documento CHECK (documento_cliente IS NULL OR documento_cliente ~ '^([0-9]{8}|(10|15|17|20)[0-9]{9})$'),
  -- RN-11: la factura exige RUC y la boleta de más de S/ 700 exige documento
  CONSTRAINT ck_comprobante_factura_ruc CHECK (tipo <> 'FACTURA' OR coalesce(documento_cliente ~ '^(10|15|17|20)[0-9]{9}$', false)),
  CONSTRAINT ck_comprobante_boleta_700 CHECK (tipo <> 'BOLETA' OR total <= 700 OR documento_cliente IS NOT NULL),
  -- RN-12: la nota de crédito siempre referencia al comprobante que anula
  CONSTRAINT ck_comprobante_nota_credito CHECK (tipo <> 'NOTA_CREDITO' OR referencia_id IS NOT NULL)
);

CREATE TABLE movimiento_caja (
  id             uuid          NOT NULL DEFAULT gen_random_uuid(),
  turno_id       uuid          NOT NULL,
  autorizado_por uuid,
  tipo           varchar(10)   NOT NULL,
  monto          numeric(10,2) NOT NULL,
  motivo         varchar(150)  NOT NULL,
  fecha          timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT pk_movimiento_caja PRIMARY KEY (id),
  CONSTRAINT fk_movimiento_caja_turno_id FOREIGN KEY (turno_id) REFERENCES turno (id),
  CONSTRAINT fk_movimiento_caja_autorizado_por FOREIGN KEY (autorizado_por) REFERENCES usuario (id),
  CONSTRAINT ck_movimiento_caja_tipo CHECK (tipo IN ('INGRESO', 'EGRESO')),
  CONSTRAINT ck_movimiento_caja_monto CHECK (monto > 0)
);

-- -----------------------------------------------------------------------------
-- Inventario de pollos
-- -----------------------------------------------------------------------------
CREATE TABLE movimiento_inventario (
  id             uuid          NOT NULL DEFAULT gen_random_uuid(),
  producto_id    uuid,
  pedido_id      uuid,
  autorizado_por uuid,
  tipo           varchar(15)   NOT NULL,
  pollos         numeric(6,3)  NOT NULL DEFAULT 0,
  cuartos_pecho  numeric(6,2)  NOT NULL DEFAULT 0,
  cuartos_pierna numeric(6,2)  NOT NULL DEFAULT 0,
  motivo         varchar(150),
  fecha          timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT pk_movimiento_inventario PRIMARY KEY (id),
  CONSTRAINT fk_movimiento_inventario_producto_id FOREIGN KEY (producto_id) REFERENCES producto (id),
  CONSTRAINT fk_movimiento_inventario_pedido_id FOREIGN KEY (pedido_id) REFERENCES pedido (id),
  CONSTRAINT fk_movimiento_inventario_autorizado_por FOREIGN KEY (autorizado_por) REFERENCES usuario (id),
  CONSTRAINT ck_movimiento_inventario_tipo CHECK (tipo IN ('INGRESO', 'VENTA', 'MERMA', 'REPOSICION', 'AJUSTE')),
  -- RN-04 y RN-16: mermas y ajustes necesitan motivo y autorización del administrador
  CONSTRAINT ck_movimiento_inventario_justificado CHECK (tipo NOT IN ('MERMA', 'AJUSTE') OR (motivo IS NOT NULL AND autorizado_por IS NOT NULL))
);

-- Stock actual: suma de todos los movimientos (las salidas se guardan en negativo)
CREATE VIEW v_stock_pollos AS
SELECT coalesce(sum(pollos), 0)         AS pollos,
       coalesce(sum(cuartos_pecho), 0)  AS cuartos_pecho,
       coalesce(sum(cuartos_pierna), 0) AS cuartos_pierna
FROM movimiento_inventario;

-- -----------------------------------------------------------------------------
-- Auditoría
-- -----------------------------------------------------------------------------
CREATE TABLE bitacora (
  id              bigserial   NOT NULL,
  usuario_id      uuid,
  accion          varchar(50) NOT NULL,
  entidad         varchar(40) NOT NULL,
  entidad_id      uuid,
  valores_antes   jsonb,
  valores_despues jsonb,
  fecha           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_bitacora PRIMARY KEY (id),
  CONSTRAINT fk_bitacora_usuario_id FOREIGN KEY (usuario_id) REFERENCES usuario (id)
);

-- RNF-SEG-05: la bitácora es de solo lectura; nadie puede modificarla ni borrarla
CREATE FUNCTION bitacora_solo_lectura() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La bitácora es de solo lectura: no se puede % sus registros.', lower(TG_OP);
END;
$$;
CREATE TRIGGER tr_bitacora_solo_lectura
BEFORE UPDATE OR DELETE ON bitacora
FOR EACH ROW EXECUTE FUNCTION bitacora_solo_lectura();

-- -----------------------------------------------------------------------------
-- Índices para claves foráneas y búsquedas frecuentes
-- -----------------------------------------------------------------------------
CREATE INDEX ix_cuenta_sesion_mesa          ON cuenta (sesion_mesa_id);
CREATE INDEX ix_pedido_cuenta               ON pedido (cuenta_id);
CREATE INDEX ix_pedido_estado               ON pedido (estado);
CREATE INDEX ix_pedido_creado_en            ON pedido (creado_en);
CREATE INDEX ix_item_pedido_pedido          ON item_pedido (pedido_id);
CREATE INDEX ix_item_pedido_producto        ON item_pedido (producto_id);
CREATE INDEX ix_item_opcion_opcion          ON item_opcion (opcion_id);
CREATE INDEX ix_producto_categoria          ON producto (categoria_id);
CREATE INDEX ix_grupo_modificador_producto  ON grupo_modificador (producto_id);
CREATE INDEX ix_opcion_modificador_grupo    ON opcion_modificador (grupo_id);
CREATE INDEX ix_pedido_delivery_cliente     ON pedido_delivery (cliente_id);
CREATE INDEX ix_pedido_delivery_repartidor  ON pedido_delivery (repartidor_id);
CREATE INDEX ix_turno_usuario               ON turno (usuario_id);
CREATE INDEX ix_pago_cuenta                 ON pago (cuenta_id);
CREATE INDEX ix_pago_turno                  ON pago (turno_id);
CREATE INDEX ix_comprobante_cuenta          ON comprobante (cuenta_id);
CREATE INDEX ix_movimiento_caja_turno       ON movimiento_caja (turno_id);
CREATE INDEX ix_movimiento_inventario_fecha ON movimiento_inventario (fecha);
CREATE INDEX ix_bitacora_fecha              ON bitacora (fecha);
CREATE INDEX ix_bitacora_entidad            ON bitacora (entidad, entidad_id);



-- =============================================================================
-- 02 · Comentarios de tablas y columnas
-- Generado desde el diccionario de datos (diagramas/diccionario_de_datos.md).
-- Así la descripción de cada dato también se ve dentro de pgAdmin.
-- =============================================================================


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



-- =============================================================================
-- 05 · Ampliación para la versión completa
-- Agrega lo necesario para: configuración del local, pedidos para llevar,
-- delivery y aplicaciones externas, descuentos, anulaciones, fuga de comensal,
-- notas de crédito, fusión de mesas, reposiciones y pago en mesa desde el
-- celular. Se puede ejecutar varias veces sin error (IF NOT EXISTS).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Configuración del local (REQ-SAL-06, REQ-TUR-02/04, REQ-DEL-02, REQ-AGO-03...)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS configuracion (
  clave          varchar(40)  NOT NULL,
  valor          jsonb        NOT NULL,
  descripcion    varchar(200),
  actualizado_en timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT pk_configuracion PRIMARY KEY (clave)
);

INSERT INTO configuracion (clave, valor, descripcion) VALUES
  ('limite_egreso',          '50',    'Egresos de caja mayores a este monto (S/) piden PIN del administrador'),
  ('margen_arqueo',          '1',     'Diferencia de arqueo (S/) a partir de la cual se exige comentario'),
  ('anticipacion_programados','15',   'Minutos antes de la hora pactada en que un pedido programado pasa a cocina'),
  ('umbral_presas',          '2',     'Cuartos de pecho o pierna por debajo de los cuales la presa se marca agotada'),
  ('minimo_pollos',          '5',     'Stock de pollos por debajo del cual se alerta a caja'),
  ('umbral_cola_cocina',     '12',    'Comandas pendientes a partir de las cuales la carta QR avisa demora'),
  ('minutos_correccion',     '2',     'Minutos después de impresa en que el mozo puede anular sin PIN'),
  ('sin_internet',           'false', 'Simula la caída de internet: comprobantes y pagos en línea quedan en cola')
ON CONFLICT (clave) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Pedido: nombre del cliente (para llevar), código de la app externa,
-- reposición sin costo y cuenta de origen cuando se fusionan mesas
-- -----------------------------------------------------------------------------
ALTER TABLE pedido ADD COLUMN IF NOT EXISTS nombre_cliente     varchar(80);
ALTER TABLE pedido ADD COLUMN IF NOT EXISTS codigo_plataforma  varchar(30);
ALTER TABLE pedido ADD COLUMN IF NOT EXISTS es_reposicion      boolean NOT NULL DEFAULT false;
ALTER TABLE pedido ADD COLUMN IF NOT EXISTS cuenta_original_id uuid;
DO $$ BEGIN
  ALTER TABLE pedido ADD CONSTRAINT fk_pedido_cuenta_original_id FOREIGN KEY (cuenta_original_id) REFERENCES cuenta (id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -----------------------------------------------------------------------------
-- Cuenta: descuento autorizado y motivo de anulación (fuga de comensal)
-- -----------------------------------------------------------------------------
ALTER TABLE cuenta ADD COLUMN IF NOT EXISTS descuento         numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE cuenta ADD COLUMN IF NOT EXISTS motivo_descuento  varchar(150);
ALTER TABLE cuenta ADD COLUMN IF NOT EXISTS motivo_anulacion  varchar(150);
DO $$ BEGIN
  ALTER TABLE cuenta ADD CONSTRAINT ck_cuenta_descuento CHECK (descuento >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -----------------------------------------------------------------------------
-- Sesión de mesa: mesa unida a otra (cuenta maestra, REQ-SAL-04)
-- -----------------------------------------------------------------------------
ALTER TABLE sesion_mesa ADD COLUMN IF NOT EXISTS unida_a uuid;
DO $$ BEGIN
  ALTER TABLE sesion_mesa ADD CONSTRAINT fk_sesion_mesa_unida_a FOREIGN KEY (unida_a) REFERENCES sesion_mesa (id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -----------------------------------------------------------------------------
-- Delivery: liquidación del repartidor (REQ-DEL-07) y destino si falló (REQ-DEL-08)
-- -----------------------------------------------------------------------------
ALTER TABLE pedido_delivery ADD COLUMN IF NOT EXISTS liquidado       boolean NOT NULL DEFAULT false;
ALTER TABLE pedido_delivery ADD COLUMN IF NOT EXISTS destino_fallido varchar(20);
ALTER TABLE pedido_delivery ADD COLUMN IF NOT EXISTS entregado_en    timestamptz;

-- -----------------------------------------------------------------------------
-- Comprobante: motivo de la nota de crédito (REQ-FAC-07)
-- -----------------------------------------------------------------------------
ALTER TABLE comprobante ADD COLUMN IF NOT EXISTS motivo varchar(150);

-- -----------------------------------------------------------------------------
-- Pago en mesa desde el celular (F-09): intentos de pago con la pasarela.
-- Mientras un intento está PENDIENTE la cuenta queda bloqueada (REQ-PAG-03).
-- Nunca se guarda la tarjeta ni el código de aprobación (REQ-PAG-06).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pago_en_linea (
  id             uuid          NOT NULL DEFAULT gen_random_uuid(),
  cuenta_id      uuid          NOT NULL,
  monto          numeric(10,2) NOT NULL,
  medio          varchar(20),
  estado         varchar(15)   NOT NULL DEFAULT 'PENDIENTE',
  id_transaccion varchar(60),
  creado_en      timestamptz   NOT NULL DEFAULT now(),
  expira_en      timestamptz   NOT NULL DEFAULT now() + interval '10 minutes',
  CONSTRAINT pk_pago_en_linea PRIMARY KEY (id),
  CONSTRAINT fk_pago_en_linea_cuenta_id FOREIGN KEY (cuenta_id) REFERENCES cuenta (id),
  CONSTRAINT uq_pago_en_linea_transaccion UNIQUE (id_transaccion),
  CONSTRAINT ck_pago_en_linea_monto CHECK (monto > 0),
  CONSTRAINT ck_pago_en_linea_estado CHECK (estado IN ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'EXPIRADO'))
);
CREATE INDEX IF NOT EXISTS ix_pago_en_linea_cuenta ON pago_en_linea (cuenta_id);
CREATE INDEX IF NOT EXISTS ix_pedido_cuenta_original ON pedido (cuenta_original_id);

COMMENT ON TABLE configuracion IS 'Parámetros del local que el administrador cambia sin programar.';
COMMENT ON TABLE pago_en_linea IS 'Intentos de pago desde la carta QR con la pasarela (F-09).';
COMMENT ON COLUMN pedido.es_reposicion IS 'Reposición por reclamo: se prepara sin costo para el cliente (REQ-INV-05).';
COMMENT ON COLUMN sesion_mesa.unida_a IS 'Sesión de la mesa maestra cuando dos mesas se fusionan (REQ-SAL-04).';
COMMENT ON COLUMN cuenta.descuento IS 'Descuento o cortesía autorizada con PIN del administrador (REQ-CAJ-07).';

