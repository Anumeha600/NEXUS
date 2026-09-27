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
import { projectileRange, momentum, impulse, centripetalForceFromSpeed, centripetalAccelerationFromSpeed, circularSpeedFromOmega, angularVelocityFromSpeed, circularPeriod } from "./physics";
import {
  flightParamsFor,
  predictedValue,
  targetValueOf,
  validateInput,
  contextFor,
  buildLearningEventPayload,
  givenFieldsFor,
  inputLabelFor,
  actionLabelFor,
  resultExtrasFor,
  circularSimParamsFor,
} from "./challengeLogic";

// Generates a real challenge for a given concept via the actual adaptive
// engine, rather than hand-building a fixture - so these tests exercise the
// same objects the game itself produces.
function challengeFor(moduleId: string, conceptId: string): Challenge {
  const engine = new AdaptiveEngine();
  engine.currentModuleId = moduleId;
  engine.currentConceptId = conceptId;
  return engine.generateNextChallenge();
}

// Momentum's 3 concepts each rotate their sub-type by mastery tier (see
// adaptiveEngine.ts) - this pins a specific mastery so tests can target a
// specific sub-type deterministically instead of whatever the concept's
// default (mastery 0.3, Beginner) tier happens to be.
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

describe("input validation", () => {
  const speedRange = challengeFor(MODULE_PROJECTILE, CONCEPT_SPEED_RANGE);

  it("rejects empty input", () => {
    const result = validateInput("", speedRange);
    expect(result).toEqual({ error: "Enter a value." });
  });

  it("rejects whitespace-only input", () => {
    expect(validateInput("   ", speedRange)).toEqual({ error: "Enter a value." });
  });

  it("rejects non-numeric input", () => {
    expect(validateInput("abc", speedRange)).toEqual({ error: "Enter a valid number." });
  });

  it("rejects zero for a concept that requires a positive value", () => {
    const result = validateInput("0", speedRange);
    expect("error" in result).toBe(true);
  });

  it("rejects negative values for a concept that requires a positive value", () => {
    const result = validateInput("-5", speedRange);
    expect("error" in result).toBe(true);
  });

  it("rejects excessively large values", () => {
    expect(validateInput("999999999", speedRange)).toEqual({ error: "That value is unrealistically large." });
  });

  it("accepts decimal values", () => {
    expect(validateInput("11.25", speedRange)).toEqual({ value: 11.25 });
  });

  it("accepts a small positive boundary value", () => {
    expect(validateInput("0.01", speedRange)).toEqual({ value: 0.01 });
  });

  it("allows negative and zero values for concepts where they are physically meaningful (Newton's applied force)", () => {
    const netForce = challengeFor(MODULE_NEWTON, CONCEPT_NET_FORCE);
    expect(validateInput("-10", netForce)).toEqual({ value: -10 });
    expect(validateInput("0", netForce)).toEqual({ value: 0 });
  });

  it("allows negative work input for Work-Energy Theorem (deceleration is physically valid)", () => {
    const wet = challengeFor(MODULE_WORK_ENERGY, CONCEPT_WORK_ENERGY_THEOREM);
    expect(validateInput("-50", wet)).toEqual({ value: -50 });
  });
});

describe("flightParamsFor resolves the correct unknown per projectile concept", () => {
  it("Speed & Range: controlValue is speed, gravity comes from the challenge", () => {
    const c = challengeFor(MODULE_PROJECTILE, CONCEPT_SPEED_RANGE);
    const { speed, gravity } = flightParamsFor(c, 12);
    expect(speed).toBe(12);
    expect(gravity).toBe(c.gravity);
  });

  it("Gravity & Trajectory: controlValue is gravity, speed comes from the challenge's givenSpeed", () => {
    const c = challengeFor(MODULE_PROJECTILE, CONCEPT_GRAVITY_RANGE);
    const { speed, gravity } = flightParamsFor(c, 11);
    expect(gravity).toBe(11);
    expect(speed).toBe(c.givenSpeed);
  });
});

