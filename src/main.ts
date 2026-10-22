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
    const requestId = /^[\w.-]{1,64}$/.test(headerId) ? headerId : randomUUID();
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
  const port =
    config.get<string>('APP_PORT') || config.get<string>('PORT') || 3000;

  // Rendered clients call this API from another origin; local dev uses the Vite
  // proxy and leaves CORS_ORIGINS unset.
  const corsOrigins = (config.get<string>('CORS_ORIGINS', '') as string)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (corsOrigins.length) {
    app.enableCors({
      origin: corsOrigins,
      methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
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

  await app.listen(port);

  console.log(
    `Accounting Ledger API running on port ${port}${docsEnabled ? ' (docs at /docs)' : ''}`,
  );
}

void bootstrap();
