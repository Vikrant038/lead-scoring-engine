/**
 * Unit tests for Phase 1 auth modules:
 *  - migrate / seedDemoUser
 *  - auth controllers (loginPageController, registerPageController,
 *    loginPostController, registerPostController, logoutController)
 *
 * Uses an in-memory SQLite database to keep tests fast and isolated.
 * global.fetch is mocked to intercept Better Auth REST calls.
 */
import Database from 'better-sqlite3';
import type { Request, Response } from 'express';

// ─── Shared in-memory DB ─────────────────────────────────────────────────────

const memDb = new Database(':memory:');

jest.mock('../../src/db/connection', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require('drizzle-orm/better-sqlite3');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const schema = require('../../src/db/schema');
  return {
    __esModule: true,
    sqlite: memDb,
    db: drizzle(memDb, { schema }),
  };
});

// Mock Better Auth auth instance (used only in logoutController for getSession)
jest.mock('../../src/lib/auth/auth', () => ({
  auth: {
    api: {
      getSession: jest.fn().mockResolvedValue(null),
    },
  },
}));

// ─── Imports (after the mock is set up) ──────────────────────────────────────

import { migrate, wipeStaleDemoUser, seedDemoUserViaApi } from '../../src/db/migrate';
import {
  loginPageController,
  loginPostController,
  registerPageController,
  registerPostController,
  logoutController,
  verifyEmailPageController,
  verifyEmailPostController,
  resendVerificationPostController,
  socialAuthRedirectController,
} from '../../src/web/controllers/auth.controller';
import { requireAuth } from '../../src/web/middleware/auth.middleware';
import { db } from '../../src/db/connection';
import { user, verification } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '../../src/lib/auth/auth';

// ─── Helper factories ─────────────────────────────────────────────────────────

function makeReq(
  overrides: Partial<{
    session: Record<string, unknown>;
    body: Record<string, unknown>;
    locals: Record<string, unknown>;
    user: Record<string, unknown> | null;
    headers: Record<string, string>;
    query: Record<string, string>;
  }>,
): Request {
  return {
    session: { destroy: jest.fn((cb: () => void) => cb()) },
    body: {},
    params: {},
    query: {},
    headers: {},
    user: null,
    ...overrides,
  } as unknown as Request;
}

interface MockResState {
  rendered: { view: string; data: Record<string, unknown> } | null;
  redirected: string | null;
  status?: number;
  headers: Record<string, string | string[]>;
}

function makeRes(localsOverride?: Record<string, unknown>): { res: Response; state: MockResState } {
  const state: MockResState = { rendered: null, redirected: null, headers: {} };
  const res = {
    locals: { csrfToken: 'csrf-tok', cspNonce: 'nonce', ...localsOverride },
    render(view: string, data: Record<string, unknown>) {
      state.rendered = { view, data };
    },
    redirect(url: string) {
      state.redirected = url;
    },
    status(code: number) {
      state.status = code;
      return this;
    },
    setHeader(name: string, value: string | string[]) {
      state.headers[name] = value;
    },
  } as unknown as Response;
  return { res, state };
}

// ─── Mock fetch ───────────────────────────────────────────────────────────────

function mockFetch(ok: boolean, body: Record<string, unknown> = {}, setCookie?: string) {
  global.fetch = jest.fn().mockResolvedValueOnce({
    ok,
    json: async () => body,
    headers: { get: (h: string) => (h === 'set-cookie' ? (setCookie ?? null) : null) },
  } as unknown as globalThis.Response);
}

// ─── db/migrate ──────────────────────────────────────────────────────────────

