/** On-demand city search: trigger travel collectors against a user-supplied city, live. */
import { getDb } from '../db/index.js';
import { ingestCollector } from '../ingest/runner.js';
import { bus } from '../events/bus.js';

export interface CitySearchResult {
  city: string;
  slug: string;
  collecting: boolean;
  cached: boolean;
  eta_seconds: number;
  platforms: { platform: string; url: string; status: string; rows: number; error?: string }[];
  matched: number;
  exclusive: number;
}

const CITY_URLS: Record<string, (slug: string) => string> = {
  treebo: (s) => `https://www.treebo.com/hotels-in-${s}/`,
  fabhotels: (s) => `https://www.fabhotels.com/hotels-in-${s}`,
  oyo: (s) => `https://www.oyorooms.com/hotels-in-${s}`,
  // treebo_goa is a Goa-pinned collector — never re-point it at other cities
  treebo_goa: () => `https://www.treebo.com/hotels-in-goa/`,
};

export function slugify(city: string): string {
  return city.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

/** Canonical city key: Title Case ("kolkata" → "Kolkata", "new delhi" → "New Delhi"). */
export function canonicalCity(input: string): string {
  return input
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');
}

/** Valid iff the input can plausibly be a city: has letters, sane length, slug non-empty. */
export function isValidCity(input: string): boolean {
  const c = input.trim();
  if (c.length < 2 || c.length > 40) return false;
  if (!/[a-zA-Z]/.test(c)) return false;       // must contain at least one letter
  if (/[<>{}[\]\\;'"]/.test(c)) return false;   // no markup/control/quote chars
  return slugify(c).length >= 2;
}

const activeSearches = new Map<string, number>(); // slug -> epoch ms (in-flight guard, 3 min)

/** Kick a live city scrape in the background and return instantly — the frontend polls overhead until rows land. */
export async function searchCity(cityInput: string): Promise<CitySearchResult> {
  const canonical = canonicalCity(cityInput);
  const slug = slugify(canonical);
  const db = getDb();
  const cols = db.prepare(`SELECT * FROM collectors WHERE vertical='travel' AND active=1`).all() as {
    name: string; base_url: string; city: string | null;
  }[];

  const now = Date.now();
  const last = activeSearches.get(slug) ?? 0;
  const alreadyRunning = now - last < 3 * 60_000;

  const participants = cols.filter((c) => !(c.city === 'Goa' && slug !== 'goa'));

  if (!alreadyRunning) {
    activeSearches.set(slug, now);
    void (async () => {
      for (const col of participants) {
        const url = (CITY_URLS[col.name] ?? (() => col.base_url))(slug);
        try {
          await ingestCollector(col.name, 'city_search', { targetUrl: url, city: canonical });
        } catch {
          /* details logged by the ingester */
        }
      }
    })();
  }

  bus.emitEvent({ type: 'chaos', collector: 'travel', payload: { step: 'city_search', city: slug } });

  const offers = db.prepare(`SELECT COUNT(*) n FROM hotel_offers o JOIN collectors c ON c.id=o.collector_id WHERE c.vertical='travel' AND o.city=?`).get(canonical) as { n: number };

  return {
    city: canonical,
    slug,
    collecting: !alreadyRunning,
    cached: offers.n > 0,
    eta_seconds: 180,
    platforms: participants.map((col) => ({
      platform: col.name,
      url: (CITY_URLS[col.name] ?? (() => col.base_url))(slug),
      status: alreadyRunning ? 'in-flight' : 'collecting',
      rows: 0,
    })),
    matched: 0,
    exclusive: offers.n,
  };
}
