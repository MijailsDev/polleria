# Documento de Requerimientos de Software

**Proyecto:** SISTEMA PARA POLLERIAS
**Sistema:** Sistema de Gestión Web y Automatización Operativa
**Curso:** Análisis y Diseño de Sistemas II (ADS II)
**Docente:** Dr. Dany Dorian Isuiza Pérez
**Integrantes:**
* ENRIQUEZ HUARHUA NILTON
* QUISPE QUISPE MIJAIL
**Institución:** Universidad Nacional Amazónica de Madre de Dios (UNAMAD)
**Fecha:** 28 de Septiembre de 2026

## Contenido

1. Propósito
2. Alcance del producto / Software
3. Funcionalidades del producto
4. Clases y características de usuarios
5. Entorno operativo
6. Requerimientos funcionales
7. Reglas de negocio
8. Requerimientos de interfaces externas
9. Requerimientos no funcionales
10. Otros requerimientos
11. Glosario

## 1. Propósito

El presente documento establece la Especificación de Requerimientos de Software (SRS) para el **"SISTEMA PARA POLLERIAS"** (Versión 1.0). Su objetivo es definir con precisión las necesidades funcionales, operativas y de control que guiarán el desarrollo de la solución informática para el curso de Análisis y Diseño de Sistemas II en la UNAMAD.

Este documento cubre la totalidad del alcance del software y sus procesos operativos clave:
* Gestión de salón y atención en mesas (tanto por autoservicio del cliente mediante código QR como por atención asistida por mozos mediante dispositivos móviles).
* Producción y despacho en cocina (emisión automática de comandas en la estación de brasas con alerta sonora para superar el ruido del extractor).
* Mostrador de caja y finanzas (cobranza en múltiples modalidades, arqueo ciego de turnos y emisión de comprobantes de pago).
* Módulo de pedidos para llevar (Takeout) y reparto a domicilio (Delivery).
* Control de almacén de pollos, balance de presas y registro auditado de mermas.
* Resiliencia operativa mediante red local (LAN) para garantizar que el restaurante no detenga su atención ante eventuales caídas del servicio de internet exterior.

## 2. Alcance del producto / Software

### 2.1. Propósito y Objetivo General
Desarrollar e implementar un sistema de gestión web centralizado y multi-dispositivo diseñado para optimizar el flujo de pedidos, producción, cobranza y control de existencias en restaurantes de pollería y brasas, erradicando el uso de comandas de papel y minimizando tiempos muertos y errores humanos durante las horas de alta afluencia.

### 2.2. Beneficios para el Área de Negocio
* **Eliminación de errores en preparación:** El sistema exige la especificación forzosa de presas (pecho con ala o pierna con encuentro) en los cuartos de pollo, suprimiendo las devoluciones de platos y pérdidas económicas por platos fríos.
* **Agilización del servicio en salón:** La implementación de la carta digital mediante código QR permite al comensal revisar el menú y ordenar de forma autónoma, reduciendo la saturación de los mozos en horas punta.
* **Comunicación efectiva con cocina:** Las órdenes se imprimen de manera instantánea en la estación del maestro pollero acompañadas de una alarma sonora industrial, evitando que las comandas se traspapelen o se manchen por la grasa.
* **Fluidez en cobranza y pago en mesa:** Organización de cobros con billeteras digitales (Yape, Plin), tarjetas y efectivo, eliminando cuellos de botella en caja y permitiendo tanto el pago tradicional como el pago directo desde el teléfono celular del comensal sin necesidad de acudir al mostrador.
* **Distribución digital y ecológica de comprobantes:** El cliente tiene la opción de recibir su boleta o factura electrónica vía WhatsApp, correo electrónico o descarga directa, agilizando su salida del local y reduciendo sustancialmente el consumo de papel térmico.
* **Seguridad y transparencia financiera:** El arqueo ciego impide que el cajero conozca el saldo teórico del sistema antes de declarar el efectivo físico, evitando manipulaciones en los cuadres diarios.

