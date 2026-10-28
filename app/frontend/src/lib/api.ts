// Conexión con la API NestJS. Usa el mismo host desde el que se abrió la página,
// así funciona tanto en la laptop (localhost) como en celulares y tablets de la red local.
import { leerSesion, cerrarSesion } from './sesion';

export function urlServidor() {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window === 'undefined') return 'http://localhost:3001';
  return `${window.location.protocol}//${window.location.hostname}:3001`;
}

export class ErrorApi extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function api<T = any>(metodo: 'GET' | 'POST' | 'PATCH', ruta: string, cuerpo?: unknown): Promise<T> {
  const token = leerSesion()?.token;
  let res: Response;
  try {
    res = await fetch(`${urlServidor()}/api${ruta}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
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
    throw new ErrorApi(msg || 'Ocurrió un error. Inténtalo de nuevo.', res.status);
  }
  return datos as T;
}
