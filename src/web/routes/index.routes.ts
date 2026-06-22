/**
 * Route → controller wiring for the web core (F-10/F-17). Mutating routes sit behind verifyCsrf.
 */
import { Router } from 'express';
import { verifyCsrf } from '../middleware/csrf.middleware';
import { uploadMiddleware } from '../middleware/upload.middleware';
import { homeController, uploadController } from '../controllers/upload.controller';
import { jobController, queueController } from '../controllers/job.controller';
import { downloadController, historyController } from '../controllers/history.controller';
import { UploadService } from '../services/upload.service';
import type { WebContext } from '../context';

export function createRouter(ctx: WebContext): Router {
  const router = Router();
  const uploadService = new UploadService(ctx.sessionStore, ctx.queue);

  router.get('/', homeController(ctx));
  router.get('/history', historyController(ctx));

  router.post('/api/upload', verifyCsrf, uploadMiddleware, uploadController(uploadService));
  router.get('/api/queue', queueController(ctx));
  router.get('/api/job/:jobId', jobController(ctx));
  router.get('/api/download/:recordId', downloadController(ctx));

  return router;
}
