import { getDb } from '../db/index.js';
import { getBalance } from '../brightdata/client.js';

/** Poll Bright Data balance and log it. Returns the balance. */
export async function recordBalance(): Promise<number> {
  const db = getDb();
  try {
    const b = await getBalance();
    db.prepare('INSERT INTO credit_log (balance_usd) VALUES (?)').run(b.balance);
    return b.balance;
  } catch (e) {
    console.error('[credits] balance poll failed:', e instanceof Error ? e.message : e);
    return -1;
  }
}
