/**
 * Unit tests for Phase 1 auth modules:
 *  - migrate / seedDemoUser
 *  - auth controllers (loginPageController, registerPageController,
 *    loginPostController, registerPostController, logoutController)
 *
 * Uses an in-memory SQLite database to keep tests fast and isolated.
 * Better Auth's API methods are mocked so no real network calls are made.
 */
import Database from 'better-sqlite3';
import type { Request, Response } from 'express';

// ─── Shared in-memory DB ─────────────────────────────────────────────────────

const memDb = new Database(':memory:');

// Replace the SQLite singleton with the in-memory DB before any modules load.
jest.mock('../../src/db/connection', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require('drizzle-orm/better-sqlite3');
  return {
    __esModule: true,
    sqlite: memDb,
    db: drizzle(memDb),
  };
});

// Mock Better Auth so POST controllers don't make real HTTP requests
jest.mock('../../src/lib/auth/auth', () => ({
  auth: {
    api: {
      getSession: jest.fn().mockResolvedValue(null),
      signInEmail: jest.fn(),
      signUpEmail: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

// ─── Imports (after the mock is set up) ──────────────────────────────────────

import { migrate, seedDemoUser } from '../../src/db/migrate';
import {
  loginPageController,
  loginPostController,
  registerPageController,
  registerPostController,
  logoutController,
} from '../../src/web/controllers/auth.controller';
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
  cookies: Record<string, string>;
}

function makeRes(localsOverride?: Record<string, unknown>): { res: Response; state: MockResState } {
  const state: MockResState = { rendered: null, redirected: null, cookies: {} };
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
    setHeader(name: string, value: string) {
      state.cookies[name] = value;
    },
  } as unknown as Response;
  return { res, state };
}

// ─── db/migrate ──────────────────────────────────────────────────────────────

describe('db/migrate', () => {
  it('migrate() is idempotent — safe to call multiple times', () => {
    expect(() => migrate()).not.toThrow();
    expect(() => migrate()).not.toThrow();
  });

  it('seedDemoUser() inserts demo@example.com and skips on second call', async () => {
    await seedDemoUser();
    const row = memDb.prepare('SELECT email FROM user WHERE email = ?').get('demo@example.com') as
      | { email: string }
      | undefined;
    expect(row?.email).toBe('demo@example.com');

    // second call must not throw (idempotent)
    await expect(seedDemoUser()).resolves.toBeUndefined();
    const count = (
      memDb.prepare("SELECT count(*) as c FROM user WHERE email = 'demo@example.com'").get() as {
        c: number;
      }
    ).c;
    expect(count).toBe(1);
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
  const mockSignIn = auth.api.signInEmail as jest.MockedFunction<typeof auth.api.signInEmail>;

  beforeEach(() => mockSignIn.mockReset());

  it('redirects to login with error if email or password missing', async () => {
    const req = makeReq({ body: { email: '' } });
    const { res, state } = makeRes();
    await loginPostController(req, res, jest.fn());
    expect(state.redirected).toContain('/auth/login?error=');
  });

  it('redirects to / on successful sign-in', async () => {
    mockSignIn.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'better-auth.sid=abc' },
    } as unknown as Response);
    const req = makeReq({ body: { email: 'a@b.com', password: 'pass' } });
    const { res, state } = makeRes();
    await loginPostController(req, res, jest.fn());
    expect(state.redirected).toBe('/');
  });

  it('redirects to returnTo URL stored in session', async () => {
    mockSignIn.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => null },
    } as unknown as Response);
    const req = makeReq({
      body: { email: 'a@b.com', password: 'pass' },
      session: { returnTo: '/history', destroy: jest.fn((cb: () => void) => cb()) },
    });
    const { res, state } = makeRes();
    await loginPostController(req, res, jest.fn());
    expect(state.redirected).toBe('/history');
  });

  it('redirects to login with error on failed sign-in', async () => {
    mockSignIn.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Invalid email or password' }),
      headers: { get: () => null },
    } as unknown as Response);
    const req = makeReq({ body: { email: 'bad@b.com', password: 'wrong' } });
    const { res, state } = makeRes();
    await loginPostController(req, res, jest.fn());
    expect(state.redirected).toContain('/auth/login?error=');
  });

  it('redirects to login with error if signInEmail throws', async () => {
    mockSignIn.mockRejectedValueOnce(new Error('network fail'));
    const req = makeReq({ body: { email: 'a@b.com', password: 'pass' } });
    const { res, state } = makeRes();
    await loginPostController(req, res, jest.fn());
    expect(state.redirected).toContain('/auth/login?error=');
  });
});

// ─── registerPostController ───────────────────────────────────────────────────

describe('registerPostController', () => {
  const mockSignUp = auth.api.signUpEmail as jest.MockedFunction<typeof auth.api.signUpEmail>;

  beforeEach(() => mockSignUp.mockReset());

  it('redirects to register with error if email or password missing', async () => {
    const req = makeReq({ body: { email: '' } });
    const { res, state } = makeRes();
    await registerPostController(req, res, jest.fn());
    expect(state.redirected).toContain('/auth/register?error=');
  });

  it('redirects to / on successful registration', async () => {
    mockSignUp.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => null },
    } as unknown as Response);
    const req = makeReq({ body: { email: 'new@b.com', password: 'pass123', name: 'Test' } });
    const { res, state } = makeRes();
    await registerPostController(req, res, jest.fn());
    expect(state.redirected).toBe('/');
  });

  it('redirects to register with error on failed registration', async () => {
    mockSignUp.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Email already in use' }),
      headers: { get: () => null },
    } as unknown as Response);
    const req = makeReq({ body: { email: 'a@b.com', password: 'pass' } });
    const { res, state } = makeRes();
    await registerPostController(req, res, jest.fn());
    expect(state.redirected).toContain('/auth/register?error=');
  });

  it('redirects to register with error if signUpEmail throws', async () => {
    mockSignUp.mockRejectedValueOnce(new Error('network fail'));
    const req = makeReq({ body: { email: 'a@b.com', password: 'pass' } });
    const { res, state } = makeRes();
    await registerPostController(req, res, jest.fn());
    expect(state.redirected).toContain('/auth/register?error=');
  });
});

// ─── logoutController ─────────────────────────────────────────────────────────

describe('logoutController', () => {
  it('destroys session and redirects to /auth/login', async () => {
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
  it('handles missing cspNonce in login page and register page', () => {
    const resNoNonce = { csrfToken: 'csrf-tok', cspNonce: undefined };

    // 1. login page
    {
      const req = makeReq({ user: null, query: {} });
      const { res, state } = makeRes(resNoNonce);
      loginPageController(req, res, jest.fn());
      expect(state.rendered?.data.cspNonce).toBe('');
    }
    // 2. register page
    {
      const req = makeReq({ user: null, query: {} });
      const { res, state } = makeRes(resNoNonce);
      registerPageController(req, res, jest.fn());
      expect(state.rendered?.data.cspNonce).toBe('');
    }
  });
});
