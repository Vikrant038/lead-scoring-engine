/**
 * CSRF synchronizer-token middleware (GUARDRAILS 2.5, CODING 4.1.1).
 * `ensureCsrfToken` mints a per-session token and exposes it to views; `verifyCsrf` rejects
 * state-changing requests lacking a matching `X-CSRF-Token` header.
 */
import type { RequestHandler } from 'express';
import { CsrfError } from '../../lib/errors/domain-errors';
import { generateCsrfToken, verifyCsrfToken } from '../../lib/security/csrf';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export const ensureCsrfToken: RequestHandler = (req, res, next) => {
  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCsrfToken();
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
};

export const verifyCsrf: RequestHandler = (req, _res, next) => {
  if (
    !MUTATING_METHODS.has(req.method) ||
    req.path.startsWith('/api/auth') ||
    req.originalUrl.startsWith('/api/auth')
  ) {
    return next();
  }
  const header = req.headers['x-csrf-token'];
  const token = typeof header === 'string' ? header : (req.body?._csrf as string | undefined);
  if (!verifyCsrfToken(req.session.csrfToken, token)) {
    return next(new CsrfError());
  }
  next();
};
