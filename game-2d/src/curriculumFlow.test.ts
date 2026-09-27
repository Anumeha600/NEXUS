import { describe, it, expect } from "vitest";
import {
  AdaptiveEngine,
  MODULE_PROJECTILE,
  MODULE_NEWTON,
  MODULE_WORK_ENERGY,
  MODULE_MOMENTUM,
  MODULE_CIRCULAR,
  CONCEPT_SPEED_RANGE,
  CONCEPT_GRAVITY_RANGE,
  CONCEPT_FORCE_ACCELERATION,
  CONCEPT_NET_FORCE,
  CONCEPT_FRICTION,
  CONCEPT_WORK,
  CONCEPT_KINETIC_ENERGY,
  CONCEPT_WORK_ENERGY_THEOREM,
  CONCEPT_MOMENTUM,
  CONCEPT_IMPULSE,
  CONCEPT_CONSERVATION_MOMENTUM,
  CONCEPT_CENTRIPETAL_FORCE,
  CONCEPT_CENTRIPETAL_ACCELERATION,
  CONCEPT_CIRCULAR_SPEED,
  type Challenge,
} from "./adaptiveEngine";
import {
  newtonAcceleration,
  work,
  kineticEnergy,
  projectileRange,
  momentum,
  impulse,
  centripetalForceFromSpeed,
  centripetalAccelerationFromSpeed,
} from "./physics";

// The "correct answer" for a challenge, computed independently from the
// same formulas a player would use by hand - this is deliberately not
// re-derived from the engine's own internals, so a bug in challenge
// generation would show up as a scoring mismatch here.
function correctAnswerFor(c: Challenge): number {
  switch (c.conceptId) {
    case CONCEPT_SPEED_RANGE:
      return Math.sqrt((c.targetDistance ?? 0) * (c.gravity ?? 9.8));
    case CONCEPT_GRAVITY_RANGE:
      return (c.givenSpeed ?? 0) ** 2 / (c.targetDistance ?? 1);
    case CONCEPT_FORCE_ACCELERATION:
      return (c.targetAcceleration ?? 0) * (c.mass ?? 1);
    case CONCEPT_NET_FORCE:
      return (c.targetAcceleration ?? 0) * (c.mass ?? 1) - (c.secondForce ?? 0);
    case CONCEPT_FRICTION:
      return (c.targetAcceleration ?? 0) * (c.mass ?? 1) + (c.frictionForce ?? 0);
    case CONCEPT_WORK:
      return (c.targetWork ?? 0) / (c.distance ?? 1);
    case CONCEPT_KINETIC_ENERGY:
      return Math.sqrt((2 * (c.targetKe ?? 0)) / (c.mass ?? 1));
    case CONCEPT_WORK_ENERGY_THEOREM:
      return c.requiredNetWork ?? 0;
    case CONCEPT_MOMENTUM:
      if (c.momentumSolveFor === "velocity") return (c.targetMomentum ?? 0) / (c.mass ?? 1);
      if (c.momentumSolveFor === "mass") return (c.targetMomentum ?? 0) / (c.velocity ?? 1);
      return momentum(c.mass ?? 0, c.velocity ?? 0);
    case CONCEPT_IMPULSE:
      if (c.impulseSolveFor === "finalVelocity") return c.finalVelocity ?? 0;
      if (c.impulseSolveFor === "force") return (c.targetImpulse ?? 0) / (c.contactTime ?? 1);
      return impulse(c.mass ?? 0, c.initialVelocity ?? 0, c.finalVelocity ?? 0);
    case CONCEPT_CONSERVATION_MOMENTUM:
      return c.solveForCart === "B" ? c.finalVelocity2 ?? 0 : c.finalVelocity1 ?? 0;
    case CONCEPT_CENTRIPETAL_FORCE:
      if (c.forceSolveFor === "speed") return Math.sqrt((c.targetCentripetalForce ?? 0) * (c.radius ?? 1) / (c.mass ?? 1));
      if (c.forceSolveFor === "radius") return ((c.mass ?? 1) * (c.speed ?? 0) ** 2) / (c.targetCentripetalForce ?? 1);
      return centripetalForceFromSpeed(c.mass ?? 0, c.speed ?? 0, c.radius ?? 1);
    case CONCEPT_CENTRIPETAL_ACCELERATION:
      if (c.accelSolveFor === "speed") return Math.sqrt((c.targetCentripetalAcceleration ?? 0) * (c.radius ?? 1));
      if (c.accelSolveFor === "radius") return (c.speed ?? 0) ** 2 / (c.targetCentripetalAcceleration ?? 1);
      return centripetalAccelerationFromSpeed(c.speed ?? 0, c.radius ?? 1);
    case CONCEPT_CIRCULAR_SPEED:
      if (c.speedSolveFor === "angularVelocity") return c.targetAngularVelocity ?? 0;
      if (c.speedSolveFor === "period") return c.targetPeriod ?? 0;
      return c.targetCircularSpeed ?? 0;
    default:
      throw new Error(`no independent solver for ${c.conceptId}`);
  }
}

