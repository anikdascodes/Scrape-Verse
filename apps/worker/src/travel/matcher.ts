/** Hotel entity matching: deterministic, explainable fuzzy matching across platforms. */
import { getDb } from '../db/index.js';

const NOISE = new Set(['hotel', 'hotels', 'resort', 'resorts', 'stay', 'stays', 'rooms', 'room', 'inn', 'the', 'and', 'near', 'goa', 'beach', 'collection', 'villa', 'villas', 'homestay', 'cottage', 'palace', 'heritage', 'club', 'a', 'by', 'on', 'super', 'flagship', 'townhouse', 'capital', 'o']);

/** Extract a HIGH-PRECISION blocking key: brand + numeric ID only (OYO 1234…).
 *  Brands without an ID (all FabHotels share "FABHOTEL") are NOT blocking keys —
 *  they'd fuse different properties. Those fall through to fuzzy scoring instead. */
export function brandKey(name: string): string | null {
  const m = name.match(/(OYO|Collection O|O2|Flagship|Townhouse|Spot On|Fab\w+|Treebo)\s*([0-9]{2,}\b)/i);
  if (!m || !m[2]) return null;
  const brand = String(m[1]).replace(/\s+/g, '').toUpperCase();
  return `${brand}:${m[2]}`;
}

export function tokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter((t) => t.length > 1 && !NOISE.has(t));
}

/** Deterministic slug for a matched group. */
export function matchIdFor(names: string[]): string {
  const all = new Set<string>();
  for (const n of names) for (const t of tokens(n)) all.add(t);
  return [...all].sort().join('_').slice(0, 120);
}

export function jaccard(a: string[], b: string[]): number {
  const sa = new Set(a), sb = new Set(b);
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[m][n];
}

/** Score pair of names in [0,1]. */
export function scorePair(a: string, b: string): number {
  const ta = tokens(a), tb = tokens(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  const j = jaccard(ta, tb);
  const lev = 1 - levenshtein(ta.sort().join(' '), tb.sort().join(' ')) / Math.max(ta.join(' ').length, tb.join(' ').length, 1);
  return j * 0.6 + lev * 0.4;
}

const THRESHOLD = 0.72;

interface Offer { id: number; collector_id: number; hotel_name: string }

/**
 * Match offers for one city within one run. Groups offers by: (brandKey) or
 * hierarchical agglomeration over scorePair ≥ THRESHOLD. Writes hotel_matches rows.
 * Returns groups as [matchId, canonicalName, offers[]].
 */
export function matchOffers(runId: number, city: string): { matchId: string; canonical: string; offers: Offer[] }[] {
  const db = getDb();
  const offers = db.prepare(`SELECT id, collector_id, hotel_name FROM hotel_offers WHERE run_id = ? AND city = ? ORDER BY id`).all(runId, city) as Offer[];
  const used = new Set<number>();
  const groups: { matchId: string; canonical: string; offers: Offer[] }[] = [];

  // pass 1: brand+id blocking (high precision)
  for (const o of offers) {
    if (used.has(o.id)) continue;
    const key = brandKey(o.hotel_name);
    if (!key) continue;
    // numeric-ID block: match even across naming variants, but never fuse different ids
    const cluster = offers.filter((x) => !used.has(x.id) && brandKey(x.hotel_name) === key);
    if (cluster.length > 1) {
      for (const c of cluster) used.add(c.id);
      groups.push({ matchId: matchIdFor(cluster.map((c) => c.hotel_name)), canonical: cluster[0].hotel_name, offers: cluster });
    }
  }

  // pass 2: residual agglomeration over threshold
  for (const o of offers) {
    if (used.has(o.id)) continue;
    const cluster: Offer[] = [o];
    used.add(o.id);
    for (const x of offers) {
      if (used.has(x.id)) continue;
      if (scorePair(o.hotel_name, x.hotel_name) >= THRESHOLD) { cluster.push(x); used.add(x.id); }
    }
    if (cluster.length > 1) {
      groups.push({ matchId: matchIdFor(cluster.map((c) => c.hotel_name)), canonical: cluster[0].hotel_name, offers: cluster });
    }
  }

  // idempotent: re-matching replaces previous results for this run
  db.prepare(`DELETE FROM hotel_matches WHERE run_id = ?`).run(runId);
  const ins = db.prepare(`INSERT INTO hotel_matches (run_id, city, match_id, canonical_name, offer_id, score) VALUES (?,?,?,?,?,?)`);
  for (const g of groups) {
    for (const o of g.offers) {
      const s = o.hotel_name === g.canonical ? 1 : scorePair(g.canonical, o.hotel_name);
      ins.run(runId, city, g.matchId, g.canonical, o.id, Math.round(s * 100) / 100);
    }
  }
  return groups;
}
