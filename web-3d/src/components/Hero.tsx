import Link from "next/link";
import TrajectoryArt from "@/components/TrajectoryArt";
import DashboardStats from "@/components/DashboardStats";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-surface-blue px-6 pt-16 pb-20">
      <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-purple/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-72 w-72 rounded-full bg-cyan/10 blur-3xl" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-1.5 text-xs font-bold tracking-[0.2em] text-purple uppercase shadow-sm">
            Adaptive Physics Lab
          </span>

          <h1 className="mt-5 font-display text-5xl font-extrabold tracking-tight text-ink sm:text-6xl">
            NEXUS
          </h1>

          <p className="mt-3 text-xl font-semibold text-ink sm:text-2xl">
            Learn Physics by experimenting.
          </p>

          <p className="mt-4 max-w-lg text-base text-ink-muted sm:text-lg">
            An adaptive Physics learning game that changes challenge
            difficulty and learning content based on your performance —
            across Projectile Motion, Newton&apos;s Laws, and Work &amp;
            Energy.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/play"
              className="gradient-purple-blue rounded-full px-8 py-3.5 text-center text-base font-bold text-white shadow-lg shadow-purple/20 transition hover:opacity-90"
            >
              Play NEXUS
            </Link>
            <Link
              href="/learn"
              className="rounded-full border-2 border-purple/25 bg-white px-8 py-3.5 text-center text-base font-bold text-purple transition hover:border-purple/50"
            >
              Explore Curriculum
            </Link>
          </div>
        </div>

        <TrajectoryArt />
      </div>

      <DashboardStats />
    </section>
  );
}
