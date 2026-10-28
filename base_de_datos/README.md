# Base de datos del Sistema para Pollerías

Base de datos **PostgreSQL** creada según el modelo físico (`diagramas/13_modelo_fisico.drawio`) y el diccionario de datos (`diagramas/diccionario_de_datos.md`).

## Programas que se usan

| Programa | Para qué | Estado en la PC de desarrollo |
| :--- | :--- | :--- |
| **PostgreSQL 18** (servidor) | Guarda los datos. Los scripts sirven para PostgreSQL 16 o superior. | Instalado, servicio `postgresql-x64-18`, puerto 5432 |
| **pgAdmin 4** | Ver y administrar la base con ventanas: tablas, datos, consultas y diagrama ER | Instalado junto con PostgreSQL |
| **psql** | Consola de PostgreSQL; la usa el script de creación | Incluido en `C:\Program Files\PostgreSQL\18\bin` |

## Crear la base de datos

Desde PowerShell, en esta carpeta:

```bash
powershell -ExecutionPolicy Bypass -File .\crear_base_de_datos.ps1
```

El script pide dos contraseñas (no se muestran al escribir):
1. La del usuario `postgres`, la que se eligió al instalar PostgreSQL.
2. Una nueva para `polleria_app`, el usuario con el que se conectará el sistema.

Luego ejecuta los scripts en orden y muestra un resumen. Si la base ya existe con sus tablas, no modifica nada.

## Archivos

| Archivo | Qué hace |
| :--- | :--- |
| `00_crear_usuario_y_base.sql` | Crea el usuario `polleria_app` y la base `polleria` en UTF-8 con hora de Lima. |
| `01_esquema.sql` | Crea las 19 tablas, la vista `v_stock_pollos`, los índices y las reglas de negocio. |
| `02_comentarios.sql` | Agrega la descripción de cada tabla y columna (se ve en pgAdmin). |
| `03_datos_iniciales.sql` | Carga la carta con precios, las 10 mesas, los modificadores y usuarios de prueba. |
| `04_verificar.sql` | Muestra las tablas, la carta, las mesas, el stock y los usuarios. |
| `crear_base_de_datos.ps1` | Ejecuta todo en orden. |
| `.env` | Se genera al final con la cadena de conexión. **No se sube a GitHub.** |

## Reglas de negocio que la base hace cumplir

La base rechaza estos datos aunque el programa tenga un error:

| Regla | Qué rechaza |
| :--- | :--- |
| RN-11 | Factura sin RUC válido; boleta de más de S/ 700 sin documento. |
| RN-12 | Nota de crédito sin el comprobante que anula. |
| RN-07 | Pago en efectivo sin turno de caja abierto; dos turnos abiertos para el mismo cajero. |
| RN-13 | Pago con Yape, Plin o tarjeta sin número de operación; el mismo número de operación dos veces. |
| RN-04 / RN-16 | Merma o ajuste de inventario sin motivo o sin autorización del administrador. |
| RNF-SEG-05 | Modificar o borrar registros de la bitácora. |
| Salón | Dos sesiones abiertas en la misma mesa. |
| Formatos | Precios negativos, celular distinto de 9 dígitos que empiecen en 9, DNI o RUC mal escritos, estados inexistentes. |

## Usuarios de prueba

Solo para desarrollo; cámbialos antes de usar el sistema en el local. Sus PIN están en `03_datos_iniciales.sql`.

| Usuario | Rol |
| :--- | :--- |
| Administrador (prueba) | ADMINISTRADOR |
| Mozo de prueba | MOZO |
| Cajera de prueba | CAJERO |
| Repartidor de prueba | REPARTIDOR |

## Ver la base en pgAdmin

1. Abre pgAdmin 4 y conéctate al servidor **PostgreSQL 18** con la contraseña de `postgres`.
2. Ve a **Databases → polleria → Schemas → public → Tables**.
3. Clic derecho en una tabla → **View/Edit Data → All Rows** para ver los datos.
4. Clic derecho en **polleria → ERD For Database** para ver el diagrama entidad-relación generado desde la base.
