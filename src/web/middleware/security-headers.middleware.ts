import crypto from 'node:crypto';
import helmet from 'helmet';
import type { RequestHandler } from 'express';

export const securityHeaders: RequestHandler = (req, res, next) => {
  const nonce = crypto.randomBytes(16).toString('base64');
  res.locals.cspNonce = nonce;

  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", `'nonce-${nonce}'`],
        styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind utility classes / minimal inline styles
        imgSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
      },
    },
  })(req, res, next);
};
