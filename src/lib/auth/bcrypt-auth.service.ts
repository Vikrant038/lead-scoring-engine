/**
 * BcryptAuthService — registration and login using bcrypt password hashing.
 * bcryptjs provides its own type definitions; no @types package needed.
 */
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import db from '../../db/connection';

const SALT_ROUNDS = 12;

export interface AuthUser {
  id: string;
  email: string;
}

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
}

export class BcryptAuthService {
  /** Hash a password — exported so migrate.ts can seed the demo user. */
  static async hash(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  async register(email: string, password: string): Promise<AuthUser> {
    const hash = await BcryptAuthService.hash(password);
    const id = randomUUID();
    db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(
      id,
      email.toLowerCase().trim(),
      hash,
    );
    return { id, email: email.toLowerCase().trim() };
  }

  async login(email: string, password: string): Promise<AuthUser | null> {
    const row = db
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(email.toLowerCase().trim()) as UserRow | undefined;
    if (!row) return null;
    const valid = await bcrypt.compare(password, row.password_hash);
    return valid ? { id: row.id, email: row.email } : null;
  }
}
