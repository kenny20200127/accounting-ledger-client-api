import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { ErrorRecorder } from './error-recorder';
import { GlobalExceptionFilter } from './global-exception.filter';

class MockResponse {
  headers: Record<string, string> = {};
  statusCode = 0;
  body: unknown;
  setHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  status(code: number) {
    this.statusCode = code;
    return this;
  }
  json(payload: unknown) {
    this.body = payload;
    return this;
  }
}

function makeHost(req: Record<string, unknown>) {
  const response = new MockResponse();
  const host = {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;
  return { host, response };
}

const record = jest.fn<Promise<void>, []>();
const errorLogs: ErrorRecorder = { record };

function asBody(body: unknown): Record<string, unknown> {
  return body as Record<string, unknown>;
}

describe('GlobalExceptionFilter', () => {
  beforeEach(() => {
    record.mockClear();
  });

  it('keeps HttpException status and message and adds envelope fields', () => {
    const { host, response } = makeHost({
      requestId: 'req-1',
      originalUrl: '/api/v1/invoices',
    });
    new GlobalExceptionFilter(errorLogs).catch(
      new BadRequestException(['companyId must be a UUID']),
      host,
    );

    expect(response.statusCode).toBe(400);
    expect(asBody(response.body)).toMatchObject({
      statusCode: 400,
      message: ['companyId must be a UUID'],
      error: 'Bad Request',
      path: '/api/v1/invoices',
      requestId: 'req-1',
    });
    expect(typeof asBody(response.body).timestamp).toBe('string');
    expect(record).not.toHaveBeenCalled();
  });

  it('hides internals for unknown errors and logs them', () => {
    const { host, response } = makeHost({
      method: 'POST',
      url: '/api/v1/invoices',
    });
    const exception = new Error('database exploded');
    new GlobalExceptionFilter(errorLogs).catch(exception, host);

    expect(response.statusCode).toBe(500);
    expect(asBody(response.body).message).toBe('Internal server error.');
    expect(JSON.stringify(response.body)).not.toContain('database exploded');
    expect(record).toHaveBeenCalledWith({
      exception,
      status: 500,
      request: { method: 'POST', url: '/api/v1/invoices' },
    });
  });

  it('omits requestId when the request has none', () => {
    const { host, response } = makeHost({ url: '/api/v1/auth/login' });
    new GlobalExceptionFilter(errorLogs).catch(
      new BadRequestException('nope'),
      host,
    );

    expect(asBody(response.body).requestId).toBeUndefined();
  });
});
