import 'dotenv/config';
import { setDefaultResultOrder } from 'node:dns';
import { Agent, setGlobalDispatcher } from 'undici';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// This host's DNS returns NAT64 IPv6 addresses with broken routing — force IPv4 sockets.
setDefaultResultOrder('ipv4first');
setGlobalDispatcher(new Agent({ connect: { family: 4 } }));

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadRootEnv() {
  // D:\Scrape-Verse\.env holds Bright_Data_API (user-created). Also try repo .env.
  for (const p of [join(__dirname, '../../../../.env'), join(__dirname, '../../../.env'), '.env']) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf-8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const [, k, v] = m;
      if (!process.env[k] || String(process.env[k]).includes('${')) {
        process.env[k] = v.replace(/^["']|["']$/g, '');
      }
    }
  }
}
loadRootEnv();

/** First env source with a real value wins. Rejects unresolved ${...} placeholders. */
function pickValid(...vals: (string | undefined)[]): string {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim().length > 12 && !v.includes('${')) return v.trim();
  }
  return '';
}

/** Canonical Bright Data API token. */
export const API_TOKEN: string = pickValid(
  process.env.Bright_Data_API,
  process.env.BD_API_KEY,
  process.env.BRIGHT_DATA_API_KEY,
);

export const API_BASE = 'https://api.brightdata.com';
export const DB_PATH = process.env.HYDRA_DB_PATH ?? './data/hydra.db';
export const WORKER_PORT = Number(process.env.WORKER_PORT ?? 8787);

/** Keep env value only when it looks like a real collector id (no ${...} placeholders). */
function sanitizeId(v: string | undefined): string {
  if (typeof v !== 'string') return '';
  const t = v.trim();
  if (!t || t.includes('${') || t.length < 8) return '';
  return t;
}

export const COLLECTORS: Record<string, string> = {
  newegg: sanitizeId(process.env.COLLECTOR_NEWEGG),
  bhphoto: sanitizeId(process.env.COLLECTOR_BHPHOTO),
  mindfactory: sanitizeId(process.env.COLLECTOR_MINDFACTORY),
  chaos: sanitizeId(process.env.COLLECTOR_CHAOS),
  oyo: sanitizeId(process.env.COLLECTOR_OYO),
  fabhotels: sanitizeId(process.env.COLLECTOR_FABHOTELS),
  treebo: sanitizeId(process.env.COLLECTOR_TREEBO),
  treebo_goa: sanitizeId(process.env.COLLECTOR_TREEBO_GOA),
};

export function assertToken(): void {
  if (!API_TOKEN) throw new Error('Missing API token: set BRIGHT_DATA_API_KEY (or Bright_Data_API) in .env');
}