### 2.3. Objetivos y Metas del Software
* Incrementar la velocidad de rotación de mesas en horas de alta demanda.
* Reducir a cero la pérdida de comandas entre el salón y el área de horneado.
* Mantener la operatividad continua de salón y cocina en red local ante cortes del enlace a internet externo.
* Garantizar un control estricto de mermas y auditoría de anulaciones con clave administrativa.

## 3. Funcionalidades del producto

A continuación se listan las diez principales funcionalidades que estructuran el sistema:

1. **F1: Gestión gráfica de distribución de mesas y salón:** Visualización interactiva del estado de las mesas del restaurante en una sola pantalla, con opciones para fusionar o trasladar cuentas.
2. **F2: Carta digital interactiva, pedidos y pago directo en mesa por código QR:** Menú web ligero para smartphones accesible sin instalación para que los comensales consulten productos, seleccionen modificadores, envíen pedidos y cancelen su cuenta directamente desde el celular sin desplazarse a la caja.
3. **F3: Comanda móvil táctil para mozos:** Interfaz optimizada para dispositivos móviles y tablets que permite la toma de pedidos asistida al lado de la mesa.
4. **F4: Enrutamiento e impresión en cocina con aviso sonoro:** Emisión física instantánea de la comanda en la impresora de brasas con activación de zumbador acústico (buzzer).
5. **F5: Control dinámico de productos agotados (Protocolo 86):** Deshabilitación en un solo paso de platos o presas sin stock con actualización en vivo en todos los dispositivos.
6. **F6: Punto de venta (POS) y cobranza multimétodo:** Liquidación de mesas con soporte de pagos combinados, pago individual y división de cuenta (Split Bill).
7. **F7: Emisión y distribución digital de comprobantes de venta:** Generación de boletas de venta, facturas con autocompletado de RUC/DNI y notas de venta, con opción de entrega física en papel o envío ecológico inmediato por WhatsApp, correo electrónico o descarga directa en PDF.
8. **F8: Control de turnos y arqueo ciego de caja:** Registro de apertura, control de egresos menores justificados y reporte consolidado de cierre de jornada (Reporte Z).
9. **F9: Módulo de pedidos para llevar y despacho a domicilio:** Registro de órdenes para retiro en mostrador y gestión de delivery con hoja de ruta y cálculo de vuelto.
10. **F10: Kardex cárnico proporcional y control de mermas:** Descuento fraccionario de existencias de pollo y registro formal de platos devueltos o quemados con autorización protegida.

## 4. Clases y características de usuarios

| Clase de Usuario | Características y Experiencia | Dispositivo Principal | Frecuencia de Uso | Funcionalidades Relevantes |
| :--- | :--- | :--- | :--- | :--- |
| **Comensal (Cliente)** | Usuario externo ocasional; no requiere autenticación previa. Navegación sencilla e intuitiva. | Smartphone personal (Navegador web). | Ocasional (durante su estancia en el restaurante). | F2 (Consulta de carta QR, modificadores, llamado a mozo, pago web en mesa y recepción de comprobante por WhatsApp/correo). |
| **Mozo / Mesero** | Personal operativo de salón; requiere botones táctiles grandes y respuesta rápida. | Tablet o smartphone del establecimiento. | Continua y constante durante todo el turno. | F1 (Plano de mesas), F3 (Toma de comanda), F5 (Consulta de platos disponibles). |
| **Maestro Pollero / Cocinero** | Personal de producción; expuesto al calor y grasa, no interactúa con pantallas táctiles. | Impresora térmica en la estación de brasas. | Receptiva continua (recibe tickets y alertas sonoras). | F4 (Recepción de comanda física con timbre de aviso). |
| **Cajero(a)** | Responsable del flujo de dinero y comprobantes; nivel técnico intermedio en uso de interfaces POS. | Terminal o computadora de caja en mostrador. | Permanente durante toda la jornada de atención. | F1, F6 (Cobro de mesas), F7 (Facturación), F8 (Apertura y arqueo ciego), F9 (Takeout). |
| **Repartidor / Motorizado** | Personal de logística externa; consulta direcciones y montos de cobranza. | Hoja de ruta impresa o dispositivo móvil. | Por carrera o despacho de delivery. | F9 (Entrega domiciliaria, cobro contra entrega y rendición de vuelto). |
| **Administrador / Dueño** | Rol de máxima jerarquía; gestiona precios, supervisa reportes y autoriza anulaciones. | Computadora de escritorio o dispositivo remoto. | Periódica / Supervisión y cierre diario. | Acceso total (F1 a F10), configuración de carta, aprobación de mermas y Reporte Z. |

