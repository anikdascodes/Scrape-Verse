/** Register/refresh collectors table from env. Usage: npm run collectors:register */
import 'dotenv/config';
import { getDb } from '../db/index.js';
import { COLLECTORS } from '../config.js';

interface Meta { kind: 'real' | 'chaos'; url: string; currency: string; schedule: number; vertical: string; city?: string }

const META: Record<string, Meta> = {
  newegg:      { kind: 'real',  url: 'https://www.newegg.com/GPU-Devices/Category/ID-38',                       currency: 'USD', schedule: 360, vertical: 'gpu' },
  bhphoto:     { kind: 'real',  url: 'https://www.bhphotovideo.com/c/buy/graphics-cards/ci/6568/N/4294956910', currency: 'USD', schedule: 360, vertical: 'gpu' },
  mindfactory: { kind: 'real',  url: 'https://www.mindfactory.de/Hardware/Grafikkarten.html',                   currency: 'EUR', schedule: 360, vertical: 'gpu' },
  chaos:       { kind: 'chaos', url: process.env.CHAOS_STORE_URL ?? 'https://hydra-chaos-store.vercel.app/',   currency: 'USD', schedule: 30,  vertical: 'gpu' },
  oyo:         { kind: 'real',  url: 'https://www.oyorooms.com/hotels-in-goa',  currency: 'INR', schedule: 360, vertical: 'travel', city: 'Goa' },
  fabhotels:   { kind: 'real',  url: 'https://www.fabhotels.com/hotels-in-goa', currency: 'INR', schedule: 360, vertical: 'travel', city: 'Goa' },
  treebo:      { kind: 'real',  url: 'https://www.treebo.com/hotels-in-goa/',   currency: 'INR', schedule: 360, vertical: 'travel', city: 'Goa' },
};

const db = getDb();
const upsert = db.prepare(`INSERT INTO collectors (c_id, name, kind, base_url, currency, schedule_min, required_fields, vertical, city)
  VALUES (@c_id, @name, @kind, @base_url, @currency, @schedule, @required, @vertical, @city)
  ON CONFLICT(name) DO UPDATE SET c_id=excluded.c_id, base_url=excluded.base_url, active=1, vertical=excluded.vertical, city=excluded.city`);

for (const [name, c_id] of Object.entries(COLLECTORS)) {
  if (!c_id) { console.log(`skip ${name}: no c_id in env`); continue; }
  const m = META[name];
  if (!m) { console.log(`skip ${name}: no meta`); continue; }
  const required = m.vertical === 'travel' ? 'hotel_name,price' : 'product_name,price,stock_status';
  upsert.run({ c_id, name, kind: m.kind, base_url: m.url, currency: m.currency, schedule: m.schedule, required, vertical: m.vertical, city: m.city ?? null });
  console.log(`registered ${name} (${m.vertical}) → ${c_id}`);
}
