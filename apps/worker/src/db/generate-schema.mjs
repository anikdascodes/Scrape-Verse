// Generates src/db/schema.ts from schema.sql (single source of truth, runtime-safe).
import { readFileSync, writeFileSync } from 'node:fs';

const sql = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8').replace(/`/g, '\\`');
const out = `// AUTO-GENERATED from schema.sql — do not edit by hand. Regenerate: node src/db/generate-schema.mjs
export const SCHEMA_SQL = \`${sql}\`;
`;
writeFileSync(new URL('./schema.ts', import.meta.url), out);
console.log('schema.ts generated:', out.length, 'bytes');
