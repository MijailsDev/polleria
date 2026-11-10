'use client';
import type { NombreIcono } from '@/components/Ico';
// Llave del equipo vinculado (tablet del salón, caja, cocina, celular de reparto o laptop
// del dueño). La entrega el servidor al canjear el código de vinculación y viaja en la
// cabecera X-Equipo de cada solicitud.

export type TipoEquipo = 'SALON' | 'CAJA' | 'COCINA' | 'REPARTO' | 'ADMINISTRACION';
export interface EquipoGuardado { llave: string; equipo: { id: string; nombre: string; tipo: TipoEquipo } }

const CLAVE = 'polleria.equipo';

export const TIPOS_EQUIPO: { tipo: TipoEquipo; nombre: string; icono: NombreIcono; pantalla: string; quien: string }[] = [
  { tipo: 'SALON', nombre: 'Tablet del salón', icono: 'mesa', pantalla: '/mozo', quien: 'Mozos' },
  { tipo: 'CAJA', nombre: 'Terminal de caja', icono: 'billete', pantalla: '/caja', quien: 'Cajeros' },
  { tipo: 'COCINA', nombre: 'Pantalla de cocina', icono: 'llama', pantalla: '/cocina', quien: 'Sin PIN: solo ve comandas' },
  { tipo: 'REPARTO', nombre: 'Celular de reparto', icono: 'moto', pantalla: '/reparto', quien: 'Repartidores' },
  { tipo: 'ADMINISTRACION', nombre: 'Equipo de administración', icono: 'ajustes', pantalla: '/', quien: 'Todo el personal' },
];
export const tipoEquipo = (t: string) => TIPOS_EQUIPO.find((x) => x.tipo === t) ?? TIPOS_EQUIPO[4];

/** Avisa al resto de la página (Socket.IO) que cambiaron la sesión o el equipo. */
export const avisarCredenciales = () => typeof window !== 'undefined' && window.dispatchEvent(new Event('polleria:credenciales'));

export function leerEquipo(): EquipoGuardado | null {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem(CLAVE) ?? 'null');
  } catch {
    return null;
  }
}
export function guardarEquipo(e: EquipoGuardado) {
  localStorage.setItem(CLAVE, JSON.stringify(e));
  avisarCredenciales();
}
export function olvidarEquipo() {
  localStorage.removeItem(CLAVE);
  avisarCredenciales();
}
