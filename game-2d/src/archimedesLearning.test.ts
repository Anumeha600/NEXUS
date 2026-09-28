import { describe, it, expect } from "vitest";
import { AdaptiveEngine, MODULE_ARCHIMEDES, CONCEPT_BUOYANT_FORCE, CONCEPT_APPARENT_WEIGHT, CONCEPT_ARCHIMEDES_PRINCIPLE, CONCEPT_FLOAT_SINK_DENSITY, type Challenge } from "./adaptiveEngine";
import { recordArchimedesAttempt, type CompletedArchimedesAttempt } from "./archimedesLearning";
import {
  ARCHIMEDES_CONCEPT_DISPLACED_VOLUME,
  ARCHIMEDES_CONCEPT_FLUID_DENSITY,
  ARCHIMEDES_FLUIDS,
  applyFluidToChallenge,
  initialFluidForChallenge,
  createArchimedesPlayState,
  measureInAir,
  submergeObject,
  resetArchimedesAttempt,
  type ArchimedesChallenge,
  type ArchimedesNumericChallenge,
  type ArchimedesChoiceChallenge,
} from "./archimedesChallenge";

// Same pattern wavesLearning.test.ts/gravitationLearning.test.ts use to
// force a specific concept (and a specific mastery, to control tier/t) in
// isolation.
function challengeFor(engine: AdaptiveEngine, conceptId: string, mastery = 0.3): Challenge {
  engine.currentModuleId = MODULE_ARCHIMEDES;
  engine.currentConceptId = conceptId;
  engine.conceptMastery[conceptId] = mastery;
  return engine.generateNextChallenge();
}

// CONCEPT_ARCHIMEDES_PRINCIPLE alternates between two underlying challenge
// types (see adaptiveEngine.ts's underlyingArchimedesConcept) - this loops a
// bounded number of times to land on the specific one a test needs, exactly
// the way wavesLearning.test.ts loops variant 0 to land on a choice
// superposition challenge, never assuming a specific id parity.
function archimedesPrincipleChallengeOfKind(
  engine: AdaptiveEngine,
  underlying: typeof ARCHIMEDES_CONCEPT_DISPLACED_VOLUME | typeof ARCHIMEDES_CONCEPT_FLUID_DENSITY,
  mastery = 0.3,
): Challenge {
  engine.currentModuleId = MODULE_ARCHIMEDES;
  engine.currentConceptId = CONCEPT_ARCHIMEDES_PRINCIPLE;
  engine.conceptMastery[CONCEPT_ARCHIMEDES_PRINCIPLE] = mastery;
  for (let i = 0; i < 6; i++) {
    const challenge = engine.generateNextChallenge();
    if (challenge.archimedesChallenge!.conceptId === underlying) return challenge;
  }
  throw new Error(`never got a ${underlying} challenge within 6 tries - alternation broken`);
}

function baseAttempt(
  overrides: Partial<CompletedArchimedesAttempt> & { challenge: Challenge; archimedesChallenge: ArchimedesChallenge },
): CompletedArchimedesAttempt {
  return {
    responseTimeSeconds: 2.5,
    sessionId: "test-session",
    attemptNumber: 1,
    ...overrides,
  };
}

function fluidNamed(name: string) {
  const fluid = ARCHIMEDES_FLUIDS.find((f) => f.name === name);
  if (!fluid) throw new Error(`no fluid named ${name}`);
  return fluid;
}

