// --------------------------------------------------------------------------
// Gravitation & Orbits - Layer 5: adaptive learning integration.
//
// Pure translation layer between a completed launch attempt and the
// existing AdaptiveEngine. It mirrors exactly the sequence GameCanvas.tsx's
// own finishAttempt already uses for the five live modules - read
// mastery_before -> engine.recordAttempt() -> read mastery_after ->
// engine.evaluateContentTransition() -> engine.generateNextChallenge() -
// just packaged as a pure function of (engine, completed attempt) so it
// needs no DOM/React harness to test (see HowToPlay.test.ts's own note that
// this repo has no component-rendering harness).
//
// What this file is NOT allowed to do, by design:
//   - run physics (gravitationSim.ts/physics.ts already did that)
//   - render anything
//   - own React state
//   - decide mastery/performance with a new formula (AdaptiveEngine.recordAttempt
//     is the only formula used)
//   - guess at correctness the challenge architecture doesn't define (see
//     the CONCEPT_GRAVITATIONAL_FORCE gap below)
// --------------------------------------------------------------------------

import { AdaptiveEngine, CONCEPT_GRAVITATIONAL_FORCE, CONCEPT_ORBITAL_VELOCITY, CONCEPT_ESCAPE_VELOCITY, type Challenge } from "./adaptiveEngine";
import { GRAVITY_SIM_G, orbitalVelocity, escapeVelocity } from "./physics";
import type { GravitationSimStatus } from "./gravitationSim";
import type { GravitationChallengeSetup } from "./gravitationChallenge";
import type { LearningEvent, LearningEventContext } from "@nexus/shared";

const TERMINAL_STATUSES: ReadonlySet<GravitationSimStatus> = new Set(["collision", "orbit", "escape"]);

// Everything the caller (GravitationChallengeScene) knows about one
// completed launch, once gravitationSim.ts has reached a terminal status.
// All of it is either the challenge/setup already produced by earlier
// layers, or plain numbers read off the finished GravitationSimState /
// GravitationRenderState - nothing here is derived by re-running physics.
export interface CompletedGravitationAttempt {
  readonly challenge: Challenge;
  readonly setup: GravitationChallengeSetup;
  // The velocity the player actually launched with - for gravitation's
  // velocity-launch gameplay this IS the player's answer, exactly as a
  // slider-controlled "given" value doubles as both control and actual
  // value in the five existing modules (e.g. Circular Motion's speed).
  readonly launchVelocity: number;
  readonly outcomeStatus: GravitationSimStatus;
  readonly elapsedSimTime: number;
  readonly minRadius: number;
  readonly maxRadius: number;
  // Decision time - real seconds from the challenge becoming available
  // (READY) to the Launch click, exactly the same quantity GameCanvas.tsx
  // measures as "responseTime" for the five existing modules (time to
  // decide + submit, never the animation/physics-run duration that
  // follows). Using the same measurement is precisely why a legitimately
  // long orbital demonstration can never affect this: the clock has already
  // stopped by the time the simulation starts running.
  readonly responseTimeSeconds: number;
  readonly sessionId: string;
  readonly attemptNumber: number;
}

export type GravitationAttemptResult =
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

// The only place "what counts as correct" is decided for gravitation - and
// it is decided from the concept + the simulation's own terminal status,
// never from "anything that isn't a collision". Escaping is a failure for
// Orbital Velocity even though it's not a collision; a stable orbit is a
// failure for Escape Velocity for the same reason.
function determineSuccess(conceptId: string, status: GravitationSimStatus): boolean | null {
  if (conceptId === CONCEPT_ORBITAL_VELOCITY) return status === "orbit";
  if (conceptId === CONCEPT_ESCAPE_VELOCITY) return status === "escape";
  return null;
}

// The velocity value the player's launch is actually being measured
// against, for the accuracy component of AdaptiveEngine.recordAttempt's own
// performance formula - always the challenge's own target, never
// recomputed independently.
function targetVelocityFor(conceptId: string, challenge: Challenge): number | null {
  if (conceptId === CONCEPT_ORBITAL_VELOCITY) return challenge.targetOrbitalVelocity ?? null;
  if (conceptId === CONCEPT_ESCAPE_VELOCITY) return challenge.targetEscapeVelocity ?? null;
  return null;
}

