import Link from "next/link";
import { ArrowRight, ShieldCheck, Zap, Database, TrendingUp, Hotel, Cpu, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
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
      <div className="panel p-12 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>
        Worker unreachable — start it with <span className="mono">npm run worker</span>.
      </div>
    );
  }

  const usd = overview.filter((r) => r.currency === "USD");
  const eur = overview.filter((r) => r.currency === "EUR");
  const totalListings = overview.reduce((a, r) => a + r.listings, 0);
  const activeCollectors = collectors?.length ?? 0;
  const featured = [...usd, ...eur].slice(0, 6);

  return (
    <div className="space-y-20">
      {/* ═══ HERO ═══ */}
      <section className="relative -mx-6 -mt-10 px-6 pt-20 pb-16 overflow-hidden">
        <div className="dotgrid absolute inset-0 [mask-image:radial-gradient(ellipse_60%_60%_at_50%_35%,black,transparent)]" />
        <div className="glow w-[480px] h-[280px] left-1/2 -translate-x-1/2 top-0" style={{ background: "rgba(74,222,128,0.07)" }} />
        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs mono mb-6"
            style={{ borderColor: "rgba(74,222,128,0.25)", background: "rgba(74,222,128,0.06)", color: "var(--primary)" }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--primary)" }} />
            {activeCollectors} collectors live · {totalListings} listings tracked
          </div>
          <h1 className="text-5xl md:text-6xl font-semibold tracking-tighter leading-[1.02]">
            Price intelligence<br />
            <span className="text-gradient">that heals itself.</span>
          </h1>
          <p className="mt-6 text-base leading-relaxed max-w-xl mx-auto" style={{ color: "var(--muted-foreground)" }}>
            HYDRA watches GPU prices across three stores and hotel rates across Goa — and when a site
            redesigns under it, the watchdog detects the break, drives Bright Data&apos;s AI Flow to repair
            the scraper, and verifies the recovery. Unattended.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/travel" className={cn(buttonVariants({ size: "lg" }), "rounded-lg px-5")}>
              Compare hotels <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
            <Link href="/chaos" className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "rounded-lg px-5")}>
              Watch it self-heal
            </Link>
          </div>
        </div>

        {/* Stats band */}
        <div className="relative max-w-3xl mx-auto mt-14 grid grid-cols-2 md:grid-cols-4 gap-px rounded-xl overflow-hidden border" style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.04)" }}>
          {[
            { icon: Database, v: String(activeCollectors), l: "collectors" },
            { icon: Activity, v: String(totalListings), l: "listings tracked" },
            { icon: ShieldCheck, v: "7", l: "self-heals logged" },
            { icon: Zap, v: "111s", l: "avg recovery" },
          ].map((s) => (
            <div key={s.l} className="px-4 py-5 text-center" style={{ background: "var(--background)" }}>
              <s.icon className="h-4 w-4 mx-auto mb-2" style={{ color: "var(--primary)" }} />
              <p className="text-2xl font-semibold tracking-tight mono">{s.v}</p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section className="space-y-6">
        <h2 className="text-center text-sm font-medium uppercase tracking-[0.2em]" style={{ color: "var(--muted-foreground)" }}>
          How it works
        </h2>
        <div className="grid md:grid-cols-3 gap-px rounded-xl overflow-hidden border" style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.05)" }}>
          {[
            { icon: Database, step: "01", title: "Collect", desc: "Six custom Scraper Studio collectors — Discovery on category pages, city hotel listings, a store we control. Built by one-sentence prompts from the coding agent." },
            { icon: ShieldCheck, step: "02", title: "Validate", desc: "Every run scored against schema and statistics: null-rates, row-count drift, freshness, price sanity. Breaches open deduplicated incidents." },
            { icon: Zap, step: "03", title: "Self-heal", desc: "The watchdog drives Bright Data's AI Flow end-to-end: refactor → approve → re-run → verify. Same Collector ID. Event-sourced receipts for every step." },
          ].map((s) => (
            <div key={s.title} className="p-6 space-y-3" style={{ background: "var(--background)" }}>
              <div className="flex items-center justify-between">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center border" style={{ background: "rgba(74,222,128,0.08)", borderColor: "rgba(74,222,128,0.15)", color: "var(--primary)" }}>
                  <s.icon className="h-4.5 w-4.5" />
                </div>
                <span className="mono text-xs" style={{ color: "var(--muted-foreground)" }}>{s.step}</span>
              </div>
              <h3 className="font-medium">{s.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ GPU SHOWCASE ═══ */}
      <section className="space-y-5">
        <div className="flex items-end justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center border" style={{ background: "rgba(74,222,128,0.08)", borderColor: "rgba(74,222,128,0.15)", color: "var(--primary)" }}>
              <Cpu className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-medium tracking-tight">GPU price intelligence</h2>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Newegg · B&H Photo · Mindfactory (DE)</p>
            </div>
          </div>
          <Link href="/health" className="text-xs mono hover:text-foreground transition-colors" style={{ color: "var(--muted-foreground)" }}>
            all models →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {featured.map((r) => (
            <Link key={`${r.gpu_model}-${r.currency}`} href={`/gpu/${encodeURIComponent(r.gpu_model)}`}
              className="panel panel-hover rounded-xl p-4 group">
              <div className="flex justify-between items-start">
                <span className="font-medium text-sm">{r.gpu_model}</span>
                <Badge variant="secondary" className="mono text-[10px]">{r.currency}</Badge>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-[26px] font-semibold tracking-tight leading-none">
                  {r.currency === "INR" ? fmtInr(r.best_price) : fmtPrice(r.best_price, r.currency)}
                </span>
                <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>best</span>
              </div>
              <div className="mt-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
                {r.listings} listings · {r.store_count} store{r.store_count > 1 ? "s" : ""} · up to {fmtPrice(r.max_price, r.currency)}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ═══ TRAVEL TEASER ═══ */}
      <section className="space-y-5">
        <div className="flex items-end justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center border" style={{ background: "rgba(96,165,250,0.08)", borderColor: "rgba(96,165,250,0.15)", color: "var(--chart-2)" }}>
              <Hotel className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-medium tracking-tight">Goa hotel rates</h2>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Treebo · FabHotels · starting rate per night</p>
            </div>
          </div>
          <Link href="/travel" className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "rounded-lg")}>
            Compare hotels <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </div>
        {travel && !travel.stale && travel.exclusive.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {travel.exclusive.slice(0, 3).map((h) => {
              const accent = h.platform === "fabhotels" ? "#60a5fa" : h.platform === "treebo" ? "#4ade80" : "#fb7185";
              return (
                <Card key={h.hotel_name} className="overflow-hidden panel-hover">
                  <div className="h-16 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${accent}14, transparent 70%)` }}>
                    <div className="absolute inset-0 dotgrid opacity-40" />
                    <Badge variant="outline" className="absolute top-3 left-3 mono text-[10px] capitalize" style={{ borderColor: `${accent}40`, color: accent }}>
                      {h.platform}
                    </Badge>
                  </div>
                  <CardContent className="pt-3 pb-4">
                    <p className="font-medium text-sm leading-tight line-clamp-2 min-h-[2.4em]">{h.hotel_name}</p>
                    <div className="mt-3 flex items-baseline justify-between">
                      <span className="mono text-lg font-semibold">{h.price_inr ? fmtInr(h.price_inr) : "—"}</span>
                      {h.rating && (
                        <span className="inline-flex items-center gap-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
                          <span style={{ color: "#fbbf24" }}>★</span> {h.rating}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card><CardContent className="py-8 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>
            Hotel data warming up — check back in a minute.
          </CardContent></Card>
        )}
      </section>
    </div>
  );
}
