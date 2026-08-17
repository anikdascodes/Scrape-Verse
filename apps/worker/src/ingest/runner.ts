import { getDb } from '../db/index.js';
import { trigger, waitForDataset } from '../brightdata/client.js';
import { normalizeRow, type RawRow } from './normalize.js';

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
export async function ingestCollector(collectorName: string, triggeredBy = 'scheduler'): Promise<IngestResult> {
  const db = getDb();
  const col = db.prepare('SELECT * FROM collectors WHERE name = ?').get(collectorName) as
    | { id: number; c_id: string; base_url: string; currency: string; required_fields: string }
    | undefined;

  if (!col) throw new Error(`unknown collector: ${collectorName}`);

  const startedAt = new Date().toISOString();
  const insRun = db.prepare(`INSERT INTO runs (collector_id, status, triggered_by, started_at)
                             VALUES (?, 'running', ?, ?)`);
  const { lastInsertRowid } = insRun.run(col.id, triggeredBy, startedAt);
  const runId = Number(lastInsertRowid);

  try {
    const snapshotId = await trigger(col.c_id, [col.base_url]);
    db.prepare('UPDATE runs SET snapshot_id = ? WHERE id = ?').run(snapshotId, runId);

    const raw = (await waitForDataset(snapshotId)) as RawRow[];
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
