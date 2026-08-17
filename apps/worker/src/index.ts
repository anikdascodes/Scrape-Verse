import cron from 'node-cron';
import { getDb } from './db/index.js';
import { buildServer } from './api/server.js';
import { runCollector } from './watchdog/controller.js';

const db = getDb();
const SCHED_ENABLED = process.env.SCHEDULER !== 'off';

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

const app = await buildServer();

if (SCHED_ENABLED) {
  // real stores every 6h; chaos every 30min (once chaos collector exists)
  cron.schedule('0 */6 * * *', () => void runAll('real'));
  cron.schedule('*/30 * * * *', () => void runAll('chaos'));
  console.log('[sched] cron armed: real=6h chaos=30m');
} else {
  console.log('[sched] disabled (SCHEDULER=off)');
}

// On boot: run real stores once to warm data (skip if last run < 1h ago)
const lastReal = db.prepare(`SELECT MAX(finished_at) m FROM runs r JOIN collectors c ON c.id=r.collector_id WHERE c.kind='real'`).get() as { m: string | null };
const ageH = lastReal.m ? (Date.now() - new Date(lastReal.m + 'Z').getTime()) / 3.6e6 : 99;
if (ageH > 1) void runAll('real', 'boot');

console.log('[worker] up');
