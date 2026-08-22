import type Database from 'better-sqlite3';

/**
 * Idempotent additive migrations. schema.sql covers fresh databases; these
 * ALTERs bring pre-travel databases forward. Each statement is safe to re-run
 * (SQLite throws 'duplicate column' which we deliberately ignore).
 */
export function runMigrations(db: Database.Database): void {
  const migrations: string[] = [
    "ALTER TABLE collectors ADD COLUMN vertical TEXT NOT NULL DEFAULT 'gpu'",
    "ALTER TABLE collectors ADD COLUMN city TEXT",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_incident_per_collector ON incidents(collector_id) WHERE status IN ('open','healing','verifying')",
  ];
  for (const sql of migrations) {
    try {
      db.exec(sql);
    } catch {
      // already applied — ignore
    }
  }
}
