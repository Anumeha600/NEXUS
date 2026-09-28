// --------------------------------------------------------------------------
// Archimedes & Buoyancy - Phase 2: adaptive learning integration.
//
// Pure translation layer between one completed Archimedes attempt (a
// submitted numeric answer or a float/sink choice) and the existing
// AdaptiveEngine - mirrors wavesLearning.ts's own recordWaveAttempt exactly:
// read mastery_before -> engine.recordAttempt() -> read mastery_after ->
// engine.evaluateContentTransition() -> engine.generateNextChallenge().
// Needs no DOM/React harness to test.
//
// What this file is NOT allowed to do, by design (same list as
// wavesLearning.ts/gravitationLearning.ts):
//   - run buoyancy physics (archimedesPhysics.ts/archimedesChallenge.ts
//     already did that)
//   - render anything
//   - own React state
//   - decide mastery/performance with a new formula (AdaptiveEngine.recordAttempt
//     is the only formula used)
//   - decide success/failure itself - that's entirely
//     evaluateArchimedesNumericAnswer/evaluateArchimedesChoiceAnswer
//     (archimedesChallenge.ts), called here and never re-derived
//
// One genuine difference from Wave/Gravitation: Archimedes has a manual
// fluid selector (Phase 1) that is an EXPERIMENT PARAMETER, not an adaptive
// one - it must never itself record an attempt, touch mastery, or advance a
// concept (see ArchimedesChallengeScene.tsx's own fluid-change handler,
// which never calls anything in this file). So recordArchimedesAttempt takes
// the already fluid-adjusted ArchimedesChallenge the player actually
// measured against (`archimedesChallenge` below) separately from the
// AdaptiveEngine's own `challenge` (whose attached archimedesChallenge
// always reflects the engine's own default fluid) - scoring and every
// reported target/actual value use the fluid-adjusted one, and the fluid
// itself is reported only as LearningEventContext, exactly as the Phase 2
// brief specifies.
// --------------------------------------------------------------------------

import { AdaptiveEngine, type Challenge } from "./adaptiveEngine";
import { evaluateArchimedesNumericAnswer, evaluateArchimedesChoiceAnswer, type ArchimedesChallenge } from "./archimedesChallenge";
import type { FloatingOutcome } from "./archimedesPhysics";
import type { LearningEvent, LearningEventContext } from "@nexus/shared";

// Everything the caller (ArchimedesChallengeScene) knows about one completed
// submission. Exactly one of submittedValue/submittedChoice is set,
// matching archimedesChallenge's own `kind` - never both, never neither.
export interface CompletedArchimedesAttempt {
  readonly challenge: Challenge;
  // The challenge the player actually measured against - baseChallenge
  // (challenge.archimedesChallenge) re-derived for whichever fluid was
  // selected at submission time via archimedesChallenge.ts's own
  // applyFluidToChallenge. Same id/conceptId as challenge.archimedesChallenge,
  // never a different challenge.
  readonly archimedesChallenge: ArchimedesChallenge;
  readonly submittedValue?: number;
  readonly submittedChoice?: FloatingOutcome;
  // Decision time - real seconds from the challenge becoming available to
  // the Submit click, exactly the same quantity GameCanvas.tsx/
  // gravitationLearning.ts/wavesLearning.ts measure as "responseTime" for
  // every other module.
  readonly responseTimeSeconds: number;
  readonly sessionId: string;
  readonly attemptNumber: number;
}

export type ArchimedesAttemptResult =
  | {
      readonly supported: true;
      readonly event: LearningEvent;
      readonly success: boolean;
      readonly performance: number;
      readonly masteryBefore: number;
      readonly masteryAfter: number;
      readonly adaptationNote: string;
      readonly nextChallenge: Challenge;
    }
  | {
      readonly supported: false;
      readonly reason: string;
    };

// A float/sink choice has no natural "distance" the way a numeric answer
// does - accuracy is either perfect (the same choice) or zero (any other
// choice), never partial. Same trick wavesLearning.ts's own
// CHOICE_TOLERANCE/CHOICE_WRONG_DISTANCE use: tolerance=1 with a
// distanceError of 0 or 3 makes AdaptiveEngine.recordAttempt's own
// `clamp(1 - distanceError/(tolerance*3), 0, 1)` accuracy term evaluate to
// exactly 1 or 0 - not a new formula, just the existing one fed the inputs a
// binary answer actually has.
const CHOICE_TOLERANCE = 1;
const CHOICE_WRONG_DISTANCE = 3;

