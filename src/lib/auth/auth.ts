/**
 * Better Auth instance configuration (Phase 1).
 * Supports Email/Password, Email Verification, Password Reset, and dynamic OAuth.
 */
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '../../db/connection';
import * as schema from '../../db/schema';
import { sendEmail } from '../email/fake-mailer';

export const auth = betterAuth({
  secret:
    process.env.BETTER_AUTH_SECRET ||
    'local_dev_fallback_secret_must_be_replaced_in_production_environment_12345',
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  database: drizzleAdapter(db, { provider: 'sqlite', schema }),
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      sendEmail({
        to: user.email,
        subject: 'Reset your password',
        body: `Click here: ${url}`,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      sendEmail({
        to: user.email,
        subject: 'Verify your email',
        body: `Click here: ${url}`,
      });
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      enabled: !!process.env.GOOGLE_CLIENT_ID,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET || '',
      enabled: !!process.env.GITHUB_CLIENT_ID,
    },
  },
  session: {
    expiresIn: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 1 day
  },
});
