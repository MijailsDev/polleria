# Sistema para Pollerías · aplicación web (versión local)

Primera versión con las **5 funcionalidades clave**: carta QR con presa obligatoria, comandas a cocina, cobro en caja, comprobantes y turnos con arqueo ciego. Incluye además el inicio de sesión con PIN, el plano de mesas en tiempo real y los productos agotados.

| Parte | Tecnología | Carpeta | Puerto |
| :--- | :--- | :--- | :--- |
| Base de datos | PostgreSQL 18 | `../base_de_datos` | 5432 |
| API (backend) | NestJS 11 + Prisma 6 + Socket.IO | `backend` | 3001 |
| Web (frontend) | Next.js 15 + React 19 + Tailwind 4 | `frontend` | 3000 |

## Requisitos

- Node.js 20 o superior
- PostgreSQL con la base `polleria` creada (ver `../base_de_datos/README.md`)

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
| `/login` | Personal | Ingreso con usuario y PIN |
| `/mozo` | Tablet del mozo | Plano de mesas, toma de pedidos, confirmar pedidos QR, alertas, transferir y liberar mesas |
| `/cocina` | Estación del pollero | Comandas con alarma sonora (simula la ticketera) |
| `/caja` | Terminal de caja | Abrir turno, cobro mixto o dividido, boleta o factura, agotados, egresos y cierre con arqueo ciego y Reporte Z |
| `/qr` | Impresión | Los 10 códigos QR de las mesas |
| `/m/M-04` | Celular del comensal | Carta digital, pedido, llamar al mozo y pedir la cuenta |

## Usuarios de prueba

| Usuario | PIN |
| :--- | :--- |
| Mozo de prueba | 1111 |
| Cajera de prueba | 2222 |
| Administrador (prueba) | 1234 |

## Probar con el celular

1. La laptop y el celular deben estar en la misma red WiFi.
2. Busca la IP de la laptop con `ipconfig` (por ejemplo `192.168.1.20`).
3. Abre `http://192.168.1.20:3000/qr` en la laptop y escanea un QR con el celular.
4. Si no carga, permite Node.js en el Firewall de Windows (redes privadas) para los puertos 3000 y 3001.

## Qué está simulado

| Servicio real | En esta versión |
| :--- | :--- |
| Emisión de boletas y facturas ante SUNAT (Nubefact) | Se generan con serie y correlativo, IGV + IPM de 10.5 % y QR; el estado SUNAT queda «ACEPTADO (simulado)». |
| Pago con Yape o Plin por pasarela (Culqi / Izipay) | Se registra con el número de operación, que no puede repetirse. |
| Consulta de DNI y RUC (ApisPeru) | Devuelve un nombre de prueba si el número tiene formato válido. |
| Ticketera del pollero con buzzer | Pantalla `/cocina` con pitido y formato de ticket. |
| Gaveta de dinero | Aviso «Gaveta abierta» en la caja al cobrar en efectivo. |

## Pendiente para las siguientes versiones

Pago en mesa desde el celular, delivery y pedidos programados, inventario y mermas con PIN, reportes del dueño, anulaciones con PIN y operación sin internet con el servidor local.

## Limitación de la demo

Todas las pantallas del personal guardan la sesión en el mismo navegador. Para probar mozo y caja a la vez, usa dos navegadores distintos (por ejemplo Chrome y Edge) o una ventana de incógnito.
