import { API_BASE, API_TOKEN } from '../config.js';

const headers = () => ({
  Authorization: `Bearer ${API_TOKEN}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
});

async function req<T>(method: string, path: string, body?: unknown, tries = 3): Promise<{ status: number; data: T }> {
  let lastErr: unknown;
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: headers(),
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      let data: unknown;
      try { data = text ? JSON.parse(text) : null; } catch { data = text; }
      return { status: res.status, data: data as T };
    } catch (e) {
      lastErr = e;
      if (i < tries) await new Promise(r => setTimeout(r, 1000 * 2 ** (i - 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** Trigger a collector run. Returns snapshot id (j_*). */
export async function trigger(collectorId: string, urls: string[], queueNext = true): Promise<string> {
  const qs = new URLSearchParams({ collector: collectorId, ...(queueNext ? { queue_next: '1' } : {}) });
  const { status, data } = await req<{ collection_id?: string; error?: string }>(
    'POST', `/dca/trigger?${qs}`, urls.map(u => ({ url: u })),
  );
  if (status !== 200 || !data?.collection_id) {
    throw new Error(`trigger failed (${status}): ${JSON.stringify(data).slice(0, 300)}`);
  }
  return data.collection_id;
}

/** Poll /dca/dataset: 202 {status:building} → 200 [rows]. */
export async function waitForDataset(snapshotId: string, opts: { intervalMs?: number; timeoutMs?: number } = {}): Promise<unknown[]> {
  const { intervalMs = 5000, timeoutMs = 10 * 60_000 } = opts;
  const started = Date.now();
  for (let attempt = 1; ; attempt++) {
    const { status, data } = await req<unknown>('GET', `/dca/dataset?id=${encodeURIComponent(snapshotId)}`);
    if (status === 200) {
      const rows = Array.isArray(data) ? data : [];
      return rows;
    }
    if (status !== 202) throw new Error(`dataset poll got ${status}: ${JSON.stringify(data).slice(0, 200)}`);
    if (Date.now() - started > timeoutMs) throw new Error(`dataset ${snapshotId} timed out after ${timeoutMs}ms`);
    await new Promise(r => setTimeout(r, intervalMs));
  }
}

/** Trigger self-heal: POST refactor_template with a plain-language prompt (≤1000 chars). */
export async function startHeal(collectorId: string, prompt: string, customInput: { url: string }[] = []) {
  return req<unknown>('POST', `/dca/collectors/${encodeURIComponent(collectorId)}/refactor_template`, {
    prompt,
    custom_input: customInput,
  });
}

export interface HealProgress {
  status?: string;
  step?: string;
  id?: string;
  progress?: number;
  completed_steps?: string[];
  preview_result?: unknown[];
  diff?: unknown;
  [k: string]: unknown;
}

const OK_STATES = new Set(['ready', 'done', 'completed', 'success', 'finished']);
const FAIL_STATES = new Set(['failed', 'error', 'errored', 'cancelled', 'canceled']);
const PENDING_STATES = new Set(['pending_answer', 'pending_input', 'awaiting_answer', 'awaiting_input']);

export type HealOutcome =
  | { kind: 'done'; progress: HealProgress }
  | { kind: 'pending_approval'; progress: HealProgress }
  | { kind: 'failed'; progress: HealProgress }
  | { kind: 'timeout'; lastStatus: string };

/** Poll heal progress until terminal state or pending_answer approval gate. */
export async function pollHeal(collectorId: string, onTick?: (p: HealProgress) => void, opts: { intervalMs?: number; timeoutMs?: number } = {}): Promise<HealOutcome> {
  const { intervalMs = 5000, timeoutMs = 20 * 60_000 } = opts;
  const started = Date.now();
  for (;;) {
    const { data } = await req<HealProgress>('GET', `/dca/collectors/${encodeURIComponent(collectorId)}/refactor_template/progress`);
    onTick?.(data);
    const status = String(data?.status ?? 'unknown').toLowerCase();
    const step = String(data?.step ?? '').toLowerCase();
    if (OK_STATES.has(status)) return { kind: 'done', progress: data };
    if (PENDING_STATES.has(status) || step === 'user_approval') return { kind: 'pending_approval', progress: data };
    if (FAIL_STATES.has(status)) return { kind: 'failed', progress: data };
    if (Date.now() - started > timeoutMs) return { kind: 'timeout', lastStatus: status };
    await new Promise(r => setTimeout(r, intervalMs));
  }
}

/** Approve or reject a paused heal job. auto_save saves template on success. */
export async function resumeHeal(collectorId: string, approve: boolean, autoSave = true) {
  return req<unknown>('POST', `/dca/collectors/${encodeURIComponent(collectorId)}/resume_automation_job`, {
    message: approve,
    auto_save: autoSave,
  });
}

export interface Balance { balance: number; credit: number; prepayment: number; pending_costs: number }

/** Account balance (USD). */
export async function getBalance(): Promise<Balance> {
  const { status, data } = await req<Balance>('GET', '/balance');
  if (status !== 200) throw new Error(`balance failed (${status})`);
  return data;
}