describe('db/migrate', () => {
  afterEach(() => {
    delete (global as Record<string, unknown>).fetch;
  });

  it('migrate() is idempotent — safe to call multiple times', () => {
    expect(() => migrate()).not.toThrow();
    expect(() => migrate()).not.toThrow();
  });

  it('wipeStaleDemoUser() removes demo user with wrong providerId', () => {
    // Insert a demo user with the old wrong provider
    migrate();
    memDb
      .prepare(
        `INSERT OR IGNORE INTO user (id,name,email,emailVerified,createdAt,updatedAt)
      VALUES ('u-stale','Demo','demo@example.com',1,0,0)`,
      )
      .run();
    memDb
      .prepare(
        `INSERT OR IGNORE INTO account (id,accountId,providerId,userId,createdAt,updatedAt)
      VALUES ('a-stale','demo@example.com','email','u-stale',0,0)`,
      )
      .run();

    wipeStaleDemoUser();

    const row = memDb.prepare("SELECT id FROM user WHERE email='demo@example.com'").get();
    expect(row).toBeUndefined();
  });

  it('wipeStaleDemoUser() keeps demo user when providerId is credential', () => {
    migrate();
    memDb
      .prepare(
        `INSERT OR IGNORE INTO user (id,name,email,emailVerified,createdAt,updatedAt)
      VALUES ('u-ok','Demo','demo@example.com',1,0,0)`,
      )
      .run();
    memDb
      .prepare(
        `INSERT OR IGNORE INTO account (id,accountId,providerId,userId,createdAt,updatedAt)
      VALUES ('a-ok','u-ok','credential','u-ok',0,0)`,
      )
      .run();

    wipeStaleDemoUser();

    const row = memDb.prepare("SELECT id FROM user WHERE email='demo@example.com'").get();
    expect(row).toBeDefined();

    // Cleanup
    memDb.prepare("DELETE FROM account WHERE userId='u-ok'").run();
    memDb.prepare("DELETE FROM user WHERE id='u-ok'").run();
  });

  it('seedDemoUserViaApi() skips if demo user already exists', async () => {
    migrate();
    memDb
      .prepare(
        `INSERT OR IGNORE INTO user (id,name,email,emailVerified,createdAt,updatedAt)
      VALUES ('u-exists','Demo','demo@example.com',1,0,0)`,
      )
      .run();

    // fetch should NOT be called because user exists
    global.fetch = jest.fn();
    await seedDemoUserViaApi(3000);
    expect(global.fetch).not.toHaveBeenCalled();

    // Cleanup
    memDb.prepare("DELETE FROM user WHERE id='u-exists'").run();
  });

  it('seedDemoUserViaApi() calls sign-up endpoint when no demo user', async () => {
    migrate();
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, status: 200 });
    await seedDemoUserViaApi(3001);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/auth/sign-up/email',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('seedDemoUserViaApi() throws on unexpected non-422 error', async () => {
    migrate();
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Server error' }),
    });
    await expect(seedDemoUserViaApi(3002)).rejects.toThrow();
  });
});

// ─── loginPageController ─────────────────────────────────────────────────────

describe('loginPageController', () => {
  it('renders login page for unauthenticated user', () => {
    const req = makeReq({ user: null, query: {} });
    const { res, state } = makeRes();
    loginPageController(req, res, jest.fn());
    expect(state.rendered?.view).toBe('login');
    expect(state.rendered?.data.error).toBeNull();
  });

  it('redirects to /history when already logged in', () => {
    const req = makeReq({ user: { id: 'u1' } });
    const { res, state } = makeRes();
    loginPageController(req, res, jest.fn());
    expect(state.redirected).toBe('/history');
  });

  it('passes query error message to view', () => {
    const req = makeReq({ user: null, query: { error: 'Invalid credentials' } });
    const { res, state } = makeRes();
    loginPageController(req, res, jest.fn());
    expect(state.rendered?.data.error).toBe('Invalid credentials');
  });
});

// ─── registerPageController ──────────────────────────────────────────────────

describe('registerPageController', () => {
  it('renders register page for unauthenticated user', () => {
    const req = makeReq({ user: null, query: {} });
    const { res, state } = makeRes();
    registerPageController(req, res, jest.fn());
    expect(state.rendered?.view).toBe('register');
  });

  it('redirects to /history when already logged in', () => {
    const req = makeReq({ user: { id: 'u1' } });
    const { res, state } = makeRes();
    registerPageController(req, res, jest.fn());
    expect(state.redirected).toBe('/history');
  });
});

