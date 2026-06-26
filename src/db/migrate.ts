/**
 * Database migration & seed (Phase 1 Better Auth).
 * Creates user, session, account, and verification tables on startup.
 */
import { sqlite, db } from './connection';
import { user, account } from './schema';
import { randomUUID } from 'node:crypto';

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

/** Seed demo user (demo@example.com / password) if not exists. */
export async function seedDemoUser(): Promise<void> {
  migrate();
  const existing = sqlite.prepare('SELECT id FROM user WHERE email = ?').get('demo@example.com');
  if (!existing) {
    // Import dynamically so better-auth is loaded after npm install
    const { hashPassword } = await import('better-auth/crypto');
    const now = new Date();
    const userId = randomUUID();
    const accountId_row = randomUUID();
    const hashed = await hashPassword('password');

    db.insert(user)
      .values({
        id: userId,
        name: 'Demo User',
        email: 'demo@example.com',
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    db.insert(account)
      .values({
        id: accountId_row,
        accountId: 'demo@example.com',
        providerId: 'email',
        userId: userId,
        password: hashed,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }
}
