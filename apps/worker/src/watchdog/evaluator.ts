import { getDb } from '../db/index.js';
import { bus } from '../events/bus.js';
import { ingestCollector, type IngestResult } from '../ingest/runner.js';

export interface ValidatorVerdict {
  type: 'empty' | 'null_burst' | 'row_drop' | 'schema_drift' | 'stale';
  severity: 'low' | 'high';
  detail: string;
}

const NULL_BURST_THRESHOLD = 0.30;
const ROW_DROP_FRACTION = 0.5;

/** Evaluate a finished run; returns a breach verdict or null (healthy). */
export function validateRun(collectorId: number, res: IngestResult): ValidatorVerdict | null {
  const db = getDb();

  if (res.status === 'failed' || res.rowsValid === 0) {
    return { type: 'empty', severity: 'high', detail: res.error ?? 'no valid rows' };
  }
  if (res.nullRate > NULL_BURST_THRESHOLD) {
    return {
      type: 'null_burst', severity: 'high',
      detail: `required-field null on ${(res.nullRate * 100).toFixed(0)}% of ${res.rowsIn} rows`,
    };
  }

  const hist = db.prepare(`SELECT rows_valid FROM runs
    WHERE collector_id = ? AND status IN ('ok','partial') AND id != ?
    ORDER BY id DESC LIMIT 5`).all(collectorId, res.runId) as { rows_valid: number }[];
  if (hist.length >= 2) {
    const median = hist.map(h => h.rows_valid).sort((a, b) => a - b)[Math.floor(hist.length / 2)];
    if (median > 0 && res.rowsValid < median * ROW_DROP_FRACTION) {
      return {
        type: 'row_drop', severity: 'high',
        detail: `rows dropped: ${res.rowsValid} vs median ${median} of last ${hist.length} runs`,
      };
    }
  }
  return null;
}

/** Open an incident if none open for this collector; dedupes. Returns incident id or null. */
export function openIncident(collectorId: number, runId: number, v: ValidatorVerdict): number | null {
  const db = getDb();
  const open = db.prepare(`SELECT id FROM incidents WHERE collector_id=? AND status IN ('open','healing','verifying')`)
    .get(collectorId) as { id: number } | undefined;
  if (open) return null;

  const { lastInsertRowid } = db.prepare(
    `INSERT INTO incidents (collector_id, run_id, type, severity, detail) VALUES (?,?,?,?,?)`
  ).run(collectorId, runId, v.type, v.severity, v.detail);
  const id = Number(lastInsertRowid);
  db.prepare(`INSERT INTO heal_events (incident_id, step, status, detail_json) VALUES (?,?,?,?)`)
    .run(id, 'detected', 'ok', JSON.stringify(v));
  return id;
}

/** Run one collector: ingest → validate → incident. Emits bus events. */
export async function runAndWatch(collectorName: string, triggeredBy = 'scheduler'): Promise<{ res: IngestResult; incidentId: number | null }> {
  const db = getDb();
  const col = db.prepare('SELECT id FROM collectors WHERE name=?').get(collectorName) as { id: number } | undefined;
  if (!col) throw new Error(`unknown collector ${collectorName}`);

  const res = await ingestCollector(collectorName, triggeredBy);
  bus.emitEvent({ type: 'run', collector: collectorName, payload: res });

  const verdict = validateRun(col.id, res);
  let incidentId: number | null = null;
  if (verdict) {
    incidentId = openIncident(col.id, res.runId, verdict);
    if (incidentId) {
      bus.emitEvent({ type: 'incident', collector: collectorName, payload: { id: incidentId, ...verdict } });
    }
  }
  return { res, incidentId };
}
