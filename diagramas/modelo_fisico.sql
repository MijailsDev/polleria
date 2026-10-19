-- Modelo físico · Sistema para Pollerías · PostgreSQL 16
-- Generado a partir del mismo modelo que el diagrama 13_modelo_fisico.drawio
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Personal que usa el sistema y sus credenciales.
CREATE TABLE usuario (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre varchar(80) NOT NULL,
  rol varchar(20) NOT NULL,
  pin_hash varchar(100) NOT NULL,
  password_hash varchar(100),
  intentos_fallidos smallint NOT NULL,
  activo boolean NOT NULL,
  creado_en timestamptz NOT NULL,
  CONSTRAINT pk_usuario PRIMARY KEY (id)
);

-- Mesas físicas del salón.
CREATE TABLE mesa (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  numero varchar(5) NOT NULL,
  capacidad smallint NOT NULL,
  estado varchar(20) NOT NULL,
  pos_x integer NOT NULL,
  pos_y integer NOT NULL,
  activa boolean NOT NULL,
  CONSTRAINT pk_mesa PRIMARY KEY (id),
  CONSTRAINT uq_mesa_numero UNIQUE (numero)
);

-- Atención de una mesa desde que se abre hasta que se libera.
CREATE TABLE sesion_mesa (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  mesa_id uuid NOT NULL,
  token varchar(64) NOT NULL,
  apertura timestamptz NOT NULL,
  cierre timestamptz,
  comensales smallint,
  CONSTRAINT pk_sesion_mesa PRIMARY KEY (id),
  CONSTRAINT uq_sesion_mesa_token UNIQUE (token)
);

-- Secciones de la carta.
CREATE TABLE categoria (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nombre varchar(50) NOT NULL,
  orden smallint NOT NULL,
  CONSTRAINT pk_categoria PRIMARY KEY (id)
);

-- Platos, porciones y bebidas que se venden.
CREATE TABLE producto (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  categoria_id uuid NOT NULL,
  nombre varchar(80) NOT NULL,
  precio numeric(10,2) NOT NULL,
  fraccion_pollo numeric(4,3) NOT NULL,
  destino_impresion varchar(20) NOT NULL,
  foto_url varchar(255),
  activo boolean NOT NULL,
  agotado boolean NOT NULL,
  CONSTRAINT pk_producto PRIMARY KEY (id)
);

-- Grupos de opciones de un producto (presa, papas, cremas).
CREATE TABLE grupo_modificador (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  producto_id uuid NOT NULL,
  nombre varchar(40) NOT NULL,
  obligatorio boolean NOT NULL,
  minimo smallint NOT NULL,
  maximo smallint NOT NULL,
  CONSTRAINT pk_grupo_modificador PRIMARY KEY (id)
);

-- Opciones de cada grupo de modificadores.
CREATE TABLE opcion_modificador (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  grupo_id uuid NOT NULL,
  nombre varchar(60) NOT NULL,
  recargo numeric(10,2) NOT NULL,
  efecto_inventario jsonb,
  agotado boolean NOT NULL,
  CONSTRAINT pk_opcion_modificador PRIMARY KEY (id)
);

-- Cuenta por cobrar de una mesa o de un pedido para llevar.
CREATE TABLE cuenta (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sesion_mesa_id uuid,
  total numeric(10,2) NOT NULL,
  saldo numeric(10,2) NOT NULL,
  estado varchar(20) NOT NULL,
  creada_en timestamptz NOT NULL,
  CONSTRAINT pk_cuenta PRIMARY KEY (id)
);

-- Cada envío de productos a cocina (ronda).
CREATE TABLE pedido (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cuenta_id uuid NOT NULL,
  registrado_por uuid,
  numero integer NOT NULL,
  canal varchar(15) NOT NULL,
  estado varchar(20) NOT NULL,
  clave_idempotencia uuid NOT NULL,
  hora_programada timestamptz,
  creado_en timestamptz NOT NULL,
  impreso_en timestamptz,
  servido_en timestamptz,
  CONSTRAINT pk_pedido PRIMARY KEY (id),
  CONSTRAINT uq_pedido_clave_idempotencia UNIQUE (clave_idempotencia)
);

-- Productos de un pedido.
CREATE TABLE item_pedido (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL,
  producto_id uuid NOT NULL,
  cantidad smallint NOT NULL,
  precio_unitario numeric(10,2) NOT NULL,
  nota varchar(100),
  estado varchar(20) NOT NULL,
  CONSTRAINT pk_item_pedido PRIMARY KEY (id)
);

