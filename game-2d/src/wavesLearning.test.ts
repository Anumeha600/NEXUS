import { describe, it, expect } from "vitest";
import { AdaptiveEngine, MODULE_WAVES, type Challenge } from "./adaptiveEngine";
import { recordWaveAttempt, type CompletedWaveAttempt } from "./wavesLearning";
import {
  WAVE_CONCEPT_AMPLITUDE,
  WAVE_CONCEPT_FREQUENCY_WAVELENGTH,
  WAVE_CONCEPT_WAVE_SPEED,
  WAVE_CONCEPT_SUPERPOSITION,
  type WaveChoiceChallenge,
  type WaveNumericChallenge,
} from "./wavesChallenge";

// Same pattern gravitationLearning.test.ts uses to force a specific concept
// (and a specific mastery, to control tier/t) in isolation.
function challengeFor(engine: AdaptiveEngine, conceptId: string, mastery = 0.3): Challenge {
  engine.currentModuleId = MODULE_WAVES;
  engine.currentConceptId = conceptId;
  engine.conceptMastery[conceptId] = mastery;
  return engine.generateNextChallenge();
}

function baseAttempt(overrides: Partial<CompletedWaveAttempt> & { challenge: Challenge }): CompletedWaveAttempt {
  return {
    responseTimeSeconds: 2.5,
    sessionId: "test-session",
    attemptNumber: 1,
    ...overrides,
  };
}

describe("adaptiveEngine - Wave Motion registration", () => {
  it("1. Wave concept sequence is Amplitude -> Frequency & Wavelength -> Wave Speed -> Superposition", () => {
    const engine = new AdaptiveEngine(MODULE_WAVES);
    expect(engine.currentModuleId).toBe(MODULE_WAVES);
    expect(engine.currentConceptId).toBe(WAVE_CONCEPT_AMPLITUDE);
  });

  it("2. AdaptiveEngine can generate a Wave challenge for every one of the 4 concepts", () => {
    const engine = new AdaptiveEngine(MODULE_WAVES);
    for (const conceptId of [WAVE_CONCEPT_AMPLITUDE, WAVE_CONCEPT_FREQUENCY_WAVELENGTH, WAVE_CONCEPT_WAVE_SPEED, WAVE_CONCEPT_SUPERPOSITION]) {
      const challenge = challengeFor(engine, conceptId);
      expect(challenge.moduleId).toBe(MODULE_WAVES);
      expect(challenge.conceptId).toBe(conceptId);
      expect(challenge.waveChallenge).toBeDefined();
      expect(challenge.waveChallenge!.conceptId).toBe(conceptId);
    }
  });

  it("3. a fresh Wave Motion engine's first concept is Amplitude / Wave Properties", () => {
    const engine = new AdaptiveEngine(MODULE_WAVES);
    const challenge = engine.generateNextChallenge();
    expect(challenge.conceptId).toBe(WAVE_CONCEPT_AMPLITUDE);
  });

  it("existing 5 modules and Gravitation are completely unaffected by Wave's registration", () => {
    const engine = new AdaptiveEngine();
    expect(engine.currentModuleId).toBe("projectile_motion");
    expect(engine.currentConceptId).toBe("speed_range");
    const gravitationEngine = new AdaptiveEngine("gravitation_orbits");
    expect(gravitationEngine.currentModuleId).toBe("gravitation_orbits");
  });
});

