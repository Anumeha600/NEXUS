import Link from "next/link";

const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/play", label: "Play" },
  { href: "/learn", label: "Learn" },
  { href: "/progress", label: "Progress" },
  { href: "/insights", label: "AI Insights" },
];

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="gradient-purple-blue flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white">
            N
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-ink">
            NEXUS
          </span>
        </Link>

        <nav className="hidden items-center gap-1 rounded-full border border-border bg-surface-lavender/60 p-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-full px-4 py-2 text-sm font-semibold text-ink-muted transition hover:bg-white hover:text-purple hover:shadow-sm"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/play"
          className="gradient-purple-blue rounded-full px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:opacity-90"
        >
          Play Now
        </Link>
      </div>
    </header>
  );
}
