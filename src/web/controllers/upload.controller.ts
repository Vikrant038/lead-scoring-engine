/**
 * Upload + page controllers (F-10). Thin: delegate to the upload service / render views.
 */
import type { RequestHandler } from 'express';
import { ValidationError } from '../../lib/errors/domain-errors';
import type { WebContext } from '../context';
import type { UploadService } from '../services/upload.service';

export const homeController =
  (ctx: WebContext): RequestHandler =>
  (req, res) => {
    res.render('index', {
      title: 'Upload',
      csrfToken: res.locals.csrfToken,
      pollIntervalMs: ctx.configService.get().processing.pollIntervalMs,
      personas: ctx.personaRepo.list(),
      selectedPersona: req.session.selectedPersona ?? 'default-icp',
    });
  };

export const uploadController =
  (upload: UploadService): RequestHandler =>
  (req, res, next) => {
    try {
      if (!req.file) {
        throw new ValidationError('file', 'no file uploaded');
      }
      const userId = req.user!.id;
      const job = upload.accept(
        userId,
        req.file,
        req.session.selectedPersona,
        req.session.emailSettings,
      );
      res.json({ success: true, jobId: job.id });
    } catch (error) {
      next(error);
    }
  };
