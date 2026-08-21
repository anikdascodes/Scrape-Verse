"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/", label: "Overview" },
  { href: "/travel", label: "Travel" },
  { href: "/health", label: "Health" },
  { href: "/chaos", label: "Chaos Lab" },
  { href: "/about", label: "About" },
];

export default function SiteNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 text-[13px]">
      {nav.map((n) => {
        const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
        return (
          <Link
            key={n.href}
            href={n.href}
            className="px-2.5 py-1.5 rounded-md transition-colors"
            style={active ? { color: "var(--foreground)", background: "rgba(255,255,255,0.07)" } : { color: "var(--muted-foreground)" }}
          >
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}
