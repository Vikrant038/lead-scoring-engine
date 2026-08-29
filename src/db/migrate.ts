/**
 * Database migration & seed (Phase 1 Better Auth).
 * Creates user, session, account, and verification tables on startup.
 *
 * WHY seedDemoUser uses fetch() after listen():
 * Better Auth uses @better-auth/utils for password hashing internally.
 * Manually calling better-auth/crypto's hashPassword produces a hash in a
 * different format, causing "Invalid password hash" on verify. The only
 * guaranteed-compatible way to create the demo user is via Better Auth's
 * own /api/auth/sign-up/email REST endpoint — same path a real user takes.
 */
import { sqlite } from './connection';

export function migrate(): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS user (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      emailVerified INTEGER NOT NULL,
      image TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS session (
      id TEXT PRIMARY KEY,
      expiresAt INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      ipAddress TEXT,
      userAgent TEXT,
      userId TEXT NOT NULL REFERENCES user(id)
    );

    CREATE TABLE IF NOT EXISTS account (
      id TEXT PRIMARY KEY,
      accountId TEXT NOT NULL,
      providerId TEXT NOT NULL,
      userId TEXT NOT NULL REFERENCES user(id),
      accessToken TEXT,
      refreshToken TEXT,
      idToken TEXT,
      accessTokenExpiresAt INTEGER,
      refreshTokenExpiresAt INTEGER,
      scope TEXT,
      password TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS verification (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      expiresAt INTEGER NOT NULL,
      createdAt INTEGER,
      updatedAt INTEGER
    );
  `);
}

/**
 * Wipe any stale demo user row (wrong hash format from earlier manual seeding).
 * Called on startup BEFORE the server starts listening.
 */
export function wipeStaleDemoUser(): void {
  // Only wipe if the demo user was manually seeded (providerId = 'email' or
  // the password hash is in the wrong format). Detect by checking providerId.
  const acct = sqlite
    .prepare(
      `SELECT a.providerId FROM account a
       JOIN user u ON a.userId = u.id
       WHERE u.email = 'demo@example.com'`,
    )
    .get() as { providerId: string } | undefined;

  // If the account has providerId 'email' (old manual seed), or no account at
  // all yet, wipe so seedDemoUserViaApi() will re-create correctly.
  if (!acct || acct.providerId !== 'credential') {
    sqlite
      .prepare(
        `DELETE FROM account WHERE userId = (SELECT id FROM user WHERE email = 'demo@example.com')`,
      )
      .run();
    sqlite
      .prepare(
        `DELETE FROM session WHERE userId = (SELECT id FROM user WHERE email = 'demo@example.com')`,
      )
      .run();
    sqlite.prepare(`DELETE FROM user WHERE email = 'demo@example.com'`).run();
  }
}

/**
 * Seed the demo user via Better Auth's REST API after the server is listening.
 * This guarantees the password hash format matches what Better Auth's verifier
 * expects — no manual hashing, no format mismatches.
 *
 * Called from server.ts inside the app.listen() callback.
 */
export async function seedDemoUserViaApi(port: number): Promise<void> {
  // Ensure any existing demo user in the database file is marked as verified
  sqlite.prepare("UPDATE user SET emailVerified = 1 WHERE email = 'demo@example.com'").run();

  const existing = sqlite.prepare(`SELECT id FROM user WHERE email = 'demo@example.com'`).get();
  if (existing) return; // already seeded correctly this session

  const base = `http://localhost:${port}`;
  const res = await fetch(`${base}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: base,
    },
    body: JSON.stringify({
      email: 'demo@example.com',
      password: 'password',
      name: 'Demo User',
    }),
  });
  // 200 = created, 422 = already exists — both are fine
  if (!res.ok && res.status !== 422) {
    /* istanbul ignore next */
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `HTTP ${res.status}`);
  }

  // Ensure the seeded demo user is marked as verified
  sqlite.prepare("UPDATE user SET emailVerified = 1 WHERE email = 'demo@example.com'").run();
}
