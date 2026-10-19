# Diagramas del Capítulo I: Análisis

Diagramas del Sistema para Pollerías en formato **draw.io**. Se abren en [app.diagrams.net](https://app.diagrams.net), en la aplicación de escritorio de draw.io o en VS Code con la extensión *Draw.io Integration*. La carpeta `png/` tiene una imagen de cada diagrama para insertarla en Word.

| Sección | Diagrama | Archivo editable | Imagen |
| :--- | :--- | :--- | :--- |
| 1.1.1.1 | Actores del sistema | `01_actores_del_sistema.drawio` | `png/01_actores_del_sistema.png` |
| 1.1.1.2 | Casos de uso del proyecto | `02_casos_de_uso.drawio` | `png/02_casos_de_uso.png` |
| 1.1.2.1 | Secuencia: pedido por QR y envío a cocina | `03_secuencia_pedido_qr.drawio` | `png/03_secuencia_pedido_qr.png` |
| 1.1.2.1 | Secuencia: cobro con pago mixto y boleta | `04_secuencia_cobro_y_boleta.drawio` | `png/04_secuencia_cobro_y_boleta.png` |
| 1.1.2.1 | Secuencia: cierre de turno con arqueo ciego | `05_secuencia_cierre_de_turno.drawio` | `png/05_secuencia_cierre_de_turno.png` |
| 1.1.2.2 | Colaboración: pedido por QR | `06_colaboracion_pedido_qr.drawio` | `png/06_colaboracion_pedido_qr.png` |
| 1.1.3 | Paquetes | `07_diagrama_de_paquetes.drawio` | `png/07_diagrama_de_paquetes.png` |
| 1.1.4 | Clases | `08_diagrama_de_clases.drawio` | `png/08_diagrama_de_clases.png` |
| 1.1.5 | Estados de la mesa | `09_diagrama_de_estados_mesa.drawio` | `png/09_diagrama_de_estados_mesa.png` |
| 1.1.5 | Estados del pedido | `10_diagrama_de_estados_pedido.drawio` | `png/10_diagrama_de_estados_pedido.png` |
| 1.2.1 | Componentes | `11_diagrama_de_componentes.drawio` | `png/11_diagrama_de_componentes.png` |
| 1.2.2 | Despliegue | `12_diagrama_de_despliegue.drawio` | `png/12_diagrama_de_despliegue.png` |
| 1.3.1 | Modelo físico de la base de datos | `13_modelo_fisico.drawio` | `png/13_modelo_fisico.png` |
| 1.3.2 | Diccionario de datos | `14_diccionario_de_datos.drawio` | `png/14_diccionario_de_datos.png` |

Archivos de apoyo:
- `guia_de_diagramas.md`: para qué sirve cada diagrama y en qué se diferencian.
- `modelo_fisico.sql`: script de creación de las 19 tablas en PostgreSQL 16, con claves primarias, foráneas y únicas.
- `diccionario_de_datos.md`: el diccionario de datos en tablas de texto, para copiarlo al Word como tabla editable.

El modelo físico, el script SQL y el diccionario de datos salen de la misma definición, así que coinciden columna por columna.
