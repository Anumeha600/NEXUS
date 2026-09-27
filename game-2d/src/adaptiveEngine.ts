// --------------------------------------------------------------------------
// NEXUS 2D - ADAPTIVE ENGINE
//
// A faithful TypeScript port of game-3d/scripts/adaptive_engine.gd's
// algorithm (same update rule, same thresholds, same tier structure) for
// the 2D client's own runtime. This exists because GDScript cannot run in
// a browser canvas - it is not a second, independently-designed adaptive
// system. Both clients:
//   - track a 0..1 mastery value per concept via the same EMA + trend rule
//   - use the same STRUGGLE/MASTERED thresholds to decide reinforcement
//     vs. progression
//   - derive module mastery as the plain average of its concepts' mastery
//   - use concept mastery (never overall mastery) to drive difficulty
//
// Nothing here is decided by the AI layer - see @nexus/shared's insight.ts
// for that boundary.
// --------------------------------------------------------------------------

import {
  momentum,
  elasticCollisionFinalVelocities,
  inelasticCollisionFinalVelocity,
  centripetalForceFromSpeed,
  centripetalAccelerationFromSpeed,
  circularSpeedFromOmega,
  angularVelocityFromSpeed,
  circularPeriod,
} from "./physics";

export const MODULE_PROJECTILE = "projectile_motion";
export const MODULE_NEWTON = "newtons_laws";
export const MODULE_WORK_ENERGY = "work_energy";
export const MODULE_MOMENTUM = "momentum_collisions";
export const MODULE_CIRCULAR = "circular_motion";

export const CONCEPT_SPEED_RANGE = "speed_range";
export const CONCEPT_GRAVITY_RANGE = "gravity_range";
export const CONCEPT_FORCE_ACCELERATION = "force_acceleration";
export const CONCEPT_NET_FORCE = "net_force";
export const CONCEPT_FRICTION = "friction";
export const CONCEPT_WORK = "work";
export const CONCEPT_KINETIC_ENERGY = "kinetic_energy";
export const CONCEPT_WORK_ENERGY_THEOREM = "work_energy_theorem";
// These 3 ids are the ones @nexus/shared's curriculum.ts already reserved
// for Module 4 (id: "momentum", available: false) - see that file's
// STABLE MODULE IDS note. Do not rename them; the curriculum's concept ids
// and these AdaptiveEngine concept ids are the same strings by design.
export const CONCEPT_MOMENTUM = "momentum";
export const CONCEPT_IMPULSE = "impulse";
export const CONCEPT_CONSERVATION_MOMENTUM = "conservation_of_momentum";
// These 3 ids are the ones @nexus/shared's curriculum.ts already reserved
// for Module 5 (id: "circular-motion") - see that file's STABLE MODULE IDS
// note. Do not rename them.
export const CONCEPT_CENTRIPETAL_FORCE = "centripetal_force";
export const CONCEPT_CENTRIPETAL_ACCELERATION = "centripetal_acceleration";
export const CONCEPT_CIRCULAR_SPEED = "circular_speed";

const MODULE_SEQUENCE = [MODULE_PROJECTILE, MODULE_NEWTON, MODULE_WORK_ENERGY, MODULE_MOMENTUM, MODULE_CIRCULAR];

const CONCEPT_SEQUENCE: Record<string, string[]> = {
  [MODULE_PROJECTILE]: [CONCEPT_SPEED_RANGE, CONCEPT_GRAVITY_RANGE],
  [MODULE_NEWTON]: [CONCEPT_FORCE_ACCELERATION, CONCEPT_NET_FORCE, CONCEPT_FRICTION],
  [MODULE_WORK_ENERGY]: [CONCEPT_WORK, CONCEPT_KINETIC_ENERGY, CONCEPT_WORK_ENERGY_THEOREM],
  [MODULE_MOMENTUM]: [CONCEPT_MOMENTUM, CONCEPT_IMPULSE, CONCEPT_CONSERVATION_MOMENTUM],
  [MODULE_CIRCULAR]: [CONCEPT_CENTRIPETAL_FORCE, CONCEPT_CENTRIPETAL_ACCELERATION, CONCEPT_CIRCULAR_SPEED],
};

const MODULE_OF_CONCEPT: Record<string, string> = {};
for (const [moduleId, concepts] of Object.entries(CONCEPT_SEQUENCE)) {
  for (const c of concepts) MODULE_OF_CONCEPT[c] = moduleId;
}

