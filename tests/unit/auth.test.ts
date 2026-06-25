/**
 * Unit tests for Phase 1 auth modules:
 *  - BcryptAuthService (register + login + hash)
 *  - migrate / seedDemoUser
 *  - auth controllers (loginPage, login, registerPage, register, logout)
 *
 * Uses an in-memory SQLite database to keep tests fast and isolated.
 * The db singleton is replaced with the in-memory DB via jest.mock.
 */
import Database from 'better-sqlite3';
import type { Request, Response, NextFunction } from 'express';

// ─── Shared in-memory DB ─────────────────────────────────────────────────────

const memDb = new Database(':memory:');
memDb.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Replace the SQLite singleton with the in-memory DB before any modules load.
jest.mock('../../src/db/connection', () => ({
  __esModule: true,
  default: memDb,
}));

// ─── Imports (after the mock is set up) ──────────────────────────────────────

import { BcryptAuthService } from '../../src/lib/auth/bcrypt-auth.service';
import { migrate, seedDemoUser } from '../../src/db/migrate';
import {
  loginPageController,
  loginController,
  registerPageController,
  registerController,
  logoutController,
} from '../../src/web/controllers/auth.controller';

// ─── Helper factories ─────────────────────────────────────────────────────────

function makeReq(
  overrides: Partial<{
    session: Record<string, unknown>;
    body: Record<string, unknown>;
    locals: Record<string, unknown>;
  }>,
): Request {
  return {
    session: {},
    body: {},
    params: {},
    query: {},
    ...overrides,
  } as unknown as Request;
}

interface MockResState {
  rendered: { view: string; data: Record<string, unknown> } | null;
  redirected: string | null;
  cookiesCleared: string[];
  status?: number;
}

function makeRes(): { res: Response; state: MockResState } {
  const state: MockResState = { rendered: null, redirected: null, cookiesCleared: [] };
  const res = {
    locals: { csrfToken: 'csrf-tok', cspNonce: 'nonce' },
    render(view: string, data: Record<string, unknown>) {
      state.rendered = { view, data };
    },
    redirect(url: string) {
      state.redirected = url;
    },
    clearCookie(name: string) {
      state.cookiesCleared.push(name);
    },
    status(code: number) {
      state.status = code;
      return this;
    },
  } as unknown as Response;
  return { res, state };
}

// ─── BcryptAuthService ────────────────────────────────────────────────────────

describe('BcryptAuthService', () => {
  // Use a unique email prefix per test to avoid UNIQUE constraint collisions.
  let emailIdx = 0;
  const uniq = () => `user${(emailIdx += 1)}@auth-test.com`;
  const svc = new BcryptAuthService();

  it('hashes a password via static hash()', async () => {
    const hash = await BcryptAuthService.hash('test-secret');
    expect(hash).toMatch(/^\$2/);
  });

  it('registers a new user and returns AuthUser', async () => {
    const email = uniq();
    const user = await svc.register(email, 'password1234');
    expect(user.email).toBe(email);
    expect(user.id).toMatch(/[0-9a-f-]{36}/);
  });

  it('normalises email to lowercase + trim on register', async () => {
    const user = await svc.register('  CapTest@Example.COM  ', 'password1234');
    expect(user.email).toBe('captest@example.com');
  });

  it('throws UNIQUE error on duplicate email', async () => {
    const email = uniq();
    await svc.register(email, 'pass1234');
    await expect(svc.register(email, 'other1234')).rejects.toThrow();
  });

  it('login returns AuthUser on correct password', async () => {
    const email = uniq();
    await svc.register(email, 'Correct!8');
    const user = await svc.login(email, 'Correct!8');
    expect(user).not.toBeNull();
    expect(user?.email).toBe(email);
  });

  it('login returns null for wrong password', async () => {
    const email = uniq();
    await svc.register(email, 'RightPass1');
    const result = await svc.login(email, 'WrongPass1');
    expect(result).toBeNull();
  });

  it('login returns null for unknown email', async () => {
    const result = await svc.login('ghost@nobody.com', 'anypass');
    expect(result).toBeNull();
  });
});

// ─── db/migrate ──────────────────────────────────────────────────────────────

describe('db/migrate', () => {
  it('migrate() is idempotent — safe to call multiple times', () => {
    expect(() => migrate()).not.toThrow();
    expect(() => migrate()).not.toThrow();
  });

  it('seedDemoUser() inserts demo@example.com and skips on second call', async () => {
    const fakHash = async (pw: string) => `hashed:${pw}`;
    await seedDemoUser(fakHash);
    const row = memDb.prepare('SELECT email FROM users WHERE email = ?').get('demo@example.com') as
      | { email: string }
      | undefined;
    expect(row?.email).toBe('demo@example.com');

    // second call must not throw (idempotent)
    await expect(seedDemoUser(fakHash)).resolves.toBeUndefined();
    const count = (
      memDb.prepare("SELECT count(*) as c FROM users WHERE email = 'demo@example.com'").get() as {
        c: number;
      }
    ).c;
    expect(count).toBe(1);
  });
});

// ─── auth.controller.ts ───────────────────────────────────────────────────────

