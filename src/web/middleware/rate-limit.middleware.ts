/**
 * Rate-limiting middleware (express-rate-limit v8).
 *
 * Applied in createApp() before the router:
 *   - globalLimiter:  100 req / 15 min / IP baseline
 *   - authLimiter:     10 req / 15 min / IP on /auth/* (brute-force protection)
 *   - uploadLimiter:   30 req / 15 min / IP on /api/upload* (abuse protection)
 *   - emailRegenerateLimiter: 20 req / 15 min / IP on /api/regenerate-email* (AI-cost control)
 *
 * Use createRateLimiter() for tests or custom thresholds.
 */
import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';

const FIFTEEN_MINUTES = 15 * 60 * 1000;

function envelope(message: string, code: string) {
  return { success: false as const, error: { message, code } };
}

export const globalLimiter: RequestHandler = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: envelope('Too many requests, please try again later.', 'RATE_LIMITED'),
});

export const authLimiter: RequestHandler = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: envelope('Too many authentication attempts, please try again later.', 'RATE_LIMITED'),
});

export const uploadLimiter: RequestHandler = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: envelope('Too many upload requests, please try again later.', 'RATE_LIMITED'),
});

export const emailRegenerateLimiter: RequestHandler = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: envelope(
    'Too many email regeneration requests, please try again later.',
    'RATE_LIMITED',
  ),
});

export function createRateLimiter(options: {
  windowMs?: number;
  max?: number;
  message?: string;
}): RequestHandler {
  return rateLimit({
    windowMs: options.windowMs ?? FIFTEEN_MINUTES,
    max: options.max ?? 5,
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    message: envelope(
      options.message ?? 'Too many requests, please try again later.',
      'RATE_LIMITED',
    ),
  });
}
