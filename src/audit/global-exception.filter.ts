import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { STATUS_CODES } from 'http';
import { ErrorLogRequest, ErrorRecorder } from './error-recorder';

interface ResponseLike {
  setHeader(name: string, value: string): unknown;
  status(code: number): ResponseLike;
  json(payload: unknown): unknown;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly errorLogs: ErrorRecorder) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<ErrorLogRequest>();
    const response = http.getResponse<ResponseLike>();

    const { status, message } = describe(exception);
    const requestId = request?.requestId;

    if (status >= 500) {
      this.logger.error(
        `${request?.method ?? ''} ${request?.originalUrl ?? ''} -> ${status}`,
        exception instanceof Error ? exception.stack : undefined,
      );
      void this.errorLogs.record({ exception, status, request });
    }

    response.status(status).json({
      statusCode: status,
      message,
      error: STATUS_CODES[status] ?? 'Error',
      path: request?.originalUrl ?? request?.url,
      timestamp: new Date().toISOString(),
      ...(requestId ? { requestId } : {}),
    });
  }
}

function describe(exception: unknown): {
  status: number;
  message: string | string[];
} {
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const response = exception.getResponse();
    if (typeof response === 'string') return { status, message: response };
    if (response && typeof response === 'object' && 'message' in response) {
      return {
        status,
        message: (response as { message: string | string[] }).message,
      };
    }
    return { status, message: exception.message };
  }
  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: 'Internal server error.',
  };
}
