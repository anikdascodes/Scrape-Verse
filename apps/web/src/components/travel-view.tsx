"use client";

import { useMemo, useState } from "react";
import { Search, MapPin, Calendar, Users, Star, ExternalLink, SlidersHorizontal, ArrowUpDown, BedDouble } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { getJSON, WORKER_URL, fmtInr, type TravelOverview, type TravelOffer } from
"@/lib/api";

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
  const [data, setData] = useState<TravelOverview>(initial);
  const [q, setQ] = useState("");
  const [city, setCity] = useState(initial.city);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState("2");
  const [budget, setBudget] = useState<[number, number]>([0, 5000]);
  const [minRating, setMinRating] = useState("0");
  const [sort, setSort] = useState("price-asc");
  const [liveSearching, setLiveSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchNote, setSearchNote] = useState<string | null>(null);

  const allHotels: (TravelOffer & { isExclusive: boolean; matchId?: string })[] = useMemo(() => {
    const list: (TravelOffer & { isExclusive: boolean; matchId?: string })[] = [];
    for (const g of data.groups) {
      for (const o of g.offers) list.push({ ...o, isExclusive: false, matchId: g.match_id });
    }
    for (const o of data.exclusive) list.push({ ...o, isExclusive: true });
    return list;
  }, [data]);

  const cityQuery = city.trim().toLowerCase();
  const isDefaultCity = !cityQuery || cityQuery === data.city.toLowerCase();
  const filtered = useMemo(() => {
    const minR = Number(minRating);
    let list = allHotels.filter(
      (o) =>
        (!q || o.hotel_name.toLowerCase().includes(q.toLowerCase())) &&
        (isDefaultCity || o.hotel_name.toLowerCase().includes(cityQuery) || o.hotel_name.toLowerCase().includes(cityQuery.split(",")[0].trim())) &&
        (o.price_inr ?? 0) >= budget[0] &&
        (o.price_inr ?? 0) <= budget[1] &&
        (o.rating ?? 0) >= minR
    );
    if (sort === "price-asc") list = [...list].sort((a, b) => (a.price_inr ?? 9e9) - (b.price_inr ?? 9e9));
    if (sort === "price-desc") list = [...list].sort((a, b) => (b.price_inr ?? 0) - (a.price_inr ?? 0));
    if (sort === "rating-desc") list = [...list].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    return list;
  }, [allHotels, q, budget, minRating, sort, cityQuery, isDefaultCity]);

  async function runLiveSearch(target: string) {
    const t = target.trim();
    if (!t || liveSearching) return;
    setLiveSearching(true);
    setSearchError(null);
    setSearchNote(null);
    const apply = (fresh: TravelOverview) => {
      setCity(t);
      setQ("");
      setData(fresh);
    };
    try {
      const res = await fetch(`${WORKER_URL}/api/travel/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city: t }),
      });
      const summary = await res.json();
      if (!res.ok) throw new Error(summary.error ?? "search failed");
      setSearchNote(`Collecting "${t}" live — Bright Data snapshots in flight (~90s).`);
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 8000));
        const fresh = await getJSON<TravelOverview>(`/api/travel/overview?city=${encodeURIComponent(t)}`);
        if (fresh && fresh.groups.length + fresh.exclusive.length > 0) {
          setSearchNote(null);
          apply(fresh);
          return;
        }
      }
      const last = await getJSON<TravelOverview>(`/api/travel/overview?city=${encodeURIComponent(t)}`);
      setSearchNote(null);
      if (last && last.groups.length + last.exclusive.length > 0) {
        apply(last);
      } else {
        setSearchError(`No rooms indexed for ${t} yet — give it a minute and search again.`);
      }
    } catch (e) {
      setSearchNote(null);
      setSearchError(e instanceof Error ? e.message : String(e));
    } finally {
      setLiveSearching(false);
    }
  }

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

  const filteredExclusive = grouped.exclusive;

  if (data.stale) {
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
              {filtered.length} hotels · {data.city}
            </span>
          </div>
          <div className="px-4 md:px-5 pt-4 pb-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-[1.5fr_1fr_1fr_0.9fr_auto] gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}><MapPin className="h-3 w-3" /> Where to?</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--muted-foreground)" }} />
                  <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") runLiveSearch(city); }}
                  placeholder="Goa, Mumbai, Kolkata…"
                  className="pl-9 h-11"
                />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}><Calendar className="h-3 w-3" /> Check-in</label>
                <Input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="h-11" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}><Calendar className="h-3 w-3" /> Check-out</label>
                <Input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="h-11" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}><Users className="h-3 w-3" /> Guests</label>
                <Select value={guests} onValueChange={(v) => setGuests(v as string)}>
                  <SelectTrigger size="sm" className="h-11 w-full data-[size=sm]:h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 guest</SelectItem>
                    <SelectItem value="2">2 guests</SelectItem>
                    <SelectItem value="3">3 guests</SelectItem>
                    <SelectItem value="4">4 guests</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button className="h-11 px-6 rounded-xl w-full md:w-auto" onClick={() => runLiveSearch(city)} disabled={liveSearching}>
                  {liveSearching ? (
                    <><span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />Scraping…</>
                  ) : (
                    <><Search className="h-4 w-4 mr-2" /> Search live</>
                  )}
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
              <span>Live-scrape a city:</span>
              {["Kolkata", "New Delhi", "Jaipur", "Mumbai"].map((c) => (
                <button key={c} onClick={() => runLiveSearch(c)} disabled={liveSearching}
                  className="px-2 py-1 rounded-full border transition-colors disabled:opacity-50 hover:bg-secondary"
                  style={{ borderColor: "var(--border)" }}>
                  {c}
                </button>
              ))}
              <button type="button" onClick={() => setCity("Baga")} disabled={liveSearching}
                className="px-2 py-1 rounded-full border transition-colors disabled:opacity-50 hover:bg-secondary"
                style={{ borderColor: "var(--border)" }}>
                Baga area
              </button>
              <span>· or type any Indian city above and press Enter</span>
              {searchNote && <span style={{ color: "var(--green)" }}>· {searchNote}</span>}
              {searchError && <span style={{ color: "var(--destructive)" }}>· {searchError}</span>}
            </div>
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

      {/* EXCLUSIVE GRID */}
      <section className="space-y-3">
        {filteredExclusive.length === 0 && !isDefaultCity && !liveSearching ? (
          /* New city with no data yet — offer to scrape it live */
          <Card><CardContent className="py-12 text-center space-y-4">
            <p className="font-medium">No data for <span className="text-gradient font-semibold">{city}</span> yet.</p>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              HYDRA can scrape Treebo and FabHotels for this city right now — it takes about two minutes.
            </p>
            <Button onClick={() => runLiveSearch(city)} disabled={liveSearching} className="rounded-lg">
              {liveSearching ? "Scraping…" : "Scrape it live"}
            </Button>
          </CardContent></Card>
        ) : (
          <>
            <h2 className="text-sm font-semibold flex items-center gap-2">
              Exclusive listings <Badge variant="secondary" className="mono text-[11px]">{filteredExclusive.length} hotels</Badge>
              <span className="text-xs font-normal" style={{ color: "var(--muted-foreground)" }}>— only on one platform</span>
            </h2>
            {filteredExclusive.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>
                No hotels match these filters — try widening the budget.
              </CardContent></Card>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredExclusive.map((o) => {
                  const meta = PLATFORM_META[o.platform] ?? { color: "var(--border)", label: o.platform };
                  return (
                    <Card key={o.hotel_name + o.platform} className="overflow-hidden group hover:border-primary/20 transition-colors flex flex-col">
                      <div className="h-32 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${meta.color}22 0%, var(--card) 70%)` }}>
                        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #ffffff 1px, transparent 0)", backgroundSize: "18px 18px" }} />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <BedDouble className="h-10 w-10" style={{ color: `${meta.color}55` }} />
                        </div>
                        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium" style={{ background: meta.color, color: "white" }}>
                          <span className="w-1.5 h-1.5 rounded-full bg-white/80" /> {meta.label}
                        </div>
                        <div className="absolute top-3 right-3"><Stars rating={o.rating} /></div>
                      </div>
                      <CardContent className="pt-4 flex-1 flex flex-col">
                        <a href={o.url ?? "#"} target="_blank" className="font-medium text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                          {o.hotel_name}
                        </a>
                        <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
                          <MapPin className="h-3 w-3" /> {data.city} · {o.platform}
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
          </>
        )}
      </section>

      <p className="text-xs text-center mono" style={{ color: "var(--muted-foreground)" }}>
        Starting rates collected {data.as_of.slice(0, 16)} · {data.groups.length} matched · {data.exclusive.length} exclusive · not date-specific availability
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
