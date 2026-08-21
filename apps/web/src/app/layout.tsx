import type { Metadata } from "next";
import Link from "next/link";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import SiteNav from "@/components/site-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "HYDRA — self-healing price intelligence",
  description:
    "Cross-store GPU prices and Indian hotel rate comparison on Bright Data Scraper Studio, with a watchdog that detects breakage and self-heals scrapers automatically.",
};

const nav = [
  { href: "/", label: "Overview" },
  { href: "/travel", label: "Travel" },
  { href: "/health", label: "Health" },
  { href: "/chaos", label: "Chaos Lab" },
  { href: "/about", label: "About" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${GeistSans.variable} ${GeistMono.variable} font-sans`}>
      <body className="min-h-screen">
        <TooltipProvider>
          <header className="sticky top-0 z-40 glass border-b" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <div className="max-w-6xl mx-auto px-6 h-14 flex items-center gap-8">
              <Link href="/" className="font-semibold text-[15px] tracking-tight">
                HYDRA<span style={{ color: "var(--primary)" }}>.</span>
              </Link>
              <SiteNav />
              <div className="ml-auto flex items-center gap-2 text-xs mono" style={{ color: "var(--muted-foreground)" }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--primary)" }} />
                live on Bright Data
              </div>
            </div>
          </header>
          <main className="max-w-6xl mx-auto px-6 py-10">{children}</main>
          <footer className="border-t mt-16" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            <div className="max-w-6xl mx-auto px-6 py-6 text-xs" style={{ color: "var(--muted-foreground)" }}>
              HYDRA · WeMakeDevs Into the Scrape-Verse 2026 · cut one head off, it grows back
            </div>
          </footer>
          <Toaster position="bottom-right" />
        </TooltipProvider>
      </body>
    </html>
  );
}
