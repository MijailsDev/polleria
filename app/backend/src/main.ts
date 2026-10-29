import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ErroresPrismaFilter } from './comun/errores.filter';

async function bootstrap() {
  // rawBody: el webhook de la pasarela verifica la firma HMAC sobre el cuerpo exacto recibido
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new ErroresPrismaFilter());
  app.enableCors({ origin: process.env.CORS_ORIGIN === '*' ? true : process.env.CORS_ORIGIN?.split(',') });
  const puerto = Number(process.env.PORT ?? 3001);
  await app.listen(puerto, '0.0.0.0'); // 0.0.0.0: accesible desde celulares y tablets de la red local
  console.log(`API del Sistema para Pollerías en http://localhost:${puerto}/api`);
}
bootstrap();
