import Link from "next/link";
import { ArrowRight, ShieldCheck, Zap, Database, TrendingUp, Hotel, Cpu, Activity, Terminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getJSON, fmtPrice, fmtInr, type OverviewRow, type CollectorRow, type TravelOverview } from "@/lib/api";

export const dynamic = "force-dynamic";

interface AlertRow {
  id: number;
  gpu_model: string;
  kind: string;
  threshold: number;
  triggered_at: string;
  note: string;
}

export default async function Landing() {
  const [overview, collectors, travel, alerts] = await Promise.all([
    getJSON<OverviewRow[]>("/api/overview"),
    getJSON<CollectorRow[]>("/api/collectors"),
    getJSON<TravelOverview>("/api/travel/overview?city=Goa"),
    getJSON<AlertRow[]>("/api/alerts"),
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
    <div className="space-y-24">
      {/* ═══ AURORA HERO ═══ */}
      <section className="relative -mx-6 -mt-10 overflow-hidden rounded-b-3xl">
        {/* layered aurora — raycast-style stacked radials */}
        <div className="absolute inset-0" style={{
          background: [
            "radial-gradient(90% 55% at 50% 30%, rgba(74,222,128,0.13), transparent 62%)",
            "radial-gradient(45% 40% at 18% 22%, rgba(34,211,238,0.09), transparent 65%)",
            "radial-gradient(40% 42% at 84% 20%, rgba(139,92,246,0.10), transparent 60%)",
            "radial-gradient(55% 38% at 68% 42%, rgba(2,96,101,0.10), transparent 66%)",
          ].join(", "),
          backgroundColor: "#08090a",
        }} />
        <div className="absolute inset-0 dotgrid opacity-[0.5] [mask-image:radial-gradient(ellipse_55%_55%_at_50%_32%,black,transparent)]" />
        <div className="relative max-w-3xl mx-auto text-center px-6 pt-24 pb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs mono mb-8"
            style={{ borderColor: "rgba(74,222,128,0.22)", background: "rgba(74,222,128,0.05)", color: "var(--primary)" }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--primary)" }} />
            {activeCollectors} collectors live · {totalListings} listings tracked
          </div>
          <h1 className="text-[52px] md:text-[68px] font-semibold tracking-tighter leading-[0.98]">
            Price intelligence
            <br />
            <span className="text-gradient">that heals itself.</span>
          </h1>
          <p className="mt-6 text-[15px] leading-relaxed max-w-lg mx-auto" style={{ color: "var(--muted-foreground)" }}>
            HYDRA watches GPU prices across three stores and hotel rates across Goa.
            When a site redesigns underneath it, the watchdog detects the break,
            drives Bright Data&apos;s AI Flow to repair the scraper, and verifies the recovery.
          </p>
          <p className="mt-2 text-sm font-medium" style={{ color: "var(--foreground)" }}>
            Unattended.
          </p>
          <div className="mt-9 flex justify-center gap-3">
            <Link href="/travel" className={cn(buttonVariants({ size: "lg" }), "rounded-xl px-6")}>
              Explore live data <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
            <Link href="/chaos" className={cn(buttonVariants({ variant: "secondary", size: "lg" }), "rounded-xl px-6 gap-2")}>
              <Terminal className="h-4 w-4" /> Watch a self-heal
            </Link>
          </div>
        </div>

        {/* terminal receipt card — floats over hero bottom */}
        <div className="relative max-w-xl mx-auto px-6 pb-6">
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "rgba(255,255,255,0.09)", background: "#0c0e12", boxShadow: "0 20px 70px rgba(0,0,0,0.55), 0 0 80px rgba(74,222,128,0.04)" }}>
            <div className="flex items-center gap-1.5 px-3 py-2 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#f87171" }} />
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#fbbf24" }} />
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: "#4ade80" }} />
              <span className="ml-2 text-[10px] mono" style={{ color: "var(--muted-foreground)" }}>hydra — watchdog</span>
            </div>
            <div className="px-4 py-3 text-[11px] mono leading-[1.7]" style={{ color: "var(--muted-foreground)" }}>
              <p><span style={{ color: "var(--destructive)" }}>✗</span> site redesign detected · extraction empty</p>
              <p><span style={{ color: "var(--chart-3)" }}>→</span> incident opened · heal prompt dispatched</p>
              <p><span style={{ color: "var(--chart-3)" }}>→</span> AI Flow refactor · candidate approved</p>
              <p><span style={{ color: "var(--primary)" }}>✓</span> re-run verified · 20/20 rows · <span style={{ color: "var(--foreground)" }}>111s total</span></p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ STATS ═══ */}
      <section className="-mt-10 max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-px rounded-xl overflow-hidden border" style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.05)" }}>
        {[
          { icon: Database, v: String(activeCollectors), l: "collectors" },
          { icon: Activity, v: String(totalListings), l: "listings tracked" },
          { icon: ShieldCheck, v: "7", l: "self-heals logged" },
          { icon: Zap, v: "111s", l: "avg recovery" },
        ].map((s) => (
          <div key={s.l} className="px-4 py-6 text-center" style={{ background: "var(--background)" }}>
            <s.icon className="h-4 w-4 mx-auto mb-2" style={{ color: "var(--primary)" }} />
            <p className="text-[26px] font-semibold tracking-tight mono leading-none">{s.v}</p>
            <p className="text-[11px] mt-1.5" style={{ color: "var(--muted-foreground)" }}>{s.l}</p>
          </div>
        ))}
      </section>

      {/* ═══ LIVE SIGNALS ═══ */}
      {alerts && alerts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-center text-sm font-medium uppercase tracking-[0.2em]" style={{ color: "var(--muted-foreground)" }}>
            Latest signals
          </h2>
          <div className="flex flex-wrap justify-center gap-2">
            {alerts.slice(0, 4).map((a) => (
              <span key={a.id} className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border"
                style={{
                  borderColor: a.kind === "restock" ? "rgba(74,222,128,0.25)" : "rgba(250,204,21,0.25)",
                  background: a.kind === "restock" ? "rgba(74,222,128,0.06)" : "rgba(250,204,21,0.06)",
                  color: "var(--foreground)",
                }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: a.kind === "restock" ? "var(--primary)" : "var(--chart-3)" }} />
                <span className="mono">{a.note}</span>
                <span className="mono text-[10px]" style={{ color: "var(--muted-foreground)" }}>{a.triggered_at.slice(5, 16)}</span>
              </span>
            ))}
          </div>
        </section>
      )}

      {/* ═══ BENTO — HOW IT WORKS ═══ */}
      <section className="grid md:grid-cols-5 gap-3">
        {/* big self-heal card */}
        <Card className="md:col-span-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-56 h-56 rounded-full" style={{ background: "radial-gradient(circle at top right, rgba(74,222,128,0.08), transparent 65%)" }} />
          <CardContent className="pt-6 relative space-y-3">
            <Badge variant="outline" className="mono text-[10px]" style={{ borderColor: "rgba(74,222,128,0.25)", color: "var(--primary)" }}>THE LOOP</Badge>
            <h3 className="text-xl font-medium tracking-tight">Break it. It grows back.</h3>
            <p className="text-sm leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
              We host Voltmart, a store built to be broken. Flip its layout and the pipeline detects
              the dead extraction within minutes, dispatches a plain-language repair to Bright Data&apos;s
              AI Flow, approves the diff, re-runs, and verifies — same Collector ID, nothing downstream touched.
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-1 pt-1 text-xs mono" style={{ color: "var(--muted-foreground)" }}>
              <span>detect →</span><span>diagnose →</span><span>heal →</span><span>verify →</span><span style={{ color: "var(--primary)" }}>close ✓</span>
            </div>
            <Link href="/chaos" className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "rounded-lg mt-1 inline-flex")}>
              Open Chaos Lab
            </Link>
          </CardContent>
        </Card>
        {/* two stacked cards */}
        <div className="md:col-span-2 grid gap-3">
          <Card><CardContent className="pt-6 space-y-2">
            <Database className="h-4 w-4" style={{ color: "var(--primary)" }} />
            <h3 className="font-medium text-sm">Collect</h3>
            <p className="text-sm leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
              Six custom collectors on long-tail targets — no pre-built scraper covers them.
              Built from one-sentence prompts inside the coding agent.
            </p>
          </CardContent></Card>
          <Card><CardContent className="pt-6 space-y-2">
            <ShieldCheck className="h-4 w-4" style={{ color: "var(--primary)" }} />
            <h3 className="font-medium text-sm">Validate</h3>
            <p className="text-sm leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
              Schema + statistics on every run: null-rates, row drift, freshness. Breaches become
              deduplicated incidents with full context.
            </p>
          </CardContent></Card>
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
          <Link href="/health" className="text-xs mono hover:text-foreground transition-colors" style={{ color: "var(--muted-foreground)" }}>all models →</Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {featured.map((r) => (
            <Link key={`${r.gpu_model}-${r.currency}`} href={`/gpu/${encodeURIComponent(r.gpu_model)}`} className="panel panel-hover rounded-xl p-4 group">
              <div className="flex justify-between items-start">
                <span className="font-medium text-sm">{r.gpu_model}</span>
                <Badge variant="secondary" className="mono text-[10px]">{r.currency}</Badge>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-[26px] font-semibold tracking-tight leading-none">{r.currency === "INR" ? fmtInr(r.best_price) : fmtPrice(r.best_price, r.currency)}</span>
                <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>best</span>
              </div>
              <div className="mt-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
                {r.listings} listings · {r.store_count} stores
                <TrendingUp className="inline h-3 w-3 ml-2 opacity-50 group-hover:opacity-100 transition-opacity" />
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
                  <div className="h-14 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${accent}14, transparent 70%)` }}>
                    <Badge variant="outline" className="absolute top-3 left-3 mono text-[10px] capitalize" style={{ borderColor: `${accent}40`, color: accent }}>{h.platform}</Badge>
                  </div>
                  <CardContent className="pt-3 pb-4">
                    <p className="font-medium text-sm leading-tight line-clamp-2 min-h-[2.4em]">{h.hotel_name}</p>
                    <div className="mt-3 flex items-baseline justify-between">
                      <span className="mono text-lg font-semibold">{h.price_inr ? fmtInr(h.price_inr) : "—"}</span>
                      {h.rating && <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>★ {h.rating}</span>}
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
