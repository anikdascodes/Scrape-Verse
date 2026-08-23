/** Normalize raw collector rows → prices table shape. */

export interface RawRow { [k: string]: unknown }

export interface NormalizedPrice {
  gpu_model: string | null;
  product_name: string | null;
  price: number | null;
  currency: string;
  stock_status: string;
  url: string | null;
}

/** GPU model patterns, ordered most-specific first. */
const GPU_PATTERNS: RegExp[] = [
  /RTX\s?50(90|80|70|60)(\s?TI)?/i,
  /RTX\s?40(90|80|70|60)(\s?(SUPER|TI))?/i,
  /RTX\s?30(90|80|70|60)(\s?TI)?/i,
  /RX\s?90(70|80)(\s?XT)?/i,
  /RX\s?79(00|50)(\s?(XT|GRE))?/i,
  /RX\s?78(00)(\s?XT)?/i,
  /RX\s?68(00)(\s?XT)?/i,
  /RX\s?67(00)(\s?XT)?/i,
  /ARC\s?B(580|570)/i,
];

export function extractGpuModel(title: string | null): string | null {
  if (!title) return null;
  for (const re of GPU_PATTERNS) {
    const m = title.match(re);
    if (m) return m[0].replace(/\s+/g, ' ').toUpperCase();
  }
  return null;
}

/** Parse price from number, "$1,299.99", "255,25 €", "USD 549.99", or Bright Data
 *  price objects {value, currency, symbol}.
 *  Object values are AMBIGUOUS across collectors: Newegg sends integer cents (99900 = $999),
 *  B&H post-heal sends decimal dollars (1478.99 = $1,478.99). The `hint` disambiguates:
 *  'cents_object' → integer values are minor units; 'dollars_object' → value is dollars. */
export function parsePrice(raw: unknown, hint: 'auto' | 'cents_object' | 'dollars_object' = 'auto'): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (raw === null || raw === undefined) return null;

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as { value?: unknown; amount?: unknown };
    const v = obj.value ?? obj.amount;
    if (v === undefined || v === null) return null;
    const n = typeof v === 'number' ? v : Number.parseFloat(String(v));
    if (!Number.isFinite(n)) return null;
    if (hint === 'dollars_object') return n > 0 ? n : null;
    if (hint === 'cents_object') return n > 0 ? n / 100 : null;
    // auto: integers ≥ 1000 treated as cents (Newegg pattern), else dollars
    return n >= 1000 ? n / 100 : n;
  }

  const s = String(raw).trim();
  if (!s) return null;

  // Strip currency words/symbols and whitespace
  let t = s.replace(/(USD|EUR|GBP|€|\$|£)/gi, '').replace(/\s+/g, '');

  // Detect decimal style: "1.299,99" / "255,25" (EU) vs "1,299.99" / "255.25" (US)
  const hasComma = t.includes(',');
  const hasDot = t.includes('.');
  let cleaned: string;
  if (hasComma && hasDot) {
    cleaned = t.lastIndexOf(',') > t.lastIndexOf('.')
      ? t.replace(/\./g, '').replace(',', '.')   // 1.299,99 → 1299.99
      : t.replace(/,/g, '');                      // 1,299.99 → 1299.99
  } else if (hasComma) {
    const parts = t.split(',');
    cleaned = parts.length === 2 && parts[1].length <= 2
      ? t.replace(',', '.')                       // 255,25 → 255.25
      : t.replace(/,/g, '');                      // 1,299 → 1299
  } else if (/\.\d{3}$/.test(t)) {
    cleaned = t.replace(/\./g, '');               // 1.179 (EU thousands) → 1179
  } else {
    cleaned = t;
  }
  cleaned = cleaned.replace(/[^0-9.]/g, '');
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 && n < 100_000 ? n : null;
}

export function normalizeStock(raw: unknown): string {
  const s = String(raw ?? '').toLowerCase();
  if (!s) return 'unknown';
  if (/in.?stock|auf Lager|lagernd|verfügbar|lieferbar|available|buy now|add to cart|add to bag/.test(s)) return 'in stock';
  if (/out.?of.?stock|ausverkauft|sold out|unavailable/.test(s)) return 'out of stock';
  if (/pre.?order|vorbestell|coming soon/.test(s)) return 'pre-order';
  return s.length <= 24 ? s : 'unknown';
}

/** Field lookup tolerant to AI schema naming drift. */
export function pick(row: RawRow, candidates: string[]): unknown {
  const lower: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) lower[k.toLowerCase()] = v;
  for (const c of candidates) {
    const v = lower[c];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
}

/** Flatten rows that nest their items under `products` / `listings` / `items` arrays. */
export function flattenRows(raw: RawRow[]): RawRow[] {
  const out: RawRow[] = [];
  for (const row of raw) {
    const nested = row.products ?? row.listings ?? row.items ?? row.results ?? row.hotels;
    if (Array.isArray(nested) && nested.length > 0) {
      for (const item of nested) {
        if (item && typeof item === 'object') out.push(item as RawRow);
      }
    } else {
      out.push(row);
    }
  }
  return out;
}

export function normalizeRow(row: RawRow, currency: string, priceHint: 'auto' | 'cents_object' | 'dollars_object' = 'auto'): NormalizedPrice {
  const name = pick(row, ['product_name', 'name', 'title', 'product_name_title']) as string | null;
  let price = parsePrice(pick(row, ['price', 'current_price', 'price_usd', 'price_eur', 'cost', 'amount']), priceHint);
  // German thousands mangling: source-side float("1.179,00") → 1.179 (exactly 3 decimals).
  // Real prices never carry 3 decimals — restore by ×1000. EUR only.
  if (price !== null && currency === 'EUR') {
    const dec = String(price).split('.')[1];
    if (dec && dec.length === 3) price = price * 1000;  // scraper ÷1000 (EUR "1.179,00" → 1.179)
    else if (dec && dec.length === 4) price = price * 100; // scraper ÷100 (USD "$1,309.99" → 13.0999)
  }
  // Plausibility floor: scrapers occasionally parse shipping/promo cents as the
  // item price ($7.70 GPU, $2.60 GPU…). Real cards in these catalogs are ≥$30.
  if (price !== null && currency !== 'INR' && price > 0 && price < 30) price = null;
  return {
    gpu_model: extractGpuModel(name),
    product_name: name ? String(name).slice(0, 300) : null,
    price,
    currency,
    stock_status: normalizeStock(pick(row, ['stock_status', 'availability', 'stock', 'in_stock'])),
    url: (pick(row, ['url', 'product_url', 'link']) as string | null)?.slice(0, 500) ?? null,
  };
}