## 5. Entorno operativo

* **Dispositivos de Salón:**
  * Tablets o teléfonos inteligentes con sistema operativo Android para el uso de los mozos, con navegadores web modernos y pantallas táctiles capacitivas.
  * Teléfonos inteligentes personales de los comensales (Android o iOS) con lectores de códigos QR y navegadores web estándar (Google Chrome, Safari, Mozilla Firefox).
* **Estación de Caja:** Computadora de escritorio o terminal táctil All-in-One con sistema operativo Windows o Linux, conectada mediante puerto USB a una impresora térmica de recibos y a una gaveta portadinero con apertura eléctrica.
* **Estación de Cocina / Brasas:** Impresora térmica para rollo de papel de 80 mm conectada a la red local mediante cable de red (Ethernet), provista de zumbador acústico de alta potencia (buzzer) resistente a temperaturas elevadas y vapores de cocina.
* **Infraestructura de Servidor y Resiliencia Local:**
  * Servidor local de soporte (Edge Gateway) ubicado en caja, equipado con sistema de alimentación ininterrumpida (UPS de respaldo ante cortes eléctricos) que garantiza la continuidad operativa de la red interna.
  * Base de datos relacional (PostgreSQL) para la persistencia íntegra y segura de comandas, kardex y ventas.
* **Red de Comunicaciones:** Router inalámbrico de doble banda con segmentación de red en dos redes virtuales:
  * Red de Operaciones: Oculta y de uso exclusivo para las tablets de los mozos, la computadora de caja y la impresora de cocina, con prioridad de tráfico asegurada.
  * Red de Clientes: Red pública independiente para el acceso de comensales.

## 6. Requerimientos funcionales

### 6.1. Gestión gráfica de distribución de mesas y salón
* **Descripción:** Panel gráfico interactivo que representa la distribución física de las mesas del establecimiento, permitiendo monitorear su estado en tiempo real.
* **Prioridad:** Alta.
* **Acciones iniciadoras y comportamiento esperado:**
  * El mozo o cajero accede al módulo de salón y visualiza el mapa de mesas con su respectivo código numérico.
  * Cada mesa refleja visualmente su estado: libre, ocupada con comanda activa, o con precuenta solicitada.
  * El personal puede pulsar sobre una mesa para abrir su detalle de consumos, reubicar la orden a otra mesa por mudanza de clientes o fusionar dos mesas continuas para grupos grandes.
* **Requerimientos funcionales detallados:**
  * **REQ-1:** El sistema debe mostrar el plano del salón actualizando el estado de ocupación de las mesas de manera inmediata ante cualquier cambio de estado.
  * **REQ-2:** El sistema debe permitir la transferencia de comanda entre mesas y la fusión de cuentas de mesas contiguas, consolidando los productos en una única cuenta final.
  * **Comportamiento ante errores:** Si dos mozos intentan abrir o modificar la misma mesa de forma simultánea, el sistema bloqueará la acción concurrente mostrando un aviso: *"La mesa seleccionada se encuentra en edición por otro usuario"*, evitando la duplicación de órdenes.

### 6.2. Carta digital interactiva, pedidos y pago directo en mesa por código QR
* **Descripción:** Aplicación web accesible al escanear el código QR colocado en cada mesa, permitiendo a los clientes revisar la oferta gastronómica, ordenar de forma autónoma y liquidar su cuenta directamente desde su celular sin necesidad de acudir a caja.
* **Prioridad:** Alta.
* **Acciones iniciadoras y comportamiento esperado:**
  * El comensal escanea el código QR de su mesa con su teléfono móvil.
  * El sistema carga la carta organizada por secciones: pollos a la brasa, porciones, platos compuestos (mostritos), acompañamientos y bebidas.
  * Al seleccionar un cuarto de pollo, el sistema despliega la selección obligatoria de la presa.
  * El cliente confirma su pedido o pulsa el botón de asistencia para llamar al personal.
  * Al culminar su consumo, el comensal puede presionar la opción *"Pagar Cuenta en Mesa"*, revisar el desglose de su precuenta y efectuar el pago mediante pasarela web integrada (billeteras digitales como Yape/Plin o tarjetas) sin tener que hacer filas en el mostrador.
