"use client";

import { useMemo, useState } from "react";
import { Star, ExternalLink, Search, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { getJSON, fmtInr, type TravelOverview, type TravelOffer } from "@/lib/api";

const PLATFORM_META: Record<string, { color: string; label: string }> = {
  oyo: { color: "#e23744", label: "OYO" },
  fabhotels: { color: "#0f6fff", label: "FabHotels" },
  treebo: { color: "#00b386", label: "Treebo" },
};

function Stars({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>No rating</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {rating.toFixed(1)}
    </span>
  );
}

function PlatformChip({ offer, isBest }: { offer: TravelOffer; isBest?: boolean }) {
  const meta = PLATFORM_META[offer.platform] ?? { color: "var(--chart-2)", label: offer.platform };
  return (
    <a
      href={offer.url ?? "#"}
      target="_blank"
      className="flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all hover:scale-[1.01]"
      style={{
        borderColor: isBest ? "var(--primary)" : "var(--border)",
        background: isBest ? "rgba(63,185,80,0.08)" : "var(--card)",
        boxShadow: isBest ? "0 0 0 1px rgba(63,185,80,0.15)" : "none",
      }}
    >
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: meta.color }} />
      <span className="font-medium mono text-xs">{meta.label}</span>
      <span className="mono font-bold">{offer.price_inr ? fmtInr(offer.price_inr) : "—"}</span>
      {isBest && <Badge className="text-[10px] ml-1 bg-primary text-primary-foreground">Best</Badge>}
      <ExternalLink className="h-3 w-3 ml-auto opacity-40" />
    </a>
  );
}

