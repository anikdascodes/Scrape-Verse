import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { bus } from '../events/bus.js';

const exec = promisify(execFile);

// Local dev mode: make changes on this machine's git checkout.
const REPO_PATH = process.env.HYDRA_REPO_PATH ?? 'D:/Scrape-Verse/hydra';

// Cloud mode: commit via GitHub REST API (token in env) — Vercel redeploys the store on push.
const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? '';
const OWNER = process.env.HYDRA_REPO_OWNER ?? 'anikdascodes';
const REPO = process.env.HYDRA_REPO_NAME ?? 'hydra';
const BRANCH = process.env.HYDRA_REPO_BRANCH ?? 'main';
const INDEX_PATH = 'chaos-store/index.html';
const LAYOUT_COUNT = 3;

async function gh<T = unknown>(path: string, init: RequestInit = {}): Promise<{ status: number; body: T }> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => null)) as T;
  return { status: res.status, body };
}

function layoutOf(raw: string): number {
  const m = raw.match(/Layout v(\d)/);
  return m ? Number(m[1]) : 1;
}

async function nextSources(): Promise<{ next: number; index: string }> {
  const localIndex = join(REPO_PATH, INDEX_PATH);
  if (existsSync(localIndex)) {
    const html = readFileSync(localIndex, 'utf-8');
    const next = (layoutOf(html) % LAYOUT_COUNT) + 1;
    const src = join(REPO_PATH, 'chaos-store', 'layouts', `v${next}.html`);
    if (!existsSync(src)) throw new Error(`missing layout v${next}.html`);
    return { next, index: readFileSync(src, 'utf-8') };
  }

  if (!GITHUB_TOKEN) throw new Error('cloud redesign requires GITHUB_TOKEN in env');
  const cur = await gh<{ content?: string }>(`/repos/${OWNER}/${REPO}/contents/${INDEX_PATH}?ref=${BRANCH}`);
  if (cur.status !== 200 || !cur.body.content) throw new Error(`github read failed (${cur.status})`);
  const html = Buffer.from(cur.body.content, 'base64').toString('utf-8');
  const next = (layoutOf(html) % LAYOUT_COUNT) + 1;
  const lr = await gh<{ content?: string }>(`/repos/${OWNER}/${REPO}/contents/chaos-store/layouts/v${next}.html?ref=${BRANCH}`);
  if (lr.status !== 200 || !lr.body.content) throw new Error(`layout read failed (${lr.status}) for v${next}`);
  return { next, index: Buffer.from(lr.body.content, 'base64').toString('utf-8') };
}

/** Serial queue: redesigns touch the git working tree — only one at a time. */
let redesignChain: Promise<unknown> = Promise.resolve();

async function enqueueRedesign<T>(task: () => Promise<T>): Promise<T> {
  const run = redesignChain.then(() => task());
  redesignChain = run.catch(() => undefined);
  return run;
}

function git(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return exec('git', ['-C', REPO_PATH, ...args], { timeout: 60000 });
}

async function commitLocal(next: number, index: string): Promise<void> {
  writeFileSync(join(REPO_PATH, INDEX_PATH), index);
  await git(['add', INDEX_PATH]);
  await git([
    '-c', 'user.name=anikdascodes',
    '-c', 'user.email=anikdascodes@users.noreply.github.com',
    'commit', '-m', `chore(chaos): switch store layout to v${next}`,
  ]);
  await git(['push', 'origin', 'main']);
}

async function commitCloud(next: number, index: string): Promise<void> {
  const cur = await gh<{ sha?: string }>(`/repos/${OWNER}/${REPO}/contents/${INDEX_PATH}?ref=${BRANCH}`);
  if (cur.status !== 200 || !cur.body.sha) throw new Error(`github sha read failed (${cur.status})`);
  const put = await gh<{ content?: unknown }>(`/repos/${OWNER}/${REPO}/contents/${INDEX_PATH}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `chore(chaos): switch store layout to v${next}`,
      content: Buffer.from(index).toString('base64'),
      sha: cur.body.sha,
      branch: BRANCH,
    }),
  });
  if (put.status !== 200 && put.status !== 201) throw new Error(`github write failed (${put.status})`);
}

/** Cycle layout 1→2→3→1, commit + push to trigger Vercel redeploy. Returns new version. */
export function redesignStore(): Promise<{ version: number; committed: boolean }> {
  return enqueueRedesign(async () => {
    const { next, index } = await nextSources();

    bus.emitEvent({ type: 'chaos', collector: 'chaos', payload: { step: 'redeploying', from: `v${(next - 2 + LAYOUT_COUNT) % LAYOUT_COUNT + 1}`, to: `v${next}` } });

    try {
      if (existsSync(join(REPO_PATH, INDEX_PATH))) {
        await commitLocal(next, index);
      } else {
        await commitCloud(next, index);
      }
      bus.emitEvent({ type: 'chaos', collector: 'chaos', payload: { step: 'redeployed', version: `v${next}` } });
      return { version: next, committed: true };
    } catch (e) {
      bus.emitEvent({ type: 'chaos', collector: 'chaos', payload: { step: 'redeploy_failed', error: String(e) } });
      throw e;
    }
  });
}
