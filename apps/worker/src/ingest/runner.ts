import { getDb } from '../db/index.js';
import { trigger, waitForDataset } from '../brightdata/client.js';
import { normalizeRow, flattenRows, type RawRow } from './normalize.js';
import { normalizeHotel } from '../travel/normalize.js';
import { matchOffers } from '../travel/matcher.js';

type CollectorRow = {
  id: number;
  c_id: string;
  base_url: string;
  currency: string;
  required_fields: string;
  vertical: string;
  city: string | null;
};

export interface IngestResult {
  runId: number;
  status: 'ok' | 'partial' | 'failed';
  rowsIn: number;
  rowsValid: number;
  nullRate: number;
  error?: string;
}

/**
 * Full ingest for one collector: trigger → poll → normalize → persist run + prices.
 * Returns stats for the watchdog. Never throws: failures are captured as status='failed'.
 */
export async function ingestCollector(collectorName: string, triggeredBy = 'scheduler', opts?: { targetUrl?: string; city?: string }): Promise<IngestResult> {
  const db = getDb();
  const col = db.prepare('SELECT * FROM collectors WHERE name = ?').get(collectorName) as CollectorRow | undefined;

  if (!col) throw new Error(`unknown collector: ${collectorName}`);
  if (col.vertical === 'travel') return ingestTravel(col, triggeredBy, opts);

  const startedAt = new Date().toISOString();
  const insRun = db.prepare(`INSERT INTO runs (collector_id, status, triggered_by, started_at)
                             VALUES (?, 'running', ?, ?)`);
  const { lastInsertRowid } = insRun.run(col.id, triggeredBy, startedAt);
  const runId = Number(lastInsertRowid);

  try {
    const snapshotId = await trigger(col.c_id, [col.base_url]);
    db.prepare('UPDATE runs SET snapshot_id = ? WHERE id = ?').run(snapshotId, runId);

    const raw = flattenRows(await waitForDataset(snapshotId) as RawRow[]);
    const required = col.required_fields.split(',').map(s => s.trim());

    let rowsValid = 0;
    const insPrice = db.prepare(`INSERT INTO prices (run_id, collector_id, gpu_model, product_name, price, currency, stock_status, url)
                                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    const persist = db.transaction((rows: NormalizedT[]) => {
      for (const p of rows) insPrice.run(runId, col.id, p.gpu_model, p.product_name, p.price, p.currency, p.stock_status, p.url);
    });

    const normalized = raw.map(r => normalizeRow(r, col.currency));
    for (const p of normalized) {
      const nameOk = !!p.product_name;
      const priceOk = p.price !== null;
      if (nameOk && priceOk) rowsValid++;
    }
    persist(normalized);

    const nullRate = normalized.length ? normalized.filter(p => p.price === null).length / normalized.length : 1;
    const status: IngestResult['status'] = rowsValid === 0 ? 'failed' : (nullRate > 0.05 ? 'partial' : 'ok');
    db.prepare(`UPDATE runs SET status=?, rows_in=?, rows_valid=?, null_rate=?, finished_at=? WHERE id=?`)
      .run(status, raw.length, rowsValid, Math.round(nullRate * 1000) / 1000, new Date().toISOString(), runId);

    return { runId, status, rowsIn: raw.length, rowsValid, nullRate };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    db.prepare(`UPDATE runs SET status='failed', error=?, finished_at=? WHERE id=?`)
      .run(msg.slice(0, 500), new Date().toISOString(), runId);
    return { runId, status: 'failed', rowsIn: 0, rowsValid: 0, nullRate: 1, error: msg };
  }
}

type NormalizedT = ReturnType<typeof normalizeRow>;

/** Travel vertical ingest: same trigger/poll spine, travel normalizer + matcher post-ingest.
 *  targetUrl/city overrides make collectors city-parametric — user queries become live scrapes. */
async function ingestTravel(col: CollectorRow, triggeredBy: string, opts?: { targetUrl?: string; city?: string }): Promise<IngestResult> {
  const db = getDb();
  const city = opts?.city ?? col.city ?? 'Goa';
  const startedAt = new Date().toISOString();
  const { lastInsertRowid } = db.prepare(`INSERT INTO runs (collector_id, status, triggered_by, started_at) VALUES (?, 'running', ?, ?)`)
    .run(col.id, triggeredBy, startedAt);
  const runId = Number(lastInsertRowid);

  try {
    const snapshotId = await trigger(col.c_id, [opts?.targetUrl ?? col.base_url]);
    db.prepare('UPDATE runs SET snapshot_id = ? WHERE id = ?').run(snapshotId, runId);
    const raw = flattenRows(await waitForDataset(snapshotId) as RawRow[]);

    let rowsValid = 0;
    const ins = db.prepare(`INSERT INTO hotel_offers (run_id, collector_id, city, hotel_name, price_inr, rating, url)
                            VALUES (?, ?, ?, ?, ?, ?, ?)`);
    const persist = db.transaction((rows: ReturnType<typeof normalizeHotel>[]) => {
      for (const h of rows) ins.run(runId, col.id, city, h.hotel_name, h.price_inr, h.rating, h.url);
    });

    const normalized = raw.map(normalizeHotel).filter((h) => h.hotel_name && h.hotel_name !== 'Unknown');
    for (const h of normalized) if (h.price_inr !== null) rowsValid++;
    persist(normalized);

    // post-ingest enrichment: cross-platform matching (failure-safe)
    if (normalized.length) {
      try { matchOffers(runId, city); } catch (e) { console.error('[travel] matcher failed:', e); }
    }

    const nullRate = normalized.length ? normalized.filter((h) => h.price_inr === null).length / normalized.length : 1;
    const status: IngestResult['status'] = rowsValid === 0 ? 'failed' : nullRate > 0.3 ? 'partial' : 'ok';
    db.prepare(`UPDATE runs SET status=?, rows_in=?, rows_valid=?, null_rate=?, finished_at=? WHERE id=?`)
      .run(status, normalized.length, rowsValid, Math.round(nullRate * 1000) / 1000, new Date().toISOString(), runId);
    return { runId, status, rowsIn: normalized.length, rowsValid, nullRate };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    db.prepare(`UPDATE runs SET status='failed', error=?, finished_at=? WHERE id=?`)
      .run(msg.slice(0, 500), new Date().toISOString(), runId);
    return { runId, status: 'failed', rowsIn: 0, rowsValid: 0, nullRate: 1, error: msg };
  }
}
