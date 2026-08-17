import Fastify from 'fastify';
import { getDb } from '../db/index.js';
import { runCollector } from '../watchdog/controller.js';
import { redesignStore } from '../chaos/redesign.js';
import { bus, type HydraEvent } from '../events/bus.js';
import { WORKER_PORT } from '../config.js';

export async function buildServer() {
  const app = Fastify({ logger: false });
  const db = getDb();

  app.get('/api/health', async () => ({ status: 'ok', uptime: process.uptime(), ts: new Date().toISOString() }));

  app.get('/api/collectors', async () => {
    const rows = db.prepare(`
      SELECT c.id, c.name, c.kind, c.currency, c.schedule_min, c.active,
             (SELECT status FROM runs r WHERE r.collector_id=c.id ORDER BY r.id DESC LIMIT 1) AS last_status,
             (SELECT finished_at FROM runs r WHERE r.collector_id=c.id ORDER BY r.id DESC LIMIT 1) AS last_run_at,
             (SELECT COUNT(*) FROM incidents i WHERE i.collector_id=c.id AND i.status IN ('open','healing','verifying')) AS open_incidents
      FROM collectors c ORDER BY c.id`).all();
    return rows;
  });

  app.get('/api/overview', async () => {
    const rows = db.prepare(`
      SELECT p.gpu_model,
             COUNT(DISTINCT p.collector_id) AS store_count,
             MIN(p.price) AS best_price,
             MAX(p.price) AS max_price,
             COUNT(*) AS listings,
             c.currency
      FROM prices p JOIN collectors c ON c.id = p.collector_id
      WHERE p.gpu_model IS NOT NULL AND p.price IS NOT NULL
        AND p.run_id = (SELECT MAX(id) FROM runs WHERE collector_id = p.collector_id AND status IN ('ok','partial'))
      GROUP BY p.gpu_model, c.currency
      ORDER BY listings DESC LIMIT 50`).all();
    return rows;
  });

  app.get<{ Querystring: { model?: string; days?: string } }>('/api/history', async (req) => {
    const model = req.query.model ?? '';
    const days = Math.min(Number(req.query.days ?? 7), 30);
    if (!model) return { error: 'model required' };
    const rows = db.prepare(`
      SELECT p.gpu_model, p.price, p.currency, p.scraped_at, c.name AS store
      FROM prices p JOIN collectors c ON c.id = p.collector_id
      WHERE p.gpu_model = ? AND p.price IS NOT NULL
        AND p.scraped_at >= datetime('now', ?)
      ORDER BY p.scraped_at ASC`).all(model, `-${days} days`);
    return rows;
  });

  app.get('/api/incidents', async () => {
    return db.prepare(`
      SELECT i.*, c.name AS collector, c.kind,
             (SELECT COUNT(*) FROM heal_events h WHERE h.incident_id=i.id) AS event_count
      FROM incidents i JOIN collectors c ON c.id=i.collector_id
      ORDER BY i.id DESC LIMIT 100`).all();
  });

  app.get<{ Params: { id: string } }>('/api/incidents/:id', async (req) => {
    const inc = db.prepare(`SELECT i.*, c.name AS collector FROM incidents i JOIN collectors c ON c.id=i.collector_id WHERE i.id=?`).get(req.params.id);
    if (!inc) return { error: 'not found' };
    const events = db.prepare(`SELECT * FROM heal_events WHERE incident_id=? ORDER BY id ASC`).all(req.params.id);
    return { incident: inc, events };
  });

  app.get('/api/alerts', async () => {
    return db.prepare('SELECT id, gpu_model, kind, threshold, triggered_at, note FROM alerts ORDER BY id DESC LIMIT 100').all();
  });

  app.get('/api/credits', async () => {
    const history = db.prepare('SELECT balance_usd, checked_at FROM credit_log ORDER BY id DESC LIMIT 60').all();
    return { history };
  });

  app.post<{ Params: { name: string } }>('/api/run/:name', async (req, reply) => {
    const col = db.prepare('SELECT id FROM collectors WHERE name=?').get(req.params.name);
    if (!col) return reply.code(404).send({ error: 'unknown collector' });
    const { res, incidentId } = await runCollector(req.params.name, 'manual');
    return { res, incidentId };
  });

  app.post('/api/chaos/redesign', async (req, reply) => {
    try {
      const result = await redesignStore();
      return result;
    } catch (e) {
      return reply.code(500).send({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  // SSE stream of all events (Chaos Lab live feed)
  app.get('/api/stream', async (req, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    const send = (evt: HydraEvent) => reply.raw.write(`data: ${JSON.stringify(evt)}\n\n`);
    bus.on('event', send);
    const ping = setInterval(() => reply.raw.write(': ping\n\n'), 15000);
    req.raw.on('close', () => { clearInterval(ping); bus.off('event', send); });
  });

  await app.listen({ port: WORKER_PORT, host: '0.0.0.0' });
  console.log(`[api] listening on :${WORKER_PORT}`);
  return app;
}
