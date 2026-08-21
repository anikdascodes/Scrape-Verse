/** Debug: inspect RTX 5080 prices across stores/currencies. */
import { getDb } from '../db/index.js';
const db = getDb();
const rows = db.prepare(`SELECT c.name store, p.price, p.currency FROM prices p JOIN collectors c ON c.id=p.collector_id WHERE p.gpu_model='RTX 5080' AND p.price IS NOT NULL ORDER BY p.id DESC LIMIT 10`).all() as any[];
for (const r of rows) console.log(r.store.padEnd(12), String(r.price).padStart(9), r.currency);