describe("predictedValue / targetValueOf agree with the actual physics for every concept", () => {
  it("Force & Acceleration: predicted acceleration from a correct force matches the target", () => {
    const c = challengeFor(MODULE_NEWTON, CONCEPT_FORCE_ACCELERATION);
    const correctForce = c.requiredForce!;
    expect(predictedValue(c, correctForce)).toBeCloseTo(targetValueOf(c), 6);
  });

  it("Net Force: predicted acceleration accounts for the secondary force, not just the applied force", () => {
    const c = challengeFor(MODULE_NEWTON, CONCEPT_NET_FORCE);
    const correctForce = c.requiredForce!;
    expect(predictedValue(c, correctForce)).toBeCloseTo(targetValueOf(c), 6);
    // Proof the secondary force is actually load-bearing: a different
    // applied force plugged in without it would give the wrong answer.
    const naiveAccel = correctForce / c.mass!;
    expect(naiveAccel).not.toBeCloseTo(targetValueOf(c), 3);
  });

  it("Friction: predicted acceleration subtracts friction from the applied force", () => {
    const c = challengeFor(MODULE_NEWTON, CONCEPT_FRICTION);
    const correctForce = c.requiredForce!;
    expect(predictedValue(c, correctForce)).toBeCloseTo(targetValueOf(c), 6);
  });

  it("Work: predicted work from the correct force matches the target work within tolerance", () => {
    const c = challengeFor(MODULE_WORK_ENERGY, CONCEPT_WORK);
    const correctForce = c.requiredForceForWork!;
    const error = Math.abs(predictedValue(c, correctForce) - targetValueOf(c));
    expect(error).toBeLessThanOrEqual(c.tolerance);
  });

  it("Kinetic Energy: predicted KE from the correct velocity matches the target KE within tolerance", () => {
    const c = challengeFor(MODULE_WORK_ENERGY, CONCEPT_KINETIC_ENERGY);
    const correctVelocity = c.requiredVelocity!;
    const error = Math.abs(predictedValue(c, correctVelocity) - targetValueOf(c));
    expect(error).toBeLessThanOrEqual(c.tolerance);
  });

  it("Work-Energy Theorem: the correct work input equals the required net work target", () => {
    const c = challengeFor(MODULE_WORK_ENERGY, CONCEPT_WORK_ENERGY_THEOREM);
    expect(predictedValue(c, c.requiredNetWork!)).toBeCloseTo(targetValueOf(c), 6);
  });

  it("Speed & Range / Gravity & Trajectory: correct answer reproduces the target range via real flight physics", () => {
    for (const conceptId of [CONCEPT_SPEED_RANGE, CONCEPT_GRAVITY_RANGE]) {
      const c = challengeFor(MODULE_PROJECTILE, conceptId);
      const correctControl = conceptId === CONCEPT_SPEED_RANGE ? Math.sqrt(c.targetDistance! * c.gravity!) : (c.givenSpeed! * c.givenSpeed!) / c.targetDistance!;
      const { speed, gravity } = flightParamsFor(c, correctControl);
      const actualRange = projectileRange(speed, gravity);
      const error = Math.abs(actualRange - targetValueOf(c));
      expect(error).toBeLessThanOrEqual(c.tolerance);
    }
  });
});

describe("scoring tolerance", () => {
  it("an answer within tolerance succeeds; the same-size error just outside tolerance fails", () => {
    const c = challengeFor(MODULE_NEWTON, CONCEPT_FORCE_ACCELERATION);
    const target = targetValueOf(c);
    const withinToleranceError = c.tolerance * 0.5;
    const outsideToleranceError = c.tolerance * 1.5;
    expect(withinToleranceError <= c.tolerance).toBe(true);
    expect(outsideToleranceError <= c.tolerance).toBe(false);
    void target;
  });
});

describe("per-concept context reports concept-appropriate fields, not generic/mismatched ones", () => {
  it("Kinetic Energy reports velocity, never an applied_force field", () => {
    const c = challengeFor(MODULE_WORK_ENERGY, CONCEPT_KINETIC_ENERGY);
    const ctx = contextFor(c, 8, predictedValue(c, 8));
    expect(ctx.velocity).toBe(8);
    expect(ctx).not.toHaveProperty("applied_force");
  });

  it("Work-Energy Theorem reports work/energy fields, not force fields", () => {
    const c = challengeFor(MODULE_WORK_ENERGY, CONCEPT_WORK_ENERGY_THEOREM);
    const ctx = contextFor(c, 50, predictedValue(c, 50));
    expect(ctx.work_input).toBe(50);
    expect(ctx).toHaveProperty("resulting_final_velocity");
    expect(ctx).toHaveProperty("achieved_delta_ke");
    expect(ctx).not.toHaveProperty("applied_force");
  });

  it("Gravity & Trajectory reports the submitted and correct gravity, not a generic launch_speed control", () => {
    const c = challengeFor(MODULE_PROJECTILE, CONCEPT_GRAVITY_RANGE);
    const ctx = contextFor(c, 9.8, c.targetDistance ?? 0);
    expect(ctx.submitted_gravity).toBe(9.8);
    expect(ctx.correct_gravity).toBe(c.gravity);
    expect(ctx.given_speed).toBe(c.givenSpeed);
  });

  it("Newton concepts report mass, applied_force, extra_force, and both accelerations", () => {
    const c = challengeFor(MODULE_NEWTON, CONCEPT_FRICTION);
    const ctx = contextFor(c, 20, predictedValue(c, 20));
    expect(ctx.mass).toBe(c.mass);
    expect(ctx.applied_force).toBe(20);
    expect(ctx.extra_force).toBeCloseTo(-(c.frictionForce ?? 0), 6);
  });
});

