-- =============================================================================
-- 00 · Crear el usuario de la aplicación y la base de datos
-- Sistema para Pollerías · PostgreSQL 16 o superior
--
-- Se ejecuta como superusuario (postgres) conectado a la base "postgres".
-- La contraseña del usuario polleria_app se lee de la variable de entorno
-- APP_PASS (la define crear_base_de_datos.ps1), para no escribirla aquí.
-- Se puede ejecutar varias veces: no duplica nada.
-- =============================================================================

\getenv app_pass APP_PASS
\if :{?app_pass}
\else
  \warn 'Falta la variable de entorno APP_PASS con la contraseña de polleria_app.'
  SELECT 1/0 AS falta_app_pass;
\endif

-- Usuario dueño de la base (el backend NestJS se conectará con él)
SELECT format('CREATE ROLE polleria_app LOGIN PASSWORD %L', :'app_pass')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'polleria_app') \gexec

SELECT format('ALTER ROLE polleria_app LOGIN PASSWORD %L', :'app_pass')
WHERE EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'polleria_app') \gexec

-- Base de datos en UTF-8
SELECT 'CREATE DATABASE polleria OWNER polleria_app ENCODING ''UTF8'' TEMPLATE template0'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'polleria') \gexec

-- Hora del Perú (UTC-5) para todas las conexiones a esta base
ALTER DATABASE polleria SET timezone TO 'America/Lima';

\echo 'Usuario polleria_app y base de datos polleria listos.'