* **Requerimientos funcionales detallados:**
  * **REQ-3:** El sistema permitirá el acceso a la carta digital mediante código QR vinculado a una mesa física activa, validando la sesión para impedir pedidos involuntarios o remotos desde fuera del salón.
  * **REQ-4:** En platos con opciones de corte (como el cuarto de pollo), el software bloqueará el guardado del producto hasta que el usuario elija obligatoriamente entre *pecho con ala* o *pierna con encuentro*.
  * **REQ-5:** La interfaz del comensal debe incluir botones de acción directa para solicitar la presencia del mozo en la mesa o pedir la precuenta del consumo.
  * **REQ-6:** El sistema permitirá al comensal pagar el consumo total de su mesa directamente desde la app web mediante una pasarela de pago en línea; al confirmarse el abono de forma exitosa, la mesa pasará a estado de "Pagada" y notificará de inmediato al mozo y a caja para la liberación del servicio.
  * **Comportamiento ante errores:** Si el cliente intenta confirmar un producto que acaba de agotarse en cocina, el sistema cancelará la selección del ítem e informará con una alerta clara: *"El producto seleccionado se encuentra agotado momentáneamente, por favor elija otra opción"*. Si una transacción de pago en mesa es rechazada por la pasarela, el sistema mantendrá la cuenta abierta e informará el motivo del rechazo al usuario.

### 6.3. Comanda móvil táctil para mozos
* **Descripción:** Interfaz móvil diseñada para agilizar la toma de pedidos presencial realizada por los mozos en salón.
* **Prioridad:** Alta.
* **Acciones iniciadoras y comportamiento esperado:**
  * El mozo selecciona una mesa libre en su dispositivo móvil y añade los platos indicados verbalmente por los clientes.
  * Marca guarniciones específicas o notas especiales de cocina (como *"papas bien crocantes"* o *"sin ensalada, aumentar papas"*).
  * Presiona *"Comandar"*; el pedido se registra de inmediato y se despacha a la impresora de cocina.
* **Requerimientos funcionales detallados:**
  * **REQ-7:** La interfaz táctil para mozos debe contar con botones de dimensiones amplias que permitan una pulsación ágil y precisa con una sola mano sin teclado físico.
  * **REQ-8:** El sistema permitirá añadir consumos complementarios (adición de bebidas o porciones extra) a una mesa con comanda abierta en cualquier instante del servicio.
  * **Comportamiento ante errores:** En caso de corte transitorio de la señal inalámbrica en algún rincón del salón, el dispositivo mantendrá los datos del pedido en memoria y reintentará el envío en cuanto recupere la conexión sin borrar la orden tomada.

### 6.4. Enrutamiento e impresión en cocina con aviso sonoro
* **Descripción:** Servicio automatizado encargado de imprimir la comanda en la impresora de la zona de brasas y emitir un sonido de advertencia audible.
* **Prioridad:** Alta.
* **Acciones iniciadoras y comportamiento esperado:**
  * Al confirmarse un pedido desde el menú QR o la tablet del mozo, el sistema procesa la orden y la transmite a la impresora térmica de cocina.
  * La impresora activa su zumbador o timbre sonoro y genera el ticket impreso con texto de gran tamaño.
  * El maestro pollero toma el ticket, troza el pollo solicitado y monta el plato para su despacho.
* **Requerimientos funcionales detallados:**
  * **REQ-9:** El sistema debe imprimir de forma automática la comanda en la estación de cocina detallando claramente número de mesa, hora, mozo responsable, presa requerida, papas, ensaladas y cremas.
  * **REQ-10:** Cada impresión de comanda nueva debe activar la alarma sonora de la impresora térmica para advertir al hornero por encima del ruido ambiental de campanas y extractores.
  * **Comportamiento ante errores:** Si la impresora de cocina se queda sin rollo de papel o se encuentra desconectada, el sistema conservará la orden en una cola de pendientes y mostrará una alerta en la pantalla de caja advirtiendo la falla de impresión.