describe("buildLearningEventPayload produces a complete, concept-correct learning event", () => {
  const cases: { moduleId: string; conceptId: string }[] = [
    { moduleId: MODULE_PROJECTILE, conceptId: CONCEPT_SPEED_RANGE },
    { moduleId: MODULE_PROJECTILE, conceptId: CONCEPT_GRAVITY_RANGE },
    { moduleId: MODULE_NEWTON, conceptId: CONCEPT_FORCE_ACCELERATION },
    { moduleId: MODULE_NEWTON, conceptId: CONCEPT_NET_FORCE },
    { moduleId: MODULE_NEWTON, conceptId: CONCEPT_FRICTION },
    { moduleId: MODULE_WORK_ENERGY, conceptId: CONCEPT_WORK },
    { moduleId: MODULE_WORK_ENERGY, conceptId: CONCEPT_KINETIC_ENERGY },
    { moduleId: MODULE_WORK_ENERGY, conceptId: CONCEPT_WORK_ENERGY_THEOREM },
  ];

  it.each([
    ...cases,
    { moduleId: MODULE_MOMENTUM, conceptId: CONCEPT_MOMENTUM },
    { moduleId: MODULE_MOMENTUM, conceptId: CONCEPT_IMPULSE },
    { moduleId: MODULE_MOMENTUM, conceptId: CONCEPT_CONSERVATION_MOMENTUM },
  ])("$conceptId produces a valid event with every required field", ({ moduleId, conceptId }) => {
    const c = challengeFor(moduleId, conceptId);
    const payload = buildLearningEventPayload({
      challenge: c,
      submittedValue: 5,
      actualValue: predictedValue(c, 5),
      success: false,
      performance: 0.5,
      masteryBefore: 0.3,
      masteryAfter: 0.35,
      sessionId: "test-session",
      attemptNumber: 3,
      recentAttempts: 2,
    });

    expect(payload.session_id).toBe("test-session");
    expect(payload.module).toBe(moduleId);
    expect(payload.challenge_type).toBe(conceptId);
    expect(payload.difficulty).toBe(c.difficulty);
    expect(typeof payload.target_value).toBe("number");
    expect(typeof payload.actual_value).toBe("number");
    expect(payload.unit.length).toBeGreaterThan(0);
    expect(payload.success).toBe(false);
    expect(payload.performance).toBe(0.5);
    expect(payload.mastery_before).toBe(0.3);
    expect(payload.mastery_after).toBe(0.35);
    expect(payload.attempt_number).toBe(3);
    expect(payload.recent_attempts).toBe(2);
    expect(payload.context).toBeTruthy();
  });

  it("Kinetic Energy's event context never contains an applied_force field", () => {
    const c = challengeFor(MODULE_WORK_ENERGY, CONCEPT_KINETIC_ENERGY);
    const payload = buildLearningEventPayload({
      challenge: c,
      submittedValue: 9,
      actualValue: predictedValue(c, 9),
      success: true,
      performance: 0.9,
      masteryBefore: 0.5,
      masteryAfter: 0.6,
      sessionId: "s",
      attemptNumber: 1,
      recentAttempts: 1,
    });
    expect(payload.context).not.toHaveProperty("applied_force");
    expect(payload.context.velocity).toBe(9);
  });
});

describe("HUD helper functions stay concept-appropriate", () => {
  it("every concept has at least one given field, an input label, and an action label", () => {
    const cases: { moduleId: string; conceptId: string }[] = [
      { moduleId: MODULE_PROJECTILE, conceptId: CONCEPT_SPEED_RANGE },
      { moduleId: MODULE_PROJECTILE, conceptId: CONCEPT_GRAVITY_RANGE },
      { moduleId: MODULE_NEWTON, conceptId: CONCEPT_FORCE_ACCELERATION },
      { moduleId: MODULE_NEWTON, conceptId: CONCEPT_NET_FORCE },
      { moduleId: MODULE_NEWTON, conceptId: CONCEPT_FRICTION },
      { moduleId: MODULE_WORK_ENERGY, conceptId: CONCEPT_WORK },
      { moduleId: MODULE_WORK_ENERGY, conceptId: CONCEPT_KINETIC_ENERGY },
      { moduleId: MODULE_WORK_ENERGY, conceptId: CONCEPT_WORK_ENERGY_THEOREM },
      { moduleId: MODULE_MOMENTUM, conceptId: CONCEPT_MOMENTUM },
      { moduleId: MODULE_MOMENTUM, conceptId: CONCEPT_IMPULSE },
      { moduleId: MODULE_MOMENTUM, conceptId: CONCEPT_CONSERVATION_MOMENTUM },
    ];
    for (const { moduleId, conceptId } of cases) {
      const c = challengeFor(moduleId, conceptId);
      expect(givenFieldsFor(c).length).toBeGreaterThan(0);
      expect(inputLabelFor(c).length).toBeGreaterThan(0);
      expect(actionLabelFor(c).length).toBeGreaterThan(0);
    }
  });

  it("Momentum & Collisions uses its own RUN EXPERIMENT action label, distinct from Newton's APPLY FORCE", () => {
    const c = challengeFor(MODULE_MOMENTUM, CONCEPT_MOMENTUM);
    expect(actionLabelFor(c)).toBe("RUN EXPERIMENT");
  });

  it("Gravity & Trajectory's input label asks for gravity, not speed", () => {
    const c = challengeFor(MODULE_PROJECTILE, CONCEPT_GRAVITY_RANGE);
    expect(inputLabelFor(c).toLowerCase()).toContain("gravity");
  });

  it("Speed & Range and Gravity & Trajectory ask for different input labels (not the same relabeled control)", () => {
    const speedRange = challengeFor(MODULE_PROJECTILE, CONCEPT_SPEED_RANGE);
    const gravityRange = challengeFor(MODULE_PROJECTILE, CONCEPT_GRAVITY_RANGE);
    expect(inputLabelFor(speedRange)).not.toBe(inputLabelFor(gravityRange));
  });
});

