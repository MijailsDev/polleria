# API · Sistema para Pollerías

NestJS 11 + Prisma 6 + PostgreSQL.

| Comando | Para qué |
|---|---|
| `npm run dev` | API en desarrollo, en `http://localhost:3001/api` |
| `npm run db:migrar` | Aplica las migraciones pendientes (`prisma/migrations`) |
| `node prisma/generar-migraciones.mjs` | Regenera las migraciones desde `base_de_datos/*.sql` |

En la nube corre en Render: `https://polleria-api-0ukm.onrender.com/api`
(se despliega solo al subir cambios de esta carpeta a `main`). Ver `../DESPLIEGUE.md`.
