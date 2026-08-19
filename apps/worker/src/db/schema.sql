-- HYDRA schema — see docs/DESIGN_data-and-api.md (track file §5)
PRAGMA journal_mode=WAL;

CREATE TABLE IF NOT EXISTS collectors (
  id            INTEGER PRIMARY KEY,
  c_id          TEXT UNIQUE NOT NULL,
  name          TEXT UNIQUE NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('real','chaos')),
  base_url      TEXT NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'USD',
  schedule_min  INTEGER NOT NULL DEFAULT 360,
  required_fields TEXT NOT NULL DEFAULT 'product_name,price,stock_status',
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS runs (
  id            INTEGER PRIMARY KEY,
  collector_id  INTEGER NOT NULL REFERENCES collectors(id),
  snapshot_id   TEXT,
  status        TEXT NOT NULL CHECK (status IN ('ok','partial','failed','running')),
  rows_in       INTEGER DEFAULT 0,
  rows_valid    INTEGER DEFAULT 0,
  null_rate     REAL,
  triggered_by  TEXT NOT NULL DEFAULT 'scheduler',
  error         TEXT,
  started_at    TEXT NOT NULL,
  finished_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_runs_col_time ON runs(collector_id, started_at DESC);

CREATE TABLE IF NOT EXISTS prices (
  id            INTEGER PRIMARY KEY,
  run_id        INTEGER NOT NULL REFERENCES runs(id),
  collector_id  INTEGER NOT NULL REFERENCES collectors(id),
  gpu_model     TEXT,
  product_name  TEXT,
  price         REAL,
  currency      TEXT NOT NULL,
  stock_status  TEXT,
  url           TEXT,
  scraped_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_prices_model_time ON prices(gpu_model, scraped_at DESC);

CREATE TABLE IF NOT EXISTS incidents (
  id            INTEGER PRIMARY KEY,
  collector_id  INTEGER NOT NULL REFERENCES collectors(id),
  run_id        INTEGER REFERENCES runs(id),
  type          TEXT NOT NULL CHECK (type IN ('null_burst','row_drop','schema_drift','stale','empty')),
  severity      TEXT NOT NULL CHECK (severity IN ('low','high')),
  detail        TEXT,
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','healing','verifying','closed','failed','dismissed')),
  opened_at     TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at     TEXT
);

CREATE TABLE IF NOT EXISTS heal_events (
  id            INTEGER PRIMARY KEY,
  incident_id   INTEGER NOT NULL REFERENCES incidents(id),
  step          TEXT NOT NULL CHECK (step IN ('detected','diagnosed','refactor_requested','polling','awaiting_approval','approved','rejected','resaved','rerun','verified_ok','verified_fail','retry','closed','gave_up')),
  status        TEXT NOT NULL CHECK (status IN ('ok','fail','info')),
  detail_json   TEXT,
  at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS alerts (
  id            INTEGER PRIMARY KEY,
  gpu_model     TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('price_below','drop_pct','restock')),
  threshold     REAL NOT NULL,
  triggered_at  TEXT,
  run_id        INTEGER REFERENCES runs(id),
  note          TEXT
);

CREATE TABLE IF NOT EXISTS credit_log (
  id            INTEGER PRIMARY KEY,
  balance_usd   REAL NOT NULL,
  checked_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS hotel_offers (
  id            INTEGER PRIMARY KEY,
  run_id        INTEGER NOT NULL REFERENCES runs(id),
  collector_id  INTEGER NOT NULL REFERENCES collectors(id),
  city          TEXT NOT NULL,
  hotel_name    TEXT NOT NULL,
  price_inr     REAL,
  rating        REAL,
  url           TEXT,
  scraped_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_offers_city ON hotel_offers(city, scraped_at DESC);

CREATE TABLE IF NOT EXISTS hotel_matches (
  id            INTEGER PRIMARY KEY,
  run_id        INTEGER NOT NULL REFERENCES runs(id),
  city          TEXT NOT NULL,
  match_id      TEXT NOT NULL,
  canonical_name TEXT NOT NULL,
  offer_id      INTEGER NOT NULL REFERENCES hotel_offers(id),
  score         REAL NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_match_group ON hotel_matches(match_id, offer_id);
