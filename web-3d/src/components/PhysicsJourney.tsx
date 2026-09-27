import Link from "next/link";

const MODULES = [
  {
    slug: "projectile-motion",
    name: "Projectile Motion",
    tagline: "Speed • Range • Gravity",
    description: "Launch, predict, and land — explore how speed and gravity shape a trajectory.",
    concepts: ["Speed & Range", "Gravity & Trajectory"],
    accent: "from-blue to-cyan",
    ring: "ring-blue/20",
    chip: "bg-blue/10 text-blue-dark",
  },
  {
    slug: "newtons-laws",
    name: "Newton's Laws",
    tagline: "Force • Acceleration • Friction",
    description: "Push a cart, balance forces, and see Newton's Second Law respond in real time.",
    concepts: ["Force & Acceleration", "Net Force", "Friction"],
    accent: "from-purple to-blue",
    ring: "ring-purple/20",
    chip: "bg-purple/10 text-purple-dark",
  },
  {
    slug: "work-energy",
    name: "Work & Energy",
    tagline: "Work • Kinetic Energy • Energy Transfer",
    description: "Connect force, displacement, and motion through work and kinetic energy.",
    concepts: ["Work", "Kinetic Energy", "Work-Energy Theorem"],
    accent: "from-gold to-purple",
    ring: "ring-gold/25",
    chip: "bg-gold/15 text-gold-dark",
  },
];

export default function PhysicsJourney() {
  return (
    <section className="bg-bg px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <span className="text-xs font-bold tracking-[0.2em] text-purple uppercase">
            Physics Journey
          </span>
          <h2 className="mt-2 font-display text-3xl font-extrabold text-ink sm:text-4xl">
            Three labs, one adaptive engine
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {MODULES.map((mod) => (
            <div
              key={mod.slug}
              className={`card-elevated group relative overflow-hidden rounded-3xl border border-border bg-white p-6 ring-1 ${mod.ring} transition hover:-translate-y-1`}
            >
              <div className={`h-1.5 w-16 rounded-full bg-gradient-to-r ${mod.accent}`} />

              <h3 className="mt-5 font-display text-xl font-bold text-ink">
                {mod.name}
              </h3>
              <p className="mt-1 text-xs font-bold tracking-wide text-ink-muted uppercase">
                {mod.tagline}
              </p>
              <p className="mt-3 text-sm text-ink-muted">{mod.description}</p>

              <ul className="mt-4 flex flex-wrap gap-2">
                {mod.concepts.map((concept) => (
                  <li
                    key={concept}
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${mod.chip}`}
                  >
                    {concept}
                  </li>
                ))}
              </ul>

              <Link
                href="/play"
                className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-purple transition group-hover:gap-2.5"
              >
                Play this module <span aria-hidden="true">▶</span>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
