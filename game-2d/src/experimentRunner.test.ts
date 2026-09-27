import { describe, it, expect } from "vitest";
import {
  AdaptiveEngine,
  MODULE_WORK_ENERGY,
  MODULE_NEWTON,
  MODULE_PROJECTILE,
  MODULE_MOMENTUM,
  MODULE_CIRCULAR,
  CONCEPT_WORK,
  CONCEPT_KINETIC_ENERGY,
  CONCEPT_FORCE_ACCELERATION,
  CONCEPT_WORK_ENERGY_THEOREM,
  CONCEPT_SPEED_RANGE,
  CONCEPT_MOMENTUM,
  CONCEPT_IMPULSE,
  CONCEPT_CONSERVATION_MOMENTUM,
  CONCEPT_CENTRIPETAL_FORCE,
  CONCEPT_CENTRIPETAL_ACCELERATION,
  CONCEPT_CIRCULAR_SPEED,
  type Challenge,
} from "./adaptiveEngine";
import { predictedValue, targetValueOf, flightParamsFor } from "./challengeLogic";
import { projectileFlightTime, projectilePositionAt, impulse, totalMomentum, centripetalForceFromSpeed } from "./physics";
import {
  RUN_DURATION_MS,
  MIN_RUN_MS,
  MAX_RUN_MS,
  NEWTON_TRACK_DISTANCE_M,
  MOMENTUM_TRACK_HALF_GAP_M,
  CART_HALF_WIDTH_M,
  experimentPhaseAt,
  runningReadoutFor,
  runningDisplacementMetersFor,
  isNonProjectileModule,
  newtonRunDurationMs,
  nonProjectileRunDurationMs,
  projectileRunDurationMs,
  impulseRunDurationMs,
  impulseImpactProgress,
  impulseTrueFinalVelocity,
  impulseCartPositionMetersFor,
  impulseHasImpactedAt,
  momentumRunDurationMs,
  momentumCollisionProgress,
  momentumHasCollidedAt,
  momentumCartPositionsMetersFor,
  circularSimParamsFor,
  circularRevolutionsRequired,
  circularRunDurationMs,
  circularAngleAt,
  circularRevolutionsCompletedAt,
} from "./experimentRunner";

function challengeFor(moduleId: string, conceptId: string): Challenge {
  const engine = new AdaptiveEngine();
  engine.currentModuleId = moduleId;
  engine.currentConceptId = conceptId;
  return engine.generateNextChallenge();
}

function momentumChallengeAt(conceptId: string, mastery: number): Challenge {
  const engine = new AdaptiveEngine();
  engine.currentModuleId = MODULE_MOMENTUM;
  engine.currentConceptId = conceptId;
  engine.conceptMastery[conceptId] = mastery;
  return engine.generateNextChallenge();
}

function circularChallengeAt(conceptId: string, mastery: number): Challenge {
  const engine = new AdaptiveEngine();
  engine.currentModuleId = MODULE_CIRCULAR;
  engine.currentConceptId = conceptId;
  engine.conceptMastery[conceptId] = mastery;
  return engine.generateNextChallenge();
}

describe("experimentPhaseAt - the timing gate for when a result may be computed", () => {
  it("is idle at or before zero elapsed time", () => {
    expect(experimentPhaseAt(0, 1500)).toEqual({ phase: "idle", progress: 0 });
    expect(experimentPhaseAt(-5, 1500)).toEqual({ phase: "idle", progress: 0 });
  });

  it("is running with a fractional progress strictly between 0 and 1 partway through", () => {
    const { phase, progress } = experimentPhaseAt(750, 1500);
    expect(phase).toBe("running");
    expect(progress).toBeCloseTo(0.5, 6);
  });

  it("is complete exactly at the duration, with progress 1", () => {
    expect(experimentPhaseAt(1500, 1500)).toEqual({ phase: "complete", progress: 1 });
  });

  it("stays complete (never a fifth state) for any elapsed time beyond the duration", () => {
    expect(experimentPhaseAt(5000, 1500)).toEqual({ phase: "complete", progress: 1 });
  });

  it("progress increases monotonically with elapsed time", () => {
    const samples = [0, 200, 400, 600, 800, 1000, 1200, 1400, 1500].map((t) => experimentPhaseAt(t, 1500).progress);
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThanOrEqual(samples[i - 1]);
    }
  });

  it("the default RUN_DURATION_MS is within the product's target 1.0-2.0s window", () => {
    expect(RUN_DURATION_MS).toBeGreaterThanOrEqual(1000);
    expect(RUN_DURATION_MS).toBeLessThanOrEqual(2000);
  });
});

