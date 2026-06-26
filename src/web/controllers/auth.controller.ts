/**
 * Auth view controllers (Phase 1 & Phase 2 Better Auth).
 * Renders login and register pages with dynamic OAuth configuration.
 */
import type { RequestHandler } from 'express';

// GET /auth/login
export const loginPageController: RequestHandler = (req, res) => {
  if (req.user) return res.redirect('/history');
  res.render('login', {
    title: 'Sign In — ICP Profiler',
    csrfToken: res.locals.csrfToken,
    error: null,
    cspNonce: res.locals.cspNonce ?? '',
    oauthProviders: {
      google: Boolean(process.env.GOOGLE_CLIENT_ID),
      github: Boolean(process.env.GITHUB_CLIENT_ID),
    },
  });
};

// GET /auth/register
export const registerPageController: RequestHandler = (req, res) => {
  if (req.user) return res.redirect('/history');
  res.render('register', {
    title: 'Create Account — ICP Profiler',
    csrfToken: res.locals.csrfToken,
    error: null,
    cspNonce: res.locals.cspNonce ?? '',
    oauthProviders: {
      google: Boolean(process.env.GOOGLE_CLIENT_ID),
      github: Boolean(process.env.GITHUB_CLIENT_ID),
    },
  });
};
