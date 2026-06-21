/**
 * CSRF synchronizer-token primitives (GUARDRAILS 2.5, CODING 4.1.1).
 * Express middleware that consumes these is wired up with the web layer (Unit 10); keeping the
 * token logic framework-free here makes it unit-testable in isolation.
 */
import crypto from 'node:crypto';

/** Cryptographically random 32-byte token (hex-encoded). */
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Constant-time comparison of the session token against the request-supplied token.
 * Returns false if either is missing or lengths differ (avoids timing leaks).
 */
export function verifyCsrfToken(sessionToken?: string, requestToken?: string): boolean {
  if (!sessionToken || !requestToken) {
    return false;
  }

  const sessionBuffer = Buffer.from(sessionToken);
  const requestBuffer = Buffer.from(requestToken);

  if (sessionBuffer.length !== requestBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(sessionBuffer, requestBuffer);
}
