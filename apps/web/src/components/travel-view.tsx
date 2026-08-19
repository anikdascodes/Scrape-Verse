"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { getJSON, fmtInr, type TravelOverview, type TravelOffer } from "@/lib/api";

const PLATFORM_COLOR: Record<string, string> = {
  oyo: "#e23744",
  fabhotels: "#0f6fff",
  treebo: "#00b386",
};

const Row = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm border-b last:border-0" style={{ borderColor: "var(--border)" }}>
    {children}
  </div>
);

export default function TravelView({ data: initial }: { data: TravelOverview }) {
  const [budget, setBudget] = useState([0, 3000]);
  const [minRating, setMinRating] = useState(0);

  const groups = useMemo(
    () =>
      initial.groups
        .map((g) => ({
          ...g,
          offers: g.offers.filter((o) => (o.price_inr ?? 0) >= budget[0] && (o.price_inr ?? 0) <= budget[1] && (o.rating ?? 0) >= minRating),
        }))
        .filter((g) => g.offers.length > 0)
        .sort((a, b) => (Math.min(...a.offers.map((o) => o.price_inr ?? 9e9)) - Math.min(...b.offers.map((o) => o.price_inr ?? 9e9)))),
    [initial, budget, minRating]
  );

  const exclusives = useMemo(
    () => initial.exclusive.filter((o) => (o.price_inr ?? 0) >= budget[0] && (o.price_inr ?? 0) <= budget[1] && (o.rating ?? 0) >= minRating),
    [initial, budget, minRating]
  );

  const byPlatform = useMemo(() => {
    const m = new Map<string, TravelOffer[]>();
    for (const o of exclusives) m.set(o.platform, [...(m.get(o.platform) ?? []), o]);
    return [...m.entries()];
  }, [exclusives]);

  if (initial.stale) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">Travel — starting rates compared</h1>
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          No hotel data collected yet — the travel collectors are warming up.
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Travel — hotel rates, compared</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {initial.city} · starting rate per night · collected{" "}
            <span className="mono text-[11px]">{initial.as_of.slice(11, 19)}</span>
          </p>
        </div>
        <div className="flex items-center gap-6 panel px-4 py-3">
          <div className="w-44">
            <div className="text-[11px] mono text-muted-foreground mb-2">Budget ≤ {fmtInr(budget[1])}</div>
            <Slider value={budget} min={0} max={5000} step={100} onValueChange={(v) => setBudget(v as [number, number])} />
          </div>
          <div className="flex gap-1.5">
            {[0, 3, 3.5, 4].map((r) => (
              <button
                key={r}
                onClick={() => setMinRating(r)}
                className={`text-xs px-2.5 py-1 rounded-full transition-colors ${minRating === r ? "text-black font-medium" : "text-muted-foreground hover:text-foreground"}`}
                style={{ background: minRating === r ? "var(--chart-1)" : "var(--secondary)", cursor: "pointer" }}
              >
                {r === 0 ? "All" : `${r}★+`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 items-start">
        {/* Exclusive rail */}
        <aside className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Exclusive listings · single platform</h2>
          {byPlatform.length === 0 ? (
            <div className="panel p-4 text-sm text-muted-foreground">No exclusive listings for this filter.</div>
          ) : (
            byPlatform.map(([platform, offers]) => (
              <div key={platform} className="panel overflow-hidden">
                <div className="px-4 py-2.5 flex items-center gap-2 text-sm font-medium border-b" style={{ borderColor: "var(--border)" }}>
                  <span className="inline-block w-2 h-2 rounded-full" style={{ background: PLATFORM_COLOR[platform] ?? "var(--chart-2)" }} />
                  {platform}
                  <span className="ml-auto text-xs mono text-muted-foreground">{offers.length}</span>
                </div>
                {offers.slice(0, 6).map((o) => (
                  <Row key={o.hotel_name + o.price_inr}>
                    <a href={o.url ?? "#"} target="_blank" className="truncate flex-1 hover:text-foreground" style={{ color: "var(--foreground)" }}>
                      {o.hotel_name}
                    </a>
                    <span className="mono text-xs" style={{ color: "var(--chart-1)" }}>
                      {o.price_inr ? fmtInr(o.price_inr) : "—"}
                    </span>
                  </Row>
                ))}
              </div>
            ))
          )}
        </aside>

        {/* Matched comparison */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Same hotel on multiple platforms ({groups.length})
          </h2>
          {groups.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
              No matches for this filter — widen the budget or lower the rating.
            </CardContent></Card>
          ) : (
            groups.map((g) => {
              const sorted = [...g.offers].sort((a, b) => (a.price_inr ?? 9e9) - (b.price_inr ?? 9e9));
              const best = sorted[0];
              return (
                <Card key={g.match_id}>
                  <CardContent className="py-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[15px]">{g.canonical_name}</span>
                      <Sheet>
                        <SheetTrigger className="text-[11px] mono text-muted-foreground hover:text-foreground underline underline-offset-2 cursor-pointer">
                          history
                        </SheetTrigger>
                        <SheetContent side="right">
                          <SheetHeader>
                            <SheetTitle>{g.canonical_name}</SheetTitle>
                          </SheetHeader>
                          <HistoryPane matchId={g.match_id} />
                        </SheetContent>
                      </Sheet>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {sorted.map((o, i) => (
                        <a
                          key={o.platform + o.hotel_name}
                          href={o.url ?? "#"}
                          target="_blank"
                          className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors hover:brightness-125"
                          style={{
                            borderColor: i === 0 ? "var(--chart-1)" : "var(--border)",
                            background: i === 0 ? "rgba(63,185,80,0.08)" : "var(--card)",
                          }}
                        >
                          <span className="inline-block w-2 h-2 rounded-full" style={{ background: PLATFORM_COLOR[o.platform] ?? "var(--chart-2)" }} />
                          <span>{o.platform}</span>
                          <span className="mono">{o.price_inr ? fmtInr(o.price_inr) : "—"}</span>
                          {o.rating ? <span className="text-[11px] mono text-muted-foreground">{o.rating}★</span> : null}
                          {i === 0 && <Badge className="text-[10px]">best</Badge>}
                        </a>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </section>
      </div>
    </div>
  );
}

function HistoryPane({ matchId }: { matchId: string }) {
  const [rows, setRows] = useState<{ platform: string; price_inr: number; scraped_at: string }[] | null>(null);
  const [loading, setLoading] = useState(true);
  useState(() => {
    getJSON<{ platform: string; price_inr: number; scraped_at: string }[]>(`/api/travel/history?matchId=${encodeURIComponent(matchId)}`)
      .then((r) => setRows(r))
      .finally(() => setLoading(false));
  });
  if (loading) return <div className="space-y-2 pt-4"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>;
  if (!rows || rows.length === 0) return <p className="text-sm text-muted-foreground pt-4">No history yet.</p>;
  return (
    <div className="pt-4 space-y-1">
      {rows.map((r, i) => (
        <div key={i} className="flex justify-between text-sm mono">
          <span className="text-muted-foreground">{r.platform}</span>
          <span>{fmtInr(r.price_inr)}</span>
          <span className="text-[11px] text-muted-foreground">{r.scraped_at.slice(5, 16)}</span>
        </div>
      ))}
    </div>
  );
}
