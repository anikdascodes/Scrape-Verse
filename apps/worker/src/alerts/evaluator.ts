import { getDb } from '../db/index.js';
import { bus } from '../events/bus.js';

/**
 * Post-ingest alert evaluation. Compares the latest run against the previous run for
 * the same collector and emits:
 *  - drop_pct: a GPU whose cheapest price fell by ≥ dropThreshold% vs the previous run
 *  - restock: a GPU that was out of stock (or absent) last run and is in stock now
 */
const DROP_THRESHOLD = 0.05; // 5%

interface ModelStat { gpu_model: string; min_price: number; in_stock: number }

export function evaluateAlerts(collectorId: number, runId: number): number {
  const db = getDb();

  const curr = db.prepare(`
    SELECT gpu_model, MIN(price) min_price, MAX(CASE WHEN stock_status='in stock' THEN 1 ELSE 0 END) in_stock
    FROM prices WHERE run_id=? AND gpu_model IS NOT NULL AND price IS NOT NULL
    GROUP BY gpu_model`).all(runId) as ModelStat[];

  const prev = db.prepare(`
    SELECT gpu_model, MIN(price) min_price, MAX(CASE WHEN stock_status='in stock' THEN 1 ELSE 0 END) in_stock
    FROM prices WHERE collector_id=? AND run_id != ? AND gpu_model IS NOT NULL AND price IS NOT NULL
      AND run_id = (SELECT MAX(id) FROM runs WHERE collector_id=? AND id != ? AND status IN ('ok','partial'))
    GROUP BY gpu_model`).all(collectorId, runId, collectorId, runId) as ModelStat[];

  const prevMap = new Map(prev.map((p) => [p.gpu_model, p]));
  let created = 0;

  const insert = db.prepare(`INSERT INTO alerts (gpu_model, kind, threshold, triggered_at, run_id, note) VALUES (?,?,?,datetime('now'),?,?)`);

  for (const c of curr) {
    const p = prevMap.get(c.gpu_model);
    if (!p) continue;

    // price drop
    if (p.min_price > 0 && c.min_price < p.min_price * (1 - DROP_THRESHOLD)) {
      const pct = Math.round((1 - c.min_price / p.min_price) * 100);
      const note = `${c.gpu_model} fell ${pct}% (${p.min_price.toFixed(2)} → ${c.min_price.toFixed(2)})`;
      insert.run(c.gpu_model, 'drop_pct', pct, runId, note);
      bus.emitEvent({ type: 'alert', collector: '', payload: { kind: 'drop_pct', note } });
      created++;
    }
    // restock
    if (p.in_stock === 0 && c.in_stock === 1) {
      const note = `${c.gpu_model} is back in stock at ${c.min_price.toFixed(2)}`;
      insert.run(c.gpu_model, 'restock', 0, runId, note);
      bus.emitEvent({ type: 'alert', collector: '', payload: { kind: 'restock', note } });
      created++;
    }
  }
  return created;
}
