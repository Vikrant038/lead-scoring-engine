/**
 * Job + queue status controllers (F-10). Session-scoped so users only see their own jobs.
 */
import type { RequestHandler } from 'express';
import { NotFoundError } from '../../lib/errors/domain-errors';
import { requireUserId } from '../middleware/auth.middleware';
import type { WebContext } from '../context';

export const jobController =
  (ctx: WebContext): RequestHandler =>
  (req, res, next) => {
    const userId = requireUserId(req);
    const job = ctx.queue.get(req.params.jobId, userId);
    if (!job || job.sessionId !== userId) {
      return next(new NotFoundError('Job', req.params.jobId));
    }
    res.json(job);
  };

export const queueController =
  (ctx: WebContext): RequestHandler =>
  (req, res) => {
    const userId = requireUserId(req);
    const jobs = ctx.queue.list(userId);
    res.json({ jobs });
  };