describe("adaptiveEngine - Archimedes & Buoyancy registration", () => {
  it("Archimedes concept sequence is Buoyant Force -> Apparent Weight -> Archimedes' Principle -> Float/Sink & Density", () => {
    const engine = new AdaptiveEngine(MODULE_ARCHIMEDES);
    expect(engine.currentModuleId).toBe(MODULE_ARCHIMEDES);
    expect(engine.currentConceptId).toBe(CONCEPT_BUOYANT_FORCE);
  });

  it("AdaptiveEngine can generate an Archimedes challenge for every one of the 4 concepts", () => {
    const engine = new AdaptiveEngine(MODULE_ARCHIMEDES);
    for (const conceptId of [CONCEPT_BUOYANT_FORCE, CONCEPT_APPARENT_WEIGHT, CONCEPT_ARCHIMEDES_PRINCIPLE, CONCEPT_FLOAT_SINK_DENSITY]) {
      const challenge = challengeFor(engine, conceptId);
      expect(challenge.moduleId).toBe(MODULE_ARCHIMEDES);
      expect(challenge.conceptId).toBe(conceptId);
      expect(challenge.archimedesChallenge).toBeDefined();
    }
  });

  it("ARCHIMEDES_PRINCIPLE alternates deterministically between Displaced Volume and Fluid Density - never Math.random", () => {
    const engine = new AdaptiveEngine(MODULE_ARCHIMEDES);
    engine.currentConceptId = CONCEPT_ARCHIMEDES_PRINCIPLE;
    const first = engine.generateNextChallenge();
    const second = engine.generateNextChallenge();
    const firstUnderlying = first.archimedesChallenge!.conceptId;
    const secondUnderlying = second.archimedesChallenge!.conceptId;
    expect([ARCHIMEDES_CONCEPT_DISPLACED_VOLUME, ARCHIMEDES_CONCEPT_FLUID_DENSITY]).toContain(firstUnderlying);
    expect([ARCHIMEDES_CONCEPT_DISPLACED_VOLUME, ARCHIMEDES_CONCEPT_FLUID_DENSITY]).toContain(secondUnderlying);
    expect(firstUnderlying).not.toBe(secondUnderlying);
    // Both are still reported under the SAME adaptive concept, never a
    // 5th/6th concept id leaking out to the engine.
    expect(first.conceptId).toBe(CONCEPT_ARCHIMEDES_PRINCIPLE);
    expect(second.conceptId).toBe(CONCEPT_ARCHIMEDES_PRINCIPLE);
  });

  it("(deterministic, given the same call sequence) generating the same concept twice from two fresh engines produces the same underlying challenge type", () => {
    const engineA = new AdaptiveEngine(MODULE_ARCHIMEDES);
    engineA.currentConceptId = CONCEPT_ARCHIMEDES_PRINCIPLE;
    const engineB = new AdaptiveEngine(MODULE_ARCHIMEDES);
    engineB.currentConceptId = CONCEPT_ARCHIMEDES_PRINCIPLE;
    expect(engineA.generateNextChallenge().archimedesChallenge!.conceptId).toBe(engineB.generateNextChallenge().archimedesChallenge!.conceptId);
  });

  it("existing 5 modules, Gravitation, and Wave Motion are completely unaffected by Archimedes' registration", () => {
    const engine = new AdaptiveEngine();
    expect(engine.currentModuleId).toBe("projectile_motion");
    expect(engine.currentConceptId).toBe("speed_range");
    const gravitationEngine = new AdaptiveEngine("gravitation_orbits");
    expect(gravitationEngine.currentModuleId).toBe("gravitation_orbits");
    const wavesEngine = new AdaptiveEngine("wave_motion");
    expect(wavesEngine.currentModuleId).toBe("wave_motion");
  });
});

describe("recordArchimedesAttempt - 1/2. Buoyant Force success/failure", () => {
  it("1. a buoyant-force answer within tolerance succeeds", () => {
    const engine = new AdaptiveEngine(MODULE_ARCHIMEDES);
    const challenge = challengeFor(engine, CONCEPT_BUOYANT_FORCE);
    const ac = challenge.archimedesChallenge as ArchimedesNumericChallenge;
    const result = recordArchimedesAttempt(engine, baseAttempt({ challenge, archimedesChallenge: ac, submittedValue: ac.targetValue }));
    expect(result.supported).toBe(true);
    if (result.supported) expect(result.success).toBe(true);
  });

  it("2. a buoyant-force answer far outside tolerance fails", () => {
    const engine = new AdaptiveEngine(MODULE_ARCHIMEDES);
    const challenge = challengeFor(engine, CONCEPT_BUOYANT_FORCE);
    const ac = challenge.archimedesChallenge as ArchimedesNumericChallenge;
    const result = recordArchimedesAttempt(engine, baseAttempt({ challenge, archimedesChallenge: ac, submittedValue: ac.targetValue + 1000 }));
    expect(result.supported).toBe(true);
    if (result.supported) expect(result.success).toBe(false);
  });
});