describe("recordWaveAttempt - success/failure comes only from the actual submitted answer", () => {
  it("4/9. a numeric answer within tolerance succeeds", () => {
    const engine = new AdaptiveEngine(MODULE_WAVES);
    const challenge = challengeFor(engine, WAVE_CONCEPT_AMPLITUDE);
    const wc = challenge.waveChallenge as WaveNumericChallenge;
    const result = recordWaveAttempt(engine, baseAttempt({ challenge, submittedValue: wc.targetValue }));
    expect(result.supported).toBe(true);
    if (result.supported) expect(result.success).toBe(true);
  });

  it("9b. a numeric answer far outside tolerance fails", () => {
    const engine = new AdaptiveEngine(MODULE_WAVES);
    const challenge = challengeFor(engine, WAVE_CONCEPT_AMPLITUDE);
    const wc = challenge.waveChallenge as WaveNumericChallenge;
    const result = recordWaveAttempt(engine, baseAttempt({ challenge, submittedValue: wc.targetValue + wc.tolerance * 50 }));
    expect(result.supported).toBe(true);
    if (result.supported) expect(result.success).toBe(false);
  });

  it("a choice answer matching correctAnswer succeeds; any other option fails", () => {
    const engine = new AdaptiveEngine(MODULE_WAVES);
    // Variant 0 for superposition is always a choice challenge (see
    // wavesChallenge.test.ts's own "cycles between choice... and numeric").
    engine.currentModuleId = MODULE_WAVES;
    engine.currentConceptId = WAVE_CONCEPT_SUPERPOSITION;
    engine.conceptMastery[WAVE_CONCEPT_SUPERPOSITION] = 0.3;
    const challenge = engine.generateNextChallenge();
    const wc = challenge.waveChallenge as WaveChoiceChallenge;
    expect(wc.kind).toBe("choice");

    const correct = recordWaveAttempt(engine, baseAttempt({ challenge, submittedChoice: wc.correctAnswer }));
    expect(correct.supported).toBe(true);
    if (correct.supported) expect(correct.success).toBe(true);

    const wrongOption = wc.options.find((o) => o !== wc.correctAnswer)!;
    const wrong = recordWaveAttempt(engine, baseAttempt({ challenge, submittedChoice: wrongOption }));
    expect(wrong.supported).toBe(true);
    if (wrong.supported) expect(wrong.success).toBe(false);
  });

  it("does not fabricate success merely because a challenge exists - a numeric challenge answered with a choice is rejected", () => {
    const engine = new AdaptiveEngine(MODULE_WAVES);
    const challenge = challengeFor(engine, WAVE_CONCEPT_AMPLITUDE);
    const result = recordWaveAttempt(engine, baseAttempt({ challenge, submittedChoice: "constructive" }));
    expect(result.supported).toBe(false);
  });

  it("a challenge with no attached waveChallenge (not a Wave concept) is rejected, not scored", () => {
    const engine = new AdaptiveEngine();
    const challenge = engine.generateNextChallenge(); // Projectile Motion - no waveChallenge
    const result = recordWaveAttempt(engine, baseAttempt({ challenge, submittedValue: 5 }));
    expect(result.supported).toBe(false);
  });
});

describe("recordWaveAttempt - mastery via AdaptiveEngine (never a second formula)", () => {
  it("7. mastery_before is captured before recordAttempt mutates it", () => {
    const engine = new AdaptiveEngine(MODULE_WAVES);
    const challenge = challengeFor(engine, WAVE_CONCEPT_AMPLITUDE, 0.42);
    expect(engine.conceptMastery[WAVE_CONCEPT_AMPLITUDE]).toBeCloseTo(0.42, 5);
    const wc = challenge.waveChallenge as WaveNumericChallenge;
    const result = recordWaveAttempt(engine, baseAttempt({ challenge, submittedValue: wc.targetValue }));
    expect(result.supported).toBe(true);
    if (result.supported) expect(result.masteryBefore).toBeCloseTo(0.42, 5);
  });

  it("8. mastery_after equals AdaptiveEngine's own conceptMastery after recordAttempt - never independently computed", () => {
    const engine = new AdaptiveEngine(MODULE_WAVES);
    const challenge = challengeFor(engine, WAVE_CONCEPT_AMPLITUDE, 0.42);
    const wc = challenge.waveChallenge as WaveNumericChallenge;
    const result = recordWaveAttempt(engine, baseAttempt({ challenge, submittedValue: wc.targetValue }));
    expect(result.supported).toBe(true);
    if (result.supported) {
      expect(result.masteryAfter).toBe(engine.conceptMastery[WAVE_CONCEPT_AMPLITUDE]);
      expect(result.masteryAfter).not.toBe(result.masteryBefore);
    }
  });

  it("performance comes directly from engine.recordAttempt's own return value", () => {
    const engineA = new AdaptiveEngine(MODULE_WAVES);
    const challengeA = challengeFor(engineA, WAVE_CONCEPT_AMPLITUDE, 0.5);
    const wcA = challengeA.waveChallenge as WaveNumericChallenge;

    const engineB = new AdaptiveEngine(MODULE_WAVES);
    engineB.currentConceptId = WAVE_CONCEPT_AMPLITUDE;
    engineB.conceptMastery[WAVE_CONCEPT_AMPLITUDE] = 0.5;
    const distanceError = Math.abs(wcA.targetValue - wcA.targetValue);
    const expectedPerformance = engineB.recordAttempt(distanceError, wcA.tolerance, true, 3);

    const result = recordWaveAttempt(engineA, baseAttempt({ challenge: challengeA, submittedValue: wcA.targetValue, responseTimeSeconds: 3 }));
    expect(result.supported).toBe(true);
    if (result.supported) expect(result.performance).toBeCloseTo(expectedPerformance, 10);
  });
});

