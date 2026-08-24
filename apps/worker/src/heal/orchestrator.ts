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
  try {
    db.prepare(`INSERT INTO heal_events (incident_id, step, status, detail_json) VALUES (?,?,?,?)`)
      .run(incidentId, step, status, detail === undefined ? null : JSON.stringify(detail).slice(0, 4000));
  } catch (e) {
    console.error('[heal-log] write failed', e instanceof Error ? e.message : e);
  }
}

const withTimeout = <T>(p: Promise<T>, ms: number, label: string): Promise<T> =>
  Promise.race([
    p,
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);

/** Run the full self-heal loop for one incident. Idempotent-ish; serialized by queue. */
export async function healIncident(incidentId: number): Promise<'closed' | 'failed'> {
  console.log(`[heal] start incident ${incidentId}`);
  const db = getDb();
  const inc = db.prepare(`SELECT * FROM incidents WHERE id=?`).get(incidentId) as any;
  if (!inc) { console.log(`[heal] incident ${incidentId} missing — aborting`); return 'failed'; }
  const col = db.prepare(`SELECT * FROM collectors WHERE id=?`).get(inc.collector_id) as CollectorRow;
  if (!col) { console.log(`[heal] incident ${incidentId} collector ${inc.collector_id} missing — aborting`); return 'failed'; }

  // Autonomous by policy: every heal auto-approves (hackathon story = zero humans).
  const autoApprove = true;

  db.prepare(`UPDATE incidents SET status='healing' WHERE id=?`).run(incidentId);
  console.log(`[heal] incident ${incidentId} -> healing (${col.name})`);
  bus.emitEvent({ type: 'heal', collector: col.name, payload: { incidentId, step: 'diagnosed' } });
  log(incidentId, 'diagnosed', 'info', { type: inc.type, detail: inc.detail });

  // ── Gate 0: cooldown for collectors whose recent heals could not fix the break.
  //    Repeated AI refactors on an unfixable collector = churn + failed-job emails.
  const recentFailed = db.prepare(`
    SELECT COUNT(*) n FROM incidents
    WHERE collector_id=? AND status='failed'
      AND opened_at >= datetime('now','-6 hours')
  `).get(col.id) as { n: number };
  if (recentFailed.n >= 2) {
    console.log(`[heal] ${incidentId} ${col.name} in cooldown (${recentFailed.n} failed heals in 6h) — leaving open, no AI job`);
    log(incidentId, 'retry', 'info', { cooldown: true, failed_recent: recentFailed.n });
    db.prepare(`UPDATE incidents SET status='open', closed_at=NULL WHERE id=?`).run(incidentId);
    bus.emitEvent({ type: 'heal', collector: col.name, payload: { incidentId, step: 'cooldown', failedRecent: recentFailed.n } });
    return 'failed';
  }

  // ── Gate 1: rendering flake? An AI refactor cannot fix bot-detection page
  //    variants. Re-check once; only a confirmed extraction break may dispatch.
  if (inc.type === 'rendering') {
    db.prepare(`UPDATE incidents SET status='verifying' WHERE id=?`).run(incidentId);
    console.log(`[heal] ${incidentId} ${col.name} rendering-flake — probing with a fresh run, no AI job`);
    log(incidentId, 'rerun', 'info', { reason: 'rendering flake probe' });
    const probe = await ingestCollector(col.name, 'flake_probe');
    if (probe.status !== 'failed' && probe.rowsValid > 0) {
      db.prepare(`UPDATE incidents SET status='closed', closed_at=datetime('now') WHERE id=?`).run(incidentId);
      log(incidentId, 'verified_ok', 'ok', { reason: 'flake probe recovered', rows: probe.rowsValid });
      log(incidentId, 'closed', 'ok', {});
      console.log(`[heal] incident ${incidentId} CLOSED — flake probe recovered (${probe.rowsValid} rows)`);
      bus.emitEvent({ type: 'heal', collector: col.name, payload: { incidentId, step: 'verified_ok', flake: true } });
      return 'closed';
    }
    db.prepare(`UPDATE incidents SET status='open', closed_at=NULL WHERE id=?`).run(incidentId);
    log(incidentId, 'retry', 'info', { reason: 'flake probe still failing — deferred, no AI job' });
    console.log(`[heal] ${incidentId} ${col.name} flake probe still failing — deferred (no AI job)`);
    return 'failed';
  }

  // ── Gate 2: transient check before any break is deemed real. One fresh run;
  //    a pass proves the break was momentary (e.g. cron-burst rate limits) and
  //    spares Bright Data a pointless refactor (the source of failed-job emails).
  db.prepare(`UPDATE incidents SET status='verifying' WHERE id=?`).run(incidentId);
  console.log(`[heal] ${incidentId} ${col.name} pre-heal transient check`);
  log(incidentId, 'rerun', 'info', { reason: 'transient check' });
  const checkRun = await ingestCollector(col.name, 'transient_check');
  if (checkRun.status !== 'failed' && checkRun.rowsValid > 0) {
    db.prepare(`UPDATE incidents SET status='closed', closed_at=datetime('now') WHERE id=?`).run(incidentId);
    log(incidentId, 'verified_ok', 'ok', { reason: 'transient — no AI job dispatched', rows: checkRun.rowsValid });
    log(incidentId, 'closed', 'ok', {});
    console.log(`[heal] incident ${incidentId} CLOSED — transient break (recovery run: ${checkRun.rowsValid} rows)`);
    bus.emitEvent({ type: 'heal', collector: col.name, payload: { incidentId, step: 'verified_ok', transient: true } });
    return 'closed';
  }
  console.log(`[heal] ${incidentId} ${col.name} confirmed broken — dispatching AI refactor`);

  const MAX_ATTEMPTS = 2;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const prompt = healPrompt(inc.type, inc.detail);

    // PRE-STEP: resume an orphaned server-side heal if one is paused at approval
    // (survives worker restarts / lost in-memory state)
    try {
      const state = await withTimeout(pollHeal(col.c_id, undefined, { intervalMs: 1000, timeoutMs: 3000 }), 15_000, 'orphan probe');
      if (state.kind === 'pending_approval') {
        log(incidentId, 'awaiting_approval', 'info', { orphaned: true });
        await resumeHeal(col.c_id, true, true);
        log(incidentId, 'approved', 'ok', { orphaned: true, auto: true });
        const fin = await withTimeout(pollHeal(col.c_id), 20 * 60_000, 'orphan finish');
        log(incidentId, 'resaved', fin.kind === 'done' ? 'ok' : 'fail', { outcome: fin.kind });
      }
    } catch (e) { console.log(`[heal] ${incidentId} orphan probe: ${e instanceof Error ? e.message : e}`); }

    log(incidentId, 'refactor_requested', 'info', { attempt, prompt: prompt.slice(0, 500) });
    console.log(`[heal] ${incidentId} attempt ${attempt}: dispatching refactor for ${col.name} (${col.c_id})`);
    bus.emitEvent({ type: 'heal', collector: col.name, payload: { incidentId, step: 'refactor_requested', attempt } });

    try {
      const started = await withTimeout(startHeal(col.c_id, prompt, [{ url: col.base_url }]), 30_000, 'startHeal');
      log(incidentId, 'polling', 'info', { started: started.status });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[heal] ${incidentId} startHeal failed: ${msg}`);
      log(incidentId, 'refactor_requested', 'fail', { error: msg });
      if (attempt < MAX_ATTEMPTS) { log(incidentId, 'retry', 'info', {}); continue; }
      break;
    }

    const outcome = await withTimeout(pollHeal(col.c_id, (p) => {
      bus.emitEvent({ type: 'heal', collector: col.name, payload: { incidentId, step: 'polling', status: p.status, stepName: p.step } });
    }), 20 * 60_000, 'heal poll');

    if (outcome.kind === 'failed' || outcome.kind === 'timeout') {
      console.error(`[heal] ${incidentId} refactor job failed/timed out: ${outcome.kind}`);
      log(incidentId, 'refactor_requested', 'fail', { outcome: outcome.kind, lastStatus: outcome.kind === 'timeout' ? (outcome as { lastStatus: string }).lastStatus : undefined });
      if (attempt < MAX_ATTEMPTS) { log(incidentId, 'retry', 'info', {}); continue; }
      break;
    }

    if (outcome.kind === 'pending_approval') {
      log(incidentId, 'awaiting_approval', 'info', { hasPreview: Array.isArray(outcome.progress.preview_result) });
      if (autoApprove) {
        await resumeHeal(col.c_id, true, true);
        log(incidentId, 'approved', 'ok', { auto: true });
        console.log(`[heal] ${incidentId} approved (auto) — resaving template`);
        bus.emitEvent({ type: 'heal', collector: col.name, payload: { incidentId, step: 'approved', auto: true } });
        const fin = await withTimeout(pollHeal(col.c_id), 20 * 60_000, 'approval finish');
        if (fin.kind !== 'done') { log(incidentId, 'resaved', 'fail', { outcome: fin.kind }); }
        else log(incidentId, 'resaved', 'ok', {});
      } else {
        log(incidentId, 'awaiting_approval', 'info', { needsHuman: true });
        db.prepare(`UPDATE incidents SET status='healing' WHERE id=?`).run(incidentId);
        return 'failed';
      }
    } else if (outcome.kind === 'done') {
      log(incidentId, 'resaved', 'ok', {});
    }

    // verify: re-run and check health
    log(incidentId, 'rerun', 'info', {});
    console.log(`[heal] ${incidentId} verifying with fresh run of ${col.name}`);
    db.prepare(`UPDATE incidents SET status='verifying' WHERE id=?`).run(incidentId);
    const res = await ingestCollector(col.name, 'heal_verify');
    bus.emitEvent({ type: 'run', collector: col.name, payload: { ...res, heal_verify: true } });
    const verdict = validateRun(col.id, res);

    if (!verdict) {
      log(incidentId, 'verified_ok', 'ok', { rows: res.rowsValid, nullRate: res.nullRate });
      db.prepare(`UPDATE incidents SET status='closed', closed_at=datetime('now') WHERE id=?`).run(incidentId);
      console.log(`[heal] incident ${incidentId} CLOSED — collector ${col.name} recovered`);
      bus.emitEvent({ type: 'heal', collector: col.name, payload: { incidentId, step: 'verified_ok', attempt } });
      log(incidentId, 'closed', 'ok', {});
      return 'closed';
    }
    log(incidentId, 'verified_fail', 'info', { verdict, attempt });
    bus.emitEvent({ type: 'heal', collector: col.name, payload: { incidentId, step: 'verified_fail', verdict, attempt } });
  }

  db.prepare(`UPDATE incidents SET status='failed', closed_at=datetime('now') WHERE id=?`).run(incidentId);
  log(incidentId, 'gave_up', 'fail', {});
  console.log(`[heal] incident ${incidentId} gave up after ${MAX_ATTEMPTS} attempts`);
  bus.emitEvent({ type: 'heal', collector: col.name, payload: { incidentId, step: 'gave_up' } });
  return 'failed';
}

/** Enqueue a heal job on the serial queue; fire-and-forget. */
export function queueHeal(incidentId: number): void {
  console.log(`[heal-q] queuing incident ${incidentId}`);
  enqueue(`heal:${incidentId}`, () => healIncident(incidentId)).catch((e) => {
    console.error(`heal ${incidentId} error:`, e instanceof Error ? e.message : String(e), e instanceof Error ? e.stack?.slice(0, 300) : '');
  });
}