describe("recordArchimedesAttempt - 3/4. Apparent Weight success/failure", () => {
  it("3. an apparent-weight answer within tolerance succeeds", () => {
    const engine = new AdaptiveEngine(MODULE_ARCHIMEDES);
    const challenge = challengeFor(engine, CONCEPT_APPARENT_WEIGHT);
    const ac = challenge.archimedesChallenge as ArchimedesNumericChallenge;
    const result = recordArchimedesAttempt(engine, baseAttempt({ challenge, archimedesChallenge: ac, submittedValue: ac.targetValue }));
    expect(result.supported).toBe(true);
    if (result.supported) expect(result.success).toBe(true);
  });

  it("4. an apparent-weight answer far outside tolerance fails", () => {
    const engine = new AdaptiveEngine(MODULE_ARCHIMEDES);
    const challenge = challengeFor(engine, CONCEPT_APPARENT_WEIGHT);
    const ac = challenge.archimedesChallenge as ArchimedesNumericChallenge;
    const result = recordArchimedesAttempt(engine, baseAttempt({ challenge, archimedesChallenge: ac, submittedValue: ac.targetValue + 1000 }));
    expect(result.supported).toBe(true);
    if (result.supported) expect(result.success).toBe(false);
  });
});

describe("recordArchimedesAttempt - 5. Displaced Volume success (via ARCHIMEDES_PRINCIPLE)", () => {
  it("5. a displaced-volume answer within tolerance succeeds", () => {
    const engine = new AdaptiveEngine(MODULE_ARCHIMEDES);
    const challenge = archimedesPrincipleChallengeOfKind(engine, ARCHIMEDES_CONCEPT_DISPLACED_VOLUME);
    const ac = challenge.archimedesChallenge as ArchimedesNumericChallenge;
    const result = recordArchimedesAttempt(engine, baseAttempt({ challenge, archimedesChallenge: ac, submittedValue: ac.targetValue }));
    expect(result.supported).toBe(true);
    if (result.supported) {
      expect(result.success).toBe(true);
      expect(result.event.context!.solve_for).toBe("displacedVolume");
    }
  });
});

describe("recordArchimedesAttempt - 6. Fluid Density success (via ARCHIMEDES_PRINCIPLE)", () => {
  it("6. a fluid-density answer within tolerance succeeds", () => {
    const engine = new AdaptiveEngine(MODULE_ARCHIMEDES);
    const challenge = archimedesPrincipleChallengeOfKind(engine, ARCHIMEDES_CONCEPT_FLUID_DENSITY);
    const ac = challenge.archimedesChallenge as ArchimedesNumericChallenge;
    const result = recordArchimedesAttempt(engine, baseAttempt({ challenge, archimedesChallenge: ac, submittedValue: ac.targetValue }));
    expect(result.supported).toBe(true);
    if (result.supported) {
      expect(result.success).toBe(true);
      expect(result.event.context!.solve_for).toBe("fluidDensity");
    }
  });
});

describe("recordArchimedesAttempt - 7/8. Float/Sink success/failure", () => {
  it("7. the correct float/sink choice succeeds", () => {
    const engine = new AdaptiveEngine(MODULE_ARCHIMEDES);
    const challenge = challengeFor(engine, CONCEPT_FLOAT_SINK_DENSITY);
    const ac = challenge.archimedesChallenge as ArchimedesChoiceChallenge;
    expect(ac.kind).toBe("choice");
    const result = recordArchimedesAttempt(engine, baseAttempt({ challenge, archimedesChallenge: ac, submittedChoice: ac.correctAnswer }));
    expect(result.supported).toBe(true);
    if (result.supported) expect(result.success).toBe(true);
  });

  it("8. any other float/sink choice fails", () => {
    const engine = new AdaptiveEngine(MODULE_ARCHIMEDES);
    const challenge = challengeFor(engine, CONCEPT_FLOAT_SINK_DENSITY);
    const ac = challenge.archimedesChallenge as ArchimedesChoiceChallenge;
    const wrongOption = ac.options.find((o) => o !== ac.correctAnswer)!;
    const result = recordArchimedesAttempt(engine, baseAttempt({ challenge, archimedesChallenge: ac, submittedChoice: wrongOption }));
    expect(result.supported).toBe(true);
    if (result.supported) expect(result.success).toBe(false);
  });
});

