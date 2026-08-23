import Fastify from 'fastify';
import cors from '@fastify/cors';
import { getDb } from '../db/index.js';
import { runCollector } from '../watchdog/controller.js';
import { chaosTest } from '../chaos/chaos-runner.js';
import { searchCity, isValidCity } from '../travel/search.js';
import { bus, type HydraEvent } from '../events/bus.js';
import { WORKER_PORT } from '../config.js';

/** Coerce a query param to a safe string (duplicate keys arrive as arrays). */
function qs(v: unknown, fallback = ''): string {
  if (Array.isArray(v)) return String(v[0] ?? fallback);
  if (v === undefined || v === null) return fallback;
  return String(v);
}

export async function buildServer() {
  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true });
  const db = getDb();

  app.get('/api/health', async () => ({ status: 'ok', uptime: process.uptime(), ts: new Date().toISOString() }));

  app.get('/api/collectors', async () => {
    const rows = db.prepare(`
      SELECT c.id, c.name, c.kind, c.currency, c.schedule_min, c.active,
             (SELECT status FROM runs r WHERE r.collector_id=c.id ORDER BY r.id DESC LIMIT 1) AS last_status,
             (SELECT finished_at FROM runs r WHERE r.collector_id=c.id ORDER BY r.id DESC LIMIT 1) AS last_run_at,
             (SELECT COUNT(*) FROM incidents i WHERE i.collector_id=c.id AND i.status IN ('open','healing','verifying')) AS open_incidents
      FROM collectors c WHERE c.active = 1 ORDER BY c.id`).all();
    return rows;
  });

  app.get('/api/overview', async () => {
    const rows = db.prepare(`
      SELECT p.gpu_model, p.price, c.currency, c.name AS store
      FROM prices p JOIN collectors c ON c.id = p.collector_id
      WHERE p.gpu_model IS NOT NULL AND p.price IS NOT NULL
        AND p.run_id = (SELECT MAX(id) FROM runs WHERE collector_id = p.collector_id AND status IN ('ok','partial'))
      ORDER BY p.gpu_model`).all() as { gpu_model: string; price: number; currency: string; store: string }[];

    const byKey = new Map<string, { prices: number[]; stores: Set<string>; listings: number }>();
    for (const r of rows) {
      const key = `${r.gpu_model}|${r.currency}`;
      const g = byKey.get(key) ?? { prices: [], stores: new Set(), listings: 0 };
      g.prices.push(r.price);
      g.stores.add(r.store);
      g.listings++;
      byKey.set(key, g);
    }
    const out = [];
    for (const [key, g] of byKey) {
      const [gpu_model, currency] = key.split('|');
      const sorted = [...g.prices].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      // outlier suppression: keep values within [0.35x, 3x] of the median
      const inliers = sorted.filter((p) => p > median * 0.35 && p < median * 3);
      const pool = inliers.length ? inliers : sorted;
      out.push({
        gpu_model,
        currency,
        store_count: g.stores.size,
        best_price: pool[0],
        max_price: pool[pool.length - 1],
        listings: g.listings,
      });
    }
    return out.sort((a, b) => b.listings - a.listings).slice(0, 50);
  });

  app.get<{ Querystring: { model?: string; days?: string } }>('/api/history', async (req) => {
    const model = qs(req.query.model);
    const rawDays = Number(qs(req.query.days, '7'));
    const days = Number.isFinite(rawDays) && rawDays > 0 ? Math.min(rawDays, 30) : 7;
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

  app.get<{ Querystring: { city?: string } }>('/api/travel/overview', async (req) => {
    const city = qs(req.query.city, 'Goa');

    // latest run PER COLLECTOR PER CITY (city-aware: Kolkata searches must not shadow Goa data)
    const latestByCollector = (`
      o.run_id = (SELECT MAX(o2.run_id) FROM hotel_offers o2
                   WHERE o2.collector_id = o.collector_id AND o2.city = o.city)
    `);

    const anyRows = db.prepare(`SELECT COUNT(*) n FROM hotel_offers WHERE city = ?`).get(city) as { n: number };
    if (anyRows.n === 0) return { city, groups: [], exclusive: [], stale: true };

    const groups = db.prepare(`
      SELECT m.match_id, m.canonical_name,
             json_group_array(json_object(
               'platform', c.name,
               'hotel_name', o.hotel_name,
               'price_inr', o.price_inr,
               'rating', o.rating,
               'url', o.url,
               'score', m.score
             )) AS offers
      FROM hotel_matches m
      JOIN hotel_offers o ON o.id = m.offer_id
      JOIN collectors c ON c.id = o.collector_id
      WHERE m.city = ? AND c.active = 1 AND ${latestByCollector}
      GROUP BY m.match_id`).all(city) as any[];

    const exclusives = db.prepare(`
      SELECT o.hotel_name, o.price_inr, o.rating, o.url, c.name AS platform
      FROM hotel_offers o
      JOIN collectors c ON c.id = o.collector_id
      WHERE o.city = ? AND o.price_inr IS NOT NULL AND c.active = 1 AND ${latestByCollector}
        AND o.id NOT IN (SELECT offer_id FROM hotel_matches)
      ORDER BY o.price_inr`).all(city) as any[];

    return {
      city,
      groups: groups.map((g) => ({ ...g, offers: JSON.parse(g.offers) })),
      exclusive: exclusives,
      as_of: new Date().toISOString(),
    };
  });

  // On-demand city search — live-triggers travel collectors against the requested city
  app.post<{ Body: { city?: unknown } }>('/api/travel/search', async (req, reply) => {
    const city = req.body?.city;
    if (typeof city !== 'string' || !isValidCity(city)) {
      return reply.code(400).send({ error: 'valid city required (2-40 chars, must contain letters)' });
    }
    const result = await searchCity(city);
    return result;
  });

  app.get<{ Querystring: { matchId?: string } }>('/api/travel/history', async (req) => {
    const matchId = qs(req.query.matchId);
    if (!matchId) return { error: 'matchId required' };
    const rows = db.prepare(`
      SELECT o.price_inr, o.scraped_at, c.name AS platform
      FROM hotel_matches m JOIN hotel_offers o ON o.id = m.offer_id
      JOIN collectors c ON c.id = o.collector_id
      WHERE m.match_id = ?
      ORDER BY o.scraped_at ASC`).all(matchId);
    return rows;
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
    // Kick the full break→heal loop in the background and answer immediately;
    // progress surfaces on the SSE feed. Refuses overlapping runs.
    const gate = chaosTest();
    if (!gate.started) return reply.code(409).send({ error: gate.skipReason ?? 'chaos cycle busy' });
    return { started: true };
  });

  // SSE stream of all events (Chaos Lab live feed)
  app.get('/api/stream', async (req, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    });
    reply.raw.flushHeaders?.();
    const send = (evt: HydraEvent) => reply.raw.write(`data: ${JSON.stringify(evt)}\n\n`);
    bus.on('event', send);
    reply.raw.write(`data: ${JSON.stringify({ type: 'system', collector: 'api', payload: { msg: 'connected' }, ts: new Date().toISOString() })}\n\n`);
    const ping = setInterval(() => reply.raw.write(': ping\n\n'), 5000);
    req.raw.on('close', () => { clearInterval(ping); bus.off('event', send); });
  });

  // Polling fallback for the feed (when SSE is unavailable at the edge)
  app.get('/api/feed', async () => {
    const events = db.prepare(`
      SELECT 'heal' AS kind, h.step AS step, h.status, h.detail_json, h.at AS created_at, i.collector_id, c.name AS collector
      FROM heal_events h JOIN incidents i ON i.id = h.incident_id JOIN collectors c ON c.id = i.collector_id
      ORDER BY h.id DESC LIMIT 30`).all();
    const incidents = db.prepare(`
      SELECT i.id, i.type, i.severity, i.status, i.opened_at, i.closed_at, i.detail, c.name AS collector
      FROM incidents i JOIN collectors c ON c.id = i.collector_id
      ORDER BY i.id DESC LIMIT 10`).all();
    const runs = db.prepare(`
      SELECT r.id, r.status, r.rows_in, r.rows_valid, r.finished_at, c.name AS collector
      FROM runs r JOIN collectors c ON c.id = r.collector_id
      ORDER BY r.id DESC LIMIT 10`).all();
    return { events, incidents, runs, ts: new Date().toISOString() };
  });

  await app.listen({ port: WORKER_PORT, host: '0.0.0.0' });
  console.log(`[api] listening on :${WORKER_PORT}`);
  return app;
}
