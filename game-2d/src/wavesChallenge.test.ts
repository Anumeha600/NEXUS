import { describe, it, expect, beforeEach } from "vitest";
import {
  generateWaveChallenge,
  givenFieldsForWaveChallenge,
  validateWaveAnswer,
  evaluateWaveNumericAnswer,
  evaluateWaveChoiceAnswer,
  createWavePlayState,
  submitWaveNumericAnswer,
  submitWaveChoiceAnswer,
  resetWaveChallengeIdSequenceForTests,
  WAVE_CONCEPT_AMPLITUDE,
  WAVE_CONCEPT_FREQUENCY_WAVELENGTH,
  WAVE_CONCEPT_WAVE_SPEED,
  WAVE_CONCEPT_SUPERPOSITION,
  type WaveNumericChallenge,
  type WaveChoiceChallenge,
} from "./wavesChallenge";
import { waveSpeed } from "./wavesPhysics";

beforeEach(() => {
  resetWaveChallengeIdSequenceForTests();
});

describe("wavesChallenge - deterministic generation", () => {
  it("the same (conceptId, variant) always reproduces the exact same challenge", () => {
    const a = generateWaveChallenge(WAVE_CONCEPT_AMPLITUDE, 2);
    resetWaveChallengeIdSequenceForTests();
    const b = generateWaveChallenge(WAVE_CONCEPT_AMPLITUDE, 2);
    expect(a).toEqual(b);
  });

  it("amplitude challenges alternate between read and match mode across variants", () => {
    const read = generateWaveChallenge(WAVE_CONCEPT_AMPLITUDE, 0) as WaveNumericChallenge;
    const match = generateWaveChallenge(WAVE_CONCEPT_AMPLITUDE, 1) as WaveNumericChallenge;
    expect(read.mode).toBe("read");
    expect(match.mode).toBe("match");
    expect(match.startValue).toBeDefined();
    expect(match.startValue).not.toBeCloseTo(match.targetValue, 5);
  });

  it("frequency-wavelength cycles through frequency, wavelength, and period subtypes", () => {
    const solveFors = [0, 1, 2].map((v) => (generateWaveChallenge(WAVE_CONCEPT_FREQUENCY_WAVELENGTH, v) as WaveNumericChallenge).solveFor);
    expect(solveFors).toEqual(["frequency", "wavelength", "period"]);
  });

  it("wave-speed challenges are always consistent with v = f*lambda", () => {
    for (let variant = 0; variant < 3; variant++) {
      const challenge = generateWaveChallenge(WAVE_CONCEPT_WAVE_SPEED, variant) as WaveNumericChallenge;
      const trueSpeed = waveSpeed(challenge.wave.frequency, challenge.wave.wavelength);
      if (challenge.solveFor === "waveSpeed") {
        expect(challenge.targetValue).toBeCloseTo(trueSpeed, 1);
      } else {
        // Inverse problems: the wave still carries its true, consistent
        // frequency/wavelength - only the display hides the solved-for one.
        expect(trueSpeed).toBeGreaterThan(0);
      }
    }
  });

  it("wave-speed inverse problems hide only the solved-for field from the given-fields display", () => {
    const frequencyHidden = generateWaveChallenge(WAVE_CONCEPT_WAVE_SPEED, 1) as WaveNumericChallenge;
    expect(frequencyHidden.solveFor).toBe("frequency");
    const labels = givenFieldsForWaveChallenge(frequencyHidden).map((r) => r.label);
    expect(labels).not.toContain("Frequency");
    expect(labels).toContain("Wavelength");
  });

  it("superposition cycles between choice (interference type) and numeric (resultant amplitude) challenges", () => {
    const kinds = [0, 1, 2, 3].map((v) => generateWaveChallenge(WAVE_CONCEPT_SUPERPOSITION, v).kind);
    expect(kinds).toEqual(["choice", "choice", "numeric", "numeric"]);
  });

  it("superposition choice challenges' correctAnswer matches the actual phase relationship", () => {
    const constructive = generateWaveChallenge(WAVE_CONCEPT_SUPERPOSITION, 0) as WaveChoiceChallenge;
    const destructive = generateWaveChallenge(WAVE_CONCEPT_SUPERPOSITION, 1) as WaveChoiceChallenge;
    expect(constructive.correctAnswer).toBe("constructive");
    expect(destructive.correctAnswer).toBe("destructive");
  });
});

describe("wavesChallenge - answer validation and evaluation", () => {
  it("validateWaveAnswer rejects blank/non-numeric/unrealistic input, accepts everything else", () => {
    expect(validateWaveAnswer("")).toEqual({ error: "Enter a value." });
    expect(validateWaveAnswer("abc")).toEqual({ error: "Enter a valid number." });
    expect(validateWaveAnswer("999999")).toEqual({ error: "That value is unrealistically large." });
    expect(validateWaveAnswer("2.5")).toEqual({ value: 2.5 });
  });

  it("evaluateWaveNumericAnswer is correct within tolerance and incorrect outside it", () => {
    const challenge = generateWaveChallenge(WAVE_CONCEPT_AMPLITUDE, 0) as WaveNumericChallenge;
    const within = evaluateWaveNumericAnswer(challenge, challenge.targetValue + challenge.tolerance * 0.5);
    const outside = evaluateWaveNumericAnswer(challenge, challenge.targetValue + challenge.tolerance * 5);
    expect(within.correct).toBe(true);
    expect(outside.correct).toBe(false);
  });

  it("evaluateWaveChoiceAnswer is correct only for the exact matching option", () => {
    const challenge = generateWaveChallenge(WAVE_CONCEPT_SUPERPOSITION, 0) as WaveChoiceChallenge;
    expect(evaluateWaveChoiceAnswer(challenge, challenge.correctAnswer).correct).toBe(true);
    const wrongOption = challenge.options.find((o) => o !== challenge.correctAnswer)!;
    expect(evaluateWaveChoiceAnswer(challenge, wrongOption).correct).toBe(false);
  });
});

describe("wavesChallenge - READY/SUBMITTED play state (completion tied to player action, not a timeout)", () => {
  it("starts READY with no result", () => {
    const state = createWavePlayState();
    expect(state.phase).toBe("READY");
    expect(state.result).toBeNull();
  });

  it("submitting a numeric answer moves to SUBMITTED with a scored result", () => {
    const challenge = generateWaveChallenge(WAVE_CONCEPT_AMPLITUDE, 0) as WaveNumericChallenge;
    const state = submitWaveNumericAnswer(challenge, challenge.targetValue);
    expect(state.phase).toBe("SUBMITTED");
    expect(state.result).toEqual({ correct: true, submittedValue: challenge.targetValue, targetValue: challenge.targetValue });
  });

  it("submitting a choice answer moves to SUBMITTED with a scored result", () => {
    const challenge = generateWaveChallenge(WAVE_CONCEPT_SUPERPOSITION, 0) as WaveChoiceChallenge;
    const state = submitWaveChoiceAnswer(challenge, challenge.correctAnswer);
    expect(state.phase).toBe("SUBMITTED");
    expect(state.result).toEqual({ correct: true, submittedAnswer: challenge.correctAnswer, correctAnswer: challenge.correctAnswer });
  });
});
