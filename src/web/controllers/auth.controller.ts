/**
 * Auth view controllers (Phase 1 & Phase 2 Better Auth).
 * Renders login and register pages and bridges HTML form submissions to
 * Better Auth's REST API (/api/auth/*). Because the browser submits a
 * traditional HTML form we proxy the call server-side, forward the
 * Set-Cookie headers back to the client, then redirect on success.
 */
import type { RequestHandler } from 'express';
import { auth } from '../../lib/auth/auth';
import { toNodeHandler } from 'better-auth/node';

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

// ── Form-submit handlers (bridge HTML form → Better Auth REST API) ──────────

/**
 * POST /auth/login
 * Calls Better Auth's sign-in/email endpoint, forwards the session cookie
 * from Better Auth to the browser, and redirects to the app home on success.
 */
export const loginPostController: RequestHandler = async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    return res.redirect('/auth/login?error=Email+and+password+are+required');
  }

  try {
    const authRes = await auth.api.signInEmail({
      body: { email, password },
      asResponse: true,
    });

    if (!authRes.ok) {
      let message = 'Invalid email or password';
      try {
        const data = (await authRes.json()) as { message?: string };
        if (data.message) message = data.message;
      } catch {
        // ignore parse failure
      }
      return res.redirect(`/auth/login?error=${encodeURIComponent(message)}`);
    }

    // Forward Better Auth session cookie(s) to the browser
    const setCookie = authRes.headers.get('set-cookie');
    if (setCookie) {
      res.setHeader('Set-Cookie', setCookie);
    }

    const returnTo = typeof req.session?.returnTo === 'string' ? req.session.returnTo : '/';
    if (req.session?.returnTo) delete req.session.returnTo;

    return res.redirect(returnTo);
  } catch {
    return res.redirect('/auth/login?error=An+unexpected+error+occurred');
  }
};

/**
 * POST /auth/register
 * Calls Better Auth's sign-up/email endpoint, forwards the session cookie
 * from Better Auth to the browser, and redirects to the app home on success.
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
    const authRes = await auth.api.signUpEmail({
      body: { email, password, name: name ?? email },
      asResponse: true,
    });

    if (!authRes.ok) {
      let message = 'Registration failed';
      try {
        const data = (await authRes.json()) as { message?: string };
        if (data.message) message = data.message;
      } catch {
        // ignore parse failure
      }
      return res.redirect(`/auth/register?error=${encodeURIComponent(message)}`);
    }

    // Forward Better Auth session cookie(s) to the browser
    const setCookie = authRes.headers.get('set-cookie');
    if (setCookie) {
      res.setHeader('Set-Cookie', setCookie);
    }

    return res.redirect('/');
  } catch {
    return res.redirect('/auth/register?error=An+unexpected+error+occurred');
  }
};

/**
 * GET /auth/logout
 * Signs out via Better Auth, clears the session, and redirects to login.
 */
export const logoutController: RequestHandler = async (req, res) => {
  try {
    await auth.api.signOut({
      headers: req.headers as Record<string, string>,
      asResponse: true,
    });
  } catch {
    // best-effort sign-out
  }

  // Also destroy the CSRF express-session
  req.session.destroy(() => {
    res.redirect('/auth/login');
  });
};

// Re-export the Better Auth node handler for /api/auth/* routes
export const betterAuthHandler = toNodeHandler(auth);
