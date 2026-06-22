/**
 * Attach a correlation id to every request/response (CODING 4.7) for traceable logging.
 */
import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

export const correlationId: RequestHandler = (req, res, next) => {
  const incoming = req.headers['x-correlation-id'];
  const id = (typeof incoming === 'string' && incoming) || randomUUID();
  req.correlationId = id;
  res.setHeader('x-correlation-id', id);
  next();
};