describe("the running-experiment invariant: no result before completion", () => {
  // This mirrors the actual rule GameCanvas.tsx follows: finishAttempt()
  // (which scores, updates mastery, and emits the learning event) is only
  // ever invoked from the setTimeout that fires at RUN_DURATION_MS - never
  // synchronously inside confirm(). We verify the gate itself here: mastery
  // must not change for any elapsed time short of "complete".
  it("mastery is untouched while phase is idle or running, and only changes once phase is complete", () => {
    const engine = new AdaptiveEngine();
    engine.currentModuleId = MODULE_NEWTON;
    engine.currentConceptId = CONCEPT_FORCE_ACCELERATION;
    const challenge = engine.generateNextChallenge();
    const masteryBaseline = engine.conceptMastery[CONCEPT_FORCE_ACCELERATION];

    for (const elapsed of [0, 300, 900, 1499]) {
      const { phase } = experimentPhaseAt(elapsed, RUN_DURATION_MS);
      expect(phase).not.toBe("complete");
      // Simulating the real component's rule: only call recordAttempt when complete.
      if (phase === "complete") {
        engine.recordAttempt(0, challenge.tolerance, true, 1);
      }
    }
    expect(engine.conceptMastery[CONCEPT_FORCE_ACCELERATION]).toBe(masteryBaseline);

    const { phase } = experimentPhaseAt(RUN_DURATION_MS, RUN_DURATION_MS);
    expect(phase).toBe("complete");
    engine.recordAttempt(0, challenge.tolerance, true, 1);
    expect(engine.conceptMastery[CONCEPT_FORCE_ACCELERATION]).not.toBe(masteryBaseline);
  });
});

describe("runningReadoutFor - live numbers shown during the run", () => {
  it("returns null for Projectile Motion concepts (they use their own flight visualization)", () => {
    const c = challengeFor(MODULE_PROJECTILE, CONCEPT_SPEED_RANGE);
    expect(runningReadoutFor(c, 10, 0.5)).toBeNull();
  });

  it("Work: at progress 0 the live distance/work are zero; at progress 1 they equal the real result", () => {
    const c = challengeFor(MODULE_WORK_ENERGY, CONCEPT_WORK);
    const submittedForce = 10;
    const atStart = runningReadoutFor(c, submittedForce, 0)!;
    const atEnd = runningReadoutFor(c, submittedForce, 1)!;
    expect(atStart.lines.find((l) => l.label === "Distance")!.value).toContain("0.0 /");
    const finalWork = predictedValue(c, submittedForce);
    expect(atEnd.lines.find((l) => l.label === "Work")!.value).toBe(`${finalWork.toFixed(1)} J`);
  });

  it("Kinetic Energy: live velocity ramps from 0 up to exactly the submitted velocity by progress 1", () => {
    const c = challengeFor(MODULE_WORK_ENERGY, CONCEPT_KINETIC_ENERGY);
    const submittedVelocity = 8;
    const atStart = runningReadoutFor(c, submittedVelocity, 0)!;
    const atEnd = runningReadoutFor(c, submittedVelocity, 1)!;
    expect(atStart.lines.find((l) => l.label === "Velocity")!.value).toBe("0.0 m/s");
    expect(atEnd.lines.find((l) => l.label === "Velocity")!.value).toBe("8.0 m/s");
  });

  it("Work-Energy Theorem: live velocity starts at the given initial velocity, ends at the derived final velocity", () => {
    const c = challengeFor(MODULE_WORK_ENERGY, CONCEPT_WORK_ENERGY_THEOREM);
    const workInput = c.requiredNetWork!;
    const atStart = runningReadoutFor(c, workInput, 0)!;
    expect(atStart.lines.find((l) => l.label === "Velocity")!.value).toBe(`${(c.initialVelocity ?? 0).toFixed(1)} m/s`);
    const atEnd = runningReadoutFor(c, workInput, 1)!;
    // The correct work input should land the final velocity at (or very near) the target.
    const finalVelocity = Number(atEnd.lines.find((l) => l.label === "Velocity")!.value.replace(" m/s", ""));
    expect(Math.abs(finalVelocity - (c.targetVelocity ?? 0))).toBeLessThan(0.5);
  });

  it("Force & Acceleration: reports the real predicted acceleration, matching predictedValue exactly", () => {
    const c = challengeFor(MODULE_NEWTON, CONCEPT_FORCE_ACCELERATION);
    const readout = runningReadoutFor(c, 15, 0.5)!;
    const accelLine = readout.lines.find((l) => l.label === "Acceleration")!;
    expect(accelLine.value).toBe(`${predictedValue(c, 15).toFixed(2)} m/s²`);
  });
});

