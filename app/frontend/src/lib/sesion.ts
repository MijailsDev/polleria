'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export type Rol = 'MOZO' | 'CAJERO' | 'REPARTIDOR' | 'ADMINISTRADOR';
export interface Sesion {
  token: string;
  usuario: { id: string; nombre: string; rol: Rol };
}

const CLAVE = 'polleria.sesion';

export function leerSesion(): Sesion | null {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem(CLAVE) ?? 'null');
  } catch {
    return null;
  }
}
export function guardarSesion(s: Sesion) {
  localStorage.setItem(CLAVE, JSON.stringify(s));
}
export function cerrarSesion() {
  localStorage.removeItem(CLAVE);
}

/** Pantalla del personal: pide sesión y uno de los roles indicados (el administrador entra a todo). */
export function useSesion(roles: Rol[]) {
  const router = useRouter();
  const [sesion, setSesion] = useState<Sesion | null>(null);
  useEffect(() => {
    const s = leerSesion();
    if (!s) {
      router.replace(`/login?volver=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (s.usuario.rol !== 'ADMINISTRADOR' && !roles.includes(s.usuario.rol)) {
      router.replace('/login?permiso=0');
      return;
    }
    setSesion(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return sesion;
}
