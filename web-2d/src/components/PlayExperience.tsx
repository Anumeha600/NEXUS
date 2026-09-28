"use client";

import { useCallback, useState } from "react";
import { GameCanvas, type ChallengeResultEvent } from "@nexus/game-2d";
import { appendSessionAttempt, engineModuleIdFor, moduleByEngineId } from "@nexus/shared";

// The dashboard's module cards link to /play?module=<slug> so each card
// opens its own module directly instead of always landing on Projectile
// Motion. `engineModuleIdFor` is the single, shared bridge from that stable
// curriculum slug to the AdaptiveEngine's internal module id - an
// unrecognized slug, a missing one, or a curriculum-only module with no
// engine behind it yet (available: false) all fall back to undefined, which
// GameCanvas/AdaptiveEngine already treat as "start the default journey."
function resolveModuleParam(moduleParam: string | undefined): string | undefined {
  if (!moduleParam) return undefined;
  return engineModuleIdFor(moduleParam);
}

interface CurrentInfo {
  module: string;
  concept: string;
  difficulty: string;
}

export default function PlayExperience({ moduleParam }: { moduleParam?: string }) {
  const [current, setCurrent] = useState<CurrentInfo | null>(null);
  const initialModuleId = resolveModuleParam(moduleParam);

  // Stable identity: GameCanvas's own effect depends on this callback, so a
  // fresh function reference every render (as an inline JSX arrow would be)
  // re-fires that effect every render, which calls setCurrent, which
  // re-renders this component, which creates a fresh arrow again - an
  // infinite render loop. useCallback with an empty dependency array (only
  // the stable setCurrent setter is used inside) keeps the reference fixed.
  const handleChallengeStarted = useCallback((moduleId: string, conceptTitle: string, difficulty: string) => {
    setCurrent({ module: moduleTitle(moduleId), concept: conceptTitle, difficulty });
  }, []);

  function handleResult(event: ChallengeResultEvent) {
    // The canvas game already requested its own AI insight and shows it on
    // the in-game result card immediately; it also patches this SAME
    // SessionAttempt's `insight` field once that (async) response resolves
    // (see GameCanvas.tsx's requestAiInsight) - so `id` here MUST be
    // event.attemptId, the same id that call uses, or the two would never
    // correlate and the AI Insights page would never see an explanation.
    appendSessionAttempt({
      id: event.attemptId,
      timestamp: Date.now(),
      module: event.moduleId,
      concept: event.conceptTitle,
      success: event.success,
      performance: event.performance,
      masteryBefore: event.masteryBefore,
      masteryAfter: event.masteryAfter,
      difficulty: event.difficulty,
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
      <div>
        <GameCanvas
          key={initialModuleId ?? "default"}
          initialModuleId={initialModuleId}
          onChallengeStarted={handleChallengeStarted}
          onChallengeResult={handleResult}
        />
        <p className="mt-4 text-xs text-ink-muted">
          Controls: ↑ / ↓ or the on-screen +/− adjust the controlled value ·
          Enter or Confirm scores the attempt.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <h3 className="text-xs font-bold tracking-[0.15em] text-ink-muted uppercase">
            Right now
          </h3>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Module" value={current?.module ?? "—"} />
            <Row label="Concept" value={current?.concept ?? "—"} />
            <Row label="Difficulty" value={current?.difficulty ?? "—"} />
          </dl>
        </div>

        <div className="rounded-2xl border border-dashed border-border bg-white/60 p-5 text-xs text-ink-muted">
          NEXUS AI Learning Insight appears directly on the result card
          inside the game after each attempt. Your{" "}
          <a href="/insights" className="font-semibold text-purple underline">
            session-wide insights
          </a>{" "}
          update after every completed challenge.
        </div>
      </div>
    </div>
  );
}

function moduleTitle(engineModuleId: string): string {
  return moduleByEngineId(engineModuleId)?.title ?? engineModuleId;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-semibold text-ink">{value}</dd>
    </div>
  );
}
