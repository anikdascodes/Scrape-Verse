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
 *  price objects {value, currency, symbol} where value is in cents (99900 → $999.00). */
export function parsePrice(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (raw === null || raw === undefined) return null;

  // Bright Data structured price object: value in minor units (cents) for USD/EUR
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as { value?: unknown; amount?: unknown };
    const v = obj.value ?? obj.amount;
    if (v === undefined || v === null) return null;
    const n = typeof v === 'number' ? v : Number.parseFloat(String(v));
    if (!Number.isFinite(n)) return null;
    // GPU domain: anything ≥ $10 arrives as ≥1000 cents; below that treat as dollars
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
  if (/in.?stock|auf Lager|verfügbar|lieferbar|available|buy now|add to cart|add to bag/.test(s)) return 'in stock';
  if (/out.?of.?stock|ausverkauft|sold out|unavailable/.test(s)) return 'out of stock';
  if (/pre.?order|vorbestell|coming soon/.test(s)) return 'pre-order';
  return s.length <= 24 ? s : 'unknown';
}

/** Field lookup tolerant to AI schema naming drift. */
function pick(row: RawRow, candidates: string[]): unknown {
  const lower: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) lower[k.toLowerCase()] = v;
  for (const c of candidates) {
    const v = lower[c];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return null;
}

export function normalizeRow(row: RawRow, currency: string): NormalizedPrice {
  const name = pick(row, ['product_name', 'name', 'title', 'product_name_title']) as string | null;
  return {
    gpu_model: extractGpuModel(name),
    product_name: name ? String(name).slice(0, 300) : null,
    price: parsePrice(pick(row, ['price', 'current_price', 'price_usd', 'price_eur', 'cost', 'amount'])),
    currency,
    stock_status: normalizeStock(pick(row, ['stock_status', 'availability', 'stock', 'in_stock'])),
    url: (pick(row, ['url', 'product_url', 'link']) as string | null)?.slice(0, 500) ?? null,
  };
}
