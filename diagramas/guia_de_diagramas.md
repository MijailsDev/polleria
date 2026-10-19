# Guía de diagramas: para qué sirve cada uno y en qué se diferencian

Esta guía explica los 14 diagramas del Capítulo I del Sistema para Pollerías. Para cada uno dice qué es, qué pregunta responde y qué muestra en nuestro proyecto, y al final compara los que más se confunden.

---

## 1. Cómo se clasifican

UML 2 divide sus diagramas en dos grandes grupos. El modelo físico y el diccionario de datos no son UML: pertenecen al **modelado de datos**.

| Grupo | Qué describe | Diagramas de este proyecto |
| :--- | :--- | :--- |
| **Estructura** (estático) | *Qué partes tiene* el sistema y cómo se relacionan, sin importar el tiempo. | Clases, paquetes, componentes, despliegue |
| **Comportamiento** (dinámico) | *Qué hace* el sistema y cómo cambia. | Casos de uso, estados |
| **Interacción** (subtipo de comportamiento) | *Cómo colaboran* los objetos enviándose mensajes. | Secuencia, colaboración (comunicación) |
| **Modelado de datos** (no UML) | *Cómo se guarda* la información en la base de datos. | Modelo físico, diccionario de datos |

Una forma sencilla de recordarlo:
- **Casos de uso:** ¿qué necesita cada usuario?
- **Secuencia y colaboración:** ¿cómo se resuelve paso a paso?
- **Clases y estados:** ¿con qué objetos y reglas?
- **Paquetes y componentes:** ¿cómo se organiza el código?
- **Despliegue:** ¿dónde se instala?
- **Modelo físico y diccionario:** ¿cómo se guardan los datos?

---

## 2. Cada diagrama en detalle

### 1.1.1.1 Actores del sistema
- **Qué es:** la lista de quienes interactúan con el sistema. Un actor es un **rol**, no una persona: el mismo trabajador puede ser cajero un día y mozo otro.
- **Pregunta que responde:** ¿quién usa el sistema y con qué sistemas externos se comunica?
- **En nuestro proyecto:** comensal; mozo, maestro pollero, cajero, repartidor y administrador (todos heredan de "Personal del local"); y como actores secundarios la pasarela de pagos, SUNAT, la consulta DNI/RUC, la mensajería y el temporizador.
- **Para qué sirve:** es lo primero que se define. Sin actores no se pueden escribir los casos de uso ni decidir los permisos de cada rol.

### 1.1.1.2 Diagrama de casos de uso
- **Qué es:** muestra **qué puede hacer cada actor** con el sistema, visto desde afuera, sin explicar cómo se programa.
- **Pregunta que responde:** ¿qué funciones ofrece el sistema y quién usa cada una?
- **En nuestro proyecto:** 25 casos de uso en 5 módulos; por ejemplo, "Registrar pedido por QR" (comensal) o "Abrir y cerrar turno" (cajero).
- **Relaciones especiales:**
  - **«include»**: un caso siempre usa a otro. "Cobrar cuenta" incluye "Emitir comprobante".
  - **«extend»**: un caso agrega algo solo a veces. "Dividir cuenta" extiende "Cobrar cuenta" cuando los clientes lo piden.
- **Para qué sirve:** acordar el alcance con el dueño y repartir el trabajo. Cada caso de uso se convierte después en pantallas, pruebas y diagramas de secuencia.

### 1.1.2.1 Diagramas de secuencia
- **Qué es:** muestra **un caso de uso paso a paso, en orden de tiempo**. Los participantes van arriba y el tiempo corre hacia abajo.
- **Pregunta que responde:** ¿qué mensajes se envían, en qué orden y quién responde?
- **En nuestro proyecto:** tres flujos.
  - Pedido por QR hasta que se imprime en cocina.
  - Cobro con efectivo + Yape y emisión de la boleta.
  - Cierre de turno con arqueo ciego.
- **Elementos clave:**
  - **Línea de vida:** la línea punteada vertical de cada participante.
  - **Activación:** el rectángulo delgado que indica que el participante está trabajando.
  - **Mensaje y retorno:** la flecha llena es un mensaje; la punteada, su respuesta.
  - **Fragmentos:** `alt` para alternativas (si / si no) y `opt` para algo opcional.
- **Para qué sirve:** detectar qué métodos necesita cada clase y qué falla puede ocurrir en cada paso, por ejemplo cuando el OSE no responde.

### 1.1.2.2 Diagrama de colaboración (en UML 2 se llama "de comunicación")
- **Qué es:** muestra **la misma interacción que un diagrama de secuencia**, pero organizada por **quién está conectado con quién**. El orden se indica con números (1, 2, 3…).
- **Pregunta que responde:** ¿qué objetos se comunican entre sí y por qué enlaces pasan los mensajes?
- **En nuestro proyecto:** el pedido por QR. Se ve que `ApiServidorLocal` es el centro: habla con la carta, la base de datos, la tablet del mozo y la cola de impresión.
- **Para qué sirve:** ver de un vistazo qué objeto concentra demasiadas responsabilidades (acoplamiento) y qué conexiones necesita cada uno.

