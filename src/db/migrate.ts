/**
 * Database migration (Phase 1). Creates users and sessions tables on startup.
 * Safe to call multiple times — uses IF NOT EXISTS.
 */
import db from './connection';
import { randomUUID } from 'node:crypto';

export function migrate(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

/** Seed a demo user (demo@example.com / password) if it does not yet exist. */
export async function seedDemoUser(hashFn: (pw: string) => Promise<string>): Promise<void> {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get('demo@example.com');
  if (!existing) {
    const hash = await hashFn('password');
    db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(
      randomUUID(),
      'demo@example.com',
      hash,
    );
  }
}
