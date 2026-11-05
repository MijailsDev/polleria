// Revisión de seguridad al arrancar: en producción el servidor no inicia con la
// configuración de prueba (clave JWT por defecto, CORS abierto o PIN de prueba activos).
import { Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from './prisma.service';

const PIN_DE_PRUEBA = ['1234', '1111', '2222', '3333', '0000'];

export const enProduccion = () => process.env.NODE_ENV === 'production';

export async function verificarProduccion(prisma: PrismaService) {
  const log = new Logger('Seguridad');
  const problemas: string[] = [];
  const secreto = process.env.JWT_SECRET ?? '';
  if (secreto.length < 32 || /cambiar/i.test(secreto)) problemas.push('JWT_SECRET debe tener al menos 32 caracteres aleatorios (genera uno con: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64\'))").');
  if (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === '*') problemas.push('CORS_ORIGIN debe ser el dominio de la web (por ejemplo https://polleria.vercel.app), no «*».');
  if (!process.env.PASARELA_SECRETO) problemas.push('PASARELA_SECRETO no está definido (firma del webhook de pagos).');
  if (!process.env.SYNC_SECRET) problemas.push('SYNC_SECRET no está definido (firma de la sincronización con la nube).');

  const usuarios = await prisma.usuario.findMany({ where: { activo: true }, select: { nombre: true, pin_hash: true, password_hash: true, rol: true, totp_activo: true } });
  const avisos: string[] = [];
  for (const u of usuarios) {
    for (const pin of PIN_DE_PRUEBA) {
      if (await bcrypt.compare(pin, u.pin_hash)) {
        problemas.push(`El usuario «${u.nombre}» tiene el PIN de prueba ${pin}. Cámbialo en Administración → Usuarios.`);
        break;
      }
    }
    if (u.rol === 'ADMINISTRADOR' && u.password_hash && (await bcrypt.compare('Admin2026!', u.password_hash))) {
      problemas.push(`El administrador «${u.nombre}» usa la contraseña de prueba.`);
    }
    if (u.rol === 'ADMINISTRADOR' && !u.totp_activo) avisos.push(`El administrador «${u.nombre}» no tiene la verificación en dos pasos (Administración → Equipos y seguridad).`);
  }

  if ((process.env.CORS_ORIGIN ?? '').split(',').filter(Boolean).length === 1 && enProduccion()) avisos.push('CORS_ORIGIN tiene un solo dominio: si usas dos (comensal y personal), escribe ambos separados por coma.');
  for (const a of avisos) (enProduccion() ? log.warn(a) : log.debug(a));
  if (!problemas.length) return;
  if (enProduccion()) {
    for (const p of problemas) log.error(p);
    throw new Error(`El servidor no inicia en producción con configuración de prueba (${problemas.length} problema(s), ver arriba).`);
  }
  log.warn(`Modo desarrollo: ${problemas.length} ajuste(s) pendientes antes de producción:`);
  for (const p of problemas) log.warn(' · ' + p);
}
