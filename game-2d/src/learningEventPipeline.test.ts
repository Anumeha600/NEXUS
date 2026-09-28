import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { recordLearningEvent } from "./learningEventPipeline";
import { readSessionHistory, appendSessionAttempt, newSessionAttemptId, updateSessionAttemptInsight, parseInsightResponse, type LearningEvent, type SessionAttempt } from "@nexus/shared";
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

// A realistic, valid /api/insight response body - the shape
// generateInsight()/validateInsightShape in shared/src/insight.ts actually
// produce (headline/explanation/suggestion/concept/confidence/source).
function sampleInsightPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    headline: "Right on target",
    explanation: "Your result matched the target.",
    suggestion: "Try the next challenge.",
    concept: "Orbital Velocity",
    confidence: "high",
    source: "ai",
    ...overrides,
  };
}

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

describe("Phase 5A - sessionHistory's shared insight-persistence primitives", () => {
  it("newSessionAttemptId produces distinct ids across calls", () => {
    const ids = new Set(Array.from({ length: 20 }, () => newSessionAttemptId()));
    expect(ids.size).toBe(20);
  });

  it("parseInsightResponse accepts a well-shaped payload and strips the unused `concept` field", () => {
    const parsed = parseInsightResponse(sampleInsightPayload());
    expect(parsed).toEqual({
      headline: "Right on target",
      explanation: "Your result matched the target.",
      suggestion: "Try the next challenge.",
      confidence: "high",
      source: "ai",
    });
    expect(parsed && "concept" in parsed).toBe(false);
  });

  it.each([
    ["not an object", "nope"],
    ["null", null],
    ["missing headline", sampleInsightPayload({ headline: undefined })],
    ["invalid confidence", sampleInsightPayload({ confidence: "extremely" })],
    ["invalid source", sampleInsightPayload({ source: "groq-direct" })],
  ])("parseInsightResponse rejects %s", (_label, input) => {
    expect(parseInsightResponse(input)).toBeNull();
  });

  it("updateSessionAttemptInsight patches only the entry with the matching id, leaving others untouched", async () => {
    await recordLearningEvent(sampleEvent()); // entry 1
    await recordLearningEvent(sampleEvent({ concept: "Escape Velocity" })); // entry 2
    const [first, second] = readSessionHistory();
    expect(first.id).toBeDefined();
    expect(second.id).toBeDefined();
    expect(first.id).not.toBe(second.id);

    updateSessionAttemptInsight(second.id!, { headline: "h", explanation: "e", suggestion: "s", confidence: "medium", source: "ai" });
    const after = readSessionHistory();
    expect(after[0].insight).toBeUndefined();
    expect(after[1].insight).toEqual({ headline: "h", explanation: "e", suggestion: "s", confidence: "medium", source: "ai" });
    expect(after.length).toBe(2); // never appends a new entry
  });

  it("updateSessionAttemptInsight with an unknown id is a silent no-op - never throws, never appends", async () => {
    await recordLearningEvent(sampleEvent());
    expect(() => updateSessionAttemptInsight("not-a-real-id", { headline: "h", explanation: "e", suggestion: "s", confidence: "high", source: "ai" })).not.toThrow();
    const history = readSessionHistory();
    expect(history.length).toBe(1);
    expect(history[0].insight).toBeUndefined();
  });

  // 8. The 5 core modules (GameCanvas.tsx/PlayExperience.tsx) can't be
  // rendered in this repo's test harness (no DOM/component runner - see
  // this project's established convention), but they use the exact SAME
  // two-step primitives learningEventPipeline.ts's own recordLearningEvent
  // does internally: PlayExperience.tsx's handleResult calls
  // appendSessionAttempt with `id: event.attemptId`, and GameCanvas.tsx's
  // requestAiInsight later calls updateSessionAttemptInsight with that SAME
  // id once its response resolves (see both files' own comments). This
  // reproduces that exact sequence directly against the shared primitives,
  // proving the 5-core path's own mechanism is unaffected by Phase 5A.
  it("8. the 5-core GameCanvas/PlayExperience flow (append with attemptId, later patch by the same id) persists the insight correctly", () => {
    const attemptId = newSessionAttemptId();
    const entry: SessionAttempt = {
      id: attemptId,
      timestamp: Date.now(),
      module: "projectile_motion",
      concept: "Speed & Range",
      success: true,
      performance: 0.9,
      masteryBefore: 0.3,
      masteryAfter: 0.4,
      difficulty: "Beginner",
    };
    appendSessionAttempt(entry); // PlayExperience.tsx's handleResult
    expect(readSessionHistory().length).toBe(1);
    expect(readSessionHistory()[0].insight).toBeUndefined();

    // GameCanvas.tsx's requestAiInsight, once its /api/insight fetch resolves.
    const insight = parseInsightResponse(sampleInsightPayload({ headline: "Projectile insight" }));
    expect(insight).not.toBeNull();
    if (insight) updateSessionAttemptInsight(attemptId, insight);

    const history = readSessionHistory();
    expect(history.length).toBe(1); // still exactly one entry, never a second
    expect(history[0].module).toBe("projectile_motion");
    expect(history[0].insight?.headline).toBe("Projectile insight");
  });
});

