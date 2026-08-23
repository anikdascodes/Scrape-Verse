import { getDb } from '../db/index.js';
import { startHeal, pollHeal, resumeHeal } from '../brightdata/client.js';
import { ingestCollector } from '../ingest/runner.js';
import { validateRun } from '../watchdog/evaluator.js';
import { bus } from '../events/bus.js';
import { enqueue } from './queue.js';
import { healPrompt } from './prompts.js';

interface CollectorRow { id: number; c_id: string; name: string; base_url: string; kind: 'real' | 'chaos' }

function log(incidentId: number, step: string, status: 'ok' | 'fail' | 'info', detail?: unknown) {
  const db = getDb();
  db.prepare(`INSERT INTO heal_events (incident_id, step, status, detail_json) VALUES (?,?,?,?)`)
    .run(incidentId, step, status, detail === undefined ? null : JSON.stringify(detail).slice(0, 4000));
}

/** Run the full self-heal loop for one incident. Idempotent-ish; serialized by queue. */
export async function healIncident(incidentId: number): Promise<'closed' | 'failed'> {
  console.log(`[heal] start incident ${incidentId}`);
  const db = getDb();
  const inc = db.prepare(`SELECT * FROM incidents WHERE id=?`).get(incidentId) as any;
  const col = db.prepare(`SELECT * FROM collectors WHERE id=?`).get(inc.collector_id) as CollectorRow;
  if (!inc || !col) return 'failed';

  // Autonomous by policy: every heal auto-approves (hackathon story = zero humans).
  // Kept as a variable so a human-gated mode can be reintroduced per collector later.
  const autoApprove = true;

  db.prepare(`UPDATE incidents SET status='healing' WHERE id=?`).run(incidentId);
  bus.emitEvent({ type: 'heal', collector: col.name, payload: { incidentId, step: 'diagnosed' } });
  log(incidentId, 'diagnosed', 'info', { type: inc.type, detail: inc.detail });

  const MAX_ATTEMPTS = 2;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const prompt = healPrompt(inc.type, inc.detail);

    // PRE-STEP: resume an orphaned server-side heal if one is paused at approval
    // (survives worker restarts / lost in-memory state)
    try {
      const state = await pollHeal(col.c_id, undefined, { intervalMs: 1000, timeoutMs: 3000 });
      if (state.kind === 'pending_approval') {
        log(incidentId, 'awaiting_approval', 'info', { orphaned: true });
        await resumeHeal(col.c_id, true, true);
        log(incidentId, 'approved', 'ok', { orphaned: true, auto: true });
        const fin = await pollHeal(col.c_id);
        log(incidentId, 'resaved', fin.kind === 'done' ? 'ok' : 'fail', { outcome: fin.kind });
      }
    } catch { /* no orphaned job — continue normally */ }

    log(incidentId, 'refactor_requested', 'info', { attempt, prompt: prompt.slice(0, 500) });
    bus.emitEvent({ type: 'heal', collector: col.name, payload: { incidentId, step: 'refactor_requested', attempt } });

    try {
      const started = await startHeal(col.c_id, prompt, [{ url: col.base_url }]);
      log(incidentId, 'polling', 'info', { started: started.status });
    } catch (e) {
      log(incidentId, 'refactor_requested', 'fail', { error: String(e) });
      // retry next attempt
      if (attempt < MAX_ATTEMPTS) { log(incidentId, 'retry', 'info', {}); continue; }
      break;
    }

    const outcome = await pollHeal(col.c_id, (p) => {
      bus.emitEvent({ type: 'heal', collector: col.name, payload: { incidentId, step: 'polling', status: p.status, stepName: p.step } });
    });

    if (outcome.kind === 'failed' || outcome.kind === 'timeout') {
      log(incidentId, outcome.kind === 'timeout' ? 'polling' : 'refactor_requested', 'fail', { outcome: outcome.kind });
      if (attempt < MAX_ATTEMPTS) { log(incidentId, 'retry', 'info', {}); continue; }
      break;
    }

    if (outcome.kind === 'pending_approval') {
      log(incidentId, 'awaiting_approval', 'info', { hasPreview: Array.isArray(outcome.progress.preview_result) });
      if (autoApprove) {
        await resumeHeal(col.c_id, true, true);
        log(incidentId, 'approved', 'ok', { auto: true });
        bus.emitEvent({ type: 'heal', collector: col.name, payload: { incidentId, step: 'approved', auto: true } });
        // the approve resumes the job; poll again to completion
        const fin = await pollHeal(col.c_id);
        if (fin.kind !== 'done') { log(incidentId, 'resaved', 'fail', { outcome: fin.kind }); }
        else log(incidentId, 'resaved', 'ok', {});
      } else {
        // human gate: leave incident in healing + awaiting_approval for a human
        log(incidentId, 'awaiting_approval', 'info', { needsHuman: true });
  db.prepare(`UPDATE incidents SET status='healing' WHERE id=?`).run(incidentId);
  console.log(`[heal] incident ${incidentId} -> healing`);
        return 'failed'; // treat as not-auto-closed (human will act)
      }
    } else if (outcome.kind === 'done') {
      log(incidentId, 'resaved', 'ok', {});
    }

    // verify: re-run and check health
    log(incidentId, 'rerun', 'info', {});
    db.prepare(`UPDATE incidents SET status='verifying' WHERE id=?`).run(incidentId);
    const res = await ingestCollector(col.name, 'heal_verify');
    bus.emitEvent({ type: 'run', collector: col.name, payload: { ...res, heal_verify: true } });
    const verdict = validateRun(col.id, res);

    if (!verdict) {
      log(incidentId, 'verified_ok', 'ok', { rows: res.rowsValid, nullRate: res.nullRate });
      db.prepare(`UPDATE incidents SET status='closed', closed_at=datetime('now') WHERE id=?`).run(incidentId);
      bus.emitEvent({ type: 'heal', collector: col.name, payload: { incidentId, step: 'verified_ok', attempt } });
      log(incidentId, 'closed', 'ok', {});
      return 'closed';
    }
    log(incidentId, 'verified_fail', 'info', { verdict, attempt });
    bus.emitEvent({ type: 'heal', collector: col.name, payload: { incidentId, step: 'verified_fail', verdict, attempt } });
  }

  db.prepare(`UPDATE incidents SET status='failed', closed_at=datetime('now') WHERE id=?`).run(incidentId);
  log(incidentId, 'gave_up', 'fail', {});
  bus.emitEvent({ type: 'heal', collector: col.name, payload: { incidentId, step: 'gave_up' } });
  return 'failed';
}

/** Enqueue a heal job on the serial queue; fire-and-forget. */
export function queueHeal(incidentId: number): void {
  console.log(`[heal-q] queuing incident ${incidentId}`);
  enqueue(`heal:${incidentId}`, () => healIncident(incidentId)).catch((e) => {
    console.error(`heal ${incidentId} error:`, e instanceof Error ? e.message : e);
  });
}
