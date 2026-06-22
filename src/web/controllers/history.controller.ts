/**
 * History + download controllers (F-17). Reads results from the session's own output dir (F-16);
 * downloads are path-guarded and confined to that directory (SEC-06).
 */
import type { RequestHandler } from 'express';
import { FileHandlerRepository } from '../../repositories/file-handler.repository';
import type { Bucket, ProfileResult } from '../../domain/result.types';
import type { WebContext } from '../context';

export function summarise(results: ProfileResult[]): {
  total: number;
  buckets: Record<string, number>;
  average: number;
} {
  const buckets: Record<Bucket, number> = { HIGH: 0, MEDIUM: 0, LOW: 0, 'NOT FIT': 0 };
  const scores: number[] = [];
  for (const result of results) {
    if (result.bucket) buckets[result.bucket] += 1;
    if (typeof result.icp_score === 'number') scores.push(result.icp_score);
  }
  const average = scores.length
    ? Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 10) / 10
    : 0;
  return { total: results.length, buckets, average };
}

export const historyController =
  (ctx: WebContext): RequestHandler =>
  (req, res, next) => {
    try {
      const dirs = ctx.sessionStore.ensure(req.sessionID);
      const results = new FileHandlerRepository(dirs, ctx.logger)
        .listResults()
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      res.render('history', {
        title: 'History',
        csrfToken: res.locals.csrfToken,
        results,
        summary: summarise(results),
        emailIsDefault: !req.session.emailSettings,
      });
    } catch (error) {
      next(error);
    }
  };

export const downloadController =
  (ctx: WebContext): RequestHandler =>
  (req, res, next) => {
    try {
      const dirs = ctx.sessionStore.ensure(req.sessionID);
      const filePath = new FileHandlerRepository(dirs, ctx.logger).resultPath(req.params.recordId);
      res.download(filePath);
    } catch (error) {
      next(error);
    }
  };
