/**
 * Job + queue status controllers (F-10). Session-scoped so users only see their own jobs.
 */
import type { RequestHandler } from 'express';
import { NotFoundError } from '../../lib/errors/domain-errors';
import type { WebContext } from '../context';

export const jobController =
  (ctx: WebContext): RequestHandler =>
  (req, res, next) => {
    const job = ctx.queue.get(req.params.jobId);
    if (!job || job.sessionId !== req.session.userId!) {
      return next(new NotFoundError('Job', req.params.jobId));
    }
    res.json(job);
  };

export const queueController =
  (ctx: WebContext): RequestHandler =>
  (req, res) => {
    const jobs = ctx.queue.list().filter((job) => job.sessionId === req.session.userId!);
    res.json({ jobs });
  };
