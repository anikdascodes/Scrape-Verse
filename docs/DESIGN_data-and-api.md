# HYDRA — Design Doc 1: Data Model & API Contracts
> Status: FINAL (pre-kickoff planning artifact — rule 3 compliant)
> Any AI: implement exactly this. Deviations get logged in PROJECT_TRACK.md.

## 1. SQLite schema (Drizzle ORM, WAL mode)

```sql
-- collectors: the 4 Scraper Studio scrapers we manage
CREATE TABLE collectors (
  id            INTEGER PRIMARY KEY,
  c_id          TEXT UNIQUE NOT NULL,          -- Bright Data collector id "c_..."
  name          TEXT NOT NULL,                 -- "newegg" | "microcenter" | "mindfactory" | "chaos"
  kind          TEXT NOT NULL CHECK (kind IN ('real','chaos')),
  base_url      TEXT NOT NULL,                 -- category/landing URL
  currency      TEXT NOT NULL DEFAULT 'USD',   -- USD | EUR (per store)
  schedule_min  INTEGER NOT NULL DEFAULT 360,  -- real: 360, chaos: 30
  required_fields TEXT NOT NULL,               -- CSV: "product_name,price,stock_status"
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- runs: one row per collection trigger (j_* snapshot)
CREATE TABLE runs (
  id            INTEGER PRIMARY KEY,
  collector_id  INTEGER NOT NULL REFERENCES collectors(id),
  snapshot_id   TEXT,                          -- "j_..."
  status        TEXT NOT NULL CHECK ( status IN ('ok','partial','failed','running') ),
  rows_in       INTEGER DEFAULT 0,             -- raw rows received
  rows_valid    INTEGER DEFAULT 0,             -- rows passing zod
  null_rate     REAL,                          -- fraction missing required fields
  triggered_by  TEXT NOT NULL DEFAULT 'scheduler', -- scheduler | manual | heal_verify | chaos
  error         TEXT,
  started_at    TEXT NOT NULL,
  finished_at   TEXT
);
CREATE INDEX idx_runs_col_time ON runs(collector_id, started_at DESC);

-- prices: normalized rows (the product data)
CREATE TABLE prices (
  id            INTEGER PRIMARY KEY,
  run_id        INTEGER NOT NULL REFERENCES runs(id),
  collector_id  INTEGER NOT NULL REFERENCES collectors(id),
  gpu_model     TEXT,        -- normalized: "RTX 5070", "RX 9070 XT" (regex-extracted)
  product_name  TEXT,        -- raw listing title
  price         REAL,        -- numeric, decimal-comma handled for EUR
  currency      TEXT NOT NULL,
  stock_status  TEXT,        -- in stock | out of stock | pre-order | unknown
  url           TEXT,
  scraped_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_prices_model_time ON prices(gpu_model, scraped_at DESC);

-- incidents: opened by watchdog on validation breach
CREATE TABLE incidents (
  id            INTEGER PRIMARY KEY,
  collector_id  INTEGER NOT NULL REFERENCES collectors(id),
  run_id        INTEGER REFERENCES runs(id),
  type          TEXT NOT NULL CHECK ( type IN
    ('null_burst','row_drop','schema_drift','stale','empty') ),
  severity      TEXT NOT NULL CHECK ( severity IN ('low','high') ),
  detail        TEXT,        -- human summary e.g. "price null on 78% of 96 rows"
  status        TEXT NOT NULL DEFAULT 'open' CHECK ( status IN
    ('open','healing','verifying','closed','failed','dismissed') ),
  opened_at     TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at     TEXT
);

-- heal_events: event-sourced receipt of every heal attempt (the receipts wall)
CREATE TABLE heal_events (
  id            INTEGER PRIMARY KEY,
  incident_id   INTEGER NOT NULL REFERENCES incidents(id),
  step          TEXT NOT NULL CHECK ( step IN
    ('detected','diagnosed','refactor_requested','polling','awaiting_approval',
     'approved','rejected','resaved','rerun','verified_ok','verified_fail','retry','closed','gave_up') ),
  status        TEXT NOT NULL CHECK ( status IN ('ok','fail','info') ),
  detail_json   TEXT,        -- API payloads, previews, error bodies (secrets stripped)
  at            TEXT NOT NULL DEFAULT (datetime('now'))
);

-- alerts: price-drop rules evaluated after each ingest (localStorage mirror on web)
CREATE TABLE alerts (
  id            INTEGER PRIMARY KEY,
  gpu_model     TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK ( kind IN ('price_below','drop_pct') ),
  threshold     REAL NOT NULL,
  triggered_at  TEXT,
  run_id        INTEGER REFERENCES runs(id),
  note          TEXT         -- "RTX 5070 hit $499 at Micro Center (-18%)"
);

-- credit_log: daily bdata budget telemetry (transparency page)
CREATE TABLE credit_log (
  id            INTEGER PRIMARY KEY,
  balance_usd   REAL NOT NULL,
  checked_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
```

## 2. GPU model normalization (shared util)