export default function TravelView({ data: initial }: { data: TravelOverview }) {
  const [q, setQ] = useState("");
  const [budget, setBudget] = useState<[number, number]>([0, 5000]);
  const [minRating, setMinRating] = useState("0");
  const [sort, setSort] = useState("price-asc");

  const filteredGroups = useMemo(() => {
    const minR = Number(minRating);
    const groups = initial.groups
      .map((g) => ({
        ...g,
        offers: g.offers.filter(
          (o) =>
            (!q || g.canonical_name.toLowerCase().includes(q.toLowerCase()) || o.hotel_name.toLowerCase().includes(q.toLowerCase())) &&
            (o.price_inr ?? 0) >= budget[0] &&
            (o.price_inr ?? 0) <= budget[1] &&
            (o.rating ?? 0) >= minR
        ),
      }))
      .filter((g) => g.offers.length > 0);
    if (sort === "price-asc") groups.sort((a, b) => Math.min(...a.offers.map((o) => o.price_inr ?? 9e9)) - Math.min(...b.offers.map((o) => o.price_inr ?? 9e9)));
    if (sort === "price-desc") groups.sort((a, b) => Math.max(...b.offers.map((o) => o.price_inr ?? 0)) - Math.max(...a.offers.map((o) => o.price_inr ?? 0)));
    return groups;
  }, [initial, q, budget, minRating, sort]);

  const filteredExclusive = useMemo(() => {
    const minR = Number(minRating);
    let list = initial.exclusive.filter(
      (o) =>
        (!q || o.hotel_name.toLowerCase().includes(q.toLowerCase())) &&
        (o.price_inr ?? 0) >= budget[0] &&
        (o.price_inr ?? 0) <= budget[1] &&
        (o.rating ?? 0) >= minR
    );
    if (sort === "price-asc") list = [...list].sort((a, b) => (a.price_inr ?? 9e9) - (b.price_inr ?? 9e9));
    if (sort === "price-desc") list = [...list].sort((a, b) => (b.price_inr ?? 0) - (a.price_inr ?? 0));
    return list;
  }, [initial, q, budget, minRating, sort]);

  if (initial.stale) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Hotels in Goa</h1>
        <Card><CardContent className="py-16 text-center space-y-3">
          <p className="font-medium">Warming up hotel data…</p>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Collectors are running — this page will populate in a minute.</p>
        </CardContent></Card>
      </div>
    );
  }

  const exclusiveByPlatform = (() => {
    const m = new Map<string, typeof filteredExclusive>();
    for (const o of filteredExclusive) m.set(o.platform, [...(m.get(o.platform) ?? []), o]);
    return [...m.entries()];
  })();

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Hotels in {initial.city}</h1>
        <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
          Starting rate per night · {initial.groups.length + filteredExclusive.length} properties · collected{" "}
          <span className="mono text-xs">{initial.as_of.slice(11, 19)}</span>
        </p>
      </div>

      {/* SEARCH + FILTERS */}
      <Card>
        <CardContent className="pt-4 pb-4 space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--muted-foreground)" }} />
              <Input placeholder="Search hotels — e.g. 'Baga beach resort'" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
            </div>
            <Select value={sort} onValueChange={(v) => setSort(v as string)}>
              <SelectTrigger className="w-full md:w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="price-asc">Price: low → high</SelectItem>
                <SelectItem value="price-desc">Price: high → low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex items-center gap-2 text-xs mono" style={{ color: "var(--muted-foreground)" }}>
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Budget ≤ {fmtInr(budget[1])}
            </div>
            <Slider value={budget} min={0} max={5000} step={100} onValueChange={(v) => setBudget(v as [number, number])} className="flex-1 max-w-xs" />
            <div className="flex gap-1.5">
              {[
                { v: "0", l: "All" },
                { v: "3", l: "3★+" },
                { v: "4", l: "4★+" },
              ].map((r) => (
                <Button key={r.v} size="sm" variant={minRating === r.v ? "default" : "secondary"} onClick={() => setMinRating(r.v)} className="rounded-full h-7 text-xs">
                  {r.l}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* MATCHED COMPARISON */}
      {filteredGroups.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: "var(--primary)" }} />
            Same hotel — compare platforms ({filteredGroups.length})
          </h2>
          {filteredGroups.map((g) => {
            const sorted = [...g.offers].sort((a, b) => (a.price_inr ?? 9e9) - (b.price_inr ?? 9e9));
            const saving = sorted.length > 1 && sorted[0].price_inr && sorted[sorted.length - 1].price_inr
              ? sorted[sorted.length - 1].price_inr! - sorted[0].price_inr!
              : 0;
            return (
              <Card key={g.match_id} className="overflow-hidden">
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold leading-tight">{g.canonical_name}</p>
                      <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
                        Found on {g.offers.length} platforms
                        {saving > 0 && <span style={{ color: "var(--primary)" }}> · Save {fmtInr(saving)} on cheapest</span>}
                      </p>
                    </div>
                    <Sheet>
                      <SheetTrigger className="text-xs mono underline underline-offset-2 cursor-pointer shrink-0" style={{ color: "var(--muted-foreground)" }}>
                        History
                      </SheetTrigger>
                      <SheetContent side="right">
                        <SheetHeader><p className="font-semibold pr-6">{g.canonical_name}</p></SheetHeader>
                        <HistoryPane matchId={g.match_id} />
                      </SheetContent>
                    </Sheet>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {sorted.map((o, i) => (
                      <PlatformChip key={o.platform + o.hotel_name} offer={o} isBest={i === 0} />
                    ))}
                  </div>
                  <div className="mt-3 flex gap-3 text-xs" style={{ color: "var(--muted-foreground)" }}>
                    {sorted.map((o) => (
                      <span key={o.platform} className="inline-flex items-center gap-1">
                        {o.rating ? <Stars rating={o.rating} /> : <span>No rating</span>}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>
      )}

      {/* EXCLUSIVE — the main event when matches are sparse */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          Exclusive listings <Badge variant="secondary" className="mono text-[11px]">{filteredExclusive.length} hotels</Badge>
          <span className="text-xs font-normal" style={{ color: "var(--muted-foreground)" }}>— only on one platform</span>
        </h2>
        {filteredExclusive.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>No hotels match these filters — try widening the budget.</CardContent></Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredExclusive.map((o) => {
              const meta = PLATFORM_META[o.platform] ?? { color: "var(--border)", label: o.platform };
              return (
                <Card key={o.hotel_name + o.platform} className="overflow-hidden group hover:border-primary/20 transition-colors flex flex-col">
                  <div className="h-1" style={{ background: meta.color }} />
                  <CardContent className="pt-4 flex-1 flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: meta.color }} />
                      <Badge variant="outline" className="mono text-[10px] capitalize">{meta.label}</Badge>
                      <span className="ml-auto"><Stars rating={o.rating} /></span>
                    </div>
                    <a href={o.url ?? "#"} target="_blank" className="mt-2 font-medium text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                      {o.hotel_name}
                    </a>
                    <div className="mt-auto pt-3 flex items-end justify-between">
                      <div>
                        <p className="mono text-xl font-bold tracking-tight" style={{ color: "var(--primary)" }}>{o.price_inr ? fmtInr(o.price_inr) : "—"}</p>
                        <p className="text-[11px] mono" style={{ color: "var(--muted-foreground)" }}>per night · starting rate</p>
                      </div>
                      <a href={o.url ?? "#"} target="_blank" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full")}>
                        View <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <p className="text-xs text-center mono" style={{ color: "var(--muted-foreground)" }}>
        Starting rates collected {initial.as_of.slice(0, 16)} · not date-specific availability
      </p>
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
  if (loading) return <div className="space-y-2 pt-4"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>;
  if (!rows || rows.length === 0) return <p className="text-sm pt-4" style={{ color: "var(--muted-foreground)" }}>No history yet.</p>;
  return (
    <div className="pt-4 space-y-1">
      {rows.map((r, i) => (
        <div key={i} className="flex justify-between text-sm mono">
          <span style={{ color: "var(--muted-foreground)" }}>{r.platform}</span>
          <span>{fmtInr(r.price_inr)}</span>
          <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{r.scraped_at.slice(5, 16)}</span>
        </div>
      ))}
    </div>
  );
}