-- Opciones elegidas en cada ítem.
CREATE TABLE item_opcion (
  item_id uuid NOT NULL,
  opcion_id uuid NOT NULL,
  recargo numeric(10,2) NOT NULL,
  CONSTRAINT pk_item_opcion PRIMARY KEY (item_id, opcion_id)
);

-- Clientes de delivery y pedidos para llevar.
CREATE TABLE cliente (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  celular varchar(9) NOT NULL,
  nombre varchar(80) NOT NULL,
  documento varchar(11),
  CONSTRAINT pk_cliente PRIMARY KEY (id),
  CONSTRAINT uq_cliente_celular UNIQUE (celular)
);

-- Datos de entrega de un pedido a domicilio.
CREATE TABLE pedido_delivery (
  pedido_id uuid NOT NULL,
  cliente_id uuid NOT NULL,
  repartidor_id uuid,
  direccion varchar(200) NOT NULL,
  referencia varchar(150),
  paga_con numeric(10,2),
  estado_despacho varchar(20) NOT NULL,
  CONSTRAINT pk_pedido_delivery PRIMARY KEY (pedido_id)
);

-- Turno de caja de un cajero.
CREATE TABLE turno (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  apertura timestamptz NOT NULL,
  cierre timestamptz,
  fondo_inicial numeric(10,2) NOT NULL,
  efectivo_declarado numeric(10,2),
  diferencia numeric(10,2),
  comentario varchar(200),
  CONSTRAINT pk_turno PRIMARY KEY (id)
);

-- Pagos recibidos para una cuenta.
CREATE TABLE pago (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cuenta_id uuid NOT NULL,
  turno_id uuid,
  medio varchar(20) NOT NULL,
  monto numeric(10,2) NOT NULL,
  recibido numeric(10,2),
  numero_operacion varchar(30),
  id_transaccion varchar(60),
  fecha timestamptz NOT NULL,
  CONSTRAINT pk_pago PRIMARY KEY (id),
  CONSTRAINT uq_pago_numero_operacion UNIQUE (numero_operacion)
);

-- Boletas, facturas y notas de crédito electrónicas.
CREATE TABLE comprobante (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cuenta_id uuid NOT NULL,
  referencia_id uuid,
  tipo varchar(15) NOT NULL,
  serie varchar(4) NOT NULL,
  correlativo integer NOT NULL,
  documento_cliente varchar(11),
  nombre_cliente varchar(120),
  base_imponible numeric(10,2) NOT NULL,
  impuesto numeric(10,2) NOT NULL,
  total numeric(10,2) NOT NULL,
  estado_sunat varchar(20) NOT NULL,
  emitido_en timestamptz NOT NULL,
  CONSTRAINT pk_comprobante PRIMARY KEY (id),
  CONSTRAINT uq_comprobante_serie_correlativo UNIQUE (serie, correlativo)
);

-- Ingresos y egresos de efectivo del turno.
CREATE TABLE movimiento_caja (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  turno_id uuid NOT NULL,
  autorizado_por uuid,
  tipo varchar(10) NOT NULL,
  monto numeric(10,2) NOT NULL,
  motivo varchar(150) NOT NULL,
  fecha timestamptz NOT NULL,
  CONSTRAINT pk_movimiento_caja PRIMARY KEY (id)
);

-- Kardex de pollos y presas.
CREATE TABLE movimiento_inventario (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  producto_id uuid,
  pedido_id uuid,
  autorizado_por uuid,
  tipo varchar(15) NOT NULL,
  pollos numeric(6,3) NOT NULL,
  cuartos_pecho numeric(6,2) NOT NULL,
  cuartos_pierna numeric(6,2) NOT NULL,
  motivo varchar(150),
  fecha timestamptz NOT NULL,
  CONSTRAINT pk_movimiento_inventario PRIMARY KEY (id)
);

-- Registro de auditoría de acciones sensibles.
CREATE TABLE bitacora (
  id bigserial NOT NULL,
  usuario_id uuid,
  accion varchar(50) NOT NULL,
  entidad varchar(40) NOT NULL,
  entidad_id uuid,
  valores_antes jsonb,
  valores_despues jsonb,
  fecha timestamptz NOT NULL,
  CONSTRAINT pk_bitacora PRIMARY KEY (id)
);

