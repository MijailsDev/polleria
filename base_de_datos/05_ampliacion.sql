-- =============================================================================
-- 05 · Ampliación para la versión completa
-- Agrega lo necesario para: configuración del local, pedidos para llevar,
-- delivery y aplicaciones externas, descuentos, anulaciones, fuga de comensal,
-- notas de crédito, fusión de mesas, reposiciones y pago en mesa desde el
-- celular. Se puede ejecutar varias veces sin error (IF NOT EXISTS).
-- =============================================================================

BEGIN;

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

COMMIT;
