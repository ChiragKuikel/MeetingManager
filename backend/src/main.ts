import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import path from 'path';
import { AppModule } from './app.module';
import { env } from './config/environment';

// video.fileSize is BigInt — JSON.stringify throws on it without this.
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors({
    origin: env.CORS_ORIGINS,
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.setGlobalPrefix('api');
  app.useStaticAssets(path.join(process.cwd(), env.UPLOAD_DIR), { prefix: '/uploads' });

  await app.listen(env.PORT);
  console.log(`Server running on http://localhost:${env.PORT}`);
}

bootstrap();
