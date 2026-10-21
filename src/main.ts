import { randomUUID } from 'crypto';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  const port = config.get<number>('APP_PORT', 3000);

  await app.listen(port);

  console.log(`Accounting Ledger API running on port ${port}`);
}

void bootstrap();
