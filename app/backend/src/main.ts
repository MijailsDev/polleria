import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { ErroresFilter } from './comun/errores.filter';
import { PrismaService } from './comun/prisma.service';
import { verificarProduccion } from './comun/produccion';

async function bootstrap() {
  // rawBody: el webhook de la pasarela verifica la firma HMAC sobre el cuerpo exacto recibido
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  await verificarProduccion(app.get(PrismaService));
  // Las fotos de los platos llegan en base64 (hasta ~550 KB); el resto de solicitudes es pequeño
  app.useBodyParser('json', { limit: '1mb' });
  // Cabeceras de seguridad; la API la consume otro origen (la web), por eso CORP cross-origin
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.getHttpAdapter().getInstance().set('trust proxy', 1); // IP real detrás de Render o un proxy
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new ErroresFilter(app.get(PrismaService)));
  app.enableCors({ origin: origenesPermitidos() });
  app.enableShutdownHooks();
  const puerto = Number(process.env.PORT ?? 3001);
  await app.listen(puerto, '0.0.0.0'); // 0.0.0.0: accesible desde celulares y tablets de la red local
  console.log(`API del Sistema para Pollerías en http://localhost:${puerto}/api`);
}
/** CORS_ORIGIN=* solo en desarrollo; en producción, la lista de dominios de la web separados por coma. */
export function origenesPermitidos() {
  const o = process.env.CORS_ORIGIN ?? '*';
  return o === '*' ? true : o.split(',').map((x) => x.trim());
}

bootstrap();