describe('loginPageController', () => {
  it('renders login page for unauthenticated user', () => {
    const req = makeReq({ session: {} });
    const { res, state } = makeRes();
    loginPageController(req, res, jest.fn());
    expect(state.rendered?.view).toBe('login');
    expect(state.rendered?.data.error).toBeNull();
  });

  it('redirects to / when already logged in', () => {
    const req = makeReq({ session: { userId: 'u1' } });
    const { res, state } = makeRes();
    loginPageController(req, res, jest.fn());
    expect(state.redirected).toBe('/');
  });
});

describe('registerPageController', () => {
  it('renders register page for unauthenticated user', () => {
    const req = makeReq({ session: {} });
    const { res, state } = makeRes();
    registerPageController(req, res, jest.fn());
    expect(state.rendered?.view).toBe('register');
  });

  it('redirects to / when already logged in', () => {
    const req = makeReq({ session: { userId: 'u1' } });
    const { res, state } = makeRes();
    registerPageController(req, res, jest.fn());
    expect(state.redirected).toBe('/');
  });
});

describe('loginController', () => {
  const svc = new BcryptAuthService();
  let emailIdx = 0;
  const uniq = () => `login-ctrl${(emailIdx += 1)}@test.com`;

  it('renders error when email or password missing', async () => {
    const req = makeReq({ session: {}, body: { email: '', password: '' } });
    const { res, state } = makeRes();
    await loginController(req, res, jest.fn());
    expect(state.rendered?.data.error).toBe('Email and password are required.');
  });

  it('renders invalid credentials error for unknown user', async () => {
    const req = makeReq({ session: {}, body: { email: 'nobody@x.com', password: 'nope1234' } });
    const { res, state } = makeRes();
    await loginController(req, res, jest.fn());
    expect(state.rendered?.data.error).toBe('Invalid email or password.');
  });

  it('logs in a registered user and redirects to /', async () => {
    const email = uniq();
    await svc.register(email, 'password1234');
    const session: Record<string, unknown> = {};
    const req = makeReq({ session, body: { email, password: 'password1234' } });
    const { res, state } = makeRes();
    await loginController(req, res, jest.fn());
    expect(state.redirected).toBe('/');
    expect(session.userId).toBeTruthy();
    expect(session.userEmail).toBe(email);
  });

  it('honours session.returnTo on successful login', async () => {
    const email = uniq();
    await svc.register(email, 'password1234');
    const session: Record<string, unknown> = { returnTo: '/history' };
    const req = makeReq({ session, body: { email, password: 'password1234' } });
    const { res, state } = makeRes();
    await loginController(req, res, jest.fn());
    expect(state.redirected).toBe('/history');
    expect(session.returnTo).toBeUndefined();
  });
});

describe('registerController', () => {
  it('renders error when fields are missing', async () => {
    const req = makeReq({ session: {}, body: { email: 'a@b.com', password: '', confirm: '' } });
    const { res, state } = makeRes();
    await registerController(req, res, jest.fn());
    expect(state.rendered?.data.error).toBe('All fields are required.');
  });

  it('renders error when passwords do not match', async () => {
    const req = makeReq({
      session: {},
      body: { email: 'a@b.com', password: 'Pass1234', confirm: 'Diff5678' },
    });
    const { res, state } = makeRes();
    await registerController(req, res, jest.fn());
    expect(state.rendered?.data.error).toBe('Passwords do not match.');
  });

  it('renders error when password is too short', async () => {
    const req = makeReq({
      session: {},
      body: { email: 'a@b.com', password: 'short', confirm: 'short' },
    });
    const { res, state } = makeRes();
    await registerController(req, res, jest.fn());
    expect(state.rendered?.data.error).toBe('Password must be at least 8 characters.');
  });

  it('registers a new user and redirects to /', async () => {
    const session: Record<string, unknown> = {};
    const req = makeReq({
      session,
      body: { email: 'newreg@ctrl.com', password: 'password1234', confirm: 'password1234' },
    });
    const { res, state } = makeRes();
    await registerController(req, res, jest.fn());
    expect(state.redirected).toBe('/');
    expect(session.userId).toBeTruthy();
  });

  it('renders error when email already exists', async () => {
    // Ensure the user exists
    const svc = new BcryptAuthService();
    try {
      await svc.register('exists@ctrl.com', 'password1234');
    } catch {
      /* already exists */
    }

    const req = makeReq({
      session: {},
      body: { email: 'exists@ctrl.com', password: 'password1234', confirm: 'password1234' },
    });
    const { res, state } = makeRes();
    await registerController(req, res, jest.fn());
    expect(state.rendered?.data.error).toBe('An account with that email already exists.');
  });
});

describe('logoutController', () => {
  it('destroys the session and redirects to /auth/login', () => {
    const session = {
      destroy: (cb: (err: null) => void) => cb(null),
    };
    const req = makeReq({ session: session as unknown as Record<string, unknown> });
    const { res, state } = makeRes();
    const next = jest.fn() as unknown as NextFunction;
    logoutController(req, res, next);
    expect(state.redirected).toBe('/auth/login');
    expect(state.cookiesCleared).toContain('icp.sid');
  });

  it('calls next(err) when session.destroy fails', () => {
    const fakeErr = new Error('session store down');
    const session = {
      destroy: (cb: (err: Error) => void) => cb(fakeErr),
    };
    const req = makeReq({ session: session as unknown as Record<string, unknown> });
    const { res } = makeRes();
    const next = jest.fn() as unknown as NextFunction;
    logoutController(req, res, next);
    expect(next).toHaveBeenCalledWith(fakeErr);
  });
});
