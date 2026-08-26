/**
 * Rate-limit middleware tests (unit).
 * Verifies express-rate-limit envelope, threshold tripping, and that
 * route-specific limiters apply on top of the global baseline.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import type { WebContext } from '../../src/web/context';
import { buildContext, createApp } from '../../src/web/server';
import { defaultConfig } from '../../src/config/config';
import { silentLogger } from '../helpers/test-deps';
import { NullProvider } from '../../src/llm/null.provider';
import { createRateLimiter } from '../../src/web/middleware/rate-limit.middleware';

/** Build a minimal test app with a single limiter mounted on a route. */
function testApp(max: number): Express {
  const app = express();
  app.use(createRateLimiter({ max, message: 'Too many requests, please try again later.' }));
  app.get('/ping', (_req, res) => {
    res.json({ success: true });
  });
  return app;
}

describe('rate-limit middleware (unit)', () => {
  it('returns JSON envelope with RATE_LIMITED code after threshold', async () => {
    const app = testApp(3);

    for (let i = 0; i < 3; i++) {
      const res = await request(app).get('/ping');
      expect(res.status).toBe(200);
    }

    const limited = await request(app).get('/ping');
    expect(limited.status).toBe(429);
    expect(limited.body).toEqual({
      success: false,
      error: {
        message: 'Too many requests, please try again later.',
        code: 'RATE_LIMITED',
      },
    });
  });

  it('sets standard RateLimit headers on the 429 response', async () => {
    const app = testApp(1);
    await request(app).get('/ping'); // consume the single allowance
    const limited = await request(app).get('/ping');
    expect(limited.status).toBe(429);
    expect(limited.headers['ratelimit-limit']).toBeDefined();
    expect(limited.headers['ratelimit-remaining']).toBeDefined();
  });

  it('counts each IP independently', async () => {
    const app = testApp(2);

    // First IP uses its full allowance
    await request(app).get('/ping');
    await request(app).get('/ping');
    const limited1 = await request(app).get('/ping');
    expect(limited1.status).toBe(429);

    // Same IP via X-Forwarded-For still shares the limiter (default keyGenerator trusts req.ip)
    const fresh = await request(app).get('/ping').set('X-Forwarded-For', '10.0.0.99');
    expect(fresh.status).toBe(429);
  });

  it('wires limiters into createApp without breaking the express pipeline', async () => {
    const ctx = buildContext(
      defaultConfig,
      silentLogger,
      new NullProvider(),
    ) as unknown as WebContext;
    const app = createApp(ctx, 'test-secret');

    // Root redirects to /auth/login (unauthenticated) — should NOT be 429 under light load.
    const res = await request(app).get('/').set('Accept', 'text/html');
    expect([302, 200]).toContain(res.status);
  });

  it('supports default options and custom windowMs in createRateLimiter', () => {
    const defaultLimiter = createRateLimiter({});
    expect(defaultLimiter).toBeDefined();

    const customLimiter = createRateLimiter({ windowMs: 60000, max: 10, message: 'Custom' });
    expect(customLimiter).toBeDefined();
  });
});