// Translates one completed gravitation attempt into an AdaptiveEngine
// update + a structured LearningEvent, exactly the way GameCanvas.tsx's
// finishAttempt does for the five live modules - or reports why it can't,
// rather than inventing a rule.
//
// KNOWN GAP (CONCEPT_GRAVITATIONAL_FORCE): the challenge this concept
// generates (adaptiveEngine.ts's CONCEPT_GRAVITATIONAL_FORCE case) is a
// numeric-answer question - "what is the force/distance/planet mass?" - but
// the gameplay built for it in Layers 3-4 is a velocity launch whose only
// observable outcome is orbit/collision/escape. There is no channel in the
// current architecture for the player to submit a numeric force/distance/
// mass answer, and none of orbit/collision/escape numerically corresponds
// to "correct" or "incorrect" for that question - launching at exactly the
// circular orbital velocity produces "orbit" regardless of whether the
// player knows the gravitational force's numeric value. Treating any
// outcome as success/failure here would be inventing a scoring rule the
// challenge doesn't define, which the Layer 5 brief explicitly prohibits.
// Integrating this concept needs a missing abstraction - a numeric-answer
// input (or equivalent) for gravitational_force - which is out of scope for
// this layer; this function reports the gap instead of guessing.
export function recordGravitationAttempt(engine: AdaptiveEngine, attempt: CompletedGravitationAttempt): GravitationAttemptResult {
  const { challenge, setup, launchVelocity, outcomeStatus, elapsedSimTime, minRadius, maxRadius, responseTimeSeconds, sessionId, attemptNumber } = attempt;
  const conceptId = challenge.conceptId;

  if (!TERMINAL_STATUSES.has(outcomeStatus)) {
    return { supported: false, reason: `Attempt is not complete - simulation status '${outcomeStatus}' is not a terminal outcome yet.` };
  }

  if (conceptId === CONCEPT_GRAVITATIONAL_FORCE) {
    return {
      supported: false,
      reason:
        "gravitational_force has no numeric-answer input in the current gameplay (a velocity launch + orbital outcome), so there is no way to compare a player answer against targetGravitationalForce/distanceFromStar/planetMass. Recording an attempt here would require inventing a success rule the challenge architecture doesn't define. Integrating this concept needs a missing abstraction: a numeric-answer input (or equivalent) for gravitational_force, paired with a way to score it against the challenge's target - out of scope for Layer 5.",
    };
  }

  const success = determineSuccess(conceptId, outcomeStatus);
  const targetVelocity = targetVelocityFor(conceptId, challenge);
  if (success === null || targetVelocity === null) {
    return { supported: false, reason: `No success rule or target velocity is defined for concept '${conceptId}'.` };
  }

  const distanceError = Math.abs(launchVelocity - targetVelocity);

  const masteryBefore = engine.conceptMastery[conceptId];
  const performance = engine.recordAttempt(distanceError, challenge.tolerance, success, responseTimeSeconds);
  const masteryAfter = engine.conceptMastery[conceptId];
  const adaptationNote = engine.evaluateContentTransition();
  const nextChallenge = engine.generateNextChallenge();

  const context: LearningEventContext = {
    star_mass: setup.starMass,
    starting_radius: setup.orbitalRadius,
    initial_velocity: launchVelocity,
    orbital_velocity: orbitalVelocity(GRAVITY_SIM_G, setup.starMass, setup.orbitalRadius),
    escape_velocity: escapeVelocity(GRAVITY_SIM_G, setup.starMass, setup.orbitalRadius),
    final_status: outcomeStatus,
    elapsed_simulation_time: elapsedSimTime,
    minimum_radius: minRadius,
    maximum_radius: maxRadius,
  };

  const event: LearningEvent = {
    session_id: sessionId,
    module: challenge.moduleId,
    concept: challenge.conceptTitle,
    challenge_type: challenge.conceptId,
    difficulty: challenge.difficulty,
    target_value: targetVelocity,
    actual_value: launchVelocity,
    unit: challenge.unit,
    success,
    performance,
    mastery_before: masteryBefore,
    mastery_after: masteryAfter,
    attempt_number: attemptNumber,
    recent_attempts: engine.getRecentAttemptCount(conceptId),
    context,
  };

  return { supported: true, event, success, performance, masteryBefore, masteryAfter, adaptationNote, nextChallenge };
}