// Context reported alongside the learning event - the fluid the player
// actually selected (per the brief's own `context: { fluid, fluid_density }`
// example - "salt water" -> "salt_water") plus the concept-specific numbers
// that describe THIS Archimedes challenge, mirroring wavesLearning.ts's own
// contextFor (never a generic "control_value" dump).
function contextFor(challenge: ArchimedesChallenge): LearningEventContext {
  const base: LearningEventContext = {
    fluid: challenge.setup.fluidName.replace(/ /g, "_"),
    fluid_density: challenge.setup.fluidDensity,
    mass: challenge.setup.mass,
    object_volume: challenge.setup.objectVolume,
  };
  if (challenge.kind === "choice") {
    return {
      ...base,
      challenge_kind: "choice",
      object_density: challenge.objectDensity,
      correct_answer: challenge.correctAnswer,
    };
  }
  return {
    ...base,
    challenge_kind: "numeric",
    solve_for: challenge.solveFor,
    actual_weight: challenge.actualWeight,
    apparent_weight: challenge.apparentWeight,
    displaced_volume: challenge.displacedVolume,
    buoyant_force: challenge.buoyantForce,
  };
}

// Translates one completed Archimedes attempt into an AdaptiveEngine update
// + a structured LearningEvent, exactly the way recordWaveAttempt does for
// Wave Motion - or reports why it can't (a challenge with no attached
// archimedesChallenge, or an answer of the wrong kind for this challenge),
// rather than inventing a success rule.
export function recordArchimedesAttempt(engine: AdaptiveEngine, attempt: CompletedArchimedesAttempt): ArchimedesAttemptResult {
  const { challenge, archimedesChallenge, submittedValue, submittedChoice, responseTimeSeconds, sessionId, attemptNumber } = attempt;

  if (!challenge.archimedesChallenge) {
    return { supported: false, reason: `Challenge '${challenge.conceptId}' has no attached archimedesChallenge - this is not an Archimedes concept.` };
  }
  if (archimedesChallenge.id !== challenge.archimedesChallenge.id || archimedesChallenge.conceptId !== challenge.archimedesChallenge.conceptId) {
    return { supported: false, reason: "The submitted archimedesChallenge does not match the AdaptiveEngine's own current challenge - this is not the same experiment." };
  }

  let success: boolean;
  let distanceError: number;
  let tolerance: number;
  let actualValue: number;
  let targetValue: number;

  if (archimedesChallenge.kind === "choice") {
    if (submittedChoice === undefined) {
      return { supported: false, reason: "This is a Float/Sink challenge - a submittedChoice is required, not a submittedValue." };
    }
    const result = evaluateArchimedesChoiceAnswer(archimedesChallenge, submittedChoice);
    success = result.correct;
    distanceError = success ? 0 : CHOICE_WRONG_DISTANCE;
    tolerance = CHOICE_TOLERANCE;
    actualValue = success ? 1 : 0;
    targetValue = 1;
  } else {
    if (submittedValue === undefined) {
      return { supported: false, reason: "This is a numeric-answer challenge - a submittedValue is required, not a submittedChoice." };
    }
    const result = evaluateArchimedesNumericAnswer(archimedesChallenge, submittedValue);
    success = result.correct;
    distanceError = Math.abs(submittedValue - archimedesChallenge.targetValue);
    tolerance = archimedesChallenge.tolerance;
    actualValue = submittedValue;
    targetValue = archimedesChallenge.targetValue;
  }

  const conceptId = challenge.conceptId;
  const masteryBefore = engine.conceptMastery[conceptId];
  const performance = engine.recordAttempt(distanceError, tolerance, success, responseTimeSeconds);
  const masteryAfter = engine.conceptMastery[conceptId];
  const adaptationNote = engine.evaluateContentTransition();
  const nextChallenge = engine.generateNextChallenge();

  const event: LearningEvent = {
    session_id: sessionId,
    module: challenge.moduleId,
    concept: challenge.conceptTitle,
    challenge_type: challenge.conceptId,
    difficulty: challenge.difficulty,
    target_value: targetValue,
    actual_value: actualValue,
    unit: challenge.unit,
    success,
    performance,
    mastery_before: masteryBefore,
    mastery_after: masteryAfter,
    attempt_number: attemptNumber,
    recent_attempts: engine.getRecentAttemptCount(conceptId),
    context: contextFor(archimedesChallenge),
  };

  return { supported: true, event, success, performance, masteryBefore, masteryAfter, adaptationNote, nextChallenge };
}
