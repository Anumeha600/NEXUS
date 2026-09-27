import { describe, it, expect, beforeEach } from "vitest";
import {
  AdaptiveEngine,
  MODULE_PROJECTILE,
  MODULE_NEWTON,
  MODULE_WORK_ENERGY,
  MODULE_MOMENTUM,
  MODULE_CIRCULAR,
  MODULE_GRAVITATION,
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
  CONCEPT_GRAVITATIONAL_FORCE,
  CONCEPT_ORBITAL_VELOCITY,
  CONCEPT_ESCAPE_VELOCITY,
} from "./adaptiveEngine";
import {
  momentum,
  impulse,
  elasticCollisionFinalVelocities,
  inelasticCollisionFinalVelocity,
  centripetalForceFromSpeed,
  centripetalAccelerationFromSpeed,
  circularSpeedFromOmega,
  angularVelocityFromSpeed,
  circularPeriod,
  GRAVITY_SIM_G,
  gravitationalForce,
  orbitalVelocity,
  escapeVelocity,
} from "./physics";

describe("AdaptiveEngine mastery updates", () => {
  let engine: AdaptiveEngine;
  beforeEach(() => {
    engine = new AdaptiveEngine();
  });

  it("starts every concept at the same baseline mastery, independent of each other", () => {
    for (const c of [CONCEPT_SPEED_RANGE, CONCEPT_FORCE_ACCELERATION, CONCEPT_WORK]) {
      expect(engine.conceptMastery[c]).toBeCloseTo(0.3, 6);
    }
  });

  it("increases mastery after a successful, low-error attempt", () => {
    const before = engine.conceptMastery[CONCEPT_SPEED_RANGE];
    engine.recordAttempt(0, 1.0, true, 2);
    expect(engine.conceptMastery[CONCEPT_SPEED_RANGE]).toBeGreaterThan(before);
  });

  it("does not increase mastery after a failed, high-error attempt", () => {
    const before = engine.conceptMastery[CONCEPT_SPEED_RANGE];
    engine.recordAttempt(50, 1.0, false, 9);
    expect(engine.conceptMastery[CONCEPT_SPEED_RANGE]).toBeLessThanOrEqual(before);
  });

  it("only updates the current concept's mastery, not other concepts (module independence)", () => {
    const otherBefore = engine.conceptMastery[CONCEPT_FORCE_ACCELERATION];
    engine.recordAttempt(0, 1.0, true, 2); // currentConceptId defaults to CONCEPT_SPEED_RANGE
    expect(engine.conceptMastery[CONCEPT_FORCE_ACCELERATION]).toBe(otherBefore);
  });

  it("clamps mastery within [0, 1]", () => {
    for (let i = 0; i < 50; i++) engine.recordAttempt(0, 1.0, true, 0.1);
    expect(engine.conceptMastery[CONCEPT_SPEED_RANGE]).toBeLessThanOrEqual(1);
    for (let i = 0; i < 50; i++) engine.recordAttempt(1000, 1.0, false, 10);
    expect(engine.conceptMastery[CONCEPT_SPEED_RANGE]).toBeGreaterThanOrEqual(0);
  });
});

describe("difficulty thresholds", () => {
  it("reports Beginner/Intermediate/Advanced difficulty as mastery crosses the tier boundaries", () => {
    const engine = new AdaptiveEngine();
    expect(engine.getDifficultyName()).toBe("Beginner"); // starts at 0.3
    engine.conceptMastery[engine.currentConceptId] = 0.5;
    expect(engine.getDifficultyName()).toBe("Intermediate");
    engine.conceptMastery[engine.currentConceptId] = 0.9;
    expect(engine.getDifficultyName()).toBe("Advanced");
  });

  it("generates harder challenge parameters (larger target values) at higher difficulty for Speed & Range", () => {
    const engine = new AdaptiveEngine();
    engine.conceptMastery[CONCEPT_SPEED_RANGE] = 0.05;
    const beginnerChallenge = engine.generateNextChallenge();
    engine.conceptMastery[CONCEPT_SPEED_RANGE] = 0.95;
    const advancedChallenge = engine.generateNextChallenge();
    expect(advancedChallenge.targetDistance ?? 0).toBeGreaterThan(beginnerChallenge.targetDistance ?? 0);
    expect(advancedChallenge.tolerance).toBeLessThan(beginnerChallenge.tolerance);
  });
});

