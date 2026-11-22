// Sesión del cliente frecuente en el celular del comensal (sin contraseña: un token firmado
// que se obtiene al confirmar el código enviado a su celular o correo).
const CLAVE = 'cliente-frecuente';

export interface EstadoCliente {
  nombre: string | null;
  contacto: string;
  canal: 'WHATSAPP' | 'CORREO';
  compras: number;
  meta: number;
  dias: number;
  montoMinimo: number;
  faltan: number;
  frecuente: boolean;
  aceptaPromociones: boolean;
}

export function leerCliente(): string | null {
  try {
    return typeof window === 'undefined' ? null : localStorage.getItem(CLAVE);
  } catch {
    return null;
  }
}

export function guardarCliente(token: string) {
  try {
    localStorage.setItem(CLAVE, token);
  } catch {
    /* sin almacenamiento: la sesión dura mientras la página esté abierta */
  }
}

export function olvidarCliente() {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    /* nada que borrar */
  }
}