### 1.1.3 Diagrama de paquetes
- **Qué es:** muestra cómo se **agrupa el código en carpetas o módulos** y qué grupo depende de cuál.
- **Pregunta que responde:** ¿cómo organizamos el proyecto para que sea mantenible?
- **En nuestro proyecto:** tres capas (presentación, lógica de negocio e infraestructura); dentro de negocio hay módulos como `pedidos`, `caja` o `facturacion`.
- **Para qué sirve:** dividir el trabajo entre Mijail y Nilton y evitar dependencias circulares (por ejemplo, que `caja` dependa de `pedidos` y `pedidos` de `caja`).

### 1.1.4 Diagrama de clases
- **Qué es:** muestra las **clases del sistema** con sus atributos, métodos y relaciones. Es el diagrama más importante del diseño.
- **Pregunta que responde:** ¿qué objetos existen, qué datos guardan, qué saben hacer y cómo se relacionan?
- **En nuestro proyecto:** 17 clases (`Mesa`, `Pedido`, `Cuenta`, `Turno`…) y 5 enumeraciones (`EstadoMesa`, `MedioPago`…).
- **Notación:**
  - **Multiplicidad:** `1`, `0..*`, `1..*` indican cuántos objetos participan.
  - **Composición** (rombo negro ◆): la parte no existe sin el todo. Un `ItemPedido` no existe sin su `Pedido`.
  - **Asociación** (línea simple): dos clases se conocen, pero cada una existe por sí sola.
- **Para qué sirve:** es la base para programar las entidades del backend y para diseñar la base de datos.

### 1.1.5 Diagramas de estados
- **Qué es:** muestra **los estados por los que pasa un solo objeto** durante su vida y qué evento lo hace cambiar.
- **Pregunta que responde:** ¿en qué situaciones puede estar este objeto y qué lo hace pasar de una a otra?
- **En nuestro proyecto:**
  - **Mesa:** libre → ocupada → cuenta solicitada → por limpiar → libre.
  - **Pedido:** registrado → confirmado → en preparación → servido, o anulado.
- **Notación:** cada transición se escribe `evento [condición] / acción`. Por ejemplo: `anular [PIN del administrador] / ticket ANULACIÓN`.
- **Para qué sirve:** programar las reglas sin dejar huecos (¿se puede anular un pedido ya servido?) y definir los colores del plano de mesas.

### 1.2.1 Diagrama de componentes
- **Qué es:** muestra las **piezas de software que se pueden reemplazar o desplegar por separado** (aplicaciones, servicios, bases de datos) y las **interfaces** que ofrecen.
- **Pregunta que responde:** ¿qué piezas de software forman el sistema y a través de qué interfaces se comunican?
- **En nuestro proyecto:** las 4 aplicaciones web consumen la "API REST" y los "Eventos en tiempo real" de la API NestJS. Dentro de la API están los controladores, los módulos de negocio y los adaptadores hacia Culqi, Nubefact, ApisPeru y WhatsApp.
- **Notación:** el círculo (○) es una interfaz ofrecida; la flecha punteada, "depende de".
- **Para qué sirve:** cambiar una pieza sin romper las demás. Por ejemplo, reemplazar Nubefact por otro OSE tocando solo el adaptador.

### 1.2.2 Diagrama de despliegue
- **Qué es:** muestra el **hardware físico** (nodos) y **qué software se instala en cada uno**.
- **Pregunta que responde:** ¿en qué equipos corre el sistema y cómo se conectan?
- **En nuestro proyecto:**
  - **Dispositivos:** celular, tablet, terminal de caja, servidor local, ticketeras, UPS, router y el VPS en la nube.
  - **Artefactos:** lo que se instala en cada uno (`api-nestjs`, `postgresql-16`, `agente-escpos`…).
  - **Medios:** cada línea dice por dónde se conectan (Cat6, USB, WiFi, HTTPS).
- **Para qué sirve:** planificar la compra de equipos y la instalación (fase 6 del cronograma), y explicar por qué el local sigue funcionando sin internet.

### 1.3.1 Modelo físico de la base de datos
- **Qué es:** el diseño **real** de las tablas en PostgreSQL: columnas con tipo exacto, claves primarias (PK), claves foráneas (FK) y valores únicos (UQ).
- **Pregunta que responde:** ¿cómo quedan exactamente las tablas en la base de datos?
- **En nuestro proyecto:** 19 tablas. Las relaciones van en notación "pata de gallo": la pata indica "muchos", la barra "uno" y el círculo "opcional".
- **Para qué sirve:** crear la base de datos. El archivo `modelo_fisico.sql` es su traducción directa a código.

