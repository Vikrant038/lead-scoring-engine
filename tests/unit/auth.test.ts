/**
 * Unit tests for Phase 1 auth modules:
 *  - migrate / seedDemoUser
 *  - auth controllers (loginPageController, registerPageController)
 *
 * Uses an in-memory SQLite database to keep tests fast and isolated.
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

// ─── Imports (after the mock is set up) ──────────────────────────────────────

import { migrate, seedDemoUser } from '../../src/db/migrate';
import {
  loginPageController,
  registerPageController,
} from '../../src/web/controllers/auth.controller';

// ─── Helper factories ─────────────────────────────────────────────────────────

function makeReq(
  overrides: Partial<{
    session: Record<string, unknown>;
    body: Record<string, unknown>;
    locals: Record<string, unknown>;
    user: Record<string, unknown> | null;
  }>,
): Request {
  return {
    session: {},
    body: {},
    params: {},
    query: {},
    user: null,
    ...overrides,
  } as unknown as Request;
}

interface MockResState {
  rendered: { view: string; data: Record<string, unknown> } | null;
  redirected: string | null;
  status?: number;
}

function makeRes(localsOverride?: Record<string, unknown>): { res: Response; state: MockResState } {
  const state: MockResState = { rendered: null, redirected: null };
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

// ─── auth.controller.ts ───────────────────────────────────────────────────────

describe('loginPageController', () => {
  it('renders login page for unauthenticated user', () => {
    const req = makeReq({ user: null });
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
});

describe('registerPageController', () => {
  it('renders register page for unauthenticated user', () => {
    const req = makeReq({ user: null });
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

describe('auth controller defensive branches', () => {
  it('handles missing cspNonce in login page and register page', () => {
    const resNoNonce = { csrfToken: 'csrf-tok', cspNonce: undefined };

    // 1. login page
    {
      const req = makeReq({ user: null });
      const { res, state } = makeRes(resNoNonce);
      loginPageController(req, res, jest.fn());
      expect(state.rendered?.data.cspNonce).toBe('');
    }
    // 2. register page
    {
      const req = makeReq({ user: null });
      const { res, state } = makeRes(resNoNonce);
      registerPageController(req, res, jest.fn());
      expect(state.rendered?.data.cspNonce).toBe('');
    }
  });
});