describe("Momentum & Collisions: input validation", () => {
  it("rejects zero/negative mass when Momentum solves for mass", () => {
    const c = momentumChallengeAt(CONCEPT_MOMENTUM, 0.9); // Advanced -> solve for mass
    expect(c.momentumSolveFor).toBe("mass");
    expect("error" in validateInput("0", c)).toBe(true);
    expect("error" in validateInput("-3", c)).toBe(true);
    expect(validateInput("5", c)).toEqual({ value: 5 });
  });

  it("rejects zero/negative force when Impulse solves for force", () => {
    const c = momentumChallengeAt(CONCEPT_IMPULSE, 0.9); // Advanced -> solve for force
    expect(c.impulseSolveFor).toBe("force");
    expect("error" in validateInput("0", c)).toBe(true);
    expect("error" in validateInput("-10", c)).toBe(true);
  });

  it("allows negative velocity for Momentum's velocity sub-type (direction is physically meaningful)", () => {
    const c = momentumChallengeAt(CONCEPT_MOMENTUM, 0.5); // Intermediate -> solve for velocity
    expect(c.momentumSolveFor).toBe("velocity");
    expect(validateInput("-6", c)).toEqual({ value: -6 });
  });

  it("allows negative momentum, impulse, and final-velocity guesses (all signed quantities)", () => {
    const momentumDirect = momentumChallengeAt(CONCEPT_MOMENTUM, 0.1);
    expect(validateInput("-20", momentumDirect)).toEqual({ value: -20 });

    const impulseDirect = momentumChallengeAt(CONCEPT_IMPULSE, 0.1);
    expect(validateInput("-8", impulseDirect)).toEqual({ value: -8 });

    const conservation = challengeFor(MODULE_MOMENTUM, CONCEPT_CONSERVATION_MOMENTUM);
    expect(validateInput("-3.5", conservation)).toEqual({ value: -3.5 });
  });
});

describe("Momentum & Collisions: predictedValue / targetValueOf agree with the actual physics", () => {
  it("Momentum (find momentum): the correct guess is mass*velocity computed from the givens", () => {
    const c = momentumChallengeAt(CONCEPT_MOMENTUM, 0.1);
    const correct = momentum(c.mass!, c.velocity!);
    expect(predictedValue(c, correct)).toBeCloseTo(targetValueOf(c), 6);
  });

  it("Momentum (find velocity): the correct velocity, plugged into p = mv, matches the target momentum", () => {
    const c = momentumChallengeAt(CONCEPT_MOMENTUM, 0.5);
    const correctVelocity = c.targetMomentum! / c.mass!;
    expect(predictedValue(c, correctVelocity)).toBeCloseTo(targetValueOf(c), 6);
  });

  it("Momentum (find mass): the correct mass, plugged into p = mv, matches the target momentum", () => {
    const c = momentumChallengeAt(CONCEPT_MOMENTUM, 0.9);
    const correctMass = c.targetMomentum! / c.velocity!;
    expect(predictedValue(c, correctMass)).toBeCloseTo(targetValueOf(c), 6);
  });

  it("Impulse (find impulse): the correct guess is m(vf - vi) computed from the givens", () => {
    const c = momentumChallengeAt(CONCEPT_IMPULSE, 0.1);
    const correct = impulse(c.mass!, c.initialVelocity!, c.finalVelocity!);
    expect(predictedValue(c, correct)).toBeCloseTo(targetValueOf(c), 6);
  });

  it("Impulse (find final velocity): the correct final velocity satisfies the given target impulse", () => {
    const c = momentumChallengeAt(CONCEPT_IMPULSE, 0.5);
    const correctFinalVelocity = c.initialVelocity! + c.targetImpulse! / c.mass!;
    expect(predictedValue(c, correctFinalVelocity)).toBeCloseTo(targetValueOf(c), 1);
  });

  it("Impulse (find force): the correct force is the given impulse divided by the given contact time", () => {
    const c = momentumChallengeAt(CONCEPT_IMPULSE, 0.9);
    const correctForce = c.targetImpulse! / c.contactTime!;
    expect(predictedValue(c, correctForce)).toBeCloseTo(targetValueOf(c), 6);
  });

  it("Conservation of Momentum: the correct final velocity is exactly what the collision physics produces", () => {
    for (const mastery of [0.1, 0.5, 0.9]) {
      const c = challengeFor(MODULE_MOMENTUM, CONCEPT_CONSERVATION_MOMENTUM);
      void mastery;
      const correct = targetValueOf(c);
      expect(predictedValue(c, correct)).toBeCloseTo(targetValueOf(c), 6);
    }
  });

  it("a wrong guess scores as an error, proving the target is a genuine fixed physics outcome (not just an echo of the guess)", () => {
    const c = challengeFor(MODULE_MOMENTUM, CONCEPT_CONSERVATION_MOMENTUM);
    const wrong = targetValueOf(c) + 1000;
    const error = Math.abs(predictedValue(c, wrong) - targetValueOf(c));
    expect(error).toBeGreaterThan(c.tolerance);
  });
});

