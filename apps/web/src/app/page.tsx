import Link from "next/link";
import { ArrowRight, ShieldCheck, Zap, Database, TrendingDown, Hotel, Cpu } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getJSON, fmtPrice, fmtInr, type OverviewRow, type CollectorRow, type TravelOverview } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function Landing() {
  const [overview, collectors, travel] = await Promise.all([
    getJSON<OverviewRow[]>("/api/overview"),
    getJSON<CollectorRow[]>("/api/collectors"),
    getJSON<TravelOverview>("/api/travel/overview?city=Goa"),
  ]);

  if (!overview) {
    return (
      <div className="panel p-12 text-center space-y-3">
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Worker unreachable — start it with <span className="mono">npm run worker</span></p>
      </div>
    );
  }

  const usd = overview.filter((r) => r.currency === "USD");
  const eur = overview.filter((r) => r.currency === "EUR");
  const totalListings = overview.reduce((a, r) => a + r.listings, 0);
  const activeCollectors = collectors?.length ?? 0;

  return (
    <div className="space-y-16">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)", background: "linear-gradient(135deg, #10151d 0%, #0a0e14 50%, #0f1a12 100%)" }}>
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #3fb950 1px, transparent 0)", backgroundSize: "24px 24px" }} />
        <div className="relative px-8 md:px-12 py-12 md:py-16">
          <Badge variant="outline" className="mb-4 mono text-[11px] tracking-widest" style={{ borderColor: "rgba(63,185,80,0.3)", color: "var(--primary)" }}>
            ● LIVE · {activeCollectors} COLLECTORS · {totalListings} LISTINGS TRACKED
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.05]">
            Price intelligence<br />
            <span style={{ color: "var(--primary)" }}>that heals itself.</span>
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed max-w-xl" style={{ color: "var(--muted-foreground)" }}>
            HYDRA watches GPU prices across 3 stores and hotel rates across Goa — and when a site redesigns
            and a scraper breaks, it detects, repairs, and verifies itself in under 2 minutes. No selector
            maintenance. Same Collector ID, always.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/travel" className={cn(buttonVariants({ size: "lg" }), "rounded-full px-6")}>
              Explore hotels <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link href="/health" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "rounded-full px-6")}>
              System health
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-2">
            {collectors?.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1.5 text-xs mono px-2.5 py-1 rounded-full border" style={{ borderColor: "var(--border)", background: "rgba(255,255,255,0.04)" }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.open_incidents > 0 ? "var(--destructive)" : "var(--primary)" }} />
                {c.name} · {c.currency}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="grid md:grid-cols-3 gap-4">
        {[
          { icon: Database, title: "Collect", desc: "6 custom Scraper Studio collectors — Discovery on category pages, city hotel listings, and a store we control. One sentence in, structured JSON out." },
          { icon: ShieldCheck, title: "Validate", desc: "Every run is scored: schema, null-rates, row-count drift, freshness. Breaches open deduplicated incidents with full context." },
          { icon: Zap, title: "Self-heal", desc: "Watchdog drives Bright Data's AI Flow: refactor → approve → re-run → verify. 111s proven, zero humans, event-sourced receipts." },
        ].map((s) => (
          <Card key={s.title} className="bg-card">
            <CardContent className="pt-6 space-y-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(63,185,80,0.12)", color: "var(--primary)" }}>
                <s.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-[15px]">{s.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{s.desc}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* GPU SHOWCASE */}
      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(63,185,80,0.12)", color: "var(--primary)" }}><Cpu className="h-4 w-4" /></div>
            <div>
              <h2 className="font-semibold">GPU price intelligence</h2>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Cross-store · multi-currency · price history per model</p>
            </div>
          </div>
          <span className="text-xs mono px-2 py-1 rounded-full" style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}>{usd.length + eur.length} models</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...usd, ...eur].slice(0, 6).map((r) => (
            <Link key={`${r.gpu_model}-${r.currency}`} href={`/gpu/${encodeURIComponent(r.gpu_model)}`} className="group">
              <Card className="h-full hover:border-primary/30 transition-colors">
                <CardContent className="pt-4">
                  <div className="flex justify-between items-start">
                    <span className="font-semibold text-sm">{r.gpu_model}</span>
                    <Badge variant="secondary" className="mono text-[10px]">{r.currency}</Badge>
                  </div>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="text-2xl font-bold tracking-tight" style={{ color: "var(--primary)" }}>{r.currency === "INR" ? fmtInr(r.best_price) : fmtPrice(r.best_price, r.currency)}</span>
                    <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>best</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
                    <span>{r.listings} listings</span><span>·</span><span>{r.store_count} stores</span>
                    <TrendingDown className="ml-auto h-3 w-3 opacity-60 group-hover:opacity-100" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
        <div className="text-center">
          <Link href="/health" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>View all {usd.length + eur.length} models →</Link>
        </div>
      </section>

      {/* TRAVEL TEASER */}
      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(88,166,255,0.12)", color: "var(--chart-2)" }}><Hotel className="h-4 w-4" /></div>
            <div>
              <h2 className="font-semibold">Goa hotel rates — compared</h2>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Starting rate per night · exclusive inventory per platform</p>
            </div>
          </div>
          <Link href="/travel" className={cn(buttonVariants({ size: "sm" }))}>Compare hotels</Link>
        </div>
        {travel && !travel.stale && travel.exclusive.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {travel.exclusive.slice(0, 3).map((h) => (
              <Card key={h.hotel_name} className="overflow-hidden">
                <div className="h-1" style={{ background: h.platform === "fabhotels" ? "#0f6fff" : h.platform === "treebo" ? "#00b386" : "#e23744" }} />
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="mono text-[10px] capitalize">{h.platform}</Badge>
                    {h.rating && <span className="text-xs mono" style={{ color: "var(--muted-foreground)" }}>{h.rating}★</span>}
                  </div>
                  <p className="mt-2 font-medium text-sm leading-tight line-clamp-2">{h.hotel_name}</p>
                  <p className="mt-2 mono text-lg font-bold" style={{ color: "var(--primary)" }}>{h.price_inr ? fmtInr(h.price_inr) : "—"} <span className="text-xs font-normal" style={{ color: "var(--muted-foreground)" }}>/ night</span></p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card><CardContent className="py-8 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>Hotel data warming up — check back in a minute.</CardContent></Card>
        )}
      </section>
    </div>
  );
}
