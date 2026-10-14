# Documento de Requerimientos de Software

**SISTEMA PARA POLLERÍAS — Sistema de Gestión Web y Automatización Operativa para Pollería y Brasas (Versión 2.0)**

Integrantes:
* QUISPE QUISPE, Mijail — Jefe de proyecto, Backend, DBA y UI/UX
* ENRIQUEZ HUARHUA, Nilton — Analista, Frontend, Hardware/Red, QA y Documentación

Fecha: 13/10/2026

| Dato | Detalle |
| :--- | :--- |
| Institución | Universidad Nacional Amazónica de Madre de Dios (UNAMAD) – E.P. Ingeniería de Sistemas e Informática |
| Curso | Análisis y Diseño de Sistemas II |
| Docente | Dr. Dany Dorian Isuiza Pérez |
| Cliente | Pollería y Brasas del Sur (Puerto Maldonado) – Propietario: Sr. Carlos Mendoza |
| Modalidad | Proyecto "Llave en Mano" (software + hardware + instalación + capacitación) |
| Periodo del proyecto | 21/09/2026 – 24/12/2026 |

**Historial de versiones**

| Versión | Fecha | Descripción |
| :---: | :---: | :--- |
| 1.0 | 28/09/2026 | Versión preliminar (10 funcionalidades, 25 requerimientos). |
| 2.0 | 13/10/2026 | Reestructuración completa: 15 funcionalidades, requerimientos con identificador por módulo, criterios medibles, reglas tributarias peruanas, contingencia, alcance excluido y matriz de trazabilidad. |

## Contenido
1. Propósito
2. Alcance del producto / Software
3. Funcionalidades del producto
4. Clases y características de usuarios
5. Entorno operativo
6. Requerimientos funcionales
7. Reglas de negocio
8. Requerimientos de interfaces externas
   * Interfaces de usuario
   * Interfaces de hardware
   * Interfaces de software
   * Interfaces de comunicación
9. Requerimientos no funcionales
10. Otros requerimientos
11. Glosario
* Anexo A. Matriz de trazabilidad
* Anexo B. Carta inicial de referencia

---

## 1. Propósito

El presente documento especifica los requerimientos del software **"SISTEMA PARA POLLERÍAS – Sistema de Gestión Web y Automatización Operativa", versión 2.0** (en adelante, *el Sistema*), que será desarrollado e implantado en la **Pollería y Brasas del Sur**, local de un solo piso con 10 mesas ubicado en Puerto Maldonado, Madre de Dios.

Este documento cubre la **totalidad del software** de la versión 2.0, es decir, todos sus subsistemas:

| Subsistema | Procesos que incluye |
| :--- | :--- |
| Salón | Mapa de mesas, carta digital por QR, toma de pedidos por mozos, pago desde la mesa. |
| Producción | Enrutamiento e impresión de comandas en la estación del maestro pollero con alarma sonora, control de productos agotados. |
| Caja y facturación | Cobro multimétodo, división de cuenta, comprobantes electrónicos SUNAT, turnos y arqueo ciego. |
| Despacho | Pedidos para llevar, pedidos programados, delivery propio y ventas por aplicaciones externas. |
| Control y administración | Usuarios y roles, carta y precios, inventario de pollos por presas, mermas, anulaciones, reportes y auditoría. |
| Plataforma | Operación local sin internet (servidor Edge), sincronización con la nube y respaldo. |

No forman parte de este documento la compra del hardware ni el análisis económico, que se detallan en los documentos de referencia de la sección 2.6.

**Convenciones del documento:**
* Los requerimientos funcionales se identifican como `REQ-<MÓDULO>-<NN>` (por ejemplo, `REQ-CAJ-03` es el tercer requerimiento del módulo de Caja). Las reglas de negocio se identifican como `RN-NN` y los requerimientos no funcionales como `RNF-<CATEGORÍA>-<NN>`.
* La expresión "el sistema debe" indica una obligación verificable mediante prueba.
* **Prioridades:** **Alta** = imprescindible para la puesta en marcha del 24/12/2026; **Media** = necesaria, se construye después de las de prioridad alta dentro de la misma versión; **Baja** = deseable, puede postergarse a una versión posterior sin afectar la operación.

**Público objetivo:** propietario del negocio (validación y aprobación), docente del curso (evaluación), equipo de desarrollo (diseño y programación) y responsable de QA (diseño de casos de prueba).

## 2. Alcance del producto / Software

### 2.1. Propósito u objetivo general
Desarrollar e implantar un sistema web multi-dispositivo que digitalice el ciclo completo de atención de la pollería —desde que el cliente pide hasta que se cierra la caja—, eliminando las comandas de papel, acelerando el cobro con billeteras digitales y emitiendo comprobantes electrónicos, **sin detener la atención cuando falle el internet o la energía eléctrica**.

### 2.2. Situación actual (línea base)
Según la entrevista al propietario y la observación directa en hora punta (21–23/09/2026):

| # | Problema detectado | Efecto medido |
| :-: | :--- | :--- |
| P1 | Los clientes esperan a que el mozo traiga la carta física. | ~5 minutos sin atención al sentarse. |
| P2 | La comanda de papel se pierde, se mancha de grasa o el pollero no la ve; los gritos no se oyen por el extractor. | Retrasos de hasta 30 minutos por mesa. |
| P3 | El mozo olvida anotar la presa (pecho o pierna) del 1/4 de pollo. | Plato devuelto y revendido como 1/8: pérdida de S/ 10.00 por plato. |
| P4 | El cobro con Yape/Plin se verifica mirando el celular de cada cliente y la boleta es manual. | ~5 minutos por cliente y colas en caja. |
| P5 | El cierre de caja se hace sumando vouchers y papeles a mano. | ~1 hora diaria y descuadres frecuentes. |
| P6 | La computadora de caja se apaga con cortes de luz de segundos. | ~15 minutos sin poder cobrar. |
| P7 | Dos mozos para 10 mesas no se dan abasto en hora punta. | Pedidos y cobros simultáneos desatendidos. |

### 2.3. Beneficios para el negocio
* **Cero errores de presa y de lectura:** la comanda impresa no admite caligrafía ilegible y el sistema no deja enviar un 1/4 de pollo sin presa definida.
* **Atención inmediata:** el comensal ve la carta y pide desde su celular en segundos; los mozos se concentran en servir.
* **Cocina sincronizada:** cada pedido llega impreso a la estación del pollero con una alarma que supera el ruido del extractor.
* **Cobro rápido y verificado:** el pago con Yape/Plin/tarjeta se confirma automáticamente por la pasarela o se registra con número de operación; se acepta pago mixto y cuentas divididas.
* **Cumplimiento tributario:** boletas, facturas y notas de crédito electrónicas emitidas en segundos y entregadas en papel o por WhatsApp/correo.
* **Control del dinero y de los pollos:** arqueo ciego, anulaciones con PIN del administrador, inventario por presas y mermas justificadas.
* **Continuidad:** salón, cocina y caja siguen funcionando por red local ante caídas de internet; el UPS evita apagones del equipo de caja.

### 2.4. Objetivos y metas
Los objetivos del software se alinean con el objetivo del negocio de **aumentar la rotación de mesas y reducir pérdidas**, que sustenta el beneficio anual estimado de S/ 80,000.00 del estudio de factibilidad.

| Objetivo del software | Indicador | Línea base | Meta (primer mes de operación) |
| :--- | :--- | :---: | :---: |
| Acelerar el inicio de atención | Tiempo desde que el cliente se sienta hasta que ve la carta | ~5 min | ≤ 30 s |
| Eliminar pérdidas de comandas | Comandas perdidas o no vistas por el pollero | Varias por noche | 0 |
| Eliminar errores de presa | Platos devueltos por presa equivocada | ≥ 1 por noche | 0 |
| Agilizar el cobro | Tiempo de cobro de una cuenta en caja | ~5 min | ≤ 1 min |
| Agilizar el cierre | Tiempo de cierre de caja diario | ~60 min | ≤ 10 min |
| Asegurar continuidad | Minutos sin poder cobrar por cortes de luz/internet | ~15 min por evento | 0 |
| Controlar mermas | Mermas registradas con motivo y autorización | 0 % | 100 % |

### 2.5. Fuera del alcance (versión 2.0)
* Integración automática por API con PedidosYa o Rappi (sus ventas se registran manualmente en el sistema).
* Tienda en línea pública para pedidos web de delivery (los pedidos por WhatsApp o teléfono los registra la caja).
* Aplicación nativa (App Store / Google Play); todas las interfaces son web/PWA.
* Contabilidad completa, planillas, compras a proveedores e inventario de insumos distintos al pollo.
* Programa de fidelización y portal cautivo de marketing en el WiFi de clientes.
* Integración con el terminal POS bancario (el pago con tarjeta física se registra con su número de operación).
* Seguimiento GPS de repartidores.

### 2.6. Documentos de referencia
* `requerimientos/informe_tecnicas_recoleccion_datos.md` – Entrevista y observación directa.
* `requerimientos/casos_de_uso_y_escenarios_de_pedidos.md` – 16 escenarios reales de pedidos.
* `requerimientos/documento_de_requerimientos_v3.md` – Arquitectura, stack tecnológico y topología del local.
* `requerimientos/plan_de_inversion_y_equipamiento.md` – Hardware (CapEx ~S/ 5,100) y servicios (OpEx ~S/ 294/mes).
* `requerimientos/estudio_de_factibilidad_y_gantt.md` – Costos, VAN, TIR y cronograma.

## 3. Funcionalidades del producto

1. **F-01 Acceso seguro y gestión de usuarios:** ingreso del personal por usuario y PIN, roles y permisos, autorización con PIN de administrador.
2. **F-02 Administración de carta, precios y modificadores:** categorías, productos, presas, guarniciones, cremas, recargos, combos y destino de impresión configurables.
3. **F-03 Gestión gráfica del salón y mesas:** mapa de las 10 mesas con estados por color, transferencia, fusión y bloqueo de edición simultánea.
4. **F-04 Carta digital y autoservicio por código QR:** el comensal consulta la carta, arma su pedido con modificadores obligatorios, llama al mozo y pide la cuenta desde su celular.
5. **F-05 Toma de pedidos móvil para mozos:** registro de pedidos en tablet, re-pedidos, confirmación de pedidos QR y correcciones.
6. **F-06 Enrutamiento e impresión de comandas con alarma sonora:** ticket legible en la estación del pollero con buzzer, tickets de corrección y reposición, cola ante fallas.
7. **F-07 Control de productos agotados (Protocolo 86):** deshabilitación inmediata en todos los dispositivos, manual o automática por stock de presas.
8. **F-08 Cobro en caja y medios de pago:** precuenta, efectivo con vuelto, Yape/Plin/tarjeta, pago mixto, división de cuenta y apertura de gaveta.
9. **F-09 Pago en mesa desde el celular:** liquidación de la cuenta por pasarela de pagos sin acudir a caja.
10. **F-10 Comprobantes electrónicos y entrega digital:** boletas, facturas y notas de crédito SUNAT con autocompletado DNI/RUC y envío por WhatsApp/correo.
11. **F-11 Turnos de caja y arqueo ciego:** apertura, movimientos de efectivo, cierre a ciegas, Reporte X y Reporte Z.
12. **F-12 Pedidos para llevar, programados y delivery:** rotulado por número y nombre, liberación diferida, hoja de ruta con vuelto, estados de despacho y liquidación de repartidores.
13. **F-13 Inventario de pollos, mermas y anulaciones:** kardex por fracción y por presa, mermas justificadas, reposiciones y anulaciones auditadas.
14. **F-14 Reportes y auditoría:** ventas, productos, tiempos de atención, mermas, anulaciones y bitácora de acciones.
15. **F-15 Operación sin internet y sincronización:** funcionamiento en red local, colas de envío y sincronización segura con la nube.

