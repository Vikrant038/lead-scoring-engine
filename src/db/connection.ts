/**
 * SQLite & Drizzle ORM singleton (Phase 1 Better Auth).
 * WAL mode enabled for concurrent read performance.
 */
import Database from 'better-sqlite3';
import type BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import path from 'node:path';
import * as schema from './schema';

const DB_PATH = path.join(process.cwd(), 'data', 'icp.db');

export const sqlite: BetterSqlite3.Database = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
export default sqlite;