describe("concept progression (evaluateContentTransition)", () => {
  it("reinforces (does not advance) a struggling concept", () => {
    const engine = new AdaptiveEngine();
    engine.conceptMastery[CONCEPT_SPEED_RANGE] = 0.2; // below STRUGGLE_THRESHOLD (0.35)
    const note = engine.evaluateContentTransition();
    expect(engine.currentConceptId).toBe(CONCEPT_SPEED_RANGE);
    expect(note).toMatch(/needs more practice/);
  });

  it("keeps practicing a concept that is neither struggling nor mastered", () => {
    const engine = new AdaptiveEngine();
    engine.conceptMastery[CONCEPT_SPEED_RANGE] = 0.5; // between 0.35 and 0.75
    engine.evaluateContentTransition();
    expect(engine.currentConceptId).toBe(CONCEPT_SPEED_RANGE);
  });

  it("advances to the next concept within a module once mastered", () => {
    const engine = new AdaptiveEngine();
    engine.conceptMastery[CONCEPT_SPEED_RANGE] = 0.8; // >= MASTERED_THRESHOLD (0.75)
    engine.evaluateContentTransition();
    expect(engine.currentConceptId).toBe(CONCEPT_GRAVITY_RANGE);
    expect(engine.currentModuleId).toBe(MODULE_PROJECTILE);
  });

  it("does not advance the module until every concept in it is mastered", () => {
    const engine = new AdaptiveEngine();
    engine.currentConceptId = CONCEPT_FRICTION;
    engine.currentModuleId = MODULE_NEWTON;
    engine.conceptMastery[CONCEPT_FORCE_ACCELERATION] = 0.3; // not yet mastered
    engine.conceptMastery[CONCEPT_NET_FORCE] = 0.3;
    engine.conceptMastery[CONCEPT_FRICTION] = 0.8; // this one is mastered
    engine.evaluateContentTransition();
    // Friction is the last concept in the module, and it's mastered, but the
    // module average isn't - so it should keep practicing, not jump modules.
    expect(engine.currentModuleId).toBe(MODULE_NEWTON);
  });

  it("unlocks the next module only once every concept in the current module is mastered", () => {
    const engine = new AdaptiveEngine();
    engine.currentConceptId = CONCEPT_FRICTION;
    engine.currentModuleId = MODULE_NEWTON;
    engine.conceptMastery[CONCEPT_FORCE_ACCELERATION] = 0.8;
    engine.conceptMastery[CONCEPT_NET_FORCE] = 0.8;
    engine.conceptMastery[CONCEPT_FRICTION] = 0.8;
    const note = engine.evaluateContentTransition();
    expect(engine.currentModuleId).toBe(MODULE_WORK_ENERGY);
    expect(engine.currentConceptId).toBe(CONCEPT_WORK);
    expect(note).toMatch(/Module mastered/);
  });

  it("does not unlock a module just because the player is currently sitting on its first concept", () => {
    const engine = new AdaptiveEngine();
    // Fresh engine, no attempts recorded at all - should never have moved
    // off Projectile Motion / Speed & Range.
    expect(engine.currentModuleId).toBe(MODULE_PROJECTILE);
    expect(engine.currentConceptId).toBe(CONCEPT_SPEED_RANGE);
  });

  it("mastering Work & Energy's final concept unlocks Momentum & Collisions, the next module in sequence", () => {
    const engine = new AdaptiveEngine();
    engine.currentModuleId = MODULE_WORK_ENERGY;
    engine.currentConceptId = CONCEPT_WORK_ENERGY_THEOREM;
    engine.conceptMastery[CONCEPT_WORK] = 0.9;
    engine.conceptMastery[CONCEPT_KINETIC_ENERGY] = 0.9;
    engine.conceptMastery[CONCEPT_WORK_ENERGY_THEOREM] = 0.9;
    const note = engine.evaluateContentTransition();
    expect(engine.currentModuleId).toBe(MODULE_MOMENTUM);
    expect(engine.currentConceptId).toBe(CONCEPT_MOMENTUM);
    expect(note).toMatch(/Module mastered/);
  });

  it("mastering Momentum & Collisions' final concept unlocks Circular Motion, the next module in sequence", () => {
    const engine = new AdaptiveEngine();
    engine.currentModuleId = MODULE_MOMENTUM;
    engine.currentConceptId = CONCEPT_CONSERVATION_MOMENTUM;
    engine.conceptMastery[CONCEPT_MOMENTUM] = 0.9;
    engine.conceptMastery[CONCEPT_IMPULSE] = 0.9;
    engine.conceptMastery[CONCEPT_CONSERVATION_MOMENTUM] = 0.9;
    const note = engine.evaluateContentTransition();
    expect(engine.currentModuleId).toBe(MODULE_CIRCULAR);
    expect(engine.currentConceptId).toBe(CONCEPT_CENTRIPETAL_FORCE);
    expect(note).toMatch(/Module mastered/);
  });

  it("stays put on the final module's final concept once fully mastered (no sixth module to advance to)", () => {
    const engine = new AdaptiveEngine();
    engine.currentModuleId = MODULE_CIRCULAR;
    engine.currentConceptId = CONCEPT_CIRCULAR_SPEED;
    engine.conceptMastery[CONCEPT_CENTRIPETAL_FORCE] = 0.9;
    engine.conceptMastery[CONCEPT_CENTRIPETAL_ACCELERATION] = 0.9;
    engine.conceptMastery[CONCEPT_CIRCULAR_SPEED] = 0.9;
    engine.evaluateContentTransition();
    expect(engine.currentModuleId).toBe(MODULE_CIRCULAR);
    expect(engine.currentConceptId).toBe(CONCEPT_CIRCULAR_SPEED);
  });
});

describe("module mastery is derived only from its own concepts", () => {
  it("computes Newton's module mastery as the average of exactly its 3 concepts", () => {
    const engine = new AdaptiveEngine();
    engine.conceptMastery[CONCEPT_FORCE_ACCELERATION] = 0.6;
    engine.conceptMastery[CONCEPT_NET_FORCE] = 0.8;
    engine.conceptMastery[CONCEPT_FRICTION] = 0.4;
    expect(engine.getModuleMastery(MODULE_NEWTON)).toBeCloseTo((0.6 + 0.8 + 0.4) / 3, 6);
  });

  it("changing Projectile Motion's mastery never changes Newton's or Work & Energy's module mastery", () => {
    const engine = new AdaptiveEngine();
    const newtonBefore = engine.getModuleMastery(MODULE_NEWTON);
    const workBefore = engine.getModuleMastery(MODULE_WORK_ENERGY);
    engine.conceptMastery[CONCEPT_SPEED_RANGE] = 0.99;
    engine.conceptMastery[CONCEPT_GRAVITY_RANGE] = 0.99;
    expect(engine.getModuleMastery(MODULE_NEWTON)).toBe(newtonBefore);
    expect(engine.getModuleMastery(MODULE_WORK_ENERGY)).toBe(workBefore);
  });
});

