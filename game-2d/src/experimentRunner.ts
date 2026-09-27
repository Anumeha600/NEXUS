// --------------------------------------------------------------------------
// NEXUS 2D - EXPERIMENT RUNNER
//
// Pure timing/readout logic for the visible "the experiment is running"
// beat between submission and result. Deliberately separate from
// GameCanvas.tsx's React state and render.ts's canvas drawing so the
// timing rules and the numbers shown during the run are unit-testable
// without a DOM. Nothing here touches scoring, mastery or the adaptive
// engine - it only decides what the player sees while a value they already
// submitted is being visually carried out.
// --------------------------------------------------------------------------

import {
  MODULE_PROJECTILE,
  CONCEPT_WORK,
  CONCEPT_KINETIC_ENERGY,
  CONCEPT_WORK_ENERGY_THEOREM,
  CONCEPT_FORCE_ACCELERATION,
  CONCEPT_NET_FORCE,
  CONCEPT_FRICTION,
  CONCEPT_MOMENTUM,
  CONCEPT_IMPULSE,
  CONCEPT_CONSERVATION_MOMENTUM,
  CONCEPT_CENTRIPETAL_FORCE,
  CONCEPT_CENTRIPETAL_ACCELERATION,
  CONCEPT_CIRCULAR_SPEED,
  type Challenge,
} from "./adaptiveEngine";
import { work, kineticEnergy, momentum, impulse, totalMomentum, centripetalForceFromSpeed, centripetalAccelerationFromSpeed } from "./physics";
import { predictedValue, finalVelocityFromWork, circularSimParamsFor } from "./challengeLogic";

export { circularSimParamsFor };

// Default/fallback presentation duration for runs with no time-dependent
// physics of their own (Work, Kinetic Energy, Work-Energy Theorem all define
// their final state purely as a function of progress, so any watchable
// duration reaches the exact same endpoint at progress 1) and the safety
// fallback for Newton concepts whose predicted acceleration can't carry the
// cart across the track (see newtonRunDurationMs). ~1.0-2.0s per the product
// spec: long enough to actually see, short enough not to feel like a wait.
export const RUN_DURATION_MS = 1500;

// Presentation-duration bounds: a run's *visual* duration is always derived
// from its real physics (flight time, or time-to-cross-the-track under the
// predicted acceleration), then compressed or stretched only enough to land
// inside this window - never replaced by an arbitrary duration unrelated to
// the physics. This is what keeps a 10-second flight or a barely-accelerating
// cart from either flashing past in an instant or hanging forever.
export const MIN_RUN_MS = 900;
export const MAX_RUN_MS = 3200;

// The nominal Newton test-track length. Work & Energy's "distance" is a
// per-challenge given value; Newton's concepts (Force & Acceleration, Net
// Force, Friction) have no equivalent field, so the track itself defines the
// physical endpoint the cart must actually reach before the run can be
// considered complete.
export const NEWTON_TRACK_DISTANCE_M = 5;

// Momentum & Collisions track geometry. Unlike Newton's accelerating cart,
// Impulse and Conservation of Momentum both move at CONSTANT velocity
// before AND after their one instantaneous collision event (frictionless
// track - nothing here fakes acceleration where the physics has none); only
// the collision itself changes velocity, at a single physically-real
// instant computed from how long it takes to close the given gap at the
// given closing speed.
export const IMPULSE_TRACK_DISTANCE_M = 6; // cart's start -> the barrier
export const MOMENTUM_TRACK_HALF_GAP_M = 6; // each cart's distance from the track's center
export const CART_HALF_WIDTH_M = 0.4;
// Real seconds of post-collision motion shown before a run is allowed to
// reach "complete" - the mandatory "post-collision observation interval"
// (see the module's physical-completion rule): the collision must actually
// be visible before the result appears, never fired the instant impact happens.
const POST_IMPACT_OBSERVE_S = 0.85;

function clampRunMs(ms: number): number {
  return Math.max(MIN_RUN_MS, Math.min(MAX_RUN_MS, ms));
}

