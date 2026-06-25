/**
 * Route → controller wiring for the web app (F-10/F-17). CSRF is enforced globally for mutating
 * methods in `createApp`; AJAX clients send the token via the `X-CSRF-Token` header.
 */
import { Router } from 'express';
import { uploadMiddleware } from '../middleware/upload.middleware';
import { homeController, uploadController } from '../controllers/upload.controller';
import { jobController, queueController } from '../controllers/job.controller';
import { downloadController, historyController } from '../controllers/history.controller';
import {
  configPageController,
  resetConfigController,
  updateConfigController,
} from '../controllers/config.controller';
import {
  currentPersonaController,
  deletePersonaController,
  getPersonaController,
  listPersonasController,
  personaEditPageController,
  personasPageController,
  savePersonaController,
  setPersonaController,
  uploadPersonaController,
} from '../controllers/persona.controller';
import {
  clearDataController,
  emailSettingsPageController,
  exportEmailsController,
  regenerateEmailController,
  saveEmailSettingsController,
} from '../controllers/email.controller';
import { UploadService } from '../services/upload.service';
import type { WebContext } from '../context';

export function createRouter(ctx: WebContext): Router {
  const router = Router();
  const uploadService = new UploadService(ctx.sessionStore, ctx.queue);

  // Pages
  router.get('/', homeController(ctx));
  router.get('/history', historyController(ctx));
  router.get('/config', configPageController(ctx));
  router.get('/personas', personasPageController(ctx));
  router.get('/personas/:id/edit', personaEditPageController(ctx));
  router.get('/email-settings', emailSettingsPageController());

  // Upload + jobs (F-10)
  router.post('/api/upload', uploadMiddleware, uploadController(uploadService));
  router.get('/api/queue', queueController(ctx));
  router.get('/api/job/:jobId', jobController(ctx));
  router.get('/api/download/:recordId', downloadController(ctx));

  // Config (F-11)
  router.post('/api/config', updateConfigController(ctx));
  router.post('/api/config/reset', resetConfigController(ctx));

  // Personas (F-12)
  router.get('/api/personas', listPersonasController(ctx));
  router.get('/api/persona/:id', getPersonaController(ctx));
  router.get('/api/current-persona', currentPersonaController());
  router.post('/api/set-persona', setPersonaController());
  router.post('/api/upload-persona', uploadMiddleware, uploadPersonaController(ctx));
  router.put('/api/persona/:id', savePersonaController(ctx));
  router.delete('/api/persona/:id', deletePersonaController(ctx));

  // Email + data (F-14, FR-16-010)
  router.post('/api/email-settings', saveEmailSettingsController(ctx));
  router.get('/api/regenerate-email/:recordId', regenerateEmailController(ctx));
  router.get('/api/export-emails', exportEmailsController(ctx));
  router.post('/api/clear-data', clearDataController(ctx));

  return router;
}
