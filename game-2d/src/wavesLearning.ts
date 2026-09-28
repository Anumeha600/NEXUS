// --------------------------------------------------------------------------
// Wave Motion - Phase 2: adaptive learning integration.
//
// Pure translation layer between one completed Wave Motion attempt (a
// submitted numeric answer or interference choice) and the existing
// AdaptiveEngine - mirrors gravitationLearning.ts's own recordGravitationAttempt
// exactly: read mastery_before -> engine.recordAttempt() -> read
// mastery_after -> engine.evaluateContentTransition() ->
// engine.generateNextChallenge(). Needs no DOM/React harness to test.
//
// What this file is NOT allowed to do, by design (same list as
// gravitationLearning.ts):
//   - run wave physics (wavesPhysics.ts/wavesChallenge.ts already did that)
//   - render anything
//   - own React state
//   - decide mastery/performance with a new formula (AdaptiveEngine.recordAttempt
//     is the only formula used)
//   - decide success/failure itself - that's entirely
//     evaluateWaveNumericAnswer/evaluateWaveChoiceAnswer (wavesChallenge.ts),
//     called here and never re-derived
// --------------------------------------------------------------------------

import { AdaptiveEngine, type Challenge } from "./adaptiveEngine";
import { evaluateWaveNumericAnswer, evaluateWaveChoiceAnswer, WAVE_CONCEPT_SUPERPOSITION, type WaveChallenge } from "./wavesChallenge";
import type { InterferenceType } from "./wavesPhysics";
import type { LearningEvent, LearningEventContext } from "@nexus/shared";

// Everything the caller (WavesChallengeScene) knows about one completed
// submission. Exactly one of submittedValue/submittedChoice is set,
// matching the challenge's own `kind` - never both, never neither.
export interface CompletedWaveAttempt {
  readonly challenge: Challenge;
  readonly submittedValue?: number;
  readonly submittedChoice?: InterferenceType;
  // Decision time - real seconds from the challenge becoming available to
  // the Submit click, exactly the same quantity GameCanvas.tsx/
  // gravitationLearning.ts measure as "responseTime" for every other module.
  readonly responseTimeSeconds: number;
  readonly sessionId: string;
  readonly attemptNumber: number;
}

export type WaveAttemptResult =
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

// A binary choice challenge has no natural "distance" the way a numeric
// answer does - accuracy is either perfect (the same choice) or zero (any
// other choice), never partial. tolerance=1 with distanceError of 0 or 3
// makes AdaptiveEngine.recordAttempt's own
// `clamp(1 - distanceError/(tolerance*3), 0, 1)` accuracy term evaluate to
// exactly 1 or 0 - not a new formula, just the existing one fed the inputs a
// binary answer actually has.
const CHOICE_TOLERANCE = 1;
const CHOICE_WRONG_DISTANCE = 3;

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

// Context reported alongside the learning event - the concept-specific
// numbers that describe THIS wave challenge, mirroring challengeLogic.ts's
// own per-concept contextFor (never a generic "control_value" dump).
function contextFor(waveChallenge: WaveChallenge, submittedValue?: number, submittedChoice?: InterferenceType): LearningEventContext {
  if (waveChallenge.kind === "choice") {
    return {
      wave_concept: waveChallenge.conceptId,
      challenge_kind: "choice",
      wave1_amplitude: waveChallenge.wave1.amplitude,
      wave2_amplitude: waveChallenge.wave2.amplitude,
      phase_difference_pi_rad: round2((waveChallenge.wave2.phase - waveChallenge.wave1.phase) / Math.PI),
      submitted_choice: submittedChoice ?? "",
      correct_choice: waveChallenge.correctAnswer,
    };
  }
  const context: LearningEventContext = {
    wave_concept: waveChallenge.conceptId,
    challenge_kind: "numeric",
    mode: waveChallenge.mode,
    solve_for: waveChallenge.solveFor,
    amplitude: waveChallenge.wave.amplitude,
    frequency: waveChallenge.wave.frequency,
    wavelength: waveChallenge.wave.wavelength,
    submitted_value: submittedValue ?? 0,
    target_value: waveChallenge.targetValue,
  };
  if (waveChallenge.conceptId === WAVE_CONCEPT_SUPERPOSITION && waveChallenge.wave2) {
    context.wave2_amplitude = waveChallenge.wave2.amplitude;
    context.phase_difference_pi_rad = round2((waveChallenge.wave2.phase - waveChallenge.wave.phase) / Math.PI);
  }
  return context;
}

// Translates one completed Wave Motion attempt into an AdaptiveEngine
// update + a structured LearningEvent, exactly the way
// recordGravitationAttempt does for Gravitation & Orbits - or reports why it
// can't (a challenge with no waveChallenge attached, or an answer of the
// wrong kind for this challenge), rather than inventing a success rule.
export function recordWaveAttempt(engine: AdaptiveEngine, attempt: CompletedWaveAttempt): WaveAttemptResult {
  const { challenge, submittedValue, submittedChoice, responseTimeSeconds, sessionId, attemptNumber } = attempt;
  const waveChallenge = challenge.waveChallenge;
  if (!waveChallenge) {
    return { supported: false, reason: `Challenge '${challenge.conceptId}' has no attached waveChallenge - this is not a Wave Motion concept.` };
  }

  let success: boolean;
  let distanceError: number;
  let tolerance: number;
  let actualValue: number;
  let targetValue: number;

  if (waveChallenge.kind === "choice") {
    if (submittedChoice === undefined) {
      return { supported: false, reason: "This is an interference-type challenge - a submittedChoice is required, not a submittedValue." };
    }
    const result = evaluateWaveChoiceAnswer(waveChallenge, submittedChoice);
    success = result.correct;
    distanceError = success ? 0 : CHOICE_WRONG_DISTANCE;
    tolerance = CHOICE_TOLERANCE;
    actualValue = success ? 1 : 0;
    targetValue = 1;
  } else {
    if (submittedValue === undefined) {
      return { supported: false, reason: "This is a numeric-answer challenge - a submittedValue is required, not a submittedChoice." };
    }
    const result = evaluateWaveNumericAnswer(waveChallenge, submittedValue);
    success = result.correct;
    distanceError = Math.abs(submittedValue - waveChallenge.targetValue);
    tolerance = waveChallenge.tolerance;
    actualValue = submittedValue;
    targetValue = waveChallenge.targetValue;
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
    context: contextFor(waveChallenge, submittedValue, submittedChoice),
  };

  return { supported: true, event, success, performance, masteryBefore, masteryAfter, adaptationNote, nextChallenge };
}