describe("Phase 5A - 1/2/3/6/7. a successful AI response is persisted onto the correct SessionAttempt, never a duplicate", () => {
  it("1/2. a successful AI response is stored in SessionAttempt.insight, on the same attempt that produced it", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => sampleInsightPayload({ headline: "Nice work" }) });
    await recordLearningEvent(sampleEvent());
    const [entry] = readSessionHistory();
    expect(entry.insight).toEqual({
      headline: "Nice work",
      explanation: "Your result matched the target.",
      suggestion: "Try the next challenge.",
      confidence: "high",
      source: "ai",
    });
  });

  it("3. two attempts each receive their own corresponding insight, never swapped or merged", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => sampleInsightPayload({ headline: "First insight" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => sampleInsightPayload({ headline: "Second insight" }) });

    await recordLearningEvent(sampleEvent({ concept: "Orbital Velocity" }));
    await recordLearningEvent(sampleEvent({ concept: "Escape Velocity" }));

    const history = readSessionHistory();
    expect(history.length).toBe(2);
    const orbital = history.find((a) => a.concept === "Orbital Velocity");
    const escape = history.find((a) => a.concept === "Escape Velocity");
    expect(orbital?.insight?.headline).toBe("First insight");
    expect(escape?.insight?.headline).toBe("Second insight");
  });

  it("6/7. no duplicate SessionAttempt or LearningEvent is created by receiving the AI response", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => sampleInsightPayload() });
    await recordLearningEvent(sampleEvent());
    expect(readSessionHistory().length).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1); // one LearningEvent -> one /api/insight call, never two
  });

  it("4. an AI failure (network error) never prevents the SessionAttempt from being stored - it exists with insight left unset", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    await recordLearningEvent(sampleEvent());
    const history = readSessionHistory();
    expect(history.length).toBe(1);
    expect(history[0].insight).toBeUndefined();
  });

  it("4b. a malformed AI response never prevents the SessionAttempt from being stored, and is never persisted as an insight", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ nonsense: true }) });
    await recordLearningEvent(sampleEvent());
    const history = readSessionHistory();
    expect(history.length).toBe(1);
    expect(history[0].insight).toBeUndefined();
  });

  it("5. an AI failure never throws out of recordLearningEvent - gameplay is never blocked on it", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    await expect(recordLearningEvent(sampleEvent())).resolves.toBeUndefined();
  });
});

describe("A. Gravitation attempt -> LearningEvent -> session history -> AI insight", () => {
  it("9. a submitted Gravitation attempt is recorded through the shared pipeline, and a successful AI response is persisted onto it", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => sampleInsightPayload({ headline: "Gravitation insight" }) });
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
    expect(history[0].insight?.headline).toBe("Gravitation insight");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(result.event);
  });
});

describe("B. Wave attempt -> LearningEvent -> session history -> AI insight", () => {
  it("10. a submitted Wave Motion attempt is recorded through the shared pipeline, and a successful AI response is persisted onto it", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => sampleInsightPayload({ headline: "Wave insight" }) });
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
    expect(history[0].insight?.headline).toBe("Wave insight");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("C. Archimedes attempt -> LearningEvent -> session history -> AI insight", () => {
  it("11. a submitted Archimedes attempt is recorded through the shared pipeline, and a successful AI response is persisted onto it", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => sampleInsightPayload({ headline: "Archimedes insight" }) });
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
    expect(history[0].insight?.headline).toBe("Archimedes insight");
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
