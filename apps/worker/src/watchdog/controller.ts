import { runAndWatch } from './evaluator.js';
import { queueHeal } from '../heal/orchestrator.js';
import { evaluateAlerts } from '../alerts/evaluator.js';
import { getDb } from '../db/index.js';

/** Full pipeline: run → validate → (on breach) open incident → auto-queue heal → evaluate alerts. */
export async function runCollector(collectorName: string, triggeredBy = 'scheduler') {
  const db = getDb();
  const col = db.prepare('SELECT id FROM collectors WHERE name=?').get(collectorName) as { id: number } | undefined;
  const { res, incidentId } = await runAndWatch(collectorName, triggeredBy);
  const healthy = res.status === 'ok' || res.status === 'partial';

  if (col) {
    if (healthy) {
      // Recovery: a healthy run closes any open incident for this collector,
      // incl. bot-variant flakes that were deliberately left unhealed.
      const open = db.prepare(`SELECT id FROM incidents WHERE collector_id=? AND status IN ('open','healing','verifying')`).all(col.id) as { id: number }[];
      for (const o of open) {
        db.prepare(`INSERT INTO heal_events (incident_id, step, status, detail_json) VALUES (?,?,?,?)`)
          .run(o.id, 'verified_ok', 'ok', JSON.stringify({ reason: 'healthy run observed', runId: res.runId, rows: res.rowsValid }));
        db.prepare(`UPDATE incidents SET status='closed', closed_at=datetime('now') WHERE id=?`).run(o.id);
        console.log(`[watchdog] ${collectorName} healthy — auto-closed incident ${o.id}`);
      }
      try { evaluateAlerts(col.id, res.runId); } catch (e) { console.error('alerts eval failed:', e); }
    } else if (incidentId) {
      queueHeal(incidentId);
    }
  } else if (incidentId) {
    queueHeal(incidentId);
  }
  return { res, incidentId };
}