// Real seconds until impact, given the physical gap to close and the
// closing speed - the fallback (a near-minimum run) only applies if the
// carts somehow aren't converging, which the challenge generator never
// actually produces (u1 is always > u2, see adaptiveEngine.ts), but a timing
// function must still return *something* finite rather than divide by zero.
function timeToImpactSeconds(gapMeters: number, closingSpeed: number): number {
  if (!Number.isFinite(closingSpeed) || closingSpeed <= 0) return MIN_RUN_MS / 1000;
  return gapMeters / closingSpeed;
}

function impactRunDurationMs(gapMeters: number, closingSpeed: number): number {
  return clampRunMs((timeToImpactSeconds(gapMeters, closingSpeed) + POST_IMPACT_OBSERVE_S) * 1000);
}

// What fraction (0..1) of the run's total presentation duration has elapsed
// at the moment of impact - GameCanvas/render.ts use this to know exactly
// when to switch from pre- to post-collision velocities and fire the impact
// visual, without a second, independent timer.
function impactProgressAt(gapMeters: number, closingSpeed: number, durationMs: number): number {
  return clamp01((timeToImpactSeconds(gapMeters, closingSpeed) * 1000) / durationMs);
}

// -- Impulse (cart vs. barrier) --------------------------------------------

export function impulseRunDurationMs(challenge: Challenge): number {
  return impactRunDurationMs(IMPULSE_TRACK_DISTANCE_M, Math.abs(challenge.initialVelocity ?? 0));
}

export function impulseImpactProgress(challenge: Challenge, durationMs: number): number {
  return impactProgressAt(IMPULSE_TRACK_DISTANCE_M, Math.abs(challenge.initialVelocity ?? 0), durationMs);
}

// The true, physically-correct final velocity the barrier produces - always
// the honest fact the challenge was generated with (see adaptiveEngine.ts's
// Challenge doc comment), never the player's guess, regardless of which
// quantity impulseSolveFor actually asks them to predict.
export function impulseTrueFinalVelocity(challenge: Challenge): number {
  return challenge.finalVelocity ?? challenge.initialVelocity ?? 0;
}

export function impulseHasImpactedAt(challenge: Challenge, progress: number, durationMs: number): boolean {
  return clamp01(progress) >= impulseImpactProgress(challenge, durationMs);
}

// Cart displacement (m) from its start for the Impulse concept: constant
// velocity `initialVelocity` right up to the impact instant, then constant
// velocity `impulseTrueFinalVelocity` for the remaining, real physical time -
// a genuine pre/impact/post sequence, never a teleport across the gap.
export function impulseCartPositionMetersFor(challenge: Challenge, progress: number, durationMs: number): number {
  const p = clamp01(progress);
  const vi = challenge.initialVelocity ?? 0;
  const vf = impulseTrueFinalVelocity(challenge);
  const impactSeconds = impulseImpactProgress(challenge, durationMs) * (durationMs / 1000);
  const tSeconds = p * (durationMs / 1000);
  if (tSeconds <= impactSeconds) return vi * tSeconds;
  return vi * impactSeconds + vf * (tSeconds - impactSeconds);
}

// -- Conservation of Momentum (cart vs. cart) ------------------------------

function momentumGapMeters(): number {
  return 2 * MOMENTUM_TRACK_HALF_GAP_M - 2 * CART_HALF_WIDTH_M;
}

function momentumClosingSpeed(challenge: Challenge): number {
  return (challenge.velocity1 ?? 0) - (challenge.velocity2 ?? 0);
}

export function momentumRunDurationMs(challenge: Challenge): number {
  return impactRunDurationMs(momentumGapMeters(), momentumClosingSpeed(challenge));
}

export function momentumCollisionProgress(challenge: Challenge, durationMs: number): number {
  return impactProgressAt(momentumGapMeters(), momentumClosingSpeed(challenge), durationMs);
}

export function momentumHasCollidedAt(challenge: Challenge, progress: number, durationMs: number): boolean {
  return clamp01(progress) >= momentumCollisionProgress(challenge, durationMs);
}

