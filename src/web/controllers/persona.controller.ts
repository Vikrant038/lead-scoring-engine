/**
 * Persona management controllers (F-12). List/edit/upload/save/delete persona files and manage the
 * session's active persona (FR-12-003..010). Ids pass through the repository's path-guard.
 */
import type { RequestHandler } from 'express';
import { ValidationError } from '../../lib/errors/domain-errors';
import { sanitiseId } from '../../lib/security/path-guard';
import type { WebContext } from '../context';

export const personasPageController =
  (ctx: WebContext): RequestHandler =>
  (req, res) => {
    res.render('personas', {
      title: 'Personas',
      csrfToken: res.locals.csrfToken,
      personas: ctx.personaRepo.list(),
      selectedPersona: req.session.selectedPersona ?? 'default-icp',
    });
  };

export const listPersonasController =
  (ctx: WebContext): RequestHandler =>
  (_req, res) => {
    res.json({ personas: ctx.personaRepo.list() });
  };

export const personaEditPageController =
  (ctx: WebContext): RequestHandler =>
  (req, res, next) => {
    try {
      const persona = ctx.personaRepo.get(req.params.id);
      res.render('persona-edit', {
        title: 'Edit Persona',
        csrfToken: res.locals.csrfToken,
        personaId: req.params.id,
        personaJson: JSON.stringify(persona, null, 2),
      });
    } catch (error) {
      next(error);
    }
  };

export const savePersonaController =
  (ctx: WebContext): RequestHandler =>
  (req, res, next) => {
    try {
      if (sanitiseId(req.params.id) === 'default-icp') {
        throw new ValidationError('persona', 'cannot modify default system persona');
      }
      ctx.personaRepo.save(req.params.id, req.body);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  };

export const uploadPersonaController =
  (ctx: WebContext): RequestHandler =>
  (req, res, next) => {
    try {
      if (!req.file) {
        throw new ValidationError('file', 'no persona file uploaded');
      }
      let raw: unknown;
      try {
        raw = JSON.parse(req.file.buffer.toString('utf8'));
      } catch {
        throw new ValidationError('file', 'persona file is not valid JSON');
      }
      const id = sanitiseId(req.file.originalname.replace(/\.json$/i, ''));
      if (id === 'default-icp') {
        throw new ValidationError('persona', 'cannot overwrite default system persona');
      }
      ctx.personaRepo.save(id, raw);
      res.json({ success: true, id });
    } catch (error) {
      next(error);
    }
  };

export const deletePersonaController =
  (ctx: WebContext): RequestHandler =>
  (req, res, next) => {
    try {
      ctx.personaRepo.delete(req.params.id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  };

export const setPersonaController = (): RequestHandler => (req, res, next) => {
  try {
    const personaId = (req.body as { personaId?: unknown }).personaId;
    if (typeof personaId !== 'string' || personaId.length === 0) {
      throw new ValidationError('personaId', 'a personaId string is required');
    }
    req.session.selectedPersona = personaId;
    res.json({ success: true, personaId });
  } catch (error) {
    next(error);
  }
};

export const currentPersonaController = (): RequestHandler => (req, res) => {
  res.json({ personaId: req.session.selectedPersona ?? 'default-icp' });
};

export const getPersonaController =
  (ctx: WebContext): RequestHandler =>
  (req, res, next) => {
    try {
      const persona = ctx.personaRepo.get(req.params.id);
      res.json(persona);
    } catch (error) {
      next(error);
    }
  };