describe("recent attempt tracking", () => {
  it("reports zero recent attempts for a concept that has never been attempted", () => {
    const engine = new AdaptiveEngine();
    expect(engine.getRecentAttemptCount(CONCEPT_KINETIC_ENERGY)).toBe(0);
  });

  it("counts attempts recorded against the current concept", () => {
    const engine = new AdaptiveEngine();
    engine.recordAttempt(0, 1, true, 1);
    engine.recordAttempt(0, 1, true, 1);
    expect(engine.getRecentAttemptCount(CONCEPT_SPEED_RANGE)).toBe(2);
  });
});

describe("challenge generation covers all 14 concepts with concept-appropriate fields", () => {
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
    { moduleId: MODULE_CIRCULAR, conceptId: CONCEPT_CENTRIPETAL_FORCE },
    { moduleId: MODULE_CIRCULAR, conceptId: CONCEPT_CENTRIPETAL_ACCELERATION },
    { moduleId: MODULE_CIRCULAR, conceptId: CONCEPT_CIRCULAR_SPEED },
  ];

  it.each(cases)("generates a well-formed challenge for $conceptId", ({ moduleId, conceptId }) => {
    const engine = new AdaptiveEngine();
    engine.currentModuleId = moduleId;
    engine.currentConceptId = conceptId;
    const challenge = engine.generateNextChallenge();
    expect(challenge.moduleId).toBe(moduleId);
    expect(challenge.conceptId).toBe(conceptId);
    expect(challenge.tolerance).toBeGreaterThan(0);
    expect(["Beginner", "Intermediate", "Advanced"]).toContain(challenge.difficulty);
    expect(typeof challenge.unit).toBe("string");
    expect(challenge.unit.length).toBeGreaterThan(0);
  });

  it("Speed & Range generates a fixed gravity and a target distance, not a given speed", () => {
    const engine = new AdaptiveEngine();
    const c = engine.generateNextChallenge();
    expect(c.gravity).toBeGreaterThan(0);
    expect(c.targetDistance).toBeGreaterThan(0);
    expect(c.givenSpeed).toBeUndefined();
  });

  it("Gravity & Trajectory generates a given speed and a self-consistent target range for its target gravity", () => {
    const engine = new AdaptiveEngine();
    engine.currentConceptId = CONCEPT_GRAVITY_RANGE;
    const c = engine.generateNextChallenge();
    expect(c.givenSpeed).toBeGreaterThan(0);
    expect(c.gravity).toBeGreaterThan(0);
    const expectedRange = (c.givenSpeed! * c.givenSpeed!) / c.gravity!;
    expect(c.targetDistance).toBeCloseTo(expectedRange, 1);
  });

  it("Net Force generates a distinct secondary force field that Force & Acceleration does not have", () => {
    const engine = new AdaptiveEngine();
    engine.currentConceptId = CONCEPT_FORCE_ACCELERATION;
    const forceAccel = engine.generateNextChallenge();
    expect(forceAccel.secondForce).toBeUndefined();
    expect(forceAccel.frictionForce).toBeUndefined();

    engine.currentConceptId = CONCEPT_NET_FORCE;
    const netForce = engine.generateNextChallenge();
    expect(netForce.secondForce).toBeGreaterThan(0);
    expect(netForce.frictionForce).toBeUndefined();

    engine.currentConceptId = CONCEPT_FRICTION;
    const friction = engine.generateNextChallenge();
    expect(friction.frictionForce).toBeGreaterThan(0);
    expect(friction.secondForce).toBeUndefined();
  });

  it("Work-Energy Theorem generates an initial and target velocity distinct from Kinetic Energy's fields", () => {
    const engine = new AdaptiveEngine();
    engine.currentModuleId = MODULE_WORK_ENERGY;
    engine.currentConceptId = CONCEPT_WORK_ENERGY_THEOREM;
    const c = engine.generateNextChallenge();
    expect(c.initialVelocity).toBeGreaterThan(0);
    expect(c.targetVelocity).toBeGreaterThan(0);
    expect(c.requiredNetWork).toBeCloseTo(0.5 * c.mass! * (c.targetVelocity! ** 2 - c.initialVelocity! ** 2), 1);
  });
});

