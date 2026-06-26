/**
 * Auth view controllers (Phase 1 & Phase 2 Better Auth).
 * Renders login and register pages and bridges HTML form submissions to
 * Better Auth's REST API via fetch().
 *
 * WHY fetch() instead of auth.api.*:
 * Better Auth's server-side handler (auth.api.signInEmail) requires
 * Request-like context including proper headers. Calling it directly from
 * an Express handler without those headers causes schema-lookup errors.
 * Using fetch() against Better Auth's own HTTP endpoint is the simplest,
 * most reliable approach: it handles cookies, CORS, and schema lookups
 * exactly as it would for a browser client.
 */
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
    error: req.query.error ?? null,
    cspNonce: res.locals.cspNonce ?? '',
    oauthProviders: {
      google: Boolean(process.env.GOOGLE_CLIENT_ID),
      github: Boolean(process.env.GITHUB_CLIENT_ID),
    },
  });
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function authBaseUrl(): string {
  return process.env.BETTER_AUTH_URL ?? 'http://localhost:3000';
}

// ── Form-submit handlers ────────────────────────────────────────────────────

/**
 * POST /auth/login
 * Proxies to Better Auth's /api/auth/sign-in/email endpoint via HTTP fetch,
 * forwarding the resulting session cookie back to the browser.
 */
export const loginPostController: RequestHandler = async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.redirect('/auth/login?error=Email+and+password+are+required');
  }

  try {
    const authRes = await fetch(`${authBaseUrl()}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Forward the browser's cookies so Better Auth can set up the session
        ...(req.headers.cookie ? { cookie: req.headers.cookie } : {}),
      },
      body: JSON.stringify({ email, password }),
    });

    if (!authRes.ok) {
      let message = 'Invalid email or password';
      try {
        const data = (await authRes.json()) as { message?: string };
        if (data.message) message = data.message;
      } catch {
        // ignore parse error
      }
      return res.redirect(`/auth/login?error=${encodeURIComponent(message)}`);
    }

    // Forward the session cookie Better Auth set
    const setCookie = authRes.headers.get('set-cookie');
    if (setCookie) res.setHeader('Set-Cookie', setCookie);

    const returnTo = typeof req.session?.returnTo === 'string' ? req.session.returnTo : '/';
    if (req.session?.returnTo) delete req.session.returnTo;
    return res.redirect(returnTo);
  } catch {
    return res.redirect('/auth/login?error=An+unexpected+error+occurred');
  }
};

/**
 * POST /auth/register
 * Proxies to Better Auth's /api/auth/sign-up/email endpoint via HTTP fetch.
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
      headers: {
        'Content-Type': 'application/json',
        ...(req.headers.cookie ? { cookie: req.headers.cookie } : {}),
      },
      body: JSON.stringify({ email, password, name: name ?? email }),
    });

    if (!authRes.ok) {
      let message = 'Registration failed';
      try {
        const data = (await authRes.json()) as { message?: string };
        if (data.message) message = data.message;
      } catch {
        // ignore parse error
      }
      return res.redirect(`/auth/register?error=${encodeURIComponent(message)}`);
    }

    const setCookie = authRes.headers.get('set-cookie');
    if (setCookie) res.setHeader('Set-Cookie', setCookie);

    return res.redirect('/');
  } catch {
    return res.redirect('/auth/register?error=An+unexpected+error+occurred');
  }
};

/**
 * GET /auth/logout
 * Signs out via Better Auth's REST API, destroys the CSRF session, redirects.
 */
export const logoutController: RequestHandler = async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (session) {
      await fetch(`${authBaseUrl()}/api/auth/sign-out`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(req.headers.cookie ? { cookie: req.headers.cookie } : {}),
        },
      });
    }
  } catch {
    // best-effort
  }

  req.session.destroy(() => {
    res.redirect('/auth/login');
  });
};
