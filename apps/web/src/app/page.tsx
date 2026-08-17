import Link from "next/link";
import { getJSON, fmtPrice, type OverviewRow, type CollectorRow } from "@/lib/api";

export const dynamic = "force-dynamic";

interface AlertRow {
  id: number;
  gpu_model: string;
  kind: string;
  threshold: number;
  triggered_at: string;
  note: string;
}

export default async function Overview() {
  const [overview, collectors, alerts] = await Promise.all([
    getJSON<OverviewRow[]>("/api/overview"),
    getJSON<CollectorRow[]>("/api/collectors"),
    getJSON<AlertRow[]>("/api/alerts"),
  ]);

  if (!overview) {
    return (
      <div className="panel p-8 text-center" style={{ color: "var(--muted)" }}>
        Worker unreachable at the configured URL — start it with <span className="mono">npm run worker</span>.
      </div>
    );
  }

  const usd = overview.filter((r) => r.currency === "USD");
  const eur = overview.filter((r) => r.currency === "EUR");

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap gap-3">
        {collectors?.map((c) => (
          <div key={c.id} className="panel px-4 py-3 flex items-center gap-3 text-sm">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ background: c.open_incidents > 0 ? "var(--red)" : "var(--green)" }}
            />
            <span className="font-medium">{c.name}</span>
            <span className="mono text-xs" style={{ color: "var(--muted)" }}>
              {c.currency} · last {c.last_status ?? "—"}
            </span>
          </div>
        ))}
      </section>

      {alerts && alerts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
            Price &amp; stock alerts
          </h2>
          <div className="panel divide-y" style={{ borderColor: "var(--border)" }}>
            {alerts.map((a) => (
              <div key={a.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                <span
                  className="mono text-[11px] px-1.5 py-0.5 rounded"
                  style={{
                    background: a.kind === "restock" ? "rgba(63,185,80,0.15)" : "rgba(210,153,34,0.15)",
                    color: a.kind === "restock" ? "var(--green)" : "var(--amber)",
                  }}
                >
                  {a.kind}
                </span>
                <span style={{ color: "var(--text)" }}>{a.note}</span>
                <span className="ml-auto mono text-xs" style={{ color: "var(--muted)" }}>
                  {a.triggered_at?.slice(0, 19)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {[
        { title: "USD stores", rows: usd, cur: "USD" },
        { title: "EUR stores", rows: eur, cur: "EUR" },
      ].map(({ title, rows, cur }) =>
        rows.length ? (
          <section key={cur} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
              {title}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {rows.map((r) => (
                <Link
                  key={`${r.gpu_model}-${cur}`}
                  href={`/gpu/${encodeURIComponent(r.gpu_model)}`}
                  className="panel p-4 hover:border-slate-500 transition-colors"
                >
                  <div className="flex justify-between items-baseline">
                    <span className="font-semibold">{r.gpu_model}</span>
                    <span className="text-xs" style={{ color: "var(--muted)" }}>
                      {r.listings} listings
                    </span>
                  </div>
                  <div className="mt-2 text-2xl font-bold" style={{ color: "var(--green)" }}>
                    {fmtPrice(r.best_price, cur)}
                  </div>
                  <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                    across {r.store_count} store{r.store_count > 1 ? "s" : ""} · up to {fmtPrice(r.max_price, cur)}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null
      )}
    </div>
  );
}
