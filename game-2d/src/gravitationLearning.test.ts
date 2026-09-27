import { describe, it, expect } from "vitest";
import { AdaptiveEngine, MODULE_GRAVITATION, CONCEPT_GRAVITATIONAL_FORCE, CONCEPT_ORBITAL_VELOCITY, CONCEPT_ESCAPE_VELOCITY } from "./adaptiveEngine";
import { gravitationSimSetupFor, type GravitationChallengeSetup } from "./gravitationChallenge";
import { recordGravitationAttempt, type CompletedGravitationAttempt } from "./gravitationLearning";

// Same pattern adaptiveEngine.test.ts and gravitationChallenge.test.ts both
// use to force a specific concept in isolation.
function challengeFor(engine: AdaptiveEngine, conceptId: string, mastery = 0.1) {
  engine.currentModuleId = MODULE_GRAVITATION;
  engine.currentConceptId = conceptId;
  engine.conceptMastery[conceptId] = mastery;
  return engine.generateNextChallenge();
}

function baseAttempt(setup: GravitationChallengeSetup, overrides: Partial<CompletedGravitationAttempt> = {}): Omit<CompletedGravitationAttempt, "challenge"> {
  return {
    setup,
    launchVelocity: setup.defaultInitialVelocity,
    outcomeStatus: "orbit",
    elapsedSimTime: 12.5,
    minRadius: setup.orbitalRadius * 0.9,
    maxRadius: setup.orbitalRadius * 1.1,
    responseTimeSeconds: 2.4,
    sessionId: "test-session",
    attemptNumber: 1,
    ...overrides,
  };
}

describe("recordGravitationAttempt - success mapping", () => {
  it("1. orbital velocity challenge + orbit outcome -> success", () => {
    const engine = new AdaptiveEngine();
    const challenge = challengeFor(engine, CONCEPT_ORBITAL_VELOCITY);
    const setup = gravitationSimSetupFor(challenge);
    const result = recordGravitationAttempt(engine, { challenge, ...baseAttempt(setup, { outcomeStatus: "orbit" }) });
    expect(result.supported).toBe(true);
    if (result.supported) expect(result.success).toBe(true);
  });

  it("2. orbital velocity challenge + collision outcome -> failure", () => {
    const engine = new AdaptiveEngine();
    const challenge = challengeFor(engine, CONCEPT_ORBITAL_VELOCITY);
    const setup = gravitationSimSetupFor(challenge);
    const result = recordGravitationAttempt(engine, { challenge, ...baseAttempt(setup, { outcomeStatus: "collision" }) });
    expect(result.supported).toBe(true);
    if (result.supported) expect(result.success).toBe(false);
  });

  it("3. orbital velocity challenge + escape outcome -> failure (not simply 'non-collision = success')", () => {
    const engine = new AdaptiveEngine();
    const challenge = challengeFor(engine, CONCEPT_ORBITAL_VELOCITY);
    const setup = gravitationSimSetupFor(challenge);
    const result = recordGravitationAttempt(engine, { challenge, ...baseAttempt(setup, { outcomeStatus: "escape" }) });
    expect(result.supported).toBe(true);
    if (result.supported) expect(result.success).toBe(false);
  });

  it("4. escape velocity challenge + escape outcome -> success", () => {
    const engine = new AdaptiveEngine();
    const challenge = challengeFor(engine, CONCEPT_ESCAPE_VELOCITY);
    const setup = gravitationSimSetupFor(challenge);
    const result = recordGravitationAttempt(engine, { challenge, ...baseAttempt(setup, { outcomeStatus: "escape" }) });
    expect(result.supported).toBe(true);
    if (result.supported) expect(result.success).toBe(true);
  });

  it("5. escape velocity challenge + orbit outcome -> failure", () => {
    const engine = new AdaptiveEngine();
    const challenge = challengeFor(engine, CONCEPT_ESCAPE_VELOCITY);
    const setup = gravitationSimSetupFor(challenge);
    const result = recordGravitationAttempt(engine, { challenge, ...baseAttempt(setup, { outcomeStatus: "orbit" }) });
    expect(result.supported).toBe(true);
    if (result.supported) expect(result.success).toBe(false);
  });

  it("escape velocity challenge + collision outcome -> failure", () => {
    const engine = new AdaptiveEngine();
    const challenge = challengeFor(engine, CONCEPT_ESCAPE_VELOCITY);
    const setup = gravitationSimSetupFor(challenge);
    const result = recordGravitationAttempt(engine, { challenge, ...baseAttempt(setup, { outcomeStatus: "collision" }) });
    expect(result.supported).toBe(true);
    if (result.supported) expect(result.success).toBe(false);
  });
});

