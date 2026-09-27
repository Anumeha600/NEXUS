// --------------------------------------------------------------------------
// Gravitation & Orbits - Layer 2: the actual stepped two-body simulation.
//
// Layer 1 (physics.ts) supplied the pure formulas and a single integration
// step (integrateGravityStep). This module builds the runtime simulation on
// top of it: a typed state object, deterministic reset/step/advance
// functions, trajectory recording, and physics-based outcome detection
// (collision / bounded orbit / escape). It intentionally reuses every
// physics.ts function rather than re-deriving any formula.
//
// No rendering and no GameCanvas wiring here - this file is simulation data
// only, following the same "physics.ts vs render.ts vs GameCanvas.tsx"
// separation of concerns as every other module. The module is not reachable
// from the UI (see adaptiveEngine.ts's MODULE_GRAVITATION doc comment and
// shared/src/curriculum.ts's `available: false`).
// --------------------------------------------------------------------------

import { GRAVITY_SIM_G, gravitationalAccelerationVector, integrateGravityStep, specificOrbitalEnergy, type OrbitState } from "./physics";

// The fixed physics timestep, in simulation-seconds. Every call to
// stepGravitationSim advances the simulation by exactly this much - the
// same value used throughout Layer 1's own integrateGravityStep tests at
// this star-mass/radius scale, small enough for the symplectic integrator
// to stay accurate across the tightest orbits the challenge generator
// produces (radius as low as 3, star mass as high as 260).
export const GRAVITATION_FIXED_TIMESTEP = 0.01;

// Cap on fixed steps executed within one advanceGravitationSim call, so a
// single large frame delta (e.g. a backgrounded browser tab resuming) can't
// force thousands of synchronous integration steps in one frame - a classic
// "spiral of death" guard for fixed-timestep accumulators.
export const GRAVITATION_MAX_STEPS_PER_ADVANCE = 400;

// Trajectory is sampled every N fixed steps (not every step) so a multi-orbit
// run doesn't record an unbounded, redundant number of near-identical points.
export const GRAVITATION_TRAJECTORY_SAMPLE_EVERY_N_STEPS = 4;

// Hard cap on stored trajectory points - once reached, the oldest points are
// dropped so memory/render cost stay bounded regardless of how long the
// simulation runs, while still keeping enough recent history to show the
// orbit/trajectory shape clearly.
export const GRAVITATION_MAX_TRAJECTORY_POINTS = 500;

export type GravitationSimStatus = "idle" | "running" | "orbit" | "collision" | "escape" | "stopped";

const TERMINAL_STATUSES: ReadonlySet<GravitationSimStatus> = new Set(["orbit", "collision", "escape", "stopped"]);

export interface GravitationSimConfig {
  readonly G: number;
  readonly starMass: number;
  readonly planetMass: number;
  readonly starX: number;
  readonly starY: number;
  // The radius the planet was launched at - every threshold below is
  // expressed relative to this, so they scale automatically with whatever
  // radius the challenge generator produced.
  readonly initialRadius: number;
  // Below this distance from the star, the planet has collided with it.
  // Always smaller than initialRadius (per the module's own requirement).
  readonly collisionRadius: number;
  // Escape is only confirmed once the planet has traveled at least this far
  // from the star (in addition to the energy/direction checks below) - see
  // classifyStatus's doc comment for why distance alone isn't sufficient.
  readonly escapeConfirmRadius: number;
  // A bound (non-escaping) trajectory is only classified "orbit" while it
  // stays within this radius - guards against calling a wide, still-bound
  // ellipse an "orbit" before it has actually come back around.
  readonly maxBoundedRadius: number;
  // Cumulative angular travel (radians) required before a bounded,
  // collision-free trajectory counts as a demonstrated orbit. Default is one
  // full revolution (2*PI): by then the planet has genuinely come back
  // around the star under gravity, not just moved in an arc.
  readonly orbitAngleThreshold: number;
}

