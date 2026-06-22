/**
 * Security headers via helmet (GUARDRAILS 2.8). Uses a strict same-origin CSP; styles/scripts
 * are served locally (built Tailwind CSS + /js), so no third-party CDN is whitelisted.
 */
import helmet from 'helmet';
import type { RequestHandler } from 'express';

export const securityHeaders: RequestHandler = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind utility classes / minimal inline styles
      imgSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
    },
  },
});
