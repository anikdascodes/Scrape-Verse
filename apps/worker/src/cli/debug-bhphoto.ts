/** Debug: dump raw bhphoto rows for a run. */
import { getDb } from '../db/index.js';
const db = getDb();
const run = db.prepare(`SELECT id FROM runs WHERE collector_id=(SELECT id FROM collectors WHERE name='bhphoto') ORDER BY id DESC LIMIT 1`).get() as any;
const snap = db.prepare('SELECT snapshot_id FROM runs WHERE id=?').get(run.id) as any;
console.log('run', run.id, 'snapshot', snap.snapshot_id);
const { API_TOKEN } = await import('../config.js');
const res = await fetch(`https://api.brightdata.com/dca/dataset?id=${snap.snapshot_id}`, { headers: { Authorization: `Bearer ${API_TOKEN}` } });
const rows = (await res.json()) as any[];
for (const r of rows) {
  console.log(JSON.stringify({ name: r.hotel_name ?? r.product_name ?? r.title, price: r.price, all: Object.keys(r) }).slice(0, 260));
}
