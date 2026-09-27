// --------------------------------------------------------------------------
// Gravitation & Orbits - Layer 4: the "challenge/game controller" from the
// architecture in the Layer 4 brief. Two pure responsibilities, neither of
// which touches React or the DOM (matching this codebase's convention of
// keeping testable logic out of .tsx files - see HowToPlay.test.ts's own
// note that there is no component-rendering harness in this repo):
//
//   1. gravitationSimSetupFor(challenge) - converts a Challenge already
//      produced by AdaptiveEngine (MODULE_GRAVITATION) into the concrete
//      (starMass, orbitalRadius, velocity range/default) gravitationSim.ts
//      needs to run. Never invents a second challenge system - every number
//      either comes straight from the Challenge or is derived by inverting
//      the SAME physics.ts formula the adaptive engine itself used to
//      generate that Challenge (e.g. v_orbit = sqrt(GM/r) solved for r
//      instead of v), for the tiers where the adaptive engine intentionally
//      hides one field for the player to guess.
//
//   2. A small explicit READY / RUNNING / OUTCOME state machine
//      (GravitationPlayState) for the launch/reset gameplay loop. It reacts
//      to gravitationSim.ts's own status values - it never re-derives
//      collision/orbit/escape itself.
// --------------------------------------------------------------------------

import { GRAVITY_SIM_G, orbitalVelocity, escapeVelocity } from "./physics";
import { CONCEPT_GRAVITATIONAL_FORCE, CONCEPT_ORBITAL_VELOCITY, CONCEPT_ESCAPE_VELOCITY, type Challenge } from "./adaptiveEngine";
import type { GravitationSimStatus } from "./gravitationSim";

export interface GravitationChallengeSetup {
  readonly starMass: number;
  readonly orbitalRadius: number;
  // A sensible starting point for the velocity control - the actual
  // circular orbital velocity at (starMass, orbitalRadius), so the demo
  // starts from a recognizable stable case the player can then push below
  // (fall), near (orbit), or above (ellipse/escape).
  readonly defaultInitialVelocity: number;
  readonly minVelocity: number;
  readonly maxVelocity: number;
  readonly promptLabel: string;
  readonly targetValue: number;
  readonly targetUnit: string;
}

const MIN_VELOCITY = 0;
// 1.5x escape velocity comfortably covers all four regimes (fall, circular,
// elliptical, escape) with room either side of the boundary velocities.
const MAX_VELOCITY_ESCAPE_MULTIPLIER = 1.5;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Builds the setup for CONCEPT_GRAVITATIONAL_FORCE. distanceFromStar is only
// absent when gravitationForceSolveFor === "distance" (the adaptive engine
// hides it so the player must find it); it's recovered from the same
// F = GMm/r^2 relationship, solved for r, using the given starMass,
// planetMass and the challenge's own targetGravitationalForce.
function setupForGravitationalForce(challenge: Challenge): GravitationChallengeSetup {
  const starMass = challenge.starMass ?? 0;
  const planetMass = challenge.planetMass ?? 1;
  const targetGravitationalForce = challenge.targetGravitationalForce ?? 0;

  const orbitalRadius =
    challenge.distanceFromStar ?? Math.sqrt((GRAVITY_SIM_G * starMass * planetMass) / targetGravitationalForce);

  const solveFor = challenge.gravitationForceSolveFor ?? "force";
  const promptLabel =
    solveFor === "distance"
      ? `A star of mass ${starMass} pulls a ${planetMass}-mass planet with a force of ${targetGravitationalForce} N. What is the distance between them?`
      : solveFor === "planetMass"
        ? `A star of mass ${starMass} at distance ${orbitalRadius.toFixed(2)} pulls a planet with a force of ${targetGravitationalForce} N. What is the planet's mass?`
        : `A star of mass ${starMass} and a planet of mass ${planetMass} are ${orbitalRadius.toFixed(2)} apart. What is the gravitational force between them?`;

  const vOrbit = orbitalVelocity(GRAVITY_SIM_G, starMass, orbitalRadius);
  const vEscape = escapeVelocity(GRAVITY_SIM_G, starMass, orbitalRadius);
  return {
    starMass,
    orbitalRadius,
    defaultInitialVelocity: round2(vOrbit),
    minVelocity: MIN_VELOCITY,
    maxVelocity: round2(vEscape * MAX_VELOCITY_ESCAPE_MULTIPLIER),
    promptLabel,
    targetValue: targetGravitationalForce,
    targetUnit: challenge.unit,
  };
}

