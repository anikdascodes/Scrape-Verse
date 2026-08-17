// Generates layouts/v1.html, v2.html, v3.html — 20 fake GPUs, same data, 3 different DOMs.
// Run: node generate.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, 'layouts');
mkdirSync(outDir, { recursive: true });

// Stable product list; each layout version drifts prices slightly (realism + sanity-check guard).
const products = [
  ['ASUS ROG Strix RTX 5090 OC Edition', 2499.99, 'in stock'],
  ['MSI Gaming RTX 5090 Trio', 2399.00, 'in stock'],
  ['Gigabyte Aorus RTX 5080 Master', 1149.99, 'in stock'],
  ['ASUS TUF RTX 5080', 1099.00, 'out of stock'],
  ['MSI Ventus RTX 5070 Ti', 799.99, 'in stock'],
  ['EVGA RTX 5070 XC', 649.99, 'in stock'],
  ['Zotac Twin Edge RTX 5070', 629.00, 'in stock'],
  ['Palit Gaming Pro RTX 5060 Ti', 439.99, 'in stock'],
  ['Gigabyte Eagle RTX 5060', 329.99, 'in stock'],
  ['NVIDIA RTX 5050 Founders', 259.99, 'pre-order'],
  ['Sapphire Pulse RX 9070 XT', 649.99, 'in stock'],
  ['ASRock Taichi RX 9070', 609.00, 'in stock'],
  ['PowerColor Hellhound RX 9070', 599.99, 'out of stock'],
  ['XFX Merc RX 9060 XT', 379.99, 'in stock'],
  ['Sapphire Nitro RX 7900 XTX', 999.00, 'in stock'],
  ['ASRock Challenger RX 7900 XT', 749.99, 'in stock'],
  ['Gigabyte RTX 4060 Eagle', 309.99, 'in stock'],
  ['MSI RTX 4060 Ti Ventus', 429.00, 'in stock'],
  ['Intel Arc B580 Limited', 319.99, 'in stock'],
  ['Intel Arc B570', 249.99, 'pre-order'],
];

const drift = (price, version) => Math.round((price * (1 + (version - 1) * 0.02)) * 100) / 100;
const usd = n => `$${n.toFixed(2)}`;
const usdTxt = n => `USD ${n.toFixed(2)}`;
const eurLike = n => n.toFixed(2).replace('.', ',');

const head = (title, extra = '') => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 0; background: #0d1117; color: #e6edf3; }
  header { padding: 24px; text-align: center; border-bottom: 1px solid #21262d; }
  h1 { margin: 0; font-size: 22px; }
  main { max-width: 980px; margin: 0 auto; padding: 24px; }
  footer { padding: 24px; text-align: center; color: #7d8590; font-size: 13px; }
  ${extra}
</style>
</head>
<body>
<header><h1>Voltmart — GPU Megastore</h1><p>Fictional store for self-healing demos. Layout vVERSION</p></header>
<main>
`;

const foot = `</main>
<footer>Voltmart demo store · not a real shop · part of the HYDRA project</footer>
</body>
</html>
`;

// v1: classic card grid — .product-grid > .card, h2.title, span.price, span.avail
{
  const cards = products.map(([name, price, stock], i) => {
    const p = drift(price, 1);
    const url = `https://voltmart.example/p/gpu-${i + 1}`;
    return `      <div class="card">
        <h2 class="title">${name}</h2>
        <span class="price">${usd(p)}</span>
        <span class="avail">${stock}</span>
        <a class="detail" href="${url}">view</a>
      </div>`;
  }).join('\n');
  const css = `.product-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:16px; }
    .card { background:#161b22; border:1px solid #21262d; border-radius:10px; padding:18px; }
    .card .title { font-size:15px; margin:0 0 10px; }
    .card .price { display:block; font-size:20px; color:#3fb950; font-weight:700; }
    .card .avail { display:block; margin-top:6px; font-size:12px; color:#7d8590; text-transform:uppercase; }
    .card .detail { display:inline-block; margin-top:10px; color:#58a6ff; }`;
  writeFileSync(join(outDir, 'v1.html'),
    head('Voltmart — Graphics Cards', css).replace('vVERSION', 'v1') +
    `  <div class="product-grid">\n${cards}\n  </div>\n` + foot);
}

// v2: redesign — div.items > article.item, .nm / .cost (extra nested span) / .stk
{
  const items = products.map(([name, price, stock], i) => {
    const p = drift(price, 2);
    const url = `https://voltmart.example/p/gpu-${i + 1}`;
    return `      <article class="item" data-id="${i + 1}">
        <p class="nm">${name}</p>
        <p class="cost"><span class="val">${usd(p)}</span></p>
        <p class="stk">${stock}</p>
        <a class="lnk" href="${url}">details</a>
      </article>`;
  }).join('\n');
  const css = `.items { display:flex; flex-wrap:wrap; gap:12px; }
    .item { flex:1 1 260px; background:#0f1419; border-radius:8px; padding:14px; border-left:3px solid #f78166; }
    .item .nm { font-weight:600; margin:0 0 8px; }
    .item .cost .val { color:#f78166; font-size:19px; font-weight:800; }
    .item .stk { color:#7d8590; font-size:12px; text-transform:uppercase; margin:4px 0; }
    .lnk { color:#58a6ff; font-size:13px; }`;
  writeFileSync(join(outDir, 'v2.html'),
    head('Voltmart — Graphics Cards', css).replace('vVERSION', 'v2') +
    `  <div class="items">\n${items}\n  </div>\n` + foot);
}

// v3: drastic redesign — data table, "USD 549.99" text format, different column order
{
  const rows = products.map(([name, price, stock], i) => {
    const p = drift(price, 3);
    const url = `https://voltmart.example/p/gpu-${i + 1}`;
    return `      <tr>
        <td class="p">${usdTxt(p)}</td>
        <td class="n">${name}</td>
        <td class="s">${stock}</td>
        <td class="u"><a href="${url}">#${i + 1}</a></td>
      </tr>`;
  }).join('\n');
  const css = `table.catalog { width:100%; border-collapse:collapse; }
    table.catalog th { text-align:left; color:#7d8590; font-size:12px; text-transform:uppercase; padding:8px; border-bottom:1px solid #21262d; }
    table.catalog td { padding:10px 8px; border-bottom:1px solid #161b22; }
    td.p { color:#3fb950; font-weight:700; white-space:nowrap; }
    td.s { font-size:12px; text-transform:uppercase; color:#7d8590; }`;
  writeFileSync(join(outDir, 'v3.html'),
    head('Voltmart — Graphics Cards', css).replace('vVERSION', 'v3') +
    `  <table class="catalog">
    <thead><tr><th>Price</th><th>Product</th><th>Stock</th><th>Ref</th></tr></thead>
    <tbody>\n${rows}\n    </tbody>
  </table>\n` + foot);
}

console.log('generated: layouts/v1.html v2.html v3.html');
