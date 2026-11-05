// Conexión con la API NestJS. Usa el mismo host desde el que se abrió la página,
// así funciona tanto en la laptop (localhost) como en celulares y tablets de la red local.
import { leerSesion, cerrarSesion } from './sesion';
import { leerEquipo } from './equipo';

/** Cabeceras de cada solicitud: sesión del personal y llave del equipo vinculado. */
function cabeceras(json: boolean) {
  const token = leerSesion()?.token;
  const equipo = leerEquipo()?.llave;
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(equipo ? { 'X-Equipo': equipo } : {}),
  };
}

export function urlServidor() {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window === 'undefined') return 'http://localhost:3001';
  return `${window.location.protocol}//${window.location.hostname}:3001`;
}

export class ErrorApi extends Error {
  constructor(message: string, public status: number, public codigo?: string) {
    super(message);
  }
}

export async function api<T = any>(metodo: 'GET' | 'POST' | 'PATCH' | 'DELETE', ruta: string, cuerpo?: unknown): Promise<T> {
  const token = leerSesion()?.token;
  let res: Response;
  try {
    res = await fetch(`${urlServidor()}/api${ruta}`, {
      method: metodo,
      headers: cabeceras(true),
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorApi('Sin conexión con el servidor. Revisa la red e inténtalo de nuevo.', 0);
  }
  const texto = await res.text();
  const datos = texto ? JSON.parse(texto) : null;
  if (!res.ok) {
    if (res.status === 401 && token) cerrarSesion();
    const msg = Array.isArray(datos?.message) ? datos.message.join('. ') : datos?.message;
    throw new ErrorApi(msg || 'Ocurrió un error. Inténtalo de nuevo.', res.status, datos?.codigo);
  }
  return datos as T;
}

/** Descarga un archivo protegido (Excel, XML) con el token de la sesión. */
export async function descargarArchivo(ruta: string, nombre: string) {
  const res = await fetch(`${urlServidor()}/api${ruta}`, { headers: cabeceras(false) });
  if (!res.ok) {
    const d = await res.json().catch(() => null);
    throw new ErrorApi(d?.message ?? 'No se pudo descargar el archivo.', res.status);
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(await res.blob());
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(a.href);
}