describe("recordArchimedesAttempt - rejects mismatched/unsupported submissions rather than fabricating a result", () => {
  it("a numeric challenge answered with a choice is rejected", () => {
    const engine = new AdaptiveEngine(MODULE_ARCHIMEDES);
    const challenge = challengeFor(engine, CONCEPT_BUOYANT_FORCE);
    const ac = challenge.archimedesChallenge as ArchimedesNumericChallenge;
    const result = recordArchimedesAttempt(engine, baseAttempt({ challenge, archimedesChallenge: ac, submittedChoice: "FLOAT" }));
    expect(result.supported).toBe(false);
  });

  it("a choice challenge answered with a numeric value is rejected", () => {
    const engine = new AdaptiveEngine(MODULE_ARCHIMEDES);
    const challenge = challengeFor(engine, CONCEPT_FLOAT_SINK_DENSITY);
    const ac = challenge.archimedesChallenge as ArchimedesChoiceChallenge;
    const result = recordArchimedesAttempt(engine, baseAttempt({ challenge, archimedesChallenge: ac, submittedValue: 5 }));
    expect(result.supported).toBe(false);
  });

  it("a challenge with no attached archimedesChallenge (not an Archimedes concept) is rejected, not scored", () => {
    const engine = new AdaptiveEngine();
    const challenge = engine.generateNextChallenge(); // Projectile Motion - no archimedesChallenge
    const result = recordArchimedesAttempt(engine, {
      challenge,
      archimedesChallenge: challengeFor(new AdaptiveEngine(MODULE_ARCHIMEDES), CONCEPT_BUOYANT_FORCE).archimedesChallenge as ArchimedesNumericChallenge,
      submittedValue: 5,
      responseTimeSeconds: 1,
      sessionId: "s",
      attemptNumber: 1,
    });
    expect(result.supported).toBe(false);
  });

  it("an archimedesChallenge that doesn't match the engine's own current challenge is rejected - never scores the wrong experiment", () => {
    const engine = new AdaptiveEngine(MODULE_ARCHIMEDES);
    const challenge = challengeFor(engine, CONCEPT_BUOYANT_FORCE);
    const otherEngine = new AdaptiveEngine(MODULE_ARCHIMEDES);
    const otherChallenge = challengeFor(otherEngine, CONCEPT_APPARENT_WEIGHT);
    const result = recordArchimedesAttempt(
      engine,
      baseAttempt({ challenge, archimedesChallenge: otherChallenge.archimedesChallenge as ArchimedesNumericChallenge, submittedValue: 1 }),
    );
    expect(result.supported).toBe(false);
  });
});

describe("recordArchimedesAttempt - difficulty and concept-type propagation", () => {
  it("difficulty comes from the engine's own tier for the current concept mastery, never invented separately", () => {
    const engine = new AdaptiveEngine(MODULE_ARCHIMEDES);
    const beginner = challengeFor(engine, CONCEPT_BUOYANT_FORCE, 0.1);
    expect(beginner.difficulty).toBe("Beginner");
    const advanced = challengeFor(engine, CONCEPT_BUOYANT_FORCE, 0.9);
    expect(advanced.difficulty).toBe("Advanced");

    const ac = advanced.archimedesChallenge as ArchimedesNumericChallenge;
    const result = recordArchimedesAttempt(engine, baseAttempt({ challenge: advanced, archimedesChallenge: ac, submittedValue: ac.targetValue }));
    expect(result.supported).toBe(true);
    if (result.supported) expect(result.event.difficulty).toBe("Advanced");
  });

  it("challenge_type on the event is the adaptive concept id, not the underlying archimedesChallenge.ts concept id", () => {
    const engine = new AdaptiveEngine(MODULE_ARCHIMEDES);
    const challenge = archimedesPrincipleChallengeOfKind(engine, ARCHIMEDES_CONCEPT_FLUID_DENSITY);
    const ac = challenge.archimedesChallenge as ArchimedesNumericChallenge;
    expect(ac.conceptId).toBe(ARCHIMEDES_CONCEPT_FLUID_DENSITY); // the underlying generator concept
    const result = recordArchimedesAttempt(engine, baseAttempt({ challenge, archimedesChallenge: ac, submittedValue: ac.targetValue }));
    expect(result.supported).toBe(true);
    if (result.supported) expect(result.event.challenge_type).toBe(CONCEPT_ARCHIMEDES_PRINCIPLE); // the adaptive concept id
  });
});