// The actual, physically observed result of running the experiment with a
// submitted control value - mirrors what GameCanvas.tsx's confirm() does,
// including the projectile module's real flight simulation. For Momentum &
// Collisions, most sub-types ask the player to solve directly for the
// scored quantity (see challengeLogic.ts's predictedValue), so the "actual"
// result is the submitted value itself unless a formula still needs to be
// applied to it (momentum's velocity/mass sub-types).
function actualResultFor(c: Challenge, submitted: number): number {
  switch (c.conceptId) {
    case CONCEPT_SPEED_RANGE:
      return projectileRange(submitted, c.gravity ?? 9.8);
    case CONCEPT_GRAVITY_RANGE:
      return projectileRange(c.givenSpeed ?? 0, submitted);
    case CONCEPT_FORCE_ACCELERATION:
      return newtonAcceleration(submitted, 0, c.mass ?? 1);
    case CONCEPT_NET_FORCE:
      return newtonAcceleration(submitted, c.secondForce ?? 0, c.mass ?? 1);
    case CONCEPT_FRICTION:
      return newtonAcceleration(submitted, -(c.frictionForce ?? 0), c.mass ?? 1);
    case CONCEPT_WORK:
      return work(submitted, c.distance ?? 0);
    case CONCEPT_KINETIC_ENERGY:
      return kineticEnergy(c.mass ?? 1, submitted);
    case CONCEPT_WORK_ENERGY_THEOREM:
      return submitted;
    case CONCEPT_MOMENTUM:
      if (c.momentumSolveFor === "velocity") return momentum(c.mass ?? 1, submitted);
      if (c.momentumSolveFor === "mass") return momentum(submitted, c.velocity ?? 1);
      return submitted;
    case CONCEPT_IMPULSE:
    case CONCEPT_CONSERVATION_MOMENTUM:
      return submitted;
    case CONCEPT_CENTRIPETAL_FORCE:
      if (c.forceSolveFor === "speed") return centripetalForceFromSpeed(c.mass ?? 1, submitted, c.radius ?? 1);
      if (c.forceSolveFor === "radius") return centripetalForceFromSpeed(c.mass ?? 1, c.speed ?? 1, submitted);
      return submitted;
    case CONCEPT_CENTRIPETAL_ACCELERATION:
      if (c.accelSolveFor === "speed") return centripetalAccelerationFromSpeed(submitted, c.radius ?? 1);
      if (c.accelSolveFor === "radius") return centripetalAccelerationFromSpeed(c.speed ?? 1, submitted);
      return submitted;
    case CONCEPT_CIRCULAR_SPEED:
      return submitted;
    default:
      throw new Error(`no actual-result function for ${c.conceptId}`);
  }
}