// Cart A/B positions (m, measured from the track's center; cart A starts on
// the left) - constant pre-collision velocities (velocity1/velocity2), one
// instantaneous collision, then constant post-collision velocities
// (finalVelocity1/finalVelocity2 - the real physics from physics.ts's
// elastic/inelastic formulas, never the player's guess) for the remaining
// real physical time. A perfectly inelastic collision visibly sticks the two
// carts together at the same position from the collision instant onward.
export function momentumCartPositionsMetersFor(challenge: Challenge, progress: number, durationMs: number): { xA: number; xB: number } {
  const p = clamp01(progress);
  const u1 = challenge.velocity1 ?? 0;
  const u2 = challenge.velocity2 ?? 0;
  const v1 = challenge.finalVelocity1 ?? u1;
  const v2 = challenge.finalVelocity2 ?? u2;
  const collisionSeconds = momentumCollisionProgress(challenge, durationMs) * (durationMs / 1000);
  const tSeconds = p * (durationMs / 1000);

  const startXA = -MOMENTUM_TRACK_HALF_GAP_M;
  const startXB = MOMENTUM_TRACK_HALF_GAP_M;

  if (tSeconds <= collisionSeconds) {
    return { xA: startXA + u1 * tSeconds, xB: startXB + u2 * tSeconds };
  }
  const collisionXA = startXA + u1 * collisionSeconds;
  const collisionXB = startXB + u2 * collisionSeconds;
  const afterSeconds = tSeconds - collisionSeconds;
  if (challenge.collisionType === "inelastic") {
    const stuckX = (collisionXA + collisionXB) / 2;
    return { xA: stuckX + v1 * afterSeconds, xB: stuckX + v2 * afterSeconds };
  }
  return { xA: collisionXA + v1 * afterSeconds, xB: collisionXB + v2 * afterSeconds };
}

// -- Circular Motion (object orbiting a fixed center) ----------------------

// How many full revolutions this run's difficulty tier requires - 1
// Beginner / 2 Intermediate / 3 Advanced (see adaptiveEngine.ts's
// `revolutions` field). Falls back to 1 for any challenge that somehow
// wasn't generated with it.
export function circularRevolutionsRequired(challenge: Challenge): number {
  return challenge.revolutions ?? 1;
}

// The real physical seconds for the object to complete its required
// revolutions at the true angular velocity a correct answer would produce
// (see circularSimParamsFor) - the physical endpoint this run's presentation
// duration is derived from, same role as newtonPhysicalSecondsFor/
// timeToImpactSeconds play for their own modules. Falls back to a
// near-minimum run only if the resolved speed/radius can't produce a valid,
// positive angular velocity (e.g. an empty/zero live-preview guess before
// the player has typed a real value).
export function circularPhysicalSecondsFor(challenge: Challenge, submittedValue: number): number {
  const { radius, speed } = circularSimParamsFor(challenge, submittedValue);
  const omega = speed / radius;
  if (!Number.isFinite(omega) || omega <= 0) return MIN_RUN_MS / 1000;
  return (circularRevolutionsRequired(challenge) * 2 * Math.PI) / omega;
}

export function circularRunDurationMs(challenge: Challenge, submittedValue: number): number {
  return clampRunMs(circularPhysicalSecondsFor(challenge, submittedValue) * 1000);
}

// The object's angle (radians, standard math convention, increasing
// counter-clockwise) at a given progress (0..1) through the run - uniform
// angular velocity compressed/stretched into durationMs still traces out
// exactly `revolutions` full turns by progress 1 (never short of it, and
// never more), regardless of how much that duration was compressed or
// stretched from real time.
export function circularAngleAt(challenge: Challenge, progress: number): number {
  return clamp01(progress) * circularRevolutionsRequired(challenge) * 2 * Math.PI;
}

// How many of the required revolutions have been completed at a given
// progress - drives the HUD's lap readout and the render layer's lap
// indicator.
export function circularRevolutionsCompletedAt(challenge: Challenge, progress: number): number {
  return clamp01(progress) * circularRevolutionsRequired(challenge);
}

export type ExperimentPhase = "idle" | "running" | "complete";

// A pure function of elapsed time - the actual timing gate GameCanvas.tsx
// uses to decide when it's allowed to compute the real result. "complete"
// is only ever reached once, at or after durationMs; nothing before that
// point may score, update mastery, or emit a learning event. durationMs is
// itself derived from real physics per run (see *RunDurationMs below) -
// never a constant unrelated to what's actually being simulated.
export function experimentPhaseAt(elapsedMs: number, durationMs: number): { phase: ExperimentPhase; progress: number } {
  if (elapsedMs <= 0) return { phase: "idle", progress: 0 };
  if (elapsedMs >= durationMs) return { phase: "complete", progress: 1 };
  return { phase: "running", progress: elapsedMs / durationMs };
}