const LEARNING_RATE = 0.25;
const TREND_WEIGHT = 0.05;
const HISTORY_LIMIT = 5;
const MAX_RESPONSE_TIME = 10.0;
const STRUGGLE_THRESHOLD = 0.35;
const MASTERED_THRESHOLD = 0.75;

export type DifficultyName = "Beginner" | "Intermediate" | "Advanced";

export interface Challenge {
  id: number;
  moduleId: string;
  conceptId: string;
  conceptTitle: string;
  conceptDescription: string;
  difficulty: DifficultyName;
  tolerance: number;
  unit: string;
  // Module-specific fields - only the ones relevant to conceptId are set.
  targetDistance?: number;
  gravity?: number;
  givenSpeed?: number;
  mass?: number;
  targetAcceleration?: number;
  secondForce?: number;
  frictionForce?: number;
  requiredForce?: number;
  distance?: number;
  targetWork?: number;
  requiredForceForWork?: number;
  targetKe?: number;
  requiredVelocity?: number;
  initialVelocity?: number;
  targetVelocity?: number;
  requiredNetWork?: number;

  // Momentum (CONCEPT_MOMENTUM) - a single cart's p = mv. Exactly one of
  // mass/velocity is left undefined per momentumSolveFor: the unknown the
  // player solves for, never a given.
  momentumSolveFor?: "momentum" | "velocity" | "mass";
  velocity?: number;
  targetMomentum?: number;

  // Impulse (CONCEPT_IMPULSE) - a single cart against a barrier: J = m(vf-vi) = F*dt.
  // finalVelocity is always the true, physically-correct value (the barrier's
  // real effect on the cart) - it is only ever a *given* to the player when
  // impulseSolveFor isn't "finalVelocity"; the running simulation always
  // animates toward it, never toward the player's guess.
  impulseSolveFor?: "impulse" | "finalVelocity" | "force";
  finalVelocity?: number;
  targetImpulse?: number;
  contactTime?: number;

  // Conservation of Momentum (CONCEPT_CONSERVATION_MOMENTUM) - two carts,
  // m1u1 + m2u2 = m1v1 + m2v2. finalVelocity1/2 are the true post-collision
  // velocities the physics produces (from physics.ts's elastic/inelastic
  // formulas) - the simulation always collides using mass1/mass2/velocity1/
  // velocity2, regardless of what the player predicts.
  mass1?: number;
  mass2?: number;
  velocity1?: number;
  velocity2?: number;
  collisionType?: "elastic" | "inelastic";
  finalVelocity1?: number;
  finalVelocity2?: number;
  solveForCart?: "A" | "B";

  // Circular Motion (CONCEPT_CENTRIPETAL_FORCE) - F_c = mv^2/r. Beginner
  // solves for the force directly (mass/radius/speed all given);
  // Intermediate/Advanced instead give a target force and leave speed or
  // radius as the unknown - see radius/speed below, exactly one of which is
  // left undefined per forceSolveFor, same convention as Momentum's
  // momentumSolveFor.
  forceSolveFor?: "force" | "speed" | "radius";
  radius?: number;
  speed?: number;
  targetCentripetalForce?: number;

  // Circular Motion (CONCEPT_CENTRIPETAL_ACCELERATION) - a_c = v^2/r. Shares
  // the radius/speed fields above (never both concepts on the same
  // challenge, so there's no collision).
  accelSolveFor?: "acceleration" | "speed" | "radius";
  targetCentripetalAcceleration?: number;

  // Circular Motion (CONCEPT_CIRCULAR_SPEED) - v = omega*r,
  // T = 2*pi*r/v. Unlike the two concepts above, every sub-type here is a
  // direct forward computation from two fully-given quantities (radius plus
  // either speed or angularVelocity) - never a formula the player's guess
  // must be plugged back into - so there is always exactly one true,
  // fully-determined answer regardless of speedSolveFor.
  speedSolveFor?: "speed" | "angularVelocity" | "period";
  angularVelocity?: number;
  targetCircularSpeed?: number;
  targetAngularVelocity?: number;
  targetPeriod?: number;

  // Shared by all 3 Circular Motion concepts - the number of full
  // revolutions the object must physically complete before the experiment
  // reaches its endpoint (1 Beginner / 2 Intermediate / 3 Advanced). See
  // experimentRunner.ts's circularRunDurationMs/circularAngleAt.
  revolutions?: number;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function tierName(mastery: number): DifficultyName {
  if (mastery < 0.4) return "Beginner";
  if (mastery < 0.75) return "Intermediate";
  return "Advanced";
}

function tierT(mastery: number): { tier: 0 | 1 | 2; t: number } {
  if (mastery < 0.4) return { tier: 0, t: clamp(mastery / 0.4, 0, 1) };
  if (mastery < 0.75) return { tier: 1, t: clamp((mastery - 0.4) / 0.35, 0, 1) };
  return { tier: 2, t: clamp((mastery - 0.75) / 0.25, 0, 1) };
}

export class AdaptiveEngine {
  mastery = 0.3;
  conceptMastery: Record<string, number> = {};
  currentModuleId: string = MODULE_PROJECTILE;
  currentConceptId: string = CONCEPT_SPEED_RANGE;

