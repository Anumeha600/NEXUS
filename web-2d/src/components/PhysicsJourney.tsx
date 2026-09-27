import Link from "next/link";
import { AVAILABLE_MODULES, OPTIONAL_LABS, TOTAL_PHYSICS_LABS } from "@nexus/shared";
import ModuleArtwork from "@/components/ModuleArtwork";

// Only modules with a working game link out to /play - a curriculum-only
// entry (available: false, no optionalLab) has nothing to play yet, so it
// has no place on this promotional section until its own phase actually
// implements it. This is the same "real playable labs, in curriculum order"
// concept PlayHub.tsx's own PHYSICS_LAB_MODULES uses - AVAILABLE_MODULES
// (the 5-module adaptive sequence) followed by OPTIONAL_LABS (real games
// outside it, e.g. Gravitation & Orbits), matching the heading above's
// TOTAL_PHYSICS_LABS count exactly.
const PHYSICS_JOURNEY_MODULES = [...AVAILABLE_MODULES, ...OPTIONAL_LABS].map((mod) => ({
  slug: mod.id,
  modulePath: `/play?module=${mod.id}`,
  name: mod.title,
  tagline: mod.tagline,
  description: mod.description,
  concepts: mod.concepts.map((c) => c.title),
  ...mod.theme,
}));

export default function PhysicsJourney() {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <span className="text-xs font-bold tracking-[0.2em] text-purple uppercase">
            Physics Journey
          </span>
          <h2 className="mt-2 font-display text-3xl font-extrabold text-ink sm:text-4xl">
            {TOTAL_PHYSICS_LABS} Physics labs, one adaptive engine
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {PHYSICS_JOURNEY_MODULES.map((mod) => (
            <div
              key={mod.slug}
              className={`glass-card group flex flex-col overflow-hidden rounded-3xl ring-1 ${mod.ring} transition hover:-translate-y-1`}
            >
              <div className="h-36 w-full overflow-hidden sm:h-40">
                <ModuleArtwork
                  moduleId={mod.slug}
                  className="h-full w-full transition duration-300 group-hover:scale-[1.02]"
                />
              </div>

              <div className="flex flex-1 flex-col p-6">
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
                  href={mod.modulePath}
                  className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-purple transition group-hover:gap-2.5"
                >
                  Play this module <span aria-hidden="true">▶</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