### 6.5. Control dinámico de productos agotados (Protocolo 86)
* **Descripción:** Mecanismo administrativo para desactivar en tiempo real platos o presas que se hayan terminado durante la jornada.
* **Prioridad:** Media.
* **Acciones iniciadoras y comportamiento esperado:**
  * Al acabarse un insumo (por ejemplo, las piernas de pollo), el administrador o cajero pulsa el control de *"Agotar"* sobre dicho ítem.
  * De forma inmediata, el ítem cambia a estado deshabilitado en todos los teléfonos de clientes y tablets de mozos.
* **Requerimientos funcionales detallados:**
  * **REQ-11:** El sistema debe permitir inhabilitar la venta de cualquier plato o presa individual en un solo paso desde el panel de control.
  * **REQ-12:** Los productos marcados como agotados se mostrarán en tono atenuado y con la opción de selección bloqueada en todos los puntos de toma de pedidos.

### 6.6. Punto de venta (POS) y cobranza multimétodo
* **Descripción:** Módulo de caja destinado a consultar la liquidación de las mesas y procesar los cobros bajo diferentes formas de pago.
* **Prioridad:** Alta.
* **Acciones iniciadoras y comportamiento esperado:**
  * El cajero selecciona la mesa que va a pagar y revisa los consumos acumulados.
  * Si los clientes solicitan pagar de forma separada, el cajero pulsa *"Dividir Cuenta"* y selecciona los ítems o importes asignados a cada comensal.
  * Se selecciona el medio de pago: efectivo, billetera digital (Yape, Plin) o tarjeta; si interviene efectivo, el sistema calcula el vuelto y abre la gaveta de dinero.
* **Requerimientos funcionales detallados:**
  * **REQ-13:** El sistema debe permitir la división de cuentas colectivas en múltiples pagos independientes, emitiendo comprobantes separados que sumen exactamente el importe total.
  * **REQ-14:** El sistema admitirá pagos combinados para liquidar una sola cuenta (por ejemplo, un importe abonado en efectivo y el saldo transferido por billetera digital).
  * **REQ-15:** El sistema enviará la señal de apertura eléctrica a la gaveta de dinero únicamente cuando el cobro registrado incluya pago en efectivo.

### 6.7. Emisión y distribución digital de comprobantes de venta
* **Descripción:** Generación y despacho de comprobantes de venta oficiales (Boletas y Facturas) tanto en formato impreso en papel térmico como por canales digitales ecológicos (WhatsApp y correo electrónico).
* **Prioridad:** Alta.
* **Acciones iniciadoras y comportamiento esperado:**
  * Al liquidar la cuenta (sea en mostrador de caja o mediante pago web en mesa), el sistema consulta la modalidad de entrega del comprobante preferida por el comensal.
  * Si se elige entrega digital, el cliente o cajero indica el número de WhatsApp o correo electrónico de destino; el sistema genera el archivo digital (PDF y XML firmado) y lo envía automáticamente sin necesidad de imprimir en papel.
  * Opcionalmente, la pantalla muestra un código QR para que el cliente pueda descargar o visualizar el comprobante en su móvil al instante.
  * Si se elige Factura, se introduce el número de RUC y el software consulta el servicio de identificación para autocompletar razón social y dirección fiscal sin demoras de digitación.
* **Requerimientos funcionales detallados:**
  * **REQ-16:** El sistema debe autocompletar en línea los datos fiscales del cliente mediante la búsqueda de su documento de identidad (DNI o RUC).
  * **REQ-17:** El sistema calculará de forma automática los importes gravados y el desglose de impuestos correspondientes (como el IGV).
  * **REQ-18:** El sistema permitirá el envío automático del comprobante electrónico oficial en formato PDF al número de WhatsApp o a la dirección de correo electrónico indicada por el cliente, además de generar un enlace o QR de descarga directa en pantalla.
  * **Comportamiento ante errores:** En caso de corte de conexión con el servicio tributario o falla en la mensajería externa, el sistema generará una nota de venta interna de contingencia y encolará el comprobante digital para su envío automático tan pronto se restablezca el enlace.