  private history: number[] = [];
  private conceptHistory: Record<string, number[]> = {};
  private nextId = 1;

  // startModuleId lets a caller open a specific module directly (e.g. a
  // dashboard card linking to /play?module=newton) instead of always
  // beginning at Projectile Motion. It only picks where a *fresh* engine
  // starts - mastery, progression and every other rule are unaffected, and
  // an unrecognized id falls back to the normal default.
  constructor(startModuleId?: string) {
    for (const concepts of Object.values(CONCEPT_SEQUENCE)) {
      for (const c of concepts) this.conceptMastery[c] = 0.3;
    }
    if (startModuleId && CONCEPT_SEQUENCE[startModuleId]) {
      this.currentModuleId = startModuleId;
      this.currentConceptId = CONCEPT_SEQUENCE[startModuleId][0];
    }
  }

  getModuleMastery(moduleId: string): number {
    const concepts = CONCEPT_SEQUENCE[moduleId] ?? [];
    if (concepts.length === 0) return 0;
    return concepts.reduce((sum, c) => sum + this.conceptMastery[c], 0) / concepts.length;
  }

  // How many attempts this concept's mastery has been updated from so far -
  // reported to the AI insight layer as `recent_attempts` context, capped
  // the same way updateMastery() caps its own trend window.
  getRecentAttemptCount(conceptId: string): number {
    return this.conceptHistory[conceptId]?.length ?? 0;
  }

  getDifficultyName(): DifficultyName {
    return tierName(this.conceptMastery[this.currentConceptId]);
  }

  // Same EMA + trend rule as adaptive_engine.gd's record_attempt(), applied
  // to both overall and per-concept mastery.
  recordAttempt(distanceError: number, tolerance: number, success: boolean, responseTimeSeconds: number): number {
    const accuracy = clamp(1 - distanceError / (tolerance * 3), 0, 1);
    const successScore = success ? 1 : 0;
    const speedScore = clamp(1 - responseTimeSeconds / MAX_RESPONSE_TIME, 0, 1);
    const performance = 0.6 * accuracy + 0.3 * successScore + 0.1 * speedScore;

    this.mastery = this.updateMastery(this.mastery, performance, this.history);

    const conceptId = this.currentConceptId;
    const conceptHist = this.conceptHistory[conceptId] ?? (this.conceptHistory[conceptId] = []);
    this.conceptMastery[conceptId] = this.updateMastery(this.conceptMastery[conceptId], performance, conceptHist);

    return performance;
  }

  private updateMastery(current: number, performance: number, history: number[]): number {
    history.push(performance);
    while (history.length > HISTORY_LIMIT) history.shift();
    const trend = this.recentTrend(history);
    return clamp(current + LEARNING_RATE * (performance - current) + TREND_WEIGHT * trend, 0, 1);
  }

  private recentTrend(history: number[]): number {
    const n = history.length;
    if (n < 4) return 0;
    const half = Math.floor(n / 2);
    const recent = history.slice(n - half);
    const older = history.slice(0, n - half);
    const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
    return avg(recent) - avg(older);
  }

  // Same three-way decision as evaluate_content_transition(): keep
  // reinforcing, advance to the next concept, or (once every concept in
  // the module is mastered) hand off to the next module. May mutate
  // currentModuleId/currentConceptId. Returns a short, honest explanation.
  evaluateContentTransition(): string {
    const conceptId = this.currentConceptId;
    const m = this.conceptMastery[conceptId];

    if (m < STRUGGLE_THRESHOLD) {
      return `${conceptId} needs more practice.`;
    }

    if (m >= MASTERED_THRESHOLD) {
      const sequence = CONCEPT_SEQUENCE[this.currentModuleId];
      const idx = sequence.indexOf(conceptId);
      if (idx < sequence.length - 1) {
        this.currentConceptId = sequence[idx + 1];
        return `${conceptId} mastered. Introducing ${this.currentConceptId}.`;
      }

      const moduleMastery = this.getModuleMastery(this.currentModuleId);
      if (moduleMastery >= MASTERED_THRESHOLD) {
        const moduleIdx = MODULE_SEQUENCE.indexOf(this.currentModuleId);
        if (moduleIdx < MODULE_SEQUENCE.length - 1) {
          const nextModule = MODULE_SEQUENCE[moduleIdx + 1];
          this.currentModuleId = nextModule;
          this.currentConceptId = CONCEPT_SEQUENCE[nextModule][0];
          return `Module mastered. Introducing ${nextModule}.`;
        }
        return `${conceptId} mastered. Continuing advanced practice.`;
      }
      return `${conceptId} mastered. Continuing practice to complete this module.`;
    }

    return `${conceptId} in progress.`;
  }

