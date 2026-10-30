
import { randomUUID } from 'crypto';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

interface IdRequest {
  headers: Record<string, unknown>;
  requestId?: string;
}

interface IdResponse {
  setHeader(name: string, value: string): unknown;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');

  app.use((req: IdRequest, res: IdResponse, next: () => void) => {
    const headerId =
      typeof req.headers['x-request-id'] === 'string'
        ? req.headers['x-request-id']
        : '';

    const requestId = /^[\w.-]{1,64}$/.test(headerId)
      ? headerId
      : randomUUID();

    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = app.get(ConfigService);

  // Render's PORT takes priority over the local development port.
  const port = Number(
    process.env.PORT ||
    config.get<string>('PORT') ||
    config.get<string>('APP_PORT') ||
    3000,
  );

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid application port: ${port}`);
  }

  const corsOrigins = (
    config.get<string>('CORS_ORIGINS', '') || ''
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (corsOrigins.length) {
    app.enableCors({
      origin: corsOrigins,
      methods: [
        'GET',
        'HEAD',
        'POST',
        'PATCH',
        'PUT',
        'DELETE',
        'OPTIONS',
      ],
    });
  }

  
  const docsEnabled =
    config.get<string>('SWAGGER_ENABLED') === 'true' ||
    config.get<string>('NODE_ENV', 'development') !== 'production';

  if (docsEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Accounting Ledger API')
      .setDescription(
        'Multi-tenant accounting API. Every endpoint except the public login and ' +
        'menu routes requires a JWT issued by POST /api/v1/auth/login, ' +
        '/auth/company/login or /auth/platform/login.',
      )
      .setVersion('1')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Access token from one of the login endpoints.',
        },
        'bearer',
      )
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);

    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
      customSiteTitle: 'Accounting Ledger API docs',
    });
  }

  // Required for Render web services.
  await app.listen(port, '0.0.0.0');

  console.log(
    `Accounting Ledger API listening on 0.0.0.0:${port}` +
    `${docsEnabled ? ' (docs at /docs)' : ''}`,
  );
}

bootstrap().catch((error) => {
  console.error('Failed to start Accounting Ledger API:', error);
  process.exit(1);
});