### 6.8. Control de turnos y arqueo ciego de caja
* **Descripción:** Procedimiento de auditoría de caja que previene descuadres y robos sistemáticos de efectivo al cierre del día.
* **Prioridad:** Alta.
* **Acciones iniciadoras y comportamiento esperado:**
  * Al iniciar el turno, el cajero registra el fondo inicial de sencillo.
  * Durante el día registra egresos menores justificados (como compras urgentes autorizadas).
  * Al cerrar el turno, el cajero cuenta físicamente los billetes y monedas y los introduce en el sistema sin conocer la cifra que el software espera (*conteo ciego*).
  * El sistema contrasta las cifras y genera el reporte consolidado de cierre de caja (Reporte Z).
* **Requerimientos funcionales detallados:**
  * **REQ-19:** El sistema registrará el balance de apertura, ingresos por ventas y egresos autorizados ocurridos a lo largo del turno.
  * **REQ-20:** El módulo de cierre de caja debe operar bajo la modalidad de arqueo ciego, impidiendo al cajero consultar el total recaudado antes de registrar su declaración de dinero físico.
  * **REQ-21:** El sistema emitirá el reporte de cierre diario de caja (Reporte Z) clasificando las ventas por cada modalidad de pago (efectivo, transferencias y tarjetas).

### 6.9. Módulo de pedidos para llevar y despacho a domicilio
* **Descripción:** Administración de ventas para llevar en mostrador y pedidos con entrega a domicilio a través de repartidores propios.
* **Prioridad:** Media.
* **Acciones iniciadoras y comportamiento esperado:**
  * Para llevar: La cajera ingresa la orden marcándola como *"Para Llevar"*, anota el nombre del cliente y efectúa el cobro por adelantado; la comanda sale rotulada a cocina para su empaquetado.
  * Delivery: Se ingresa el nombre, teléfono y dirección del cliente. Si el cliente indica que pagará con billete de alta denominación, el sistema calcula en la hoja de entrega el vuelto que debe portar el repartidor.
* **Requerimientos funcionales detallados:**
  * **REQ-22:** El sistema debe rotular de manera diferenciada en la comanda de cocina los pedidos de consumo en salón frente a los empaquetados para llevar.
  * **REQ-23:** En los pedidos de despacho a domicilio, el sistema generará una hoja de reparto con la dirección de entrega, número telefónico y el vuelto exacto a entregar por el motorizado.

### 6.10. Kardex cárnico proporcional y control de mermas
* **Descripción:** Control de inventario de pollos enteros y fracciones, junto con el registro formal de pérdidas por sobrecocción o quejas de comensales.
* **Prioridad:** Media.
* **Acciones iniciadoras y comportamiento esperado:**
  * Cada plato vendido descuenta del inventario su fracción correspondiente de pollo entero (entero: 1.0, medio: 0.5, cuarto: 0.25, octavo: 0.125).
  * Si una presa se sobrecocina o un cliente solicita cambio por defecto de cocción, el administrador registra el incidente especificando la causa de la merma.
* **Requerimientos funcionales detallados:**
  * **REQ-24:** El sistema descontará proporcionalmente las unidades de pollo del inventario de acuerdo con cada comanda confirmada.
  * **REQ-25:** La anulación de pedidos ya despachados o el registro de platos descartados por merma requerirá obligatoriamente la aprobación del Administrador mediante PIN de seguridad.

## 7. Reglas de negocio

