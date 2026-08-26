/**
 * express-session with hardened cookie attributes (GUARDRAILS 2.5):
 * HttpOnly + SameSite=Strict, and Secure in production.
 */
import session from 'express-session';
import type { RequestHandler } from 'express';

export function createSessionMiddleware(secret: string): RequestHandler {
  return session({
    name: 'icp.sid',
    secret,
    resave: false,
    saveUninitialized: true, // a session is needed up-front to hold the CSRF token
    proxy: process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL),
    cookie: {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 8,
    },
  });
}