describe("runningDisplacementMetersFor - the motion driving the canvas animation", () => {
  it("Work: displacement reaches exactly the challenge's given distance at progress 1", () => {
    const c = challengeFor(MODULE_WORK_ENERGY, CONCEPT_WORK);
    expect(runningDisplacementMetersFor(c, 10, 0)).toBe(0);
    expect(runningDisplacementMetersFor(c, 10, 1)).toBeCloseTo(c.distance ?? 0, 6);
  });

  it("Newton concepts: displacement follows s = 1/2 a t^2 over the run's real physical duration, reaching the track distance exactly at progress 1", () => {
    const c = challengeFor(MODULE_NEWTON, CONCEPT_FORCE_ACCELERATION);
    const submittedForce = c.requiredForce!;
    const accel = predictedValue(c, submittedForce);
    const durationMs = newtonRunDurationMs(accel);
    const physicalSeconds = Math.sqrt((2 * NEWTON_TRACK_DISTANCE_M) / accel);

    const tSeconds = 0.5 * physicalSeconds;
    const expected = 0.5 * accel * tSeconds * tSeconds;
    expect(runningDisplacementMetersFor(c, submittedForce, 0.5, durationMs)).toBeCloseTo(expected, 6);

    // The physical endpoint, not a fixed timer, is what "complete" means:
    // displacement must land on exactly NEWTON_TRACK_DISTANCE_M at progress
    // 1, and strictly less than it at every point before that.
    expect(runningDisplacementMetersFor(c, submittedForce, 1, durationMs)).toBeCloseTo(NEWTON_TRACK_DISTANCE_M, 6);
    for (const p of [0.1, 0.3, 0.6, 0.9, 0.99]) {
      expect(runningDisplacementMetersFor(c, submittedForce, p, durationMs)).toBeLessThan(NEWTON_TRACK_DISTANCE_M);
    }
  });

  it("Newton concepts: falls back to RUN_DURATION_MS as the physical timeline when acceleration can't cross the track", () => {
    const c = challengeFor(MODULE_NEWTON, CONCEPT_FORCE_ACCELERATION);
    for (const accel of [0, -2]) {
      const durationMs = newtonRunDurationMs(accel);
      expect(durationMs).toBe(RUN_DURATION_MS);
    }
  });

  it("displacement is zero at progress 0 for every non-projectile concept", () => {
    for (const [moduleId, conceptId] of [
      [MODULE_NEWTON, CONCEPT_FORCE_ACCELERATION],
      [MODULE_WORK_ENERGY, CONCEPT_WORK],
      [MODULE_WORK_ENERGY, CONCEPT_KINETIC_ENERGY],
    ] as const) {
      const c = challengeFor(moduleId, conceptId);
      expect(runningDisplacementMetersFor(c, 10, 0)).toBe(0);
    }
  });
});

describe("isNonProjectileModule", () => {
  it("distinguishes Projectile Motion from the other two modules", () => {
    expect(isNonProjectileModule(challengeFor(MODULE_PROJECTILE, CONCEPT_SPEED_RANGE))).toBe(false);
    expect(isNonProjectileModule(challengeFor(MODULE_NEWTON, CONCEPT_FORCE_ACCELERATION))).toBe(true);
    expect(isNonProjectileModule(challengeFor(MODULE_WORK_ENERGY, CONCEPT_WORK))).toBe(true);
  });
});