describe("recordArchimedesAttempt - mastery via AdaptiveEngine (never a second formula)", () => {
  it("mastery_before is captured before recordAttempt mutates it", () => {
    const engine = new AdaptiveEngine(MODULE_ARCHIMEDES);
    const challenge = challengeFor(engine, CONCEPT_BUOYANT_FORCE, 0.42);
    expect(engine.conceptMastery[CONCEPT_BUOYANT_FORCE]).toBeCloseTo(0.42, 5);
    const ac = challenge.archimedesChallenge as ArchimedesNumericChallenge;
    const result = recordArchimedesAttempt(engine, baseAttempt({ challenge, archimedesChallenge: ac, submittedValue: ac.targetValue }));
    expect(result.supported).toBe(true);
    if (result.supported) expect(result.masteryBefore).toBeCloseTo(0.42, 5);
  });

  it("mastery_after equals AdaptiveEngine's own conceptMastery after recordAttempt - never independently computed", () => {
    const engine = new AdaptiveEngine(MODULE_ARCHIMEDES);
    const challenge = challengeFor(engine, CONCEPT_BUOYANT_FORCE, 0.42);
    const ac = challenge.archimedesChallenge as ArchimedesNumericChallenge;
    const result = recordArchimedesAttempt(engine, baseAttempt({ challenge, archimedesChallenge: ac, submittedValue: ac.targetValue }));
    expect(result.supported).toBe(true);
    if (result.supported) {
      expect(result.masteryAfter).toBe(engine.conceptMastery[CONCEPT_BUOYANT_FORCE]);
      expect(result.masteryAfter).not.toBe(result.masteryBefore);
    }
  });

  it("performance comes directly from engine.recordAttempt's own return value", () => {
    const engineA = new AdaptiveEngine(MODULE_ARCHIMEDES);
    const challengeA = challengeFor(engineA, CONCEPT_BUOYANT_FORCE, 0.5);
    const acA = challengeA.archimedesChallenge as ArchimedesNumericChallenge;

    const engineB = new AdaptiveEngine(MODULE_ARCHIMEDES);
    engineB.currentConceptId = CONCEPT_BUOYANT_FORCE;
    engineB.conceptMastery[CONCEPT_BUOYANT_FORCE] = 0.5;
    const expectedPerformance = engineB.recordAttempt(0, acA.tolerance, true, 3);

    const result = recordArchimedesAttempt(engineA, baseAttempt({ challenge: challengeA, archimedesChallenge: acA, submittedValue: acA.targetValue, responseTimeSeconds: 3 }));
    expect(result.supported).toBe(true);
    if (result.supported) expect(result.performance).toBeCloseTo(expectedPerformance, 10);
  });
});

