-- =============================================================================
-- 06 · Preparación para producción
-- Agrega lo necesario para: bebidas despachadas desde caja, combos que
-- descuentan cada componente, precios por canal, impuesto a las bolsas
-- (ICBPER), facturación electrónica con respuesta del OSE y resumen diario,
-- mensajes de WhatsApp, cola de impresión ESC/POS, sincronización con la nube,
-- Libro de Reclamaciones virtual y registro de errores.
-- Se puede ejecutar varias veces sin error (IF NOT EXISTS).
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Bebidas: la caja las entrega y marca la hora (destino de impresión CAJA)
-- -----------------------------------------------------------------------------
ALTER TABLE item_pedido ADD COLUMN IF NOT EXISTS entregado_en timestamptz;

-- -----------------------------------------------------------------------------
-- Combos (REQ-CAT-03): un producto formado por otros productos
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS producto_componente (
  producto_id   uuid     NOT NULL,
  componente_id uuid     NOT NULL,
  cantidad      smallint NOT NULL DEFAULT 1,
  CONSTRAINT pk_producto_componente PRIMARY KEY (producto_id, componente_id),
  CONSTRAINT fk_producto_componente_producto FOREIGN KEY (producto_id) REFERENCES producto (id) ON DELETE CASCADE,
  CONSTRAINT fk_producto_componente_componente FOREIGN KEY (componente_id) REFERENCES producto (id),
  CONSTRAINT ck_producto_componente_cantidad CHECK (cantidad BETWEEN 1 AND 20),
  CONSTRAINT ck_producto_componente_distinto CHECK (producto_id <> componente_id)
);

-- -----------------------------------------------------------------------------
-- Precios por canal (REQ-CAT-06): si no hay fila, vale el precio del salón
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS precio_canal (
  producto_id uuid          NOT NULL,
  canal       varchar(15)   NOT NULL,
  precio      numeric(10,2) NOT NULL,
  CONSTRAINT pk_precio_canal PRIMARY KEY (producto_id, canal),
  CONSTRAINT fk_precio_canal_producto FOREIGN KEY (producto_id) REFERENCES producto (id) ON DELETE CASCADE,
  CONSTRAINT ck_precio_canal_canal CHECK (canal IN ('LLEVAR', 'DELIVERY', 'APP_EXTERNA')),
  CONSTRAINT ck_precio_canal_precio CHECK (precio >= 0)
);

-- -----------------------------------------------------------------------------
-- ICBPER: impuesto al consumo de bolsas de plástico (S/ 0.50 por bolsa)
-- -----------------------------------------------------------------------------
ALTER TABLE cuenta      ADD COLUMN IF NOT EXISTS bolsas smallint NOT NULL DEFAULT 0;
ALTER TABLE comprobante ADD COLUMN IF NOT EXISTS icbper numeric(10,2) NOT NULL DEFAULT 0;
DO $$ BEGIN
  ALTER TABLE cuenta ADD CONSTRAINT ck_cuenta_bolsas CHECK (bolsas BETWEEN 0 AND 50);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE comprobante DROP CONSTRAINT IF EXISTS ck_comprobante_montos;
ALTER TABLE comprobante ADD CONSTRAINT ck_comprobante_montos
  CHECK (base_imponible >= 0 AND impuesto >= 0 AND icbper >= 0 AND total = base_imponible + impuesto + icbper);

-- -----------------------------------------------------------------------------
-- Respuesta del OSE / SUNAT para cada comprobante (REQ-FAC-05)
-- -----------------------------------------------------------------------------
ALTER TABLE comprobante ADD COLUMN IF NOT EXISTS hash_cpe      varchar(64);
ALTER TABLE comprobante ADD COLUMN IF NOT EXISTS codigo_sunat  varchar(10);
ALTER TABLE comprobante ADD COLUMN IF NOT EXISTS mensaje_sunat varchar(250);
ALTER TABLE comprobante ADD COLUMN IF NOT EXISTS enviado_en    timestamptz;
ALTER TABLE comprobante ADD COLUMN IF NOT EXISTS intentos      smallint NOT NULL DEFAULT 0;

