/**
 * Auth middleware (Phase 1 Better Auth).
 * Verifies Better Auth session headers and attaches user to req and res.locals.
 */
import type { Request, Response, NextFunction } from 'express';
import { auth } from '../../lib/auth/auth';
import { fromNodeHeaders } from 'better-auth/node';

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    if (!session) {
      if (req.session) {
        req.session.returnTo = req.originalUrl;
      }
      res.redirect('/auth/login');
      return;
    }
    req.user = session.user;
    res.locals.user = session.user;
    next();
  } catch (error) {
    next(error);
  }
}
