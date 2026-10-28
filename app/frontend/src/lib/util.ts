'use client';
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { urlServidor } from './api';

export const soles = (n: number) => `S/ ${Number(n ?? 0).toFixed(2)}`;

export const hora = (d: string | Date | null) =>
  d ? new Date(d).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '';

export function minutosDesde(d: string | Date | null) {
  if (!d) return '';
  const m = Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 60000));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

// ------------------------------------------------------------------ Tiempo real

let socket: Socket | null = null;
export function obtenerSocket() {
  if (!socket) socket = io(urlServidor(), { transports: ['websocket', 'polling'] });
  return socket;
}

/** Suscribe a eventos del servidor mientras el componente está montado. */
export function useEventos(eventos: Record<string, (datos: any) => void>, deps: unknown[] = []) {
  useEffect(() => {
    const s = obtenerSocket();
    Object.entries(eventos).forEach(([e, f]) => s.on(e, f));
    return () => Object.entries(eventos).forEach(([e, f]) => s.off(e, f));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/** Estado de la conexión en tiempo real (para el indicador En línea / Sin conexión). */
export function useConexion() {
  const [conectado, setConectado] = useState(false);
  useEffect(() => {
    const s = obtenerSocket();
    const on = () => setConectado(true);
    const off = () => setConectado(false);
    setConectado(s.connected);
    s.on('connect', on);
    s.on('disconnect', off);
    return () => {
      s.off('connect', on);
      s.off('disconnect', off);
    };
  }, []);
  return conectado;
}

// ------------------------------------------------------------------ Sonido (simula el buzzer)

let audio: AudioContext | null = null;
export function pitido(veces = 1, frecuencia = 880) {
  try {
    audio ??= new (window.AudioContext || (window as any).webkitAudioContext)();
    for (let i = 0; i < veces; i++) {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.frequency.value = frecuencia;
      o.type = 'square';
      g.gain.value = 0.08;
      o.connect(g).connect(audio.destination);
      const t = audio.currentTime + i * 0.3;
      o.start(t);
      o.stop(t + 0.18);
    }
  } catch {
    /* sin audio disponible */
  }
}