// How long (ms) a Newton run should visually take: the real time needed to
// cross NEWTON_TRACK_DISTANCE_M under the submitted force's predicted
// acceleration (s = 1/2 a t^2, solved for t), compressed/stretched to stay
// watchable. Falls back to RUN_DURATION_MS only when the predicted
// acceleration can't carry the cart across the track at all (zero, negative,
// or reversing) - there is then no physical endpoint to time against, so a
// fixed presentation length is the honest fallback, not a substitute for one.
export function newtonRunDurationMs(accelMps2: number): number {
  if (!Number.isFinite(accelMps2) || accelMps2 <= 0) return RUN_DURATION_MS;
  const physicalSeconds = Math.sqrt((2 * NEWTON_TRACK_DISTANCE_M) / accelMps2);
  return clampRunMs(physicalSeconds * 1000);
}

// The real physical time (seconds) a Newton run's presentation duration
// stands in for. Lets displacement land on exactly NEWTON_TRACK_DISTANCE_M
// at progress 1 no matter how much durationMs was compressed or stretched
// relative to real time.
function newtonPhysicalSecondsFor(accelMps2: number, durationMs: number): number {
  if (!Number.isFinite(accelMps2) || accelMps2 <= 0) return durationMs / 1000;
  return Math.sqrt((2 * NEWTON_TRACK_DISTANCE_M) / accelMps2);
}

// The presentation duration for a given challenge/submitted-value pair -
// the single source of truth GameCanvas.tsx uses both to know when the run
// has physically completed and to drive the HUD/canvas animation, so the two
// can never diverge.
export function nonProjectileRunDurationMs(challenge: Challenge, submittedValue: number): number {
  switch (challenge.conceptId) {
    case CONCEPT_FORCE_ACCELERATION:
    case CONCEPT_NET_FORCE:
    case CONCEPT_FRICTION:
      return newtonRunDurationMs(predictedValue(challenge, submittedValue));
    case CONCEPT_IMPULSE:
      return impulseRunDurationMs(challenge);
    case CONCEPT_CONSERVATION_MOMENTUM:
      return momentumRunDurationMs(challenge);
    case CONCEPT_CENTRIPETAL_FORCE:
    case CONCEPT_CENTRIPETAL_ACCELERATION:
    case CONCEPT_CIRCULAR_SPEED:
      return circularRunDurationMs(challenge, submittedValue);
    default:
      return RUN_DURATION_MS;
  }
}