ALTER TABLE sesion_mesa ADD CONSTRAINT fk_sesion_mesa_mesa_id FOREIGN KEY (mesa_id) REFERENCES mesa (id);
ALTER TABLE cuenta ADD CONSTRAINT fk_cuenta_sesion_mesa_id FOREIGN KEY (sesion_mesa_id) REFERENCES sesion_mesa (id);
ALTER TABLE pedido ADD CONSTRAINT fk_pedido_cuenta_id FOREIGN KEY (cuenta_id) REFERENCES cuenta (id);
ALTER TABLE pedido ADD CONSTRAINT fk_pedido_registrado_por FOREIGN KEY (registrado_por) REFERENCES usuario (id);
ALTER TABLE item_pedido ADD CONSTRAINT fk_item_pedido_pedido_id FOREIGN KEY (pedido_id) REFERENCES pedido (id);
ALTER TABLE item_pedido ADD CONSTRAINT fk_item_pedido_producto_id FOREIGN KEY (producto_id) REFERENCES producto (id);
ALTER TABLE item_opcion ADD CONSTRAINT fk_item_opcion_item_id FOREIGN KEY (item_id) REFERENCES item_pedido (id);
ALTER TABLE item_opcion ADD CONSTRAINT fk_item_opcion_opcion_id FOREIGN KEY (opcion_id) REFERENCES opcion_modificador (id);
ALTER TABLE producto ADD CONSTRAINT fk_producto_categoria_id FOREIGN KEY (categoria_id) REFERENCES categoria (id);
ALTER TABLE grupo_modificador ADD CONSTRAINT fk_grupo_modificador_producto_id FOREIGN KEY (producto_id) REFERENCES producto (id);
ALTER TABLE opcion_modificador ADD CONSTRAINT fk_opcion_modificador_grupo_id FOREIGN KEY (grupo_id) REFERENCES grupo_modificador (id);
ALTER TABLE pedido_delivery ADD CONSTRAINT fk_pedido_delivery_pedido_id FOREIGN KEY (pedido_id) REFERENCES pedido (id);
ALTER TABLE pedido_delivery ADD CONSTRAINT fk_pedido_delivery_cliente_id FOREIGN KEY (cliente_id) REFERENCES cliente (id);
ALTER TABLE pedido_delivery ADD CONSTRAINT fk_pedido_delivery_repartidor_id FOREIGN KEY (repartidor_id) REFERENCES usuario (id);
ALTER TABLE turno ADD CONSTRAINT fk_turno_usuario_id FOREIGN KEY (usuario_id) REFERENCES usuario (id);
ALTER TABLE pago ADD CONSTRAINT fk_pago_cuenta_id FOREIGN KEY (cuenta_id) REFERENCES cuenta (id);
ALTER TABLE pago ADD CONSTRAINT fk_pago_turno_id FOREIGN KEY (turno_id) REFERENCES turno (id);
ALTER TABLE comprobante ADD CONSTRAINT fk_comprobante_cuenta_id FOREIGN KEY (cuenta_id) REFERENCES cuenta (id);
ALTER TABLE comprobante ADD CONSTRAINT fk_comprobante_referencia_id FOREIGN KEY (referencia_id) REFERENCES comprobante (id);
ALTER TABLE movimiento_caja ADD CONSTRAINT fk_movimiento_caja_turno_id FOREIGN KEY (turno_id) REFERENCES turno (id);
ALTER TABLE movimiento_caja ADD CONSTRAINT fk_movimiento_caja_autorizado_por FOREIGN KEY (autorizado_por) REFERENCES usuario (id);
ALTER TABLE movimiento_inventario ADD CONSTRAINT fk_movimiento_inventario_producto_id FOREIGN KEY (producto_id) REFERENCES producto (id);
ALTER TABLE movimiento_inventario ADD CONSTRAINT fk_movimiento_inventario_pedido_id FOREIGN KEY (pedido_id) REFERENCES pedido (id);
ALTER TABLE movimiento_inventario ADD CONSTRAINT fk_movimiento_inventario_autorizado_por FOREIGN KEY (autorizado_por) REFERENCES usuario (id);
ALTER TABLE bitacora ADD CONSTRAINT fk_bitacora_usuario_id FOREIGN KEY (usuario_id) REFERENCES usuario (id);