export interface GravitationTrajectoryPoint {
  readonly x: number;
  readonly y: number;
}

export interface GravitationSimState {
  readonly config: GravitationSimConfig;
  readonly planetX: number;
  readonly planetY: number;
  readonly planetVx: number;
  readonly planetVy: number;
  readonly elapsedTime: number;
  readonly status: GravitationSimStatus;
  readonly trajectory: readonly GravitationTrajectoryPoint[];
  // Internal bookkeeping, exposed read-only for tests/inspection rather than
  // hidden in a closure - kept in the same plain, serializable state object
  // as everything else instead of a second parallel structure.
  readonly stepCount: number;
  readonly cumulativeAngle: number;
  readonly lastAngle: number;
  readonly accumulator: number;
  readonly initial: OrbitState;
}

export interface CreateGravitationSimOptions {
  // Defaults to GRAVITY_SIM_G - only overridable for tests; real challenges
  // always use the shared simulation-scale constant.
  G?: number;
  starMass: number;
  // Accepted so a future gameplay layer can pass the challenge's planet mass
  // through, but it never affects the trajectory: gravitational acceleration
  // on the planet is independent of the planet's own mass (see physics.ts's
  // gravitationalAccelerationMagnitude), exactly like a feather and a
  // hammer falling together.
  planetMass?: number;
  // Initial planet position is (orbitalRadius, 0) and initial velocity is
  // (0, initialVelocity) - a tangential launch, per the module's required
  // initial condition.
  orbitalRadius: number;
  initialVelocity: number;
  // Threshold overrides, all expressed as multiples of orbitalRadius except
  // orbitAngleThreshold. Sensible defaults are used when omitted.
  collisionRadiusFraction?: number;
  escapeRadiusMultiplier?: number;
  boundedRadiusMultiplier?: number;
  orbitAngleThreshold?: number;
}

const DEFAULT_COLLISION_RADIUS_FRACTION = 0.15;
const DEFAULT_ESCAPE_RADIUS_MULTIPLIER = 4;
const DEFAULT_BOUNDED_RADIUS_MULTIPLIER = 6;
const DEFAULT_ORBIT_ANGLE_THRESHOLD = Math.PI * 2;

// A trajectory only counts as "escaping" once its specific orbital energy is
// clearly positive - a tiny epsilon guards against a launch velocity that is
// numerically indistinguishable from exactly escapeVelocity (E == 0, the
// parabolic boundary case) being misclassified either way by floating-point
// noise.
const ESCAPE_ENERGY_EPSILON = 1e-6;

export function createGravitationSimState(options: CreateGravitationSimOptions): GravitationSimState {
  const G = options.G ?? GRAVITY_SIM_G;
  const collisionRadiusFraction = options.collisionRadiusFraction ?? DEFAULT_COLLISION_RADIUS_FRACTION;
  const escapeRadiusMultiplier = options.escapeRadiusMultiplier ?? DEFAULT_ESCAPE_RADIUS_MULTIPLIER;
  const boundedRadiusMultiplier = options.boundedRadiusMultiplier ?? DEFAULT_BOUNDED_RADIUS_MULTIPLIER;
  const orbitAngleThreshold = options.orbitAngleThreshold ?? DEFAULT_ORBIT_ANGLE_THRESHOLD;

  const config: GravitationSimConfig = {
    G,
    starMass: options.starMass,
    planetMass: options.planetMass ?? 1,
    starX: 0,
    starY: 0,
    initialRadius: options.orbitalRadius,
    collisionRadius: options.orbitalRadius * collisionRadiusFraction,
    escapeConfirmRadius: options.orbitalRadius * escapeRadiusMultiplier,
    maxBoundedRadius: options.orbitalRadius * boundedRadiusMultiplier,
    orbitAngleThreshold,
  };

  const initial: OrbitState = { x: options.orbitalRadius, y: 0, vx: 0, vy: options.initialVelocity };

  return {
    config,
    planetX: initial.x,
    planetY: initial.y,
    planetVx: initial.vx,
    planetVy: initial.vy,
    elapsedTime: 0,
    status: "idle",
    trajectory: [{ x: initial.x, y: initial.y }],
    stepCount: 0,
    cumulativeAngle: 0,
    lastAngle: Math.atan2(initial.y, initial.x),
    accumulator: 0,
    initial,
  };
}