// Projectile Motion's presentation duration: the real flight time,
// compressed/stretched to stay watchable - replaces the old fixed
// flightTime*550ms-capped-at-2600ms timeout, which ran on a different clock
// than the rAF-driven trajectory render and could fire well before the
// projectile visually landed.
export function projectileRunDurationMs(flightTimeSeconds: number): number {
  if (!Number.isFinite(flightTimeSeconds) || flightTimeSeconds <= 0) return MIN_RUN_MS;
  return clampRunMs(flightTimeSeconds * 1000);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export interface RunningReadout {
  lines: { label: string; value: string }[];
}

// What to show in the "EXPERIMENT RUNNING" HUD while a non-projectile
// experiment plays out - every number here is derived from the same
// submitted value and challenge fields the final result uses, interpolated
// by progress (0..1). At progress=1 these numbers exactly match what the
// result card will show, so the animation never diverges from the outcome.
// Projectile Motion has its own dedicated flight visualization and returns
// null here.
export function runningReadoutFor(challenge: Challenge, submittedValue: number, progress: number, durationMs: number = RUN_DURATION_MS): RunningReadout | null {
  const p = clamp01(progress);
  switch (challenge.conceptId) {
    case CONCEPT_WORK: {
      const distance = challenge.distance ?? 0;
      const liveDistance = p * distance;
      const liveWork = work(submittedValue, liveDistance);
      return {
        lines: [
          { label: "Force", value: `${submittedValue.toFixed(1)} N` },
          { label: "Distance", value: `${liveDistance.toFixed(1)} / ${distance.toFixed(1)} m` },
          { label: "Work", value: `${liveWork.toFixed(1)} J` },
        ],
      };
    }
    case CONCEPT_KINETIC_ENERGY: {
      const liveVelocity = p * submittedValue;
      const liveKe = kineticEnergy(challenge.mass ?? 1, liveVelocity);
      return {
        lines: [
          { label: "Velocity", value: `${liveVelocity.toFixed(1)} m/s` },
          { label: "Kinetic Energy", value: `${liveKe.toFixed(1)} J` },
        ],
      };
    }
    case CONCEPT_WORK_ENERGY_THEOREM: {
      const finalVelocity = finalVelocityFromWork(challenge, submittedValue);
      const liveVelocity = lerp(challenge.initialVelocity ?? 0, finalVelocity, p);
      const liveWork = p * submittedValue;
      return {
        lines: [
          { label: "Work Applied", value: `${liveWork.toFixed(1)} J` },
          { label: "Velocity", value: `${liveVelocity.toFixed(1)} m/s` },
        ],
      };
    }
    case CONCEPT_FORCE_ACCELERATION:
    case CONCEPT_NET_FORCE:
    case CONCEPT_FRICTION: {
      const accel = predictedValue(challenge, submittedValue);
      const liveVelocity = accel * (p * (RUN_DURATION_MS / 1000));
      return {
        lines: [
          { label: "Applied Force", value: `${submittedValue.toFixed(1)} N` },
          { label: "Acceleration", value: `${accel.toFixed(2)} m/s²` },
          { label: "Velocity", value: `${liveVelocity.toFixed(2)} m/s` },
        ],
      };
    }
    // Momentum: the cart's velocity is either a given fact (momentumSolveFor
    // "momentum") or the player's own guess plugged into p=mv (matching
    // predictedValue exactly) - what's shown always ramps toward whatever
    // value the final momentum is actually computed from.
    case CONCEPT_MOMENTUM: {
      const mass = challenge.momentumSolveFor === "mass" ? submittedValue : challenge.mass ?? 1;
      const targetVelocity = challenge.momentumSolveFor === "velocity" ? submittedValue : challenge.velocity ?? 0;
      const liveVelocity = p * targetVelocity;
      const liveMomentum = momentum(mass, liveVelocity);
      return {
        lines: [
          { label: "Velocity", value: `${liveVelocity.toFixed(1)} m/s` },
          { label: "Momentum", value: `${liveMomentum.toFixed(1)} kg·m/s` },
        ],
      };
    }
    // Impulse: the cart genuinely approaches the barrier at initialVelocity,
    // then (once the real physical impact instant is reached) departs at the
    // true final velocity - the impulse readout only appears once the impact
    // has actually happened, never before.
    case CONCEPT_IMPULSE: {
      const impactP = impulseImpactProgress(challenge, durationMs);
      const vi = challenge.initialVelocity ?? 0;
      const vf = impulseTrueFinalVelocity(challenge);
      const impacted = p >= impactP;
      const liveVelocity = impacted ? vf : vi;
      return {
        lines: [
          { label: "Velocity", value: `${liveVelocity.toFixed(1)} m/s` },
          { label: impacted ? "Impulse" : "Approaching Barrier", value: impacted ? `${impulse(challenge.mass ?? 1, vi, vf).toFixed(1)} N·s` : "—" },
        ],
      };
    }
    // Conservation of Momentum: the flagship "before/after" readout - total
    // momentum is shown continuously, and reads identically before and
    // after the collision (within rounding), demonstrating conservation
    // live rather than only asserting it on the result card afterward.
    case CONCEPT_CONSERVATION_MOMENTUM: {
      const collisionP = momentumCollisionProgress(challenge, durationMs);
      const m1 = challenge.mass1 ?? 0;
      const m2 = challenge.mass2 ?? 0;
      const before = totalMomentum(m1, challenge.velocity1 ?? 0, m2, challenge.velocity2 ?? 0);
      const collided = p >= collisionP;
      const after = totalMomentum(m1, challenge.finalVelocity1 ?? 0, m2, challenge.finalVelocity2 ?? 0);
      return {
        lines: [
          { label: "Momentum Before", value: `${before.toFixed(1)} kg·m/s` },
          { label: "Momentum After", value: collided ? `${after.toFixed(1)} kg·m/s` : "—" },
        ],
      };
    }
    // Circular Motion: speed and the live inward force/acceleration, both
    // derived from the same true simulation parameters the object is
    // actually orbiting with (see circularSimParamsFor) - plus how many of
    // the required revolutions have been completed so far.
    case CONCEPT_CENTRIPETAL_FORCE: {
      const { mass, radius, speed } = circularSimParamsFor(challenge, submittedValue);
      const revolutions = circularRevolutionsCompletedAt(challenge, p);
      return {
        lines: [
          { label: "Speed", value: `${speed.toFixed(1)} m/s` },
          { label: "Centripetal Force", value: `${centripetalForceFromSpeed(mass, speed, radius).toFixed(1)} N` },
          { label: "Revolutions", value: `${revolutions.toFixed(1)} / ${circularRevolutionsRequired(challenge)}` },
        ],
      };
    }
    case CONCEPT_CENTRIPETAL_ACCELERATION: {
      const { radius, speed } = circularSimParamsFor(challenge, submittedValue);
      const revolutions = circularRevolutionsCompletedAt(challenge, p);
      return {
        lines: [
          { label: "Speed", value: `${speed.toFixed(1)} m/s` },
          { label: "Centripetal Accel.", value: `${centripetalAccelerationFromSpeed(speed, radius).toFixed(2)} m/s²` },
          { label: "Revolutions", value: `${revolutions.toFixed(1)} / ${circularRevolutionsRequired(challenge)}` },
        ],
      };
    }
    case CONCEPT_CIRCULAR_SPEED: {
      const { radius, speed } = circularSimParamsFor(challenge, submittedValue);
      const revolutions = circularRevolutionsCompletedAt(challenge, p);
      return {
        lines: [
          { label: "Speed", value: `${speed.toFixed(1)} m/s` },
          { label: "Angular Velocity", value: `${(speed / radius).toFixed(2)} rad/s` },
          { label: "Revolutions", value: `${revolutions.toFixed(1)} / ${circularRevolutionsRequired(challenge)}` },
        ],
      };
    }
    default:
      return null;
  }
}

// How far (in meters, along whichever axis the scene uses) the Newton
// cart or Work & Energy object should visibly have moved at a given
// progress - real kinematics from the same predicted value the result
// uses, not a decorative animation unrelated to the physics. durationMs
// should be the same value experimentPhaseAt used to produce `progress`
// (nonProjectileRunDurationMs for the same challenge/submittedValue) so a
// Newton cart's displacement reaches exactly NEWTON_TRACK_DISTANCE_M at
// progress 1 regardless of how much that duration was compressed or
// stretched from real time. Defaults to RUN_DURATION_MS for callers (tests,
// mainly) that only care about the fixed-duration concepts.
export function runningDisplacementMetersFor(challenge: Challenge, submittedValue: number, progress: number, durationMs: number = RUN_DURATION_MS): number {
  const p = clamp01(progress);
  switch (challenge.conceptId) {
    case CONCEPT_WORK:
      return p * (challenge.distance ?? 0);
    case CONCEPT_FORCE_ACCELERATION:
    case CONCEPT_NET_FORCE:
    case CONCEPT_FRICTION: {
      // s = 1/2 a t^2 using the actual predicted acceleration for the
      // submitted force - a genuinely accelerating motion, not a linear
      // slide - run for the physical time that acceleration needs to cross
      // the track, not an arbitrary fixed window.
      const accel = predictedValue(challenge, submittedValue);
      const physicalSeconds = newtonPhysicalSecondsFor(accel, durationMs);
      const tSeconds = p * physicalSeconds;
      return 0.5 * accel * tSeconds * tSeconds;
    }
    default:
      // Kinetic Energy / Work-Energy Theorem don't have a "distance" given
      // - a modest fixed nominal travel communicates motion without
      // implying a displacement value that was never part of the concept.
      return p * 3;
  }
}

export function isNonProjectileModule(challenge: Challenge): boolean {
  return challenge.moduleId !== MODULE_PROJECTILE;
}
