import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import {
  applyNormalizedRedisUrlFromEnv,
  applyResolvedMongoUrlFromEnv,
  assertProductionEnv,
  isProduction,
  loadRenderSecretEnv,
  logMongoEnvDiagnostic,
  resolveCorsOrigins,
} from './config/env.validation';

async function bootstrap() {
  if (isProduction()) {
    console.error(
      '[cop-nest-api] env-loader v3 (..data secrets + COP_PRODUCTION_ENV_B64). Si no ves "entries" ni COP_PRODUCTION_ENV_B64 en Env check, haz Manual Deploy del ultimo commit.',
    );
  }
  loadRenderSecretEnv();
  applyResolvedMongoUrlFromEnv();
  applyNormalizedRedisUrlFromEnv();
  logMongoEnvDiagnostic();
  assertProductionEnv();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: isProduction()
      ? ['error', 'warn', 'log']
      : ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  const logger = new Logger('Bootstrap');
  app.set('trust proxy', 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  const corsOrigins = resolveCorsOrigins();

  if (isProduction() && !corsOrigins.length) {
    throw new Error(
      'CORS_ORIGINS or DASHBOARD_URL + PUBLIC_SITE_URL required in production',
    );
  }

  if (isProduction() && corsOrigins.length) {
    logger.log(`CORS origins: ${corsOrigins.join(', ')}`);
  }

  app.enableCors({
    origin: corsOrigins.length ? corsOrigins : true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept'],
    exposedHeaders: ['Authorization'],
    credentials: false,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  if (!isProduction()) {
    const config = new DocumentBuilder()
      .setTitle('COP Escalable API')
      .setDescription('Medical System Backend')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
