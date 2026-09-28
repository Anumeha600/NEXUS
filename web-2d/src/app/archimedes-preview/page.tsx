import { ArchimedesChallengeScene } from "@nexus/game-2d";

// TEMPORARY, unlinked dev-preview route for manually verifying the
// Archimedes / Buoyancy lab during Phase 1 development - mirrors
// web-2d/src/app/waves-preview/page.tsx's own (now-removed) Phase 1 pattern.
// Deliberately not linked from any nav/PlayHub/curriculum - Play Hub,
// Dashboard, Learn and product-wide curriculum integration are all out of
// scope for this phase (see shared/src/curriculum.ts - Archimedes is not yet
// registered there at all). Safe to delete once Archimedes is wired into
// /play for real in a later phase.
export default function ArchimedesPreviewPage() {
  return (
    <div className="px-6 pt-12 pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <span className="mt-4 block text-xs font-bold tracking-[0.2em] text-purple uppercase">Nexus / Dev Preview (Temporary)</span>
          <h1 className="mt-2 font-display text-3xl font-extrabold text-ink sm:text-4xl">Archimedes / Buoyancy</h1>
          <p className="mt-2 max-w-2xl text-ink-muted">Weight, buoyant force, apparent weight, displaced volume, fluid density, and float/sink.</p>
        </div>
        <ArchimedesChallengeScene />
      </div>
    </div>
  );
}
