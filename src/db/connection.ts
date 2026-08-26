/**
 * SQLite & Drizzle ORM singleton (Phase 1 Better Auth).
 * WAL mode enabled for concurrent read performance.
 */
import Database from 'better-sqlite3';
import type BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import * as schema from './schema';

const defaultDbPath = process.env.VERCEL
  ? path.join('/tmp', 'icp.db')
  : path.join(process.cwd(), 'data', 'icp.db');

const DB_PATH = process.env.DATABASE_PATH || defaultDbPath;
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const sqlite: BetterSqlite3.Database = new Database(DB_PATH);
if (process.env.VERCEL) {
  sqlite.pragma('journal_mode = MEMORY');
} else {
  sqlite.pragma('journal_mode = WAL');
}
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
export default sqlite;
