/**
 * Upload + page controllers (F-10). Thin: delegate to the upload service / render views.
 */
import type { RequestHandler } from 'express';
import { ValidationError } from '../../lib/errors/domain-errors';
import type { WebContext } from '../context';
import type { UploadService } from '../services/upload.service';

export const homeController =
  (ctx: WebContext): RequestHandler =>
  (_req, res) => {
    res.render('index', {
      title: 'Upload',
      csrfToken: res.locals.csrfToken,
      pollIntervalMs: ctx.config.processing.pollIntervalMs,
    });
  };

export const uploadController =
  (upload: UploadService): RequestHandler =>
  (req, res, next) => {
    try {
      if (!req.file) {
        throw new ValidationError('file', 'no file uploaded');
      }
      const job = upload.accept(req.sessionID, req.file, req.session.selectedPersona);
      res.json({ success: true, jobId: job.id });
    } catch (error) {
      next(error);
    }
  };