describe("Momentum & Collisions challenge generation", () => {
  function momentumChallenge(conceptId: string, mastery: number) {
    const engine = new AdaptiveEngine();
    engine.currentModuleId = MODULE_MOMENTUM;
    engine.currentConceptId = conceptId;
    engine.conceptMastery[conceptId] = mastery;
    return engine.generateNextChallenge();
  }

  describe("Momentum concept (p = mv)", () => {
    it("Beginner solves for momentum directly, given a positive mass and velocity", () => {
      const c = momentumChallenge(CONCEPT_MOMENTUM, 0.1);
      expect(c.momentumSolveFor).toBe("momentum");
      expect(c.mass).toBeGreaterThan(0);
      expect(c.velocity).toBeGreaterThan(0);
      expect(c.targetMomentum).toBeCloseTo(momentum(c.mass!, c.velocity!), 6);
    });

    it("Intermediate solves for velocity, with mass given but velocity left as the unknown", () => {
      const c = momentumChallenge(CONCEPT_MOMENTUM, 0.5);
      expect(c.momentumSolveFor).toBe("velocity");
      expect(c.mass).toBeGreaterThan(0);
      expect(c.velocity).toBeUndefined();
      expect(c.targetMomentum).toBeDefined();
    });

    it("Advanced solves for mass, with velocity given but mass left as the unknown", () => {
      const c = momentumChallenge(CONCEPT_MOMENTUM, 0.9);
      expect(c.momentumSolveFor).toBe("mass");
      expect(c.velocity).toBeDefined();
      expect(c.mass).toBeUndefined();
      expect(c.targetMomentum).toBeDefined();
    });

    it("difficulty tiers produce increasingly complex challenges (larger magnitude, tighter tolerance)", () => {
      const beginner = momentumChallenge(CONCEPT_MOMENTUM, 0.05);
      const advanced = momentumChallenge(CONCEPT_MOMENTUM, 0.95);
      expect(Math.abs(advanced.targetMomentum!)).toBeGreaterThan(Math.abs(beginner.targetMomentum!));
    });

    it("Intermediate/Advanced introduce negative (mixed-direction) velocities; Beginner never does", () => {
      let sawNegative = false;
      for (let m = 0.4; m < 1; m += 0.05) {
        const c = momentumChallenge(CONCEPT_MOMENTUM, m);
        const v = c.velocity ?? (c.targetMomentum! / (c.mass ?? 1));
        if (v < 0) sawNegative = true;
      }
      expect(sawNegative).toBe(true);
      for (let m = 0; m < 0.4; m += 0.05) {
        const c = momentumChallenge(CONCEPT_MOMENTUM, m);
        expect(c.velocity ?? 1).toBeGreaterThan(0);
      }
    });
  });

  describe("Impulse concept (J = m(vf - vi) = F*dt)", () => {
    it("Beginner gives both velocities and asks for the impulse", () => {
      const c = momentumChallenge(CONCEPT_IMPULSE, 0.1);
      expect(c.impulseSolveFor).toBe("impulse");
      expect(c.mass).toBeGreaterThan(0);
      expect(c.initialVelocity).toBeGreaterThan(0);
      expect(c.finalVelocity).toBeGreaterThan(c.initialVelocity!);
      const trueImpulse = impulse(c.mass!, c.initialVelocity!, c.finalVelocity!);
      expect(trueImpulse).toBeGreaterThan(0);
    });

    it("Intermediate gives the impulse and asks for the resulting final velocity", () => {
      const c = momentumChallenge(CONCEPT_IMPULSE, 0.5);
      expect(c.impulseSolveFor).toBe("finalVelocity");
      expect(c.targetImpulse).toBeCloseTo(impulse(c.mass!, c.initialVelocity!, c.finalVelocity!), 1);
    });

    it("Advanced gives force and contact time and asks the player to solve for the force", () => {
      const c = momentumChallenge(CONCEPT_IMPULSE, 0.9);
      expect(c.impulseSolveFor).toBe("force");
      expect(c.contactTime).toBeGreaterThan(0);
      const trueForce = c.targetImpulse! / c.contactTime!;
      expect(trueForce).toBeGreaterThan(0);
    });

    it("difficulty tiers produce increasingly complex challenges (shorter contact time at higher tiers)", () => {
      const beginner = momentumChallenge(CONCEPT_IMPULSE, 0.05);
      const advanced = momentumChallenge(CONCEPT_IMPULSE, 0.95);
      expect(advanced.contactTime).toBeLessThan(beginner.contactTime ?? Infinity);
    });
  });

  describe("Conservation of Momentum concept (m1u1 + m2u2 = m1v1 + m2v2)", () => {
    it("generates a valid collision that is always on a collision course (u1 > u2)", () => {
      for (const mastery of [0.1, 0.5, 0.9]) {
        const c = momentumChallenge(CONCEPT_CONSERVATION_MOMENTUM, mastery);
        expect(c.mass1).toBeGreaterThan(0);
        expect(c.mass2).toBeGreaterThan(0);
        expect(c.velocity1!).toBeGreaterThan(c.velocity2!);
        expect(["elastic", "inelastic"]).toContain(c.collisionType);
      }
    });

    it("Beginner: cart B starts at rest, and the collision is perfectly inelastic", () => {
      const c = momentumChallenge(CONCEPT_CONSERVATION_MOMENTUM, 0.1);
      expect(c.velocity2).toBe(0);
      expect(c.collisionType).toBe("inelastic");
      expect(c.finalVelocity1).toBe(c.finalVelocity2);
    });

    it("Intermediate: the carts move in opposite directions with different masses, and the collision is elastic", () => {
      const c = momentumChallenge(CONCEPT_CONSERVATION_MOMENTUM, 0.5);
      expect(c.velocity2).toBeLessThan(0);
      expect(c.collisionType).toBe("elastic");
      expect(c.finalVelocity1).not.toBe(c.finalVelocity2);
    });

    it("an elastic collision's final velocities match the closed-form physics exactly", () => {
      const c = momentumChallenge(CONCEPT_CONSERVATION_MOMENTUM, 0.55);
      expect(c.collisionType).toBe("elastic");
      const { v1, v2 } = elasticCollisionFinalVelocities(c.mass1!, c.velocity1!, c.mass2!, c.velocity2!);
      expect(c.finalVelocity1).toBeCloseTo(v1, 1);
      expect(c.finalVelocity2).toBeCloseTo(v2, 1);
    });

    it("an inelastic collision's final velocity matches the closed-form physics exactly", () => {
      const c = momentumChallenge(CONCEPT_CONSERVATION_MOMENTUM, 0.1);
      expect(c.collisionType).toBe("inelastic");
      const v = inelasticCollisionFinalVelocity(c.mass1!, c.velocity1!, c.mass2!, c.velocity2!);
      expect(c.finalVelocity1).toBeCloseTo(v, 1);
    });

    it("total momentum is conserved between the given pre-collision state and the generated post-collision state", () => {
      for (const mastery of [0.1, 0.5, 0.9]) {
        const c = momentumChallenge(CONCEPT_CONSERVATION_MOMENTUM, mastery);
        const before = c.mass1! * c.velocity1! + c.mass2! * c.velocity2!;
        const after = c.mass1! * c.finalVelocity1! + c.mass2! * c.finalVelocity2!;
        expect(after).toBeCloseTo(before, 0);
      }
    });

    it("Advanced varies which cart's final velocity the player solves for", () => {
      const solveTargets = new Set<string>();
      for (let m = 0.75; m < 1; m += 0.02) {
        const c = momentumChallenge(CONCEPT_CONSERVATION_MOMENTUM, m);
        solveTargets.add(c.solveForCart!);
      }
      expect(solveTargets.has("A")).toBe(true);
      expect(solveTargets.has("B")).toBe(true);
    });

    it("difficulty tiers produce increasingly complex challenges (tighter tolerance)", () => {
      const beginner = momentumChallenge(CONCEPT_CONSERVATION_MOMENTUM, 0.05);
      const advanced = momentumChallenge(CONCEPT_CONSERVATION_MOMENTUM, 0.95);
      expect(advanced.tolerance).toBeLessThan(beginner.tolerance);
    });
  });
});