* **RN-1 Elección obligatoria de presa en cuartos de pollo:** Ninguna orden que contenga 1/4 de pollo a la brasa podrá ser procesada ni enviada a cocina sin haber determinado obligatoriamente si corresponde a *pecho con ala* o *pierna con encuentro*.
* **RN-2 Obligatoriedad del arqueo ciego:** El personal de caja tiene restringido el acceso al total teórico recaudado hasta que haya completado la declaración del conteo físico de billetes y monedas.
* **RN-3 Autorización administrativa de anulaciones:** Queda prohibido que el personal de mozos o caja anule productos de una comanda ya confirmada; toda modificación o cancelación exige el ingreso de la clave o PIN del Administrador.
* **RN-4 Catálogo y precios dinámicamente configurables:** La lista de productos, platos, combos, bebidas y sus importes monetarios será totalmente administrable por el dueño del negocio desde el panel de control, adaptándose a cualquier carta.
* **RN-5 Bloqueo de concurrencia de mesas:** El sistema impedirá que dos mozos interactúen de forma simultánea sobre una misma mesa del salón para evitar pedidos contradictorios o cuentas superpuestas.
* **RN-6 Registro y justificación de mermas:** Cualquier presa o plato devuelto por falla de preparación deberá ser registrado con motivo justificado para no considerarse como faltante no justificado en el inventario.
* **RN-7 Cálculo impositivo en comprobantes:** Todo comprobante de venta formal deberá calcular y desglosar automáticamente los impuestos de ley (IGV).
* **RN-8 Continuidad operativa local:** La atención de comandas en salón y producción en cocina nunca se suspenderá por caídas o fallas en el servicio de internet exterior.
* **RN-9 Confirmación de pago web en mesa:** Toda liquidación realizada directamente desde la aplicación web del comensal requerirá la validación exitosa de la pasarela de pagos antes de liberar el estado de la cuenta; una vez confirmado el abono, el sistema notificará con una alerta visual en la tablet del mozo y en el terminal de caja.
* **RN-10 Distribución digital ecológica de comprobantes:** Todo comensal podrá optar libremente por recibir su comprobante fiscal por canales digitales (WhatsApp o correo electrónico) en lugar del comprobante impreso en papel térmico, teniendo ambas opciones plena equivalencia tributaria y operativa.

## 8. Requerimientos de interfaces externas

### Interfaces de usuario
* **Interfaz de comensal (Carta QR y Pago en Mesa):** Diseño enfocado en dispositivos móviles (*mobile-first*), con tipografía clara y legible, fotografías ilustrativas de los platos, botones de acción destacados para ordenar, llamar al personal, pagar en línea y registrar los datos de envío digital del comprobante.
* **Interfaz de mozos y caja:** Diseño táctil ergonómico con botones amplios, paleta de colores de alto contraste apta para condiciones de baja luminosidad y navegación directa entre categorías sin menús anidados profundos.

### Interfaces de hardware
* **Impresoras térmicas de tickets:** Compatibilidad con impresoras de recibos estándar de 80 mm para cocina (conexión por cable de red Ethernet) y para mostrador de caja (conexión USB).
* **Gaveta metálica portadinero:** Conexión física a la impresora de recibos de caja para apertura automática mediante pulso eléctrico tras procesar cobros en efectivo.
* **Dispositivos móviles:** Compatibilidad con tablets y teléfonos inteligentes con sistema operativo Android.
* **Respaldo eléctrico (UPS):** Sistema de batería de respaldo que proteja la computadora principal y el router del local ante fluctuaciones o cortes del suministro eléctrico.

### Interfaces de software
* **Base de datos:** Comunicación con motor de base de datos relacional (PostgreSQL) para la persistencia íntegra de comandas, usuarios, productos y pagos.
* **Servicios de consulta de identidad:** Conexión con servicios web externos para la consulta rápida de datos de DNI y RUC al momento de emitir comprobantes.
* **Facturación electrónica:** Integración con servicios autorizados de emisión de comprobantes de pago digitales.
* **Pasarela de pagos en línea:** Integración con servicio seguro de cobro web para procesar transacciones directas desde el teléfono del comensal mediante billeteras digitales (Yape, Plin) y tarjetas bancarias.
* **Servicios de mensajería y correo electrónico:** Conexión con APIs de mensajería instantánea (como WhatsApp Business API) y servicios de correo (protocolo SMTP) para el despacho automático de comprobantes digitales en formato PDF.

