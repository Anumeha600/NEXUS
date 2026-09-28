import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { recordLearningEvent } from "./learningEventPipeline";
import { readSessionHistory, type LearningEvent } from "@nexus/shared";
import { AdaptiveEngine, MODULE_GRAVITATION, MODULE_WAVES, MODULE_ARCHIMEDES } from "./adaptiveEngine";
import { gravitationSimSetupFor } from "./gravitationChallenge";
import { recordGravitationAttempt } from "./gravitationLearning";
import { WAVE_CONCEPT_AMPLITUDE, type WaveNumericChallenge } from "./wavesChallenge";
import { recordWaveAttempt } from "./wavesLearning";
import { recordArchimedesAttempt } from "./archimedesLearning";
import type { ArchimedesNumericChallenge } from "./archimedesChallenge";

// A minimal, in-memory localStorage - stubbed fresh in beforeEach so every
// test starts with genuinely empty session history, exactly like a fresh
// browser session, without needing to import/call clearSessionHistory.
function makeFakeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubGlobal("window", { localStorage: makeFakeLocalStorage() });
  fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function sampleEvent(overrides: Partial<LearningEvent> = {}): LearningEvent {
  return {
    session_id: "s1",
    module: "gravitation_orbits",
    concept: "Orbital Velocity",
    challenge_type: "orbital_velocity",
    difficulty: "Beginner",
    target_value: 5,
    actual_value: 5,
    unit: "m/s",
    success: true,
    performance: 0.9,
    mastery_before: 0.3,
    mastery_after: 0.4,
    attempt_number: 1,
    recent_attempts: 1,
    context: { foo: "bar" },
    ...overrides,
  };
}

describe("recordLearningEvent - generic pipeline behavior", () => {
  it("G. one call produces exactly one stored session-history event", async () => {
    await recordLearningEvent(sampleEvent());
    expect(readSessionHistory().length).toBe(1);
  });

  it("stored entry maps the canonical LearningEvent fields exactly (module/concept/success/performance/mastery/difficulty)", async () => {
    const event = sampleEvent({
      module: "wave_motion",
      concept: "Amplitude",
      success: false,
      performance: 0.2,
      mastery_before: 0.5,
      mastery_after: 0.45,
      difficulty: "Advanced",
    });
    await recordLearningEvent(event);
    const [entry] = readSessionHistory();
    expect(entry.module).toBe("wave_motion");
    expect(entry.concept).toBe("Amplitude");
    expect(entry.success).toBe(false);
    expect(entry.performance).toBe(0.2);
    expect(entry.masteryBefore).toBe(0.5);
    expect(entry.masteryAfter).toBe(0.45);
    expect(entry.difficulty).toBe("Advanced");
  });

  it("D. invokes the existing POST /api/insight pathway with the finalized event as its body - never a second endpoint", async () => {
    const event = sampleEvent();
    await recordLearningEvent(event);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/insight");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual(event);
  });

  it("the AI request itself never appends a second history entry", async () => {
    await recordLearningEvent(sampleEvent());
    expect(readSessionHistory().length).toBe(1);
  });

  it("E. a network failure calling /api/insight never throws - gameplay must not fail because insight generation fails", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    await expect(recordLearningEvent(sampleEvent())).resolves.toBeUndefined();
    // Session history is still recorded even though the network call failed.
    expect(readSessionHistory().length).toBe(1);
  });

  it("E. a non-ok response from /api/insight never throws either", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "boom" }) });
    await expect(recordLearningEvent(sampleEvent())).resolves.toBeUndefined();
  });

  it("F. a session-history storage failure never throws - appendSessionAttempt's own internal guard is trusted, not re-implemented here", async () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("storage blocked");
        },
        setItem: () => {
          throw new Error("storage blocked");
        },
        removeItem: () => {},
      },
    });
    await expect(recordLearningEvent(sampleEvent())).resolves.toBeUndefined();
    // The AI insight call still fires even though storage failed - the two
    // downstream consumers are independent of each other.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("H. the AI response is never read and cannot influence mastery/difficulty/challenge state - recordLearningEvent has no engine parameter and returns nothing", async () => {
    const engine = new AdaptiveEngine(MODULE_GRAVITATION);
    const masteryBefore = { ...engine.conceptMastery };
    const conceptBefore = engine.currentConceptId;

    // An adversarial response body that looks like it could be trying to
    // smuggle mastery/difficulty overrides - recordLearningEvent never calls
    // response.json() at all, so this can never reach anything.
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ mastery_after: 0.99, difficulty: "Advanced", conceptId: "orbital_velocity" }),
    });

    const returned = await recordLearningEvent(sampleEvent());
    expect(returned).toBeUndefined();
    expect(engine.conceptMastery).toEqual(masteryBefore);
    expect(engine.currentConceptId).toBe(conceptBefore);
  });
});

