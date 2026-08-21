"use client";

import Link from "next/link";

const nav = [
  { href: "/", label: "Overview" },
  { href: "/travel", label: "Travel" },
  { href: "/health", label: "Health" },
  { href: "/chaos", label: "Chaos Lab" },
  { href: "/about", label: "About" },
];

export default function SiteNav() {
  return (
    <nav className="flex gap-1 text-[13px]">
      {nav.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          className="px-2.5 py-1.5 rounded-md transition-colors hover:text-foreground hover:bg-white/[0.05]"
          style={{ color: "var(--muted-foreground)" }}
        >
          {n.label}
        </Link>
      ))}
    </nav>
  );
}
