export interface ErrorLogRequest {
  method?: string;
  originalUrl?: string;
  url?: string;
  ip?: string;
  requestId?: string;
  headers?: Record<string, unknown>;
  body?: unknown;
  actor?: { userId?: string; companyId?: string | null };
}

export abstract class ErrorRecorder {
  abstract record(input: {
    exception: unknown;
    status: number;
    request?: ErrorLogRequest;
  }): Promise<void>;
}