// ─── loginPostController ─────────────────────────────────────────────────────

describe('loginPostController', () => {
  afterEach(() => {
    delete (global as Record<string, unknown>).fetch;
  });

  it('redirects to login with error if email missing', async () => {
    const req = makeReq({ body: { email: '' } });
    const { res, state } = makeRes();
    await loginPostController(req, res, jest.fn());
    expect(state.redirected).toContain('/auth/login?error=');
  });

  it('redirects to / on successful sign-in and forwards cookie', async () => {
    mockFetch(true, {}, 'better-auth.sid=abc; Path=/; HttpOnly');
    const req = makeReq({ body: { email: 'a@b.com', password: 'pass' } });
    const { res, state } = makeRes();
    await loginPostController(req, res, jest.fn());
    expect(state.redirected).toBe('/');
    expect(state.headers['Set-Cookie']).toBeTruthy();
  });

  it('redirects to /auth/verify-email on successful login if user is unverified', async () => {
    migrate();
    await db.insert(user).values({
      id: 'u-unverified',
      name: 'Unverified',
      email: 'unverified@b.com',
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockFetch(true, {}, 'better-auth.sid=abc; Path=/; HttpOnly');
    const req = makeReq({ body: { email: 'unverified@b.com', password: 'pass' } });
    const { res, state } = makeRes();
    await loginPostController(req, res, jest.fn());
    expect(state.redirected).toBe('/auth/verify-email?email=unverified%40b.com');
    expect(state.headers['Set-Cookie']).toBeTruthy();
  });

  it('redirects to returnTo URL in session', async () => {
    mockFetch(true, {});
    const req = makeReq({
      body: { email: 'a@b.com', password: 'pass' },
      session: { returnTo: '/history', destroy: jest.fn((cb: () => void) => cb()) },
    });
    const { res, state } = makeRes();
    await loginPostController(req, res, jest.fn());
    expect(state.redirected).toBe('/history');
  });

  it('redirects to login with server error message on failed sign-in', async () => {
    mockFetch(false, { message: 'Invalid email or password' });
    const req = makeReq({ body: { email: 'bad@b.com', password: 'wrong' } });
    const { res, state } = makeRes();
    await loginPostController(req, res, jest.fn());
    expect(state.redirected).toContain('/auth/login?error=');
    expect(state.redirected).toContain('Invalid');
  });

  it('redirects to login with generic error if fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('network fail'));
    const req = makeReq({ body: { email: 'a@b.com', password: 'pass' } });
    const { res, state } = makeRes();
    await loginPostController(req, res, jest.fn());
    expect(state.redirected).toContain('/auth/login?error=');
  });
});

// ─── registerPostController ───────────────────────────────────────────────────

describe('registerPostController', () => {
  beforeEach(() => {
    migrate();
  });

  it('redirects to register with error if email missing', async () => {
    const req = makeReq({ body: { email: '' } });
    const { res, state } = makeRes();
    await registerPostController(req, res, jest.fn());
    expect(state.redirected).toContain('/auth/register?error=');
  });

  it('redirects to /auth/verify-email and stores tempUser in session on success', async () => {
    const req = makeReq({
      body: { email: 'new@b.com', password: 'pass123', name: 'Test' },
      session: {},
    });
    const { res, state } = makeRes();
    await registerPostController(req, res, jest.fn());
    expect(state.redirected).toBe('/auth/verify-email?email=new%40b.com');
    expect(req.session.tempUser).toEqual({
      email: 'new@b.com',
      password: 'pass123',
      name: 'Test',
    });
    expect(req.session.verificationStep).toBe('initiated');
  });

  it('redirects to register with error if email already registered', async () => {
    await db.insert(user).values({
      id: 'existing-id',
      name: 'Existing User',
      email: 'existing@b.com',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const req = makeReq({ body: { email: 'existing@b.com', password: 'pass' } });
    const { res, state } = makeRes();
    await registerPostController(req, res, jest.fn());
    expect(state.redirected).toContain('/auth/register?error=Email+already+registered');
  });

  it('redirects to register with generic error if database throws', async () => {
    const spy = jest.spyOn(db, 'select').mockImplementationOnce(() => {
      throw new Error('db fail');
    });
    const req = makeReq({ body: { email: 'a@b.com', password: 'pass' } });
    const { res, state } = makeRes();
    await registerPostController(req, res, jest.fn());
    expect(state.redirected).toContain('/auth/register?error=An+unexpected+error+occurred');
    spy.mockRestore();
  });
});

// ─── logoutController ─────────────────────────────────────────────────────────

describe('logoutController', () => {
  afterEach(() => {
    delete (global as Record<string, unknown>).fetch;
  });

  it('destroys session and redirects to /auth/login', async () => {
    mockFetch(true, {});
    const destroyFn = jest.fn((cb: () => void) => cb());
    const req = makeReq({ session: { destroy: destroyFn } });
    const { res, state } = makeRes();
    await logoutController(req, res, jest.fn());
    expect(destroyFn).toHaveBeenCalled();
    expect(state.redirected).toBe('/auth/login');
  });
});

// ─── auth controller defensive branches ─────────────────────────────────────

describe('auth controller defensive branches', () => {
  it('handles missing cspNonce in login and register pages', () => {
    const resNoNonce = { csrfToken: 'csrf-tok', cspNonce: undefined };

    {
      const req = makeReq({ user: null, query: {} });
      const { res, state } = makeRes(resNoNonce);
      loginPageController(req, res, jest.fn());
      expect(state.rendered?.data.cspNonce).toBe('');
    }
    {
      const req = makeReq({ user: null, query: {} });
      const { res, state } = makeRes(resNoNonce);
      registerPageController(req, res, jest.fn());
      expect(state.rendered?.data.cspNonce).toBe('');
    }
  });
});

describe('requireAuth middleware', () => {
  it('redirects to /auth/login if no session exists', async () => {
    (auth.api.getSession as jest.Mock).mockResolvedValueOnce(null);
    const req = makeReq({ headers: {} });
    const { res, state } = makeRes();
    const next = jest.fn();

    await requireAuth(req, res, next);
    expect(state.redirected).toBe('/auth/login');
    expect(next).not.toHaveBeenCalled();
  });

  it('redirects to /auth/verify-email if user is not verified', async () => {
    (auth.api.getSession as jest.Mock).mockResolvedValueOnce({
      user: { email: 'unverified@b.com', emailVerified: false },
    });
    const req = makeReq({ headers: {} });
    const { res, state } = makeRes();
    const next = jest.fn();

    await requireAuth(req, res, next);
    expect(state.redirected).toBe('/auth/verify-email?email=unverified%40b.com');
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next if session exists and user is verified', async () => {
    (auth.api.getSession as jest.Mock).mockResolvedValueOnce({
      user: { email: 'verified@b.com', emailVerified: true },
    });
    const req = makeReq({ headers: {} });
    const { res, state } = makeRes();
    const next = jest.fn();

    await requireAuth(req, res, next);
    expect(state.redirected).toBeNull();
    expect(next).toHaveBeenCalled();
  });
});

describe('verify-email controllers', () => {
  describe('verifyEmailPageController', () => {
    beforeEach(() => {
      migrate();
    });

    it('redirects to /auth/login if email query parameter is missing', async () => {
      const req = makeReq({ query: {} });
      const { res, state } = makeRes();
      await verifyEmailPageController(req, res, jest.fn());
      expect(state.redirected).toBe('/auth/login');
    });

    it('renders verify-email view and transitions state from initiated to loaded', async () => {
      const req = makeReq({
        query: { email: 'test@b.com' },
        session: { verificationStep: 'initiated' },
      });
      const { res, state } = makeRes();
      await verifyEmailPageController(req, res, jest.fn());
      expect(state.rendered?.view).toBe('verify-email');
      expect(state.rendered?.data.email).toBe('test@b.com');
      expect(req.session.verificationStep).toBe('loaded');
    });

    it('cancels verification and redirects to register if page refresh detected', async () => {
      await db.insert(verification).values({
        id: 'v-temp',
        identifier: 'test@b.com',
        value: '123456',
        expiresAt: new Date(Date.now() + 60000),
      });

      const req = makeReq({
        query: { email: 'test@b.com' },
        session: {
          verificationStep: 'loaded',
          tempUser: { email: 'test@b.com', password: 'pwd' },
        },
      });
      const { res, state } = makeRes();
      await verifyEmailPageController(req, res, jest.fn());

      expect(state.redirected).toBe(
        '/auth/register?error=Verification+cancelled+due+to+page+refresh',
      );
      expect(req.session.tempUser).toBeUndefined();
      expect(req.session.verificationStep).toBeUndefined();

      // Ensure token was deleted
      const [tok] = await db
        .select()
        .from(verification)
        .where(eq(verification.id, 'v-temp'))
        .limit(1);
      expect(tok).toBeUndefined();
    });
  });

  describe('verifyEmailPostController', () => {
    beforeEach(async () => {
      migrate();
      await db.delete(verification);
      await db.delete(user);
    });

    afterEach(() => {
      delete (global as Record<string, unknown>).fetch;
    });

    it('redirects with error if email or code missing', async () => {
      const req = makeReq({ body: { email: 'test@b.com', code: '' } });
      const { res, state } = makeRes();
      await verifyEmailPostController(req, res, jest.fn());
      expect(state.redirected).toContain('error=Code+is+required');
    });

    it('redirects with error if verification code invalid', async () => {
      const req = makeReq({ body: { email: 'test@b.com', code: '123456' } });
      const { res, state } = makeRes();
      await verifyEmailPostController(req, res, jest.fn());
      expect(state.redirected).toContain('error=Invalid+verification+code');
    });

    it('redirects with error if verification code expired', async () => {
      // Insert an expired token using Drizzle
      await db.insert(verification).values({
        id: 'v-exp',
        identifier: 'test@b.com',
        value: '123456',
        expiresAt: new Date(Date.now() - 60000), // Expired 1 minute ago
      });

      const req = makeReq({ body: { email: 'test@b.com', code: '123456' } });
      const { res, state } = makeRes();
      await verifyEmailPostController(req, res, jest.fn());
      expect(state.redirected).toContain('error=Verification+code+has+expired');
    });

    it('verifies email, deletes token, and redirects to /history on success for existing user (login flow)', async () => {
      // Insert user and valid token using Drizzle
      await db.insert(user).values({
        id: 'u-test',
        name: 'Test',
        email: 'test@b.com',
        emailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await db.insert(verification).values({
        id: 'v-val',
        identifier: 'test@b.com',
        value: '123456',
        expiresAt: new Date(Date.now() + 60000), // Valid for 1 minute
      });

      const req = makeReq({ body: { email: 'test@b.com', code: '123456' } });
      const { res, state } = makeRes();
      await verifyEmailPostController(req, res, jest.fn());
      expect(state.redirected).toBe('/history');

      // Check user is verified
      const [userRow] = await db.select().from(user).where(eq(user.id, 'u-test')).limit(1);
      expect(userRow.emailVerified).toBe(true);

      // Check token is deleted
      const [tokRow] = await db
        .select()
        .from(verification)
        .where(eq(verification.id, 'v-val'))
        .limit(1);
      expect(tokRow).toBeUndefined();
    });

    it('creates user in Better Auth, signs in, and redirects to /history on success for new registration (deferred signup)', async () => {
      // Insert valid token using Drizzle
      await db.insert(verification).values({
        id: 'v-val',
        identifier: 'new@b.com',
        value: '123456',
        expiresAt: new Date(Date.now() + 60000), // Valid for 1 minute
      });

      // Mock signup API response, then Drizzle insert, then signin API response
      let fetchCallCount = 0;
      global.fetch = jest.fn().mockImplementation(async (url) => {
        fetchCallCount++;
        if (url.includes('/api/auth/sign-up/email')) {
          // Simulate Better Auth creating the user in the database
          await db.insert(user).values({
            id: 'u-new',
            name: 'New User',
            email: 'new@b.com',
            emailVerified: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          return { ok: true, json: async () => ({}) } as Response;
        }
        if (url.includes('/api/auth/sign-in/email')) {
          return {
            ok: true,
            headers: {
              get: () => 'better-auth.sid=cookie-value; Path=/; HttpOnly',
            },
            json: async () => ({}),
          } as unknown as Response;
        }
        return { ok: false } as Response;
      });

      const req = makeReq({
        body: { email: 'new@b.com', code: '123456' },
        session: {
          tempUser: { email: 'new@b.com', password: 'password123', name: 'New User' },
        },
      });
      const { res, state } = makeRes();
      await verifyEmailPostController(req, res, jest.fn());

      expect(state.redirected).toBe('/history');
      expect(fetchCallCount).toBe(2);

      // Check user is now in database and is verified
      const [userRow] = await db.select().from(user).where(eq(user.id, 'u-new')).limit(1);
      expect(userRow).toBeDefined();
      expect(userRow.emailVerified).toBe(true);

      // Check token is deleted
      const [tokRow] = await db
        .select()
        .from(verification)
        .where(eq(verification.identifier, 'new@b.com'))
        .limit(1);
      expect(tokRow).toBeUndefined();

      // Check cookies were forwarded
      expect(state.headers['Set-Cookie']).toBe('better-auth.sid=cookie-value; Path=/; HttpOnly');
    });

    it('redirects with error if Better Auth signup fails', async () => {
      await db.insert(verification).values({
        id: 'v-val',
        identifier: 'new@b.com',
        value: '123456',
        expiresAt: new Date(Date.now() + 60000),
      });

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Password too weak' }),
      } as Response);

      const req = makeReq({
        body: { email: 'new@b.com', code: '123456' },
        session: {
          tempUser: { email: 'new@b.com', password: 'weak', name: 'New User' },
        },
      });
      const { res, state } = makeRes();
      await verifyEmailPostController(req, res, jest.fn());

      // URLSearchParams encodes spaces as '+' (same form the hand-written redirects used).
      expect(state.redirected).toContain('error=Password+too+weak');
    });

    it('redirects with error if Better Auth signin fails', async () => {
      await db.insert(verification).values({
        id: 'v-val',
        identifier: 'new@b.com',
        value: '123456',
        expiresAt: new Date(Date.now() + 60000),
      });

      global.fetch = jest.fn().mockImplementation(async (url) => {
        if (url.includes('/api/auth/sign-up/email')) {
          return { ok: true, json: async () => ({}) } as Response;
        }
        if (url.includes('/api/auth/sign-in/email')) {
          return { ok: false, status: 401 } as Response;
        }
        return { ok: false } as Response;
      });

      const req = makeReq({
        body: { email: 'new@b.com', code: '123456' },
        session: {
          tempUser: { email: 'new@b.com', password: 'pwd', name: 'New User' },
        },
      });
      const { res, state } = makeRes();
      await verifyEmailPostController(req, res, jest.fn());

      expect(state.redirected).toContain('error=Failed+to+log+in+after+verification');
    });

    it('redirects with unexpected error on database throw', async () => {
      const spy = jest.spyOn(db, 'select').mockImplementationOnce(() => {
        throw new Error('db fail');
      });
      const req = makeReq({ body: { email: 'test@b.com', code: '123456' } });
      const { res, state } = makeRes();
      await verifyEmailPostController(req, res, jest.fn());
      expect(state.redirected).toContain('error=An+unexpected+error+occurred');
      spy.mockRestore();
    });
  });

  describe('resendVerificationPostController', () => {
    beforeEach(async () => {
      migrate();
      await db.delete(verification);
      await db.delete(user);
    });

    it('redirects to /auth/login if email missing', async () => {
      const req = makeReq({ body: {} });
      const { res, state } = makeRes();
      await resendVerificationPostController(req, res, jest.fn());
      expect(state.redirected).toBe('/auth/login');
    });

    it('generates new token and redirects to /auth/verify-email on success', async () => {
      const req = makeReq({ body: { email: 'resend@b.com' } });
      const { res, state } = makeRes();
      await resendVerificationPostController(req, res, jest.fn());
      expect(state.redirected).toContain('/auth/verify-email?email=resend%40b.com');
      expect(state.redirected).toContain('success=');

      // Check token exists in DB
      const row = memDb
        .prepare("SELECT value FROM verification WHERE identifier='resend@b.com'")
        .get() as { value: string };
      expect(row).toBeDefined();
      expect(row.value).toHaveLength(6);
    });

    it('redirects with error if database insert throws on resend', async () => {
      const spy = jest.spyOn(db, 'insert').mockImplementationOnce(() => {
        throw new Error('db fail');
      });
      const req = makeReq({ body: { email: 'resend@b.com' } });
      const { res, state } = makeRes();
      await resendVerificationPostController(req, res, jest.fn());
      expect(state.redirected).toContain('error=Failed+to+resend+code');
      spy.mockRestore();
    });
  });

  describe('socialAuthRedirectController', () => {
    const origEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...origEnv };
    });

    it('redirects with error if provider credentials not configured', async () => {
      delete process.env.GITHUB_CLIENT_ID;
      delete process.env.GITHUB_CLIENT_SECRET;
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;

      const req = makeReq({});
      const { res: resGh, state: stateGh } = makeRes();
      await socialAuthRedirectController('github')(req, resGh, jest.fn());
      expect(decodeURIComponent(stateGh.redirected ?? '')).toContain(
        'error=GitHub authentication is not configured',
      );

      const { res: resGg, state: stateGg } = makeRes();
      await socialAuthRedirectController('google')(req, resGg, jest.fn());
      expect(decodeURIComponent(stateGg.redirected ?? '')).toContain(
        'error=Google authentication is not configured',
      );
    });

    it('redirects to provider URL on successful Better Auth response', async () => {
      process.env.GITHUB_CLIENT_ID = 'gh-id';
      process.env.GITHUB_CLIENT_SECRET = 'gh-sec';

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://github.com/login/oauth/authorize?client_id=123' }),
      } as Response);

      const req = makeReq({});
      const { res, state } = makeRes();
      await socialAuthRedirectController('github')(req, res, jest.fn());
      expect(state.redirected).toBe('https://github.com/login/oauth/authorize?client_id=123');
    });

    it('redirects with error if Better Auth returns non-ok or missing url', async () => {
      process.env.GITHUB_CLIENT_ID = 'gh-id';
      process.env.GITHUB_CLIENT_SECRET = 'gh-sec';

      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'bad' }),
      } as Response);

      const req = makeReq({});
      const { res, state } = makeRes();
      await socialAuthRedirectController('github')(req, res, jest.fn());
      expect(decodeURIComponent(state.redirected ?? '')).toContain(
        'error=Failed to initialize github login',
      );
    });

    it('redirects with error if fetch throws an exception', async () => {
      process.env.GOOGLE_CLIENT_ID = 'gg-id';
      process.env.GOOGLE_CLIENT_SECRET = 'gg-sec';

      global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'));

      const req = makeReq({});
      const { res, state } = makeRes();
      await socialAuthRedirectController('google')(req, res, jest.fn());
      expect(decodeURIComponent(state.redirected ?? '')).toContain(
        'error=Failed to connect to google authentication',
      );
    });
  });
});