describe("recordGravitationAttempt - mastery via AdaptiveEngine (never a second formula)", () => {
  it("6. mastery_before is captured before recordAttempt mutates it", () => {
    const engine = new AdaptiveEngine();
    const challenge = challengeFor(engine, CONCEPT_ORBITAL_VELOCITY, 0.42);
    const setup = gravitationSimSetupFor(challenge);
    expect(engine.conceptMastery[CONCEPT_ORBITAL_VELOCITY]).toBeCloseTo(0.42, 5);

    const result = recordGravitationAttempt(engine, { challenge, ...baseAttempt(setup, { outcomeStatus: "orbit" }) });
    expect(result.supported).toBe(true);
    if (result.supported) expect(result.masteryBefore).toBeCloseTo(0.42, 5);
  });

  it("7. mastery_after equals AdaptiveEngine's own conceptMastery after recordAttempt - never independently computed", () => {
    const engine = new AdaptiveEngine();
    const challenge = challengeFor(engine, CONCEPT_ORBITAL_VELOCITY, 0.42);
    const setup = gravitationSimSetupFor(challenge);
    const result = recordGravitationAttempt(engine, { challenge, ...baseAttempt(setup, { outcomeStatus: "orbit" }) });
    expect(result.supported).toBe(true);
    if (result.supported) {
      expect(result.masteryAfter).toBe(engine.conceptMastery[CONCEPT_ORBITAL_VELOCITY]);
      expect(result.masteryAfter).not.toBe(result.masteryBefore);
    }
  });

  it("performance comes directly from engine.recordAttempt's own return value", () => {
    const engineA = new AdaptiveEngine();
    const challengeA = challengeFor(engineA, CONCEPT_ORBITAL_VELOCITY, 0.5);
    const setupA = gravitationSimSetupFor(challengeA);
    const attempt = baseAttempt(setupA, { outcomeStatus: "orbit", launchVelocity: setupA.defaultInitialVelocity, responseTimeSeconds: 3 });

    const engineB = new AdaptiveEngine();
    engineB.currentModuleId = MODULE_GRAVITATION;
    engineB.currentConceptId = CONCEPT_ORBITAL_VELOCITY;
    engineB.conceptMastery[CONCEPT_ORBITAL_VELOCITY] = 0.5;
    const distanceError = Math.abs(attempt.launchVelocity - challengeA.targetOrbitalVelocity!);
    const expectedPerformance = engineB.recordAttempt(distanceError, challengeA.tolerance, true, attempt.responseTimeSeconds);

    const result = recordGravitationAttempt(engineA, { challenge: challengeA, ...attempt });
    expect(result.supported).toBe(true);
    if (result.supported) expect(result.performance).toBeCloseTo(expectedPerformance, 10);
  });
});

describe("recordGravitationAttempt - attempt lifecycle", () => {
  it("8. a non-terminal status (before/without launch completing) is rejected - no attempt is recorded", () => {
    const engine = new AdaptiveEngine();
    const challenge = challengeFor(engine, CONCEPT_ORBITAL_VELOCITY);
    const setup = gravitationSimSetupFor(challenge);
    const masteryBefore = engine.conceptMastery[CONCEPT_ORBITAL_VELOCITY];

    for (const status of ["idle", "running", "stopped"] as const) {
      const result = recordGravitationAttempt(engine, { challenge, ...baseAttempt(setup, { outcomeStatus: status }) });
      expect(result.supported).toBe(false);
    }
    // Mastery must be completely unaffected by these rejected calls.
    expect(engine.conceptMastery[CONCEPT_ORBITAL_VELOCITY]).toBe(masteryBefore);
  });

  it("9. retry (a second completed launch) produces a second, independent recorded attempt", () => {
    const engine = new AdaptiveEngine();
    const challenge = challengeFor(engine, CONCEPT_ORBITAL_VELOCITY, 0.3);
    const setup = gravitationSimSetupFor(challenge);

    const first = recordGravitationAttempt(engine, { challenge, ...baseAttempt(setup, { outcomeStatus: "collision", attemptNumber: 1 }) });
    expect(first.supported).toBe(true);
    const masteryAfterFirst = engine.conceptMastery[CONCEPT_ORBITAL_VELOCITY];

    const second = recordGravitationAttempt(engine, { challenge, ...baseAttempt(setup, { outcomeStatus: "orbit", attemptNumber: 2 }) });
    expect(second.supported).toBe(true);
    if (first.supported && second.supported) {
      expect(second.masteryBefore).toBe(masteryAfterFirst);
      expect(second.event.attempt_number).toBe(2);
      expect(first.event.attempt_number).toBe(1);
      // Two genuinely different outcomes must be reflected as two different
      // recorded successes, not a single collapsed attempt.
      expect(first.success).toBe(false);
      expect(second.success).toBe(true);
    }
  });

  it("10. the next challenge comes from AdaptiveEngine.generateNextChallenge(), not an independently constructed one", () => {
    const engine = new AdaptiveEngine();
    const challenge = challengeFor(engine, CONCEPT_ORBITAL_VELOCITY);
    const setup = gravitationSimSetupFor(challenge);
    const result = recordGravitationAttempt(engine, { challenge, ...baseAttempt(setup, { outcomeStatus: "orbit" }) });
    expect(result.supported).toBe(true);
    if (result.supported) {
      expect(result.nextChallenge.moduleId).toBe(MODULE_GRAVITATION);
      expect(result.nextChallenge.id).not.toBe(challenge.id);
      // The engine, not this module, decided which concept comes next.
      expect(result.nextChallenge.conceptId).toBe(engine.currentConceptId);
    }
  });
});

