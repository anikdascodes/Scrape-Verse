/** CLI: ingest one collector now. Usage: npm run ingest:once -- <collectorName> [triggeredBy] */
import '../db/index.js';
import { ingestCollector } from '../ingest/runner.js';

const [name, by] = process.argv.slice(2);
if (!name) {
  console.error('usage: ingest-once <collectorName> [scheduler|manual|heal_verify]');
  process.exit(1);
}
const res = await ingestCollector(name, by ?? 'manual');
console.log(JSON.stringify(res, null, 2));
process.exit(res.status === 'failed' ? 1 : 0);
