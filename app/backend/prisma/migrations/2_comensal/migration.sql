-- Experiencia del comensal en la carta QR: 07_comensal.
-- Generado por prisma/generar-migraciones.mjs: no editar a mano.

-- =============================================================================
-- 07 · Experiencia del comensal en la carta QR
-- Agrega: fotos y descripción de los platos, comprobante con DNI/RUC, cuenta
-- dividida, propina y celular para WhatsApp en el pago en línea, y la
-- calificación de la atención.
-- Se puede ejecutar varias veces sin error (IF NOT EXISTS).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Fotos y descripción de los platos
-- La foto se guarda en la base (ya reducida en el navegador, ~60 KB) para que
-- funcione igual en el servidor del local y en la nube, sin carpetas de archivos.
-- -----------------------------------------------------------------------------
ALTER TABLE producto ADD COLUMN IF NOT EXISTS descripcion varchar(200);

CREATE TABLE IF NOT EXISTS producto_foto (
  producto_id    uuid        NOT NULL,
  contenido      bytea       NOT NULL,
  tipo           varchar(30) NOT NULL,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_producto_foto PRIMARY KEY (producto_id),
  CONSTRAINT fk_producto_foto_producto FOREIGN KEY (producto_id) REFERENCES producto (id) ON DELETE CASCADE,
  CONSTRAINT ck_producto_foto_tipo CHECK (tipo IN ('image/jpeg', 'image/webp', 'image/png')),
  CONSTRAINT ck_producto_foto_tamano CHECK (octet_length(contenido) <= 400000)
);

-- -----------------------------------------------------------------------------
-- Pago en línea: qué comprobante quiere el comensal, cuánto paga (su parte),
-- propina y celular para recibir la boleta por WhatsApp
-- -----------------------------------------------------------------------------
ALTER TABLE pago_en_linea ADD COLUMN IF NOT EXISTS tipo_comprobante varchar(10) NOT NULL DEFAULT 'BOLETA';
ALTER TABLE pago_en_linea ADD COLUMN IF NOT EXISTS documento        varchar(11);
ALTER TABLE pago_en_linea ADD COLUMN IF NOT EXISTS nombre_cliente   varchar(120);
ALTER TABLE pago_en_linea ADD COLUMN IF NOT EXISTS propina          numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE pago_en_linea ADD COLUMN IF NOT EXISTS celular          varchar(9);
ALTER TABLE pago_en_linea ADD COLUMN IF NOT EXISTS enlace_base      varchar(120);
ALTER TABLE pago_en_linea ADD COLUMN IF NOT EXISTS comprobante_id   uuid;
DO $$ BEGIN
  ALTER TABLE pago_en_linea ADD CONSTRAINT ck_pago_en_linea_tipo CHECK (tipo_comprobante IN ('BOLETA', 'FACTURA'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE pago_en_linea ADD CONSTRAINT ck_pago_en_linea_propina CHECK (propina >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE pago_en_linea ADD CONSTRAINT fk_pago_en_linea_comprobante FOREIGN KEY (comprobante_id) REFERENCES comprobante (id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- La propina es del personal: se cobra junto al pago pero no va en el comprobante
ALTER TABLE pago ADD COLUMN IF NOT EXISTS propina numeric(10,2) NOT NULL DEFAULT 0;
DO $$ BEGIN
  ALTER TABLE pago ADD CONSTRAINT ck_pago_propina CHECK (propina >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -----------------------------------------------------------------------------
-- Calificación de la atención (una por cuenta)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calificacion (
  id         uuid         NOT NULL DEFAULT gen_random_uuid(),
  cuenta_id  uuid         NOT NULL,
  estrellas  smallint     NOT NULL,
  comentario varchar(500),
  creado_en  timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT pk_calificacion PRIMARY KEY (id),
  CONSTRAINT uq_calificacion_cuenta UNIQUE (cuenta_id),
  CONSTRAINT fk_calificacion_cuenta FOREIGN KEY (cuenta_id) REFERENCES cuenta (id),
  CONSTRAINT ck_calificacion_estrellas CHECK (estrellas BETWEEN 1 AND 5)
);
CREATE INDEX IF NOT EXISTS ix_calificacion_fecha ON calificacion (creado_en);

-- Descripciones de ejemplo para la carta
UPDATE producto SET descripcion = 'Con papas fritas, ensalada fresca y cremas a elección.'
WHERE descripcion IS NULL AND (nombre LIKE '%Pollo a la brasa%' OR nombre LIKE '1 Pollo entero%');
UPDATE producto SET descripcion = 'Pollo a la brasa con arroz chaufa y papas fritas.'
WHERE descripcion IS NULL AND nombre LIKE 'Mostrito%';
UPDATE producto SET descripcion = 'Pollo entero en 4 u 8 presas, porción familiar de papas y gaseosa de 1.5 L.'
WHERE descripcion IS NULL AND nombre LIKE 'Combo familiar%';
UPDATE producto SET descripcion = 'Preparada en casa con maíz morado, piña y canela.'
WHERE descripcion IS NULL AND nombre LIKE 'Jarra de chicha%';

COMMENT ON TABLE producto_foto IS 'Foto del plato para la carta QR (JPEG o WebP reducido en el navegador).';
COMMENT ON TABLE calificacion IS 'Calificación de 1 a 5 estrellas que deja el comensal al terminar.';
COMMENT ON COLUMN pago.propina IS 'Propina voluntaria del pago en línea; no forma parte del comprobante.';
COMMENT ON COLUMN pago_en_linea.monto IS 'Parte de la cuenta que paga este comensal (puede ser menor al saldo si la cuenta se divide).';

