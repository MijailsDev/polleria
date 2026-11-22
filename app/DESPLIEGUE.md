# Despliegue en la nube con dos dominios

El sistema usa **tres servicios gratuitos** y **dos direcciones web** hechas con el mismo código:

| Pieza | Servicio | Ejemplo de dirección | Quién la usa |
| :--- | :--- | :--- | :--- |
| Base de datos | Supabase (o Neon) | — | Solo la API |
| API | Render | `https://polleria-api-0ukm.onrender.com` | Las dos webs |
| Web del comensal | Vercel (proyecto 1) | `https://polleria-carta.vercel.app` | Clientes: carta QR, pago, comprobante, reclamos |
| Web del personal | Vercel (proyecto 2) | `https://polleria-gestion-five.vercel.app` | Mozos, caja, cocina, reparto y dueño |

Si alguien borra el final del enlace del QR, llega a la **portada del local**, no a las pantallas del personal. Escribir `/caja` o `/admin` en el dominio del comensal responde «Página no encontrada».

## Las capas de seguridad

1. **Dos dominios.** El comensal nunca ve ni encuentra las pantallas internas. El dominio del personal no aparece en Google (`noindex`).
2. **Equipos vinculados.** En la nube siempre están activos. Solo una tablet, caja o celular que el dueño autorizó con un código de un solo uso ve la lista del personal y puede intentar un PIN.
3. **El servidor revisa todo.** Cada acción exige una sesión válida, el rol correcto y la llave del equipo. Una sesión copiada a otro celular no sirve.
4. **Bloqueos y límites.** Un usuario queda bloqueado 5 minutos tras 5 PIN incorrectos. Cada IP tiene un máximo de 10 ingresos por minuto y de 5 intentos de código por minuto.
5. **Alertas al dueño.** Le llega un WhatsApp, y queda en la bitácora, cuando:
   - hay muchos PIN incorrectos;
   - alguien intenta entrar desde equipos no vinculados;
   - se escriben códigos de vinculación incorrectos;
   - se vincula un equipo;
   - el administrador ingresa desde un equipo nuevo.
6. **Verificación en dos pasos del dueño.** Además de la contraseña y el PIN, pide el código de 6 dígitos de Google Authenticator o Microsoft Authenticator.

## Paso 1 · Base de datos en Supabase

1. En supabase.com crea un proyecto y elige una **contraseña larga** para la base. Guárdala en un lugar seguro; no la escribas en el código.
2. Entra a **Connect** y copia la cadena del **Session pooler** (puerto 5432). Render solo usa IPv4 y la conexión directa de Supabase gratis es IPv6. La cadena se ve así:
   `postgresql://postgres.xxxx:CLAVE@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`
3. Desde la laptop, en la carpeta `backend`, crea las tablas y el administrador real. Cambia los datos de ejemplo por los tuyos: el **PIN no puede ser 1234, 1111, 2222, 3333 ni 0000**.

```bash
$env:DATABASE_URL="postgresql://postgres.xxxx:CLAVE@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"; npm run db:migrar
```

```bash
$env:SEMILLA="produccion"; $env:ADMIN_NOMBRE="Tu nombre"; $env:ADMIN_PIN="4821"; $env:ADMIN_PASSWORD="UnaClaveLarga2026"; npm run db:semilla
```

Cierra esa terminal al terminar: así las variables con contraseñas no quedan abiertas.

## Paso 2 · API en Render

New → **Web Service** → conecta el repositorio de GitHub.

| Campo | Valor |
| :--- | :--- |
| Root Directory | `app/backend` |
| Build Command | `npm install --include=dev && npm run build` (con `NODE_ENV=production`, npm omitiría las herramientas de compilación) |
| Start Command | `npm run db:migrar && npm start` |
| Instance Type | Free |

Variables de entorno (Environment):

| Variable | Valor |
| :--- | :--- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | La cadena del Session pooler |
| `JWT_SECRET` | 48 caracteres aleatorios. Genera uno con `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"` |
| `PASARELA_SECRETO` y `SYNC_SECRET` | Otros dos valores aleatorios, generados igual |
| `CORS_ORIGIN` | Las dos webs, separadas por coma, por ejemplo `https://polleria-carta.vercel.app,https://polleria-gestion-five.vercel.app` |
| `TASA_IMPUESTO` | `0.105` |
| `SIMULADORES` | `true` para la demostración (impresora virtual, WhatsApp y correo simulados) |
| `BREVO_API_KEY` y `CORREO_REMITENTE` | Correos reales (códigos y avisos de clientes frecuentes). Ver «Paso 5». Sin ellas, los correos llegan a la bandeja simulada `/correo`. |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` y `WHATSAPP_PLANTILLA_CODIGO` | WhatsApp real (Meta). Ver «Paso 5». Sin ellas, los mensajes llegan al celular simulado `/whatsapp`. |

El servidor **se niega a arrancar** si encuentra PIN de prueba, la contraseña de prueba, `CORS_ORIGIN=*` o claves débiles. El registro (Logs) dice qué corregir.

> Render gratis se duerme a los 15 minutos sin visitas. El flujo `.github/workflows/mantener-api-despierta.yml` lo despierta cada 10 minutos. Para activarlo, en GitHub ve a Settings → Secrets and variables → Actions → Variables y crea `API_URL` = `https://polleria-api-0ukm.onrender.com/api`.

## Paso 3 · Las dos webs en Vercel

Importa el **mismo repositorio dos veces**. En ambos proyectos, Root Directory es `app/frontend`.

