# Sistema para Pollerías · aplicación web (versión local)

Versión completa con las 15 funcionalidades del documento de requerimientos (F-01 a F-15). Los servicios externos (SUNAT, pasarela de pagos, consulta DNI/RUC, ticketera) están simulados para poder probar todo en una sola laptop.

| Parte | Tecnología | Carpeta | Puerto |
| :--- | :--- | :--- | :--- |
| Base de datos | PostgreSQL 18 | `../base_de_datos` | 5432 |
| API (backend) | NestJS 11 + Prisma 6 + Socket.IO | `backend` | 3001 |
| Web (frontend) | Next.js 15 + React 19 + Tailwind 4 | `frontend` | 3000 |

## Requisitos

- Node.js 20 o superior
- PostgreSQL con la base `polleria` creada (ver `../base_de_datos/README.md`)

## Actualizar una base creada antes

Si tu base se creó con la primera versión, aplica la ampliación una sola vez (se puede repetir sin problema):

```bash
cd ../base_de_datos
```

```bash
psql -h localhost -U polleria_app -d polleria -f 05_ampliacion.sql
```

## Arrancar el sistema

Se necesitan dos terminales.

**Terminal 1: API**

```bash
cd backend
```

```bash
npm install
```

```bash
npm run dev
```

La primera vez, copia `backend/.env.example` como `backend/.env` y escribe la contraseña de `polleria_app`.

**Terminal 2: web**

```bash
cd frontend
```

```bash
npm install
```

```bash
npm run dev
```

Luego abre **http://localhost:3000**.

## Pantallas

| Dirección | Para quién | Qué hace |
| :--- | :--- | :--- |
| `/` | Todos | Menú de pantallas |
| `/login` | Personal | Ingreso con usuario y PIN (el administrador además con contraseña) |
| `/mozo` | Tablet del mozo | Plano de mesas, pedidos, confirmar pedidos QR, unir y separar mesas, transferir, precuenta, anular ítem y reposición con PIN, fuga de comensal |
| `/caja` | Terminal de caja | Cobro mixto o dividido, descuentos, boleta, factura y nota de crédito; llevar, delivery, apps y programados; liquidación de repartidores; inventario; agotados; turno con arqueo por denominación y Reporte Z |
| `/cocina` | Estación del pollero | Comandas con alarma, tickets ANULACIÓN, REIMPRESIÓN y REPOSICIÓN, botón «Listo» |
| `/reparto` | Celular del repartidor | Pedidos en ruta, cuánto cobrar y vuelto, entregado o fallido |
| `/admin` | Dueño | Usuarios y PIN, carta y precios con modificadores, mesas, configuración, turnos (Reporte X, reabrir) y bitácora |
| `/reportes` | Dueño | Ventas por día, medio, canal, cajero y mozo; ranking de productos; pecho vs. pierna; horas punta; tiempos de atención; anulaciones, mermas, notas de crédito y arqueos; exportar a Excel (CSV) o PDF |
| `/qr` | Impresión | Los códigos QR de las mesas activas |
| `/m/M-04` | Celular del comensal | Carta, pedido, llamar al mozo, pedir la cuenta y **pagar desde el celular** |
| `/pasarela/…` | Comensal | Pasarela de pagos simulada (Yape, Plin, tarjeta) |
| `/c/…` | Comensal | Su comprobante para ver o guardar en PDF |

## Usuarios de prueba

| Usuario | PIN | Contraseña |
| :--- | :--- | :--- |
| Mozo de prueba | 1111 | |
| Cajera de prueba | 2222 | |
| Repartidor de prueba | 3333 | |
| Administrador (prueba) | 1234 | Admin2026! |

El PIN del administrador también autoriza las acciones protegidas: anulaciones, reposiciones, descuentos, notas de crédito, mermas, fugas, egresos grandes y reapertura de turnos.

## Datos de prueba para la pasarela simulada

| Medio | Aprobado | Rechazado |
| :--- | :--- | :--- |
| Yape / Plin | cualquier código de 6 dígitos | 000000 |
| Tarjeta | 4111 1111 1111 1111 | 4000 0000 0000 0002 |

## Probar con el celular

1. La laptop y el celular deben estar en la misma red WiFi.
2. Busca la IP de la laptop con `ipconfig` (por ejemplo `192.168.1.20`).
3. Abre `http://192.168.1.20:3000/qr` en la laptop y escanea un QR con el celular.
4. Si no carga, permite Node.js en el Firewall de Windows (redes privadas) para los puertos 3000 y 3001.

## Qué está simulado

| Servicio real | En esta versión |
| :--- | :--- |
| Emisión de boletas, facturas y notas de crédito ante SUNAT (Nubefact) | Se generan con serie y correlativo, IGV + IPM de 10.5 % y QR; el estado queda «ACEPTADO (simulado)». |
| Pasarela de pagos (Culqi / Izipay) | Página `/pasarela` de prueba que notifica al sistema con un webhook firmado con HMAC-SHA256. |
| Consulta de DNI y RUC (ApisPeru) | Devuelve un nombre de prueba si el número tiene formato válido. |
| Ticketera del pollero con buzzer | Pantalla `/cocina` con pitidos (triple para comandas, doble para tickets especiales). |
| Gaveta de dinero | Aviso «Gaveta abierta» en la caja. |
| Envío por WhatsApp | Abre WhatsApp con el enlace al comprobante; además se muestra un QR de descarga. |
| Caída de internet | En Administración → Configuración, «Simular caída de internet»: los comprobantes quedan en cola y se envían al reconectar. |

## Pendiente o simplificado

- La exportación de reportes es CSV (se abre en Excel) e impresión a PDF desde el navegador, no XLSX nativo.
- No se implementó: bloqueo de edición simultánea de una mesa (REQ-SAL-05), productos compuestos con descuento de cada componente (REQ-CAT-03), precios por canal (REQ-CAT-06), ICBPER por bolsa, boleta resumen diaria (REQ-FAC-09) ni la sincronización real con un servidor en la nube.

## Limitación de la demo

Todas las pantallas del personal guardan la sesión en el mismo navegador. Para probar mozo y caja a la vez, usa dos navegadores distintos (por ejemplo Chrome y Edge) o una ventana de incógnito.
