import { getDb } from './index.js';

const db = getDb();
console.log(`DB ready at ${process.env.HYDRA_DB_PATH ?? './data/hydra.db'}`);
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[];
console.log('tables:', tables.map(t => t.name).join(', '));