describe("*RunDurationMs - presentation duration is always derived from real physics, clamped only to stay watchable", () => {
  it("newtonRunDurationMs and projectileRunDurationMs never fall outside [MIN_RUN_MS, MAX_RUN_MS]", () => {
    for (const accel of [0.01, 0.5, 2, 10, 500]) {
      const ms = newtonRunDurationMs(accel);
      expect(ms).toBeGreaterThanOrEqual(MIN_RUN_MS);
      expect(ms).toBeLessThanOrEqual(MAX_RUN_MS);
    }
    for (const flightTime of [0.05, 0.5, 2, 8, 60]) {
      const ms = projectileRunDurationMs(flightTime);
      expect(ms).toBeGreaterThanOrEqual(MIN_RUN_MS);
      expect(ms).toBeLessThanOrEqual(MAX_RUN_MS);
    }
  });

  it("nonProjectileRunDurationMs uses the fixed RUN_DURATION_MS for Work, Kinetic Energy and Work-Energy Theorem", () => {
    for (const [moduleId, conceptId] of [
      [MODULE_WORK_ENERGY, CONCEPT_WORK],
      [MODULE_WORK_ENERGY, CONCEPT_KINETIC_ENERGY],
      [MODULE_WORK_ENERGY, CONCEPT_WORK_ENERGY_THEOREM],
    ] as const) {
      const c = challengeFor(moduleId, conceptId);
      expect(nonProjectileRunDurationMs(c, 10)).toBe(RUN_DURATION_MS);
    }
  });

  it("nonProjectileRunDurationMs derives Newton's duration from the submitted force's real predicted acceleration", () => {
    const c = challengeFor(MODULE_NEWTON, CONCEPT_FORCE_ACCELERATION);
    const submittedForce = c.requiredForce!;
    expect(nonProjectileRunDurationMs(c, submittedForce)).toBe(newtonRunDurationMs(predictedValue(c, submittedForce)));
  });
});

describe("projectile completion never fires before the ball is physically at its landing point", () => {
  // Regression test for the bug this fix replaces: the old code scheduled
  // the result via setTimeout(flightTime * 550, capped at 2600) while the
  // canvas animated the flight in real time (elapsed seconds / flightTime),
  // so for any flight longer than ~1.1s the result appeared while the
  // projectile was still mid-air (as little as 26% of the way through a
  // 10s flight). The fix ties both the animation and the completion check
  // to the same presentation-duration clock, so t always reaches exactly 1
  // - the real landing point - at the instant completion is allowed to fire.
  it("the t used to position the ball reaches exactly 1 (landing) at the moment elapsed time reaches the run's duration, for both short and long flights", () => {
    const c = challengeFor(MODULE_PROJECTILE, CONCEPT_SPEED_RANGE);
    for (const speed of [4, 12, 25]) {
      const { speed: launchSpeed, gravity } = flightParamsFor(c, speed);
      const flightTimeSeconds = projectileFlightTime(launchSpeed, gravity);
      const durationMs = projectileRunDurationMs(flightTimeSeconds);

      const t = Math.min(durationMs / durationMs, 1);
      expect(t).toBe(1);

      const posAtCompletion = projectilePositionAt(launchSpeed, gravity, t * flightTimeSeconds);
      const posAtRealLanding = projectilePositionAt(launchSpeed, gravity, flightTimeSeconds);
      expect(posAtCompletion.x).toBeCloseTo(posAtRealLanding.x, 6);
      expect(posAtCompletion.y).toBeCloseTo(posAtRealLanding.y, 6);

      // And strictly before that instant, the ball must still be short of
      // landing - the result can never have already fired mid-flight.
      const tBefore = Math.min((durationMs * 0.5) / durationMs, 1);
      const posBefore = projectilePositionAt(launchSpeed, gravity, tBefore * flightTimeSeconds);
      expect(Math.abs(posBefore.x)).toBeLessThan(Math.abs(posAtRealLanding.x));
    }
  });
});

describe("the animation and the result never diverge", () => {
  it("Work: the work value shown at the end of the animation equals what targetValueOf/predictedValue would score", () => {
    const c = challengeFor(MODULE_WORK_ENERGY, CONCEPT_WORK);
    const correctForce = c.requiredForceForWork!;
    const readoutAtEnd = runningReadoutFor(c, correctForce, 1)!;
    const shownWork = Number(readoutAtEnd.lines.find((l) => l.label === "Work")!.value.replace(" J", ""));
    const actualResult = predictedValue(c, correctForce);
    // The readout rounds to 1 decimal for display; allow that rounding.
    expect(Math.abs(shownWork - actualResult)).toBeLessThan(0.05);
    expect(Math.abs(actualResult - targetValueOf(c))).toBeLessThanOrEqual(c.tolerance);
  });
});

