// Datos iniciales para una base nueva (después de «npx prisma migrate deploy»):
// carta, mesas, modificadores y combo de ejemplo.
//
//   node prisma/semilla.mjs                 → con los usuarios de prueba (desarrollo)
//   SEMILLA=produccion ADMIN_NOMBRE="Juan Pérez" ADMIN_PIN=4821 ADMIN_PASSWORD="..." node prisma/semilla.mjs
//                                           → desactiva los usuarios de prueba y crea al administrador real
//
// Es seguro ejecutarlo una sola vez por base: si ya hay mesas, no vuelve a cargar la carta.
import 'dotenv/config';
import { execSync } from 'child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const aqui = dirname(fileURLToPath(import.meta.url));
const scripts = join(aqui, '..', '..', '..', 'base_de_datos');
const prisma = new PrismaClient();

const limpiar = (archivo) =>
  readFileSync(join(scripts, archivo), 'utf8')
    .split(/\r?\n/)
    .filter((l) => !/^(BEGIN|COMMIT);\s*$/.test(l) && !l.startsWith('\\'))
    .join('\n');

function ejecutar(archivo) {
  const tmp = join(mkdtempSync(join(tmpdir(), 'semilla-')), archivo);
  writeFileSync(tmp, limpiar(archivo));
  execSync(`npx prisma db execute --schema "${join(aqui, 'schema.prisma')}" --file "${tmp}"`, { stdio: 'inherit' });
}

const mesas = await prisma.mesa.count();
if (mesas === 0) {
  console.log('Cargando carta, mesas y usuarios iniciales…');
  ejecutar('03_datos_iniciales.sql');
  ejecutar('06_produccion.sql'); // combo y precios de ejemplo (idempotente)
} else {
  console.log(`La base ya tiene ${mesas} mesas: no se vuelve a cargar la carta.`);
}

if (process.env.SEMILLA === 'produccion') {
  const { ADMIN_NOMBRE, ADMIN_PIN, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_NOMBRE || !/^[0-9]{4,6}$/.test(ADMIN_PIN ?? '') || (ADMIN_PASSWORD ?? '').length < 10) {
    console.error('Define ADMIN_NOMBRE, ADMIN_PIN (4 a 6 dígitos, que no sea 1234) y ADMIN_PASSWORD (10 caracteres o más).');
    process.exit(1);
  }
  if (['1234', '1111', '2222', '3333', '0000'].includes(ADMIN_PIN)) {
    console.error('Ese PIN es de prueba. Elige otro.');
    process.exit(1);
  }
  // Los usuarios de prueba se desactivan (no se borran: la bitácora los referencia)
  const r = await prisma.usuario.updateMany({ where: { nombre: { contains: 'prueba' } }, data: { activo: false } });
  await prisma.$executeRaw`
    INSERT INTO usuario (nombre, rol, pin_hash, password_hash)
    VALUES (${ADMIN_NOMBRE}, 'ADMINISTRADOR', crypt(${ADMIN_PIN}, gen_salt('bf')), crypt(${ADMIN_PASSWORD}, gen_salt('bf')))`;
  console.log(`Administrador «${ADMIN_NOMBRE}» creado; ${r.count} usuario(s) de prueba desactivados. Crea al resto del personal desde Administración → Usuarios.`);
}
await prisma.$disconnect();
