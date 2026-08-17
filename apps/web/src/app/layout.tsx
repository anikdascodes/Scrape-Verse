import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "HYDRA — self-healing GPU price intelligence",
  description:
    "Cross-store GPU prices on Bright Data Scraper Studio, with a watchdog that detects breakage and self-heals scrapers automatically.",
};

const nav = [
  { href: "/", label: "Overview" },
  { href: "/health", label: "Health" },
  { href: "/chaos", label: "Chaos Lab" },
  { href: "/about", label: "About" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b" style={{ borderColor: "var(--border)" }}>
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-8">
            <Link href="/" className="font-bold text-lg tracking-wide">
              HYDRA<span style={{ color: "var(--green)" }}>.</span>
            </Link>
            <nav className="flex gap-6 text-sm" style={{ color: "var(--muted)" }}>
              {nav.map((n) => (
                <Link key={n.href} href={n.href} className="hover:text-white transition-colors">
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto text-xs mono" style={{ color: "var(--muted)" }}>
              powered by Bright Data Scraper Studio
            </div>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
        <footer className="border-t mt-16" style={{ borderColor: "var(--border)" }}>
          <div className="max-w-6xl mx-auto px-6 py-6 text-xs" style={{ color: "var(--muted)" }}>
            HYDRA · WeMakeDevs Into the Scrape-Verse 2026 · cut one head off, it grows back
          </div>
        </footer>
      </body>
    </html>
  );
}
