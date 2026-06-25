/**
 * SQLite singleton (Phase 1). WAL mode enabled for better concurrent reads.
 * The database file is created automatically on first run inside the data/ dir.
 */
import Database from 'better-sqlite3';
import type BetterSqlite3 from 'better-sqlite3';
import path from 'node:path';

const DB_PATH = path.join(process.cwd(), 'data', 'icp.db');

const db: BetterSqlite3.Database = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export default db;
