import { runAndWatch } from './evaluator.js';
import { queueHeal } from '../heal/orchestrator.js';

/** Full pipeline: run → validate → (on breach) open incident → auto-queue heal. */
export async function runCollector(collectorName: string, triggeredBy = 'scheduler') {
  const { res, incidentId } = await runAndWatch(collectorName, triggeredBy);
  if (incidentId) queueHeal(incidentId);
  return { res, incidentId };
}
