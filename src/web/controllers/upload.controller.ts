/**
 * Upload + page controllers (F-10). Thin: delegate to the upload service / render views.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { RequestHandler } from 'express';
import { ValidationError } from '../../lib/errors/domain-errors';
import { requireUserId } from '../middleware/auth.middleware';
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
      const userId = requireUserId(req);
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

export const demoBatchController =
  (upload: UploadService): RequestHandler =>
  (req, res, next) => {
    try {
      const demoPath = path.join(process.cwd(), 'data', 'demo-fallback.json');
      const buffer = fs.readFileSync(demoPath);
      const userId = requireUserId(req);
      const job = upload.accept(
        userId,
        { originalname: 'demo-fallback.json', buffer },
        req.session.selectedPersona,
        req.session.emailSettings,
      );
      res.json({ success: true, jobId: job.id });
    } catch (error) {
      next(error);
    }
  };
