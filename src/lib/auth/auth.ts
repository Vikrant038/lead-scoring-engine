/**
 * Better Auth instance configuration (Phase 1).
 * Supports Email/Password, Email Verification, Password Reset, and dynamic OAuth.
 *
 * IMPORTANT: Social providers are only registered when both CLIENT_ID and
 * CLIENT_SECRET env vars are present — passing empty strings causes Better Auth
 * to throw at startup. `enabled` is NOT a valid Better Auth field; omit it.
 *
 * trustedOrigins must include the app's own base URL so that server-side fetch()
 * calls from auth.controller.ts (which include an Origin header) are accepted.
 */
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '../../db/connection';
import * as schema from '../../db/schema';
import { sendEmail } from '../email/fake-mailer';

const baseURL = process.env.BETTER_AUTH_URL || 'http://localhost:3000';

// Build social providers object only when credentials are actually set
const socialProviders: Parameters<typeof betterAuth>[0]['socialProviders'] = {};
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  };
}
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  socialProviders.github = {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
  };
}

export const auth = betterAuth({
  secret:
    process.env.BETTER_AUTH_SECRET ||
    'local_dev_fallback_secret_must_be_replaced_in_production_environment_12345',
  baseURL,
  // Allow both the public URL and localhost so server-side fetch() from
  // auth.controller.ts (which adds Origin: baseURL) passes the origin check.
  trustedOrigins: [baseURL, 'http://localhost:3000', 'http://127.0.0.1:3000'],
  database: drizzleAdapter(db, { provider: 'sqlite', schema }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // demo-friendly: skip verification gate
    sendResetPassword: async ({ user, url }) => {
      sendEmail({
        to: user.email,
        subject: 'Reset your password',
        body: `Click here: ${url}`,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: false, // disabled so new registrations don't get blocked
    sendVerificationEmail: async ({ user, url }) => {
      sendEmail({
        to: user.email,
        subject: 'Verify your email',
        body: `Click here: ${url}`,
      });
    },
  },
  socialProviders,
  session: {
    expiresIn: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 1 day
  },
});
