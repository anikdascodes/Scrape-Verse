import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DB_PATH } from '../config.js';
import { runMigrations } from './migrate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let db: Database.Database | undefined;

export function getDb(): Database.Database {
  if (db) return db;
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(readFileSync(join(__dirname, 'schema.sql'), 'utf-8'));
  runMigrations(db);
  return db;
}
