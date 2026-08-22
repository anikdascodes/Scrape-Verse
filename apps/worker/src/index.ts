import cron from 'node-cron';
import { getDb } from './db/index.js';
import { buildServer } from './api/server.js';
import { runCollector } from './watchdog/controller.js';
import { redesignStore } from './chaos/redesign.js';
import { recordBalance } from './telemetry/credits.js';

const db = getDb();
const SCHED_ENABLED = process.env.SCHEDULER !== 'off';
const CHAOS_TEST = process.env.CHAOS_TEST_ENABLED === 'on';

// Boot reconciliation: any run still marked 'running' from a previous process is orphaned.
db.prepare(`UPDATE runs SET status='failed', error='interrupted by restart',
  finished_at=datetime('now') WHERE status='running'`).run();

async function runAll(kind: 'real' | 'chaos', by = 'scheduler') {
  const cols = db.prepare('SELECT name FROM collectors WHERE kind=? AND active=1').all(kind) as { name: string }[];
  for (const c of cols) {
    try {
      const { res } = await runCollector(c.name, by);
      console.log(`[sched] ${c.name}: ${res.status} rows=${res.rowsValid}/${res.rowsIn}`);
    } catch (e) {
      console.error(`[sched] ${c.name} failed:`, e instanceof Error ? e.message : e);
    }
  }
}

// Chaos test: redesign the store, then run the collector — which will break and self-heal.
// Produces a fresh receipt each cycle. Interval configurable via CHAOS_TEST_CRON (default every 6h).
async function chaosTest() {
  try {
    console.log('[chaos-test] redesigning store…');
    const { version } = await redesignStore();
    console.log(`[chaos-test] store now v${version}. waiting for Vercel redeploy…`);
    await new Promise((r) => setTimeout(r, 45_000)); // Vercel redeploy
    console.log('[chaos-test] triggering chaos collector…');
    const { res, incidentId } = await runCollector('chaos', 'chaos_test');
    console.log(`[chaos-test] run=${res.status} rows=${res.rowsValid} incident=${incidentId}`);
  } catch (e) {
    console.error('[chaos-test] failed:', e instanceof Error ? e.message : e);
  }
}

const app = await buildServer();

if (SCHED_ENABLED) {
  // real stores every 6h; chaos every 30min; optional periodic chaos test
  cron.schedule('0 */6 * * *', () => void runAll('real'));
  cron.schedule('*/30 * * * *', () => void runAll('chaos'));
  if (CHAOS_TEST) {
    cron.schedule(process.env.CHAOS_TEST_CRON ?? '0 */6 * * *', () => void chaosTest());
    console.log('[sched] chaos-test armed (auto break + self-heal)');
  }
  // credit telemetry every 6h
  cron.schedule('0 */6 * * *', () => void recordBalance());
  void recordBalance();
  console.log('[sched] cron armed: real=6h chaos=30m + credits=6h');
} else {
  console.log('[sched] disabled (SCHEDULER=off)');
}

// On boot: run real stores once to warm data (skip if last run < 1h ago)
const lastReal = db.prepare(`SELECT MAX(finished_at) m FROM runs r JOIN collectors c ON c.id=r.collector_id WHERE c.kind='real'`).get() as { m: string | null };
const ageH = lastReal.m ? (Date.now() - new Date(lastReal.m + 'Z').getTime()) / 3.6e6 : 99;
if (ageH > 1) void runAll('real', 'boot');

console.log('[worker] up');
