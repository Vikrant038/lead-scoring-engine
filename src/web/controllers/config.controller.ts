/**
 * Config Editor controllers (F-11). Renders the current config as editable JSON and applies
 * validated edits to the in-memory ConfigService so subsequent scoring uses them immediately
 * (FR-11-004). Invalid edits surface as InvalidConfigError -> HTTP 400 (FR-11-003).
 */
import type { RequestHandler } from 'express';
import type { WebContext } from '../context';

export const configPageController =
  (ctx: WebContext): RequestHandler =>
  (_req, res) => {
    res.render('config-editor', {
      title: 'Config',
      csrfToken: res.locals.csrfToken,
      configJson: JSON.stringify(ctx.configService.get(), null, 2),
    });
  };

export const updateConfigController =
  (ctx: WebContext): RequestHandler =>
  (req, res, next) => {
    try {
      const config = ctx.configService.update(req.body);
      ctx.logger.info('configuration updated via web editor');
      res.json({ success: true, config });
    } catch (error) {
      next(error);
    }
  };

export const resetConfigController =
  (ctx: WebContext): RequestHandler =>
  (_req, res) => {
    const config = ctx.configService.reset();
    ctx.logger.info('configuration reset to defaults');
    res.json({ success: true, config });
  };