| Variable | Proyecto `polleria-carta` | Proyecto `polleria-gestion` |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `https://polleria-api-0ukm.onrender.com` | `https://polleria-api-0ukm.onrender.com` |
| `NEXT_PUBLIC_MODO` | `comensal` | `personal` |
| `NEXT_PUBLIC_URL_COMENSAL` | (no hace falta) | `https://polleria-carta.vercel.app` |

Cada vez que subas cambios a GitHub, Vercel actualiza los dos proyectos solo.

## Paso 4 · Primer ingreso y equipos

1. Abre la web del personal. Como tu laptop aún no está vinculada, verás «Este equipo no está autorizado». Toca **Soy el administrador** y entra con tu nombre, contraseña y PIN.
2. **Administración → Equipos y seguridad → Activar verificación en dos pasos.** Escanea el QR con Google Authenticator y escribe el código.
3. En la misma pestaña, crea un equipo por cada aparato:
   - laptop del dueño → «Equipo de administración»;
   - tablet → «Tablet del salón»;
   - caja → «Terminal de caja»;
   - pantalla de cocina → «Pantalla de cocina»;
   - celular del repartidor → «Celular de reparto».
4. En cada aparato abre la web del personal en `/vincular` y escribe el código, o escanea el QR que aparece. El código vence a los 10 minutos.
5. Crea los usuarios reales en Administración → Usuarios.
6. Imprime los QR de las mesas en `/qr`. Ya apuntan a la web del comensal.

Si pierdes una tablet o te la roban, desvincúlala en **Equipos y seguridad**: sus sesiones se cierran al instante.

**Si pierdes el celular con la app autenticadora**, otro administrador puede desactivar tu verificación. Si eres el único, ejecuta esto en el SQL Editor de Supabase y vuelve a activarla:

```sql
UPDATE usuario SET totp_activo = false, totp_secreto = NULL WHERE nombre = 'Tu nombre';
```

## Paso 5 · Correos y WhatsApp reales

Sin estas variables, el sistema usa los simuladores (`/correo` y `/whatsapp`), ideales para la demostración. Para que los códigos de los clientes frecuentes lleguen de verdad:

### Correo con Brevo (gratis, 300 correos al día, sin dominio propio)

1. Crea una cuenta en brevo.com.
2. En **Senders, domains & dedicated IPs → Senders**, agrega el correo que enviará los mensajes (por ejemplo, el Gmail de la pollería) y confírmalo con el enlace que te llega.
3. En **SMTP & API → API keys**, crea una llave.
4. En Render → Environment agrega:
   * `BREVO_API_KEY` = la llave.
   * `CORREO_REMITENTE` = `La Brasa Dorada <tucorreo@gmail.com>` (el correo confirmado en el punto 2).

> Si el remitente es un Gmail, algunos correos pueden caer en *Spam* porque no hay dominio propio. Con un dominio (por ejemplo `labrasadorada.pe`) verificado en Brevo, llegan a la bandeja principal.

### WhatsApp con Meta (WhatsApp Business Cloud API)

1. En developers.facebook.com crea una app de tipo **Business** y agrégale el producto **WhatsApp**.
2. Meta te da un **número de prueba** gratis: en **API Setup** agrega hasta 5 celulares que recibirán mensajes (te llega un código a cada uno). Para atender a cualquier cliente hay que registrar un número propio y un método de pago en el administrador de WhatsApp Business.
3. En **WhatsApp Manager → Plantillas de mensajes**, crea una plantilla de categoría **Autenticación**, idioma **Español**, con el botón **Copiar código**. Usa un nombre como `codigo_verificacion` y espera a que Meta la apruebe.
4. Crea un **usuario del sistema** en la configuración del negocio, dale acceso a la app y genera un **token permanente** con los permisos `whatsapp_business_messaging` y `whatsapp_business_management`.
5. En Render → Environment agrega:
   * `WHATSAPP_TOKEN` = el token permanente.
   * `WHATSAPP_PHONE_ID` = el *Phone number ID* que aparece en **API Setup**.
   * `WHATSAPP_PLANTILLA_CODIGO` = `codigo_verificacion` (el nombre de la plantilla).
   * `WHATSAPP_IDIOMA` = `es` (o el código de idioma con que creaste la plantilla, por ejemplo `es_PE`).

> Meta solo permite texto libre dentro de las 24 h siguientes a un mensaje del cliente. Los códigos usan la plantilla de autenticación y llegan siempre; los demás avisos (comprobantes, delivery) también necesitan plantillas aprobadas para llegar fuera de esa ventana.

### Después de configurar

* Al guardar las variables, Render reinicia la API. En **Administración → Sistema** aparece el proveedor activo (Brevo / WhatsApp Business).
* Cambia `SIMULADORES` a `false` cuando ya no necesites las pantallas `/correo` y `/whatsapp`.

## Antes de cada demostración

- Respalda la base de la nube. Desde `base_de_datos`:

  ```bash
  powershell -ExecutionPolicy Bypass -File .\respaldo.ps1 -Conexion "postgresql://postgres.xxxx:CLAVE@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"
  ```

- Abre la API (`/api/salud`) 2 o 3 minutos antes, por si se durmió.
- Revisa en Equipos y seguridad que todos los equipos digan **Vinculado**.

## Probar los dos dominios en la laptop

```bash
npm run dev:dos-dominios
```

Ejecútalo en la carpeta `frontend`, con la API encendida.

- **Comensal:** `http://<IP>:3002`. Prueba `/caja` y verás «Página no encontrada».
- **Personal:** `http://<IP>:3003`. Abrir `/m/M-01` te lleva al sitio del comensal.

Para practicar lo de los equipos en la laptop, activa **Exigir equipos vinculados** en Administración → Equipos y seguridad.
