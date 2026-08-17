/** Quick data inspection. Usage: npm run inspect */
import 'dotenv/config';
import { getDb } from '../db/index.js';
const db = getDb();

const prices = db.prepare(`SELECT gpu_model, product_name, price, currency, stock_status FROM prices ORDER BY id`).all() as any[];
console.log(`rows: ${prices.length}`);
for (const p of prices) {
  console.log(`${(p.gpu_model ?? 'NULL').padEnd(12)} ${String(p.price ?? 'NULL').padStart(9)} ${p.currency} [${p.stock_status}] ${String(p.product_name ?? '').slice(0, 60)}`);
}
const nullNames = prices.filter(p => !p.gpu_model).length;
console.log(`\ngpu_model NULL: ${nullNames}/${prices.length}`);
