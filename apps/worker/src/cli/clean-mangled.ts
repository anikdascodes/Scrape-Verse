import { getDb } from '../db/index.js';
const db = getDb();
db.pragma('foreign_keys = OFF');
const a = db.prepare(`DELETE FROM prices WHERE price IS NOT NULL AND price < 20 AND gpu_model IS NOT NULL`).run();
console.log('mangled deleted:', a.changes);
const b = db.prepare(`DELETE FROM prices WHERE collector_id=(SELECT id FROM collectors WHERE name='bhphoto') AND run_id < 50`).run();
console.log('old bhphoto deleted:', b.changes);
