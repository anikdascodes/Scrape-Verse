/** Debug: recent city_search runs + cities in DB. */
import { getDb } from '../db/index.js';
const db = getDb();
const runs = db.prepare(`SELECT r.id, r.triggered_by, r.status, r.rows_in FROM runs r ORDER BY r.id DESC LIMIT 10`).all() as any[];
for (const r of runs) console.log(r.id, r.triggered_by, r.status, r.rows_in);
const cities = db.prepare(`SELECT DISTINCT city FROM hotel_offers`).all() as any[];
console.log('cities in DB:', cities.map((c) => c.city).join(', '));
