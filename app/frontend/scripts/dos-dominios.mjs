// Simula en la laptop los dos dominios de la nube con el mismo código:
//   http://<IP>:3002  sitio del comensal  (como polleria-carta.vercel.app)
//   http://<IP>:3003  sitio del personal  (como polleria-gestion.vercel.app)
// La API sigue en el puerto 3001. Uso: npm run dev:dos-dominios
import { spawn } from 'child_process';
import { networkInterfaces } from 'os';

const ip =
  Object.values(networkInterfaces())
    .flat()
    .find((i) => i && i.family === 'IPv4' && !i.internal && !/^169\.254\./.test(i.address))?.address ?? 'localhost';
const comensal = `http://${ip}:3002`;

const sitios = [
  { nombre: 'comensal', puerto: 3002, env: { NEXT_PUBLIC_MODO: 'comensal', NEXT_DIST_DIR: '.next-comensal' } },
  { nombre: 'personal', puerto: 3003, env: { NEXT_PUBLIC_MODO: 'personal', NEXT_DIST_DIR: '.next-personal', NEXT_PUBLIC_URL_COMENSAL: comensal } },
];

for (const s of sitios) {
  const p = spawn(`npx next dev -H 0.0.0.0 -p ${s.puerto}`, { shell: true, env: { ...process.env, ...s.env } });
  const prefijo = `[${s.nombre}] `;
  p.stdout.on('data', (d) => process.stdout.write(String(d).replace(/^/gm, prefijo)));
  p.stderr.on('data', (d) => process.stderr.write(String(d).replace(/^/gm, prefijo)));
  p.on('exit', (c) => console.log(`${prefijo}terminó (${c})`));
}

console.log(`\n  Sitio del comensal: ${comensal}      (portada, carta QR /m/M-01, pago y comprobantes)`);
console.log(`  Sitio del personal: http://${ip}:3003   (mozo, caja, cocina, reparto, administración)\n`);
