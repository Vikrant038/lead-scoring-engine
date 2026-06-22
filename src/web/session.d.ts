/**
 * Type augmentation for session data (CSRF token, persona, email settings) and the
 * request-scoped correlation id.
 */
import 'express-session';
import type { EmailSettings } from '../domain/result.types';

declare module 'express-session' {
  interface SessionData {
    csrfToken?: string;
    selectedPersona?: string;
    emailSettings?: EmailSettings;
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}
