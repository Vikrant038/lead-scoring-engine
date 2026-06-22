import { MulterError } from 'multer';
import type { Request, Response } from 'express';
import { ErrorCode } from '../../src/lib/errors/codes';
import { ForbiddenError, NotFoundError } from '../../src/lib/errors/domain-errors';
import { createErrorHandler } from '../../src/web/middleware/error-handler.middleware';
import { historyController, summarise } from '../../src/web/controllers/history.controller';
import { QueueService } from '../../src/web/services/queue.service';
import type { ProfileResult } from '../../src/domain/result.types';
import type { WebContext } from '../../src/web/context';
import { silentLogger } from '../helpers/test-deps';

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function mockRes(): Response & { statusCode: number; body: unknown } {
  const res = {
    statusCode: 0,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

describe('createErrorHandler classify', () => {
  const handler = createErrorHandler(silentLogger);
  const req = { correlationId: 'cid' } as Request;

  const run = (error: unknown): { statusCode: number; body: { error: { code: string } } } => {
    const res = mockRes();
    handler(error, req, res, jest.fn());
    return res as unknown as { statusCode: number; body: { error: { code: string } } };
  };

  it('should map domain errors to their status', () => {
    expect(run(new NotFoundError('Job', '1')).statusCode).toBe(404);
    expect(run(new ForbiddenError('x')).statusCode).toBe(403);
  });

  it('should map multer file-size and other errors', () => {
    expect(run(new MulterError('LIMIT_FILE_SIZE')).statusCode).toBe(413);
    expect(run(new MulterError('LIMIT_UNEXPECTED_FILE')).statusCode).toBe(400);
  });

  it('should map the unsupported media type sentinel and generic errors', () => {
    expect(run(new Error('UNSUPPORTED_MEDIA_TYPE')).statusCode).toBe(415);
    const generic = run(new Error('kaboom'));
    expect(generic.statusCode).toBe(500);
    expect(generic.body.error.code).toBe(ErrorCode.INTERNAL_ERROR);
  });
});

describe('summarise (history)', () => {
  it('should count buckets and average only scored results', () => {
    const results = [
      { bucket: 'HIGH', icp_score: 90 },
      { bucket: 'LOW', icp_score: 40 },
      { status: 'REJECTED' }, // no bucket, no score
    ] as ProfileResult[];
    const summary = summarise(results);
    expect(summary).toEqual({
      total: 3,
      buckets: { HIGH: 1, MEDIUM: 0, LOW: 1, 'NOT FIT': 0 },
      average: 65,
    });
  });

  it('should average 0 with no scored results', () => {
    expect(summarise([]).average).toBe(0);
  });

  it('historyController should forward errors to next', () => {
    const next = jest.fn();
    const ctx = {
      logger: silentLogger,
      sessionStore: {
        ensure: () => {
          throw new Error('fs failure');
        },
      },
    } as unknown as WebContext;
    historyController(ctx)({ sessionID: 's' } as never, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

describe('QueueService', () => {
  it('should throw when the queue is full', () => {
    const queue = new QueueService(async (job) => void (job.status = 'completed'), silentLogger, 0);
    expect(() => queue.enqueue({ sessionId: 's', fileName: 'f' })).toThrow(/queue is full/);
  });

  it('should mark a job as error when the processor throws', async () => {
    const queue = new QueueService(async () => {
      throw new Error('boom');
    }, silentLogger);
    const job = queue.enqueue({ sessionId: 's', fileName: 'f' });
    await delay(20);
    expect(queue.get(job.id)?.status).toBe('error');
  });

  it('should process sequentially without re-entrancy', async () => {
    const order: string[] = [];
    const queue = new QueueService(async (job) => {
      order.push(job.fileName);
      await delay(10);
      job.status = 'completed';
    }, silentLogger);
    const a = queue.enqueue({ sessionId: 's', fileName: 'a' });
    const b = queue.enqueue({ sessionId: 's', fileName: 'b' }); // run() should early-return here
    await delay(60);
    expect(order).toEqual(['a', 'b']);
    expect(queue.get(a.id)?.status).toBe('completed');
    expect(queue.get(b.id)?.status).toBe('completed');
  });
});
