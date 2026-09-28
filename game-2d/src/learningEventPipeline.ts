// --------------------------------------------------------------------------
// Phase 4B - the one place a finalized LearningEvent from any of the 3
// standalone modules (Gravitation, Wave Motion, Archimedes) enters the same
// two downstream consumers the 5 core modules already use via
// GameCanvas.tsx/PlayExperience.tsx:
//   - @nexus/shared's session history (appendSessionAttempt) - read back by
//     AIDashboardCard.tsx, InsightsView.tsx, and PlayHub.tsx's own
//     "Continue Your Adaptive Challenge" card.
//   - the existing POST /api/insight endpoint
//     (web-2d/src/app/api/insight/route.ts) - the SAME AI insight pathway
//     every other module uses, never a second one.
//
// Deliberately NOT inside gravitationLearning.ts/wavesLearning.ts/
// archimedesLearning.ts: those files are pure translation layers (no fetch,
// no localStorage, no DOM) precisely so they need no mocking/harness to test
// - see each file's own header comment. This is the React-layer side effect
// instead, exactly the role GameCanvas.tsx plays for the 5 core modules (it
// calls onChallengeResult/appendSessionAttempt and requestAiInsight itself;
// challengeLogic.ts never does). Each of the 3 standalone *ChallengeScene.tsx
// components calls this ONE function instead of duplicating the fetch+append
// logic three times.
//
// By the time this function is called, mastery/difficulty/progression are
// already fully decided - recordGravitationAttempt/recordWaveAttempt/
// recordArchimedesAttempt already ran engine.recordAttempt()/
// evaluateContentTransition()/generateNextChallenge() to produce
// result.event. This function never reads the AI response, never returns
// it, and never touches an AdaptiveEngine - there is nothing here an AI
// response could feed back into.
//
// Never blocks or throws into its caller - gameplay must not fail because
// AI insight or session-history storage fails. appendSessionAttempt is
// already internally defensive (see sessionHistory.ts); the fetch below is
// wrapped the same way GameCanvas.tsx's own requestAiInsight is.
// --------------------------------------------------------------------------

import { appendSessionAttempt, type LearningEvent } from "@nexus/shared";

export async function recordLearningEvent(event: LearningEvent): Promise<void> {
  appendSessionAttempt({
    timestamp: Date.now(),
    module: event.module,
    concept: event.concept,
    success: event.success,
    performance: event.performance,
    masteryBefore: event.mastery_before,
    masteryAfter: event.mastery_after,
    difficulty: event.difficulty,
  });

  if (typeof fetch !== "function") return;
  try {
    await fetch("/api/insight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
  } catch {
    // Network error, timeout, or the endpoint itself failing - the same
    // "never break gameplay over AI" contract GameCanvas.tsx's own
    // requestAiInsight follows. The response is never read here; this
    // function's only job is to fire the request.
  }
}
