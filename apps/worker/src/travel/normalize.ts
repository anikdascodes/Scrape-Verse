/** Travel vertical normalizer: raw OTA rows → hotel_offers shape. */
import { pick } from '../ingest/normalize.js';
import type { RawRow } from '../ingest/normalize.js';

export interface NormalizedHotel {
  hotel_name: string;
  price_inr: number | null;
  rating: number | null;
  url: string | null;
}

/** Parse INR price: "₹808", "1,234", "Rs 2,345", "808", "808-1500" (take lower), numbers. */
export function parseInr(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw > 0 ? raw : null;
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const t = s.replace(/[₹\sRsINR.,.]/gmu, ''); // careful: keep digits only
  const digits = s.replace(/[^0-9,.-]/g, '');
  if (!digits) return null;
  const m = digits.match(/(\d[\d,]*)(?:\.\d+)?(?:-(\d[\d,]*))?/);
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 && n < 1_000_000 ? n : null;
}

/** Parse rating (0–5). Some OTAs use /10 or percent; clamp to 5 if 5 < r ≤ 10. */
export function parseRating(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n > 5 && n <= 10) return Math.round(n / 2 * 10) / 10;
  if (n > 10) return Math.min(n / 20, 5); // percent-ish
  return Math.min(n, 5);
}

export function normalizeHotel(row: RawRow): NormalizedHotel {
  const name = pick(row, ['hotel_name', 'name', 'title', 'hotelName', 'display_name']) as string | null;
  return {
    hotel_name: name ? String(name).trim().slice(0, 200) : (String(row.hotel_name ?? '') || 'Unknown'),
    price_inr: parseInr(pick(row, ['price', 'price_inr', 'starting_price', 'from', 'amount', 'final_price', 'cost'])),
    rating: parseRating(pick(row, ['rating', 'hotel_rating', 'avg_rating', 'score', 'stars'])),
    url: (pick(row, ['hotel_url', 'url', 'link', 'hotelUrl']) as string | null)?.trim().slice(0, 500) ?? null,
  };
}
