import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-border bg-white px-6 py-10 text-ink-muted">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex items-center gap-2">
          <span className="gradient-purple-blue flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white">
            N
          </span>
          <span className="font-display text-sm font-bold text-ink">
            NEXUS — Adaptive Physics Lab
          </span>
        </div>
        <nav className="flex flex-wrap justify-center gap-5 text-xs font-semibold">
          <Link href="/" className="hover:text-purple">Dashboard</Link>
          <Link href="/play" className="hover:text-purple">Play</Link>
          <Link href="/learn" className="hover:text-purple">Learn</Link>
          <Link href="/progress" className="hover:text-purple">Progress</Link>
          <Link href="/insights" className="hover:text-purple">AI Insights</Link>
        </nav>
        <p className="text-xs">
          Godot 4 &amp; Next.js · PSN018 — AI-Powered Adaptive Learning Game
        </p>
      </div>
    </footer>
  );
}
