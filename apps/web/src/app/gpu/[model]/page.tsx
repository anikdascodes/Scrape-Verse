import { getJSON, fmtPrice } from "@/lib/api";

export const dynamic = "force-dynamic";

interface HistRow {
  gpu_model: string;
  price: number;
  currency: string;
  scraped_at: string;
  store: string;
}

const COLORS = ["#58a6ff", "#3fb950", "#d29922", "#f78166", "#bc8cff", "#39c5cf"];

function Chart({ series, cur }: { series: { store: string; points: { t: string; p: number }[] }[]; cur: string }) {
  const all = series.flatMap((s) => s.points.map((p) => p.p));
  if (all.length === 0) return null;
  const min = Math.min(...all) * 0.98;
  const max = Math.max(...all) * 1.02;
  const W = 720;
  const H = 260;
  const x = (i: number, n: number) => (n <= 1 ? W / 2 : (i / (n - 1)) * (W - 40) + 20);
  const y = (p: number) => H - 30 - ((p - min) / (max - min || 1)) * (H - 60);

  return (
    <div className="overflow-x-auto">
      <svg width={W} height={H} className="min-w-[600px]">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={20} x2={W - 20} y1={30 + f * (H - 60)} y2={30 + f * (H - 60)} stroke="var(--border)" strokeDasharray="4 4" />
        ))}
        {series.map((s, si) => {
          if (s.points.length === 0) return null;
          const d = s.points.map((pt, i) => `${i === 0 ? "M" : "L"} ${x(i, s.points.length)} ${y(pt.p)}`).join(" ");
          return <path key={s.store} d={d} fill="none" stroke={COLORS[si % COLORS.length]} strokeWidth={2} />;
        })}
        <text x={22} y={24} fill="var(--muted)" fontSize={11} className="mono">{fmtPrice(max, cur)}</text>
        <text x={22} y={H - 12} fill="var(--muted)" fontSize={11} className="mono">{fmtPrice(min, cur)}</text>
      </svg>
      <div className="flex gap-4 text-xs mt-1">
        {series.map((s, si) => (
          <span key={s.store} className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-[2px]" style={{ background: COLORS[si % COLORS.length] }} />
            {s.store} ({s.points.length})
          </span>
        ))}
      </div>
    </div>
  );
}

export default async function GpuPage({ params }: { params: Promise<{ model: string }> }) {
  const { model } = await params;
  const decoded = decodeURIComponent(model);
  const hist = await getJSON<HistRow[]>(`/api/history?model=${encodeURIComponent(decoded)}&days=7`);

  const byCurrency = new Map<string, Map<string, { t: string; p: number }[]>>();
  for (const h of hist ?? []) {
    if (!byCurrency.has(h.currency)) byCurrency.set(h.currency, new Map());
    const m = byCurrency.get(h.currency)!;
    if (!m.has(h.store)) m.set(h.store, []);
    m.get(h.store)!.push({ t: h.scraped_at, p: h.price });
  }

  const latest = (hist ?? []).slice(-1)[0];

  return (
    <div className="space-y-6">
      <div className="flex items-baseline gap-4">
        <h1 className="text-xl font-bold">{decoded}</h1>
        {latest && (
          <span className="text-sm" style={{ color: "var(--muted)" }}>
            latest {fmtPrice(latest.price, latest.currency)} @ {latest.store}
          </span>
        )}
      </div>
      {hist === null ? (
        <div className="panel p-6" style={{ color: "var(--muted)" }}>Worker unreachable.</div>
      ) : hist.length === 0 ? (
        <div className="panel p-6" style={{ color: "var(--muted)" }}>No price history yet for this model.</div>
      ) : (
        [...byCurrency.entries()].map(([cur, stores]) => (
          <section key={cur} className="panel p-4 space-y-2">
            <h2 className="text-sm font-semibold" style={{ color: "var(--muted)" }}>{cur} price history (7d)</h2>
            <Chart cur={cur} series={[...stores.entries()].map(([store, points]) => ({ store, points }))} />
          </section>
        ))
      )}
    </div>
  );
}