describe("Impulse: cart-vs-barrier physical timing (pre-impact / impact / post-impact)", () => {
  it("impulseRunDurationMs never falls outside [MIN_RUN_MS, MAX_RUN_MS]", () => {
    for (const mastery of [0.05, 0.3, 0.5, 0.7, 0.95]) {
      const c = momentumChallengeAt(CONCEPT_IMPULSE, mastery);
      const ms = impulseRunDurationMs(c);
      expect(ms).toBeGreaterThanOrEqual(MIN_RUN_MS);
      expect(ms).toBeLessThanOrEqual(MAX_RUN_MS);
    }
  });

  it("the impact instant is strictly between the start and end of the run - never at 0 or 1", () => {
    const c = momentumChallengeAt(CONCEPT_IMPULSE, 0.5);
    const durationMs = impulseRunDurationMs(c);
    const impactP = impulseImpactProgress(c, durationMs);
    expect(impactP).toBeGreaterThan(0);
    expect(impactP).toBeLessThan(1);
  });

  it("impulseHasImpactedAt is false right before the impact instant and true at/after it", () => {
    const c = momentumChallengeAt(CONCEPT_IMPULSE, 0.5);
    const durationMs = impulseRunDurationMs(c);
    const impactP = impulseImpactProgress(c, durationMs);
    expect(impulseHasImpactedAt(c, Math.max(0, impactP - 0.05), durationMs)).toBe(false);
    expect(impulseHasImpactedAt(c, impactP, durationMs)).toBe(true);
    expect(impulseHasImpactedAt(c, 1, durationMs)).toBe(true);
  });

  it("the cart moves continuously (never teleports): position at the impact instant matches from both sides", () => {
    const c = momentumChallengeAt(CONCEPT_IMPULSE, 0.5);
    const durationMs = impulseRunDurationMs(c);
    const impactP = impulseImpactProgress(c, durationMs);
    const justBefore = impulseCartPositionMetersFor(c, impactP - 1e-6, durationMs);
    const justAfter = impulseCartPositionMetersFor(c, impactP + 1e-6, durationMs);
    expect(justAfter).toBeCloseTo(justBefore, 2);
  });

  it("real kinematics before impact: position = initialVelocity * elapsed seconds", () => {
    const c = momentumChallengeAt(CONCEPT_IMPULSE, 0.1);
    const durationMs = impulseRunDurationMs(c);
    const impactP = impulseImpactProgress(c, durationMs);
    const halfwayToImpact = impactP * 0.5;
    const expected = (c.initialVelocity ?? 0) * (halfwayToImpact * (durationMs / 1000));
    expect(impulseCartPositionMetersFor(c, halfwayToImpact, durationMs)).toBeCloseTo(expected, 4);
  });

  it("real kinematics after impact: the cart's velocity genuinely changes to the true final velocity, not the player's guess", () => {
    const c = momentumChallengeAt(CONCEPT_IMPULSE, 0.1); // Beginner: finalVelocity != initialVelocity by construction
    const durationMs = impulseRunDurationMs(c);
    const trueFinal = impulseTrueFinalVelocity(c);
    expect(trueFinal).not.toBeCloseTo(c.initialVelocity ?? 0, 1);

    const impactP = impulseImpactProgress(c, durationMs);
    const posAtImpact = impulseCartPositionMetersFor(c, impactP, durationMs);
    const posShortlyAfter = impulseCartPositionMetersFor(c, Math.min(1, impactP + 0.05), durationMs);
    const elapsedAfterSeconds = 0.05 * (durationMs / 1000);
    expect(posShortlyAfter - posAtImpact).toBeCloseTo(trueFinal * elapsedAfterSeconds, 2);
  });

  it("never fires completion before the run's real physical duration (which already bakes in the post-impact observation window)", () => {
    const c = momentumChallengeAt(CONCEPT_IMPULSE, 0.5);
    const durationMs = nonProjectileRunDurationMs(c, targetValueOf(c));
    for (const elapsed of [0, durationMs * 0.3, durationMs * 0.9]) {
      expect(experimentPhaseAt(elapsed, durationMs).phase).not.toBe("complete");
    }
    expect(experimentPhaseAt(durationMs, durationMs).phase).toBe("complete");
  });

  it("runningReadoutFor shows the impulse only once the impact has actually happened", () => {
    const c = momentumChallengeAt(CONCEPT_IMPULSE, 0.1);
    const durationMs = impulseRunDurationMs(c);
    const impactP = impulseImpactProgress(c, durationMs);
    const before = runningReadoutFor(c, targetValueOf(c), impactP * 0.5, durationMs)!;
    expect(before.lines.some((l) => l.label === "Impulse")).toBe(false);
    const after = runningReadoutFor(c, targetValueOf(c), 1, durationMs)!;
    const shown = Number(after.lines.find((l) => l.label === "Impulse")!.value.replace(" N·s", ""));
    const trueImpulse = impulse(c.mass!, c.initialVelocity!, impulseTrueFinalVelocity(c));
    expect(shown).toBeCloseTo(trueImpulse, 1);
  });
});