describe("recordArchimedesAttempt - attempt lifecycle / next challenge from AdaptiveEngine", () => {
  it("a successful attempt records correctly (mastery moves up)", () => {
    const engine = new AdaptiveEngine(MODULE_ARCHIMEDES);
    const challenge = challengeFor(engine, CONCEPT_BUOYANT_FORCE, 0.3);
    const ac = challenge.archimedesChallenge as ArchimedesNumericChallenge;
    const result = recordArchimedesAttempt(engine, baseAttempt({ challenge, archimedesChallenge: ac, submittedValue: ac.targetValue }));
    expect(result.supported).toBe(true);
    if (result.supported) {
      expect(result.event.success).toBe(true);
      expect(result.masteryAfter).toBeGreaterThan(result.masteryBefore);
    }
  });

  it("the next challenge comes from AdaptiveEngine.generateNextChallenge(), not an independently constructed one", () => {
    const engine = new AdaptiveEngine(MODULE_ARCHIMEDES);
    const challenge = challengeFor(engine, CONCEPT_BUOYANT_FORCE, 0.3);
    const ac = challenge.archimedesChallenge as ArchimedesNumericChallenge;
    const result = recordArchimedesAttempt(engine, baseAttempt({ challenge, archimedesChallenge: ac, submittedValue: ac.targetValue }));
    expect(result.supported).toBe(true);
    if (result.supported) {
      expect(result.nextChallenge.moduleId).toBe(MODULE_ARCHIMEDES);
      expect(result.nextChallenge.id).not.toBe(challenge.id);
      expect(result.nextChallenge.conceptId).toBe(engine.currentConceptId);
    }
  });

  it("retry (a second completed submission) produces a second, independent recorded attempt", () => {
    const engine = new AdaptiveEngine(MODULE_ARCHIMEDES);
    const challenge = challengeFor(engine, CONCEPT_BUOYANT_FORCE, 0.3);
    const ac = challenge.archimedesChallenge as ArchimedesNumericChallenge;

    const first = recordArchimedesAttempt(engine, baseAttempt({ challenge, archimedesChallenge: ac, submittedValue: ac.targetValue + 1000, attemptNumber: 1 }));
    expect(first.supported).toBe(true);
    const masteryAfterFirst = engine.conceptMastery[CONCEPT_BUOYANT_FORCE];

    const second = recordArchimedesAttempt(engine, baseAttempt({ challenge, archimedesChallenge: ac, submittedValue: ac.targetValue, attemptNumber: 2 }));
    expect(second.supported).toBe(true);
    if (first.supported && second.supported) {
      expect(second.masteryBefore).toBe(masteryAfterFirst);
      expect(first.event.attempt_number).toBe(1);
      expect(second.event.attempt_number).toBe(2);
      expect(first.success).toBe(false);
      expect(second.success).toBe(true);
    }
  });
});

describe("adaptiveEngine - Archimedes concept progression (evaluateContentTransition, never a second progression system)", () => {
  it("weak performance keeps reinforcing the same concept; strong performance advances to the next concept", () => {
    const engine = new AdaptiveEngine(MODULE_ARCHIMEDES);
    let challenge = challengeFor(engine, CONCEPT_BUOYANT_FORCE, 0.1);

    for (let i = 0; i < 3; i++) {
      const ac = challenge.archimedesChallenge as ArchimedesNumericChallenge;
      const result = recordArchimedesAttempt(engine, baseAttempt({ challenge, archimedesChallenge: ac, submittedValue: ac.targetValue + 1000, attemptNumber: i + 1 }));
      expect(result.supported).toBe(true);
      if (result.supported) challenge = result.nextChallenge;
    }
    expect(engine.currentConceptId).toBe(CONCEPT_BUOYANT_FORCE);
    expect(engine.conceptMastery[CONCEPT_BUOYANT_FORCE]).toBeLessThan(0.75);

    for (let i = 0; i < 20 && engine.currentConceptId === CONCEPT_BUOYANT_FORCE; i++) {
      const ac = challenge.archimedesChallenge as ArchimedesNumericChallenge;
      const result = recordArchimedesAttempt(engine, baseAttempt({ challenge, archimedesChallenge: ac, submittedValue: ac.targetValue, responseTimeSeconds: 0.5, attemptNumber: i + 10 }));
      expect(result.supported).toBe(true);
      if (result.supported) challenge = result.nextChallenge;
    }
    expect(engine.currentConceptId).toBe(CONCEPT_APPARENT_WEIGHT);
  });
});