// The generator-decided target value for a challenge - used by the flow
// loop below exactly like `targetValueOf` in challengeLogic.ts, but
// re-derived independently here (see correctAnswerFor's doc comment).
function targetFor(c: Challenge): number {
  switch (c.conceptId) {
    case CONCEPT_MOMENTUM:
      return c.targetMomentum ?? 0;
    case CONCEPT_IMPULSE:
      if (c.impulseSolveFor === "finalVelocity") return c.finalVelocity ?? 0;
      if (c.impulseSolveFor === "force") return (c.targetImpulse ?? 0) / (c.contactTime ?? 1);
      return impulse(c.mass ?? 0, c.initialVelocity ?? 0, c.finalVelocity ?? 0);
    case CONCEPT_CONSERVATION_MOMENTUM:
      return c.solveForCart === "B" ? c.finalVelocity2 ?? 0 : c.finalVelocity1 ?? 0;
    case CONCEPT_CENTRIPETAL_FORCE:
      return c.targetCentripetalForce ?? 0;
    case CONCEPT_CENTRIPETAL_ACCELERATION:
      return c.targetCentripetalAcceleration ?? 0;
    case CONCEPT_CIRCULAR_SPEED:
      if (c.speedSolveFor === "angularVelocity") return c.targetAngularVelocity ?? 0;
      if (c.speedSolveFor === "period") return c.targetPeriod ?? 0;
      return c.targetCircularSpeed ?? 0;
    default:
      return c.targetDistance ?? c.targetAcceleration ?? c.targetWork ?? c.targetKe ?? c.requiredNetWork ?? 0;
  }
}

const EXPECTED_CURRICULUM_ORDER = [
  `${MODULE_PROJECTILE}/${CONCEPT_SPEED_RANGE}`,
  `${MODULE_PROJECTILE}/${CONCEPT_GRAVITY_RANGE}`,
  `${MODULE_NEWTON}/${CONCEPT_FORCE_ACCELERATION}`,
  `${MODULE_NEWTON}/${CONCEPT_NET_FORCE}`,
  `${MODULE_NEWTON}/${CONCEPT_FRICTION}`,
  `${MODULE_WORK_ENERGY}/${CONCEPT_WORK}`,
  `${MODULE_WORK_ENERGY}/${CONCEPT_KINETIC_ENERGY}`,
  `${MODULE_WORK_ENERGY}/${CONCEPT_WORK_ENERGY_THEOREM}`,
  `${MODULE_MOMENTUM}/${CONCEPT_MOMENTUM}`,
  `${MODULE_MOMENTUM}/${CONCEPT_IMPULSE}`,
  `${MODULE_MOMENTUM}/${CONCEPT_CONSERVATION_MOMENTUM}`,
  `${MODULE_CIRCULAR}/${CONCEPT_CENTRIPETAL_FORCE}`,
  `${MODULE_CIRCULAR}/${CONCEPT_CENTRIPETAL_ACCELERATION}`,
  `${MODULE_CIRCULAR}/${CONCEPT_CIRCULAR_SPEED}`,
];

describe("full curriculum flow under correct answers", () => {
  it("progresses through all 14 concepts, in order, ending back at the last concept once the curriculum is complete", () => {
    const engine = new AdaptiveEngine();
    const visitedOrder: string[] = [];
    let lastKey = "";

    for (let attempt = 0; attempt < 200; attempt++) {
      const challenge = engine.generateNextChallenge();
      const key = `${challenge.moduleId}/${challenge.conceptId}`;
      if (key !== lastKey) {
        visitedOrder.push(key);
        lastKey = key;
      }

      const correct = correctAnswerFor(challenge);
      const actual = actualResultFor(challenge, correct);
      const target2 = targetFor(challenge);
      const error = Math.abs(actual - target2);
      const success = error <= challenge.tolerance;
      engine.recordAttempt(error, challenge.tolerance, success, 1.0);
      engine.evaluateContentTransition();

      const isLastConcept = engine.currentModuleId === MODULE_CIRCULAR && engine.currentConceptId === CONCEPT_CIRCULAR_SPEED;
      const lastConceptMastered = engine.conceptMastery[CONCEPT_CIRCULAR_SPEED] >= 0.75;
      const moduleMastered = engine.getModuleMastery(MODULE_CIRCULAR) >= 0.75;
      if (isLastConcept && lastConceptMastered && moduleMastered && attempt > 20) break;
    }

    const uniqueVisited = [...new Set(visitedOrder)];
    expect(uniqueVisited).toEqual(EXPECTED_CURRICULUM_ORDER);
  });

  it("never lets a wrong answer advance the concept", () => {
    const engine = new AdaptiveEngine();
    const startingConcept = engine.currentConceptId;
    const challenge = engine.generateNextChallenge();
    // Deliberately wrong: way off from the correct answer.
    const wrongAnswer = correctAnswerFor(challenge) + 1000;
    const actual = actualResultFor(challenge, wrongAnswer);
    const target = challenge.targetDistance ?? challenge.targetAcceleration ?? 0;
    const error = Math.abs(actual - target);
    const success = error <= challenge.tolerance;
    expect(success).toBe(false);
    engine.recordAttempt(error, challenge.tolerance, success, 1.0);
    engine.evaluateContentTransition();
    expect(engine.currentConceptId).toBe(startingConcept);
  });
});