// Builds the setup for CONCEPT_ORBITAL_VELOCITY. Exactly one of
// starMass/distanceFromStar is absent depending on orbitalVelocitySolveFor;
// it's recovered by solving v_orbit = sqrt(GM/r) for whichever is missing,
// using the challenge's own targetOrbitalVelocity - the same formula
// physics.ts already exports, just solved for a different variable.
function setupForOrbitalVelocity(challenge: Challenge): GravitationChallengeSetup {
  const targetOrbitalVelocity = challenge.targetOrbitalVelocity ?? 0;
  const solveFor = challenge.orbitalVelocitySolveFor ?? "velocity";

  let starMass = challenge.starMass;
  let orbitalRadius = challenge.distanceFromStar;
  if (starMass === undefined) {
    // v^2 = GM/r  =>  M = v^2 * r / G
    starMass = (targetOrbitalVelocity * targetOrbitalVelocity * (orbitalRadius ?? 0)) / GRAVITY_SIM_G;
  }
  if (orbitalRadius === undefined) {
    // v^2 = GM/r  =>  r = GM / v^2
    orbitalRadius = (GRAVITY_SIM_G * starMass) / (targetOrbitalVelocity * targetOrbitalVelocity);
  }

  const promptLabel =
    solveFor === "distance"
      ? `A stable circular orbit around a star of mass ${starMass.toFixed(1)} requires ${targetOrbitalVelocity} m/s. What orbital radius does that correspond to?`
      : solveFor === "starMass"
        ? `A stable circular orbit at distance ${orbitalRadius.toFixed(2)} requires ${targetOrbitalVelocity} m/s. What is the star's mass?`
        : `What launch velocity keeps the planet in a stable circular orbit at distance ${orbitalRadius.toFixed(2)} around a star of mass ${starMass.toFixed(1)}?`;

  const vEscape = escapeVelocity(GRAVITY_SIM_G, starMass, orbitalRadius);
  return {
    starMass,
    orbitalRadius,
    defaultInitialVelocity: round2(targetOrbitalVelocity),
    minVelocity: MIN_VELOCITY,
    maxVelocity: round2(vEscape * MAX_VELOCITY_ESCAPE_MULTIPLIER),
    promptLabel,
    targetValue: targetOrbitalVelocity,
    targetUnit: challenge.unit,
  };
}

// Builds the setup for CONCEPT_ESCAPE_VELOCITY. Mirrors setupForOrbitalVelocity,
// solving v_escape = sqrt(2GM/r) for whichever of starMass/distanceFromStar
// the adaptive engine hid for that tier.
function setupForEscapeVelocity(challenge: Challenge): GravitationChallengeSetup {
  const targetEscapeVelocity = challenge.targetEscapeVelocity ?? 0;
  const solveFor = challenge.escapeVelocitySolveFor ?? "velocity";

  let starMass = challenge.starMass;
  let orbitalRadius = challenge.distanceFromStar;
  if (starMass === undefined) {
    // v^2 = 2GM/r  =>  M = v^2 * r / (2G)
    starMass = (targetEscapeVelocity * targetEscapeVelocity * (orbitalRadius ?? 0)) / (2 * GRAVITY_SIM_G);
  }
  if (orbitalRadius === undefined) {
    // v^2 = 2GM/r  =>  r = 2GM / v^2
    orbitalRadius = (2 * GRAVITY_SIM_G * starMass) / (targetEscapeVelocity * targetEscapeVelocity);
  }

  const promptLabel =
    solveFor === "distance"
      ? `Escape velocity is ${targetEscapeVelocity} m/s for a star of mass ${starMass.toFixed(1)}. What distance does that correspond to?`
      : solveFor === "starMass"
        ? `Escape velocity from distance ${orbitalRadius.toFixed(2)} is ${targetEscapeVelocity} m/s. What is the star's mass?`
        : `What is the minimum launch velocity to escape a star of mass ${starMass.toFixed(1)} from distance ${orbitalRadius.toFixed(2)}?`;

  return {
    starMass,
    orbitalRadius,
    defaultInitialVelocity: round2(orbitalVelocity(GRAVITY_SIM_G, starMass, orbitalRadius)),
    minVelocity: MIN_VELOCITY,
    maxVelocity: round2(targetEscapeVelocity * MAX_VELOCITY_ESCAPE_MULTIPLIER),
    promptLabel,
    targetValue: targetEscapeVelocity,
    targetUnit: challenge.unit,
  };
}