  getAdaptationReason(before: number, after: number): string {
    const delta = after - before;
    if (delta > 0.01) return "Difficulty increased.";
    if (delta < -0.01) return "Challenge simplified.";
    return "Difficulty maintained.";
  }

  // Generates the next challenge for whatever concept is currently active,
  // using the same three-tier lerp pattern as adaptive_engine.gd's
  // _generate_*_challenge() functions - Beginner/Intermediate/Advanced
  // bands, interpolated by how far through the band the concept's mastery
  // sits.
  generateNextChallenge(): Challenge {
    const conceptId = this.currentConceptId;
    const moduleId = this.currentModuleId;
    const mastery = this.conceptMastery[conceptId];
    const { tier, t } = tierT(mastery);
    const difficulty = tierName(mastery);
    const id = this.nextId++;

    const base = {
      id,
      moduleId,
      conceptId,
      difficulty,
    };

    switch (conceptId) {
      case CONCEPT_SPEED_RANGE: {
        const [dMin, dMax] = [[3, 8], [8, 15], [15, 25]][tier];
        const [tolMax, tolMin] = [[2.0, 1.2], [1.2, 0.7], [0.7, 0.35]][tier];
        return {
          ...base,
          conceptTitle: "Speed & Range",
          conceptDescription: "Explore how launch speed affects distance.",
          unit: "m",
          gravity: 9.8,
          targetDistance: round1(lerp(dMin, dMax, t)),
          tolerance: round1(lerp(tolMax, tolMin, t)),
        };
      }
      case CONCEPT_GRAVITY_RANGE: {
        // The player is given launch speed + target range and must solve
        // for gravity: g = v^2 sin(2*theta) / R, which at 45 degrees is
        // g = v^2 / R. The generated targetGravity is the "correct" answer;
        // targetDistance is derived from it so the two are self-consistent,
        // and scoring still happens on the physically observed landing
        // range (same mechanic as Speed & Range) once the player's
        // submitted gravity is used to actually fly the projectile - this
        // is a genuinely different unknown, not a relabeled control.
        const [gMin, gMax] = [[6, 9], [9, 13], [13, 18]][tier];
        const [sMin, sMax] = [[8, 10], [10, 13], [12, 16]][tier];
        const [tolMax, tolMin] = [[2.0, 1.2], [1.2, 0.7], [0.7, 0.35]][tier];
        const targetGravity = round1(lerp(gMin, gMax, t));
        const givenSpeed = round1(lerp(sMin, sMax, t));
        return {
          ...base,
          conceptTitle: "Gravity & Trajectory",
          conceptDescription: "Given a launch speed and target range, solve for the gravity that produces it.",
          unit: "m",
          givenSpeed,
          gravity: targetGravity,
          targetDistance: round1((givenSpeed * givenSpeed) / targetGravity),
          tolerance: round1(lerp(tolMax, tolMin, t)),
        };
      }
      case CONCEPT_FORCE_ACCELERATION: {
        const [mMin, mMax] = [[1, 3], [3, 6], [6, 10]][tier];
        const [aMin, aMax] = [[1, 2], [2, 3.5], [3.5, 5]][tier];
        const [tolMax, tolMin] = [[0.6, 0.4], [0.4, 0.25], [0.25, 0.12]][tier];
        const mass = round1(lerp(mMin, mMax, t));
        const targetAcceleration = round1(lerp(aMin, aMax, t));
        return {
          ...base,
          conceptTitle: "Force & Acceleration",
          conceptDescription: "Explore how applied force and mass determine acceleration.",
          unit: "m/s^2",
          mass,
          targetAcceleration,
          requiredForce: round1(targetAcceleration * mass),
          tolerance: round1(lerp(tolMax, tolMin, t)),
        };
      }
      case CONCEPT_NET_FORCE: {
        const [mMin, mMax] = [[1, 3], [3, 6], [6, 10]][tier];
        const [aMin, aMax] = [[1, 2], [2, 3.5], [3.5, 5]][tier];
        const [fMin, fMax] = [[3, 8], [8, 15], [15, 25]][tier];
        const [tolMax, tolMin] = [[0.6, 0.4], [0.4, 0.25], [0.25, 0.12]][tier];
        const mass = round1(lerp(mMin, mMax, t));
        const targetAcceleration = round1(lerp(aMin, aMax, t));
        const secondForce = round1(lerp(fMin, fMax, t));
        return {
          ...base,
          conceptTitle: "Net Force",
          conceptDescription: "Combine multiple forces acting on an object to find the net force.",
          unit: "m/s^2",
          mass,
          targetAcceleration,
          secondForce,
          requiredForce: round1(targetAcceleration * mass - secondForce),
          tolerance: round1(lerp(tolMax, tolMin, t)),
        };
      }
      case CONCEPT_FRICTION: {
        const [mMin, mMax] = [[1, 3], [3, 6], [6, 10]][tier];
        const [aMin, aMax] = [[1, 2], [2, 3.5], [3.5, 5]][tier];
        const [fMin, fMax] = [[1, 3], [3, 6], [6, 10]][tier];
        const [tolMax, tolMin] = [[0.6, 0.4], [0.4, 0.25], [0.25, 0.12]][tier];
        const mass = round1(lerp(mMin, mMax, t));
        const targetAcceleration = round1(lerp(aMin, aMax, t));
        const frictionForce = round1(lerp(fMin, fMax, t));
        return {
          ...base,
          conceptTitle: "Friction",
          conceptDescription: "Explore how friction opposes motion and reduces net force.",
          unit: "m/s^2",
          mass,
          targetAcceleration,
          frictionForce,
          requiredForce: round1(targetAcceleration * mass + frictionForce),
          tolerance: round1(lerp(tolMax, tolMin, t)),
        };
      }
      case CONCEPT_WORK: {
        const [mMin, mMax] = [[1, 3], [3, 6], [6, 10]][tier];
        const [dMin, dMax] = [[3, 6], [6, 10], [10, 15]][tier];
        const [wMin, wMax] = [[20, 60], [60, 150], [150, 300]][tier];
        const [tolMax, tolMin] = [[15, 10], [10, 6], [6, 3]][tier];
        const distance = round1(lerp(dMin, dMax, t));
        const targetWork = round1(lerp(wMin, wMax, t));
        return {
          ...base,
          conceptTitle: "Work",
          conceptDescription: "Explore how applied force and displacement combine to produce work.",
          unit: "J",
          mass: round1(lerp(mMin, mMax, t)),
          distance,
          targetWork,
          requiredForceForWork: round1(targetWork / distance),
          tolerance: round1(lerp(tolMax, tolMin, t)),
        };
      }
      case CONCEPT_KINETIC_ENERGY: {
        const [mMin, mMax] = [[1, 3], [3, 6], [6, 10]][tier];
        const [keMin, keMax] = [[4, 20], [20, 80], [80, 200]][tier];
        const [tolMax, tolMin] = [[4, 2], [2, 1], [1, 0.5]][tier];
        const mass = round1(lerp(mMin, mMax, t));
        const targetKe = round1(lerp(keMin, keMax, t));
        return {
          ...base,
          conceptTitle: "Kinetic Energy",
          conceptDescription: "Explore how mass and velocity determine an object's kinetic energy.",
          unit: "J",
          mass,
          targetKe,
          requiredVelocity: round2(Math.sqrt((2 * targetKe) / mass)),
          tolerance: round1(lerp(tolMax, tolMin, t)),
        };
      }
      case CONCEPT_WORK_ENERGY_THEOREM: {
        const [mMin, mMax] = [[1, 3], [3, 6], [6, 10]][tier];
        const [iMin, iMax] = [[1, 3], [2, 5], [3, 6]][tier];
        const [tvMin, tvMax] = [[3, 6], [6, 10], [10, 16]][tier];
        const [tolMax, tolMin] = [[15, 10], [10, 6], [6, 3]][tier];
        const mass = round1(lerp(mMin, mMax, t));
        const initialVelocity = round1(lerp(iMin, iMax, t));
        const targetVelocity = round1(lerp(tvMin, tvMax, t));
        return {
          ...base,
          conceptTitle: "Work-Energy Theorem",
          conceptDescription: "Connect work and energy: net work equals the change in kinetic energy.",
          unit: "J",
          mass,
          initialVelocity,
          targetVelocity,
          requiredNetWork: round1(0.5 * mass * (targetVelocity * targetVelocity - initialVelocity * initialVelocity)),
          tolerance: round1(lerp(tolMax, tolMin, t)),
        };
      }
      // Momentum: p = mv. Tier controls both mass and velocity directly
      // (same pattern as Force & Acceleration), then targetMomentum is
      // derived - the physically real momentum of the fully-specified cart.
      // Which of mass/velocity/momentum the player actually solves for
      // rotates by tier (Beginner solves for momentum directly; the harder
      // tiers solve for an input instead), per the concept's difficulty plan.
      case CONCEPT_MOMENTUM: {
        const [mMin, mMax] = [[1, 3], [3, 6], [6, 10]][tier];
        const [vMin, vMax] = [[2, 5], [3, 7], [4, 9]][tier];
        const [tolMax, tolMin] = [[1.5, 1.0], [3, 1.8], [5, 2.5]][tier];
        const mass = round1(lerp(mMin, mMax, t));
        // Beginner is always positive velocity; Intermediate/Advanced
        // introduce signed (mixed-direction) velocities.
        const direction = tier === 0 ? 1 : t < 0.5 ? -1 : 1;
        const velocity = round1(direction * lerp(vMin, vMax, t));
        const momentumSolveFor: "momentum" | "velocity" | "mass" = tier === 0 ? "momentum" : tier === 1 ? "velocity" : "mass";
        const targetMomentum = round1(momentum(mass, velocity));
        const shared = {
          ...base,
          conceptTitle: "Momentum",
          conceptDescription: "Explore how mass and velocity combine to determine an object's momentum.",
          unit: "kg*m/s",
          momentumSolveFor,
          targetMomentum,
          tolerance: round1(lerp(tolMax, tolMin, t)),
        };
        if (momentumSolveFor === "velocity") return { ...shared, mass };
        if (momentumSolveFor === "mass") return { ...shared, velocity };
        return { ...shared, mass, velocity };
      }

      // Impulse: J = m(vf - vi) = F*dt. Beginner gives both velocities and
      // asks for the impulse; Intermediate gives the impulse and asks for
      // the resulting final velocity; Advanced gives force and contact time
      // and asks for the force required (or produced) - see impulseSolveFor.
      case CONCEPT_IMPULSE: {
        const [mMin, mMax] = [[1, 3], [3, 6], [6, 10]][tier];
        const [viMin, viMax] = [[2, 4], [3, 6], [4, 8]][tier];
        const [dvMin, dvMax] = [[2, 5], [4, 8], [6, 12]][tier];
        const [ctMax, ctMin] = [[0.4, 0.25], [0.25, 0.15], [0.15, 0.05]][tier];
        const mass = round1(lerp(mMin, mMax, t));
        const initialVelocity = round1(lerp(viMin, viMax, t));
        const deltaV = round1(lerp(dvMin, dvMax, t));
        const finalVelocity = round1(initialVelocity + deltaV);
        const trueImpulse = round1(mass * deltaV);
        const impulseSolveFor: "impulse" | "finalVelocity" | "force" = tier === 0 ? "impulse" : tier === 1 ? "finalVelocity" : "force";
        const unit = impulseSolveFor === "force" ? "N" : impulseSolveFor === "finalVelocity" ? "m/s" : "N*s";
        const [tolMax, tolMin] =
          impulseSolveFor === "force" ? [[6, 4], [5, 3], [4, 2]][tier] : impulseSolveFor === "finalVelocity" ? [[0.8, 0.5], [0.5, 0.3], [0.3, 0.15]][tier] : [[1.2, 0.8], [0.8, 0.5], [0.5, 0.25]][tier];
        const shared = {
          ...base,
          conceptTitle: "Impulse",
          conceptDescription: "Connect force and time to the change in momentum they produce.",
          unit,
          impulseSolveFor,
          mass,
          initialVelocity,
          tolerance: round1(lerp(tolMax, tolMin, t)),
        };
        if (impulseSolveFor === "impulse") return { ...shared, finalVelocity };
        if (impulseSolveFor === "finalVelocity") return { ...shared, finalVelocity, targetImpulse: trueImpulse };
        const contactTime = round2(lerp(ctMax, ctMin, t));
        return { ...shared, finalVelocity, contactTime, targetImpulse: trueImpulse };
      }

      // Conservation of Momentum: m1u1 + m2u2 = m1v1 + m2v2 - the flagship
      // concept. u1 is always strictly greater than u2 (guaranteed below) so
      // the two carts are always genuinely on a collision course; the
      // simulation resolves the actual collision (elastic or perfectly
      // inelastic) from these fixed givens, then the player's prediction for
      // one cart's final velocity is checked against that real outcome.
      case CONCEPT_CONSERVATION_MOMENTUM: {
        const [m1Min, m1Max] = [[1, 3], [2, 5], [3, 7]][tier];
        const [m2Min, m2Max] = [[1, 3], [2, 5], [3, 7]][tier];
        const [u1Min, u1Max] = [[3, 6], [4, 8], [5, 10]][tier];
        const [tolMax, tolMin] = [[0.6, 0.4], [0.4, 0.25], [0.3, 0.15]][tier];
        const mass1 = round1(lerp(m1Min, m1Max, t));
        const mass2 = round1(lerp(m2Min, m2Max, t));
        const velocity1 = round1(lerp(u1Min, u1Max, t));
        // Beginner: cart B starts at rest (the classic case). Intermediate
        // and Advanced: cart B moves toward cart A (opposite direction) -
        // still strictly slower than cart A so they always collide.
        const velocity2 = tier === 0 ? 0 : round1(-lerp(1, u1Min * 0.6, t));
        const collisionType: "elastic" | "inelastic" = tier === 0 ? "inelastic" : tier === 1 ? "elastic" : t < 0.5 ? "inelastic" : "elastic";
        const solveForCart: "A" | "B" = tier === 2 && t >= 0.5 ? "B" : "A";

        let finalVelocity1: number;
        let finalVelocity2: number;
        if (collisionType === "elastic") {
          const result = elasticCollisionFinalVelocities(mass1, velocity1, mass2, velocity2);
          finalVelocity1 = round2(result.v1);
          finalVelocity2 = round2(result.v2);
        } else {
          const v = inelasticCollisionFinalVelocity(mass1, velocity1, mass2, velocity2);
          finalVelocity1 = round2(v);
          finalVelocity2 = round2(v);
        }

        return {
          ...base,
          conceptTitle: "Conservation of Momentum",
          conceptDescription: "See how total momentum is conserved when two objects collide.",
          unit: "m/s",
          mass1,
          mass2,
          velocity1,
          velocity2,
          collisionType,
          finalVelocity1,
          finalVelocity2,
          solveForCart,
          tolerance: round1(lerp(tolMax, tolMin, t)),
        };
      }

      // Centripetal Force: F_c = mv^2/r. Beginner gives mass/radius/speed
      // and asks for the force directly; Intermediate gives a target force
      // and asks for the speed that produces it (a quadratic relationship -
      // doubling speed quadruples the required force, deliberately exercised
      // by the widening speed range per tier); Advanced gives a target force
      // and asks for the radius instead.
      case CONCEPT_CENTRIPETAL_FORCE: {
        const [mMin, mMax] = [[1, 3], [2, 4], [3, 5]][tier];
        const [rMin, rMax] = [[1, 2], [1, 2.5], [1.5, 3]][tier];
        const [vMin, vMax] = [[2, 4], [3, 6], [4, 8]][tier];
        const mass = round1(lerp(mMin, mMax, t));
        const radius = round1(lerp(rMin, rMax, t));
        const speed = round1(lerp(vMin, vMax, t));
        const targetCentripetalForce = round1(centripetalForceFromSpeed(mass, speed, radius));
        const forceSolveFor: "force" | "speed" | "radius" = tier === 0 ? "force" : tier === 1 ? "speed" : "radius";
        const [tolMax, tolMin] =
          forceSolveFor === "speed"
            ? [[0.6, 0.4], [0.5, 0.3], [0.4, 0.25]][tier]
            : forceSolveFor === "radius"
              ? [[0.3, 0.2], [0.25, 0.15], [0.2, 0.12]][tier]
              : [[3, 1.8], [4, 2.4], [6, 3.2]][tier];
        const shared = {
          ...base,
          conceptTitle: "Centripetal Force",
          conceptDescription: "Explore the force that keeps an object moving along a circular path.",
          unit: forceSolveFor === "speed" ? "m/s" : forceSolveFor === "radius" ? "m" : "N",
          forceSolveFor,
          mass,
          targetCentripetalForce,
          revolutions: tier + 1,
          tolerance: round1(lerp(tolMax, tolMin, t)),
        };
        if (forceSolveFor === "speed") return { ...shared, radius };
        if (forceSolveFor === "radius") return { ...shared, speed };
        return { ...shared, radius, speed };
      }

      // Centripetal Acceleration: a_c = v^2/r - no mass involved. Beginner
      // gives speed/radius and asks for acceleration directly; Intermediate
      // solves for speed; Advanced solves for radius. The object's speed
      // stays constant while its direction (and therefore its velocity)
      // continuously changes - that's what the acceleration represents, and
      // the render layer keeps the velocity/acceleration vectors rotating
      // together to make that visible.
      case CONCEPT_CENTRIPETAL_ACCELERATION: {
        const [rMin, rMax] = [[1, 2], [1.5, 3], [2, 4]][tier];
        const [vMin, vMax] = [[2, 4], [3, 6], [4, 8]][tier];
        const radius = round1(lerp(rMin, rMax, t));
        const speed = round1(lerp(vMin, vMax, t));
        const targetCentripetalAcceleration = round2(centripetalAccelerationFromSpeed(speed, radius));
        const accelSolveFor: "acceleration" | "speed" | "radius" = tier === 0 ? "acceleration" : tier === 1 ? "speed" : "radius";
        const [tolMax, tolMin] =
          accelSolveFor === "speed"
            ? [[0.5, 0.3], [0.4, 0.25], [0.35, 0.2]][tier]
            : accelSolveFor === "radius"
              ? [[0.3, 0.18], [0.25, 0.15], [0.2, 0.1]][tier]
              : [[1.2, 0.7], [1.5, 0.9], [2, 1.1]][tier];
        const shared = {
          ...base,
          conceptTitle: "Centripetal Acceleration",
          conceptDescription: "Connect speed and radius to the acceleration that keeps an object turning.",
          unit: accelSolveFor === "speed" ? "m/s" : accelSolveFor === "radius" ? "m" : "m/s^2",
          accelSolveFor,
          targetCentripetalAcceleration,
          revolutions: tier + 1,
          tolerance: round1(lerp(tolMax, tolMin, t)),
        };
        if (accelSolveFor === "speed") return { ...shared, radius };
        if (accelSolveFor === "radius") return { ...shared, speed };
        return { ...shared, radius, speed };
      }

      // Circular Speed: v = omega*r and T = 2*pi*r/v. Unlike the two
      // concepts above, radius plus exactly one of {angularVelocity, speed}
      // is always fully given - the third quantity (speed, angularVelocity,
      // or period) is a direct forward computation, never a formula the
      // player's own guess must feed back into.
      case CONCEPT_CIRCULAR_SPEED: {
        const [rMin, rMax] = [[1, 2], [1.5, 3], [2, 4]][tier];
        const radius = round1(lerp(rMin, rMax, t));
        const speedSolveFor: "speed" | "angularVelocity" | "period" = tier === 0 ? "speed" : tier === 1 ? "angularVelocity" : "period";
        const base2 = {
          ...base,
          conceptTitle: "Circular Speed",
          conceptDescription: "Explore how radius and period determine an object's speed around a circle.",
          speedSolveFor,
          radius,
          revolutions: tier + 1,
        };

        if (speedSolveFor === "speed") {
          const [omMin, omMax] = [[1, 2], [1.5, 3], [2, 4]][tier];
          const [tolMax, tolMin] = [[0.5, 0.3], [0.4, 0.25], [0.35, 0.2]][tier];
          const angularVelocity = round2(lerp(omMin, omMax, t));
          const targetCircularSpeed = round1(circularSpeedFromOmega(angularVelocity, radius));
          return { ...base2, unit: "m/s", angularVelocity, targetCircularSpeed, tolerance: round1(lerp(tolMax, tolMin, t)) };
        }
        if (speedSolveFor === "angularVelocity") {
          const [vMin, vMax] = [[2, 4], [3, 6], [4, 8]][tier];
          const [tolMax, tolMin] = [[0.3, 0.18], [0.25, 0.15], [0.2, 0.12]][tier];
          const speed = round1(lerp(vMin, vMax, t));
          const targetAngularVelocity = round2(angularVelocityFromSpeed(speed, radius));
          return { ...base2, unit: "rad/s", speed, targetAngularVelocity, tolerance: round1(lerp(tolMax, tolMin, t)) };
        }
        const [vMin, vMax] = [[2, 4], [3, 6], [4, 8]][tier];
        const [tolMax, tolMin] = [[0.6, 0.4], [0.5, 0.3], [0.4, 0.25]][tier];
        const speed = round1(lerp(vMin, vMax, t));
        const targetPeriod = round2(circularPeriod(radius, speed));
        return { ...base2, unit: "s", speed, targetPeriod, tolerance: round1(lerp(tolMax, tolMin, t)) };
      }

      default:
        throw new Error(`Unknown concept: ${conceptId}`);
    }
  }
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
