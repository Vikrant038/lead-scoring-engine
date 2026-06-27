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
  return {
    __esModule: true,
    sqlite: memDb,
    db: drizzle(memDb),
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

import { migrate, seedDemoUser, wipeStaleDemoUser, seedDemoUserViaApi } from '../../src/db/migrate';
import {
  loginPageController,
  loginPostController,
  registerPageController,
  registerPostController,
  logoutController,
} from '../../src/web/controllers/auth.controller';

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

  it('seedDemoUser() stub resolves without doing anything', async () => {
    await expect(seedDemoUser()).resolves.toBeUndefined();
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
  afterEach(() => {
    delete (global as Record<string, unknown>).fetch;
  });

  it('redirects to register with error if email missing', async () => {
    const req = makeReq({ body: { email: '' } });
    const { res, state } = makeRes();
    await registerPostController(req, res, jest.fn());
    expect(state.redirected).toContain('/auth/register?error=');
  });

  it('redirects to / on successful registration and forwards cookie', async () => {
    mockFetch(true, {}, 'better-auth.sid=xyz; Path=/; HttpOnly');
    const req = makeReq({ body: { email: 'new@b.com', password: 'pass123', name: 'Test' } });
    const { res, state } = makeRes();
    await registerPostController(req, res, jest.fn());
    expect(state.redirected).toBe('/');
    expect(state.headers['Set-Cookie']).toBeTruthy();
  });

  it('redirects to register with error on failed registration', async () => {
    mockFetch(false, { message: 'Email already in use' });
    const req = makeReq({ body: { email: 'a@b.com', password: 'pass' } });
    const { res, state } = makeRes();
    await registerPostController(req, res, jest.fn());
    expect(state.redirected).toContain('/auth/register?error=');
  });

  it('redirects to register with error if fetch throws', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('network fail'));
    const req = makeReq({ body: { email: 'a@b.com', password: 'pass' } });
    const { res, state } = makeRes();
    await registerPostController(req, res, jest.fn());
    expect(state.redirected).toContain('/auth/register?error=');
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