-- Resumen diario de boletas (REQ-FAC-09)
CREATE TABLE IF NOT EXISTS resumen_diario (
  id               uuid          NOT NULL DEFAULT gen_random_uuid(),
  identificador    varchar(20)   NOT NULL,
  fecha_referencia date          NOT NULL,
  cantidad         integer       NOT NULL,
  total            numeric(12,2) NOT NULL,
  ticket           varchar(40),
  estado           varchar(15)   NOT NULL DEFAULT 'ENVIADO',
  mensaje          varchar(250),
  creado_en        timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT pk_resumen_diario PRIMARY KEY (id),
  CONSTRAINT uq_resumen_diario_identificador UNIQUE (identificador),
  CONSTRAINT ck_resumen_diario_estado CHECK (estado IN ('ENVIADO', 'ACEPTADO', 'RECHAZADO'))
);

-- -----------------------------------------------------------------------------
-- Mensajes salientes por WhatsApp (comprobantes, delivery, reclamos)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mensaje_saliente (
  id          uuid         NOT NULL DEFAULT gen_random_uuid(),
  destino     varchar(15)  NOT NULL,
  plantilla   varchar(40)  NOT NULL,
  texto       text         NOT NULL,
  enlace      varchar(255),
  estado      varchar(12)  NOT NULL DEFAULT 'EN_COLA',
  id_externo  varchar(80),
  error       varchar(250),
  intentos    smallint     NOT NULL DEFAULT 0,
  creado_en   timestamptz  NOT NULL DEFAULT now(),
  enviado_en  timestamptz,
  leido_en    timestamptz,
  CONSTRAINT pk_mensaje_saliente PRIMARY KEY (id),
  CONSTRAINT ck_mensaje_saliente_destino CHECK (destino ~ '^9[0-9]{8}$'),
  CONSTRAINT ck_mensaje_saliente_estado CHECK (estado IN ('EN_COLA', 'ENVIADO', 'ENTREGADO', 'LEIDO', 'FALLIDO'))
);
CREATE INDEX IF NOT EXISTS ix_mensaje_saliente_estado  ON mensaje_saliente (estado);
CREATE INDEX IF NOT EXISTS ix_mensaje_saliente_destino ON mensaje_saliente (destino);

-- -----------------------------------------------------------------------------
-- Cola de impresión ESC/POS (ticketera del pollero y de caja)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS impresion (
  id         uuid        NOT NULL DEFAULT gen_random_uuid(),
  impresora  varchar(10) NOT NULL,
  tipo       varchar(20) NOT NULL,
  contenido  text        NOT NULL,
  pitidos    smallint    NOT NULL DEFAULT 0,
  estado     varchar(10) NOT NULL DEFAULT 'PENDIENTE',
  error      varchar(250),
  creado_en  timestamptz NOT NULL DEFAULT now(),
  impreso_en timestamptz,
  CONSTRAINT pk_impresion PRIMARY KEY (id),
  CONSTRAINT ck_impresion_impresora CHECK (impresora IN ('COCINA', 'CAJA')),
  CONSTRAINT ck_impresion_estado CHECK (estado IN ('PENDIENTE', 'IMPRESO', 'ERROR'))
);
CREATE INDEX IF NOT EXISTS ix_impresion_creado ON impresion (impresora, creado_en);

