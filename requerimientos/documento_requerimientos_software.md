# Documento de Requerimientos de Software
## SISTEMA PARA POLLERIAS
### Sistema de Gestión Web y Automatización Operativa

* **Institución:** Universidad Nacional Amazónica de Madre de Dios (UNAMAD)
* **Escuela Profesional:** Ingeniería de Sistemas e Informática
* **Curso:** Análisis y Diseño de Sistemas II
* **Docente:** Dr. Dany Dorian Isuiza Pérez
* **Integrantes del Equipo de Desarrollo:**
  * ENRIQUEZ HUARHUA NILTON
  * QUISPE QUISPE MIJAIL
* **Fecha:** 28 de Septiembre de 2026
* **Estado:** Documento de Requerimientos Preliminar (Previo al Desarrollo)

## Contenido

1. [Propósito](#1-propósito)
2. [Alcance del producto / Software](#2-alcance-del-producto--software)
3. [Funcionalidades del producto](#3-funcionalidades-del-producto)
4. [Clases y características de usuarios](#4-clases-y-características-de-usuarios)
5. [Entorno operativo](#5-entorno-operativo)
6. [Requerimientos funcionales](#6-requerimientos-funcionales)
   * 6.1. Gestión y visualización gráfica de mesas del salón
   * 6.2. Carta digital y pedidos mediante código QR
   * 6.3. Toma de pedidos móvil para mozos (Tablets)
   * 6.4. Envío directo de comanda a cocina con aviso sonoro
   * 6.5. Control de platos y productos agotados
   * 6.6. Módulo de cobro en caja y formas de pago
   * 6.7. Emisión de comprobantes de pago (Boletas y Facturas)
   * 6.8. Control de turnos y cierre diario de caja
   * 6.9. Pedidos para llevar y delivery
   * 6.10. Control básico de insumos y registro de mermas
7. [Reglas de negocio](#7-reglas-de-negocio)
8. [Requerimientos de interfaces externas](#8-requerimientos-de-interfaces-externas)
   * Interfaces de usuario
   * Interfaces de hardware
   * Interfaces de software
   * Interfaces de comunicación
9. [Requerimientos no funcionales](#9-requerimientos-no-funcionales)
10. [Otros requerimientos](#10-otros-requerimientos)
11. [Glosario](#11-glosario)

## 1. Propósito

El presente documento tiene como objetivo especificar los **requerimientos de software** para el desarrollo del **"SISTEMA PARA POLLERIAS"**. 

Este documento sirve como guía formal previa a la etapa de programación, definiendo las funciones, comportamientos y reglas operativas que el sistema deberá cumplir para digitalizar los procesos de atención al comensal, comunicación con cocina, cobranza en caja y control básico de insumos en un restaurante de brasas.

El alcance detallado en este informe cubre la solución completa del negocio, integrando:
* El área de salón y atención en mesas (autoservicio por código QR y comanda de mozos).
* El área de producción (impresión inmediata de comandas en cocina con aviso sonoro).
* El mostrador de caja (liquidación de cuentas, emisión de comprobantes y cierre de turno).
* Módulo de pedidos para llevar y despacho a domicilio.

## 2. Alcance del producto / Software

### 2.1. Propósito y Objetivo General
Desarrollar una aplicación web para la gestión integral de pollerías, orientada a agilizar el flujo de atención al cliente, reducir equivocaciones en la preparación de pedidos y facilitar el control administrativo del negocio sin depender exclusivamente de una conexión permanente a internet para la operación interna.

### 2.2. Beneficios para el Negocio
* **Disminución de errores en los pedidos:** El sistema obliga a detallar las preferencias del cliente (por ejemplo, elegir obligatoriamente entre *pecho* o *pierna* en los cuartos de pollo), evitando reclamos y platos devueltos.
* **Atención más ágil en horas punta:** El comensal puede consultar la carta y enviar su orden desde su propio teléfono mediante un código QR ubicado en su mesa, reduciendo el tiempo de espera.
* **Comunicación clara con la cocina:** Los pedidos llegan impresos directamente a la estación del cocinero, acompañados de una alerta sonora que supera el ruido ambiental de los extractores y hornos.
* **Cobros organizados, rápidos y pago en mesa:** Registro eficiente de pagos en efectivo, tarjetas y billeteras digitales (como Yape o Plin), evitando aglomeraciones en caja y permitiendo que el cliente pague directamente desde su móvil en la mesa.
* **Distribución digital y ecológica de comprobantes:** El comensal puede optar por recibir su comprobante por WhatsApp o correo electrónico, ahorrando papel térmico y agilizando la salida del cliente.
* **Transparencia en el dinero de caja:** Control ordenado de apertura y cierre de turnos que previene descuadres y diferencias en el efectivo.

## 3. Funcionalidades del producto

A continuación se listan las principales funcionalidades que compondrán el sistema:

1. **Gestión gráfica del salón y mesas:** Visualización del estado de las mesas (libre, ocupada, por cobrar) y funciones para mover o juntar mesas.
2. **Carta digital, pedidos y pago directo en mesa por QR:** Menú interactivo accesible desde el celular del cliente para ver productos, seleccionar guarniciones, pedir y pagar directamente desde la mesa.
3. **Comanda móvil para mozos:** Aplicación para dispositivos móviles o tablets que permite a los mozos tomar órdenes directamente al lado de la mesa.
4. **Impresión automática en cocina:** Envío instantáneo de la comanda a la impresora térmica del área de brasas con activación de zumbador o timbre sonoro.
5. **Control de disponibilidad de platos:** Opción rápida para marcar platos o presas como agotados para que no puedan ser pedidos en el menú digital.
6. **Punto de venta y cobranza en caja:** Cobro de comandas con opciones de pago en efectivo, digital o dividido entre varios clientes (*split bill*).
7. **Emisión y distribución digital de comprobantes:** Registro de ventas con emisión de boletas y facturas electrónicas, con opción de impresión en papel o envío vía WhatsApp y correo electrónico.
8. **Cierre diario de caja:** Registro de fondo inicial, ingresos, gastos menores del turno y reporte consolidado de cierre.
9. **Gestión de pedidos para llevar y delivery:** Registro de clientes para llevar con identificación rápida y control de pedidos con reparto a domicilio.
10. **Control de insumos y mermas:** Registro de existencias de pollos y control justificado de platos devueltos o mermas de cocina.

## 4. Clases y características de usuarios

| Tipo de Usuario | Características y Nivel | Dispositivo de Uso | Funcionalidades Principales |
| :--- | :--- | :--- | :--- |
| **Comensal (Cliente)** | Usuario final sin registro previo; interactúa de forma casual. | Smartphone personal (Navegador web). | Consulta de carta QR, elección de acompañamientos, llamado al mozo, pago web en mesa y recepción de comprobante por WhatsApp/correo. |
| **Mozo / Mesero** | Personal de atención; requiere interfaz rápida y botones grandes. | Dispositivo móvil o tablet del local. | Apertura de mesas, toma de pedidos y adición de bebidas o extras. |
| **Maestro Pollero / Cocinero** | Personal de producción; no manipula pantallas por el calor y la grasa. | Impresora térmica en cocina. | Recepción visual de la comanda impresa y alerta por sonido. |
| **Cajero(a)** | Responsable del cobro y emisión de comprobantes durante el turno. | Computadora o terminal de caja. | Cobro de cuentas, control de pagos digitales, arqueo y cierre de turno. |
| **Administrador / Dueño** | Acceso a reportes, configuración general, carta y seguridad. | Computadora de escritorio o laptop. | Gestión de precios, anulación autorizada de platos y reportes de ventas. |

## 5. Entorno operativo

* **Dispositivos de Salón:** 
  * Dispositivos móviles tipo tablet o smartphone con sistema operativo Android y navegador web moderno para la labor de los mozos.
  * Teléfonos inteligentes de los propios comensales (Android / iOS) con cualquier navegador estándar (Chrome, Safari) para la lectura de la carta QR.
* **Terminal de Caja:** Computadora de escritorio o terminal táctil con sistema operativo Windows o Linux, conectada a una gaveta de dinero estándar y a una impresora térmica de recibos.
* **Estación de Cocina:** Impresora térmica para papel de 80 mm conectada a la red local mediante cable de red, equipada con zumbador o alarma acústica para avisar cada nuevo pedido.
* **Red Local:** Router con red inalámbrica (WiFi) para la comunicación entre los dispositivos móviles y los equipos de caja y cocina. El sistema deberá permitir la continuidad de la atención en el salón mediante la red local ante eventuales caídas del servicio de internet exterior.
* **Base de Datos y Servidor:** Sistema gestor de base de datos relacional (PostgreSQL) para el almacenamiento seguro de transacciones, comandas y usuarios.

## 6. Requerimientos funcionales

### 6.1. Gestión y visualización gráfica de mesas del salón
* **Descripción:** Interfaz interactiva que representa la distribución física de las mesas del restaurante en una sola pantalla.
* **Prioridad:** Alta.
* **Acciones iniciadoras y comportamiento esperado:**
  * El usuario (mozo o cajero) abre la vista de salón y observa las mesas identificadas por número.
  * Cada mesa muestra un color representativo de su estado actual: libre, ocupada con pedido en curso, o con precuenta solicitada.
  * El usuario puede seleccionar una mesa para ver su cuenta activa, trasladar una cuenta a otra mesa o unificar dos mesas en una sola.
* **Requerimientos detallados:**
  * **REQ-01:** El sistema debe mostrar el plano del salón actualizando el estado de cada mesa de manera automática.
  * **REQ-02:** El sistema debe permitir el cambio de mesa o la unión de mesas para grupos de comensales, consolidando los consumos en una sola cuenta.
  * **Respuesta ante errores:** Si un usuario intenta abrir una mesa que ya está siendo editada en ese mismo momento por otro mozo, el sistema mostrará un mensaje indicando que la mesa se encuentra ocupada temporalmente para evitar pedidos duplicados.

### 6.2. Carta digital, pedidos y pago directo en mesa por código QR
* **Descripción:** Módulo web que permite a los clientes visualizar la carta del restaurante al escanear un código QR colocado en cada mesa, realizar sus pedidos y liquidar su cuenta directamente desde el celular sin necesidad de acudir a caja.
* **Prioridad:** Alta.
* **Acciones iniciadoras y comportamiento esperado:**
  * El cliente escanea el código QR de su mesa con su teléfono móvil.
  * El sistema despliega la carta con categorías: pollos, porciones, combos, guarniciones y bebidas.
  * El cliente selecciona los productos deseados, especificando las guarniciones o cremas, y puede confirmar su pedido o solicitar atención del personal.
  * Al terminar de comer, el comensal puede consultar su precuenta en la pantalla de su teléfono y presionar *"Pagar en Mesa"* para liquidar mediante pasarela web integrada (Yape, Plin o tarjetas), evitando acercarse a la caja.
* **Requerimientos detallados:**
  * **REQ-03:** El sistema permitirá el acceso directo a la carta digital mediante código QR identificado por mesa, validando que el acceso corresponda al servicio activo de dicha mesa para evitar órdenes no deseadas desde el exterior.
  * **REQ-04:** En los productos que requieran elección de presa (como el 1/4 de pollo), el sistema no permitirá agregar el ítem sin antes haber seleccionado obligatoriamente entre *pecho* o *pierna*.
  * **REQ-05:** La interfaz del cliente dispondrá de un botón para solicitar la presencia del mozo o pedir la cuenta de la mesa.
  * **REQ-06:** El sistema permitirá al cliente pagar el consumo de su mesa directamente desde la aplicación web mediante pasarela de pagos integrada; al confirmarse la transacción, el sistema marcará la mesa como pagada y alertará a caja y mozos para su posterior desocupación.
  * **Respuesta ante errores:** Si el cliente intenta agregar un producto que acaba de marcarse como no disponible, el sistema avisará al usuario con una notificación indicando que el plato se encuentra agotado en ese instante. Si la transacción de pago en línea falla, el sistema conservará la cuenta abierta notificando el error al usuario.

### 6.3. Toma de pedidos móvil para mozos (Tablets)
* **Descripción:** Pantalla táctil adaptada para que los mozos registren la orden de forma rápida al costado del cliente que prefiera atención tradicional.
* **Prioridad:** Alta.
* **Acciones iniciadoras y comportamiento esperado:**
  * El mozo pulsa sobre una mesa desocupada y visualiza la botonera de categorías.
  * Agrega los platos solicitados, añade notas especiales (ejemplo: *"papas bien doradas"*, *"sin ensalada"*) y presiona el botón de confirmación.
  * La orden se guarda de inmediato y se despacha a la cocina.
* **Requerimientos detallados:**
  * **REQ-06:** La interfaz para mozos debe contar con botones de tamaño adecuado para el uso táctil sin requerir teclado físico.
  * **REQ-07:** El sistema permitirá agregar consumos adicionales (como gaseosas o más porciones) a una cuenta abierta en cualquier momento del servicio.
  * **Respuesta ante errores:** Si se presenta una interrupción momentánea en la señal inalámbrica, el dispositivo mantendrá la información seleccionada sin borrar los datos hasta que se reestablezca la comunicación.

### 6.4. Envío directo de comanda a cocina con aviso sonoro
* **Descripción:** Módulo encargado de emitir físicamente la comanda en la impresora de la zona de preparación de manera inmediata.
* **Prioridad:** Alta.
* **Acciones iniciadoras y comportamiento esperado:**
  * Al confirmarse un pedido desde el salón o caja, el sistema envía la información a la impresora del cocinero.
  * La impresora emite un pitido o sonido de alerta para avisar al personal y expulsa el ticket con el detalle del pedido.
* **Requerimientos detallados:**
  * **REQ-08:** El sistema debe imprimir de forma automática la comanda en la estación de cocina, incluyendo número de mesa, hora, presa solicitada, acompañamientos y notas especiales.
  * **REQ-09:** Cada impresión de comanda nueva en cocina debe activar el timbre o zumbador sonoro de la impresora para alertar sobre el ruido ambiental.
  * **Respuesta ante errores:** Si la impresora se queda sin papel o se encuentra apagada, el sistema registrará la comanda en cola y alertará en la pantalla de caja sobre la falta de comunicación con la impresora de cocina.

### 6.5. Control de platos y productos agotados
* **Descripción:** Función que permite al personal suspender temporalmente la venta de un plato o ingrediente que se ha terminado en el turno.
* **Prioridad:** Media.
* **Acciones iniciadoras y comportamiento esperado:**
  * Cuando se agota una presa (ejemplo: piernas) o un producto en cocina, el cajero o administrador activa el botón de "Agotado".
  * El producto pasa inmediatamente a mostrarse como no disponible en la carta digital y en las pantallas de los mozos.
* **Requerimientos detallados:**
  * **REQ-10:** El sistema debe permitir deshabilitar cualquier plato o presa específica en un solo paso desde el panel principal.
  * **REQ-11:** Los productos deshabilitados no podrán ser seleccionados por ningún cliente ni mozo hasta que vuelvan a ser habilitados manualmente.

### 6.6. Módulo de cobro en caja y formas de pago
* **Descripción:** Módulo del terminal de caja para liquidar las mesas y procesar los cobros.
* **Prioridad:** Alta.
* **Acciones iniciadoras y comportamiento esperado:**
  * El cajero selecciona la mesa que va a pagar y visualiza el resumen detallado de consumos.
  * Si los clientes solicitan cuentas separadas, el cajero selecciona la opción de dividir cuenta.
  * Se registra el medio de pago (efectivo, Yape, Plin o tarjeta); si es en efectivo, el sistema calcula el vuelto a entregar y activa la apertura de la gaveta de dinero.
* **Requerimientos detallados:**
  * **REQ-12:** El sistema debe permitir dividir una cuenta grupal en múltiples pagos individuales si los clientes lo solicitan.
  * **REQ-13:** El sistema permitirá registrar pagos mixtos para una misma cuenta (ejemplo: una parte en efectivo y la otra mediante billetera digital).
  * **REQ-14:** El sistema enviará la señal de apertura a la gaveta de dinero únicamente cuando la operación de cobro involucre recepción de efectivo.

### 6.7. Emisión y distribución digital de comprobantes de pago (Boletas y Facturas)
* **Descripción:** Generación de comprobantes de venta oficiales con soporte para entrega física impresa o distribución digital mediante WhatsApp y correo electrónico.
* **Prioridad:** Alta.
* **Acciones iniciadoras y comportamiento esperado:**
  * Al cobrar (en caja o por pago web en mesa), el sistema consulta la modalidad de entrega: ticket físico impreso o comprobante digital ecológico.
  * Si se elige la vía digital, se digita el número de WhatsApp o correo electrónico del cliente, y el sistema despacha el comprobante en PDF de manera inmediata.
  * Si se solicita Factura, se ingresa el número de RUC y el sistema consulta en línea los datos de la empresa para autocompletar la razón social sin demoras de digitación.
  * Si se requiere impresión física, se imprime el ticket correspondiente en la impresora de caja.
* **Requerimientos detallados:**
  * **REQ-15:** El sistema debe facilitar la búsqueda y autocompletado de datos del cliente mediante DNI o RUC para la emisión de comprobantes.
  * **REQ-16:** El sistema debe calcular de forma automática el desglose de impuestos (como el IGV) en los comprobantes requeridos.
  * **REQ-17:** El sistema permitirá el envío automático del comprobante electrónico en formato PDF vía WhatsApp o correo electrónico, además de mostrar un código QR en pantalla para su descarga directa.
  * **Respuesta ante errores:** En caso de no contar con conexión externa al servicio de facturación electrónica o fallas de mensajería, el sistema permitirá emitir una nota de venta interna de contingencia y encolará el comprobante digital para su envío posterior.

### 6.8. Control de turnos y cierre diario de caja
* **Descripción:** Control de la apertura, movimiento de dinero y cierre de la jornada comercial.
* **Prioridad:** Alta.
* **Acciones iniciadoras y comportamiento esperado:**
  * Al abrir el turno, el cajero ingresa el monto de sencillo inicial en caja.
  * Durante el día se registran salidas menores de dinero con motivo justificado (ejemplo: compras menores urgentes).
  * Al final del turno, el cajero cuenta el efectivo físico y lo declara en el sistema a ciegas (sin ver el total que el sistema tiene calculado), emitiendo el reporte consolidado de cierre.
* **Requerimientos detallados:**
  * **REQ-17:** El sistema registrará el monto de apertura y los movimientos de entrada y salida de dinero durante cada turno.
  * **REQ-18:** El cierre de turno se realizará mediante conteo ciego, donde el cajero ingresa el efectivo real existente sin que el software le muestre previamente la cifra acumulada, previniendo manipulaciones de saldos.
  * **REQ-19:** El sistema generará un reporte de cierre de caja (conocido en el rubro como Reporte Z) que detalle los totales vendidos clasificados por cada modalidad de cobro.

### 6.9. Pedidos para llevar y delivery
* **Descripción:** Registro y seguimiento de órdenes para retiro en mostrador y pedidos con entrega a domicilio.
* **Prioridad:** Media.
* **Acciones iniciadoras y comportamiento esperado:**
  * Para llevar: El cajero registra la orden indicando el nombre del cliente y cobrando por adelantado; la comanda sale rotulada para el cocinero para su empaque.
  * Delivery: Se registra el nombre, teléfono y dirección del cliente. Si el cliente indica que pagará en efectivo con un billete de denominación alta, el sistema calcula en la hoja de entrega el vuelto que debe llevar el repartidor.
* **Requerimientos detallados:**
  * **REQ-20:** El sistema identificará claramente en el ticket de cocina si un pedido es para consumo en salón o empaquetado para llevar.
  * **REQ-21:** En los pedidos de delivery, el sistema imprimirá una hoja de ruta con la dirección del cliente, teléfono y el vuelto exacto a entregar por el repartidor.

### 6.10. Control básico de insumos y registro de mermas
* **Descripción:** Seguimiento del consumo diario de pollos y registro formal de pérdidas por fallas de cocción o reclamos.
* **Prioridad:** Media.
* **Acciones iniciadoras y comportamiento esperado:**
  * Cada plato vendido descuenta del inventario su proporción correspondiente (pollo entero, medio, cuarto u octavo de pollo).
  * Si un plato se quema o sufre un accidente en cocina o salón, el administrador registra el incidente indicando el motivo para justificar la diferencia de stock al final del día.
* **Requerimientos detallados:**
  * **REQ-22:** El sistema descontará proporcionalmente las unidades de pollo del inventario con cada comanda confirmada.
  * **REQ-23:** Las anulaciones de pedidos ya enviados a cocina o el registro de platos devueltos requerirán la autorización del Administrador mediante clave o PIN de seguridad.

## 7. Reglas de negocio

* **RN-01 Elección obligatoria de presas:** No se permitirá guardar ni imprimir comandas de cuartos de pollo sin haber especificado claramente si el cliente desea *pecho con ala* o *pierna con encuentro*.
* **RN-02 Arqueo ciego obligatorio:** El personal de caja no podrá consultar el total recaudado en el sistema antes de haber ingresado el monto de dinero físico que tiene en gaveta.
* **RN-03 Autorización administrativa para anulaciones:** Los mozos no podrán anular productos de una comanda ya confirmada; cualquier anulación o corrección deberá ser aprobada por el Administrador.
* **RN-04 Carta con precios configurables:** La lista de platos, guarniciones, bebidas y sus respectivos precios será completamente administrable por el dueño del negocio desde el panel de control, adaptándose a cualquier carta.
* **RN-05 Prioridad del pedido de salón sobre despacho:** Las mesas del salón mantendrán su cuenta abierta hasta que el cliente decida retirarse y pagar en caja o mesa, permitiendo agregar productos de forma progresiva.
* **RN-06 Registro justificado de mermas:** Todo plato o presa retirada por falla de cocción o caída accidental debe registrarse con un motivo formal en el sistema para que no sea considerado como faltante no justificado.
* **RN-07 Confirmación de pago web en mesa:** Las transacciones canceladas directamente por el comensal desde la app web exigirán la validación exitosa de la pasarela de pagos para dar por liberada la cuenta y notificar en tiempo real a mozos y caja.
* **RN-08 Distribución digital ecológica de comprobantes:** Todo cliente podrá optar libremente por recibir su comprobante fiscal por canales digitales (WhatsApp o correo) en lugar del comprobante impreso en papel térmico.

## 8. Requerimientos de interfaces externas

### 8.1. Interfaces de usuario
* **Diseño para salón y clientes (QR y Pago en Mesa):** Pantalla limpia, legible desde teléfonos celulares, con fotografías de los platos, botones grandes y acceso rápido para ordenar, solicitar asistencia, pagar en línea y registrar los datos para el envío del comprobante digital.
* **Diseño para mozos y caja:** Interfaz táctil ergonómica con botones de tamaño accesible para los dedos, contrastes adecuados para salones con poca luz y navegación sencilla entre categorías de la carta.

### 8.2. Interfaces de hardware
* **Impresoras térmicas de tickets:** Compatibilidad con impresoras estándar de recibos de 80 mm para cocina (conexión por cable de red) y para caja (conexión USB).
* **Gaveta de dinero:** Conexión a la impresora de caja para apertura automática mediante pulso eléctrico al cobrar en efectivo.
* **Dispositivos móviles:** Soporte para funcionamiento en tablets y teléfonos con sistema operativo Android.

### 8.3. Interfaces de software
* **Base de datos:** Conexión con motor de base de datos relacional (PostgreSQL) para la integridad de los registros.
* **Servicios de consulta de documentos:** Interacción con servicios web estándar para la consulta en línea de datos de DNI y RUC al momento de facturar.
* **Sistema de facturación electrónica:** Comunicación con servicios de emisión de comprobantes autorizados para la generación de boletas y facturas digitales.
* **Pasarela de pagos en línea:** Integración con pasarelas web seguras para el procesamiento de cobros desde el teléfono móvil mediante billeteras digitales y tarjetas bancarias.
* **Servicios de mensajería y correo:** Conexión con APIs de mensajería (WhatsApp) y correo electrónico (SMTP) para la entrega inmediata de boletas y facturas en formato digital PDF.

### 8.4. Interfaces de comunicación
* **Red local (LAN/WiFi):** Comunicación interna fluida entre las tablets de los mozos, la computadora de caja y la impresora de cocina mediante la red interna del local, garantizando que el restaurante siga atendiendo aun si el internet se corta momentáneamente.
* **Seguridad de red:** Canales separados para los equipos de trabajo del restaurante y la red inalámbrica de acceso para los comensales.

## 9. Requerimientos no funcionales

* **RND-01 Facilidad de uso:** La interfaz de toma de pedidos para el personal debe ser intuitiva, requiriendo un periodo mínimo de capacitación para nuevos trabajadores.
* **RND-02 Rapidez de respuesta:** La carta digital debe abrir de forma ágil en los celulares de los clientes y las comandas deben imprimirse en cocina en cuestión de pocos segundos tras su envío.
* **RND-03 Continuidad operativa local:** La atención en salón, comanda a cocina y cobro de cuentas no debe paralizarse si ocurre una caída momentánea en el servicio de internet externo.
* **RND-04 Integridad de datos:** Las cuentas y transacciones de dinero deben registrarse de forma exacta, evitando duplicación de cobros o pérdida de pedidos ante desconexiones.

## 10. Otros requerimientos

* **Requerimientos Legales y Tributarios:** El sistema debe cumplir con la legislación nacional correspondiente a la emisión de comprobantes de pago autorizados (boletas y facturas) y facilitar la inclusión de información sobre el Libro de Reclamaciones según la normativa vigente.
* **Mantenimiento y Respaldo:** El sistema deberá facilitar la realización de copias de seguridad de las ventas y la base de datos de manera periódica.
* **Idioma y Moneda:** El sistema estará configurado en idioma español y adaptado a la moneda nacional (Soles).

## 11. Glosario

* **Arqueo Ciego:** Procedimiento de control en el que el cajero cuenta y declara el dinero físico en mano sin conocer previamente el monto teórico que calculó el sistema, evitando manipulaciones en el cuadre.
* **Buzzer:** Alarma o zumbador acústico integrado en la impresora térmica de cocina para emitir un aviso sonoro cada vez que llega una nueva comanda.
* **Carta Digital:** Menú interactivo en formato web al que los clientes acceden escaneando un código QR desde su teléfono móvil.
* **Cierre Diario de Caja (Reporte Z):** Documento resumen que emite el sistema al final del turno de trabajo, mostrando el total de las ventas cobradas, detalladas por cada medio de pago (efectivo, tarjetas o billeteras digitales).
* **Comanda:** Lista detallada de los platos, presas y bebidas solicitadas por una mesa que se envía a la cocina para su preparación.
* **Comprobante Digital:** Documento electrónico tributario (Boleta o Factura en PDF y XML) enviado al cliente por canales digitales (WhatsApp o correo) sin recurrir al papel térmico.
* **Merma:** Pérdida de insumos o platos terminados originada por fallas en la preparación, quemado en brasas o roturas accidentales.
* **Modificadores:** Opciones adicionales o variaciones que el cliente puede elegir sobre un plato base (ejemplo: elección de presa pecho o pierna, tipo de papas o cremas).
* **Pago en Mesa (Self-Checkout):** Modalidad en la que el comensal consulta y liquida su cuenta de forma autónoma desde su teléfono celular a través de la aplicación web sin acercarse a la caja.
* **PostgreSQL:** Sistema de gestión de bases de datos relacional de código abierto utilizado para organizar y almacenar la información del negocio.
* **Split Bill (Dividir Cuenta):** Funcionalidad que permite repartir el total del consumo de una mesa entre varios comensales, emitiendo comprobantes individuales según lo que cada persona consumió o aportó.
