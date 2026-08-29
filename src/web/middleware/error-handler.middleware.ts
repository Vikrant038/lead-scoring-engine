/**
 * Global error handler (CODING 2.5). Maps domain/multer errors to status codes and returns a
 * generic envelope; internal details are logged (with correlation id), never leaked (SEC-07).
 */
import type { ErrorRequestHandler } from 'express';
import { MulterError } from 'multer';
import { DomainError, statusForError } from '../../lib/errors/domain-errors';
import { ErrorCode } from '../../lib/errors/domain-errors';
import type { Logger } from '../../lib/logger/logger';

function classify(error: unknown): { status: number; code: string; message: string } {
  if (error instanceof DomainError) {
    return { status: statusForError(error), code: error.code, message: error.message };
  }
  if (error instanceof MulterError) {
    const tooLarge = error.code === 'LIMIT_FILE_SIZE';
    return {
      status: tooLarge ? 413 : 400,
      code: tooLarge ? ErrorCode.PAYLOAD_TOO_LARGE : ErrorCode.VALIDATION_FAILED,
      message: tooLarge ? 'File exceeds the 5 MB limit' : 'Invalid upload',
    };
  }
  if (error instanceof Error && error.message === 'UNSUPPORTED_MEDIA_TYPE') {
    return {
      status: 415,
      code: ErrorCode.UNSUPPORTED_MEDIA_TYPE,
      message: 'Only JSON files are allowed',
    };
  }
  return { status: 500, code: ErrorCode.INTERNAL_ERROR, message: 'Internal server error' };
}

export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Express requires the 4-arg shape
  return (error, req, res, _next) => {
    const { status, code, message } = classify(error);
    logger.error(
      { correlationId: req.correlationId, code, error: (error as Error).message },
      'request failed',
    );
    res.status(status).json({
      success: false,
      error: { message, code },
      metadata: { requestId: req.correlationId },
    });
  };
}