describe("Circular Motion challenge generation", () => {
  function circularChallenge(conceptId: string, mastery: number) {
    const engine = new AdaptiveEngine();
    engine.currentModuleId = MODULE_CIRCULAR;
    engine.currentConceptId = conceptId;
    engine.conceptMastery[conceptId] = mastery;
    return engine.generateNextChallenge();
  }

  describe("Centripetal Force concept (F_c = mv^2/r)", () => {
    it("Beginner solves for the force directly, given a positive mass, radius, and speed", () => {
      const c = circularChallenge(CONCEPT_CENTRIPETAL_FORCE, 0.1);
      expect(c.forceSolveFor).toBe("force");
      expect(c.mass).toBeGreaterThan(0);
      expect(c.radius).toBeGreaterThan(0);
      expect(c.speed).toBeGreaterThan(0);
      expect(c.targetCentripetalForce).toBeCloseTo(centripetalForceFromSpeed(c.mass!, c.speed!, c.radius!), 1);
    });

    it("Intermediate solves for speed, with mass/radius given but speed left as the unknown", () => {
      const c = circularChallenge(CONCEPT_CENTRIPETAL_FORCE, 0.5);
      expect(c.forceSolveFor).toBe("speed");
      expect(c.radius).toBeGreaterThan(0);
      expect(c.speed).toBeUndefined();
      expect(c.targetCentripetalForce).toBeDefined();
    });

    it("Advanced solves for radius, with mass/speed given but radius left as the unknown", () => {
      const c = circularChallenge(CONCEPT_CENTRIPETAL_FORCE, 0.9);
      expect(c.forceSolveFor).toBe("radius");
      expect(c.speed).toBeGreaterThan(0);
      expect(c.radius).toBeUndefined();
      expect(c.targetCentripetalForce).toBeDefined();
    });

    it("doubling speed quadruples the required centripetal force when mass and radius stay constant", () => {
      const mass = 2;
      const radius = 1.5;
      const speed = 3;
      const doubled = centripetalForceFromSpeed(mass, speed * 2, radius);
      const original = centripetalForceFromSpeed(mass, speed, radius);
      expect(doubled).toBeCloseTo(original * 4, 6);
    });

    it("difficulty tiers produce increasingly demanding target forces", () => {
      const beginner = circularChallenge(CONCEPT_CENTRIPETAL_FORCE, 0.05);
      const advanced = circularChallenge(CONCEPT_CENTRIPETAL_FORCE, 0.95);
      expect(advanced.targetCentripetalForce!).toBeGreaterThan(0);
      expect(beginner.targetCentripetalForce!).toBeGreaterThan(0);
    });

    it("requires more revolutions at higher difficulty (1 Beginner / 2 Intermediate / 3 Advanced)", () => {
      expect(circularChallenge(CONCEPT_CENTRIPETAL_FORCE, 0.05).revolutions).toBe(1);
      expect(circularChallenge(CONCEPT_CENTRIPETAL_FORCE, 0.5).revolutions).toBe(2);
      expect(circularChallenge(CONCEPT_CENTRIPETAL_FORCE, 0.95).revolutions).toBe(3);
    });
  });

  describe("Centripetal Acceleration concept (a_c = v^2/r)", () => {
    it("Beginner solves for acceleration directly, given a positive radius and speed", () => {
      const c = circularChallenge(CONCEPT_CENTRIPETAL_ACCELERATION, 0.1);
      expect(c.accelSolveFor).toBe("acceleration");
      expect(c.radius).toBeGreaterThan(0);
      expect(c.speed).toBeGreaterThan(0);
      expect(c.targetCentripetalAcceleration).toBeCloseTo(centripetalAccelerationFromSpeed(c.speed!, c.radius!), 1);
    });

    it("Intermediate solves for speed; Advanced solves for radius", () => {
      const intermediate = circularChallenge(CONCEPT_CENTRIPETAL_ACCELERATION, 0.5);
      expect(intermediate.accelSolveFor).toBe("speed");
      expect(intermediate.speed).toBeUndefined();

      const advanced = circularChallenge(CONCEPT_CENTRIPETAL_ACCELERATION, 0.9);
      expect(advanced.accelSolveFor).toBe("radius");
      expect(advanced.radius).toBeUndefined();
    });

    it("doubling radius halves centripetal acceleration when speed stays constant", () => {
      const speed = 6;
      const radius = 2;
      const doubled = centripetalAccelerationFromSpeed(speed, radius * 2);
      const original = centripetalAccelerationFromSpeed(speed, radius);
      expect(doubled).toBeCloseTo(original / 2, 6);
    });

    it("never involves a mass field - acceleration doesn't depend on it", () => {
      const c = circularChallenge(CONCEPT_CENTRIPETAL_ACCELERATION, 0.1);
      expect(c.mass).toBeUndefined();
    });
  });

  describe("Circular Speed concept (v = omega*r, T = 2*pi*r/v)", () => {
    it("Beginner solves for speed, given a positive radius and angular velocity", () => {
      const c = circularChallenge(CONCEPT_CIRCULAR_SPEED, 0.1);
      expect(c.speedSolveFor).toBe("speed");
      expect(c.radius).toBeGreaterThan(0);
      expect(c.angularVelocity).toBeGreaterThan(0);
      expect(c.speed).toBeUndefined();
      expect(c.targetCircularSpeed).toBeCloseTo(circularSpeedFromOmega(c.angularVelocity!, c.radius!), 1);
    });

    it("Intermediate solves for angular velocity, given a positive radius and speed", () => {
      const c = circularChallenge(CONCEPT_CIRCULAR_SPEED, 0.5);
      expect(c.speedSolveFor).toBe("angularVelocity");
      expect(c.radius).toBeGreaterThan(0);
      expect(c.speed).toBeGreaterThan(0);
      expect(c.angularVelocity).toBeUndefined();
      expect(c.targetAngularVelocity).toBeCloseTo(angularVelocityFromSpeed(c.speed!, c.radius!), 1);
    });

    it("Advanced solves for period, given a positive radius and speed", () => {
      const c = circularChallenge(CONCEPT_CIRCULAR_SPEED, 0.9);
      expect(c.speedSolveFor).toBe("period");
      expect(c.radius).toBeGreaterThan(0);
      expect(c.speed).toBeGreaterThan(0);
      expect(c.targetPeriod).toBeCloseTo(circularPeriod(c.radius!, c.speed!), 1);
    });

    it("requires more revolutions at higher difficulty (1 Beginner / 2 Intermediate / 3 Advanced)", () => {
      expect(circularChallenge(CONCEPT_CIRCULAR_SPEED, 0.05).revolutions).toBe(1);
      expect(circularChallenge(CONCEPT_CIRCULAR_SPEED, 0.5).revolutions).toBe(2);
      expect(circularChallenge(CONCEPT_CIRCULAR_SPEED, 0.95).revolutions).toBe(3);
    });
  });
});

