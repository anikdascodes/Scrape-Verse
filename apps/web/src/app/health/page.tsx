import { getJSON, type CollectorRow } from "@/lib/api";

export const dynamic = "force-dynamic";

interface IncidentRow {
  id: number;
  collector: string;
  type: string;
  severity: string;
  detail: string | null;
  status: string;
  opened_at: string;
  closed_at: string | null;
  event_count: number;
}

interface CreditsRow {
  history: { balance_usd: number; checked_at: string }[];
}

const incidentColor = (s: string) =>
  s === "closed" ? "var(--green)" : s === "failed" ? "var(--red)" : "var(--amber)";

export default async function Health() {
  const [collectors, incidents, credits] = await Promise.all([
    getJSON<CollectorRow[]>("/api/collectors"),
    getJSON<IncidentRow[]>("/api/incidents"),
    getJSON<CreditsRow>("/api/credits"),
  ]);

  const latest = credits?.history?.[0];

  if (!collectors) {
    return <div className="panel p-8 text-center" style={{ color: "var(--muted)" }}>Worker unreachable.</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <h1 className="text-xl font-bold">Collector health</h1>
        {latest && (
          <div className="panel px-4 py-2 text-sm flex items-center gap-3">
            <span style={{ color: "var(--muted)" }}>Bright Data balance</span>
            <span className="font-bold" style={{ color: "var(--green)" }}>
              ${latest.balance_usd.toFixed(2)}
            </span>
            <span className="mono text-xs" style={{ color: "var(--muted)" }}>
              {latest.checked_at?.slice(0, 16)}
            </span>
          </div>
        )}
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {collectors.map((c) => (
          <div key={c.id} className="panel p-4">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: c.open_incidents > 0 ? "var(--red)" : "var(--green)" }} />
              <span className="font-semibold">{c.name}</span>
              <span className="ml-auto text-xs mono" style={{ color: "var(--muted)" }}>{c.kind}</span>
            </div>
            <dl className="mt-3 space-y-1 text-sm" style={{ color: "var(--muted)" }}>
              <div className="flex justify-between"><dt>last run</dt><dd className="mono text-xs">{c.last_run_at?.slice(0, 19) ?? "—"}</dd></div>
              <div className="flex justify-between"><dt>status</dt><dd className="mono">{c.last_status ?? "—"}</dd></div>
              <div className="flex justify-between"><dt>schedule</dt><dd className="mono">{c.schedule_min}m</dd></div>
              <div className="flex justify-between"><dt>open incidents</dt><dd className="mono">{c.open_incidents}</dd></div>
            </dl>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
          Incident timeline
        </h2>
        {incidents && incidents.length > 0 ? (
          <div className="panel divide-y" style={{ borderColor: "var(--border)" }}>
            {incidents.map((i) => (
              <div key={i.id} className="px-4 py-3 flex items-center gap-4 text-sm">
                <span className="mono text-xs" style={{ color: "var(--muted)" }}>#{i.id}</span>
                <span className="font-medium">{i.collector}</span>
                <span className="mono text-xs px-2 py-0.5 rounded" style={{ background: "var(--border)" }}>{i.type}</span>
                <span className="flex-1 truncate" style={{ color: "var(--muted)" }}>{i.detail}</span>
                <span className="mono text-xs" style={{ color: incidentColor(i.status) }}>{i.status}</span>
                <span className="mono text-xs" style={{ color: "var(--muted)" }}>{i.event_count} events</span>
                <span className="mono text-xs" style={{ color: "var(--muted)" }}>{i.opened_at.slice(0, 19)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="panel p-6 text-center text-sm" style={{ color: "var(--muted)" }}>
            No incidents — all collectors healthy.
          </div>
        )}
      </section>
    </div>
  );
}