describe("weak-concept reinforcement path", () => {
  it("keeps reinforcing a concept the player performs poorly on, instead of advancing", () => {
    const engine = new AdaptiveEngine();
    const conceptsVisited = new Set<string>();

    for (let attempt = 0; attempt < 15; attempt++) {
      const challenge = engine.generateNextChallenge();
      conceptsVisited.add(challenge.conceptId);
      // Consistently poor performance: large error, slow response.
      engine.recordAttempt(challenge.tolerance * 20, challenge.tolerance, false, 9.5);
      engine.evaluateContentTransition();
    }

    // After 15 consistently poor attempts, the player should still be stuck
    // on Speed & Range - never advanced to Gravity & Trajectory or beyond.
    expect(conceptsVisited.size).toBe(1);
    expect(conceptsVisited.has(CONCEPT_SPEED_RANGE)).toBe(true);
    expect(engine.conceptMastery[CONCEPT_SPEED_RANGE]).toBeLessThan(0.75);
  });

  it("recovers and advances once performance improves after a weak start", () => {
    const engine = new AdaptiveEngine();
    // A few poor attempts first.
    for (let i = 0; i < 3; i++) {
      const c = engine.generateNextChallenge();
      engine.recordAttempt(c.tolerance * 10, c.tolerance, false, 9);
      engine.evaluateContentTransition();
    }
    expect(engine.currentConceptId).toBe(CONCEPT_SPEED_RANGE);

    // Then several genuinely correct attempts.
    let advanced = false;
    for (let i = 0; i < 20; i++) {
      const c = engine.generateNextChallenge();
      const correct = correctAnswerFor(c);
      const actual = actualResultFor(c, correct);
      const target = c.targetDistance ?? 0;
      const error = Math.abs(actual - target);
      engine.recordAttempt(error, c.tolerance, error <= c.tolerance, 1.0);
      engine.evaluateContentTransition();
      if (engine.currentConceptId === CONCEPT_GRAVITY_RANGE) {
        advanced = true;
        break;
      }
    }
    expect(advanced).toBe(true);
  });
});

describe("module independence under the full flow", () => {
  it("Projectile Motion mastery never contaminates Newton's or Work & Energy's mastery values", () => {
    const engine = new AdaptiveEngine();
    for (let i = 0; i < 10; i++) {
      const c = engine.generateNextChallenge();
      if (c.moduleId !== MODULE_PROJECTILE) break;
      const correct = correctAnswerFor(c);
      const actual = actualResultFor(c, correct);
      const target = c.targetDistance ?? 0;
      const error = Math.abs(actual - target);
      engine.recordAttempt(error, c.tolerance, error <= c.tolerance, 1.0);
      engine.evaluateContentTransition();
    }
    // Untouched concepts must remain at their untouched baseline.
    expect(engine.conceptMastery[CONCEPT_FORCE_ACCELERATION]).toBeCloseTo(0.3, 6);
    expect(engine.conceptMastery[CONCEPT_WORK]).toBeCloseTo(0.3, 6);
  });
});
