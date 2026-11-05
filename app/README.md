# Sistema para Pollerías · aplicación web

Versión completa con las 15 funcionalidades del documento de requerimientos (F-01 a F-15) y lo necesario para producción: seguridad, monitoreo, respaldos, migraciones, pruebas y Libro de Reclamaciones. Los servicios que requieren contratos del negocio (SUNAT, pasarela de pagos, consulta DNI/RUC, WhatsApp e impresoras) están **simulados con el mismo flujo que los reales**, y cada uno tiene su adaptador listo para conectarse con las variables de entorno.

| Parte | Tecnología | Carpeta | Puerto |
| :--- | :--- | :--- | :--- |
| Base de datos | PostgreSQL 18 | `../base_de_datos` | 5432 |
| API (backend) | NestJS 11 + Prisma 6 + Socket.IO | `backend` | 3001 |
| Web (frontend) | Next.js 15 + React 19 + Tailwind 4 (instalable como app) | `frontend` | 3000 |
| Pruebas | Node.js (sin dependencias) | `pruebas` | — |

## Requisitos

- Node.js 20 o superior
- PostgreSQL con la base `polleria` creada (ver `../base_de_datos/README.md`)

## Actualizar una base creada antes

Aplica los scripts nuevos (se pueden repetir sin problema):

```bash
psql -h localhost -U polleria_app -d polleria -f ../base_de_datos/05_ampliacion.sql
```

```bash
psql -h localhost -U polleria_app -d polleria -f ../base_de_datos/06_produccion.sql
```

```bash
psql -h localhost -U polleria_app -d polleria -f ../base_de_datos/07_comensal.sql
```