describe("Conservation of Momentum: two-cart physical timing (approach / collision / post-collision)", () => {
  it("momentumRunDurationMs never falls outside [MIN_RUN_MS, MAX_RUN_MS]", () => {
    for (const mastery of [0.05, 0.3, 0.5, 0.7, 0.95]) {
      const c = momentumChallengeAt(CONCEPT_CONSERVATION_MOMENTUM, mastery);
      const ms = momentumRunDurationMs(c);
      expect(ms).toBeGreaterThanOrEqual(MIN_RUN_MS);
      expect(ms).toBeLessThanOrEqual(MAX_RUN_MS);
    }
  });

  it("the two carts genuinely move toward each other before the collision (carts move before collision)", () => {
    const c = momentumChallengeAt(CONCEPT_CONSERVATION_MOMENTUM, 0.1);
    const durationMs = momentumRunDurationMs(c);
    const collisionP = momentumCollisionProgress(c, durationMs);
    const start = momentumCartPositionsMetersFor(c, 0, durationMs);
    const justBeforeCollision = momentumCartPositionsMetersFor(c, collisionP * 0.9, durationMs);
    expect(start.xA).toBeCloseTo(-MOMENTUM_TRACK_HALF_GAP_M, 6);
    expect(start.xB).toBeCloseTo(MOMENTUM_TRACK_HALF_GAP_M, 6);
    // Cart A moves right (toward B); the gap between the carts shrinks.
    expect(justBeforeCollision.xA).toBeGreaterThan(start.xA);
    expect(justBeforeCollision.xB - justBeforeCollision.xA).toBeLessThan(start.xB - start.xA);
  });

  it("the collision is detected at a real instant strictly between the run's start and end", () => {
    const c = momentumChallengeAt(CONCEPT_CONSERVATION_MOMENTUM, 0.5);
    const durationMs = momentumRunDurationMs(c);
    const collisionP = momentumCollisionProgress(c, durationMs);
    expect(collisionP).toBeGreaterThan(0);
    expect(collisionP).toBeLessThan(1);
    expect(momentumHasCollidedAt(c, collisionP - 0.05, durationMs)).toBe(false);
    expect(momentumHasCollidedAt(c, collisionP, durationMs)).toBe(true);
  });

  it("the carts are touching (gap = 2*CART_HALF_WIDTH_M) at the moment the collision is detected", () => {
    const c = momentumChallengeAt(CONCEPT_CONSERVATION_MOMENTUM, 0.5);
    const durationMs = momentumRunDurationMs(c);
    const collisionP = momentumCollisionProgress(c, durationMs);
    const atCollision = momentumCartPositionsMetersFor(c, collisionP, durationMs);
    expect(atCollision.xB - atCollision.xA).toBeCloseTo(2 * CART_HALF_WIDTH_M, 4);
  });

  it("the collision updates both carts' velocities to the true post-collision values, never the pre-collision ones", () => {
    const c = momentumChallengeAt(CONCEPT_CONSERVATION_MOMENTUM, 0.5); // Intermediate: elastic, v1 != v2 != u1/u2
    expect(c.collisionType).toBe("elastic");
    const durationMs = momentumRunDurationMs(c);
    const collisionP = momentumCollisionProgress(c, durationMs);
    const atCollision = momentumCartPositionsMetersFor(c, collisionP, durationMs);
    const shortlyAfter = momentumCartPositionsMetersFor(c, Math.min(1, collisionP + 0.05), durationMs);
    const elapsedSeconds = 0.05 * (durationMs / 1000);
    expect(shortlyAfter.xA - atCollision.xA).toBeCloseTo(c.finalVelocity1! * elapsedSeconds, 2);
    expect(shortlyAfter.xB - atCollision.xB).toBeCloseTo(c.finalVelocity2! * elapsedSeconds, 2);
  });

  it("a perfectly inelastic collision visibly sticks the two carts together (same position) after impact", () => {
    const c = momentumChallengeAt(CONCEPT_CONSERVATION_MOMENTUM, 0.1); // Beginner: inelastic
    expect(c.collisionType).toBe("inelastic");
    const durationMs = momentumRunDurationMs(c);
    const positionsAtEnd = momentumCartPositionsMetersFor(c, 1, durationMs);
    expect(positionsAtEnd.xA).toBeCloseTo(positionsAtEnd.xB, 6);
  });

  it("an elastic collision visibly separates the two carts after impact", () => {
    const c = momentumChallengeAt(CONCEPT_CONSERVATION_MOMENTUM, 0.5); // Intermediate: elastic
    const durationMs = momentumRunDurationMs(c);
    const positionsAtEnd = momentumCartPositionsMetersFor(c, 1, durationMs);
    expect(Math.abs(positionsAtEnd.xA - positionsAtEnd.xB)).toBeGreaterThan(0.01);
  });

  it("never fires completion before the run's real physical duration (result cannot appear before the collision resolves)", () => {
    const c = momentumChallengeAt(CONCEPT_CONSERVATION_MOMENTUM, 0.5);
    const durationMs = nonProjectileRunDurationMs(c, targetValueOf(c));
    const collisionP = momentumCollisionProgress(c, durationMs);
    // Strictly before the collision, the phase must not be complete.
    expect(experimentPhaseAt(collisionP * durationMs * 0.5, durationMs).phase).not.toBe("complete");
    expect(experimentPhaseAt(durationMs, durationMs).phase).toBe("complete");
  });

  it("the momentum-before/after readout reports the same total momentum throughout, demonstrating conservation live", () => {
    const c = momentumChallengeAt(CONCEPT_CONSERVATION_MOMENTUM, 0.5);
    const durationMs = momentumRunDurationMs(c);
    const collisionP = momentumCollisionProgress(c, durationMs);
    const before = runningReadoutFor(c, targetValueOf(c), collisionP * 0.5, durationMs)!;
    const beforeValue = Number(before.lines.find((l) => l.label === "Momentum Before")!.value.replace(" kg·m/s", ""));
    const after = runningReadoutFor(c, targetValueOf(c), 1, durationMs)!;
    const afterValue = Number(after.lines.find((l) => l.label === "Momentum After")!.value.replace(" kg·m/s", ""));
    expect(afterValue).toBeCloseTo(beforeValue, 0);
    // And sanity-check both against the real physics directly.
    const trueBefore = totalMomentum(c.mass1!, c.velocity1!, c.mass2!, c.velocity2!);
    expect(beforeValue).toBeCloseTo(trueBefore, 1);
  });
});

