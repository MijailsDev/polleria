# Documento de Requerimientos de Software

**[Nombre del Proyecto]**
[Nombre de los Integrantes]
Fecha: [dd/mm/aaaa]

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

---

## 1. Propósito 
En esta sección se define el nombre o título del software que se está especificado en el documento, incluyendo su número de versión.
Luego se describe cuales componentes o partes del alcance del producto están incluidas en el documento, estableciendo si este documento cubre la totalidad del software, sólo una parte del sistema, subsistema o subgrupo de procesos.

## 2. Alcance del producto / Software 
Se incluye una corta descripción del alcance del software que se está especificando, incluyendo:
* Su propósito u objetivo general.
* Beneficios que brinda al área de negocio y organización.
* Objetivos y metas. Es recomendable establecer la relación de los objetivos del software con los objetivos corporativos y estrategias de negocio.
Se puede hacer referencia a otros documentos, por ejemplo, una definición de alcance u acta de constitución del proyecto.

## 3. Funcionalidades del producto
Lista de las funcionalidades del software que se están especificando en el documento de requerimientos. Cada funcionalidad puede estar compuesta por uno o varios requerimientos funcionales de software.
Aquí solo se incluye una lista numerada de las principales funcionalidades, la información detallada de requerimientos funcionales se documenta en la sección 6 de este documento.

## 4. Clases y características de usuarios
En esta sección se clasifican los usuarios que utilizaran el producto. La clasificación puede ser en función a la frecuencia de uso, grupo de funcionalidades utilizadas, privilegios de seguridad, nivel de experiencia y otros parámetros.
Se puede usar una lista para enumerar los usuarios tipo que utilizarán el software, describiendo las características de cada uno.
Para cada tipo de usuario, se pueden mencionar las funcionalidades de producto (Sección 4) que le sean relevantes. Igualmente se puede hacer mención de cuales usuarios utilizan una mayor parte del sistema y con más frecuencia, para distinguirlos de usuarios ocasionales o que acceden a pocas funcionalidades.

## 5. Entorno operativo
En esta sección se describe el entorno operativo en el que se desenvolverá el sistema, software, módulo o grupo de funcionalidades, mencionando aspectos como la plataforma de hardware, versiones de sistema operativo y otros sistemas o componentes con los que debe coexistir.

## 6. Requerimientos funcionales
Los requerimientos funcionales de un sistema, son aquellos que describen cualquier actividad que este deba realizar, en otras palabras, el comportamiento o función particular de un sistema o software cuando se cumplen ciertas condiciones.

### (Nombre de la funcionalidad 1)
En el título de la funcionalidad, se recomienda utilizar nombres lo más descriptivo posible para cada funcionalidad. No limitarse a nombrarlas “Funcionalidad 1”. Un buen ejemplo podría ser “Autorización de pedido de compra”.

* **Descripción:** Descripción corta de la funcionalidad.
* **Prioridad:** Nivel bajo, medio o alto de prioridad. Esta debe ser establecida por el área funcional.
* **Acciones iniciadoras y comportamiento esperado:** Secuencia de acciones de usuario y respuestas esperadas del sistema para esta funcionalidad.
* **Requerimientos funcionales:** Lista detallada de los requerimientos funcionales asociados a esta funcionalidad. 

Para cada requerimiento funcional se establece como debe mostrarse el software y cuales comportamientos debe desempeñar para que el usuario pueda realizar la función que necesita.
Es recomendable incluir como el software debe responder a condiciones de error y entradas de datos inválidas.
Cada requerimiento debe ser identificado unívocamente, para lo cual se recomienda usar un número de secuencia, que tenga algún significado y de formato común a toda la organización. Por ejemplo:
* REQ-1:
* REQ-2:
* REQ-3:

### (Nombre de la funcionalidad 2)
Seguir los mismos lineamientos de la funcionalidad 1 para tantas funcionalidades tenga el sistema.

### (Nombre de la funcionalidad N)
Seguir los mismos lineamientos de la funcionalidad 1 para tantas funcionalidades tenga el sistema.

## 7. Reglas de negocio
Listado de reglas y principios que aplican a todo el conjunto de requerimientos de software contenidos en el documento. Un ejemplo es cuales individuos o roles pueden desempeñar cierta función bajo ciertas circunstancias.
Para hacer cumplir las reglas de negocio, podría ser necesaria la definición de requerimientos funcionales que aplican a todo el sistema, no a una funcionalidad especifica.

## 8. Requerimientos de interfaces externas

### Interfaces de usuario
Aquí se describen las características de cada interfaz con el usuario. 
* Se pueden clasificar por tipos o áreas del sistema con interfaz distinta.
* Pueden incluirse ejemplos de pantallas.
* Describir los estándares de interfaz gráfica (GUI).
* Guías de estilo sobre organización de pantalla, estándares para botones, funciones que se mostrarán en todas las pantallas.

### Interfaces de hardware
Información sobre cuales tipos de dispositivos soporta el sistema, por ejemplo: Computadores, dispositivos móviles, impresoras, otros dispositivos.
* Protocolos de comunicación que soporta.
* Interacciones de datos y control entre el software y el hardware.

### Interfaces de software
Aquí se describen las interacciones entre el software y otros componentes, incluyendo: Otros componentes de software y sistemas, y de ser aplicables bases de datos, sistemas operativos, herramientas, librerías, componentes de software comercial, entre otros.

### Interfaces de comunicación
Requerimientos de las funciones de comunicación que requiere el producto, incluyendo email, navegadores web, protocolos de comunicación de red, formularios electrónicos, entre otros.
Incluye formatos de mensajería, estándares de comunicación (Ej. FTP, HTTP, etc.). Describir también requerimientos de encriptación y seguridad en las comunicaciones.

## 9. Requerimientos no funcionales
Los requerimientos no funcionales son los que especifican criterios para evaluar la operación de un servicio de tecnología de información, en contraste con los requerimientos funcionales que especifican los comportamientos específicos.

## 10. Otros requerimientos
Requerimientos no cubiertos en ninguna otra sección del documento de requerimientos de software, por ejemplo: Requerimientos de bases de datos, internacionalización, legales y objetivos de reúso de componentes de software.

## 11. Glosario
Descripción de términos y siglas necesarias para el entendimiento del documento de requerimientos de software.