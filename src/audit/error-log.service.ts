import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErrorLog } from './error-log.entity';
import { ErrorLogRequest, ErrorRecorder } from './error-recorder';

const SENSITIVE_KEY = /pass|pwd|secret|token|authorization|cookie/i;
const MAX_BODY_JSON_CHARS = 8000;
const MAX_STRING_CHARS = 2000;
const MAX_DEPTH = 4;

@Injectable()
export class ErrorLogService extends ErrorRecorder {
  private readonly logger = new Logger(ErrorLogService.name);

  constructor(
    @InjectRepository(ErrorLog)
    private readonly errorLogs: Repository<ErrorLog>,
  ) {
    super();
  }

  async record(input: {
    exception: unknown;
    status: number;
    request?: ErrorLogRequest;
  }): Promise<void> {
    const req = input.request;
    try {
      await this.errorLogs.insert({
        statusCode: input.status,
        method: req?.method ?? null,
        path: req?.originalUrl ?? req?.url ?? null,
        message: extractMessage(input.exception),
        stack: input.exception instanceof Error ? input.exception.stack : null,
        errorName: extractName(input.exception),
        requestId: req?.requestId ?? null,
        userId: req?.actor?.userId ?? null,
        companyId: req?.actor?.companyId ?? null,
        ipAddress: clientIp(req),
        userAgent: headerString(req?.headers),
        requestBody: redactBody(req?.body),
      });
    } catch (error) {
      this.logger.error(
        'Failed to persist error log.',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}

function extractMessage(exception: unknown): string {
  if (exception instanceof Error) {
    return exception.message || exception.name || 'No message.';
  }
  if (typeof exception === 'string' && exception) return exception;
  return 'No message.';
}

function extractName(exception: unknown): string | null {
  if (exception instanceof Error) return exception.name.slice(0, 120);
  return null;
}

function clientIp(req?: ErrorLogRequest): string | null {
  const forwarded = req?.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded) {
    return forwarded.split(',')[0].trim().slice(0, 64);
  }
  if (typeof req?.ip === 'string' && req.ip) return req.ip.slice(0, 64);
  return null;
}

function headerString(headers?: Record<string, unknown>): string | null {
  const value = headers?.['user-agent'];
  return typeof value === 'string' && value ? value.slice(0, 500) : null;
}

function redactBody(body: unknown): object | null {
  if (!body || typeof body !== 'object') return null;
  try {
    const redacted = redact(body, 0) as object;
    if (JSON.stringify(redacted).length > MAX_BODY_JSON_CHARS) {
      return { note: 'request body omitted: payload too large' };
    }
    return redacted;
  } catch {
    return null;
  }
}

function redact(value: unknown, depth: number): unknown {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'string' && value.length > MAX_STRING_CHARS) {
      return value.slice(0, MAX_STRING_CHARS) + '...';
    }
    return value;
  }
  if (depth >= MAX_DEPTH) return '[max depth]';
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => redact(item, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEY.test(key) ? '[redacted]' : redact(item, depth + 1);
  }
  return out;
}
