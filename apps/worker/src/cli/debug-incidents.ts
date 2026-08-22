import { getDb } from '../db/index.js';
const db = getDb();
const inc = db.prepare(`SELECT i.id, i.status, i.collector_id, c.name, i.type, i.opened_at,
  (SELECT COUNT(*) FROM heal_events h WHERE h.incident_id = i.id) AS events
  FROM incidents i JOIN collectors c ON c.id = i.collector_id
  WHERE i.status IN ('open','healing','verifying')`).all() as any[];
console.log(JSON.stringify(inc, null, 1));
for (const i of inc) {
  const last = db.prepare(`SELECT step, at FROM heal_events WHERE incident_id=? ORDER BY id DESC LIMIT 1`).get(i.id) as any;
  console.log(`incident ${i.id} (${i.name}): last event = ${last?.step ?? 'none'} @ ${last?.at ?? '-'}`);
}
