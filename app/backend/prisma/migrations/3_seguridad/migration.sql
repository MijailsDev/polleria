-- Equipos vinculados y verificación en dos pasos: 08_seguridad.
-- Generado por prisma/generar-migraciones.mjs: no editar a mano.

-- =============================================================================
-- 08 · Seguridad del personal
-- Agrega: equipos vinculados (tablet del salón, caja, cocina, celular de reparto
-- y laptop del dueño), verificación en dos pasos del administrador (TOTP, como
-- Google Authenticator) y el parámetro para exigir equipos vinculados.
-- Se puede ejecutar varias veces sin error (IF NOT EXISTS).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Equipos vinculados
-- El dueño genera un código de un solo uso (válido 10 minutos) y lo escribe en
-- el equipo nuevo. El equipo recibe una llave que guarda el navegador; en la
-- base solo queda su resumen SHA-256, igual que con los PIN.
-- Solo desde un equipo vinculado se ve la lista del personal y se ingresa con PIN.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS equipo (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  nombre        varchar(60) NOT NULL,
  tipo          varchar(20) NOT NULL,
  llave_hash    varchar(64),
  codigo_hash   varchar(64),
  codigo_vence  timestamptz,
  vinculado_en  timestamptz,
  ultimo_uso    timestamptz,
  ultima_ip     varchar(60),
  activo        boolean     NOT NULL DEFAULT true,
  creado_por    uuid,
  creado_en     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_equipo PRIMARY KEY (id),
  CONSTRAINT fk_equipo_usuario FOREIGN KEY (creado_por) REFERENCES usuario (id),
  CONSTRAINT uq_equipo_llave UNIQUE (llave_hash),
  CONSTRAINT ck_equipo_tipo CHECK (tipo IN ('SALON', 'CAJA', 'COCINA', 'REPARTO', 'ADMINISTRACION')),
  CONSTRAINT ck_equipo_nombre CHECK (length(trim(nombre)) >= 2)
);

COMMENT ON TABLE equipo IS 'Equipos autorizados para el personal: solo desde ellos se ingresa con PIN.';
COMMENT ON COLUMN equipo.tipo IS 'SALON (mozos), CAJA (cajeros), COCINA (pantalla del pollero), REPARTO (repartidores) o ADMINISTRACION (todos los roles).';
COMMENT ON COLUMN equipo.llave_hash IS 'SHA-256 de la llave que guarda el navegador del equipo; nula si aún no se vincula.';
COMMENT ON COLUMN equipo.codigo_hash IS 'SHA-256 del código de vinculación de un solo uso.';
COMMENT ON COLUMN equipo.codigo_vence IS 'El código de vinculación vence a los 10 minutos.';

-- -----------------------------------------------------------------------------
-- Verificación en dos pasos del administrador (TOTP, RFC 6238)
-- -----------------------------------------------------------------------------
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS totp_secreto varchar(64);
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS totp_activo  boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN usuario.totp_secreto IS 'Secreto Base32 de la app autenticadora (Google o Microsoft Authenticator).';
COMMENT ON COLUMN usuario.totp_activo IS 'Si es verdadero, el administrador escribe además el código de 6 dígitos de su app al ingresar.';

-- -----------------------------------------------------------------------------
-- Parámetro: exigir equipos vinculados (en producción siempre se exige)
-- -----------------------------------------------------------------------------
INSERT INTO configuracion (clave, valor, descripcion) VALUES
  ('exigir_equipo_vinculado', 'false', 'Solo los equipos vinculados ven al personal e ingresan con PIN (en producción siempre activo)')
ON CONFLICT (clave) DO NOTHING;

