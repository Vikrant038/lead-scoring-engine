/**
 * DomainError hierarchy + HTTP status mapping (CODING 2.5).
 * Repositories/services throw these; the web global error handler maps `code` -> HTTP status.
 */
export enum ErrorCode {
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  FORBIDDEN = 'FORBIDDEN',
  UNAUTHORIZED = 'UNAUTHORIZED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  INVALID_CONFIG = 'INVALID_CONFIG',
  LLM_ERROR = 'LLM_ERROR',
  CSRF_INVALID = 'CSRF_INVALID',
  PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE',
  UNSUPPORTED_MEDIA_TYPE = 'UNSUPPORTED_MEDIA_TYPE',
}

export class DomainError extends Error {
  public readonly code: ErrorCode;

  constructor(message: string, code: ErrorCode) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string, id: string) {
    super(`${resource} ${id} not found`, ErrorCode.NOT_FOUND);
  }
}

export class ValidationError extends DomainError {
  constructor(field: string, reason: string) {
    super(`Validation failed: ${field} - ${reason}`, ErrorCode.VALIDATION_FAILED);
  }
}

export class ForbiddenError extends DomainError {
  constructor(action: string) {
    super(`Forbidden to ${action}`, ErrorCode.FORBIDDEN);
  }
}

export class UnauthorizedError extends DomainError {
  constructor() {
    super('Authentication required', ErrorCode.UNAUTHORIZED);
  }
}

export class InvalidConfigError extends DomainError {
  constructor(reason: string) {
    super(`Invalid configuration: ${reason}`, ErrorCode.INVALID_CONFIG);
  }
}

export class CsrfError extends DomainError {
  constructor() {
    super('Invalid or missing CSRF token', ErrorCode.CSRF_INVALID);
  }
}

export const errorStatusMap: Record<ErrorCode, number> = {
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.VALIDATION_FAILED]: 422,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.INVALID_CONFIG]: 400,
  [ErrorCode.LLM_ERROR]: 502,
  [ErrorCode.CSRF_INVALID]: 403,
  [ErrorCode.PAYLOAD_TOO_LARGE]: 413,
  [ErrorCode.UNSUPPORTED_MEDIA_TYPE]: 415,
};

/** Map any thrown value to an HTTP status (DomainError -> mapped; otherwise 500). */
export function statusForError(error: unknown): number {
  if (error instanceof DomainError) {
    return errorStatusMap[error.code];
  }
  return errorStatusMap[ErrorCode.INTERNAL_ERROR];
}