describe("recordArchimedesAttempt - learning event content and canonical shape", () => {
  it("the learning event carries Archimedes-specific context and matches the canonical LearningEvent shape", () => {
    const engine = new AdaptiveEngine(MODULE_ARCHIMEDES);
    const challenge = challengeFor(engine, CONCEPT_BUOYANT_FORCE, 0.2);
    const ac = challenge.archimedesChallenge as ArchimedesNumericChallenge;
    const result = recordArchimedesAttempt(
      engine,
      baseAttempt({ challenge, archimedesChallenge: ac, submittedValue: ac.targetValue, sessionId: "session-xyz", attemptNumber: 4, responseTimeSeconds: 1.8 }),
    );
    expect(result.supported).toBe(true);
    if (!result.supported) return;

    expect(result.event.session_id).toBe("session-xyz");
    expect(result.event.module).toBe(MODULE_ARCHIMEDES);
    expect(result.event.challenge_type).toBe(CONCEPT_BUOYANT_FORCE);
    expect(result.event.attempt_number).toBe(4);
    expect(result.event.actual_value).toBe(ac.targetValue);
    expect(result.event.target_value).toBe(ac.targetValue);
    expect(result.event.mastery_before).toBe(result.masteryBefore);
    expect(result.event.mastery_after).toBe(result.masteryAfter);
    expect(typeof result.event.recent_attempts).toBe("number");

    const ctx = result.event.context!;
    expect(ctx.challenge_kind).toBe("numeric");
    expect(ctx.fluid).toBe(ac.setup.fluidName.replace(/ /g, "_"));
    expect(ctx.fluid_density).toBe(ac.setup.fluidDensity);
    expect(typeof ctx.mass).toBe("number");
    expect(typeof ctx.object_volume).toBe("number");

    // Round-trips through JSON exactly like every other module's event - the
    // canonical shape the AI insight layer (@nexus/shared's generateInsight)
    // consumes downstream, never an Archimedes-specific format.
    const roundTripped = JSON.parse(JSON.stringify(result.event));
    expect(roundTripped).toEqual(result.event);
  });

  it("a Float/Sink challenge's learning event encodes the choice answer in its context", () => {
    const engine = new AdaptiveEngine(MODULE_ARCHIMEDES);
    const challenge = challengeFor(engine, CONCEPT_FLOAT_SINK_DENSITY, 0.3);
    const ac = challenge.archimedesChallenge as ArchimedesChoiceChallenge;
    const result = recordArchimedesAttempt(engine, baseAttempt({ challenge, archimedesChallenge: ac, submittedChoice: ac.correctAnswer }));
    expect(result.supported).toBe(true);
    if (!result.supported) return;
    expect(result.event.context!.challenge_kind).toBe("choice");
    expect(result.event.context!.correct_answer).toBe(ac.correctAnswer);
    expect(typeof result.event.context!.object_density).toBe("number");
  });

  it("example from the Phase 2 brief: context reports the selected fluid as a lowercase, underscore-joined name plus its density", () => {
    const engine = new AdaptiveEngine(MODULE_ARCHIMEDES);
    const challenge = challengeFor(engine, CONCEPT_APPARENT_WEIGHT, 0.3);
    const inSaltWater = applyFluidToChallenge(challenge.archimedesChallenge!, fluidNamed("salt water")) as ArchimedesNumericChallenge;
    const result = recordArchimedesAttempt(engine, baseAttempt({ challenge, archimedesChallenge: inSaltWater, submittedValue: inSaltWater.targetValue }));
    expect(result.supported).toBe(true);
    if (!result.supported) return;
    expect(result.event.context!.fluid).toBe("salt_water");
    expect(result.event.context!.fluid_density).toBe(1025);
  });
});