## 4. Clases y características de usuarios

| Clase de usuario | Características | Dispositivo | Frecuencia de uso | Funcionalidades relevantes |
| :--- | :--- | :--- | :--- | :--- |
| **Comensal** | Usuario externo, sin registro ni capacitación; cualquier edad y nivel digital. | Su propio smartphone (navegador). | Ocasional, durante su visita. | F-04, F-09, F-10 (recibir comprobante). |
| **Mozo** | Personal de salón; trabaja de pie, con prisa y a veces con una sola mano libre. Nivel digital básico. | Tablet Android del local. | Intensiva durante todo el turno. | F-03, F-05, F-07 (consulta), F-08 (precuenta). |
| **Maestro pollero** | Trabaja con calor, humo y grasa; no manipula pantallas. | Ticketera con buzzer en su estación. | Continua (solo recibe). | F-06 (receptor), F-07 (avisa agotados a caja). |
| **Cajero(a)** | Responsable del dinero y comprobantes; nivel digital intermedio. Usuario más intensivo del sistema. | Terminal táctil All-in-One de caja. | Permanente toda la jornada. | F-03, F-05, F-07, F-08, F-10, F-11, F-12, F-13 (solicita). |
| **Repartidor** | Motorizado propio; consulta direcciones y montos a cobrar. | Hoja de ruta impresa (opcional: celular). | Por cada despacho. | F-12. |
| **Administrador (dueño)** | Máxima autoridad; configura, autoriza con PIN y supervisa. Usuario ocasional pero con todos los privilegios. | PC de caja, laptop o celular. | Diaria (supervisión y cierre). | Todas (F-01 a F-15). |

**Matriz de permisos por rol** (✔ = permitido, PIN = requiere PIN del administrador, — = no permitido):

| Acción | Comensal | Mozo | Cajero | Administrador |
| :--- | :---: | :---: | :---: | :---: |
| Ver carta y hacer pedido de su mesa | ✔ | ✔ | ✔ | ✔ |
| Confirmar pedidos QR y transferir/fusionar mesas | — | ✔ | ✔ | ✔ |
| Marcar producto agotado | — | — | ✔ | ✔ |
| Cobrar, dividir cuenta y emitir comprobantes | Solo su mesa (F-09) | — | ✔ | ✔ |
| Anular ítem ya enviado a cocina, registrar merma o fuga | — | PIN | PIN | ✔ |
| Emitir nota de crédito | — | — | PIN | ✔ |
| Abrir y cerrar turno de caja | — | — | ✔ | ✔ |
| Ver total teórico del turno antes del arqueo | — | — | — | ✔ |
| Configurar carta, precios, usuarios y parámetros | — | — | — | ✔ |
| Ver reportes y bitácora | — | — | Solo su turno | ✔ |

## 5. Entorno operativo

### 5.1. Entorno físico
Local de un solo piso en Puerto Maldonado (clima cálido y húmedo, cortes eléctricos frecuentes de corta duración). Zonas: salón con 10 mesas (M-01 a M-10), mostrador de caja con conservadora de bebidas, estación central del maestro pollero (horno de brasas, tina de papas, ensaladas y cremas) y cocina interna de fondo. Horario de referencia: 12:00 – 23:00 horas, todos los días.

### 5.2. Plataforma de hardware

| Componente | Especificación mínima | Ubicación |
| :--- | :--- | :--- |
| Servidor local (Edge Gateway) | Mini PC Intel N100, 16 GB RAM, SSD 512 GB, Linux (Ubuntu Server 24.04 LTS) con Docker. | Caja, conectado por cable al router y al UPS. |
| Terminal de caja | All-in-One táctil 15.6", Windows 11 o Linux, Google Chrome actualizado. | Mostrador de caja. |
| Ticketera de producción | Térmica 80 mm, ESC/POS, Ethernet, buzzer ≥ 85 dB, gabinete protector contra grasa. | Estación del maestro pollero. |
| Ticketera de caja | Térmica 80 mm, ESC/POS, USB o Ethernet, con puerto RJ11 para gaveta. | Mostrador de caja. |
| Gaveta de dinero | Metálica, apertura por pulso eléctrico RJ11. | Mostrador de caja. |
| Tablets de mozos | Android 12 o superior, 8.7", funda anticaídas, Chrome actualizado (1 incluida en la inversión; se admite una segunda tablet o smartphone del local). | Salón. |
| Celulares de comensales | Android 9+ o iOS 15+, Chrome/Safari en sus dos últimas versiones, lector QR de la cámara. | Salón. |
| Red | Router Dual-WAN (fibra + 4G de contingencia), Access Point WiFi 6, cableado Cat6 a cocina y caja. | Todo el local. |
| Energía | UPS 1200 VA (autonomía 30–45 min) para Mini PC, router, AP y terminal de caja. | Caja. |

### 5.3. Plataforma de software

| Capa | Tecnología |
| :--- | :--- |
| Frontend (carta QR, mozos, caja, administración) | Next.js + React + TypeScript; carta QR como PWA; Tailwind CSS + shadcn/ui; Zustand y TanStack Query. |
| Backend | Node.js LTS + NestJS (TypeScript); API REST y WebSockets (Socket.IO). |
| Base de datos | PostgreSQL 16 (nube y servidor local) con Prisma ORM. |
| Colas y caché | Redis + BullMQ (impresión, comprobantes, mensajes, pedidos programados). |
| Agente de impresión | Servicio ESC/POS en el servidor Edge (TCP 9100 y USB). |
| Nube | VPS Linux con Docker, HTTPS y copias de seguridad diarias. |

### 5.4. Arquitectura de despliegue

```
   CELULARES COMENSALES ──(WiFi Clientes / Internet)──┐
                                                       ▼
 ┌──────────────── LOCAL (LAN – VLAN Operaciones) ────────────────┐      ┌──────── NUBE ────────┐
 │ Tablets mozos ─┐                                                │      │ API NestJS           │
 │ PC de caja ────┼──► SERVIDOR EDGE (API local + PostgreSQL       │◄────►│ PostgreSQL 16        │
 │                │    + Redis + agente ESC/POS) ── UPS            │ sync │ Redis / BullMQ       │
 │                │        │ TCP 9100            │ USB             │      └──────────┬───────────┘
 │                │        ▼                     ▼                 │                 │
 │                │   Ticketera pollero    Ticketera caja + gaveta │     Nubefact · Culqi/Izipay ·
 └────────────────┴────────────────────────────────────────────────┘     ApisPeru · WhatsApp · SMTP
```

El servidor Edge es la fuente de verdad durante la operación del local; la nube recibe los datos sincronizados, atiende la carta QR cuando el comensal usa datos móviles y se comunica con los servicios externos.

### 5.5. Supuestos y dependencias
* El local cuenta con internet de fibra óptica y una línea 4G de contingencia.
* El propietario contrata y mantiene vigentes: proveedor de facturación electrónica (PSE/OSE, p. ej. Nubefact), pasarela de pagos (Culqi o Izipay), API de consulta DNI/RUC (ApisPeru), cuenta de WhatsApp Business Cloud API, dominio y VPS.
* El negocio cuenta con RUC activo y habido, y con series de comprobantes electrónicos autorizadas por SUNAT.
* La carta y los precios iniciales son los de la entrevista (Anexo B) y podrán cambiarse sin programación.
* El personal recibirá la capacitación programada en la fase 6 del cronograma.

## 6. Requerimientos funcionales

### 6.1. F-01 Acceso seguro y gestión de usuarios
* **Descripción:** Controla quién usa el sistema y qué puede hacer, de modo que cada pedido, cobro y anulación quede asociado a una persona.
* **Prioridad:** Alta.
* **Acciones iniciadoras y comportamiento esperado:**
  1. El trabajador abre el sistema en su dispositivo y elige su nombre en la lista de usuarios activos.
  2. Ingresa su PIN personal; el sistema valida y muestra solo las pantallas de su rol.
  3. Cuando una acción requiere autorización (anulación, merma, nota de crédito), el sistema muestra un cuadro para el PIN del administrador sin cerrar la sesión del trabajador.
  4. El administrador crea, edita o desactiva usuarios desde el panel de administración.
* **Requerimientos funcionales:**
  * **REQ-USR-01:** El sistema debe autenticar al personal mediante usuario y PIN numérico de 4 a 6 dígitos; el administrador debe usar además una contraseña de al menos 8 caracteres para ingresar al panel de administración.
  * **REQ-USR-02:** El sistema debe manejar los roles Mozo, Cajero, Repartidor y Administrador, y mostrar u ocultar opciones según la matriz de permisos de la sección 4.
  * **REQ-USR-03:** El sistema debe solicitar el PIN del administrador para las acciones protegidas definidas en RN-04, registrando quién la solicitó, quién la autorizó, el motivo y la fecha y hora.
  * **REQ-USR-04:** El administrador debe poder crear usuarios, asignarles un rol, restablecer su PIN y desactivarlos; un usuario desactivado no se elimina para conservar su historial.
  * **REQ-USR-05:** El sistema debe permitir el cambio rápido de usuario en el terminal de caja sin cerrar el turno abierto.
* **Respuesta ante errores y entradas inválidas:**
  * PIN incorrecto: mensaje *"PIN incorrecto"* sin indicar si el usuario existe. Tras 5 intentos fallidos, el usuario se bloquea 5 minutos y se registra el evento en la bitácora.
  * Acción no permitida para el rol: el botón no se muestra; si se intenta por URL directa, el sistema responde *"No tiene permisos para esta operación"*.
  * Sesión inactiva por más de 15 minutos en caja o administración: el sistema solicita nuevamente el PIN.

### 6.2. F-02 Administración de carta, precios y modificadores
* **Descripción:** Permite al dueño mantener la carta sin programar: productos, precios, presas, guarniciones, cremas, combos y a qué impresora va cada producto.
* **Prioridad:** Alta.
* **Acciones iniciadoras y comportamiento esperado:**
  1. El administrador ingresa a *Carta* y crea o edita categorías (pollos, mostritos, porciones, extras, bebidas).
  2. Registra un producto con nombre, foto, descripción, precio, fracción de pollo que consume y destino de impresión.
  3. Asocia grupos de modificadores (por ejemplo, *Presa*: obligatorio, elegir 1) con sus opciones, recargos y efecto en inventario.
  4. Guarda; los cambios se publican al instante en la carta QR, en las tablets y en la caja.
* **Requerimientos funcionales:**
  * **REQ-CAT-01:** El sistema debe permitir registrar, modificar, ordenar y desactivar categorías y productos, con nombre, descripción, foto, precio en soles y estado activo/inactivo.
  * **REQ-CAT-02:** El sistema debe permitir definir grupos de modificadores **obligatorios u opcionales**, con cantidad mínima y máxima de opciones, recargo por opción (por ejemplo, *1/2 pollo 2 pechos: +S/ 2.00*) y efecto en inventario (presas, papas o ensalada).
  * **REQ-CAT-03:** El sistema debe permitir definir **productos compuestos** (por ejemplo, *Mostrito 1/4* = 1/4 de pollo + arroz chaufa + papas) que descuenten del inventario cada uno de sus componentes.
  * **REQ-CAT-04:** El sistema debe registrar para cada producto la fracción de pollo que consume (0, 1/8, 1/4, 1/2 o 1) y las presas que implica cada opción de corte.
  * **REQ-CAT-05:** El sistema debe permitir asignar a cada producto un **destino de impresión** (estación del pollero, caja/bebidas o cocina interna opcional).
  * **REQ-CAT-06:** El sistema debe permitir precios diferenciados por canal (salón, para llevar, delivery propio y aplicaciones externas) y productos visibles solo en ciertos canales (por ejemplo, *Pote de ají extra S/ 1.50* solo para llevar y delivery).
  * **REQ-CAT-07:** Al cambiar un precio, el sistema debe conservar el precio con el que se registró cada pedido anterior y guardar el historial de cambios con usuario y fecha.
