import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DB_PATH } from '../config.js';
import { SCHEMA_SQL } from './schema.js';
import { runMigrations } from './migrate.js';

let db: Database.Database | undefined;

export function getDb(): Database.Database {
  if (db) return db;
  // ensure the directory exists when DB_PATH points into a subfolder (e.g. ./data/hydra.db)
  if (DB_PATH.includes('/') || DB_PATH.includes('\\')) {
    mkdirSync(dirname(DB_PATH), { recursive: true });
  }
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);
  runMigrations(db);
  return db;
}
