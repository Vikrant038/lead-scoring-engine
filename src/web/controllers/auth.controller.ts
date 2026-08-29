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
import { randomInt, randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { auth } from '../../lib/auth/auth';
import { fromNodeHeaders } from '../../lib/auth/better-auth-esm';
import { db } from '../../db/connection';
import { user, verification } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { sendEmail } from '../../lib/email/fake-mailer';

// ── View controllers ────────────────────────────────────────────────────────

/** Which social providers have credentials configured (drives login/register buttons). */
function configuredOAuthProviders(): { google: boolean; github: boolean } {
  return {
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    github: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
  };
}

// GET /auth/login
export const loginPageController: RequestHandler = (req, res) => {
  if (req.user) return res.redirect('/history');
  res.render('login', {
    title: 'Sign In — ICP Profiler',
    csrfToken: res.locals.csrfToken,
    error: req.query.error ?? null,
    cspNonce: res.locals.cspNonce ?? '',
    oauthProviders: configuredOAuthProviders(),
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
    oauthProviders: configuredOAuthProviders(),
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

/**
 * Issue a fresh 6-digit CSPRNG verification code and email it to the user.
 * Shared by login (unverified user), register, and resend.
 */
async function issueVerificationCode(email: string): Promise<void> {
  const code = randomInt(100000, 1000000).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

  await db.delete(verification).where(eq(verification.identifier, email));
  await db.insert(verification).values({
    id: randomUUID(),
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
}

/**
 * Redirect to the verify-email page with query params, resetting the state machine to
 * 'initiated' so the redirect target is not treated as a page refresh (which cancels it).
 */
function redirectVerify(
  req: Parameters<RequestHandler>[0],
  res: Parameters<RequestHandler>[1],
  params: Record<string, string>,
): void {
  req.session.verificationStep = 'initiated';
  res.redirect(`/auth/verify-email?${new URLSearchParams(params).toString()}`);
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
      await issueVerificationCode(email);
      redirectVerify(req, res, { email });
      return;
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
    // Check if the user already exists in the database
    const [existingUser] = await db.select().from(user).where(eq(user.email, email)).limit(1);
    if (existingUser) {
      return res.redirect('/auth/register?error=Email+already+registered');
    }

    // Store registration details temporarily in the session
    req.session.tempUser = {
      email,
      password,
      name: name ?? email,
    };

    await issueVerificationCode(email);
    redirectVerify(req, res, { email });
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
export const verifyEmailPageController: RequestHandler = async (req, res) => {
  const email = req.query.email;
  if (typeof email !== 'string') {
    return res.redirect('/auth/login');
  }

  // Detect manual page refresh/reload
  if (req.session.verificationStep === 'loaded') {
    // Expire OTP and end verification
    await db.delete(verification).where(eq(verification.identifier, email));
    delete req.session.tempUser;
    delete req.session.verificationStep;
    return res.redirect('/auth/register?error=Verification+cancelled+due+to+page+refresh');
  }

  // Transition from 'initiated' to 'loaded'
  if (req.session.verificationStep === 'initiated') {
    req.session.verificationStep = 'loaded';
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
    redirectVerify(req, res, { email: email ?? '', error: 'Code is required' });
    return;
  }

  try {
    const [tokenRecord] = await db
      .select()
      .from(verification)
      .where(and(eq(verification.identifier, email), eq(verification.value, code)))
      .limit(1);

    if (!tokenRecord) {
      redirectVerify(req, res, { email, error: 'Invalid verification code' });
      return;
    }

    if (new Date(tokenRecord.expiresAt).getTime() < Date.now()) {
      redirectVerify(req, res, { email, error: 'Verification code has expired' });
      return;
    }

    // If it's a new registration, create the account in the database now
    if (req.session.tempUser && req.session.tempUser.email === email) {
      const { password, name } = req.session.tempUser;

      // Call Better Auth to create the user
      const signupRes = await fetch(`${authBaseUrl()}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: authFetchHeaders(req),
        body: JSON.stringify({ email, password, name }),
      });

      if (!signupRes.ok) {
        let message = 'Registration failed';
        try {
          const data = (await signupRes.json()) as { message?: string };
          if (data.message) message = data.message;
        } catch {
          // ignore
        }
        redirectVerify(req, res, { email, error: message });
        return;
      }

      // Mark the user as verified in the database
      await db.update(user).set({ emailVerified: true }).where(eq(user.email, email));

      // Sign the user in to establish session cookies
      const signinRes = await fetch(`${authBaseUrl()}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: authFetchHeaders(req),
        body: JSON.stringify({ email, password }),
      });

      if (!signinRes.ok) {
        redirectVerify(req, res, { email, error: 'Failed to log in after verification' });
        return;
      }

      forwardCookies(signinRes, res);
    } else {
      // For existing unverified users logging in, just mark them as verified
      await db.update(user).set({ emailVerified: true }).where(eq(user.email, email));
    }

    // Delete verification token
    await db.delete(verification).where(eq(verification.identifier, email));

    // Clear temporary session data
    delete req.session.tempUser;
    delete req.session.verificationStep;

    return res.redirect('/history');
  } catch {
    redirectVerify(req, res, { email: email ?? '', error: 'An unexpected error occurred' });
  }
};

// POST /auth/verify-email/resend
export const resendVerificationPostController: RequestHandler = async (req, res) => {
  const { email } = req.body as { email?: string };

  if (!email) {
    return res.redirect('/auth/login');
  }

  try {
    await issueVerificationCode(email);
    redirectVerify(req, res, { email, success: 'A new verification code has been sent' });
  } catch {
    redirectVerify(req, res, { email, error: 'Failed to resend code' });
  }
};

/**
 * GET /auth/:provider (direct navigation helper for social login)
 */
export const socialAuthRedirectController =
  (provider: 'github' | 'google'): RequestHandler =>
  async (_req, res) => {
    const isConfigured = configuredOAuthProviders()[provider];

    if (!isConfigured) {
      const providerName = provider === 'github' ? 'GitHub' : 'Google';
      return res.redirect(
        `/auth/login?error=${encodeURIComponent(`${providerName} authentication is not configured. Please set credentials in .env.`)}`,
      );
    }

    try {
      const response = await fetch(`${authBaseUrl()}/api/auth/sign-in/social`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: authBaseUrl(),
        },
        body: JSON.stringify({
          provider,
          callbackURL: '/',
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as { url?: string };
        if (data.url) {
          return res.redirect(data.url);
        }
      }

      return res.redirect(
        `/auth/login?error=${encodeURIComponent(`Failed to initialize ${provider} login`)}`,
      );
    } catch {
      return res.redirect(
        `/auth/login?error=${encodeURIComponent(`Failed to connect to ${provider} authentication`)}`,
      );
    }
  };