// Restores exactly the initial conditions the state was created with -
// config (thresholds, masses, G) is preserved, everything derived from the
// planet's motion is reset to its starting value.
export function resetGravitationSim(state: GravitationSimState): GravitationSimState {
  return {
    ...state,
    planetX: state.initial.x,
    planetY: state.initial.y,
    planetVx: state.initial.vx,
    planetVy: state.initial.vy,
    elapsedTime: 0,
    status: "idle",
    trajectory: [{ x: state.initial.x, y: state.initial.y }],
    stepCount: 0,
    cumulativeAngle: 0,
    lastAngle: Math.atan2(state.initial.y, state.initial.x),
    accumulator: 0,
  };
}

// Wraps an angle delta into (-PI, PI] so cumulative angle tracking doesn't
// see a spurious +-2*PI jump whenever atan2 wraps around from PI to -PI.
function wrapAngleDelta(delta: number): number {
  return Math.atan2(Math.sin(delta), Math.cos(delta));
}

// Physics-based outcome classification - deliberately never a bare distance
// cutoff. Collision is a simple, appropriate distance threshold (physically,
// the star has a surface). Escape requires all three of: positive specific
// orbital energy (the textbook bound/unbound boundary, see
// specificOrbitalEnergy), the planet having actually traveled well beyond
// its launch radius, AND currently moving outward (positive radial
// velocity) - energy alone is conserved from the very first step, so it is
// necessarily positive from t=0 for an escape-velocity launch even though
// the planet hasn't gone anywhere yet; the extra checks confirm the
// trajectory has genuinely departed rather than merely being launched fast.
// Orbit requires enough cumulative angular travel around the star while
// never having left the bounded radius and never having collided or
// escaped - a real "it came back around" demonstration, not a timeout.
function classifyStatus(params: {
  distance: number;
  cumulativeAngle: number;
  next: OrbitState;
  config: GravitationSimConfig;
}): GravitationSimStatus {
  const { distance, cumulativeAngle, next, config } = params;

  if (distance <= config.collisionRadius) {
    return "collision";
  }

  const energy = specificOrbitalEnergy(config.G, config.starMass, next.x, next.y, next.vx, next.vy);
  const radialVelocity = (next.x * next.vx + next.y * next.vy) / distance;
  if (energy > ESCAPE_ENERGY_EPSILON && distance >= config.escapeConfirmRadius && radialVelocity > 0) {
    return "escape";
  }

  if (Math.abs(cumulativeAngle) >= config.orbitAngleThreshold && distance <= config.maxBoundedRadius) {
    return "orbit";
  }

  return "running";
}

