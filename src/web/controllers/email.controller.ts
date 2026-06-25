/**
 * Email settings + outreach controllers (F-14, FR-16-010). Manage per-session sender details,
 * regenerate a single draft on demand, export all drafts, and clear the session's data silo.
 */
import type { RequestHandler } from 'express';
import { NotFoundError, ValidationError } from '../../lib/errors/domain-errors';
import { emailSettingsSchema } from '../../schemas/email-settings.schema';
import { FileHandlerRepository } from '../../repositories/file-handler.repository';
import type { EmailSettings } from '../../domain/result.types';
import type { WebContext } from '../context';

const FALLBACK_SETTINGS: EmailSettings = {
  senderName: 'Your Name',
  company: 'Your Company',
  tone: 'professional',
};

export const emailSettingsPageController = (): RequestHandler => (req, res) => {
  res.render('email-settings', {
    title: 'Email Settings',
    csrfToken: res.locals.csrfToken,
    settings: req.session.emailSettings ?? FALLBACK_SETTINGS,
    isDefault: !req.session.emailSettings,
  });
};

export const saveEmailSettingsController =
  (ctx: WebContext): RequestHandler =>
  (req, res, next) => {
    try {
      const parsed = emailSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError('emailSettings', parsed.error.issues[0]?.message ?? 'invalid');
      }
      req.session.emailSettings = parsed.data;
      ctx.logger.info('email settings updated');
      res.json({ success: true, settings: parsed.data });
    } catch (error) {
      next(error);
    }
  };

export const regenerateEmailController =
  (ctx: WebContext): RequestHandler =>
  async (req, res, next) => {
    try {
      const dirs = ctx.sessionStore.ensure(req.session.userId!);
      const fileHandler = new FileHandlerRepository(dirs, ctx.logger);
      const result = fileHandler.readResult(req.params.recordId);
      const sourceFile = result._sourceFile;
      const profile = sourceFile
        ? fileHandler.readSingleFile(sourceFile).find((p) => p._recordId === result._recordId)
        : undefined;
      if (!profile) {
        throw new NotFoundError('Profile', req.params.recordId);
      }

      const base = req.session.emailSettings ?? FALLBACK_SETTINGS;
      const tone =
        typeof req.query.tone === 'string' && req.query.tone ? req.query.tone : base.tone;
      const email = await ctx.emailGenerator.generate(profile, result, { ...base, tone });
      res.json({ success: true, email });
    } catch (error) {
      next(error);
    }
  };

export const exportEmailsController =
  (ctx: WebContext): RequestHandler =>
  (req, res, next) => {
    try {
      const dirs = ctx.sessionStore.ensure(req.session.userId!);
      const results = new FileHandlerRepository(dirs, ctx.logger).listResults();
      const blocks = results
        .filter((r) => r.outreach_email)
        .map(
          (r) =>
            `=== ${r.profile_name} (${r._recordId}) ===\n` +
            `Subject: ${r.outreach_email?.subject ?? ''}\n\n` +
            `${r.outreach_email?.body ?? ''}\n`,
        );
      const body = blocks.length
        ? blocks.join('\n----------------------------------------\n\n')
        : 'No email drafts available.';
      res.attachment('outreach-emails.txt');
      res.type('text/plain').send(body);
    } catch (error) {
      next(error);
    }
  };

export const clearDataController =
  (ctx: WebContext): RequestHandler =>
  (req, res, next) => {
    try {
      ctx.sessionStore.clear(req.session.userId!);
      req.session.selectedPersona = undefined;
      req.session.emailSettings = undefined;
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  };