describe("recordGravitationAttempt - gravitational_force (known architecture gap)", () => {
  it("11. gravitational_force does not get forced into the orbit/escape success model - it is reported as unsupported, and mastery is left untouched", () => {
    const engine = new AdaptiveEngine();
    const challenge = challengeFor(engine, CONCEPT_GRAVITATIONAL_FORCE, 0.5);
    const setup = gravitationSimSetupFor(challenge);
    const masteryBefore = engine.conceptMastery[CONCEPT_GRAVITATIONAL_FORCE];

    for (const status of ["orbit", "collision", "escape"] as const) {
      const result = recordGravitationAttempt(engine, { challenge, ...baseAttempt(setup, { outcomeStatus: status }) });
      expect(result.supported).toBe(false);
      if (!result.supported) expect(result.reason.length).toBeGreaterThan(0);
    }
    expect(engine.conceptMastery[CONCEPT_GRAVITATIONAL_FORCE]).toBe(masteryBefore);
  });
});

describe("recordGravitationAttempt - learning event content", () => {
  it("12. the learning event carries the gravitation-specific context: star mass, starting radius, initial velocity, orbital/escape velocity, final status, elapsed sim time, min/max radius", () => {
    const engine = new AdaptiveEngine();
    const challenge = challengeFor(engine, CONCEPT_ESCAPE_VELOCITY, 0.2);
    const setup = gravitationSimSetupFor(challenge);
    const attempt = baseAttempt(setup, {
      outcomeStatus: "escape",
      launchVelocity: setup.defaultInitialVelocity * 1.3,
      elapsedSimTime: 8.75,
      minRadius: setup.orbitalRadius,
      maxRadius: setup.orbitalRadius * 12,
      sessionId: "session-xyz",
      attemptNumber: 4,
    });
    const result = recordGravitationAttempt(engine, { challenge, ...attempt });
    expect(result.supported).toBe(true);
    if (!result.supported) return;

    expect(result.event.session_id).toBe("session-xyz");
    expect(result.event.module).toBe(MODULE_GRAVITATION);
    expect(result.event.challenge_type).toBe(CONCEPT_ESCAPE_VELOCITY);
    expect(result.event.attempt_number).toBe(4);
    expect(result.event.actual_value).toBe(attempt.launchVelocity);
    expect(result.event.target_value).toBe(challenge.targetEscapeVelocity);
    expect(result.event.mastery_before).toBe(result.masteryBefore);
    expect(result.event.mastery_after).toBe(result.masteryAfter);
    expect(typeof result.event.recent_attempts).toBe("number");

    const ctx = result.event.context!;
    expect(ctx.star_mass).toBe(setup.starMass);
    expect(ctx.starting_radius).toBe(setup.orbitalRadius);
    expect(ctx.initial_velocity).toBe(attempt.launchVelocity);
    expect(typeof ctx.orbital_velocity).toBe("number");
    expect(typeof ctx.escape_velocity).toBe("number");
    expect(ctx.final_status).toBe("escape");
    expect(ctx.elapsed_simulation_time).toBe(8.75);
    expect(ctx.minimum_radius).toBe(setup.orbitalRadius);
    expect(ctx.maximum_radius).toBe(setup.orbitalRadius * 12);
  });
});