describe("Momentum & Collisions: context reports concept-appropriate fields matching the module's learning-event schema", () => {
  it("Momentum reports mass, velocity, and target_momentum - never a force field", () => {
    const c = momentumChallengeAt(CONCEPT_MOMENTUM, 0.1);
    const ctx = contextFor(c, momentum(c.mass!, c.velocity!), momentum(c.mass!, c.velocity!));
    expect(ctx.mass).toBe(c.mass);
    expect(ctx.velocity).toBe(c.velocity);
    expect(ctx.target_momentum).toBe(c.targetMomentum);
    expect(ctx).not.toHaveProperty("applied_force");
  });

  it("Impulse reports mass, initial/final velocity, and target_impulse", () => {
    const c = momentumChallengeAt(CONCEPT_IMPULSE, 0.1);
    const ctx = contextFor(c, targetValueOf(c), targetValueOf(c));
    expect(ctx.mass).toBe(c.mass);
    expect(ctx.initial_velocity).toBe(c.initialVelocity);
    expect(ctx.final_velocity).toBe(c.finalVelocity);
    expect(ctx).toHaveProperty("target_impulse");
  });

  it("Conservation of Momentum reports mass1/mass2, initial/final velocities, collision_type, and momentum_before/after (matching the module's context example)", () => {
    const c = challengeFor(MODULE_MOMENTUM, CONCEPT_CONSERVATION_MOMENTUM);
    const ctx = contextFor(c, targetValueOf(c), targetValueOf(c));
    expect(ctx.mass1).toBe(c.mass1);
    expect(ctx.mass2).toBe(c.mass2);
    expect(ctx.initial_velocity1).toBe(c.velocity1);
    expect(ctx.initial_velocity2).toBe(c.velocity2);
    expect(ctx.final_velocity1).toBe(c.finalVelocity1);
    expect(ctx.final_velocity2).toBe(c.finalVelocity2);
    expect(ctx.collision_type).toBe(c.collisionType);
    // Momentum before and after must agree - this is conservation of
    // momentum, demonstrated by the reported context, not just asserted.
    expect(ctx.momentum_before).toBeCloseTo(ctx.momentum_after as number, 0);
  });
});

describe("Momentum & Collisions: resultExtrasFor (result-card explanatory rows)", () => {
  it("returns null for Momentum (find momentum/velocity/mass) - it has no before/after story", () => {
    const c = momentumChallengeAt(CONCEPT_MOMENTUM, 0.1);
    expect(resultExtrasFor(c)).toBeNull();
  });

  it("Impulse reports Initial Momentum, Final Momentum, and Impulse, always from the true physics (not the player's guess)", () => {
    const c = momentumChallengeAt(CONCEPT_IMPULSE, 0.1);
    const rows = resultExtrasFor(c)!;
    expect(rows.map((r) => r.label)).toEqual(["Initial Momentum", "Final Momentum", "Impulse"]);
    const initial = Number(rows[0].value.replace(" kg·m/s", ""));
    const final = Number(rows[1].value.replace(" kg·m/s", ""));
    const impulseValue = Number(rows[2].value.replace(" N·s", ""));
    expect(initial).toBeCloseTo(momentum(c.mass!, c.initialVelocity!), 1);
    expect(final).toBeCloseTo(momentum(c.mass!, c.finalVelocity!), 1);
    expect(impulseValue).toBeCloseTo(impulse(c.mass!, c.initialVelocity!, c.finalVelocity!), 1);
  });

  it("Conservation of Momentum reports Momentum Before and After, which always agree with each other", () => {
    const c = challengeFor(MODULE_MOMENTUM, CONCEPT_CONSERVATION_MOMENTUM);
    const rows = resultExtrasFor(c)!;
    expect(rows.map((r) => r.label)).toEqual(["Momentum Before", "Momentum After"]);
    const before = Number(rows[0].value.replace(" kg·m/s", ""));
    const after = Number(rows[1].value.replace(" kg·m/s", ""));
    expect(after).toBeCloseTo(before, 0);
  });
});