// --------------------------------------------------------------------------
// Gravitation & Orbits - Layer 1 (curriculum/architecture/physics
// foundation only, see MODULE_GRAVITATION's doc comment in
// adaptiveEngine.ts). Reached only by directly instantiating
// `new AdaptiveEngine(MODULE_GRAVITATION)` or setting
// currentModuleId/currentConceptId by hand, exactly as these tests do -
// there is deliberately no UI route to it yet.
// --------------------------------------------------------------------------
describe("Gravitation & Orbits challenge generation", () => {
  function gravitationChallenge(conceptId: string, mastery: number) {
    const engine = new AdaptiveEngine();
    engine.currentModuleId = MODULE_GRAVITATION;
    engine.currentConceptId = conceptId;
    engine.conceptMastery[conceptId] = mastery;
    return engine.generateNextChallenge();
  }

  describe("Gravitational Force concept (F = GMm/r^2)", () => {
    it("Beginner solves for the force directly, given a positive star mass, planet mass, and distance", () => {
      const c = gravitationChallenge(CONCEPT_GRAVITATIONAL_FORCE, 0.1);
      expect(c.gravitationForceSolveFor).toBe("force");
      expect(c.starMass).toBeGreaterThan(0);
      expect(c.planetMass).toBeGreaterThan(0);
      expect(c.distanceFromStar).toBeGreaterThan(0);
      expect(c.targetGravitationalForce).toBeCloseTo(gravitationalForce(GRAVITY_SIM_G, c.starMass!, c.planetMass!, c.distanceFromStar!), 1);
    });

    it("Intermediate solves for distance, with starMass/planetMass given but distance left as the unknown", () => {
      const c = gravitationChallenge(CONCEPT_GRAVITATIONAL_FORCE, 0.5);
      expect(c.gravitationForceSolveFor).toBe("distance");
      expect(c.starMass).toBeGreaterThan(0);
      expect(c.planetMass).toBeGreaterThan(0);
      expect(c.distanceFromStar).toBeUndefined();
      expect(c.targetGravitationalForce).toBeDefined();
    });

    it("Advanced solves for planet mass, with starMass/distance given but planetMass left as the unknown", () => {
      const c = gravitationChallenge(CONCEPT_GRAVITATIONAL_FORCE, 0.9);
      expect(c.gravitationForceSolveFor).toBe("planetMass");
      expect(c.starMass).toBeGreaterThan(0);
      expect(c.distanceFromStar).toBeGreaterThan(0);
      expect(c.planetMass).toBeUndefined();
      expect(c.targetGravitationalForce).toBeDefined();
    });

    it("quartering distance (halving twice) increases force 16x - an inverse-square relationship", () => {
      const starMass = 100;
      const planetMass = 2;
      const r = 8;
      const original = gravitationalForce(GRAVITY_SIM_G, starMass, planetMass, r);
      const quartered = gravitationalForce(GRAVITY_SIM_G, starMass, planetMass, r / 4);
      expect(quartered).toBeCloseTo(original * 16, 6);
    });
  });

  describe("Orbital Velocity concept (v_orbit = sqrt(GM/r))", () => {
    it("Beginner solves for orbital velocity directly, given a positive star mass and distance", () => {
      const c = gravitationChallenge(CONCEPT_ORBITAL_VELOCITY, 0.1);
      expect(c.orbitalVelocitySolveFor).toBe("velocity");
      expect(c.starMass).toBeGreaterThan(0);
      expect(c.distanceFromStar).toBeGreaterThan(0);
      expect(c.targetOrbitalVelocity).toBeCloseTo(orbitalVelocity(GRAVITY_SIM_G, c.starMass!, c.distanceFromStar!), 1);
    });

    it("Intermediate solves for orbital radius; Advanced solves for star mass", () => {
      const intermediate = gravitationChallenge(CONCEPT_ORBITAL_VELOCITY, 0.5);
      expect(intermediate.orbitalVelocitySolveFor).toBe("distance");
      expect(intermediate.starMass).toBeGreaterThan(0);
      expect(intermediate.distanceFromStar).toBeUndefined();

      const advanced = gravitationChallenge(CONCEPT_ORBITAL_VELOCITY, 0.9);
      expect(advanced.orbitalVelocitySolveFor).toBe("starMass");
      expect(advanced.distanceFromStar).toBeGreaterThan(0);
      expect(advanced.starMass).toBeUndefined();
    });

    it("never involves a planetMass field - orbital velocity doesn't depend on the orbiting body's own mass", () => {
      const c = gravitationChallenge(CONCEPT_ORBITAL_VELOCITY, 0.1);
      expect(c.planetMass).toBeUndefined();
    });

    it("quadrupling orbital radius halves orbital velocity", () => {
      const starMass = 100;
      const r = 4;
      const original = orbitalVelocity(GRAVITY_SIM_G, starMass, r);
      const quadrupled = orbitalVelocity(GRAVITY_SIM_G, starMass, r * 4);
      expect(quadrupled).toBeCloseTo(original / 2, 6);
    });
  });

  describe("Escape Velocity concept (v_escape = sqrt(2GM/r))", () => {
    it("Beginner solves for escape velocity directly, given a positive star mass and distance", () => {
      const c = gravitationChallenge(CONCEPT_ESCAPE_VELOCITY, 0.1);
      expect(c.escapeVelocitySolveFor).toBe("velocity");
      expect(c.starMass).toBeGreaterThan(0);
      expect(c.distanceFromStar).toBeGreaterThan(0);
      expect(c.targetEscapeVelocity).toBeCloseTo(escapeVelocity(GRAVITY_SIM_G, c.starMass!, c.distanceFromStar!), 1);
    });

    it("Intermediate solves for distance; Advanced solves for star mass", () => {
      const intermediate = gravitationChallenge(CONCEPT_ESCAPE_VELOCITY, 0.5);
      expect(intermediate.escapeVelocitySolveFor).toBe("distance");
      expect(intermediate.distanceFromStar).toBeUndefined();

      const advanced = gravitationChallenge(CONCEPT_ESCAPE_VELOCITY, 0.9);
      expect(advanced.escapeVelocitySolveFor).toBe("starMass");
      expect(advanced.starMass).toBeUndefined();
    });

    it("every generated escape-velocity challenge's target is exactly sqrt(2) times what orbital velocity would be for the same star mass and distance", () => {
      const c = gravitationChallenge(CONCEPT_ESCAPE_VELOCITY, 0.1);
      const impliedOrbital = orbitalVelocity(GRAVITY_SIM_G, c.starMass!, c.distanceFromStar!);
      expect(c.targetEscapeVelocity).toBeCloseTo(impliedOrbital * Math.SQRT2, 1);
    });
  });

  it.each([
    { conceptId: CONCEPT_GRAVITATIONAL_FORCE, name: "Gravitational Force" },
    { conceptId: CONCEPT_ORBITAL_VELOCITY, name: "Orbital Velocity" },
    { conceptId: CONCEPT_ESCAPE_VELOCITY, name: "Escape Velocity" },
  ])("generates a well-formed challenge for $name", ({ conceptId }) => {
    const engine = new AdaptiveEngine(MODULE_GRAVITATION);
    engine.currentConceptId = conceptId;
    const challenge = engine.generateNextChallenge();
    expect(challenge.moduleId).toBe(MODULE_GRAVITATION);
    expect(challenge.conceptId).toBe(conceptId);
    expect(challenge.tolerance).toBeGreaterThan(0);
    expect(["Beginner", "Intermediate", "Advanced"]).toContain(challenge.difficulty);
    expect(typeof challenge.unit).toBe("string");
    expect(challenge.unit.length).toBeGreaterThan(0);
  });
});

