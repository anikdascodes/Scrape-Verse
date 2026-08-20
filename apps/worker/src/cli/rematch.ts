/** Re-run the matcher for all city-search runs of a city. Usage: npm run travel:rematch -- <city> */
import { getDb } from '../db/index.js';
import { matchOffers } from '../travel/matcher.js';

const city = process.argv[2] ?? 'Kolkata';
const db = getDb();
const colIds = db.prepare(`SELECT id FROM collectors WHERE vertical='travel'`).all() as { id: number }[];
const idList = colIds.map((c) => c.id).join(',');
const runs = db.prepare(`SELECT DISTINCT id FROM runs WHERE collector_id IN (${idList}) AND status IN ('ok','partial') ORDER BY id`).all() as { id: number }[];
for (const r of runs) {
  const n = matchOffers(r.id, city);
  console.log(`run ${r.id}: ${n.length} match groups`);
}
console.log('done');
