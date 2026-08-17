import { runAndWatch } from './evaluator.js';
import { queueHeal } from '../heal/orchestrator.js';
import { evaluateAlerts } from '../alerts/evaluator.js';
import { getDb } from '../db/index.js';

/** Full pipeline: run → validate → (on breach) open incident → auto-queue heal → evaluate alerts. */
export async function runCollector(collectorName: string, triggeredBy = 'scheduler') {
  const db = getDb();
  const col = db.prepare('SELECT id FROM collectors WHERE name=?').get(collectorName) as { id: number } | undefined;
  const { res, incidentId } = await runAndWatch(collectorName, triggeredBy);
  if (incidentId) queueHeal(incidentId);
  if (col && res.status !== 'failed') {
    try { evaluateAlerts(col.id, res.runId); } catch (e) { console.error('alerts eval failed:', e); }
  }
  return { res, incidentId };
}
