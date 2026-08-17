/** Register/refresh collectors table from env. Usage: npm run collectors:register */
import 'dotenv/config';
import { getDb } from '../db/index.js';
import { COLLECTORS } from '../config.js';

const META: Record<string, { kind: 'real' | 'chaos'; url: string; currency: string; schedule: number }> = {
  newegg:      { kind: 'real',  url: 'https://www.newegg.com/GPU-Devices/Category/ID-38',                       currency: 'USD', schedule: 360 },
  bhphoto:     { kind: 'real',  url: 'https://www.bhphotovideo.com/c/buy/graphics-cards/ci/6568/N/4294956910', currency: 'USD', schedule: 360 },
  mindfactory: { kind: 'real',  url: 'https://www.mindfactory.de/Hardware/Grafikkarten.html',                   currency: 'EUR', schedule: 360 },
  chaos:       { kind: 'chaos', url: process.env.CHAOS_STORE_URL ?? 'https://hydra-chaos-store.vercel.app/',   currency: 'USD', schedule: 30 },
};

const db = getDb();
const upsert = db.prepare(`INSERT INTO collectors (c_id, name, kind, base_url, currency, schedule_min, required_fields)
  VALUES (@c_id, @name, @kind, @base_url, @currency, @schedule, 'product_name,price,stock_status')
  ON CONFLICT(name) DO UPDATE SET c_id=excluded.c_id, base_url=excluded.base_url, active=1`);

for (const [name, c_id] of Object.entries(COLLECTORS)) {
  if (!c_id) { console.log(`skip ${name}: no c_id in env`); continue; }
  const m = META[name];
  upsert.run({ c_id, name, kind: m.kind, base_url: m.url, currency: m.currency, schedule: m.schedule });
  console.log(`registered ${name} → ${c_id}`);
}
