"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/play", label: "Play" },
  { href: "/learn", label: "Learn" },
  { href: "/progress", label: "Progress" },
  { href: "/insights", label: "AI Insights" },
];

export default function Header() {
  const pathname = usePathname();

  return (
    <header className="glass-card sticky top-3 z-40 flex items-center justify-between gap-4 rounded-full px-4 py-2.5 sm:top-4 sm:px-5">
      <Link href="/" className="flex items-center gap-2">
        <span className="gradient-purple-blue flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm shadow-purple/30">
          N
        </span>
        <span className="font-display hidden text-lg font-bold tracking-tight text-ink sm:inline">
          NEXUS
        </span>
      </Link>

      <nav className="hidden items-center gap-1 rounded-full bg-surface-lavender/70 p-1 md:flex">
        {NAV_LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={
                active
                  ? "gradient-purple-blue rounded-full px-4 py-2 text-sm font-bold text-white shadow-md shadow-purple/30"
                  : "rounded-full px-4 py-2 text-sm font-semibold text-ink-muted transition hover:bg-white/80 hover:text-purple"
              }
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <Link
        href="/play"
        className="gradient-purple-blue rounded-full px-4 py-2 text-sm font-bold text-white shadow-md shadow-purple/30 transition hover:opacity-90 sm:px-5"
      >
        Play Now
      </Link>
    </header>
  );
}
