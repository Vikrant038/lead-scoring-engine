/**
 * Auth middleware (Phase 1). Redirects unauthenticated requests to /auth/login.
 * Applied to all protected routes in index.routes.ts.
 */
import type { RequestHandler } from 'express';

export const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.session.userId) {
    // Store the intended destination so we can redirect after login
    req.session.returnTo = req.originalUrl;
    return res.redirect('/auth/login');
  }
  next();
};