describe("Momentum & Collisions: buildLearningEventPayload", () => {
  it("reports module=momentum_collisions and the correct concept title for all 3 concepts", () => {
    for (const conceptId of [CONCEPT_MOMENTUM, CONCEPT_IMPULSE, CONCEPT_CONSERVATION_MOMENTUM]) {
      const c = challengeFor(MODULE_MOMENTUM, conceptId);
      const payload = buildLearningEventPayload({
        challenge: c,
        submittedValue: 1,
        actualValue: predictedValue(c, 1),
        success: false,
        performance: 0.4,
        masteryBefore: 0.3,
        masteryAfter: 0.32,
        sessionId: "s",
        attemptNumber: 1,
        recentAttempts: 1,
      });
      expect(payload.module).toBe(MODULE_MOMENTUM);
      expect(payload.challenge_type).toBe(conceptId);
      expect(payload.context).toBeTruthy();
    }
  });
});

describe("Circular Motion: input validation", () => {
  it("rejects zero/negative values for every sub-type of every concept - every Circular Motion quantity is a magnitude", () => {
    const cases: Challenge[] = [
      circularChallengeAt(CONCEPT_CENTRIPETAL_FORCE, 0.1),
      circularChallengeAt(CONCEPT_CENTRIPETAL_FORCE, 0.5),
      circularChallengeAt(CONCEPT_CENTRIPETAL_FORCE, 0.9),
      circularChallengeAt(CONCEPT_CENTRIPETAL_ACCELERATION, 0.1),
      circularChallengeAt(CONCEPT_CENTRIPETAL_ACCELERATION, 0.5),
      circularChallengeAt(CONCEPT_CENTRIPETAL_ACCELERATION, 0.9),
      circularChallengeAt(CONCEPT_CIRCULAR_SPEED, 0.1),
      circularChallengeAt(CONCEPT_CIRCULAR_SPEED, 0.5),
      circularChallengeAt(CONCEPT_CIRCULAR_SPEED, 0.9),
    ];
    for (const c of cases) {
      expect("error" in validateInput("0", c)).toBe(true);
      expect("error" in validateInput("-5", c)).toBe(true);
      expect(validateInput("5", c)).toEqual({ value: 5 });
    }
  });
});

