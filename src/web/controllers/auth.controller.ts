/**
 * Auth view controllers (Phase 1 & Phase 2 Better Auth).
 * Renders login/register pages and bridges HTML form submissions to Better Auth's
 * REST API via fetch().
 *
 * WHY fetch() with Origin header:
 * Better Auth validates the Origin header on every mutating request (security).
 * Server-side fetch() calls don't carry a browser Origin automatically, so we
 * must add `Origin: <baseURL>` explicitly, and the baseURL must appear in
 * Better Auth's `trustedOrigins` config (see src/lib/auth/auth.ts).
 */
import 'dotenv/config';
import type { RequestHandler } from 'express';
import { auth } from '../../lib/auth/auth';
import { fromNodeHeaders } from 'better-auth/node';

// ── View controllers ────────────────────────────────────────────────────────

// GET /auth/login
export const loginPageController: RequestHandler = (req, res) => {
  if (req.user) return res.redirect('/history');
  res.render('login', {
    title: 'Sign In — ICP Profiler',
    csrfToken: res.locals.csrfToken,
    error: req.query.error ?? null,
    cspNonce: res.locals.cspNonce ?? '',
    oauthProviders: {
      google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      github: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    },
  });
};

// GET /auth/register
export const registerPageController: RequestHandler = (req, res) => {
  if (req.user) return res.redirect('/history');
  res.render('register', {
    title: 'Create Account — ICP Profiler',
    csrfToken: res.locals.csrfToken,
    error: req.query.error ?? null,
    cspNonce: res.locals.cspNonce ?? '',
    oauthProviders: {
      google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      github: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    },
  });
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function authBaseUrl(): string {
  return process.env.BETTER_AUTH_URL ?? 'http://localhost:3000';
}

/** Standard headers for server-side calls to Better Auth REST endpoints. */
function authFetchHeaders(req: Parameters<RequestHandler>[0]): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    // Better Auth validates Origin — must match trustedOrigins in auth.ts
    Origin: authBaseUrl(),
    // Forward browser cookies so the response session cookie chain works
    ...(req.headers.cookie ? { cookie: req.headers.cookie } : {}),
  };
}

/** Forward set-cookie headers from Better Auth REST response to Express response. */
function forwardCookies(authRes: Response, res: Parameters<RequestHandler>[1]): void {
  const getSetCookieFn = (authRes.headers as unknown as { getSetCookie?: () => string[] })
    .getSetCookie;
  const cookies =
    typeof getSetCookieFn === 'function'
      ? getSetCookieFn.call(authRes.headers)
      : authRes.headers.get('set-cookie');
  if (cookies) {
    res.setHeader('Set-Cookie', cookies);
  }
}

// ── Form-submit handlers ────────────────────────────────────────────────────

/**
 * POST /auth/login
 * Proxies to Better Auth's /api/auth/sign-in/email, forwards the session cookie.
 */
export const loginPostController: RequestHandler = async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.redirect('/auth/login?error=Email+and+password+are+required');
  }

  try {
    const authRes = await fetch(`${authBaseUrl()}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: authFetchHeaders(req),
      body: JSON.stringify({ email, password }),
    });

    if (!authRes.ok) {
      let message = 'Invalid email or password';
      try {
        const data = (await authRes.json()) as { message?: string };
        if (data.message) message = data.message;
      } catch {
        // ignore JSON parse error
      }
      return res.redirect(`/auth/login?error=${encodeURIComponent(message)}`);
    }

    forwardCookies(authRes, res);

    const returnTo = typeof req.session?.returnTo === 'string' ? req.session.returnTo : '/';
    if (req.session?.returnTo) delete req.session.returnTo;
    return res.redirect(returnTo);
  } catch {
    return res.redirect('/auth/login?error=An+unexpected+error+occurred');
  }
};

/**
 * POST /auth/register
 * Proxies to Better Auth's /api/auth/sign-up/email, forwards the session cookie.
 */
export const registerPostController: RequestHandler = async (req, res) => {
  const { email, password, name } = req.body as {
    email?: string;
    password?: string;
    name?: string;
  };

  if (!email || !password) {
    return res.redirect('/auth/register?error=Email+and+password+are+required');
  }

  try {
    const authRes = await fetch(`${authBaseUrl()}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: authFetchHeaders(req),
      body: JSON.stringify({ email, password, name: name ?? email }),
    });

    if (!authRes.ok) {
      let message = 'Registration failed';
      try {
        const data = (await authRes.json()) as { message?: string };
        if (data.message) message = data.message;
      } catch {
        // ignore JSON parse error
      }
      return res.redirect(`/auth/register?error=${encodeURIComponent(message)}`);
    }

    forwardCookies(authRes, res);

    return res.redirect('/');
  } catch {
    return res.redirect('/auth/register?error=An+unexpected+error+occurred');
  }
};

/**
 * GET /auth/logout
 * Signs out via Better Auth's REST API, destroys CSRF session, redirects.
 */
export const logoutController: RequestHandler = async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (session) {
      await fetch(`${authBaseUrl()}/api/auth/sign-out`, {
        method: 'POST',
        headers: authFetchHeaders(req),
      });
    }
  } catch {
    // best-effort sign-out
  }

  req.session.destroy(() => {
    res.redirect('/auth/login');
  });
};
