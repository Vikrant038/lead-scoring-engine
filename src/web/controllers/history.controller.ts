/**
 * History + download controllers (F-17). Reads results from the session's own output dir (F-16);
 * downloads are path-guarded and confined to that directory (SEC-06).
 */
import type { RequestHandler } from 'express';
import { requireUserId } from '../middleware/auth.middleware';
import { FileHandlerRepository } from '../../repositories/file-handler.repository';
import { summarise as summariseBatch } from '../../batch/run-batch';
import type { ProfileResult } from '../../domain/types';
import type { WebContext } from '../context';

export function summarise(results: ProfileResult[]): {
  total: number;
  buckets: Record<string, number>;
  average: number;
} {
  const { bucketDistribution, averageScore, total } = summariseBatch(
    results.length,
    results,
    new Date(),
  );
  return { total, buckets: bucketDistribution, average: averageScore };
}

export interface BatchHistory {
  id: string;
  name: string;
  timestamp: string;
  results: ProfileResult[];
  summary: {
    total: number;
    buckets: Record<string, number>;
    average: number;
  };
}

export function groupIntoBatches(results: ProfileResult[]): BatchHistory[] {
  const groups = new Map<string, ProfileResult[]>();
  for (const result of results) {
    const batchId = result._batchId || result._sourceFile || 'unknown-batch';
    if (!groups.has(batchId)) {
      groups.set(batchId, []);
    }
    groups.get(batchId)!.push(result);
  }

  const batches: BatchHistory[] = [];
  for (const [id, batchResults] of groups.entries()) {
    batchResults.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const latestTimestamp = batchResults[0]?.timestamp || new Date().toISOString();
    let name = batchResults[0]?._batchName || batchResults[0]?._sourceFile || 'Batch';
    name = name.replace(/^\d+-/, '');

    batches.push({
      id,
      name,
      timestamp: latestTimestamp,
      results: batchResults,
      summary: summarise(batchResults),
    });
  }
  return batches.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export const historyController =
  (ctx: WebContext): RequestHandler =>
  (req, res, next) => {
    try {
      const userId = requireUserId(req);
      const dirs = ctx.sessionStore.ensure(userId);
      const results = new FileHandlerRepository(dirs, ctx.logger)
        .listResults()
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      res.render('history', {
        title: 'History',
        csrfToken: res.locals.csrfToken,
        results,
        batches: groupIntoBatches(results),
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
      const userId = requireUserId(req);
      const dirs = ctx.sessionStore.ensure(userId);
      const filePath = new FileHandlerRepository(dirs, ctx.logger).resultPath(req.params.recordId);
      res.download(filePath);
    } catch (error) {
      next(error);
    }
  };