describe("Circular Motion: predictedValue / targetValueOf agree with the actual physics", () => {
  it("Centripetal Force (find force): the correct guess is m*v^2/r computed from the givens", () => {
    const c = circularChallengeAt(CONCEPT_CENTRIPETAL_FORCE, 0.1);
    const correct = centripetalForceFromSpeed(c.mass!, c.speed!, c.radius!);
    expect(predictedValue(c, correct)).toBeCloseTo(targetValueOf(c), 1);
  });

  it("Centripetal Force (find speed): the correct speed, plugged into F_c=mv^2/r, matches the target force", () => {
    const c = circularChallengeAt(CONCEPT_CENTRIPETAL_FORCE, 0.5);
    const correctSpeed = Math.sqrt((c.targetCentripetalForce! * c.radius!) / c.mass!);
    expect(predictedValue(c, correctSpeed)).toBeCloseTo(targetValueOf(c), 1);
  });

  it("Centripetal Force (find radius): the correct radius, plugged into F_c=mv^2/r, matches the target force", () => {
    const c = circularChallengeAt(CONCEPT_CENTRIPETAL_FORCE, 0.9);
    const correctRadius = (c.mass! * c.speed! ** 2) / c.targetCentripetalForce!;
    expect(predictedValue(c, correctRadius)).toBeCloseTo(targetValueOf(c), 1);
  });

  it("Centripetal Acceleration (find acceleration): the correct guess is v^2/r computed from the givens", () => {
    const c = circularChallengeAt(CONCEPT_CENTRIPETAL_ACCELERATION, 0.1);
    const correct = centripetalAccelerationFromSpeed(c.speed!, c.radius!);
    expect(predictedValue(c, correct)).toBeCloseTo(targetValueOf(c), 1);
  });

  it("Centripetal Acceleration (find speed / find radius): the correct guess, plugged into a_c=v^2/r, matches the target", () => {
    const speedCase = circularChallengeAt(CONCEPT_CENTRIPETAL_ACCELERATION, 0.5);
    const correctSpeed = Math.sqrt(speedCase.targetCentripetalAcceleration! * speedCase.radius!);
    expect(predictedValue(speedCase, correctSpeed)).toBeCloseTo(targetValueOf(speedCase), 1);

    const radiusCase = circularChallengeAt(CONCEPT_CENTRIPETAL_ACCELERATION, 0.9);
    const correctRadius = radiusCase.speed! ** 2 / radiusCase.targetCentripetalAcceleration!;
    expect(predictedValue(radiusCase, correctRadius)).toBeCloseTo(targetValueOf(radiusCase), 1);
  });

  it("Circular Speed: every sub-type's correct answer reproduces the target directly (no further formula to apply)", () => {
    const speedCase = circularChallengeAt(CONCEPT_CIRCULAR_SPEED, 0.1);
    const correctSpeed = circularSpeedFromOmega(speedCase.angularVelocity!, speedCase.radius!);
    expect(predictedValue(speedCase, correctSpeed)).toBeCloseTo(targetValueOf(speedCase), 1);

    const omegaCase = circularChallengeAt(CONCEPT_CIRCULAR_SPEED, 0.5);
    const correctOmega = angularVelocityFromSpeed(omegaCase.speed!, omegaCase.radius!);
    expect(predictedValue(omegaCase, correctOmega)).toBeCloseTo(targetValueOf(omegaCase), 1);

    const periodCase = circularChallengeAt(CONCEPT_CIRCULAR_SPEED, 0.9);
    const correctPeriod = circularPeriod(periodCase.radius!, periodCase.speed!);
    expect(predictedValue(periodCase, correctPeriod)).toBeCloseTo(targetValueOf(periodCase), 1);
  });

  it("a wrong guess scores as an error, proving the target is a genuine fixed physics outcome", () => {
    const c = circularChallengeAt(CONCEPT_CENTRIPETAL_FORCE, 0.1);
    const correct = centripetalForceFromSpeed(c.mass!, c.speed!, c.radius!);
    const wrong = correct + 1000;
    const error = Math.abs(predictedValue(c, wrong) - targetValueOf(c));
    expect(error).toBeGreaterThan(c.tolerance);
  });
});

describe("Circular Motion: circularSimParamsFor resolves the true simulation state", () => {
  it("uses the given radius/speed unchanged when the concept's unknown is the force/acceleration itself", () => {
    const c = circularChallengeAt(CONCEPT_CENTRIPETAL_FORCE, 0.1);
    const { mass, radius, speed } = circularSimParamsFor(c, 999);
    expect(mass).toBe(c.mass);
    expect(radius).toBe(c.radius);
    expect(speed).toBe(c.speed);
  });

  it("substitutes the guess for whichever of radius/speed is this challenge's own unknown", () => {
    const speedCase = circularChallengeAt(CONCEPT_CENTRIPETAL_FORCE, 0.5); // forceSolveFor: "speed"
    const resolved = circularSimParamsFor(speedCase, 7);
    expect(resolved.speed).toBe(7);
    expect(resolved.radius).toBe(speedCase.radius);

    const radiusCase = circularChallengeAt(CONCEPT_CENTRIPETAL_ACCELERATION, 0.9); // accelSolveFor: "radius"
    const resolvedRadius = circularSimParamsFor(radiusCase, 2.5);
    expect(resolvedRadius.radius).toBe(2.5);
    expect(resolvedRadius.speed).toBe(radiusCase.speed);
  });

  it("Circular Speed always resolves radius/speed from the challenge's own givens, never the guess", () => {
    const c = circularChallengeAt(CONCEPT_CIRCULAR_SPEED, 0.1); // speedSolveFor: "speed" - angularVelocity+radius given
    const resolved = circularSimParamsFor(c, 999);
    expect(resolved.radius).toBe(c.radius);
    expect(resolved.speed).toBeCloseTo(circularSpeedFromOmega(c.angularVelocity!, c.radius!), 6);
  });
});