### 1.3.2 Diccionario de datos
- **Qué es:** un **documento en tablas** que describe cada columna de la base de datos: tipo, si puede quedar vacía, clave y qué significa.
- **Pregunta que responde:** ¿qué significa cada dato y qué valores acepta?
- **En nuestro proyecto:** por ejemplo, que `fraccion_pollo` solo acepta 0, 0.125, 0.25, 0.5 o 1, o que `numero_operacion` es único para impedir que se reuse una captura de Yape.
- **Para qué sirve:** que cualquier programador o el docente entienda los datos sin preguntar. Es la referencia para validar formularios y escribir reportes.

---

## 3. Diferencias entre los diagramas que más se confunden

| Se confunden | Diferencia clave | Ejemplo del proyecto |
| :--- | :--- | :--- |
| **Casos de uso** vs **secuencia** | Casos de uso dice **qué** se hace (visto desde afuera). Secuencia dice **cómo** se hace, paso a paso y por dentro. | "Cobrar cuenta" es un caso de uso; sus 23 mensajes entre caja, API, pasarela y OSE son la secuencia. |
| **Secuencia** vs **colaboración** | Muestran la **misma información**. Secuencia ordena por **tiempo** (de arriba hacia abajo); colaboración ordena por **conexiones** y numera los mensajes. | El pedido por QR está en los dos: los 21 mensajes son los mismos. |
| **Secuencia** vs **estados** | Secuencia muestra **varios objetos** en **un escenario**. Estados muestra **un objeto** en **todos sus escenarios posibles**. | La secuencia sigue un pedido concreto; el diagrama de estados del pedido muestra todo lo que le puede pasar (confirmarse, programarse, anularse…). |
| **Clases** vs **modelo físico** | Clases es el modelo **lógico** de objetos, con métodos y herencia. El modelo físico son **tablas reales**, con tipos de PostgreSQL y claves; no tiene métodos. | La clase `Pedido` tiene `confirmar()`; la tabla `pedido` tiene `clave_idempotencia uuid UQ`. La relación de muchos a muchos entre `ItemPedido` y `OpcionModificador` se convierte en la tabla intermedia `item_opcion`. |
| **Modelo físico** vs **diccionario de datos** | El modelo físico es un **dibujo** de tablas y relaciones. El diccionario es un **texto** que explica qué significa cada columna. | El modelo dice que `pago.numero_operacion` es `UQ`; el diccionario explica que es el número de Yape, Plin o POS. |
| **Paquetes** vs **componentes** | Paquetes organiza el **código fuente** (carpetas y módulos). Componentes muestra **piezas ejecutables** con interfaces, incluidas las externas como PostgreSQL o la pasarela. | `facturacion` es un paquete; "Adaptadores de integración" es el componente que habla con Nubefact. |
| **Componentes** vs **despliegue** | Componentes es **software** y sus interfaces. Despliegue es **hardware** y qué software se instala en cada equipo. | La API NestJS es un componente; el despliegue dice que corre en el Mini PC y también en el VPS. |
| **Actores** vs **clases** | Un actor es **externo** al sistema (quien lo usa). Una clase es una pieza **interna** del sistema. | El actor "Cajero" usa el sistema; la clase `Usuario` guarda sus datos y su PIN. |

---

## 4. Cómo se conectan entre sí

Cada diagrama se construye a partir del anterior:

```
Actores ──► Casos de uso ──► Secuencia / Colaboración ──► Clases ──► Modelo físico ──► Diccionario
                                  │                          │
                                  ▼                          ▼
                               Estados                    Paquetes ──► Componentes ──► Despliegue
```

1. Los **actores** y los **casos de uso** definen qué debe hacer el sistema.
2. Los diagramas de **secuencia** y **colaboración** muestran cómo se cumple cada caso de uso y revelan qué objetos y métodos hacen falta.
3. Esos objetos forman el diagrama de **clases**. Los objetos con varios estados (mesa y pedido) tienen su propio diagrama de **estados**.
4. Las clases que deben guardarse pasan al **modelo físico**, y el **diccionario** explica cada columna.
5. Las clases se agrupan en **paquetes**, los paquetes forman **componentes**, y los componentes se instalan en los equipos del **despliegue**.

---

## 5. Resumen rápido para la exposición

| Diagrama | En una frase |
| :--- | :--- |
| Actores | Quién usa el sistema. |
| Casos de uso | Qué puede hacer cada uno. |
| Secuencia | Cómo se hace, paso a paso en el tiempo. |
| Colaboración | Cómo se hace, visto por las conexiones entre objetos. |
| Paquetes | Cómo se organiza el código. |
| Clases | Qué objetos existen, qué guardan y qué hacen. |
| Estados | Por qué situaciones pasa un objeto. |
| Componentes | Qué piezas de software hay y cómo se conectan. |
| Despliegue | En qué equipos se instala cada pieza. |
| Modelo físico | Cómo quedan las tablas en la base de datos. |
| Diccionario de datos | Qué significa cada dato. |