```bash
psql -h localhost -U polleria_app -d polleria -f ../base_de_datos/08_seguridad.sql
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

La primera vez, copia `backend/.env.example` como `backend/.env` y escribe la contraseña de `polleria_app`. El archivo explica cada variable.

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

Luego abre **http://localhost:3000**. Si aparece `EADDRINUSE`, ya hay otra terminal con ese servidor encendido: ciérrala con `Ctrl + C`.

## Pantallas

| Dirección | Para quién | Qué hace |
| :--- | :--- | :--- |
| `/` | Todos | Menú de pantallas (en el dominio del comensal: portada del local) |
| `/login` | Personal | Ingreso con usuario y PIN (el administrador además con contraseña y, si la activó, código de su app autenticadora). Con equipos exigidos, solo en equipos vinculados |
| `/vincular` | Equipo nuevo | Canjea el código de vinculación de un solo uso que genera el administrador |
| `/mozo` | Tablet del mozo | Plano de mesas, pedidos, confirmar pedidos QR, unir y separar mesas, transferir, precuenta, anular ítem y reposición con PIN, fuga de comensal. Una mesa que otro mozo está atendiendo aparece con ✏️ y no acepta pedidos duplicados |
| `/caja` | Terminal de caja | Cobro mixto o dividido, bolsas (ICBPER), descuentos, boleta, factura y nota de crédito; **bebidas por entregar**; llevar, delivery, apps y programados; liquidación de repartidores; inventario; agotados; turno con arqueo y Reporte Z |
| `/cocina` | Estación del pollero | Comandas con alarma (sin bebidas), tickets ANULACIÓN, REIMPRESIÓN y REPOSICIÓN, botón «Listo» |
| `/reparto` | Celular del repartidor | Pedidos en ruta, cuánto cobrar y vuelto, entregado o fallido |
| `/admin` | Dueño | Usuarios y PIN; **equipos vinculados, verificación en dos pasos y alertas de seguridad**; carta con **combos y precios por canal**; mesas; configuración; turnos; **SUNAT** (cola, rechazos, resumen diario); **reclamos**; **estado del sistema**; bitácora |
| `/reportes` | Dueño | Ventas, productos, pecho vs. pierna, horas punta, tiempos y pérdidas; **Excel (.xlsx)**, CSV o PDF |
| `/qr` | Administrador | Los códigos QR de las mesas activas (apuntan al dominio del comensal) |
| `/m/M-04` | Celular del comensal | Carta con fotos, letra ajustable (A, A+, A++) y alto contraste, buscador y «lo más pedido»; repetir la última ronda; cancelar o corregir antes de que el mozo confirme; tiempo estimado y aviso con vibración cuando el pedido está listo; pagar todo o solo su parte, con boleta, DNI o factura, propina y comprobante por WhatsApp; calificar la atención |
| `/pasarela/…` | Comensal | Pasarela de pagos simulada (Yape, Plin, tarjeta) |
| `/c/…` | Comensal | Su comprobante para ver, guardar en PDF o descargar el XML |
| `/reclamaciones` | Público | Libro de Reclamaciones virtual: registrar y consultar |
| `/privacidad`, `/terminos` | Público | Política de privacidad (Ley 29733) y términos |
| `/impresoras` | Simulador | Lo que sale por la ticketera del pollero y la de caja |
| `/whatsapp` | Simulador | El celular de los clientes con los mensajes enviados |

## Usuarios de prueba

| Usuario | PIN | Contraseña |
| :--- | :--- | :--- |
| Mozo de prueba | 1111 | |
| Cajera de prueba | 2222 | |
| Repartidor de prueba | 3333 | |
| Administrador (prueba) | 1234 | Admin2026! |

El PIN del administrador también autoriza las acciones protegidas: anulaciones, reposiciones, descuentos, notas de crédito, mermas, fugas, egresos grandes y reapertura de turnos. **Con `NODE_ENV=production` el servidor no arranca mientras estos usuarios sigan activos.**

## Datos de prueba para la pasarela simulada

| Medio | Aprobado | Rechazado |
| :--- | :--- | :--- |
| Yape / Plin | cualquier código de 6 dígitos | 000000 |
| Tarjeta | 4111 1111 1111 1111 | 4000 0000 0000 0002 |

## Servicios simulados y cómo pasar a los reales

| Servicio real | En esta versión | Para usar el real |
| :--- | :--- | :--- |
| Facturación electrónica (OSE/PSE) | OSE simulado: XML UBL 2.1, resumen (hash), código y mensaje de SUNAT, validación del RUC, resumen diario de boletas | `NUBEFACT_RUTA` y `NUBEFACT_TOKEN` (requiere RUC como emisor electrónico) |
| Consulta de DNI y RUC | Padrón simulado: nombres fijos por número y RUC con dígito verificador | `APISPERU_TOKEN` |
| Pasarela de pagos | Página `/pasarela` con webhook firmado con HMAC-SHA256 | Contrato con Culqi, Izipay o Niubiz |
| WhatsApp | Cola de envío con estados enviado, entregado y leído; se ve en `/whatsapp` | `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_ID` (Meta Business) |
| Ticketeras ESC/POS y gaveta | Impresora virtual en `/impresoras` | IP de cada ticketera en Administración → Configuración (puerto 9100) |
| Servidor en la nube | Receptor de prueba dentro de la misma API | `NUBE_URL` del servidor en la nube |
| Caída de internet | Administración → Configuración → «Simular caída de internet» | — |

## Producción

| Tema | Qué hay |
| :--- | :--- |
| Dos dominios | Mismo código, desplegado dos veces: `NEXT_PUBLIC_MODO=comensal` (carta, pago, comprobante, reclamos) y `personal` (todo lo demás). Ver [DESPLIEGUE.md](DESPLIEGUE.md) |
| Equipos vinculados | Solo los equipos que autorizó el dueño ven al personal e ingresan con PIN; la sesión queda atada a la llave del equipo. En producción siempre activo |
| Alertas | PIN incorrectos, intentos desde equipos no vinculados, códigos erróneos, equipo vinculado e ingreso remoto del dueño: WhatsApp al dueño, panel y bitácora |
| Dos pasos | Código TOTP (Google o Microsoft Authenticator) para el administrador |
| Seguridad | Cabeceras de seguridad, límite de solicitudes por IP (10 ingresos por minuto), bloqueo de 5 min tras 5 PIN fallidos, CORS por dominio, revisión al arrancar (`backend/src/comun/produccion.ts`) |
| Monitoreo | `GET /api/salud` (503 si la base de datos cae), pestaña Sistema del administrador, errores guardados en `error_registro`, aviso rojo en las pantallas si se pierde el servidor |
| Respaldos | `../base_de_datos/respaldo.ps1` (diario con `-Programar`) y `restaurar.ps1` |
| Base de datos nueva | `npm run db:migrar` y `npm run db:semilla` (con `SEMILLA=produccion` crea al administrador real y desactiva los de prueba) |
| App instalable | Manifiesto, íconos y service worker: en la tablet, «Agregar a la pantalla de inicio» |
| Legal | Libro de Reclamaciones con plazo de 15 días hábiles, privacidad y términos (textos modelo) |

**Despliegue en la nube:** paso a paso en [DESPLIEGUE.md](DESPLIEGUE.md). Las dos webs van en Vercel; la base en Supabase o Neon (`npm run db:migrar`); la API necesita estar siempre encendida (Socket.IO y tareas cada pocos segundos), por eso va en Render y no en Vercel.

## Pruebas

Con la API encendida, desde la carpeta `backend`:

```bash
npm run test:e2e
```

185 verificaciones de punta a punta (salón, caja, bebidas, combos, precios por canal, ICBPER, SUNAT, WhatsApp, impresoras, reclamos, nube, seguridad, reportes, la experiencia del comensal en la carta QR, equipos vinculados y verificación en dos pasos).

```bash
npm run test:carga
```

Simula 30 equipos a la vez (150 pedidos con cobro y boleta) y muestra los tiempos de cada operación. Ambas pruebas dejan pedidos de prueba; para borrarlos usa `../base_de_datos/limpiar_datos_de_prueba.sql`.

## Probar con el celular

1. La laptop y el celular deben estar en la misma red WiFi.
2. Busca la IP de la laptop con `ipconfig` (por ejemplo `192.168.1.20`).
3. Abre `http://192.168.1.20:3000/qr` en la laptop y escanea un QR con el celular.
4. Si no carga, permite Node.js en el Firewall de Windows para los puertos 3000 y 3001.

## Los dos dominios en la laptop

Con la API encendida, desde la carpeta `frontend`:

```bash
npm run dev:dos-dominios
```

Levanta el sitio del comensal en el puerto 3002 y el del personal en el 3003, igual que en Vercel.

## Limitación de la demo

Todas las pantallas del personal guardan la sesión en el mismo navegador. Para probar mozo y caja a la vez, usa dos navegadores distintos o una ventana de incógnito.
