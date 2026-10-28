import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: process.env.CORS_ORIGIN === '*' ? true : process.env.CORS_ORIGIN?.split(',') });
  const puerto = Number(process.env.PORT ?? 3001);
  await app.listen(puerto, '0.0.0.0'); // 0.0.0.0: accesible desde celulares y tablets de la red local
  console.log(`API del Sistema para Pollerías en http://localhost:${puerto}/api`);
}
bootstrap();
