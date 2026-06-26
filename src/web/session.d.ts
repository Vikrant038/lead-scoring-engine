/**
 * Type augmentation for session data (CSRF token, persona, email settings, auth) and the
 * request-scoped correlation id.
 */
import 'express-session';
import type { EmailSettings } from '../domain/result.types';

declare module 'express-session' {
  interface SessionData {
    csrfToken?: string;
    selectedPersona?: string;
    emailSettings?: EmailSettings;
    /** Authenticated user id (Phase 1 — set on login, cleared on logout). */
    userId?: string;
    /** Email of the authenticated user (for display). */
    userEmail?: string;
    /** URL to redirect to after login. */
    returnTo?: string;
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      correlationId?: string;
      user?: {
        id: string;
        name: string;
        email: string;
        emailVerified: boolean;
        image?: string | null;
        createdAt: Date;
        updatedAt: Date;
      } | null;
    }
  }
}