// The single entry point: dispatches on conceptId, exactly like every other
// per-concept dispatch in this codebase (challengeLogic.ts's own
// controlRangeFor/predictedValue/etc.) - never a second engine, just reading
// the Challenge the real AdaptiveEngine already produced.
export function gravitationSimSetupFor(challenge: Challenge): GravitationChallengeSetup {
  if (challenge.conceptId === CONCEPT_ORBITAL_VELOCITY) return setupForOrbitalVelocity(challenge);
  if (challenge.conceptId === CONCEPT_ESCAPE_VELOCITY) return setupForEscapeVelocity(challenge);
  if (challenge.conceptId === CONCEPT_GRAVITATIONAL_FORCE) return setupForGravitationalForce(challenge);
  throw new Error(`gravitationSimSetupFor: unsupported conceptId ${challenge.conceptId}`);
}

// --------------------------------------------------------------------------
// Launch/reset state machine (READY / RUNNING / OUTCOME)
// --------------------------------------------------------------------------

export type GravitationPlayPhase = "READY" | "RUNNING" | "OUTCOME";

export interface GravitationPlayState {
  readonly phase: GravitationPlayPhase;
  readonly velocity: number;
  // Bumped on every reset so a controlled GravitationScene can be told to
  // start a genuinely fresh run even when the velocity is unchanged from
  // the previous attempt.
  readonly attemptId: number;
  readonly outcomeStatus: GravitationSimStatus | null;
}

const TERMINAL_OUTCOME_STATUSES: ReadonlySet<GravitationSimStatus> = new Set(["collision", "orbit", "escape"]);

export function createGravitationPlayState(setup: GravitationChallengeSetup): GravitationPlayState {
  return { phase: "READY", velocity: setup.defaultInitialVelocity, attemptId: 0, outcomeStatus: null };
}

// Controls are only meaningful in READY - a no-op otherwise, so a stray
// slider event during RUNNING/OUTCOME can never change the in-flight
// simulation's initial conditions.
export function setGravitationVelocity(state: GravitationPlayState, velocity: number): GravitationPlayState {
  if (state.phase !== "READY") return state;
  return { ...state, velocity };
}

export function launchGravitationAttempt(state: GravitationPlayState): GravitationPlayState {
  if (state.phase !== "READY") return state;
  return { ...state, phase: "RUNNING" };
}

// The UI's reaction to gravitationSim.ts's own status - never a second
// outcome classification. Only a terminal status arriving while RUNNING
// moves the state machine to OUTCOME; "running"/"idle"/"stopped" are
// intermediate/inapplicable here and left alone.
export function applyGravitationSimStatus(state: GravitationPlayState, status: GravitationSimStatus): GravitationPlayState {
  if (state.phase !== "RUNNING") return state;
  if (!TERMINAL_OUTCOME_STATUSES.has(status)) return state;
  return { ...state, phase: "OUTCOME", outcomeStatus: status };
}

export function resetGravitationAttempt(state: GravitationPlayState, setup: GravitationChallengeSetup): GravitationPlayState {
  return { phase: "READY", velocity: setup.defaultInitialVelocity, attemptId: state.attemptId + 1, outcomeStatus: null };
}

export function areGravitationControlsLocked(state: GravitationPlayState): boolean {
  return state.phase !== "READY";
}