* **Respuesta ante errores y entradas inválidas:**
  * Precio vacío, negativo o con más de dos decimales: *"Ingrese un precio válido mayor o igual a S/ 0.00"*.
  * Grupo obligatorio sin opciones: no se permite guardar el producto.
  * Intento de eliminar un producto con ventas registradas: el sistema solo permite desactivarlo.
  * Foto mayor a 2 MB o en formato distinto de JPG/PNG/WebP: *"La imagen debe ser JPG, PNG o WebP de hasta 2 MB"*; el sistema comprime automáticamente las imágenes aceptadas.

### 6.3. F-03 Gestión gráfica del salón y mesas
* **Descripción:** Muestra en una sola pantalla las 10 mesas del local con su estado en tiempo real y permite operar sobre ellas.
* **Prioridad:** Alta.
* **Acciones iniciadoras y comportamiento esperado:**
  1. El mozo o cajero abre *Salón* y ve el plano con las mesas M-01 a M-10 coloreadas según su estado.
  2. Toca una mesa libre para abrirla, o una ocupada para ver su cuenta, agregar productos, transferirla o fusionarla.
  3. Cuando la cuenta se paga, la mesa pasa a *Por limpiar*; el mozo la marca como libre al terminar de limpiarla.
* **Requerimientos funcionales:**
  * **REQ-SAL-01:** El sistema debe mostrar el plano del salón con cada mesa en uno de estos estados: **Libre** (verde), **Pedido QR por confirmar** (amarillo), **Ocupada** (rojo), **Cuenta solicitada** (azul) y **Por limpiar** (gris), indicando además el tiempo transcurrido desde que se abrió y el monto acumulado.
  * **REQ-SAL-02:** Todo cambio de estado debe reflejarse en todos los dispositivos conectados en un máximo de 2 segundos, sin recargar la página.
  * **REQ-SAL-03:** El sistema debe permitir **transferir** la cuenta completa de una mesa a otra mesa libre en una sola acción, conservando pedidos, tiempos y mozo asignado.
  * **REQ-SAL-04:** El sistema debe permitir **fusionar** dos o más mesas ocupadas en una cuenta maestra y **separarlas** nuevamente mientras no se haya cobrado ningún ítem.
  * **REQ-SAL-05:** El sistema debe **bloquear la edición simultánea** de una mesa: mientras un usuario la edita, los demás solo pueden consultarla.
  * **REQ-SAL-06:** El administrador debe poder configurar la cantidad, el nombre y la ubicación de las mesas en el plano sin programación.
* **Respuesta ante errores y entradas inválidas:**
  * Mesa en edición por otro usuario: *"La mesa M-04 está siendo editada por Juan. Intente en unos segundos"*. El bloqueo se libera solo tras 60 segundos de inactividad.
  * Transferencia a una mesa ocupada: el sistema ofrece fusionar en lugar de transferir.
  * Separar mesas con ítems ya cobrados: *"No se puede separar: la cuenta tiene pagos registrados"*.

### 6.4. F-04 Carta digital y autoservicio por código QR
* **Descripción:** Aplicación web (PWA) que el comensal abre al escanear el QR de su mesa, sin instalar nada, para ver la carta, pedir, llamar al mozo y pedir la cuenta.
* **Prioridad:** Alta.
* **Acciones iniciadoras y comportamiento esperado:**
  1. El comensal escanea el QR del parante acrílico de su mesa; el sistema abre la carta de esa mesa.
  2. Navega por categorías con fotos y precios; al elegir un producto, el sistema muestra sus modificadores (presa, papas, ensalada, cremas, notas).
  3. Agrega productos al carrito, revisa el total y pulsa *Enviar pedido*.
  4. El primer pedido de cada celular queda *Por confirmar* hasta que el mozo lo valida con un toque; los pedidos siguientes del mismo celular van directo a cocina.
  5. En cualquier momento puede pulsar *Llamar al mozo* o *Pedir la cuenta*, y ver su precuenta.
* **Requerimientos funcionales:**
  * **REQ-QR-01:** Cada mesa debe tener un QR permanente; al escanearlo, el sistema debe crear o unir al celular a la **sesión de mesa** activa mediante un token que expira cuando la mesa se libera, de modo que un QR fotografiado no sirva para pedir después.
  * **REQ-QR-02:** El primer pedido de cada dispositivo en una sesión debe quedar en estado *Por confirmar* hasta que un mozo o cajero lo valide; el administrador puede configurar que todos los pedidos QR requieran confirmación.
  * **REQ-QR-03:** El sistema debe mostrar la carta organizada por categorías, con foto, descripción, precio vigente del canal salón e indicador visual de productos agotados.
  * **REQ-QR-04:** El sistema **no debe permitir** agregar al carrito un producto sin completar sus modificadores obligatorios; en el 1/8 y el 1/4 de pollo (y sus mostritos) debe exigir *Pecho con ala* o *Pierna con encuentro*.
  * **REQ-QR-05:** El sistema debe ofrecer opciones de preparación: tipo de papas (*Normales*, *Bien doradas*, *Sin sal*), ensalada (*Clásica*, *Cocida*, *Sin ensalada → más papas*, *Sin papas → más ensalada*), cremas (selección múltiple) y una nota libre de hasta 100 caracteres por ítem.
  * **REQ-QR-06:** El sistema debe ofrecer los botones *Llamar al mozo* y *Pedir la cuenta*, que generan una alerta sonora y visual en las tablets con el número de mesa y el motivo.
  * **REQ-QR-07:** Cuando haya más de 12 pedidos pendientes en la estación del pollero (umbral configurable), la carta debe mostrar el aviso *"Tiempo estimado de preparación: 25 a 35 min"*.
  * **REQ-QR-08:** La carta debe permitir ver la precuenta de la mesa en tiempo real y mostrar en su pie el enlace al **Libro de Reclamaciones virtual**.
* **Respuesta ante errores y entradas inválidas:**
  * Mesa libre sin sesión o token vencido: *"Esta mesa no tiene una atención activa. Solicite ayuda al mozo"*, con el botón de llamado habilitado.
  * Producto agotado mientras estaba en el carrito: al enviar, el sistema lo retira y avisa *"El 1/4 Pierna se agotó hace un momento. Le sugerimos 1/4 Pecho"*; el resto del pedido no se pierde.
  * Pérdida de conexión: el carrito se conserva en el celular y se reintenta el envío; el pedido nunca se registra dos veces.
  * Pedido *Por confirmar* sin atención en 3 minutos: se repite la alerta en tablets y aparece en la pantalla de caja.

### 6.5. F-05 Toma de pedidos móvil para mozos
* **Descripción:** Interfaz táctil para que el mozo tome pedidos al lado de la mesa cuando el cliente prefiere la atención tradicional, y para gestionar los pedidos QR.
* **Prioridad:** Alta.
* **Acciones iniciadoras y comportamiento esperado:**
  1. El mozo toca una mesa en el plano y elige categoría y producto con botones grandes.
  2. Completa los modificadores obligatorios, agrega notas rápidas (*"vinagreta aparte"*, *"retirar pellejo"*) y pulsa *Comandar*.
  3. El sistema guarda el pedido, lo envía a impresión y la mesa pasa a *Ocupada*.
  4. Para re-pedidos (bebida, porción extra) repite el proceso; solo se imprime lo nuevo.
* **Requerimientos funcionales:**
  * **REQ-MOZ-01:** La interfaz debe permitir registrar un pedido completo usando solo toques (sin teclado físico), con áreas táctiles de al menos 48 × 48 px y notas rápidas predefinidas.
  * **REQ-MOZ-02:** El sistema debe aplicar en la tablet las mismas validaciones de modificadores obligatorios que en la carta QR (REQ-QR-04).
  * **REQ-MOZ-03:** El sistema debe permitir agregar productos a una cuenta abierta en cualquier momento; cada envío se registra como una **ronda** con su hora y solo se imprimen los ítems nuevos.
  * **REQ-MOZ-04:** El mozo debe poder confirmar o rechazar con un toque los pedidos QR *Por confirmar* de sus mesas, y marcar como atendidas las alertas de llamado.
  * **REQ-MOZ-05:** El mozo debe poder modificar o quitar ítems aún no impresos; si el ítem ya fue impreso, puede cambiar sus modificadores (por ejemplo, pierna por pecho) dentro de los 2 minutos siguientes a la impresión, lo que genera un ticket de corrección. Pasado ese plazo, o para anular un ítem, se requiere PIN del administrador (RN-04).
  * **REQ-MOZ-06:** El sistema debe imprimir la precuenta de una mesa en la ticketera de caja a solicitud del mozo.
* **Respuesta ante errores y entradas inválidas:**
  * Corte momentáneo del WiFi: el pedido queda guardado en la tablet con el aviso *"Sin conexión – se enviará automáticamente"* y se reenvía al reconectar, con un identificador único que evita duplicados.
  * Intento de comandar sin modificador obligatorio: el sistema resalta en rojo el grupo faltante y no envía.
  * Intento de comandar una mesa bloqueada por otro usuario: se aplica la respuesta de REQ-SAL-05.

### 6.6. F-06 Enrutamiento e impresión de comandas con alarma sonora
* **Descripción:** Envía cada pedido confirmado a la impresora que corresponde y avisa al maestro pollero con una alarma audible sobre el ruido del extractor.
* **Prioridad:** Alta.
* **Acciones iniciadoras y comportamiento esperado:**
  1. Un pedido se confirma (desde la tablet, la caja, un pedido QR validado o un pedido prepagado).
  2. El sistema separa los ítems por destino de impresión: pollos, guarniciones y mostritos a la estación del pollero; bebidas a la ticketera de caja.
  3. La ticketera del pollero activa el buzzer e imprime la comanda en letra grande.
  4. El pollero arma el plato o el paquete; el mozo (o la caja, en pedidos para llevar) marca el pedido como *Servido* o *Listo*.
