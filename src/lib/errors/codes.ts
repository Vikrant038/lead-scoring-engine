/**
 * Central error-code registry (CODING 2.5.1). All DomainError codes are sourced from this enum;
 * string literals in error constructors are forbidden.
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
