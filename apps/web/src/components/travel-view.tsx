"use client";

import { useMemo, useState } from "react";
import { Search, MapPin, Calendar, Users, Star, ExternalLink, SlidersHorizontal, ArrowUpDown } from "lucide-react";
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

const PLATFORM_META: Record<string, { color: string; label: string; shortLabel: string }> = {
  oyo: { color: "#e23744", label: "OYO", shortLabel: "OYO" },
  fabhotels: { color: "#0f6fff", label: "FabHotels", shortLabel: "Fab" },
  treebo: { color: "#00b386", label: "Treebo", shortLabel: "Treebo" },
};

function Stars({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}>No rating</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded" style={{ background: "rgba(251,191,36,0.15)", color: "#fbbf24" }}>
      <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {rating.toFixed(1)}
    </span>
  );
}

export default function TravelView({ data: initial }: { data: TravelOverview }) {
  const [q, setQ] = useState("");
  const [city, setCity] = useState(initial.city);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState("2");
  const [budget, setBudget] = useState<[number, number]>([0, 5000]);
  const [minRating, setMinRating] = useState("0");
  const [sort, setSort] = useState("price-asc");

  const allHotels: (TravelOffer & { isExclusive: boolean; matchId?: string })[] = useMemo(() => {
    const list: (TravelOffer & { isExclusive: boolean; matchId?: string })[] = [];
    for (const g of initial.groups) {
      for (const o of g.offers) list.push({ ...o, isExclusive: false, matchId: g.match_id });
    }
    for (const o of initial.exclusive) list.push({ ...o, isExclusive: true });
    return list;
  }, [initial]);

  const filtered = useMemo(() => {
    const minR = Number(minRating);
    let list = allHotels.filter(
      (o) =>
        (!q || o.hotel_name.toLowerCase().includes(q.toLowerCase())) &&
        (o.price_inr ?? 0) >= budget[0] &&
        (o.price_inr ?? 0) <= budget[1] &&
        (o.rating ?? 0) >= minR &&
        (!city || initial.city.toLowerCase() === city.toLowerCase())
    );
    if (sort === "price-asc") list = [...list].sort((a, b) => (a.price_inr ?? 9e9) - (b.price_inr ?? 9e9));
    if (sort === "price-desc") list = [...list].sort((a, b) => (b.price_inr ?? 0) - (a.price_inr ?? 0));
    if (sort === "rating-desc") list = [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    return list;
  }, [allHotels, q, budget, minRating, sort, city, initial.city]);

  // Group filtered hotels by matchId for side-by-side comparison
  const grouped = useMemo(() => {
    const byMatch = new Map<string, typeof filtered>();
    const exclusive: typeof filtered = [];
    for (const h of filtered) {
      if (h.matchId) {
        const arr = byMatch.get(h.matchId) ?? [];
        arr.push(h);
        byMatch.set(h.matchId, arr);
      } else {
        exclusive.push(h);
      }
    }
    return { matched: [...byMatch.values()], exclusive };
  }, [filtered]);

  if (initial.stale) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Hotels</h1>
        <Card><CardContent className="py-16 text-center space-y-3">
          <p className="font-medium">Warming up hotel data…</p>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Collectors are running — this page will populate in a minute.</p>
        </CardContent></Card>
      </div>
    );
  }

  const platforms = ["treebo", "fabhotels", "oyo"];

  return (
    <div className="space-y-6">
      {/* SEARCH HEADER — like a real booking site */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="px-5 py-4 flex items-center gap-2 border-b" style={{ borderColor: "var(--border)" }}>
            <Search className="h-5 w-5" style={{ color: "var(--primary)" }} />
            <h1 className="font-bold text-lg">Find your stay</h1>
            <span className="ml-auto text-xs mono px-2 py-1 rounded-full" style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}>
              {filtered.length} hotels · {initial.city}
            </span>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr_0.7fr_auto] gap-3 items-end">
            <div className="space-y-1.5">
              <label className="text-xs font-medium flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}><MapPin className="h-3 w-3" /> Where to?</label>
              <div className="relative">
                <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--muted-foreground)" }} />
                <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Goa" className="pl-8" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}><Calendar className="h-3 w-3" /> Check-in</label>
              <Input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}><Calendar className="h-3 w-3" /> Check-out</label>
              <Input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}><Users className="h-3 w-3" /> Guests</label>
              <Select value={guests} onValueChange={(v) => setGuests(v as string)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 guest</SelectItem>
                  <SelectItem value="2">2 guests</SelectItem>
                  <SelectItem value="3">3 guests</SelectItem>
                  <SelectItem value="4">4 guests</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="h-9 px-6 rounded-full w-full md:w-auto">
              <Search className="h-4 w-4 mr-2" /> Search
            </Button>
          </div>
          <div className="px-4 pb-3 flex flex-wrap gap-2 items-center text-xs" style={{ color: "var(--muted-foreground)" }}>
            <span>Try:</span>
            <button onClick={() => setQ("Baga")} className="px-2 py-1 rounded-full border hover:bg-secondary transition-colors" style={{ borderColor: "var(--border)" }}>Baga</button>
            <button onClick={() => setQ("Calangute")} className="px-2 py-1 rounded-full border hover:bg-secondary transition-colors" style={{ borderColor: "var(--border)" }}>Calangute</button>
            <button onClick={() => setBudget([0, 2000])} className="px-2 py-1 rounded-full border hover:bg-secondary transition-colors" style={{ borderColor: "var(--border)" }}>Under ₹2k</button>
          </div>
        </CardContent>
      </Card>

      {/* FILTER BAR */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs mono px-3 py-2 rounded-full border" style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--muted-foreground)" }}>
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Budget ≤ {fmtInr(budget[1])}
        </div>
        <Slider value={budget} min={0} max={5000} step={100} onValueChange={(v) => setBudget(v as [number, number])} className="w-40" />
        <div className="flex gap-1.5">
          {[
            { v: "0", l: "All ratings" },
            { v: "3", l: "3★+" },
            { v: "4", l: "4★+" },
          ].map((r) => (
            <Button key={r.v} size="sm" variant={minRating === r.v ? "default" : "secondary"} onClick={() => setMinRating(r.v)} className="rounded-full h-7 text-xs">
              {r.l}
            </Button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <ArrowUpDown className="h-3.5 w-3.5" style={{ color: "var(--muted-foreground)" }} />
          <Select value={sort} onValueChange={(v) => setSort(v as string)}>
            <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="price-asc">Price: low → high</SelectItem>
              <SelectItem value="price-desc">Price: high → low</SelectItem>
              <SelectItem value="rating-desc">Rating: high → low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* SIDE-BY-SIDE COMPARISON — matched hotels */}
      {grouped.matched.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: "var(--primary)" }} />
            Same hotel — compare platforms ({grouped.matched.length})
          </h2>
          {grouped.matched.map((offers) => {
            const sorted = [...offers].sort((a, b) => (a.price_inr ?? 9e9) - (b.price_inr ?? 9e9));
            const cheapest = sorted[0];
            const saving = sorted.length > 1 && cheapest.price_inr && sorted[sorted.length - 1].price_inr ? sorted[sorted.length - 1].price_inr! - cheapest.price_inr! : 0;
            return (
              <Card key={offers[0].matchId} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold leading-tight">{offers[0].hotel_name}</p>
                        <p className="text-xs mt-1 flex items-center gap-2" style={{ color: "var(--muted-foreground)" }}>
                          Found on {offers.length} platforms {saving > 0 && <span style={{ color: "var(--primary)" }}>· Save {fmtInr(saving)} on cheapest</span>}
                        </p>
                      </div>
                      <Sheet>
                        <SheetTrigger className="text-xs mono underline underline-offset-2 shrink-0 cursor-pointer" style={{ color: "var(--muted-foreground)" }}>
                          History
                        </SheetTrigger>
                        <SheetContent side="right">
                          <SheetHeader><p className="font-semibold pr-6">{offers[0].hotel_name}</p></SheetHeader>
                          <HistoryPane matchId={offers[0].matchId!} />
                        </SheetContent>
                      </Sheet>
                    </div>
                  </div>
                  {/* Side-by-side platform columns */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x" style={{ borderColor: "var(--border)", borderTop: "1px solid var(--border)" }}>
                    {platforms.map((plat) => {
                      const offer = offers.find((o) => o.platform === plat);
                      const meta = PLATFORM_META[plat] ?? { color: "var(--border)", label: plat };
                      const isBest = offer && cheapest && offer.platform === cheapest.platform;
                      return (
                        <div key={plat} className="px-5 py-4 flex flex-col gap-2" style={{ background: isBest ? "rgba(63,185,80,0.06)" : "transparent" }}>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
                            <span className="text-xs font-medium mono">{meta.label}</span>
                            {isBest && <Badge className="text-[10px] ml-auto bg-primary text-primary-foreground">Best</Badge>}
                          </div>
                          {offer ? (
                            <>
                              <p className="mono text-xl font-bold tracking-tight" style={{ color: isBest ? "var(--primary)" : "var(--foreground)" }}>{fmtInr(offer.price_inr!)}</p>
                              <p className="text-[11px] mono" style={{ color: "var(--muted-foreground)" }}>per night · starting rate</p>
                              <div className="mt-1"><Stars rating={offer.rating} /></div>
                              <a href={offer.url ?? "#"} target="_blank" className={cn(buttonVariants({ variant: isBest ? "default" : "outline", size: "sm" }), "rounded-full mt-2 w-full justify-center")}>
                                View <ExternalLink className="ml-1 h-3 w-3" />
                              </a>
                            </>
                          ) : (
                            <p className="text-sm py-6 text-center" style={{ color: "var(--muted-foreground)" }}>Not listed</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>
      )}

      {/* EXCLUSIVE GRID — now with proper search + side-by-side price blocks */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          {grouped.matched.length > 0 ? "Also" : "All"} exclusive — only on one platform
          <Badge variant="secondary" className="mono text-[11px]">{grouped.exclusive.length} hotels</Badge>
        </h2>
        {grouped.exclusive.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>
            {q || budget[1] < 5000 || minRating !== "0" ? "No hotels match these filters — try widening the budget." : "No exclusive listings right now."}
          </CardContent></Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {grouped.exclusive.map((o) => {
              const meta = PLATFORM_META[o.platform] ?? { color: "var(--border)", label: o.platform };
              return (
                <Card key={o.hotel_name + o.platform} className="overflow-hidden group hover:border-primary/20 transition-colors flex flex-col">
                  <div className="h-32 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${meta.color}18, var(--card))` }}>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-4xl opacity-10">🏨</span>
                    </div>
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium" style={{ background: meta.color, color: "white" }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-white/80" /> {meta.label}
                    </div>
                    <div className="absolute top-3 right-3"><Stars rating={o.rating} /></div>
                    <div className="absolute bottom-3 left-3 right-3 flex gap-1.5">
                      <span className="text-[10px] mono px-1.5 py-0.5 rounded" style={{ background: "rgba(0,0,0,0.6)", color: "white" }}>Only on {meta.label}</span>
                    </div>
                  </div>
                  <CardContent className="pt-4 flex-1 flex flex-col">
                    <a href={o.url ?? "#"} target="_blank" className="font-medium text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                      {o.hotel_name}
                    </a>
                    <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
                      <MapPin className="h-3 w-3" /> Goa · {o.platform}
                    </p>
                    <div className="mt-auto pt-4 flex items-end justify-between">
                      <div>
                        <p className="mono text-xl font-bold tracking-tight" style={{ color: "var(--primary)" }}>{o.price_inr ? fmtInr(o.price_inr) : "—"}</p>
                        <p className="text-[11px] mono" style={{ color: "var(--muted-foreground)" }}>per night · starting rate</p>
                      </div>
                      <a href={o.url ?? "#"} target="_blank" className={cn(buttonVariants({ size: "sm" }), "rounded-full")}>
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
        Starting rates collected {initial.as_of.slice(0, 16)} · {initial.groups.length} matched · {initial.exclusive.length} exclusive · not date-specific availability
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