describe("Gravitation & Orbits concept mapping and architecture isolation (Layer 1)", () => {
  it("MODULE_GRAVITATION has its 3 concepts registered in curriculum order: Gravitational Force, Orbital Velocity, Escape Velocity", () => {
    const engine = new AdaptiveEngine(MODULE_GRAVITATION);
    expect(engine.currentModuleId).toBe(MODULE_GRAVITATION);
    // Gravitational Force is still the FIRST concept in the curriculum
    // sequence (registered, real, just not yet scoreable - see
    // EXPLORATION_ONLY_CONCEPTS) - but it is not eligible for scored
    // generation, so a fresh engine opens on the first concept that is:
    // Orbital Velocity. Layer 8 fix - a fresh session used to start on the
    // unsupported concept with no way to reach a scored one.
    expect(engine.currentConceptId).toBe(CONCEPT_ORBITAL_VELOCITY);
  });

  it("a fresh Gravitation session never generates gravitational_force as a scored adaptive challenge", () => {
    const engine = new AdaptiveEngine(MODULE_GRAVITATION);
    const challenge = engine.generateNextChallenge();
    expect(challenge.conceptId).not.toBe(CONCEPT_GRAVITATIONAL_FORCE);
    expect(challenge.conceptId).toBe(CONCEPT_ORBITAL_VELOCITY);
  });

  it("gravitational_force being excluded from scored selection never touches its own (or anything else's) mastery", () => {
    const engine = new AdaptiveEngine(MODULE_GRAVITATION);
    expect(engine.conceptMastery[CONCEPT_GRAVITATIONAL_FORCE]).toBeCloseTo(0.3, 6);
    for (let i = 0; i < 20; i++) engine.recordAttempt(0, 1.0, true, 1);
    engine.evaluateContentTransition();
    // Only the concept actually being practiced (orbital_velocity) moves -
    // gravitational_force's mastery is never touched merely because it was
    // skipped over.
    expect(engine.conceptMastery[CONCEPT_GRAVITATIONAL_FORCE]).toBeCloseTo(0.3, 6);
  });

  it("every Gravitation concept starts at the same baseline mastery as every other module's concepts", () => {
    const engine = new AdaptiveEngine();
    for (const c of [CONCEPT_GRAVITATIONAL_FORCE, CONCEPT_ORBITAL_VELOCITY, CONCEPT_ESCAPE_VELOCITY]) {
      expect(engine.conceptMastery[c]).toBeCloseTo(0.3, 6);
    }
  });

  it("getModuleMastery averages exactly Gravitation's own 3 concepts, independent of the other 5 modules", () => {
    const engine = new AdaptiveEngine(MODULE_GRAVITATION);
    engine.conceptMastery[CONCEPT_GRAVITATIONAL_FORCE] = 0.2;
    engine.conceptMastery[CONCEPT_ORBITAL_VELOCITY] = 0.5;
    engine.conceptMastery[CONCEPT_ESCAPE_VELOCITY] = 0.8;
    expect(engine.getModuleMastery(MODULE_GRAVITATION)).toBeCloseTo((0.2 + 0.5 + 0.8) / 3, 6);
  });

  it("recordAttempt/evaluateContentTransition progress Gravitation's own scored concepts in sequence, using the exact same rules as every other module", () => {
    const engine = new AdaptiveEngine(MODULE_GRAVITATION);
    // Starts on Orbital Velocity (the first SCORED concept), not
    // Gravitational Force - see the Layer 8 fix above.
    expect(engine.currentConceptId).toBe(CONCEPT_ORBITAL_VELOCITY);
    for (let i = 0; i < 20; i++) engine.recordAttempt(0, 1.0, true, 1);
    expect(engine.conceptMastery[CONCEPT_ORBITAL_VELOCITY]).toBeGreaterThanOrEqual(0.75);
    const msg = engine.evaluateContentTransition();
    expect(engine.currentConceptId).toBe(CONCEPT_ESCAPE_VELOCITY);
    expect(msg).toContain("Introducing");

    // And escape_velocity itself can then be generated as a real challenge.
    const challenge = engine.generateNextChallenge();
    expect(challenge.conceptId).toBe(CONCEPT_ESCAPE_VELOCITY);
  });

  // The whole point of Layer 1: this module exists and is fully testable,
  // but it must not change anything about the 5 modules that already ship.
  describe("adding Gravitation does not change any existing module's behavior", () => {
    it("MODULE_GRAVITATION is not part of the 5-module auto-progression sequence - mastering Circular Motion still ends progression exactly as it did before this module existed", () => {
      const engine = new AdaptiveEngine(MODULE_CIRCULAR);
      // Master every concept in every one of the 5 existing modules.
      const allExistingConcepts = [
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
      ];
      for (const c of allExistingConcepts) engine.conceptMastery[c] = 0.95;
      engine.currentConceptId = CONCEPT_CENTRIPETAL_FORCE;
      engine.evaluateContentTransition(); // -> centripetal_acceleration
      engine.currentConceptId = CONCEPT_CENTRIPETAL_ACCELERATION;
      engine.evaluateContentTransition(); // -> circular_speed
      engine.currentConceptId = CONCEPT_CIRCULAR_SPEED;
      const msg = engine.evaluateContentTransition();
      // Same outcome as before Gravitation was registered: stays on Circular
      // Motion's last concept, continuing advanced practice - never
      // transitions into gravitation_orbits.
      expect(engine.currentModuleId).toBe(MODULE_CIRCULAR);
      expect(engine.currentConceptId).toBe(CONCEPT_CIRCULAR_SPEED);
      expect(msg).toContain("advanced practice");
    });

    it("a fresh engine still defaults to Projectile Motion / Speed & Range", () => {
      const engine = new AdaptiveEngine();
      expect(engine.currentModuleId).toBe(MODULE_PROJECTILE);
      expect(engine.currentConceptId).toBe(CONCEPT_SPEED_RANGE);
    });

    // Layer 8 fix: the engine now starts a module on its first SCORED
    // concept rather than blindly on CONCEPT_SEQUENCE[0]. For every one of
    // the 5 existing modules those are the exact same concept (none of
    // their concepts are exploration-only), so every existing module's
    // starting concept - and therefore its full generated challenge
    // sequence - is provably unchanged.
    it.each([
      [MODULE_PROJECTILE, CONCEPT_SPEED_RANGE],
      [MODULE_NEWTON, CONCEPT_FORCE_ACCELERATION],
      [MODULE_WORK_ENERGY, CONCEPT_WORK],
      [MODULE_MOMENTUM, CONCEPT_MOMENTUM],
      [MODULE_CIRCULAR, CONCEPT_CENTRIPETAL_FORCE],
    ])("%s still starts on its original first concept (%s) - unaffected by the exploration-only-concept mechanism", (moduleId, firstConcept) => {
      const engine = new AdaptiveEngine(moduleId);
      expect(engine.currentConceptId).toBe(firstConcept);
      expect(engine.generateNextChallenge().conceptId).toBe(firstConcept);
    });

    it("an unrecognized startModuleId still falls back to the default journey, same as before", () => {
      const engine = new AdaptiveEngine("not-a-real-module");
      expect(engine.currentModuleId).toBe(MODULE_PROJECTILE);
      expect(engine.currentConceptId).toBe(CONCEPT_SPEED_RANGE);
    });
  });
});