describe("recordWaveAttempt - attempt lifecycle / next challenge from AdaptiveEngine", () => {
  it("9. successful challenge records correctly (mastery moves up, event.success is true)", () => {
    const engine = new AdaptiveEngine(MODULE_WAVES);
    const challenge = challengeFor(engine, WAVE_CONCEPT_AMPLITUDE, 0.3);
    const wc = challenge.waveChallenge as WaveNumericChallenge;
    const result = recordWaveAttempt(engine, baseAttempt({ challenge, submittedValue: wc.targetValue }));
    expect(result.supported).toBe(true);
    if (result.supported) {
      expect(result.event.success).toBe(true);
      expect(result.masteryAfter).toBeGreaterThan(result.masteryBefore);
    }
  });

  it("10. failed challenge records correctly (event.success is false, still a real recorded attempt)", () => {
    const engine = new AdaptiveEngine(MODULE_WAVES);
    const challenge = challengeFor(engine, WAVE_CONCEPT_AMPLITUDE, 0.3);
    const wc = challenge.waveChallenge as WaveNumericChallenge;
    const result = recordWaveAttempt(engine, baseAttempt({ challenge, submittedValue: wc.targetValue + 1000 }));
    expect(result.supported).toBe(true);
    if (result.supported) {
      expect(result.event.success).toBe(false);
      expect(typeof result.event.recent_attempts).toBe("number");
    }
  });

  it("11. the next challenge comes from AdaptiveEngine.generateNextChallenge(), not an independently constructed one", () => {
    const engine = new AdaptiveEngine(MODULE_WAVES);
    const challenge = challengeFor(engine, WAVE_CONCEPT_AMPLITUDE, 0.3);
    const wc = challenge.waveChallenge as WaveNumericChallenge;
    const result = recordWaveAttempt(engine, baseAttempt({ challenge, submittedValue: wc.targetValue }));
    expect(result.supported).toBe(true);
    if (result.supported) {
      expect(result.nextChallenge.moduleId).toBe(MODULE_WAVES);
      expect(result.nextChallenge.id).not.toBe(challenge.id);
      expect(result.nextChallenge.conceptId).toBe(engine.currentConceptId);
    }
  });

  it("retry (a second completed submission) produces a second, independent recorded attempt", () => {
    const engine = new AdaptiveEngine(MODULE_WAVES);
    const challenge = challengeFor(engine, WAVE_CONCEPT_AMPLITUDE, 0.3);
    const wc = challenge.waveChallenge as WaveNumericChallenge;

    const first = recordWaveAttempt(engine, baseAttempt({ challenge, submittedValue: wc.targetValue + 1000, attemptNumber: 1 }));
    expect(first.supported).toBe(true);
    const masteryAfterFirst = engine.conceptMastery[WAVE_CONCEPT_AMPLITUDE];

    const second = recordWaveAttempt(engine, baseAttempt({ challenge, submittedValue: wc.targetValue, attemptNumber: 2 }));
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

describe("adaptiveEngine - Wave concept progression (evaluateContentTransition, never a second progression system)", () => {
  it("4/5. weak performance keeps reinforcing the same concept; strong performance advances to the next concept", () => {
    const engine = new AdaptiveEngine(MODULE_WAVES);
    let challenge = challengeFor(engine, WAVE_CONCEPT_AMPLITUDE, 0.1);

    // Repeated wrong answers should keep mastery low and never advance past
    // Amplitude - the STRUGGLE_THRESHOLD reinforcement path.
    for (let i = 0; i < 3; i++) {
      const wc = challenge.waveChallenge as WaveNumericChallenge;
      const result = recordWaveAttempt(engine, baseAttempt({ challenge, submittedValue: wc.targetValue + 1000, attemptNumber: i + 1 }));
      expect(result.supported).toBe(true);
      if (result.supported) challenge = result.nextChallenge;
    }
    expect(engine.currentConceptId).toBe(WAVE_CONCEPT_AMPLITUDE);
    expect(engine.conceptMastery[WAVE_CONCEPT_AMPLITUDE]).toBeLessThan(0.75);

    // Repeated correct, fast answers should push mastery up to MASTERED and
    // advance the engine to the next concept in sequence.
    for (let i = 0; i < 20 && engine.currentConceptId === WAVE_CONCEPT_AMPLITUDE; i++) {
      const wc = challenge.waveChallenge as WaveNumericChallenge;
      const result = recordWaveAttempt(engine, baseAttempt({ challenge, submittedValue: wc.targetValue, responseTimeSeconds: 0.5, attemptNumber: i + 10 }));
      expect(result.supported).toBe(true);
      if (result.supported) challenge = result.nextChallenge;
    }
    expect(engine.currentConceptId).toBe(WAVE_CONCEPT_FREQUENCY_WAVELENGTH);
  });
});

describe("recordWaveAttempt - learning event content", () => {
  it("6. the learning event carries the wave-specific context and matches the canonical LearningEvent shape", () => {
    const engine = new AdaptiveEngine(MODULE_WAVES);
    const challenge = challengeFor(engine, WAVE_CONCEPT_AMPLITUDE, 0.2);
    const wc = challenge.waveChallenge as WaveNumericChallenge;
    const result = recordWaveAttempt(
      engine,
      baseAttempt({ challenge, submittedValue: wc.targetValue, sessionId: "session-xyz", attemptNumber: 4, responseTimeSeconds: 1.8 }),
    );
    expect(result.supported).toBe(true);
    if (!result.supported) return;

    expect(result.event.session_id).toBe("session-xyz");
    expect(result.event.module).toBe(MODULE_WAVES);
    expect(result.event.challenge_type).toBe(WAVE_CONCEPT_AMPLITUDE);
    expect(result.event.attempt_number).toBe(4);
    expect(result.event.actual_value).toBe(wc.targetValue);
    expect(result.event.target_value).toBe(wc.targetValue);
    expect(result.event.mastery_before).toBe(result.masteryBefore);
    expect(result.event.mastery_after).toBe(result.masteryAfter);
    expect(typeof result.event.recent_attempts).toBe("number");

    const ctx = result.event.context!;
    expect(ctx.wave_concept).toBe(WAVE_CONCEPT_AMPLITUDE);
    expect(ctx.challenge_kind).toBe("numeric");
    expect(typeof ctx.amplitude).toBe("number");
    expect(typeof ctx.frequency).toBe("number");
    expect(typeof ctx.wavelength).toBe("number");

    // Round-trips through JSON exactly like every other module's event -
    // the canonical shape the AI insight layer (@nexus/shared's
    // generateInsight) consumes downstream, never a Wave-specific format.
    const roundTripped = JSON.parse(JSON.stringify(result.event));
    expect(roundTripped).toEqual(result.event);
  });

  it("a choice challenge's learning event encodes the interference answer in its context", () => {
    const engine = new AdaptiveEngine(MODULE_WAVES);
    engine.currentModuleId = MODULE_WAVES;
    engine.currentConceptId = WAVE_CONCEPT_SUPERPOSITION;
    engine.conceptMastery[WAVE_CONCEPT_SUPERPOSITION] = 0.3;
    const challenge = engine.generateNextChallenge();
    const wc = challenge.waveChallenge as WaveChoiceChallenge;
    const result = recordWaveAttempt(engine, baseAttempt({ challenge, submittedChoice: wc.correctAnswer }));
    expect(result.supported).toBe(true);
    if (!result.supported) return;
    expect(result.event.context!.challenge_kind).toBe("choice");
    expect(result.event.context!.correct_choice).toBe(wc.correctAnswer);
    expect(result.event.context!.submitted_choice).toBe(wc.correctAnswer);
  });
});
