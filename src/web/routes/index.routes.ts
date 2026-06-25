/**
 * Route → controller wiring for the web app (F-10/F-17). CSRF is enforced globally for mutating
 * methods in `createApp`; AJAX clients send the token via the `X-CSRF-Token` header.
 * Auth routes (/auth/*) are public; all other routes require a valid session (Phase 1).
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
import {
  loginPageController,
  loginController,
  registerPageController,
  registerController,
  logoutController,
} from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { UploadService } from '../services/upload.service';
import type { WebContext } from '../context';

export function createRouter(ctx: WebContext): Router {
  const router = Router();
  const uploadService = new UploadService(ctx.sessionStore, ctx.queue);

  // ── Auth (public) ──────────────────────────────────────────────────────────
  router.get('/auth/login', loginPageController);
  router.post('/auth/login', loginController);
  router.get('/auth/register', registerPageController);
  router.post('/auth/register', registerController);
  router.post('/auth/logout', logoutController);

  // ── Protected pages ────────────────────────────────────────────────────────
  router.get('/', requireAuth, homeController(ctx));
  router.get('/history', requireAuth, historyController(ctx));
  router.get('/config', requireAuth, configPageController(ctx));
  router.get('/personas', requireAuth, personasPageController(ctx));
  router.get('/personas/:id/edit', requireAuth, personaEditPageController(ctx));
  router.get('/email-settings', requireAuth, emailSettingsPageController());

  // ── Upload + jobs (F-10) ───────────────────────────────────────────────────
  router.post('/api/upload', requireAuth, uploadMiddleware, uploadController(uploadService));
  router.get('/api/queue', requireAuth, queueController(ctx));
  router.get('/api/job/:jobId', requireAuth, jobController(ctx));
  router.get('/api/download/:recordId', requireAuth, downloadController(ctx));

  // ── Config (F-11) ─────────────────────────────────────────────────────────
  router.post('/api/config', requireAuth, updateConfigController(ctx));
  router.post('/api/config/reset', requireAuth, resetConfigController(ctx));

  // ── Personas (F-12) ───────────────────────────────────────────────────────
  router.get('/api/personas', requireAuth, listPersonasController(ctx));
  router.get('/api/persona/:id', requireAuth, getPersonaController(ctx));
  router.get('/api/current-persona', requireAuth, currentPersonaController());
  router.post('/api/set-persona', requireAuth, setPersonaController());
  router.post('/api/upload-persona', requireAuth, uploadMiddleware, uploadPersonaController(ctx));
  router.put('/api/persona/:id', requireAuth, savePersonaController(ctx));
  router.delete('/api/persona/:id', requireAuth, deletePersonaController(ctx));

  // ── Email + data (F-14, FR-16-010) ────────────────────────────────────────
  router.post('/api/email-settings', requireAuth, saveEmailSettingsController(ctx));
  router.get('/api/regenerate-email/:recordId', requireAuth, regenerateEmailController(ctx));
  router.get('/api/export-emails', requireAuth, exportEmailsController(ctx));
  router.post('/api/clear-data', requireAuth, clearDataController(ctx));

  return router;
}
