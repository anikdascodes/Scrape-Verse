export const WORKER_URL =
  process.env.NEXT_PUBLIC_WORKER_URL ?? "http://localhost:8787";

export interface OverviewRow {
  gpu_model: string;
  store_count: number;
  best_price: number;
  max_price: number;
  listings: number;
  currency: string;
}

export interface CollectorRow {
  id: number;
  name: string;
  kind: string;
  currency: string;
  schedule_min: number;
  active: number;
  last_status: string | null;
  last_run_at: string | null;
  open_incidents: number;
}

export async function getJSON<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${WORKER_URL}${path}`, { cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export const fmtPrice = (p: number, cur: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(p);

export const statusColor = (s: string | null) =>
  s === "ok" ? "var(--green)" : s === "partial" ? "var(--amber)" : s === null ? "var(--muted)" : "var(--red)";
