import { getDb } from '../db/index.js';
const db = getDb();

// Delete ALL prices from the chaos collector (its old data has the ÷1000 mangling)
const chaos = db.prepare(`DELETE FROM prices WHERE collector_id=(SELECT id FROM collectors WHERE name='chaos')`).run();
console.log('chaos prices deleted:', chaos.changes);

// Delete any remaining sub-$20 GPU prices
const low = db.prepare(`DELETE FROM prices WHERE price IS NOT NULL AND price < 20 AND gpu_model IS NOT NULL`).run();
console.log('sub-$20 deleted:', low.changes);

// Delete old bhphoto runs (pre-heal, had ÷100 bug)
const bh = db.prepare(`DELETE FROM prices WHERE collector_id=(SELECT id FROM collectors WHERE name='bhphoto') AND price < 100 AND gpu_model IS NOT NULL`).run();
console.log('old bhphoto deleted:', bh.changes);

// Show what remains
const stats = db.prepare(`
  SELECT c.name, p.currency, MIN(p.price) minp, MAX(p.price) maxp, COUNT(*) n
  FROM prices p JOIN collectors c ON c.id=p.collector_id
  WHERE p.gpu_model IS NOT NULL AND p.price IS NOT NULL
  GROUP BY c.name, p.currency ORDER BY c.name`).all() as any[];
for (const s of stats) console.log(`${s.name} ${s.currency}: ${s.minp}–${s.maxp} (${s.n})`);
