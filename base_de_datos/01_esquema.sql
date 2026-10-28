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

BEGIN;

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

COMMIT;

\echo 'Esquema creado: 19 tablas, 1 vista, índices y reglas de negocio.'
