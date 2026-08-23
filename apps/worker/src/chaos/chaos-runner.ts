import { getDb } from '../db/index.js';
import { runCollector } from '../watchdog/controller.js';
import { redesignStore } from './redesign.js';

let lastChaosAt = 0;
let running = false;

/**
 * Chaos test: redesign the store, wait for the Vercel redeploy, then run the
 * chaos collector — which will break and self-heal. Produces a fresh receipt
 * each cycle. The work runs in the background; returns immediately.
 * Throttled: cannot overlap, min 2 min between cycles.
 */
export function chaosTest(): { started: boolean; skipReason?: string } {
  const now = Date.now();
  if (running || now - lastChaosAt < 120_000) {
    return { started: false, skipReason: running ? 'a chaos cycle is already running' : 'a chaos cycle ran less than 2 minutes ago' };
  }
  lastChaosAt = now;
  running = true;

  void (async () => {
    try {
      console.log('[chaos-test] redesigning store…');
      const { version } = await redesignStore();
      console.log(`[chaos-test] store now v${version}. waiting for Vercel redeploy…`);
      await new Promise((r) => setTimeout(r, 45_000));
      console.log('[chaos-test] triggering chaos collector…');
      const { res, incidentId } = await runCollector('chaos', 'chaos_test');
      console.log(`[chaos-test] run=${res.status} rows=${res.rowsValid} incident=${incidentId}`);
    } catch (e) {
      console.error('[chaos-test] failed:', e instanceof Error ? e.message : e);
    } finally {
      running = false;
    }
  })();

  return { started: true };
}