```
Input:  raw title from any store
Regex family list (ordered): RTX 50(90|80|70|60)( TI)?, RTX 40(90|80|70|60)( SUPER| TI)?,
  RX 90(70|80)( XT)?, RX 79(00|50)( XT| GRE)?, RX 78(00)?( XT)?, ARC B(580|570)
Normalize: uppercase, strip vendor noise ("ASUS", "EVGA", "OC Edition"...)
Fail → gpu_model = NULL (row kept; null-rate validator catches systemic failures)
```

## 3. Worker internal modules (apps/worker/src)

```
db/          drizzle client + schema + migrations
brightdata/  client.ts (trigger, dataset poll, heal, resume, zones) — Bearer auth from env
collectors/  registry.ts (loads collectors table into runtime config)
ingest/      runner.ts (trigger→poll→normalize→prices) + normalize.ts (prices/EUR/gpu_model)
validate/    zod schemas + 5 validators (below)
watchdog/    evaluator.ts (run → incidents) + dedupe (no new incident if open one exists)
heal/        queue.ts (GLOBAL SERIAL — one AI job at a time) + orchestrator.ts (state machine)
scheduler/   node-cron: */30 chaos, every 6h real; manual trigger API
api/         fastify: REST + SSE for web (below)
events/      bus.ts (pub/sub for heal events → SSE)
```

### Validator thresholds (v1 — tune Day 2–3 with real data)
| Validator | Breach condition | Incident type/severity |
|---|---|---|
| empty | 0 valid rows | empty/high |
| null_burst | null_rate > 0.30 on required fields | null_burst/high |
| row_drop | rows_valid < 50% of median(last 5 runs) | row_drop/medium→high if 2 consecutive |
| schema_drift | zod fail on >20% rows (new/renamed fields) | schema_drift/high |
| stale | no ok run in 2× schedule_min | stale/high |
| price_sanity | median |Δprice| > 40% vs last run | NO incident — warn log only (false-positive guard) |

### Heal state machine (per incident)
```
open ── detected(logged)
  → diagnosing: build prompt from incident detail + missing fields
  → refactor_requested ── 429? → wait 60s, retry ≤3 (queue serializes anyway)
  → polling (progress endpoint; log step transitions as heal_events)
  → awaiting_approval → approved  (resume_automation_job {message:true, auto_save:true})
  │                     → rejected (message:false) → retry with sharper prompt (≤2 retries)
  → rerun (trigger + poll)
  → verified_ok  → incident closed  ✓
  → verified_fail → retry ≤2 → gave_up (incident failed; human review)
Timeout guard: 20 min per heal attempt → treated as fail.
```

## 4. Worker REST + SSE API (fastify, port 8787, no auth — local/ngrok)

| Method | Path | Returns |
|---|---|---|
| GET | /api/health | {status, uptime, db_ok} |
| GET | /api/collectors | collectors + last run status + open incidents |
| GET | /api/overview | index: per gpu_model best price, store, 24h Δ |
| GET | /api/history?model=RTX%205070&days=7 | time series per store |
| GET | /api/alerts?triggered=1 | triggered alerts (evaluated server-side too) |
| GET | /api/incidents | list w/ heal_events counts |
| GET | /api/incidents/:id | full receipt (all heal_events, detail_json) |
| POST | /api/run/:collectorName | manual trigger (used in demo) |
| POST | /api/chaos/redesign | switches chaos store layout (calls Vercel deploy hook or flips env) |
| GET | /api/stream | **SSE**: all heal/run/incident events (Chaos Lab live feed) |
| GET | /api/credits | latest credit_log + history |

SSE event shapes: `{ts, type: 'run'|'incident'|'heal'|'alert', collector, payload}` — Chaos Lab renders timeline from these.

## 5. Web pages (apps/web, Next.js App Router)

| Route | Content |
|---|---|
| / | Overview: GPU index grid, best price + store per model, 24h movers, sparklines |
| /gpu/[model] | Price history chart per store (recharts or lightweight-charts), stats |
| /health | Collector cards (status, last run, null-rate), incident timeline w/ drill-down |
| /chaos | THE LAB: redesign button, SSE live feed, before/after JSON diff viewer |
| /about | How it works + credits transparency (nice judge landing) |

## 6. Chaos store (chaos-store/, static, Vercel)

- `index.html` — 20 fake GPUs, prices, stock. 3 layout variants:
  - **v1**: `.product-grid > .card` → `h2.title`, `span.price`, `span.avail`
  - **v2**: selectors renamed (`div.items > article.item` → `.nm`, `.cost`, `.stk`) + wrap price in extra `<span>`
  - **v3**: table layout `<table class="catalog">` rows, prices in `<td class="p">` w/ different text format ("USD 549.99")
- Switching: Vercel redeploy via deploy hook (POST from worker) — 3 git branches or env-flag; simplest: 3 static files, hook rewrites symlink/index route (decide Day 3; fallback: manual redeploy during demo)
- Prices drift slightly per layout (realism + tests price_sanity guard)
- `/api/layout` mini endpoint returns current version (worker verifies switch landed)

## 7. Env vars (final)

```
BRIGHT_DATA_API_KEY=...   (worker; loaded from local .env, never committed)
WORKER_PORT=8787
DB_PATH=./data/hydra.db
CHAOS_DEPLOY_HOOK=...     (Vercel, Day 3)
PUBLIC_WORKER_URL=...     (for web fetch, Day 5)
```
