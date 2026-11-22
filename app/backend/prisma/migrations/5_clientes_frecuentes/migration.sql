-- Programa de clientes frecuentes: 10_clientes_frecuentes.
-- Generado por prisma/generar-migraciones.mjs: no editar a mano.

-- =============================================================================
-- 10 · Clientes frecuentes
-- El comensal puede identificarse (opcional) con su celular o su correo, que
-- confirma con un código de 6 dígitos (por WhatsApp o por correo). Cada compra
-- pagada suma; con N compras en los últimos D días pasa a «Cliente frecuente» y
-- en la carta QR ve combos exclusivos. Las promociones solo se le envían si dio
-- su permiso (Ley 29733), y puede retirarlo cuando quiera.
-- Se puede ejecutar varias veces sin error.
-- =============================================================================


CREATE TABLE IF NOT EXISTS cliente_frecuente (
  id                    uuid         NOT NULL DEFAULT gen_random_uuid(),
  celular               varchar(9),
  correo                varchar(120),
  nombre                varchar(80),
  acepta_promociones    boolean      NOT NULL DEFAULT false,
  acepta_promociones_en timestamptz,
  frecuente_desde       timestamptz,
  creado_en             timestamptz  NOT NULL DEFAULT now(),
  ultimo_ingreso        timestamptz,
  CONSTRAINT pk_cliente_frecuente PRIMARY KEY (id),
  CONSTRAINT uq_cliente_frecuente_celular UNIQUE (celular),
  CONSTRAINT uq_cliente_frecuente_correo UNIQUE (correo),
  CONSTRAINT ck_cliente_frecuente_contacto CHECK (celular IS NOT NULL OR correo IS NOT NULL),
  CONSTRAINT ck_cliente_frecuente_celular CHECK (celular IS NULL OR celular ~ '^9[0-9]{8}$'),
  CONSTRAINT ck_cliente_frecuente_correo CHECK (correo IS NULL OR (correo = lower(correo) AND correo ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'))
);

-- Códigos de un solo uso: se guarda solo su huella (hash), vencen a los 10 minutos
CREATE TABLE IF NOT EXISTS codigo_verificacion (
  id          uuid         NOT NULL DEFAULT gen_random_uuid(),
  canal       varchar(10)  NOT NULL,
  destino     varchar(120) NOT NULL,
  codigo_hash char(64)     NOT NULL,
  vence_en    timestamptz  NOT NULL,
  intentos    smallint     NOT NULL DEFAULT 0,
  usado_en    timestamptz,
  creado_en   timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT pk_codigo_verificacion PRIMARY KEY (id),
  CONSTRAINT ck_codigo_verificacion_canal CHECK (canal IN ('WHATSAPP', 'CORREO'))
);
CREATE INDEX IF NOT EXISTS ix_codigo_verificacion_destino ON codigo_verificacion (destino, creado_en);

-- Una fila por cliente y por cuenta pagada (una visita cuenta una sola vez)
CREATE TABLE IF NOT EXISTS compra_cliente (
  cliente_id uuid          NOT NULL,
  cuenta_id  uuid          NOT NULL,
  monto      numeric(10,2) NOT NULL DEFAULT 0,
  creado_en  timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT pk_compra_cliente PRIMARY KEY (cliente_id, cuenta_id),
  CONSTRAINT fk_compra_cliente_cliente_id FOREIGN KEY (cliente_id) REFERENCES cliente_frecuente (id) ON DELETE CASCADE,
  CONSTRAINT fk_compra_cliente_cuenta_id FOREIGN KEY (cuenta_id) REFERENCES cuenta (id),
  CONSTRAINT ck_compra_cliente_monto CHECK (monto >= 0)
);
CREATE INDEX IF NOT EXISTS ix_compra_cliente_fecha ON compra_cliente (cliente_id, creado_en);

-- Bandeja de salida de correos (simulada en /correo o enviada por un proveedor real)
CREATE TABLE IF NOT EXISTS correo_saliente (
  id          uuid         NOT NULL DEFAULT gen_random_uuid(),
  destino     varchar(120) NOT NULL,
  plantilla   varchar(40)  NOT NULL,
  asunto      varchar(150) NOT NULL,
  texto       text         NOT NULL,
  estado      varchar(12)  NOT NULL DEFAULT 'EN_COLA',
  id_externo  varchar(80),
  error       varchar(250),
  intentos    smallint     NOT NULL DEFAULT 0,
  creado_en   timestamptz  NOT NULL DEFAULT now(),
  enviado_en  timestamptz,
  CONSTRAINT pk_correo_saliente PRIMARY KEY (id),
  CONSTRAINT ck_correo_saliente_estado CHECK (estado IN ('EN_COLA', 'ENVIADO', 'ENTREGADO', 'FALLIDO'))
);

-- El pago en línea recuerda qué cliente frecuente pagó (para sumarle la compra)
ALTER TABLE pago_en_linea ADD COLUMN IF NOT EXISTS cliente_frecuente_id uuid;
DO $$ BEGIN
  ALTER TABLE pago_en_linea ADD CONSTRAINT fk_pago_en_linea_cliente_frecuente_id
    FOREIGN KEY (cliente_frecuente_id) REFERENCES cliente_frecuente (id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Productos que solo ve y puede pedir un cliente frecuente
ALTER TABLE producto ADD COLUMN IF NOT EXISTS solo_frecuentes boolean NOT NULL DEFAULT false;

-- Regla del programa (el administrador la cambia en Configuración)
INSERT INTO configuracion (clave, valor, descripcion) VALUES
  ('frecuente_compras',      '5',  'Compras necesarias para ser cliente frecuente'),
  ('frecuente_dias',         '60', 'Días en que se cuentan las compras del cliente frecuente'),
  ('frecuente_monto_minimo', '10', 'Monto mínimo (S/) de una compra para que sume como cliente frecuente')
ON CONFLICT (clave) DO NOTHING;

-- Combos exclusivos de ejemplo (sus componentes descuentan el inventario como cualquier combo)
INSERT INTO categoria (nombre, orden)
SELECT 'Para clientes frecuentes', -1
WHERE NOT EXISTS (SELECT 1 FROM categoria WHERE nombre = 'Para clientes frecuentes');

INSERT INTO producto (categoria_id, nombre, descripcion, precio, fraccion_pollo, destino_impresion, solo_frecuentes)
SELECT c.id, x.nombre, x.descripcion, x.precio, 0, 'POLLERO', true
FROM categoria c
CROSS JOIN (VALUES
  ('Combo frecuente: 1/2 pollo + papas + gaseosa 1.5 L', 'Precio especial para clientes frecuentes (normal S/ 69.00).', 59.00),
  ('Combo frecuente familiar: 1 pollo + papas + chicha 1 L', 'Precio especial para clientes frecuentes (normal S/ 104.00).', 92.00)
) AS x (nombre, descripcion, precio)
WHERE c.nombre = 'Para clientes frecuentes'
  AND NOT EXISTS (SELECT 1 FROM producto p WHERE p.nombre = x.nombre);

INSERT INTO producto_componente (producto_id, componente_id, cantidad)
SELECT combo.id, comp.id, 1
FROM (VALUES
  ('Combo frecuente: 1/2 pollo + papas + gaseosa 1.5 L', '1/2 Pollo a la brasa'),
  ('Combo frecuente: 1/2 pollo + papas + gaseosa 1.5 L', 'Porción de papas fritas'),
  ('Combo frecuente: 1/2 pollo + papas + gaseosa 1.5 L', 'Gaseosa 1.5 L'),
  ('Combo frecuente familiar: 1 pollo + papas + chicha 1 L', '1 Pollo entero a la brasa'),
  ('Combo frecuente familiar: 1 pollo + papas + chicha 1 L', 'Porción de papas fritas'),
  ('Combo frecuente familiar: 1 pollo + papas + chicha 1 L', 'Jarra de chicha morada 1 L')
) AS x (combo, componente)
JOIN producto combo ON combo.nombre = x.combo
JOIN producto comp ON comp.nombre = x.componente
ON CONFLICT DO NOTHING;

-- Opciones de los combos: sabor de la gaseosa y corte del pollo entero
INSERT INTO grupo_modificador (producto_id, nombre, obligatorio, minimo, maximo)
SELECT p.id, g.grupo, true, 1, 1
FROM (VALUES
  ('Combo frecuente: 1/2 pollo + papas + gaseosa 1.5 L', 'Sabor de la gaseosa'),
  ('Combo frecuente familiar: 1 pollo + papas + chicha 1 L', 'Corte')
) AS g (combo, grupo)
JOIN producto p ON p.nombre = g.combo
WHERE NOT EXISTS (SELECT 1 FROM grupo_modificador x WHERE x.producto_id = p.id AND x.nombre = g.grupo);

INSERT INTO opcion_modificador (grupo_id, nombre)
SELECT g.id, o.nombre
FROM grupo_modificador g
JOIN producto p ON p.id = g.producto_id AND p.solo_frecuentes
JOIN (VALUES ('Sabor de la gaseosa', 'Inca Kola'), ('Sabor de la gaseosa', 'Coca-Cola'),
             ('Corte', 'Corte en 4 presas'), ('Corte', 'Corte en 8 presas')) AS o (grupo, nombre)
  ON o.grupo = g.nombre
WHERE NOT EXISTS (SELECT 1 FROM opcion_modificador x WHERE x.grupo_id = g.id AND x.nombre = o.nombre);

COMMENT ON TABLE cliente_frecuente IS 'Comensales que se identificaron con su celular o correo para el programa de clientes frecuentes.';
COMMENT ON TABLE codigo_verificacion IS 'Códigos de un solo uso (hash) para confirmar el celular o el correo del cliente.';
COMMENT ON TABLE compra_cliente IS 'Compras pagadas que suman al programa de clientes frecuentes (una por cuenta).';
COMMENT ON TABLE correo_saliente IS 'Correos en cola o enviados (códigos de verificación y promociones).';
COMMENT ON COLUMN producto.solo_frecuentes IS 'Solo lo ve y lo puede pedir un cliente frecuente identificado.';

