/**
 * Fake mailer for Better Auth email verification and password reset (Phase 3).
 * Logs simulated email payloads to pino logger to keep demo zero-cost.
 */
import { createLogger } from '../logger/logger';

const mailLogger = createLogger();

export function sendEmail({
  to,
  subject,
  body,
}: {
  to: string;
  subject: string;
  body: string;
}): void {
  mailLogger.info(`[FAKE EMAIL] To: ${to}, Subject: ${subject}, Body: ${body}`);
}
