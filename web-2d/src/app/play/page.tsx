import Link from "next/link";
import { GravitationChallengeScene } from "@nexus/game-2d";
import PlayExperience from "@/components/PlayExperience";
import PlayHub from "@/components/PlayHub";

export default async function PlayPage({ searchParams }: { searchParams: Promise<{ module?: string }> }) {
  const { module } = await searchParams;

  // No ?module= at all -> the Play Hub, the launcher for every available
  // experiment. A module id in the query string (valid, unrecognized, or a
  // curriculum-only one with no engine yet) always renders the game
  // experience below, exactly as it did before the Hub existed -
  // PlayExperience/GameCanvas already fall back to the default journey for
  // an id with no engine behind it, and that fallback is untouched here.
  if (!module) {
    return (
      <div className="px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <PlayHub />
        </div>
      </div>
    );
  }

  // Gravitation & Orbits is an optional lab with its own fully self-contained
  // AdaptiveEngine/game loop (see GravitationChallengeScene's own header
  // comment) - it never goes through GameCanvas/PlayExperience, which have
  // no cases for its challenge types at all. This is the one module-specific
  // branch in this route; every other module id (including an unrecognized
  // one) still falls through to PlayExperience/GameCanvas exactly as before.
  if (module === "gravitation") {
    return (
      <div className="px-6 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8">
            <Link href="/play" className="inline-flex items-center gap-1.5 text-sm font-bold text-purple hover:opacity-80">
              <span aria-hidden="true">←</span> Back to Labs
            </Link>
            <span className="mt-4 block text-xs font-bold tracking-[0.2em] text-purple uppercase">Nexus / Play</span>
            <h1 className="mt-2 font-display text-3xl font-extrabold text-ink sm:text-4xl">Gravitation & Orbits</h1>
            <p className="mt-2 max-w-2xl text-ink-muted">
              An optional lab, outside your adaptive journey - launch a planet and let gravity decide whether it falls, orbits, or escapes.
            </p>
          </div>

          <GravitationChallengeScene />
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          {/* Only ever visible outside fullscreen - the browser's Fullscreen
              API hides everything but GameCanvas's own wrapper while active,
              so this needs no fullscreen-state plumbing of its own. */}
          <Link href="/play" className="inline-flex items-center gap-1.5 text-sm font-bold text-purple hover:opacity-80">
            <span aria-hidden="true">←</span> Back to Labs
          </Link>
          <span className="mt-4 block text-xs font-bold tracking-[0.2em] text-purple uppercase">
            Nexus / Play
          </span>
          <h1 className="mt-2 font-display text-3xl font-extrabold text-ink sm:text-4xl">
            Step into the lab
          </h1>
          <p className="mt-2 max-w-2xl text-ink-muted">
            NEXUS 2D — a real, physics-driven experiment for every
            concept in the{" "}
            <a href="/learn" className="font-semibold text-purple underline">
              curriculum
            </a>
            , scored by the same{" "}
            <a href="/progress" className="font-semibold text-purple underline">
              adaptive engine
            </a>{" "}
            rules as NEXUS 3D.
          </p>
        </div>

        <PlayExperience moduleParam={module} />
      </div>
    </div>
  );
}
