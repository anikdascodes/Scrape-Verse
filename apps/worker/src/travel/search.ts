/** On-demand city search: trigger travel collectors against a user-supplied city, live. */
import { getDb } from '../db/index.js';
import { ingestCollector } from '../ingest/runner.js';
import { bus } from '../events/bus.js';

export interface CitySearchResult {
  city: string;
  slug: string;
  platforms: { platform: string; url: string; status: string; rows: number; error?: string }[];
  matched: number;
  exclusive: number;
}

const CITY_URLS: Record<string, (slug: string) => string> = {
  treebo: (s) => `https://www.treebo.com/hotels-in-${s}/`,
  fabhotels: (s) => `https://www.fabhotels.com/hotels-in-${s}`,
  oyo: (s) => `https://www.oyorooms.com/hotels-in-${s}`,
};

export function slugify(city: string): string {
  return city.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

/** Returns null if this looks like a Goan area (already collected) — those filter client-side. */
export async function searchCity(cityInput: string): Promise<CitySearchResult> {
  const slug = slugify(cityInput);
  const db = getDb();
  const cols = db.prepare(`SELECT * FROM collectors WHERE vertical='travel' AND active=1`).all() as {
    name: string; base_url: string; city: string | null;
  }[];

  const platforms: CitySearchResult['platforms'] = [];
  bus.emitEvent({ type: 'chaos', collector: 'travel', payload: { step: 'city_search', city: slug } });

  for (const col of cols) {
    const url = (CITY_URLS[col.name] ?? (() => col.base_url))(slug);
    try {
      const res = await ingestCollector(col.name, 'city_search', { targetUrl: url, city: cityInput.trim() });
      platforms.push({ platform: col.name, url, status: res.status, rows: res.rowsValid });
    } catch (e) {
      platforms.push({ platform: col.name, url, status: 'error', rows: 0, error: String(e) });
    }
  }

  const offers = db.prepare(`SELECT COUNT(*) n FROM hotel_offers o JOIN collectors c ON c.id=o.collector_id WHERE c.vertical='travel' AND o.city=?`).get(cityInput.trim()) as { n: number };
  return { city: cityInput.trim(), slug, platforms, matched: 0, exclusive: offers.n };
}
