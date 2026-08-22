import { getDb } from '../db/index.js';
import { canonicalCity } from '../travel/search.js';

const db = getDb();
const cities = db.prepare(`SELECT DISTINCT city FROM hotel_offers`).all() as { city: string }[];
for (const { city } of cities) {
  const canon = canonicalCity(city);
  if (canon !== city) {
    const o = db.prepare(`UPDATE hotel_offers SET city=? WHERE city=?`).run(canon, city);
    const m = db.prepare(`UPDATE hotel_matches SET city=? WHERE city=?`).run(canon, city);
    console.log(`canonicalized "${city}" -> "${canon}" (${o.changes} offers, ${m.changes} matches)`);
  }
}
console.log('done');
