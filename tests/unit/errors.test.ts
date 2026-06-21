import { ErrorCode } from '../../src/lib/errors/codes';
import {
  CsrfError,
  DomainError,
  ForbiddenError,
  InvalidConfigError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  statusForError,
} from '../../src/lib/errors/domain-errors';

describe('domain errors', () => {
  it('should carry a code and a constructor-derived name when a DomainError is created', () => {
    // Arrange / Act
    const error = new NotFoundError('Persona', 'abc');
    // Assert
    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe(ErrorCode.NOT_FOUND);
    expect(error.name).toBe('NotFoundError');
    expect(error.message).toBe('Persona abc not found');
  });

  it('should format ValidationError with field and reason', () => {
    const error = new ValidationError('name', 'required');
    expect(error.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(error.message).toBe('Validation failed: name - required');
  });

  it('should map a DomainError to its HTTP status', () => {
    expect(statusForError(new ForbiddenError('delete persona'))).toBe(403);
    expect(statusForError(new NotFoundError('Lead', '1'))).toBe(404);
    expect(statusForError(new ValidationError('x', 'bad'))).toBe(422);
  });

  it('should map an unknown thrown value to 500', () => {
    expect(statusForError(new Error('boom'))).toBe(500);
    expect(statusForError('string error')).toBe(500);
  });

  it('should construct the remaining domain errors with correct codes and statuses', () => {
    const unauthorized = new UnauthorizedError();
    const invalidConfig = new InvalidConfigError('missing scoring key');
    const csrf = new CsrfError();

    expect([unauthorized.code, statusForError(unauthorized)]).toEqual([
      ErrorCode.UNAUTHORIZED,
      401,
    ]);
    expect([invalidConfig.code, statusForError(invalidConfig)]).toEqual([
      ErrorCode.INVALID_CONFIG,
      400,
    ]);
    expect([csrf.code, statusForError(csrf)]).toEqual([ErrorCode.CSRF_INVALID, 403]);
    expect(invalidConfig.message).toContain('missing scoring key');
  });
});