* **Requerimientos funcionales:**
  * **REQ-COC-01:** El sistema debe enviar cada ítem a la impresora configurada como su destino (REQ-CAT-05), emitiendo un solo ticket por destino y por ronda.
  * **REQ-COC-02:** La comanda debe imprimir en doble tamaño el origen (*MESA M-04*, *PARA LLEVAR #18 – Carlos*, *DELIVERY #D-05* o *APP #PY-9421*) y luego: número de orden y ronda, hora, mozo o cajero, cantidad y producto, **presa en mayúsculas**, papas, ensalada, cremas y notas. Las instrucciones críticas (por ejemplo, *CORTAR EN 8 PRESAS*, *SIN SAL*) deben ir resaltadas.
  * **REQ-COC-03:** Cada ticket nuevo debe activar el buzzer de la ticketera de producción; los tickets de corrección, anulación y reposición deben usar un patrón de alarma distinto (doble pitido).
  * **REQ-COC-04:** El sistema debe imprimir tickets especiales rotulados **RE-ORDEN**, **CORRECCIÓN** (indicando qué se anula y qué se cambia), **ANULACIÓN** y **REPOSICIÓN – SIN COSTO**.
  * **REQ-COC-05:** Los trabajos de impresión deben guardarse en una cola persistente en el servidor local; si la impresora falla, el sistema debe reintentar cada 10 segundos e imprimir en orden de llegada al restablecerse.
  * **REQ-COC-06:** El cajero debe poder reimprimir una comanda; la copia se imprime con la marca **REIMPRESIÓN** y queda registrada.
  * **REQ-COC-07:** El sistema debe registrar para cada pedido la hora de registro, de confirmación, de impresión y de servido/listo, para medir tiempos de atención (F-14).
* **Respuesta ante errores y entradas inválidas:**
  * Impresora sin papel, tapa abierta o desconectada: alerta roja persistente en la caja *"Impresora del pollero sin conexión – 3 comandas en espera"* y aviso en las tablets; los pedidos no se pierden.
  * Falla prolongada (más de 2 minutos): el sistema permite redirigir la cola a la ticketera de caja.
  * Pedido con más de 15 minutos sin marcarse como servido: el sistema lo resalta en la pantalla de caja.

### 6.7. F-07 Control de productos agotados (Protocolo 86)
* **Descripción:** Retira de inmediato de la venta un producto o una opción (por ejemplo, *Pierna*) que se terminó, en todos los dispositivos.
* **Prioridad:** Media.
* **Acciones iniciadoras y comportamiento esperado:**
  1. El pollero avisa a caja que se acabaron las piernas, o el inventario de piernas llega a cero (F-13).
  2. El cajero pulsa el interruptor *Agotado* del producto o de la opción; o el sistema lo hace automáticamente.
  3. En menos de 2 segundos el ítem aparece en gris y no seleccionable en la carta QR y en las tablets.
* **Requerimientos funcionales:**
  * **REQ-AGO-01:** El sistema debe permitir marcar y desmarcar como agotado un producto completo o una opción de modificador con un solo toque desde la caja o la administración.
  * **REQ-AGO-02:** El cambio debe propagarse a todos los dispositivos en un máximo de 2 segundos; los ítems agotados se muestran atenuados con la etiqueta *Agotado* y no pueden seleccionarse.
  * **REQ-AGO-03:** Cuando el stock disponible de una presa (pecho o pierna) llegue al umbral configurado, el sistema debe marcar la opción como agotada automáticamente y notificar a caja y mozos.
  * **REQ-AGO-04:** El servidor debe volver a validar la disponibilidad de cada ítem al confirmar un pedido, sin depender de lo que muestre el dispositivo.
  * **REQ-AGO-05:** El sistema debe sugerir un sustituto configurado (por ejemplo, *"Solo tenemos Pecho con ala, ¿desea continuar?"*).
* **Respuesta ante errores y entradas inválidas:**
  * Pedido que incluye un ítem agotado: se aplica la respuesta de F-04 (retiro del ítem y sugerencia) sin descartar el resto del pedido.
  * Intento de reactivar una presa con stock cero: el sistema advierte *"El inventario registra 0 piernas. ¿Registrar ingreso de pollos?"*.

### 6.8. F-08 Cobro en caja y medios de pago
* **Descripción:** Liquida las cuentas de mesas, pedidos para llevar y delivery con cualquier combinación de medios de pago.
* **Prioridad:** Alta.
* **Acciones iniciadoras y comportamiento esperado:**
  1. El cliente dice en caja *"Mesa 4"*; el cajero la selecciona y ve el detalle consolidado de todas las rondas.
  2. Si piden cuentas separadas, pulsa *Dividir cuenta* y elige el modo de división.
  3. Registra una o más líneas de pago (efectivo, Yape, Plin, tarjeta) hasta que el saldo sea S/ 0.00.
  4. Elige el comprobante (F-10); si hubo efectivo, la gaveta se abre y el sistema muestra el vuelto.
  5. La mesa pasa a *Por limpiar* y el mozo recibe el aviso.
* **Requerimientos funcionales:**
  * **REQ-CAJ-01:** El sistema debe mostrar el detalle consolidado de la cuenta (todas las rondas, recargos y anulaciones) e imprimir la **precuenta** con la leyenda *"Precuenta – No válida como comprobante de pago"*.
  * **REQ-CAJ-02:** Para pagos en efectivo, el sistema debe calcular el vuelto a partir del monto recibido y ofrecer botones rápidos (*Exacto*, S/ 10, 20, 50, 100, 200).
  * **REQ-CAJ-03:** Para Yape y Plin, el sistema debe permitir: (a) el cobro mediante la pasarela con **código de aprobación**, confirmado automáticamente; o (b) el registro manual con el **número de operación** obligatorio. Para tarjeta, el cajero registra el tipo (débito/crédito) y el número de operación del POS bancario.
  * **REQ-CAJ-04:** El sistema debe aceptar **pagos mixtos** (varias líneas de pago con distintos medios) y habilitar la emisión del comprobante solo cuando el saldo pendiente sea S/ 0.00.
  * **REQ-CAJ-05:** El sistema debe permitir **dividir la cuenta** por ítems consumidos, en partes iguales o por montos; cada parte se cobra con su propio medio y genera su propio comprobante. La suma de las partes debe ser exactamente el total; la diferencia de céntimos por redondeo se asigna a la última parte.
  * **REQ-CAJ-06:** El sistema debe enviar el pulso de apertura a la gaveta solo cuando el cobro incluya efectivo; la apertura manual sin venta requiere PIN del administrador y queda registrada.
  * **REQ-CAJ-07:** Los descuentos y cortesías, por ítem o sobre el total, requieren PIN del administrador y un motivo.
* **Respuesta ante errores y entradas inválidas:**
  * Monto recibido menor al saldo: *"Falta S/ 4.50 para completar el pago"* y no se cierra la venta.
  * Número de operación Yape/Plin ya registrado en otra venta: *"Este número de operación ya fue usado en la venta B001-000245"* y se bloquea el registro (evita el reuso de capturas de pantalla).
  * Pago rechazado por la pasarela: se muestra el motivo y la cuenta sigue abierta.
  * Intento de cobrar una mesa que el comensal está pagando desde su celular: *"Pago en línea en curso"* hasta que termine o expire (F-09).

### 6.9. F-09 Pago en mesa desde el celular
* **Descripción:** Permite al comensal pagar su cuenta desde la carta QR con Yape, Plin o tarjeta mediante una pasarela autorizada, sin ir a caja.
* **Prioridad:** Media.
* **Acciones iniciadoras y comportamiento esperado:**
  1. El comensal pulsa *Pagar cuenta*, revisa el detalle y el total.
  2. Elige el comprobante (boleta o factura) y el canal de entrega (WhatsApp o correo).
  3. Paga en el formulario seguro de la pasarela (Culqi o Izipay).
  4. La pasarela notifica al servidor; el sistema confirma el pago, emite el comprobante, lo envía y avisa al mozo y a caja.
* **Requerimientos funcionales:**
  * **REQ-PAG-01:** El sistema debe permitir al comensal pagar el total de su mesa desde la carta QR mediante el formulario embebido de la pasarela (Yape con código de aprobación, Plin y tarjetas).
  * **REQ-PAG-02:** El sistema debe dar por pagada una cuenta **solo** cuando reciba la notificación (webhook) de la pasarela con firma HMAC válida; la redirección del navegador no es prueba de pago.
  * **REQ-PAG-03:** Mientras un pago en línea está en curso, la cuenta debe quedar bloqueada para nuevos ítems y para el cobro en caja durante un máximo de 10 minutos.
  * **REQ-PAG-04:** Confirmado el pago, la mesa debe pasar a *Por limpiar* y el sistema debe alertar visualmente en la tablet del mozo y en la caja.
  * **REQ-PAG-05:** El administrador puede activar la **modalidad prepago QR**: el comensal paga al enviar su pedido y este va directo a cocina sin confirmación del mozo.
  * **REQ-PAG-06:** El sistema no debe almacenar números de tarjeta ni códigos de aprobación; solo guarda el identificador de la transacción que devuelve la pasarela.
* **Respuesta ante errores y entradas inválidas:**
  * Pago rechazado: *"Su pago no fue aprobado: <motivo de la pasarela>. Puede intentar otro medio o pagar en caja"*; la cuenta sigue abierta.
  * Confirmación demorada: el celular muestra *"Verificando pago…"* hasta 2 minutos; si no llega, la caja ve la transacción como *Pendiente de verificación*.
  * Webhook duplicado o con firma inválida: se ignora y se registra en la bitácora; nunca se cobra dos veces.
  * Sin internet en el local: la opción se oculta y se muestra *"Pago en línea no disponible. Solicite la cuenta al mozo"*.

### 6.10. F-10 Comprobantes electrónicos y entrega digital
* **Descripción:** Emite boletas, facturas y notas de crédito electrónicas válidas ante SUNAT a través del proveedor PSE/OSE, y las entrega impresas o por canales digitales.
* **Prioridad:** Alta.
* **Acciones iniciadoras y comportamiento esperado:**
  1. Al completar un cobro, el sistema pregunta el tipo de comprobante: boleta (con o sin DNI) o factura (con RUC).
  2. El cajero o el comensal ingresa el DNI/RUC; el sistema autocompleta nombre o razón social y dirección.
  3. El sistema calcula los impuestos, envía el comprobante al PSE/OSE y recibe la constancia (CDR).
  4. Entrega el comprobante según la elección del cliente: impreso con QR tributario, por WhatsApp, por correo o mediante un QR de descarga en pantalla.
* **Requerimientos funcionales:**
  * **REQ-FAC-01:** El sistema debe emitir **Boleta de venta electrónica**, **Factura electrónica** y **Nota de crédito electrónica**, con series y correlativos configurables (por ejemplo, B001, F001, BC01, FC01).
  * **REQ-FAC-02:** El sistema debe consultar en línea el DNI (8 dígitos) o el RUC (11 dígitos) y autocompletar nombres, razón social, dirección fiscal, estado y condición del contribuyente, advirtiendo si el RUC no está *Activo* o *Habido*.
  * **REQ-FAC-03:** El sistema debe exigir DNI (u otro documento de identidad) en boletas cuyo importe supere S/ 700.00 y RUC en toda factura; las boletas de menor importe pueden emitirse como *Clientes varios*.
  * **REQ-FAC-04:** El sistema debe calcular la base imponible y los impuestos a partir de precios con impuestos incluidos, usando la **tasa configurada** (tasa general de 18 % o tasa especial para MYPE de restaurantes de la Ley 31556 y modificatorias, 10.5 % en 2026), y el ICBPER por cada bolsa plástica entregada en pedidos para llevar o delivery.
  * **REQ-FAC-05:** El sistema debe almacenar por cada comprobante el XML, el PDF, el código hash, el estado del CDR y el código QR tributario, e imprimirlos en formato de ticket de 80 mm.
  * **REQ-FAC-06:** El sistema debe enviar el PDF del comprobante al WhatsApp o correo indicado por el cliente y mostrar un QR de descarga, sin necesidad de imprimir.
  * **REQ-FAC-07:** La anulación total o parcial de una venta ya comprobada debe hacerse mediante **nota de crédito** vinculada al comprobante original, con su motivo según el catálogo SUNAT y PIN del administrador.
  * **REQ-FAC-08:** Si no hay conexión con el PSE/OSE, el sistema debe registrar la venta, reservar la serie y número, entregar una constancia de venta y encolar el comprobante para enviarlo y entregarlo digitalmente al restablecerse la conexión, dentro del plazo legal. Si la caída supera el umbral configurado, debe permitir registrar los comprobantes de contingencia físicos emitidos.
  * **REQ-FAC-09:** El sistema debe acumular las ventas de hasta S/ 5.00 en las que el cliente no solicitó comprobante y emitir al cierre del día la boleta resumen correspondiente.
* **Respuesta ante errores y entradas inválidas:**
  * DNI que no tiene 8 dígitos o RUC que no tiene 11 dígitos o no empieza en 10, 15, 17 o 20: *"Número de documento inválido"* antes de consultar.
  * Servicio DNI/RUC sin respuesta en 5 segundos: se habilita el ingreso manual de los datos.
  * Comprobante rechazado por el OSE: se muestra el código y el mensaje de error, la venta queda *Observada* y se avisa al administrador para su corrección.
  * Número de WhatsApp con formato inválido (distinto de 9 dígitos que empiecen en 9) o correo inválido: se pide corregir; si el envío falla, se reintenta automáticamente hasta 3 veces y se ofrece imprimir.

### 6.11. F-11 Turnos de caja y arqueo ciego
* **Descripción:** Controla el efectivo de cada turno desde la apertura hasta el cierre, impidiendo que el cajero conozca el monto esperado antes de declarar lo que contó.
* **Prioridad:** Alta.
* **Acciones iniciadoras y comportamiento esperado:**
  1. Al iniciar el día, el cajero abre su turno declarando el fondo de sencillo.
  2. Durante el turno registra egresos menores (compras urgentes) e ingresos extraordinarios con su motivo.
  3. Al cerrar, cuenta billetes y monedas e ingresa la cantidad por denominación, sin ver el total esperado.
  4. El sistema calcula la diferencia (sobrante o faltante), cierra el turno e imprime el Reporte Z.
* **Requerimientos funcionales:**
  * **REQ-TUR-01:** El sistema no debe permitir cobros en efectivo si el cajero no tiene un turno abierto; la apertura registra el fondo inicial, el usuario y la hora.
  * **REQ-TUR-02:** El sistema debe registrar egresos e ingresos de efectivo con monto, motivo y, en egresos mayores al límite configurado (por ejemplo, S/ 50.00), PIN del administrador.
  * **REQ-TUR-03:** El cierre debe ser **ciego**: el cajero declara el efectivo contado por denominación (billetes de S/ 200 a S/ 10 y monedas de S/ 5 a S/ 0.10) y los montos de Yape/Plin/tarjeta según sus registros, sin ver los totales calculados hasta confirmar su declaración.
  * **REQ-TUR-04:** Tras la declaración, el sistema debe mostrar el esperado, lo declarado y la diferencia por medio de pago, y exigir un comentario si la diferencia supera el margen configurado (por ejemplo, S/ 1.00).
  * **REQ-TUR-05:** El sistema debe emitir el **Reporte Z** del turno: fondo inicial, ventas por medio de pago, ventas por canal (salón, llevar, delivery, apps), egresos, ingresos, efectivo de repartidores liquidado, anulaciones, notas de crédito, descuentos, mermas valorizadas y diferencia de arqueo.
  * **REQ-TUR-06:** El administrador debe poder consultar un **Reporte X** (corte parcial sin cerrar el turno) y reabrir un turno cerrado solo con su PIN, quedando registrado.
* **Respuesta ante errores y entradas inválidas:**
  * Intento de cerrar turno con mesas o pedidos sin cobrar: *"Hay 2 cuentas abiertas (M-03, Llevar #21). Cóbrelas o transfiéralas al siguiente turno"*.
  * Intento de cerrar con delivery sin liquidar: el sistema exige liquidar a los repartidores (REQ-DEL-07).
  * Cantidades negativas o no numéricas en el arqueo: no se aceptan.

### 6.12. F-12 Pedidos para llevar, programados y delivery
* **Descripción:** Gestiona las ventas que no se consumen en el salón: para llevar en mostrador, pedidos programados para recoger, delivery con repartidores propios y pedidos de aplicaciones externas.
* **Prioridad:** Media.
* **Acciones iniciadoras y comportamiento esperado:**
  1. **Para llevar:** el cajero registra el pedido con el nombre del cliente, cobra por adelantado y el sistema asigna un número (*Llevar #18 – Carlos*).
  2. **Programado:** un cliente llama a las 18:00 para recoger a las 20:15; el pedido queda *Programado* y se imprime en la estación del pollero 15 minutos antes.
  3. **Delivery:** el cajero busca al cliente por teléfono (o lo registra), confirma la dirección, el pedido y con cuánto pagará; el sistema imprime la hoja de ruta con el vuelto.
  4. El pedido avanza por los estados *Pendiente → En preparación → Listo → En ruta → Entregado* (o *Entrega fallida*).
  5. Al final del turno, cada repartidor rinde el efectivo cobrado.
* **Requerimientos funcionales:**
  * **REQ-DEL-01:** El sistema debe registrar pedidos para llevar con nombre del cliente y número correlativo diario, rotulados en la comanda como **PARA LLEVAR** y con la cantidad de envases y bolsas.
  * **REQ-DEL-02:** El sistema debe permitir pedidos **programados** con fecha y hora de recojo o entrega, retener su impresión y liberarlos a cocina automáticamente con la anticipación configurada (por defecto, 15 minutos).
  * **REQ-DEL-03:** El sistema debe mantener un registro de clientes de delivery identificado por número de celular, con nombre, direcciones frecuentes y referencias, y autocompletar los datos al ingresar el número.
  * **REQ-DEL-04:** En delivery con pago contra entrega en efectivo, el sistema debe pedir el billete con que pagará el cliente y calcular el vuelto; la **hoja de ruta** debe imprimir dirección, referencia, teléfono, pedido, monto a cobrar y vuelto a entregar (por ejemplo, *COBRAR: S/ 38.00 | VUELTO: S/ 62.00*).
  * **REQ-DEL-05:** El sistema debe mostrar los pedidos de llevar y delivery en un tablero por estados, asignar el repartidor y permitir cambiar el estado desde la caja o desde el celular del repartidor.
  * **REQ-DEL-06:** El sistema debe registrar los pedidos de **aplicaciones externas** (PedidosYa, Rappi) con su código de plataforma, sus precios de canal y medio de pago *Plataforma externa (prepagado)*, sin afectar el efectivo de caja.
  * **REQ-DEL-07:** El sistema debe **liquidar a cada repartidor** al cierre del turno: pedidos entregados, efectivo que debe rendir, vuelto entregado al salir y diferencia.
  * **REQ-DEL-08:** Si el pedido queda en *Entrega fallida*, el cajero debe registrar el destino del producto (reingreso, consumo del personal o merma) y, si estaba pagado, la nota de crédito correspondiente.
* **Respuesta ante errores y entradas inválidas:**
  * Billete declarado menor al total: *"El monto con el que paga debe ser mayor o igual a S/ 38.00"*.
  * Hora programada en el pasado o fuera del horario de atención: no se acepta.
  * Pedido de delivery sin dirección o sin teléfono de 9 dígitos: no se puede confirmar.

### 6.13. F-13 Inventario de pollos, mermas y anulaciones
* **Descripción:** Controla los pollos del día por fracción y por presa, y registra con justificación toda pérdida, reposición o anulación.
* **Prioridad:** Media.
* **Acciones iniciadoras y comportamiento esperado:**
  1. Al abrir el día, el administrador o cajero registra los pollos disponibles para el horno.
  2. Cada venta confirmada descuenta la fracción y las presas correspondientes.
  3. Si un plato vuelve por estar crudo o quemado, el mozo solicita una *reposición por reclamo*; con PIN del administrador se imprime la reposición sin costo y la presa devuelta se registra como merma.
  4. Si una mesa se retira sin pagar, el administrador anula la cuenta con el motivo *Fuga de comensal*.
  5. Al cierre, se registra el conteo físico y el sistema muestra la diferencia con lo esperado.
* **Requerimientos funcionales:**
  * **REQ-INV-01:** El sistema debe registrar ingresos de pollos (unidades enteras) con fecha, cantidad y usuario, y convertirlos en presas disponibles medidas en cuartos (por defecto, 1 pollo = 2 cuartos de pecho con ala + 2 cuartos de pierna con encuentro).
  * **REQ-INV-02:** Cada pedido confirmado debe descontar la fracción de pollo (1 = 1.000; 1/2 = 0.500; 1/4 = 0.250; 1/8 = 0.125) y las presas según la opción elegida, en cuartos (por ejemplo, *1/8 pecho* descuenta 0.5 cuarto de pecho y *1/2 pollo 2 pechos* descuenta 2 cuartos de pecho); las anulaciones antes de la preparación revierten el descuento.
  * **REQ-INV-03:** El sistema debe mostrar en tiempo real el stock de pollos y de cada presa, y alertar cuando baje del mínimo configurado.
  * **REQ-INV-04:** El sistema debe registrar **mermas** (sobrecocción, caída, crudo, entrega fallida, otro) con producto, cantidad, motivo, usuario solicitante y PIN del administrador.
  * **REQ-INV-05:** El sistema debe permitir la **reposición por reclamo**: reimprime el ítem con la marca *REPOSICIÓN – SIN COSTO*, no altera la cuenta del cliente y registra la merma del ítem devuelto.
  * **REQ-INV-06:** El sistema debe permitir la anulación de una cuenta completa por **fuga de comensal** con PIN del administrador; la cuenta queda registrada como pérdida y no altera el efectivo esperado de caja.
  * **REQ-INV-07:** Al cierre del día, el sistema debe comparar el conteo físico de pollos y presas con el stock teórico y mostrar la diferencia no justificada.
* **Respuesta ante errores y entradas inválidas:**
  * Venta que dejaría stock negativo de una presa: el sistema la bloquea y marca la opción como agotada (REQ-AGO-03).
  * Merma sin motivo o sin autorización: no se registra.

### 6.14. F-14 Reportes y auditoría
* **Descripción:** Entrega al dueño la información necesaria para decidir (qué se vende, cuándo, cuánto se pierde) y deja rastro de cada acción sensible.
* **Prioridad:** Media.
* **Acciones iniciadoras y comportamiento esperado:**
  1. El administrador elige un reporte y un rango de fechas.
  2. El sistema muestra el resultado en pantalla con totales y gráficos simples, y permite exportarlo.
* **Requerimientos funcionales:**
  * **REQ-REP-01:** El sistema debe generar reportes de ventas por día, por rango de fechas, por medio de pago, por canal, por mozo y por cajero.
  * **REQ-REP-02:** El sistema debe generar el ranking de productos más vendidos, la venta por presa (pecho vs. pierna) y la venta por franja horaria para identificar las horas punta.
  * **REQ-REP-03:** El sistema debe reportar los tiempos de atención promedio y máximo (registro → impresión → servido) por día y franja horaria.
  * **REQ-REP-04:** El sistema debe reportar mermas, reposiciones, anulaciones, descuentos, notas de crédito y diferencias de arqueo, indicando quién solicitó y quién autorizó.
  * **REQ-REP-05:** El sistema debe mantener una **bitácora de auditoría** de solo lectura con usuario, fecha y hora, dispositivo, acción y valores anteriores y nuevos de las operaciones sensibles (inicios de sesión, cambios de precio, anulaciones, aperturas de gaveta, reaperturas de turno).
  * **REQ-REP-06:** Los reportes deben poder exportarse a Excel (XLSX) y PDF.
* **Respuesta ante errores y entradas inválidas:**
  * Rango de fechas inválido (inicio posterior al fin) o mayor a 12 meses: *"Seleccione un rango válido de hasta 12 meses"*.
  * Rango sin datos: se informa *"No hay registros en el periodo seleccionado"*.

### 6.15. F-15 Operación sin internet y sincronización
* **Descripción:** Asegura que el salón, la cocina y la caja sigan trabajando cuando falla el internet, usando el servidor local, y que los datos se sincronicen con la nube sin pérdidas ni duplicados.
* **Prioridad:** Alta.
* **Acciones iniciadoras y comportamiento esperado:**
  1. Se corta la fibra óptica; el router pasa a la línea 4G. Si también falla, el servidor local sigue atendiendo por la red interna.
  2. Las pantallas muestran el indicador *Modo local*; pedidos, comandas, cobros en efectivo y con POS bancario siguen funcionando.
  3. Al volver el internet, el sistema sincroniza los datos con la nube y envía los comprobantes y mensajes en cola.
* **Requerimientos funcionales:**
  * **REQ-CON-01:** Las tablets, la caja y las ticketeras deben conectarse al servidor local (Edge), de modo que la toma de pedidos, la impresión de comandas, el cobro en efectivo/POS y el control de turnos funcionen sin internet.
  * **REQ-CON-02:** Todas las pantallas del personal deben mostrar el estado de la conexión (*En línea*, *Modo local*, *Sincronizando*) y la cantidad de operaciones pendientes de envío.
  * **REQ-CON-03:** El sistema debe encolar las operaciones que requieren internet (comprobantes, mensajes WhatsApp/correo, consultas DNI/RUC) y procesarlas automáticamente al restablecerse la conexión.
  * **REQ-CON-04:** La sincronización entre el servidor local y la nube debe ser bidireccional e **idempotente**: cada operación lleva un identificador único y nunca se registra dos veces.
  * **REQ-CON-05:** Ante un corte de energía, el sistema debe avisar en caja cuando el UPS esté en batería y, pasados 20 minutos, sugerir cobrar las mesas abiertas y cerrar turnos de forma segura antes de que se agote la batería.
  * **REQ-CON-06:** Tras un reinicio, el servidor local y sus servicios (API, base de datos, colas, agente de impresión) deben iniciar automáticamente y recuperar las colas pendientes.
* **Respuesta ante errores y entradas inválidas:**
  * Conflicto de sincronización (el mismo registro cambió en local y en la nube): prevalece el dato del servidor local para operaciones del local y se registra el conflicto para revisión del administrador.
  * Sin internet, la carta QR para celulares con datos móviles no está disponible; los comensales conectados al WiFi de clientes siguen accediendo a la carta servida por el servidor local.

## 7. Reglas de negocio

| ID | Regla | Requerimientos que la hacen cumplir |
| :--- | :--- | :--- |
| **RN-01** | **Presa obligatoria.** Ningún 1/8 o 1/4 de pollo (ni otro producto con modificador obligatorio) puede registrarse ni enviarse a cocina sin haber elegido *Pecho con ala* o *Pierna con encuentro*. | REQ-CAT-02, REQ-QR-04, REQ-MOZ-02 |
| **RN-02** | **Pedido válido.** Una comanda solo se imprime en cocina cuando fue confirmada por un mozo o cajero, proviene de un dispositivo ya confirmado en la sesión de mesa o fue pagada por adelantado. | REQ-QR-02, REQ-PAG-05 |
| **RN-03** | **Momento de pago por canal.** Salón: cuenta abierta y pago al final (postpago). Para llevar y programados: pago anticipado. Delivery propio: anticipado o contra entrega. Aplicaciones externas: prepagado por la plataforma. | REQ-MOZ-03, REQ-DEL-01 a 06 |
| **RN-04** | **Acciones protegidas.** Requieren PIN del administrador: anular ítems ya impresos (fuera del plazo de corrección), anular cuentas por fuga, registrar mermas y reposiciones, emitir notas de crédito, aplicar descuentos o cortesías, abrir la gaveta sin venta, registrar egresos mayores al límite y reabrir turnos. Nadie puede autorizar su propia solicitud, salvo el administrador. | REQ-USR-03, REQ-MOZ-05, REQ-CAJ-06/07, REQ-FAC-07, REQ-INV-04 a 06 |
| **RN-05** | **Plazo de corrección.** El mozo puede cambiar modificadores de un ítem impreso solo durante los 2 minutos siguientes a la impresión (parámetro configurable); cada cambio genera ticket de corrección. | REQ-MOZ-05, REQ-COC-04 |
| **RN-06** | **Arqueo ciego.** El cajero no puede ver el total esperado de su turno antes de registrar su declaración de efectivo y demás medios de pago. | REQ-TUR-03, REQ-TUR-04 |
| **RN-07** | **Turno obligatorio.** No se aceptan cobros en efectivo sin un turno de caja abierto; un terminal tiene un solo turno abierto a la vez. | REQ-TUR-01 |
| **RN-08** | **Una mesa, un editor.** Una mesa solo puede ser editada por un usuario a la vez. | REQ-SAL-05 |
| **RN-09** | **Precios.** Los precios de carta incluyen impuestos; el precio de cada ítem queda fijado al momento del pedido; los precios en aplicaciones externas pueden tener un recargo de 15 % a 20 % para absorber la comisión. | REQ-CAT-06, REQ-CAT-07 |
| **RN-10** | **Comprobante obligatorio.** Toda venta cobrada genera boleta o factura electrónica, salvo las ventas de hasta S/ 5.00 sin comprobante solicitado, que se consolidan en la boleta resumen del día. La precuenta, la constancia de venta y la comanda no son comprobantes de pago. | REQ-CAJ-01, REQ-FAC-01, REQ-FAC-09 |
| **RN-11** | **Identificación del adquirente.** La factura exige RUC; la boleta exige documento de identidad cuando su importe supera S/ 700.00. | REQ-FAC-02, REQ-FAC-03 |
| **RN-12** | **No se borran ventas.** Una venta con comprobante emitido solo se anula o corrige mediante nota de crédito. Ventas, comprobantes, usuarios y productos nunca se eliminan físicamente. | REQ-FAC-07, REQ-CAT-01, REQ-USR-04 |
| **RN-13** | **Confirmación de pagos digitales.** Un pago en línea se considera recibido solo con la notificación firmada de la pasarela; un pago Yape/Plin manual requiere número de operación único en el sistema. | REQ-PAG-02, REQ-CAJ-03 |
| **RN-14** | **Gaveta controlada.** La gaveta se abre automáticamente solo en cobros con efectivo. | REQ-CAJ-06 |
| **RN-15** | **Equivalencia de presas.** 1 pollo = 2 cuartos de pecho con ala + 2 cuartos de pierna con encuentro (8 octavos); un 1/8 consume medio cuarto de la presa elegida; 1/2 pollo estándar = 1 pecho + 1 pierna; las combinaciones especiales tienen recargo configurable (por defecto, 2 pechos: +S/ 2.00). | REQ-INV-01, REQ-INV-02, REQ-CAT-02 |
| **RN-16** | **Mermas justificadas.** Toda presa o plato perdido se registra con motivo y autorización; la diferencia de inventario sin registro se reporta como faltante no justificado. | REQ-INV-04, REQ-INV-07 |
| **RN-17** | **Continuidad local.** La atención en salón, la impresión en cocina y el cobro en caja no se detienen por fallas de internet. | REQ-CON-01 a 06 |
| **RN-18** | **Entrega digital opcional.** El comprobante digital (WhatsApp o correo) tiene la misma validez que el impreso; el número o correo del cliente se usa solo para ese envío, salvo que autorice expresamente otro uso. | REQ-FAC-06 |
| **RN-19** | **Pedidos programados.** Se liberan a cocina 15 minutos antes de la hora pactada (configurable) para que el pollo llegue caliente. | REQ-DEL-02 |

## 8. Requerimientos de interfaces externas

### Interfaces de usuario

**Interfaces por tipo de usuario**

| Interfaz | Usuario | Dispositivo y orientación | Pantallas principales |
| :--- | :--- | :--- | :--- |
| Carta QR (PWA) | Comensal | Smartphone vertical (360–430 px de ancho) | Bienvenida de mesa, categorías, detalle con modificadores, carrito, estado del pedido, precuenta y pago, comprobante. |
| App de mozos | Mozo | Tablet 8.7" (vertical u horizontal) | Plano de mesas, toma de pedido, alertas de llamado, confirmación de pedidos QR, precuenta. |
| Punto de venta | Cajero | Pantalla táctil 15.6" (1366 × 768 px) | Salón, cobro, división de cuenta, comprobantes, tablero llevar/delivery, agotados, turno y arqueo, stock de presas. |
| Panel de administración | Administrador | PC o celular (diseño adaptable) | Carta y modificadores, mesas, usuarios, parámetros, reportes, bitácora. |
| Pantalla de llamado (opcional, prioridad baja) | Clientes en mostrador | TV 43" horizontal | Columnas *En preparación* y *Listo para recoger* con número y nombre. |

**Estándares de interfaz gráfica y guía de estilo**
* Idioma español; moneda con formato `S/ 1,234.50`; fecha `dd/mm/aaaa`; hora de 24 horas (zona America/Lima).
* Áreas táctiles de al menos 48 × 48 px con 8 px de separación; texto base de 16 px; precios y totales de 20 px en negrita.
* Contraste mínimo 4.5:1 (WCAG 2.1 nivel AA). El estado de las mesas se indica con color **y** con ícono o texto, para no depender solo del color.
* Navegación de máximo dos niveles; las categorías se muestran como pestañas grandes, sin menús anidados.
* Barra superior fija en todas las pantallas del personal con: usuario y rol, turno abierto, estado de conexión (*En línea / Modo local*) y contador de alertas.
* Botón de acción principal en un mismo lugar en todas las pantallas (abajo a la derecha); acciones destructivas en rojo y con confirmación.
* Toda acción muestra respuesta visual en menos de 300 ms (indicador de carga o mensaje breve).
* Los mensajes de error dicen qué pasó y qué hacer, en lenguaje simple y sin códigos técnicos.

| Estado de mesa | Color | Ícono / texto |
| :--- | :--- | :--- |
| Libre | Verde | ✓ *Libre* |
| Pedido QR por confirmar | Amarillo | ⏳ *Por confirmar* |
| Ocupada | Rojo | 🍗 *Ocupada* + tiempo y monto |
| Cuenta solicitada | Azul | 🧾 *Cuenta* |
| Por limpiar | Gris | 🧹 *Limpiar* |

**Ejemplo de comanda (ticketera del pollero, 80 mm)** y **hoja de ruta de delivery**:

```
================================      ================================
      MESA M-04  (doble tamaño)              DELIVERY #D-05
================================      ================================
Orden #42  Ronda 1     19:45          Cliente: Rosa Pérez
Mozo: Juan                            Cel: 987 654 321
--------------------------------      Dir.: Jr. Loreto 345, Tambopata
1x 1/4 POLLO  >> PECHO CON ALA <<     Ref.: Frente al colegio
   Papas: BIEN DORADAS                --------------------------------
   Ensalada: Clásica                  1x Combo 1/4 Pierna + Gaseosa
   Cremas: Ají, Mayonesa              --------------------------------
1x 1/2 POLLO  >> 2 PECHOS <<          COBRAR:          S/  38.00
   Papas: SIN SAL                     PAGA CON:        S/ 100.00
   NOTA: vinagreta aparte             ENTREGAR VUELTO: S/  62.00
================================      Repartidor: Luis   Salida: 20:10
```

### Interfaces de hardware

| Dispositivo | Conexión | Protocolo | Interacción de datos y control |
| :--- | :--- | :--- | :--- |
| Ticketera del pollero | Ethernet Cat6, IP fija | TCP puerto 9100 (RAW), ESC/POS | Impresión de texto en tamaño normal y doble (`GS !`), corte de papel (`GS V`), activación del buzzer (comando del fabricante) y lectura de estado (`DLE EOT`) para detectar falta de papel o tapa abierta. |
| Ticketera de caja | USB al servidor local (o Ethernet) | ESC/POS | Impresión de precuentas, comprobantes con QR tributario (`GS ( k`), hojas de ruta, comandas de bebidas y reportes. |
| Gaveta de dinero | RJ11 a la ticketera de caja | Pulso ESC/POS (`ESC p`) | Apertura automática al cobrar en efectivo. |
| UPS | USB al servidor local | HID / Network UPS Tools (NUT) | Lectura del estado de batería para alertas de corte de energía (REQ-CON-05). |
| Tablets y terminal de caja | WiFi 5 GHz / Ethernet (VLAN Operaciones) | HTTPS y WSS | Uso de las aplicaciones web del personal. |
| Celulares de comensales | WiFi de clientes o datos móviles | HTTPS | Acceso a la carta QR y al pago en mesa. |
| Router Dual-WAN | Fibra óptica + módem 4G | Conmutación automática (failover) | Mantiene salida a internet si cae la fibra. |
| POS bancario | No integrado | — | El cajero registra manualmente el número de operación. |

### Interfaces de software

| Sistema externo / componente | Propósito | Protocolo y formato | Datos enviados | Datos recibidos |
| :--- | :--- | :--- | :--- | :--- |
| PSE/OSE (Nubefact u otro autorizado por SUNAT) | Emisión de comprobantes electrónicos | API REST HTTPS, JSON, token | Tipo, serie, cliente, ítems, impuestos | Estado, hash, CDR, enlaces PDF/XML, cadena QR |
| Pasarela de pagos (Culqi o Izipay) | Pago en mesa y cobro Yape con código | Checkout embebido + API REST + webhooks firmados HMAC-SHA256 | Monto, moneda PEN, ID de orden, correo | ID de transacción, estado, motivo de rechazo |
| ApisPeru (o similar) | Consulta de DNI y RUC | API REST HTTPS, token Bearer | Número de documento | Nombres, razón social, dirección, estado y condición |
| WhatsApp Business Cloud API (Meta) | Envío de comprobantes y avisos de delivery | Graph API HTTPS, JSON, plantillas aprobadas | Celular, plantilla, PDF | ID y estado del mensaje |
| Servidor de correo | Envío de comprobantes | SMTP con STARTTLS (puerto 587) | Correo con PDF y XML adjuntos | Confirmación de envío |
| PostgreSQL 16 | Persistencia transaccional | Prisma ORM / SQL | — | — |
| Redis + BullMQ | Colas de impresión, comprobantes, mensajes y pedidos programados | Protocolo Redis | — | — |
| Sistema operativo y contenedores | Ejecución de servicios | Ubuntu Server 24.04 LTS, Docker | — | — |
| Libro de Reclamaciones virtual | Cumplimiento INDECOPI | Enlace HTTPS desde la carta QR | — | — |

### Interfaces de comunicación
* **Cifrado:** todo el tráfico entre navegadores y servidores (nube y local) usa HTTPS con TLS 1.2 o superior; los eventos en tiempo real usan WebSocket seguro (WSS).
* **Resolución local:** el router resuelve el dominio de la carta hacia el servidor local (DNS local), y el servidor local tiene el certificado válido del dominio, para que la carta funcione también sin internet.
* **Formato de mensajes:** API REST con JSON en UTF-8; fechas en ISO 8601 con zona America/Lima; montos con 2 decimales.
* **Impresoras:** tráfico ESC/POS RAW por TCP 9100, permitido solo dentro de la VLAN de Operaciones.
* **Webhooks:** recepción por HTTPS POST; el servidor valida la firma HMAC, responde en menos de 5 segundos y procesa cada evento una sola vez.
* **Sincronización local–nube:** HTTPS con cola de salida (*outbox*), identificador único por operación y reintentos con espera exponencial.
* **Segmentación de red:** *VLAN Operaciones* (WiFi oculto, WPA3/WPA2, prioridad QoS) para servidor, tablets, caja e impresoras; *VLAN Clientes* (aislamiento entre clientes, máximo 4 Mbps por dispositivo) con acceso solo a internet y al puerto HTTPS de la carta en el servidor local.
* **Correo y mensajería:** dominio con registros SPF y DKIM para que los correos no lleguen a spam; mensajes de WhatsApp mediante plantillas de categoría *utilidad* aprobadas por Meta.
* **Hora:** todos los equipos se sincronizan por NTP para que las marcas de tiempo de pedidos y comprobantes sean consistentes.

## 9. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Criterio de aceptación |
| :--- | :--- | :--- | :--- |
| **RNF-REN-01** | Rendimiento | Carga de la carta QR. | Primera visita ≤ 3 s en red 4G; visitas siguientes ≤ 1 s (caché PWA). Medido con Lighthouse en perfil móvil. |
| **RNF-REN-02** | Rendimiento | Tiempo de comanda. | Desde *Comandar* hasta que la ticketera imprime: ≤ 3 s en el 95 % de los casos (red local). |
| **RNF-REN-03** | Rendimiento | Propagación en tiempo real. | Cambios de mesa, alertas y agotados visibles en todos los dispositivos en ≤ 2 s. |
| **RNF-REN-04** | Rendimiento | Cobro y comprobante. | Consulta DNI/RUC ≤ 2 s; emisión de comprobante con internet ≤ 5 s; cobro completo en caja ≤ 1 min. |
| **RNF-REN-05** | Rendimiento | Capacidad en hora punta. | 10 mesas llenas (≥ 60 celulares conectados), 2 tablets y la caja; 30 pedidos por minuto sin superar los tiempos anteriores. Verificado con prueba de carga. |
| **RNF-DIS-01** | Disponibilidad | Servicio en horario de atención. | ≥ 99.5 % de disponibilidad mensual de las funciones del personal entre 12:00 y 23:00. |
| **RNF-DIS-02** | Disponibilidad | Operación sin internet. | 100 % de las funciones de REQ-CON-01 operativas con el internet desconectado (prueba de desconexión de 30 min). |
| **RNF-DIS-03** | Disponibilidad | Respaldo eléctrico y recuperación. | UPS con autonomía ≥ 30 min; tras un reinicio, el sistema vuelve a operar en ≤ 2 min (frente a 15 min de la situación actual). |
| **RNF-DIS-04** | Confiabilidad | Respaldo de datos. | Sincronización con la nube cada ≤ 5 min con internet (pérdida máxima de datos de 5 min ante falla del servidor local); copia de seguridad diaria cifrada, conservada 30 días; restauración completa en ≤ 4 h. |
| **RNF-SEG-01** | Seguridad | Credenciales. | Contraseñas y PIN almacenados con hash bcrypt o Argon2; nunca en texto plano ni en registros. |
| **RNF-SEG-02** | Seguridad | Control de acceso. | Permisos validados en el servidor en cada petición según rol; bloqueo de 5 min tras 5 PIN fallidos; sesión del personal que expira a las 12 h y bloqueo por inactividad de 15 min en caja. |
| **RNF-SEG-03** | Seguridad | Datos de pago. | El sistema no recibe ni almacena datos de tarjetas (los procesa la pasarela certificada PCI DSS). |
| **RNF-SEG-04** | Seguridad | Protección de la carta QR. | Token de sesión de mesa aleatorio de al menos 128 bits, que expira al liberar la mesa; límite de 10 pedidos por minuto por dispositivo. |
| **RNF-SEG-05** | Seguridad | Auditoría. | Bitácora de solo lectura conservada al menos 1 año; ningún rol puede modificarla. |
| **RNF-USA-01** | Usabilidad | Aprendizaje. | Un mozo nuevo registra un pedido correcto sin ayuda tras una capacitación de ≤ 30 min. |
| **RNF-USA-02** | Usabilidad | Eficiencia. | Un 1/4 de pollo con presa, papas, ensalada y cremas se registra en ≤ 6 toques y ≤ 20 s. |
| **RNF-USA-03** | Usabilidad | Comprensión del comensal. | En prueba con 10 comensales, al menos 8 hacen un pedido por QR sin ayuda. |
| **RNF-USA-04** | Usabilidad | Legibilidad de la comanda. | El pollero lee la mesa y la presa a 1 metro de distancia (encabezado y presa en doble tamaño). |
| **RNF-INT-01** | Integridad | Cero pérdidas y duplicados. | Ninguna comanda o pago se pierde ni se registra dos veces en pruebas de reconexión, reintento y webhooks duplicados. |
| **RNF-INT-02** | Integridad | Exactitud monetaria. | Montos con tipo decimal (nunca coma flotante) y 2 decimales; cobros, arqueos e inventario en transacciones ACID; la suma de una cuenta dividida es igual al total. |
| **RNF-MAN-01** | Mantenibilidad | Estructura del código. | TypeScript en frontend y backend; módulos NestJS por funcionalidad; código en repositorio Git con revisiones antes de integrar. |
| **RNF-MAN-02** | Mantenibilidad | Pruebas automatizadas. | Cobertura ≥ 70 % en los módulos de cobro, comprobantes, turnos e inventario. |
| **RNF-MAN-03** | Mantenibilidad | Configuración sin programar. | Carta, precios, mesas, impresoras, series, tasas de impuesto, umbrales y plazos se modifican desde el panel de administración. |
| **RNF-COM-01** | Compatibilidad | Navegadores. | Chrome y Safari en sus dos últimas versiones; Android 9+ e iOS 15+ en celulares de comensales. |
| **RNF-ESC-01** | Escalabilidad | Crecimiento. | Admite hasta 30 mesas y 5 dispositivos del personal sin cambios de código; la estructura de datos permite agregar otros locales en el futuro. |

## 10. Otros requerimientos

### 10.1. Requerimientos de base de datos
* **Motor:** PostgreSQL 16 en la nube y en el servidor local, con el mismo esquema administrado mediante migraciones de Prisma.
* **Entidades principales:** Usuario, Rol, Mesa, SesiónMesa, Dispositivo, Categoría, Producto, PrecioCanal, GrupoModificador, OpciónModificador, ComponenteProducto, Pedido, Ronda, ÍtemPedido, TrabajoImpresión, Cuenta, Pago, Comprobante, NotaCrédito, Cliente, Dirección, Repartidor, LiquidaciónRepartidor, Turno, MovimientoCaja, Arqueo, MovimientoInventario, Merma, Autorización, Bitácora, Parámetro y ColaSincronización.
* **Integridad:** claves foráneas obligatorias, identificadores UUID (necesarios para sincronizar sin choques entre local y nube), montos en tipo `NUMERIC(10,2)` y fechas con zona horaria.
* **Borrado lógico:** los registros con valor contable o de auditoría se desactivan, nunca se eliminan (RN-12).
* **Conservación:** ventas, comprobantes (XML, PDF y CDR) y movimientos de caja se conservan durante el plazo exigido por la normativa tributaria; la bitácora, al menos 1 año.

### 10.2. Requerimientos legales y tributarios
* **Comprobantes de pago electrónicos:** emisión conforme al Reglamento de Comprobantes de Pago de SUNAT, a través de un PSE/OSE autorizado, con representación impresa que incluya el código QR tributario.
* **Impuestos:** tasa configurable para soportar la tasa general (18 %) o la tasa especial para MYPE de restaurantes de la Ley 31556, modificada por la Ley 32219 (10.5 % en 2026: 8 % de IGV + 2.5 % de IPM). La tasa aplicable al negocio la confirma su contador. ICBPER por bolsa plástica según la Ley 30884.
* **Protección al consumidor:** enlace al Libro de Reclamaciones virtual en la carta QR y precios mostrados con todos los impuestos incluidos (Ley 29571, Código de Protección y Defensa del Consumidor).
* **Datos personales:** aviso de privacidad en la carta QR y en los formularios de delivery; los datos de contacto se usan solo para la finalidad informada (Ley 29733, Ley de Protección de Datos Personales).

### 10.3. Regionalización
* Idioma español (Perú), moneda soles (PEN, `S/`), zona horaria America/Lima (UTC-5), formato de fecha `dd/mm/aaaa`.
* Los textos de la carta QR se guardan separados del código para poder agregar una versión en inglés para turistas en una versión futura (prioridad baja).

### 10.4. Reúso de componentes
* Como la carta, las mesas, las impresoras y los impuestos son configurables, el sistema puede implantarse en otras pollerías sin cambiar el código.
* La integración con el PSE/OSE, la pasarela de pagos y la consulta DNI/RUC se implementa mediante adaptadores, para cambiar de proveedor sin afectar el resto del sistema.
* El agente de impresión ESC/POS se desarrolla como un módulo independiente y reutilizable.

### 10.5. Implantación, capacitación y documentación
* Instalación del hardware, la red y el sistema en el local, y colocación de los QR en las 10 mesas (fase 6 del cronograma).
* Carga inicial de la carta del Anexo B, de las mesas, de los usuarios y de las series de comprobantes.
* Capacitación por rol: mozos (toma de pedidos y alertas), pollero (lectura de comandas), cajera (cobros, comprobantes y arqueo) y dueño (administración y reportes).
* Entregables: manual de usuario por rol (PDF), manual técnico (instalación, respaldo y restauración) y acta de conformidad firmada por el propietario.

### 10.6. Soporte y mantenimiento
* Mantenimiento mensual contratado (S/ 400.00 según el estudio de factibilidad).
* Incidencias críticas (no se puede tomar pedidos, imprimir comandas o cobrar): respuesta en ≤ 2 horas durante el horario de atención.
* Las actualizaciones se instalan fuera del horario de atención y con copia de seguridad previa.

## 11. Glosario

| Término | Definición |
| :--- | :--- |
| **1/8, 1/4, 1/2 de pollo** | Fracciones de un pollo a la brasa entero que se venden como platos individuales o para compartir. |
| **ACID** | Propiedades de una transacción de base de datos (atomicidad, consistencia, aislamiento y durabilidad) que garantizan que una operación se registra completa o no se registra. |
| **Arqueo ciego** | Conteo del dinero al cierre del turno en el que el cajero declara lo que contó sin conocer antes el monto que el sistema espera. |
| **Buzzer** | Alarma sonora incorporada a la ticketera de producción que suena con cada comanda nueva. |
| **CDR** | Constancia de Recepción que devuelve SUNAT u OSE e indica si un comprobante electrónico fue aceptado. |
| **Comanda** | Orden de preparación con los productos y preferencias de un pedido, impresa en la estación del pollero. |
| **Edge Gateway (servidor local)** | Mini PC instalada en el local que ejecuta el sistema en la red interna para que funcione sin internet. |
| **ESC/POS** | Lenguaje de comandos estándar para controlar ticketeras térmicas (texto, corte, buzzer, gaveta). |
| **Fuga de comensal ("perro muerto")** | Cliente que se retira sin pagar su cuenta. |
| **HMAC** | Firma criptográfica que permite verificar que una notificación proviene realmente de la pasarela de pagos. |
| **ICBPER** | Impuesto al Consumo de las Bolsas de Plástico. |
| **Idempotencia** | Propiedad por la cual repetir una operación (por ejemplo, un reenvío por reconexión) no produce un registro duplicado. |
| **IGV / IPM** | Impuesto General a las Ventas e Impuesto de Promoción Municipal, que juntos forman la tasa aplicada a las ventas. |
| **Kardex** | Registro de entradas, salidas y saldos de un producto en inventario. |
| **Merma** | Producto perdido o desechado por sobrecocción, caída, devolución u otra causa. |
| **Modificador** | Opción que personaliza un producto (presa, papas, ensalada, cremas). Puede ser obligatorio u opcional. |
| **Mostrito** | Plato que combina pollo a la brasa con arroz chaufa y papas fritas. |
| **Nota de crédito electrónica** | Comprobante que anula o reduce total o parcialmente una boleta o factura ya emitida. |
| **OSE / PSE** | Operador de Servicios Electrónicos y Proveedor de Servicios Electrónicos: empresas autorizadas por SUNAT para validar o emitir comprobantes electrónicos por cuenta del contribuyente. |
| **Pago mixto** | Pago de una misma cuenta con dos o más medios de pago. |
| **Pasarela de pagos** | Servicio autorizado (Culqi, Izipay) que procesa pagos con tarjeta y billeteras digitales por internet. |
| **Pecho con ala / Pierna con encuentro** | Las dos presas de un cuarto de pollo: la parte del pecho con el ala, y la pierna con el muslo. |
| **Pedido programado (Pick & Collect)** | Pedido registrado con anticipación para recoger o entregar a una hora pactada. |
| **Precuenta** | Detalle de consumo de una mesa entregado antes del pago; no es comprobante de pago. |
| **Protocolo 86** | Término gastronómico para retirar de inmediato de la venta un producto que se agotó. |
| **PWA** | Aplicación web progresiva: página web que funciona como una aplicación en el celular, sin instalarse desde una tienda. |
| **Reporte X / Reporte Z** | Reporte de caja parcial que no cierra el turno (X) y reporte de cierre del turno (Z). |
| **Reposición por reclamo** | Reemplazo sin costo de un plato devuelto por defecto de preparación. |
| **Ronda** | Cada envío de productos a cocina dentro de una misma cuenta de mesa. |
| **Sesión de mesa** | Periodo entre la apertura y la liberación de una mesa; agrupa los pedidos y los celulares de esa atención. |
| **Split bill** | División de una cuenta en varias partes, cada una con su pago y comprobante. |
| **SUNAT** | Superintendencia Nacional de Aduanas y de Administración Tributaria del Perú. |
| **Token** | Código aleatorio y temporal que identifica una sesión de mesa y evita pedidos desde fuera del local. |
| **UPS** | Sistema de alimentación ininterrumpida: batería que mantiene encendidos los equipos ante cortes de luz. |
| **VLAN** | Red virtual que separa el tráfico del personal del tráfico de los clientes en el mismo equipo de red. |
| **Webhook** | Notificación automática que un servicio externo envía al sistema cuando ocurre un evento (por ejemplo, un pago aprobado). |
| **Yape / Plin** | Billeteras digitales de uso masivo en el Perú para pagos inmediatos desde el celular. |

---

## Anexo A. Matriz de trazabilidad

**A.1. Problemas del negocio → requerimientos → verificación**

| Problema (sección 2.2) | Funcionalidad y requerimientos | Criterio de verificación | Tareas del cronograma |
| :--- | :--- | :--- | :--- |
| P1 – Espera de la carta | F-04: REQ-QR-01 a 05 | RNF-REN-01, RNF-USA-03 | 3.8, 3.12 |
| P2 – Comandas perdidas y no escuchadas | F-06: REQ-COC-01 a 05 | RNF-REN-02, RNF-USA-04 | 4.1, 4.2, 5.4 |
| P3 – Presa equivocada | F-04/F-05: REQ-QR-04, REQ-MOZ-02; RN-01 | RNF-INT-01 | 3.9, 3.10 |
| P4 – Cobro lento con Yape y boleta manual | F-08, F-09, F-10 | RNF-REN-04 | 4.5 a 4.10 |
| P5 – Cierre de caja de una hora | F-11: REQ-TUR-01 a 06 | Meta de la sección 2.4 | 4.3, 4.11 |
| P6 – Apagón de la PC de caja | F-15: REQ-CON-05, REQ-CON-06 | RNF-DIS-03 | 5.6, 5.7 |
| P7 – Mozos sobrecargados | F-03, F-04, F-05, F-09 | RNF-REN-03 | 3.6, 3.7, 3.11 |

**A.2. Escenarios reales de pedidos → requerimientos**
*(Escenarios de `casos_de_uso_y_escenarios_de_pedidos.md`)*

| Escenario | Requerimientos que lo cubren |
| :--- | :--- |
| 1.1 Menú de 1/8 de pollo | REQ-CAT-04, REQ-INV-02 |
| 1.2 1/4 de pollo: pecho o pierna | REQ-QR-04, REQ-AGO-03, REQ-INV-02 |
| 1.3 1/2 pollo estándar, 2 pechos o 2 piernas | REQ-CAT-02, REQ-INV-02, RN-15 |
| 1.4 Pollo entero cortado en 4 u 8 presas | REQ-CAT-02, REQ-COC-02 |
| 1.5 Mostrito | REQ-CAT-03 |
| 2.1 Cambio de ensalada por papas | REQ-QR-05 |
| 2.2 Papas bien doradas o sin sal | REQ-QR-05, REQ-COC-02 |
| 2.3 Cremas, ají y potes extra para llevar | REQ-QR-05, REQ-CAT-06 |
| 2.4 Pollo sin pellejo | REQ-QR-05, REQ-MOZ-01 |
| 3.1 Consumo progresivo en mesa | REQ-MOZ-03 |
| 3.2 Para llevar con nombre | REQ-DEL-01 |
| 3.3 Delivery que paga con S/ 100 | REQ-DEL-04 |
| 3.4 Pedido programado para recoger | REQ-DEL-02 |
| 3.5 Pedido de PedidosYa/Rappi | REQ-DEL-06 |
| 4.1 Cuenta dividida en 4 boletas | REQ-CAJ-05, REQ-FAC-01 |
| 4.2 Factura con RUC | REQ-FAC-02 |
| 4.3 Pago mixto efectivo + Yape | REQ-CAJ-04 |
| 4.4 Cambio y fusión de mesas | REQ-SAL-03, REQ-SAL-04 |
| 5.1 Cambio de presa a último segundo | REQ-MOZ-05, REQ-COC-04 |
| 5.2 Plato devuelto (crudo o quemado) | REQ-INV-05 |
| 5.3 Fuga de comensal | REQ-INV-06 |
| 5.4 Delivery fallido | REQ-DEL-08 |

## Anexo B. Carta inicial de referencia
Precios con impuestos incluidos, según la entrevista al propietario (Puerto Maldonado, setiembre de 2026). Podrán modificarse desde el panel de administración (RN-09).

| Producto | Precio | Incluye / modificadores | Consumo de pollo |
| :--- | :---: | :--- | :---: |
| 1/8 Pollo a la brasa | S/ 14.00 | Papas, ensalada, cremas. Presa: pecho o pierna. | 0.125 |
| 1/4 Pollo a la brasa | S/ 24.00 | Papas, ensalada, cremas. **Presa obligatoria:** pecho con ala o pierna con encuentro. | 0.250 |
| 1/2 Pollo a la brasa | S/ 45.00 | Para 2 personas. 1 pecho + 1 pierna; 2 pechos (+S/ 2.00); 2 piernas. | 0.500 |
| 1 Pollo entero a la brasa | S/ 80.00 | Papas familiares, ensalada grande, cremas. Corte en 4 u 8 presas. | 1.000 |
| Mostrito 1/8 | S/ 18.00 | 1/8 de pollo + arroz chaufa + papas. Presa: pecho o pierna. | 0.125 |
| Mostrito 1/4 | S/ 28.00 | 1/4 de pollo + arroz chaufa + papas. Presa obligatoria. | 0.250 |
| Porción de papas fritas | S/ 12.00 | — | — |
| Porción de ensalada | S/ 8.00 | Clásica o cocida. | — |
| Gaseosa personal 500 ml | S/ 4.50 | Sabor a elegir. | — |
| Gaseosa 1.5 L | S/ 12.00 | Sabor a elegir. | — |
| Jarra de chicha morada 1 L | S/ 12.00 | — | — |
| Pote de ají extra (solo para llevar y delivery) | S/ 1.50 | — | — |