describe("A. Gravitation attempt -> LearningEvent -> session history", () => {
  it("a submitted Gravitation attempt is recorded through the shared pipeline", async () => {
    const engine = new AdaptiveEngine(MODULE_GRAVITATION); // defaults to the first SCORED concept (Orbital Velocity)
    const challenge = engine.generateNextChallenge();
    const setup = gravitationSimSetupFor(challenge);
    const result = recordGravitationAttempt(engine, {
      challenge,
      setup,
      launchVelocity: setup.defaultInitialVelocity,
      outcomeStatus: "orbit",
      elapsedSimTime: 10,
      minRadius: setup.orbitalRadius * 0.9,
      maxRadius: setup.orbitalRadius * 1.1,
      responseTimeSeconds: 2,
      sessionId: "gravitation-session",
      attemptNumber: 1,
    });
    expect(result.supported).toBe(true);
    if (!result.supported) return;

    await recordLearningEvent(result.event);
    const history = readSessionHistory();
    expect(history.length).toBe(1);
    expect(history[0].module).toBe("gravitation_orbits");
    expect(history[0].masteryAfter).toBe(result.masteryAfter);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(result.event);
  });
});

describe("B. Wave attempt -> LearningEvent -> session history", () => {
  it("a submitted Wave Motion attempt is recorded through the shared pipeline", async () => {
    const engine = new AdaptiveEngine(MODULE_WAVES);
    engine.currentConceptId = WAVE_CONCEPT_AMPLITUDE;
    const challenge = engine.generateNextChallenge();
    const wc = challenge.waveChallenge as WaveNumericChallenge;
    const result = recordWaveAttempt(engine, {
      challenge,
      submittedValue: wc.targetValue,
      responseTimeSeconds: 2,
      sessionId: "wave-session",
      attemptNumber: 1,
    });
    expect(result.supported).toBe(true);
    if (!result.supported) return;

    await recordLearningEvent(result.event);
    const history = readSessionHistory();
    expect(history.length).toBe(1);
    expect(history[0].module).toBe("wave_motion");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("C. Archimedes attempt -> LearningEvent -> session history", () => {
  it("a submitted Archimedes attempt is recorded through the shared pipeline", async () => {
    const engine = new AdaptiveEngine(MODULE_ARCHIMEDES); // defaults to Buoyant Force
    const challenge = engine.generateNextChallenge();
    const ac = challenge.archimedesChallenge as ArchimedesNumericChallenge;
    const result = recordArchimedesAttempt(engine, {
      challenge,
      archimedesChallenge: ac,
      submittedValue: ac.targetValue,
      responseTimeSeconds: 2,
      sessionId: "archimedes-session",
      attemptNumber: 1,
    });
    expect(result.supported).toBe(true);
    if (!result.supported) return;

    await recordLearningEvent(result.event);
    const history = readSessionHistory();
    expect(history.length).toBe(1);
    expect(history[0].module).toBe("archimedes_buoyancy");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("Session semantics - one submitted attempt never produces more than one stored event, across all 3 standalone modules", () => {
  it("three separate attempts (one per standalone module) produce exactly three history entries, never duplicated or overwritten", async () => {
    const gravEngine = new AdaptiveEngine(MODULE_GRAVITATION);
    const gravChallenge = gravEngine.generateNextChallenge();
    const gravSetup = gravitationSimSetupFor(gravChallenge);
    const gravResult = recordGravitationAttempt(gravEngine, {
      challenge: gravChallenge,
      setup: gravSetup,
      launchVelocity: gravSetup.defaultInitialVelocity,
      outcomeStatus: "orbit",
      elapsedSimTime: 10,
      minRadius: gravSetup.orbitalRadius * 0.9,
      maxRadius: gravSetup.orbitalRadius * 1.1,
      responseTimeSeconds: 2,
      sessionId: "s-grav",
      attemptNumber: 1,
    });

    const waveEngine = new AdaptiveEngine(MODULE_WAVES);
    waveEngine.currentConceptId = WAVE_CONCEPT_AMPLITUDE;
    const waveChallenge = waveEngine.generateNextChallenge();
    const wc = waveChallenge.waveChallenge as WaveNumericChallenge;
    const waveResult = recordWaveAttempt(waveEngine, {
      challenge: waveChallenge,
      submittedValue: wc.targetValue,
      responseTimeSeconds: 2,
      sessionId: "s-wave",
      attemptNumber: 1,
    });

    const archEngine = new AdaptiveEngine(MODULE_ARCHIMEDES);
    const archChallenge = archEngine.generateNextChallenge();
    const ac = archChallenge.archimedesChallenge as ArchimedesNumericChallenge;
    const archResult = recordArchimedesAttempt(archEngine, {
      challenge: archChallenge,
      archimedesChallenge: ac,
      submittedValue: ac.targetValue,
      responseTimeSeconds: 2,
      sessionId: "s-arch",
      attemptNumber: 1,
    });

    expect(gravResult.supported && waveResult.supported && archResult.supported).toBe(true);
    if (!gravResult.supported || !waveResult.supported || !archResult.supported) return;

    await recordLearningEvent(gravResult.event);
    await recordLearningEvent(waveResult.event);
    await recordLearningEvent(archResult.event);

    const history = readSessionHistory();
    expect(history.length).toBe(3);
    expect(history.map((h) => h.module)).toEqual(["gravitation_orbits", "wave_motion", "archimedes_buoyancy"]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