### Interfaces de comunicación
* **Protocolos de red interna:** Comunicación en red local mediante protocolos web seguros y sockets directos para la transmisión instantánea de comandas a la impresora de cocina.
* **Segmentación inalámbrica:** Canales WiFi diferenciados para aislar el tráfico de los comensales respecto al tráfico prioritario de las operaciones de mozos, cocina y caja.

## 9. Requerimientos no funcionales

* **RND-1 Tiempo de respuesta y agilidad:** La carta digital debe cargarse en los dispositivos de los comensales en cuestión de pocos segundos, y las comandas deben emitirse en la impresora de cocina inmediatamente tras pulsar el botón de envío.
* **RND-2 Alta disponibilidad y resiliencia:** El sistema mantendrá su funcionamiento durante la totalidad del horario de atención del restaurante, operando de manera autónoma en red local si la conexión a internet externa se interrumpe.
* **RND-3 Seguridad y control de acceso:** Acceso controlado mediante autenticación y permisos según roles (Mozo, Cajero, Administrador), protegiendo las credenciales mediante mecanismos seguros de encriptación.
* **RND-4 Ergonomía y facilidad de aprendizaje:** La interfaz para el personal debe ser lo suficientemente intuitiva como para que un mozo nuevo pueda dominar la toma de pedidos tras una breve inducción de pocos minutos.
* **RND-5 Integridad transaccional:** El sistema debe garantizar que ninguna comanda confirmada se pierda o duplique, registrando con exactitud matemática cada entrada y salida de dinero.

## 10. Otros requerimientos

* **Requerimientos Legales y Tributarios:** Cumplimiento de la normativa sobre emisión de comprobantes de pago autorizados y enlace reglamentario al Libro de Reclamaciones virtual para los comensales.
* **Respaldo y Seguridad de Información:** Capacidad de generar copias de seguridad periódicas de los datos de ventas y productos para prevenir pérdidas de información ante fallas de hardware.
* **Configuración Regional:** Configuración del sistema en idioma español, adaptación a la moneda nacional (Soles) y ajuste al huso horario oficial de Perú (UTC-5).

## 11. Glosario

* **Arqueo Ciego:** Práctica de control interno donde el cajero cuenta y declara el efectivo recaudado sin que el software le muestre previamente la cifra teórica calculada por el sistema.
* **Buzzer:** Alarma acústica integrada en la impresora de cocina que emite un timbre sonoro cada vez que se imprime una nueva orden de comida.
* **Carta Digital:** Menú interactivo en formato web al que los clientes acceden escaneando un código QR desde su propio teléfono móvil.
* **Comanda:** Detalle impreso o digital de los platos, presas, guarniciones y bebidas solicitadas por una mesa que se remite al área de preparación.
* **Comprobante Digital:** Documento electrónico tributario (Boleta o Factura en formato PDF y XML) despachado automáticamente al cliente mediante WhatsApp o correo electrónico sin requerir papel térmico.
* **Edge Gateway:** Equipo de cómputo local que procesa las órdenes y coordina la impresión dentro del restaurante sin depender de la conexión a internet de la calle.
* **Kardex:** Registro organizado de entradas, salidas y existencias físicas de los insumos en el almacén.
* **Merma:** Porción de insumo o plato elaborado que se pierde o descarta por sobrecocción, rotura o devolución del cliente.
* **Modificadores:** Preferencias o elecciones adicionales sobre un plato base (como la elección obligatoria entre pecho o pierna, tipo de papas o cremas).
* **Mostrito:** Plato característico de la comida popular peruana que combina pollo a la brasa con porción de arroz chaufa y papas fritas.
* **Pago en Mesa (Self-Checkout):** Modalidad en la que el comensal consulta su cuenta y paga directamente desde su teléfono celular a través de la aplicación web sin necesidad de desplazarse a la caja.
* **Protocolo 86:** Término gastronómico que designa la acción de retirar de forma inmediata un plato de la carta cuando se han terminado sus insumos.
* **Reporte Z:** Comprobante de cierre fiscal y contable emitido al final de la jornada que consolida las ventas totales y las clasifica por medio de pago.
* **Split Bill:** Función que permite dividir el monto total consumido en una mesa entre varios comensales, emitiendo comprobantes de pago individuales.
