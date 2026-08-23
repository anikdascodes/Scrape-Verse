/** Purge mangled/stale prices so charts show only clean data. */
import { getDb } from '../db/index.js';
const db = getDb();

// 1. Delete prices from FAILED runs (they're either 0-row or garbage)
const delFailed = db.prepare(`DELETE FROM prices WHERE run_id IN (SELECT id FROM runs WHERE status='failed')`).run();
console.log('failed-run prices deleted:', delFailed.changes);

// 2. Delete prices from runs triggered before the EUR/price-format fixes (before run 30)
const delOld = db.prepare(`DELETE FROM prices WHERE run_id < 30`).run();
console.log('old-run prices deleted:', delOld.changes);

// 3. Delete runs that no longer have prices (keep runs table for history but they won't show in charts)
const delEmptyRuns = db.prepare(`DELETE FROM runs WHERE id NOT IN (SELECT DISTINCT run_id FROM prices) AND status != 'running'`).run();
console.log('empty runs deleted:', delEmptyRuns.changes);

// 4. Show what's left per model+currency
const stats = db.prepare(`
  SELECT gpu_model, currency, MIN(price) minp, MAX(price) maxp, COUNT(*) n
  FROM prices WHERE gpu_model IS NOT NULL AND price IS NOT NULL
  GROUP BY gpu_model, currency ORDER BY n DESC LIMIT 10`).all() as any[];
for (const s of stats) console.log(`${s.gpu_model} ${s.currency}: ${s.minp}–${s.maxp} (${s.n})`);
console.log('done');
