/** Global serial queue — Bright Data caps concurrent AI jobs (429), so one at a time. */
type Task<T> = () => Promise<T>;

let chain: Promise<unknown> = Promise.resolve();

export function enqueue<T>(label: string, task: Task<T>): Promise<T> {
  const run = chain.then(() => task());
  // keep the chain alive regardless of individual failures
  chain = run.catch(() => undefined);
  return run;
}