-- -----------------------------------------------------------------------------
-- Sincronización con la nube (arquitectura híbrida, REQ-CON-04)
--   evento_sync: lo que el servidor del local tiene pendiente de subir
--   nube_evento: lo que la nube ya recibió (en producción vive en el VPS)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS evento_sync (
  id         bigserial   NOT NULL,
  entidad    varchar(30) NOT NULL,
  entidad_id uuid        NOT NULL,
  operacion  varchar(15) NOT NULL,
  datos      jsonb       NOT NULL,
  creado_en  timestamptz NOT NULL DEFAULT now(),
  enviado_en timestamptz,
  intentos   smallint    NOT NULL DEFAULT 0,
  error      varchar(250),
  CONSTRAINT pk_evento_sync PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS ix_evento_sync_pendiente ON evento_sync (id) WHERE enviado_en IS NULL;

CREATE TABLE IF NOT EXISTS nube_evento (
  id           bigserial   NOT NULL,
  local_id     bigint      NOT NULL,
  entidad      varchar(30) NOT NULL,
  entidad_id   uuid        NOT NULL,
  operacion    varchar(15) NOT NULL,
  datos        jsonb       NOT NULL,
  recibido_en  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_nube_evento PRIMARY KEY (id),
  CONSTRAINT uq_nube_evento_local UNIQUE (local_id)
);

-- -----------------------------------------------------------------------------
-- Libro de Reclamaciones virtual (Código de Protección y Defensa del Consumidor)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reclamo (
  id              uuid          NOT NULL DEFAULT gen_random_uuid(),
  codigo          varchar(20)   NOT NULL,
  tipo            varchar(10)   NOT NULL,
  nombre          varchar(120)  NOT NULL,
  tipo_documento  varchar(5)    NOT NULL,
  documento       varchar(12)   NOT NULL,
  domicilio       varchar(200)  NOT NULL,
  celular         varchar(9),
  email           varchar(120),
  menor_de_edad   boolean       NOT NULL DEFAULT false,
  apoderado       varchar(120),
  bien            varchar(10)   NOT NULL,
  monto           numeric(10,2),
  descripcion     varchar(250)  NOT NULL,
  detalle         text          NOT NULL,
  pedido          text          NOT NULL,
  estado          varchar(12)   NOT NULL DEFAULT 'PENDIENTE',
  respuesta       text,
  respondido_por  uuid,
  respondido_en   timestamptz,
  plazo           date          NOT NULL,
  creado_en       timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT pk_reclamo PRIMARY KEY (id),
  CONSTRAINT uq_reclamo_codigo UNIQUE (codigo),
  CONSTRAINT fk_reclamo_respondido_por FOREIGN KEY (respondido_por) REFERENCES usuario (id),
  CONSTRAINT ck_reclamo_tipo CHECK (tipo IN ('RECLAMO', 'QUEJA')),
  CONSTRAINT ck_reclamo_tipo_documento CHECK (tipo_documento IN ('DNI', 'CE', 'PAS')),
  CONSTRAINT ck_reclamo_bien CHECK (bien IN ('PRODUCTO', 'SERVICIO')),
  CONSTRAINT ck_reclamo_estado CHECK (estado IN ('PENDIENTE', 'RESPONDIDO')),
  CONSTRAINT ck_reclamo_menor CHECK (NOT menor_de_edad OR apoderado IS NOT NULL),
  CONSTRAINT ck_reclamo_contacto CHECK (celular IS NOT NULL OR email IS NOT NULL)
);

-- -----------------------------------------------------------------------------
-- Registro de errores del servidor (monitoreo)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS error_registro (
  id         bigserial    NOT NULL,
  metodo     varchar(10),
  ruta       varchar(200),
  estado     smallint,
  mensaje    varchar(500) NOT NULL,
  pila       text,
  usuario_id uuid,
  fecha      timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT pk_error_registro PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS ix_error_registro_fecha ON error_registro (fecha);

-- -----------------------------------------------------------------------------
-- Nuevos parámetros del local
-- -----------------------------------------------------------------------------
INSERT INTO configuracion (clave, valor, descripcion) VALUES
  ('tasa_icbper',       '0.5',                                'Impuesto por cada bolsa de plástico entregada (S/)'),
  ('ruc_emisor',        '"20000000001"',                      'RUC de la pollería que aparece en los comprobantes'),
  ('razon_social',      '"POLLERÍA LA BRASA DORADA E.I.R.L."', 'Razón social del emisor'),
  ('direccion_local',   '"Av. León Velarde 100, Tambopata, Madre de Dios"', 'Dirección fiscal del local'),
  ('impresora_cocina',  '""',                                 'IP de la ticketera del pollero (vacío = impresora virtual)'),
  ('impresora_caja',    '""',                                 'IP de la ticketera de caja con gaveta (vacío = impresora virtual)'),
  ('celular_dueno',     '"999888777"',                        'Celular del dueño para alertas por WhatsApp')
ON CONFLICT (clave) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Combo de ejemplo: Combo familiar = 1 pollo + papas + gaseosa 1.5 L
-- -----------------------------------------------------------------------------
INSERT INTO categoria (nombre, orden)
SELECT 'Combos', 0 WHERE NOT EXISTS (SELECT 1 FROM categoria WHERE nombre = 'Combos');

INSERT INTO producto (categoria_id, nombre, precio, fraccion_pollo, destino_impresion)
SELECT c.id, 'Combo familiar (1 pollo + papas + gaseosa 1.5 L)', 99.00, 0, 'POLLERO'
FROM categoria c
WHERE c.nombre = 'Combos'
  AND NOT EXISTS (SELECT 1 FROM producto WHERE nombre LIKE 'Combo familiar%');

INSERT INTO producto_componente (producto_id, componente_id, cantidad)
SELECT combo.id, comp.id, 1
FROM producto combo
JOIN producto comp ON comp.nombre IN ('1 Pollo entero a la brasa', 'Porción de papas fritas', 'Gaseosa 1.5 L')
WHERE combo.nombre LIKE 'Combo familiar%'
ON CONFLICT DO NOTHING;

-- Opciones del combo: el corte y el sabor de la gaseosa (sin efecto en inventario:
-- los cuartos del pollo se descuentan por el componente)
INSERT INTO grupo_modificador (producto_id, nombre, obligatorio, minimo, maximo)
SELECT p.id, g.nombre, true, 1, 1
FROM producto p
CROSS JOIN (VALUES ('Corte'), ('Sabor de la gaseosa')) AS g (nombre)
WHERE p.nombre LIKE 'Combo familiar%'
  AND NOT EXISTS (SELECT 1 FROM grupo_modificador x WHERE x.producto_id = p.id AND x.nombre = g.nombre);

INSERT INTO opcion_modificador (grupo_id, nombre)
SELECT g.id, o.nombre
FROM grupo_modificador g
JOIN producto p ON p.id = g.producto_id AND p.nombre LIKE 'Combo familiar%'
JOIN (VALUES ('Corte', 'Corte en 4 presas'), ('Corte', 'Corte en 8 presas'),
             ('Sabor de la gaseosa', 'Inca Kola'), ('Sabor de la gaseosa', 'Coca-Cola')) AS o (grupo, nombre)
  ON o.grupo = g.nombre
WHERE NOT EXISTS (SELECT 1 FROM opcion_modificador x WHERE x.grupo_id = g.id AND x.nombre = o.nombre);

-- Precio de ejemplo por canal: el delivery cuesta S/ 2.00 más en pollos
INSERT INTO precio_canal (producto_id, canal, precio)
SELECT id, 'DELIVERY', precio + 2 FROM producto
WHERE nombre IN ('1/4 Pollo a la brasa', '1/2 Pollo a la brasa', '1 Pollo entero a la brasa')
ON CONFLICT DO NOTHING;

COMMENT ON TABLE producto_componente IS 'Componentes de un combo; al venderlo se descuenta el inventario de cada uno (REQ-CAT-03).';
COMMENT ON TABLE precio_canal IS 'Precio distinto por canal de venta; sin fila se usa el precio del salón (REQ-CAT-06).';
COMMENT ON TABLE resumen_diario IS 'Resumen diario de boletas enviado a SUNAT a través del OSE (REQ-FAC-09).';
COMMENT ON TABLE mensaje_saliente IS 'Mensajes de WhatsApp en cola o enviados (comprobantes, delivery, reclamos).';
COMMENT ON TABLE impresion IS 'Tickets enviados a las impresoras térmicas ESC/POS de cocina y caja.';
COMMENT ON TABLE evento_sync IS 'Bandeja de salida hacia la nube: ventas, pagos y cierres por sincronizar.';
COMMENT ON TABLE nube_evento IS 'Lo que el servidor en la nube recibió del local (simulado en el mismo PostgreSQL).';
COMMENT ON TABLE reclamo IS 'Hojas del Libro de Reclamaciones virtual; respuesta en máximo 15 días hábiles.';
COMMENT ON TABLE error_registro IS 'Errores del servidor para el monitoreo del administrador.';
COMMENT ON COLUMN item_pedido.entregado_en IS 'Hora en que la caja entregó la bebida al mozo o al cliente.';
COMMENT ON COLUMN cuenta.bolsas IS 'Bolsas de plástico entregadas; cada una paga ICBPER.';
COMMENT ON COLUMN comprobante.icbper IS 'Impuesto a las bolsas de plástico incluido en el total.';

COMMIT;
