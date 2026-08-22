import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { bus } from '../events/bus.js';

const exec = promisify(execFile);

const REPO = process.env.HYDRA_REPO_PATH ?? 'D:/Scrape-Verse/hydra';
const INDEX = join(REPO, 'chaos-store', 'index.html');
const LAYOUTS = join(REPO, 'chaos-store', 'layouts');

let current = 1;

function readCurrent(): number {
  try {
    const html = readFileSync(INDEX, 'utf-8');
    const m = html.match(/Layout v(\d)/);
    if (m) return Number(m[1]);
  } catch {}
  return 1;
}

function git(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return exec('git', ['-C', REPO, ...args], { timeout: 60000 });
}

/** Serial queue: redesigns touch the git working tree — only one at a time. */
let redesignChain: Promise<unknown> = Promise.resolve();

async function enqueueRedesign<T>(task: () => Promise<T>): Promise<T> {
  const run = redesignChain.then(() => task());
  redesignChain = run.catch(() => undefined);
  return run;
}

/** Cycle layout 1→2→3→1, commit + push to trigger Vercel redeploy. Returns new version. */
export function redesignStore(): Promise<{ version: number; committed: boolean }> {
  return enqueueRedesign(async () => {
    const now = readCurrent();
    const next = (now % 3) + 1;

    const src = join(LAYOUTS, `v${next}.html`);
    if (!existsSync(src)) throw new Error(`missing layout v${next}.html`);

    bus.emitEvent({ type: 'chaos', collector: 'chaos', payload: { step: 'redeploying', from: `v${now}`, to: `v${next}` } });

    writeFileSync(INDEX, readFileSync(src, 'utf-8'));

    try {
      await git(['add', 'chaos-store/index.html']);
      await git(['-c', 'user.name=anikdascodes', '-c', 'user.email=anikdascodes@users.noreply.github.com', 'commit', '-m', `chore(chaos): switch store layout to v${next}`]);
      await git(['push', 'origin', 'main']);
      current = next;
      bus.emitEvent({ type: 'chaos', collector: 'chaos', payload: { step: 'redeployed', version: `v${next}` } });
      return { version: next, committed: true };
    } catch (e) {
      bus.emitEvent({ type: 'chaos', collector: 'chaos', payload: { step: 'redeploy_failed', error: String(e) } });
      throw e;
    }
  });
}