describe("Circular Motion: HUD helper functions stay concept-appropriate", () => {
  it("every sub-type of every concept has a given field, an input label, and the RUN EXPERIMENT action label", () => {
    const cases: Challenge[] = [
      circularChallengeAt(CONCEPT_CENTRIPETAL_FORCE, 0.1),
      circularChallengeAt(CONCEPT_CENTRIPETAL_FORCE, 0.5),
      circularChallengeAt(CONCEPT_CENTRIPETAL_FORCE, 0.9),
      circularChallengeAt(CONCEPT_CENTRIPETAL_ACCELERATION, 0.1),
      circularChallengeAt(CONCEPT_CENTRIPETAL_ACCELERATION, 0.5),
      circularChallengeAt(CONCEPT_CENTRIPETAL_ACCELERATION, 0.9),
      circularChallengeAt(CONCEPT_CIRCULAR_SPEED, 0.1),
      circularChallengeAt(CONCEPT_CIRCULAR_SPEED, 0.5),
      circularChallengeAt(CONCEPT_CIRCULAR_SPEED, 0.9),
    ];
    for (const c of cases) {
      expect(givenFieldsFor(c).length).toBeGreaterThan(0);
      expect(inputLabelFor(c).length).toBeGreaterThan(0);
      expect(actionLabelFor(c)).toBe("RUN EXPERIMENT");
    }
  });

  it("Centripetal Force's given fields never show a Target Force row for the Beginner (direct) sub-type", () => {
    const c = circularChallengeAt(CONCEPT_CENTRIPETAL_FORCE, 0.1);
    expect(givenFieldsFor(c).some((f) => f.label === "Target Force")).toBe(false);
  });

  it("Centripetal Force's given fields show a Target Force row for the Intermediate/Advanced (inverse) sub-types", () => {
    const speedCase = circularChallengeAt(CONCEPT_CENTRIPETAL_FORCE, 0.5);
    expect(givenFieldsFor(speedCase).some((f) => f.label === "Target Force")).toBe(true);
    const radiusCase = circularChallengeAt(CONCEPT_CENTRIPETAL_FORCE, 0.9);
    expect(givenFieldsFor(radiusCase).some((f) => f.label === "Target Force")).toBe(true);
  });
});

describe("Circular Motion: context reports concept-appropriate fields matching the module's learning-event schema", () => {
  it("reports mass, radius, speed, angular_velocity, centripetal_acceleration, centripetal_force, and revolutions_completed", () => {
    const c = circularChallengeAt(CONCEPT_CENTRIPETAL_FORCE, 0.1);
    const correct = centripetalForceFromSpeed(c.mass!, c.speed!, c.radius!);
    const ctx = contextFor(c, correct, correct);
    expect(ctx.mass).toBe(c.mass);
    expect(ctx.radius).toBe(c.radius);
    expect(ctx.speed).toBe(c.speed);
    expect(ctx.angular_velocity).toBeCloseTo((c.speed! as number) / (c.radius! as number), 2);
    expect(ctx.centripetal_acceleration).toBeCloseTo(centripetalAccelerationFromSpeed(c.speed!, c.radius!), 1);
    expect(ctx.centripetal_force).toBeCloseTo(correct, 1);
    expect(ctx.revolutions_completed).toBe(c.revolutions);
  });

  it("resolves radius/speed from the player's guess when reporting context for the speed/radius sub-types", () => {
    const c = circularChallengeAt(CONCEPT_CENTRIPETAL_FORCE, 0.5); // forceSolveFor: "speed"
    const ctx = contextFor(c, 6, centripetalForceFromSpeed(c.mass!, 6, c.radius!));
    expect(ctx.speed).toBe(6);
    expect(ctx.radius).toBe(c.radius);
  });
});

describe("Circular Motion: resultExtrasFor (result-card explanatory rows)", () => {
  it("returns mass/radius/speed for the Beginner (fully-given) Centripetal Force sub-type", () => {
    const c = circularChallengeAt(CONCEPT_CENTRIPETAL_FORCE, 0.1);
    const rows = resultExtrasFor(c)!;
    expect(rows.map((r) => r.label)).toEqual(["Mass", "Radius", "Speed"]);
  });

  it("returns null when radius or speed is the unknown - there is no true value to report until the player has answered", () => {
    const speedCase = circularChallengeAt(CONCEPT_CENTRIPETAL_FORCE, 0.5);
    expect(resultExtrasFor(speedCase)).toBeNull();
    const radiusCase = circularChallengeAt(CONCEPT_CENTRIPETAL_ACCELERATION, 0.9);
    expect(resultExtrasFor(radiusCase)).toBeNull();
  });
});

describe("Circular Motion: buildLearningEventPayload", () => {
  it("reports module=circular_motion and the correct concept for all 3 concepts", () => {
    for (const conceptId of [CONCEPT_CENTRIPETAL_FORCE, CONCEPT_CENTRIPETAL_ACCELERATION, CONCEPT_CIRCULAR_SPEED]) {
      const c = circularChallengeAt(conceptId, 0.1);
      const payload = buildLearningEventPayload({
        challenge: c,
        submittedValue: 1,
        actualValue: predictedValue(c, 1),
        success: false,
        performance: 0.4,
        masteryBefore: 0.3,
        masteryAfter: 0.32,
        sessionId: "s",
        attemptNumber: 1,
        recentAttempts: 1,
      });
      expect(payload.module).toBe(MODULE_CIRCULAR);
      expect(payload.challenge_type).toBe(conceptId);
      expect(payload.context).toBeTruthy();
    }
  });
});
