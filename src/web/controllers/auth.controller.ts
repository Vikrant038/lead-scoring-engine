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
import { db } from '../../db/connection';
import { user, verification } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { sendEmail } from '../../lib/email/fake-mailer';

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

    // Check if the user is verified in the database
    const [userRecord] = await db.select().from(user).where(eq(user.email, email)).limit(1);

    if (userRecord && !userRecord.emailVerified) {
      // Generate and send code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
      const id = Math.random().toString(36).substring(2);

      await db.delete(verification).where(eq(verification.identifier, email));
      await db.insert(verification).values({
        id,
        identifier: email,
        value: code,
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await sendEmail({
        to: email,
        subject: 'Verify your email — ICP Profiler',
        body: `Your 6-digit verification code is: ${code}. It will expire in 15 minutes.`,
      });

      return res.redirect(`/auth/verify-email?email=${encodeURIComponent(email)}`);
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

    // Generate and send 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
    const id = Math.random().toString(36).substring(2);

    await db.delete(verification).where(eq(verification.identifier, email));
    await db.insert(verification).values({
      id,
      identifier: email,
      value: code,
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await sendEmail({
      to: email,
      subject: 'Verify your email — ICP Profiler',
      body: `Your 6-digit verification code is: ${code}. It will expire in 15 minutes.`,
    });

    return res.redirect(`/auth/verify-email?email=${encodeURIComponent(email)}`);
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

// GET /auth/verify-email
export const verifyEmailPageController: RequestHandler = (req, res) => {
  const email = req.query.email;
  if (typeof email !== 'string') {
    return res.redirect('/auth/login');
  }

  res.render('verify-email', {
    title: 'Verify Email — ICP Profiler',
    csrfToken: res.locals.csrfToken,
    error: req.query.error ?? null,
    success: req.query.success ?? null,
    cspNonce: res.locals.cspNonce ?? '',
    email,
  });
};

// POST /auth/verify-email
export const verifyEmailPostController: RequestHandler = async (req, res) => {
  const { email, code } = req.body as { email?: string; code?: string };

  if (!email || !code) {
    return res.redirect(
      `/auth/verify-email?email=${encodeURIComponent(email ?? '')}&error=Code+is+required`,
    );
  }

  try {
    const [tokenRecord] = await db
      .select()
      .from(verification)
      .where(and(eq(verification.identifier, email), eq(verification.value, code)))
      .limit(1);

    if (!tokenRecord) {
      return res.redirect(
        `/auth/verify-email?email=${encodeURIComponent(email)}&error=Invalid+verification+code`,
      );
    }

    if (new Date(tokenRecord.expiresAt).getTime() < Date.now()) {
      return res.redirect(
        `/auth/verify-email?email=${encodeURIComponent(email)}&error=Verification+code+has+expired`,
      );
    }

    // Mark email as verified
    await db.update(user).set({ emailVerified: true }).where(eq(user.email, email));

    // Delete verification token
    await db.delete(verification).where(eq(verification.identifier, email));

    return res.redirect('/history');
  } catch {
    return res.redirect(
      `/auth/verify-email?email=${encodeURIComponent(email)}&error=An+unexpected+error+occurred`,
    );
  }
};

// POST /auth/verify-email/resend
export const resendVerificationPostController: RequestHandler = async (req, res) => {
  const { email } = req.body as { email?: string };

  if (!email) {
    return res.redirect('/auth/login');
  }

  try {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
    const id = Math.random().toString(36).substring(2);

    await db.delete(verification).where(eq(verification.identifier, email));

    await db.insert(verification).values({
      id,
      identifier: email,
      value: code,
      expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await sendEmail({
      to: email,
      subject: 'Verify your email — ICP Profiler',
      body: `Your new 6-digit verification code is: ${code}. It will expire in 15 minutes.`,
    });

    return res.redirect(
      `/auth/verify-email?email=${encodeURIComponent(email)}&success=A+new+verification+code+has+been+sent`,
    );
  } catch {
    return res.redirect(
      `/auth/verify-email?email=${encodeURIComponent(email)}&error=Failed+to+resend+code`,
    );
  }
};
