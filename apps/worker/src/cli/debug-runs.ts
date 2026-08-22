import { getDb } from '../db/index.js';
const db = getDb();
const runs = db.prepare(`SELECT r.id, r.status, r.rows_valid, r.triggered_by FROM runs r
  JOIN collectors c ON c.id = r.collector_id
  WHERE c.name = 'chaos' ORDER BY r.id DESC LIMIT 6`).all() as any[];
console.log(JSON.stringify(runs));
const inc = db.prepare(`SELECT id, status, collector_id FROM incidents ORDER BY id DESC LIMIT 4`).all() as any[];
console.log('incidents:', JSON.stringify(inc));
