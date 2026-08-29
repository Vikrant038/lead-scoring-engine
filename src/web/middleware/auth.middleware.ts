/**
 * Auth middleware (Phase 1 Better Auth).
 * Verifies Better Auth session headers and attaches user to req and res.locals.
 */
import type { Request, Response, NextFunction } from 'express';
import { auth } from '../../lib/auth/auth';
import { fromNodeHeaders } from 'better-auth/node';
import { UnauthorizedError } from '../../lib/errors/domain-errors';

/**
 * Assert an authenticated user id or throw UnauthorizedError (401).
 * Controllers use this instead of repeating the null check.
 */
export function requireUserId(req: Request): string {
  const userId = req.user?.id;
  if (!userId) {
    throw new UnauthorizedError();
  }
  return userId;
}

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

    // Gate access for unverified users
    if (!session.user.emailVerified) {
      res.redirect(`/auth/verify-email?email=${encodeURIComponent(session.user.email)}`);
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
}