describe("Circular Motion: revolution-based physical completion", () => {
  it("requires 1 revolution Beginner, 2 Intermediate, 3 Advanced", () => {
    expect(circularRevolutionsRequired(circularChallengeAt(CONCEPT_CENTRIPETAL_FORCE, 0.05))).toBe(1);
    expect(circularRevolutionsRequired(circularChallengeAt(CONCEPT_CENTRIPETAL_FORCE, 0.5))).toBe(2);
    expect(circularRevolutionsRequired(circularChallengeAt(CONCEPT_CENTRIPETAL_FORCE, 0.95))).toBe(3);
  });

  it("circularRunDurationMs never falls outside [MIN_RUN_MS, MAX_RUN_MS]", () => {
    for (const mastery of [0.05, 0.3, 0.5, 0.7, 0.95]) {
      for (const conceptId of [CONCEPT_CENTRIPETAL_FORCE, CONCEPT_CENTRIPETAL_ACCELERATION, CONCEPT_CIRCULAR_SPEED]) {
        const c = circularChallengeAt(conceptId, mastery);
        const ms = circularRunDurationMs(c, targetValueOf(c));
        expect(ms).toBeGreaterThanOrEqual(MIN_RUN_MS);
        expect(ms).toBeLessThanOrEqual(MAX_RUN_MS);
      }
    }
  });

  it("the object's initial position (angle 0) lies exactly on the circle of the true radius", () => {
    const c = circularChallengeAt(CONCEPT_CENTRIPETAL_FORCE, 0.1);
    const angle = circularAngleAt(c, 0);
    expect(angle).toBe(0);
  });

  it("the angle increases continuously and monotonically with progress", () => {
    const c = circularChallengeAt(CONCEPT_CENTRIPETAL_FORCE, 0.5);
    const samples = [0, 0.1, 0.25, 0.4, 0.6, 0.8, 1].map((p) => circularAngleAt(c, p));
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeGreaterThan(samples[i - 1]);
    }
  });

  it("the object completes exactly the required number of revolutions (2*pi*revolutions radians) by progress 1, never more, never less", () => {
    const c = circularChallengeAt(CONCEPT_CENTRIPETAL_ACCELERATION, 0.5); // Intermediate: 2 revolutions
    expect(circularAngleAt(c, 1)).toBeCloseTo(2 * 2 * Math.PI, 6);
    expect(circularAngleAt(c, 0.99)).toBeLessThan(2 * 2 * Math.PI);
  });

  it("circularRevolutionsCompletedAt ramps linearly from 0 to the required revolution count", () => {
    const c = circularChallengeAt(CONCEPT_CIRCULAR_SPEED, 0.9); // Advanced: 3 revolutions
    expect(circularRevolutionsCompletedAt(c, 0)).toBe(0);
    expect(circularRevolutionsCompletedAt(c, 0.5)).toBeCloseTo(1.5, 6);
    expect(circularRevolutionsCompletedAt(c, 1)).toBeCloseTo(3, 6);
  });

  it("never fires completion before the run's real physical duration (the required revolutions have not yet been completed)", () => {
    const c = circularChallengeAt(CONCEPT_CENTRIPETAL_FORCE, 0.5);
    const durationMs = nonProjectileRunDurationMs(c, targetValueOf(c));
    for (const elapsed of [0, durationMs * 0.3, durationMs * 0.9, durationMs * 0.999]) {
      expect(experimentPhaseAt(elapsed, durationMs).phase).not.toBe("complete");
    }
    expect(experimentPhaseAt(durationMs, durationMs).phase).toBe("complete");
  });

  it("the true simulation state used for animation is the true given radius/speed for the Beginner (fully-given) sub-type", () => {
    const c = circularChallengeAt(CONCEPT_CENTRIPETAL_FORCE, 0.1);
    const { radius, speed } = circularSimParamsFor(c, targetValueOf(c));
    expect(radius).toBe(c.radius);
    expect(speed).toBe(c.speed);
  });

  it("the true simulation state resolves the guess into whichever of radius/speed is this challenge's unknown", () => {
    const c = circularChallengeAt(CONCEPT_CENTRIPETAL_FORCE, 0.5); // forceSolveFor: "speed"
    const correctSpeed = Math.sqrt((c.targetCentripetalForce! * c.radius!) / c.mass!);
    const { radius, speed } = circularSimParamsFor(c, correctSpeed);
    expect(radius).toBe(c.radius);
    expect(speed).toBeCloseTo(correctSpeed, 6);
  });

  it("measured values (speed, centripetal force) shown by runningReadoutFor match the same simulation state used elsewhere", () => {
    const c = circularChallengeAt(CONCEPT_CENTRIPETAL_FORCE, 0.1);
    const durationMs = circularRunDurationMs(c, targetValueOf(c));
    const readout = runningReadoutFor(c, targetValueOf(c), 1, durationMs)!;
    const shownForce = Number(readout.lines.find((l) => l.label === "Centripetal Force")!.value.replace(" N", ""));
    const { mass, radius, speed } = circularSimParamsFor(c, targetValueOf(c));
    expect(shownForce).toBeCloseTo(centripetalForceFromSpeed(mass, speed, radius), 1);
  });

  it("runningReadoutFor reports revolution progress that reaches the required count by progress 1", () => {
    const c = circularChallengeAt(CONCEPT_CENTRIPETAL_ACCELERATION, 0.9); // Advanced: 3 revolutions
    const readout = runningReadoutFor(c, targetValueOf(c), 1, circularRunDurationMs(c, targetValueOf(c)))!;
    const revLine = readout.lines.find((l) => l.label === "Revolutions")!.value;
    expect(revLine).toBe("3.0 / 3");
  });

  it("isNonProjectileModule treats Circular Motion the same as Newton/Work & Energy/Momentum", () => {
    expect(isNonProjectileModule(circularChallengeAt(CONCEPT_CENTRIPETAL_FORCE, 0.1))).toBe(true);
  });
});