// Advances the simulation by exactly one fixed timestep (GRAVITATION_FIXED_TIMESTEP).
// A no-op once the simulation has reached a terminal status (orbit/collision/
// escape) or has been explicitly stopped - callers can keep calling this
// freely without checking status themselves first.
export function stepGravitationSim(state: GravitationSimState): GravitationSimState {
  if (TERMINAL_STATUSES.has(state.status)) {
    return state;
  }

  const current: OrbitState = { x: state.planetX, y: state.planetY, vx: state.planetVx, vy: state.planetVy };
  const next = integrateGravityStep(current, GRAVITATION_FIXED_TIMESTEP, state.config.G, state.config.starMass);

  const angle = Math.atan2(next.y, next.x);
  const cumulativeAngle = state.cumulativeAngle + wrapAngleDelta(angle - state.lastAngle);
  const stepCount = state.stepCount + 1;
  const distance = Math.hypot(next.x, next.y);

  let trajectory = state.trajectory;
  if (stepCount % GRAVITATION_TRAJECTORY_SAMPLE_EVERY_N_STEPS === 0) {
    const sampled = [...trajectory, { x: next.x, y: next.y }];
    trajectory = sampled.length > GRAVITATION_MAX_TRAJECTORY_POINTS ? sampled.slice(sampled.length - GRAVITATION_MAX_TRAJECTORY_POINTS) : sampled;
  }

  const status = classifyStatus({ distance, cumulativeAngle, next, config: state.config });

  return {
    ...state,
    planetX: next.x,
    planetY: next.y,
    planetVx: next.vx,
    planetVy: next.vy,
    elapsedTime: state.elapsedTime + GRAVITATION_FIXED_TIMESTEP,
    status,
    trajectory,
    stepCount,
    cumulativeAngle,
    lastAngle: angle,
  };
}

// Advances the simulation by a real-world frame delta (seconds), using a
// fixed-timestep accumulator: leftover time that doesn't fill a whole
// GRAVITATION_FIXED_TIMESTEP carries over to the next call in `accumulator`.
// This is what makes the physics independent of render frame rate - calling
// this once with dt=1 or many times with dt values summing to 1 produces the
// same trajectory (mod the max-steps safety cap below), because the
// underlying stepGravitationSim calls happen at the same fixed dt either way.
export function advanceGravitationSim(state: GravitationSimState, frameDeltaSeconds: number): GravitationSimState {
  if (TERMINAL_STATUSES.has(state.status)) {
    return state;
  }

  let next: GravitationSimState = { ...state, accumulator: state.accumulator + frameDeltaSeconds };
  let stepsRun = 0;

  while (next.accumulator >= GRAVITATION_FIXED_TIMESTEP && stepsRun < GRAVITATION_MAX_STEPS_PER_ADVANCE) {
    next = stepGravitationSim(next);
    next = { ...next, accumulator: next.accumulator - GRAVITATION_FIXED_TIMESTEP };
    stepsRun++;
    if (TERMINAL_STATUSES.has(next.status)) {
      break;
    }
  }

  return next;
}

// Explicit manual stop (e.g. the player pauses) - does nothing once a
// terminal outcome (orbit/collision/escape) has already been reached, so a
// stop can't overwrite a real physical outcome.
export function stopGravitationSim(state: GravitationSimState): GravitationSimState {
  if (state.status === "orbit" || state.status === "collision" || state.status === "escape") {
    return state;
  }
  return { ...state, status: "stopped" };
}

export interface GravitationRenderState {
  readonly starX: number;
  readonly starY: number;
  readonly planetX: number;
  readonly planetY: number;
  readonly velocity: { readonly vx: number; readonly vy: number };
  readonly acceleration: { readonly ax: number; readonly ay: number };
  readonly distanceFromStar: number;
  readonly trajectory: readonly GravitationTrajectoryPoint[];
  readonly elapsedTime: number;
  readonly status: GravitationSimStatus;
}

// The rendering contract for the next layer: everything a renderer needs to
// draw the current frame, derived from (never duplicated inside)
// GravitationSimState. No canvas/DOM code here - just a plain data selector.
export function gravitationRenderStateFor(state: GravitationSimState): GravitationRenderState {
  const { ax, ay } = gravitationalAccelerationVector(state.config.G, state.config.starMass, state.planetX, state.planetY);
  return {
    starX: state.config.starX,
    starY: state.config.starY,
    planetX: state.planetX,
    planetY: state.planetY,
    velocity: { vx: state.planetVx, vy: state.planetVy },
    acceleration: { ax, ay },
    distanceFromStar: Math.hypot(state.planetX, state.planetY),
    trajectory: state.trajectory,
    elapsedTime: state.elapsedTime,
    status: state.status,
  };
}