describe("Manual fluid selection is an experiment parameter - it never itself scores an attempt", () => {
  it("a fluid change (applyFluidToChallenge) changes the target/actual physics but is never itself a recorded attempt", () => {
    const engine = new AdaptiveEngine(MODULE_ARCHIMEDES);
    const challenge = challengeFor(engine, CONCEPT_APPARENT_WEIGHT, 0.3);
    const inWater = challenge.archimedesChallenge as ArchimedesNumericChallenge;
    expect(engine.getRecentAttemptCount(CONCEPT_APPARENT_WEIGHT)).toBe(0);

    // Simulate the player changing fluid via ArchimedesChallengeScene.tsx's
    // own handleFluidChange - a pure local recomputation that never touches
    // engine/mastery/attempt count, exactly like Phase 1's archimedesChallenge.test.ts
    // already verifies for applyFluidToChallenge in isolation.
    const inGlycerin = applyFluidToChallenge(inWater, fluidNamed("glycerin")) as ArchimedesNumericChallenge;
    expect(inGlycerin.targetValue).not.toBe(inWater.targetValue);
    expect(engine.getRecentAttemptCount(CONCEPT_APPARENT_WEIGHT)).toBe(0);
    expect(engine.conceptMastery[CONCEPT_APPARENT_WEIGHT]).toBeCloseTo(0.3, 5);
    expect(engine.currentConceptId).toBe(CONCEPT_APPARENT_WEIGHT);

    // Only an actual submitted challenge outcome enters the adaptive system -
    // and it scores against whichever fluid was selected at that point.
    const result = recordArchimedesAttempt(engine, baseAttempt({ challenge, archimedesChallenge: inGlycerin, submittedValue: inGlycerin.targetValue }));
    expect(result.supported).toBe(true);
    if (result.supported) {
      expect(result.event.target_value).toBe(inGlycerin.targetValue);
      expect(result.event.context!.fluid).toBe("glycerin");
    }
    expect(engine.getRecentAttemptCount(CONCEPT_APPARENT_WEIGHT)).toBe(1);
  });
});

describe("Reset is adaptive-neutral - it never records an attempt, touches mastery, or advances a concept", () => {
  it("resetArchimedesAttempt (the existing Phase 1 reset) never touches AdaptiveEngine state - only recordArchimedesAttempt does", () => {
    const engine = new AdaptiveEngine(MODULE_ARCHIMEDES);
    const challenge = challengeFor(engine, CONCEPT_BUOYANT_FORCE, 0.3);
    const masteryBefore = engine.conceptMastery[CONCEPT_BUOYANT_FORCE];
    const moduleIdBefore = engine.currentModuleId;
    const conceptIdBefore = engine.currentConceptId;
    const challengeIdBefore = challenge.archimedesChallenge!.id;

    // Simulate the player measuring in air, submerging, changing fluid, and
    // pressing Reset - all pure local play-state/experiment operations
    // ArchimedesChallengeScene.tsx's own handleReset performs. None of them
    // accept or reference an AdaptiveEngine.
    let playState = createArchimedesPlayState();
    playState = measureInAir(playState);
    playState = submergeObject(playState);
    const changedFluid = applyFluidToChallenge(challenge.archimedesChallenge!, fluidNamed("olive oil"));
    playState = resetArchimedesAttempt(playState); // the Reset button's own call
    const restoredFluid = applyFluidToChallenge(changedFluid, initialFluidForChallenge(challenge.archimedesChallenge!));

    expect(playState.phase).toBe("READY");
    expect(restoredFluid.setup.fluidName).toBe(challenge.archimedesChallenge!.setup.fluidName);
    expect(restoredFluid.id).toBe(challengeIdBefore); // same experiment, never a new one

    expect(engine.conceptMastery[CONCEPT_BUOYANT_FORCE]).toBe(masteryBefore);
    expect(engine.currentModuleId).toBe(moduleIdBefore);
    expect(engine.currentConceptId).toBe(conceptIdBefore);
    expect(engine.getRecentAttemptCount(CONCEPT_BUOYANT_FORCE)).toBe(0);
  });

  it("only a legitimate submitted challenge outcome changes recent-attempt count / mastery - reset and fluid changes never do", () => {
    const engine = new AdaptiveEngine(MODULE_ARCHIMEDES);
    const challenge = challengeFor(engine, CONCEPT_BUOYANT_FORCE, 0.3);
    expect(engine.getRecentAttemptCount(CONCEPT_BUOYANT_FORCE)).toBe(0);

    const ac = challenge.archimedesChallenge as ArchimedesNumericChallenge;
    const result = recordArchimedesAttempt(engine, baseAttempt({ challenge, archimedesChallenge: ac, submittedValue: ac.targetValue }));
    expect(result.supported).toBe(true);
    expect(engine.getRecentAttemptCount(CONCEPT_BUOYANT_FORCE)).toBe(1);
  });
});
