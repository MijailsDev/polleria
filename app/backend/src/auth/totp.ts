// Verificación en dos pasos con códigos TOTP (RFC 6238), los mismos que generan
// Google Authenticator, Microsoft Authenticator o Authy: 6 dígitos que cambian cada 30 s.
// Se implementa con el módulo crypto de Node, sin librerías externas.
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const PERIODO_MS = 30_000;

export function aBase32(buf: Buffer) {
  let bits = 0;
  let valor = 0;
  let salida = '';
  for (const b of buf) {
    valor = (valor << 8) | b;
    bits += 8;
    while (bits >= 5) {
      salida += ALFABETO[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) salida += ALFABETO[(valor << (5 - bits)) & 31];
  return salida;
}

function desdeBase32(texto: string) {
  let bits = 0;
  let valor = 0;
  const salida: number[] = [];
  for (const c of texto.replace(/[\s=]/g, '').toUpperCase()) {
    const i = ALFABETO.indexOf(c);
    if (i < 0) continue;
    valor = (valor << 5) | i;
    bits += 5;
    if (bits >= 8) {
      salida.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(salida);
}

/** Código de 6 dígitos para un intervalo de 30 segundos. */
export function codigoTotp(secreto: string, paso: number) {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(paso));
  const h = createHmac('sha1', desdeBase32(secreto)).update(contador).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, '0');
}

/**
 * Devuelve el intervalo del código si es válido (acepta el anterior y el siguiente
 * por si el reloj del celular está un poco adelantado o atrasado), o null.
 */
export function verificarTotp(secreto: string, codigo: string, ahora = Date.now()) {
  const limpio = String(codigo ?? '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(limpio)) return null;
  const paso = Math.floor(ahora / PERIODO_MS);
  for (const d of [-1, 0, 1]) {
    if (timingSafeEqual(Buffer.from(codigoTotp(secreto, paso + d)), Buffer.from(limpio))) return paso + d;
  }
  return null;
}

/** Secreto nuevo de 160 bits en Base32 (lo que se escanea con la app). */
export const nuevoSecreto = () => aBase32(randomBytes(20));

/** Enlace otpauth:// que se muestra como QR para agregar la cuenta en la app. */
export const enlaceOtpauth = (secreto: string, cuenta: string, emisor: string) =>
  `otpauth://totp/${encodeURIComponent(`${emisor}:${cuenta}`)}?secret=${secreto}&issuer=${encodeURIComponent(emisor)}&algorithm=SHA1&digits=6&period=30`;
