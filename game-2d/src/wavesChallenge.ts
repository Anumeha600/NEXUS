// --------------------------------------------------------------------------
// Wave Motion - challenge model, Phase 1.
//
// Deliberately self-contained: unlike gravitationChallenge.ts, this does NOT
// read from or generate an adaptiveEngine.ts Challenge - the brief for this
// phase is explicit that AdaptiveEngine wiring is Phase 2. Every challenge
// here is a plain, deterministic WaveChallenge produced by
// generateWaveChallenge(conceptId, variant) - same variant always produces
// the same challenge, so the whole flow (generate -> answer -> evaluate) is
// unit-testable with no mocking.
//
// Completion is never a timeout: a challenge only resolves when the player
// submits a value (numeric challenges) or picks an option (choice
// challenges), which evaluateWaveChallenge then scores against the
// challenge's own fixed target - mirroring challengeLogic.ts's
// validateInput()/targetValueOf() split for the six live modules.
// --------------------------------------------------------------------------

import { wavePeriod, waveSpeed, classifyInterference, resultantAmplitude, type WaveParams, type InterferenceType } from "./wavesPhysics";

export const WAVE_CONCEPT_AMPLITUDE = "amplitude" as const;
// These string values match @nexus/shared's curriculum.ts concept ids for
// the "waves" module exactly (same convention as adaptiveEngine.ts's own
// CONCEPT_* constants - see that file's STABLE MODULE IDS note) - Phase 2
// wires these same values into AdaptiveEngine's own CONCEPT_SEQUENCE, so the
// curriculum id and the AdaptiveEngine concept id are the same string.
export const WAVE_CONCEPT_FREQUENCY_WAVELENGTH = "frequency_wavelength" as const;
export const WAVE_CONCEPT_WAVE_SPEED = "wave_speed" as const;
export const WAVE_CONCEPT_SUPERPOSITION = "superposition" as const;

export type WaveConceptId =
  | typeof WAVE_CONCEPT_AMPLITUDE
  | typeof WAVE_CONCEPT_FREQUENCY_WAVELENGTH
  | typeof WAVE_CONCEPT_WAVE_SPEED
  | typeof WAVE_CONCEPT_SUPERPOSITION;

export const WAVE_CONCEPTS: readonly { id: WaveConceptId; title: string }[] = [
  { id: WAVE_CONCEPT_AMPLITUDE, title: "Amplitude & Wave Properties" },
  { id: WAVE_CONCEPT_FREQUENCY_WAVELENGTH, title: "Frequency & Wavelength" },
  { id: WAVE_CONCEPT_WAVE_SPEED, title: "Wave Speed" },
  { id: WAVE_CONCEPT_SUPERPOSITION, title: "Superposition & Interference" },
];

export type WaveSolveTarget = "amplitude" | "frequency" | "wavelength" | "period" | "waveSpeed" | "resultantAmplitude";

// "read": the wave is already fully drawn on screen and the player types the
// value they read off it. "match": the player adjusts the corresponding live
// control (amplitude/frequency/wavelength slider) until it equals the
// target, then submits their current control value.
export type WaveChallengeMode = "read" | "match";

export interface WaveNumericChallenge {
  readonly kind: "numeric";
  readonly id: number;
  readonly conceptId: WaveConceptId;
  readonly conceptTitle: string;
  readonly prompt: string;
  readonly unit: string;
  readonly mode: WaveChallengeMode;
  readonly solveFor: WaveSolveTarget;
  // The wave the player sees driving the main scene. For "read" challenges,
  // solveFor's own field is fully present here (it's what's being read off
  // the visible wave) unless this is a wave-speed inverse problem, where the
  // hidden field is intentionally absent so the player must derive it - see
  // givenFieldsForWaveChallenge below.
  readonly wave: WaveParams;
  readonly wave2?: WaveParams;
  readonly targetValue: number;
  readonly tolerance: number;
  // Only meaningful when mode is "match": the control's starting value,
  // deliberately away from targetValue so the player has to actually move
  // it (rather than the challenge starting pre-solved). Unused in "read"
  // mode, where wave already holds the true, fixed value being read off.
  readonly startValue?: number;
}

export interface WaveChoiceChallenge {
  readonly kind: "choice";
  readonly id: number;
  readonly conceptId: typeof WAVE_CONCEPT_SUPERPOSITION;
  readonly conceptTitle: string;
  readonly prompt: string;
  readonly solveFor: "interferenceType";
  readonly wave1: WaveParams;
  readonly wave2: WaveParams;
  readonly options: readonly InterferenceType[];
  readonly correctAnswer: InterferenceType;
}

export type WaveChallenge = WaveNumericChallenge | WaveChoiceChallenge;

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

// Small, deterministic per-variant scaling - no Math.random anywhere in this
// module (matching adaptiveEngine.ts's own fully-deterministic
// mastery-driven generation), so the exact same (conceptId, variant) pair
// always reproduces the exact same challenge.
function variantScale(variant: number): number {
  return 1 + (variant % 4) * 0.35;
}

let nextChallengeId = 1;

// --------------------------------------------------------------------------
// Amplitude & Wave Properties
// --------------------------------------------------------------------------

function generateAmplitudeChallenge(variant: number): WaveNumericChallenge {
  const scale = variantScale(variant);
  const wave: WaveParams = { amplitude: round2(1.2 * scale), frequency: 1, wavelength: 3, phase: 0 };
  const mode: WaveChallengeMode = variant % 2 === 0 ? "read" : "match";
  const prompt =
    mode === "read"
      ? "Read the amplitude directly from the wave shown - the maximum displacement from the equilibrium line."
      : `Adjust the amplitude control until the wave's peak displacement is ${wave.amplitude} m, then submit.`;
  // Deliberately below the target and clamped to a sane minimum, so a
  // "match" challenge never starts already-solved.
  const startValue = mode === "match" ? Math.max(0.2, round2(wave.amplitude * 0.4)) : undefined;
  return {
    kind: "numeric",
    id: nextChallengeId++,
    conceptId: WAVE_CONCEPT_AMPLITUDE,
    conceptTitle: "Amplitude & Wave Properties",
    prompt,
    unit: "m",
    mode,
    solveFor: "amplitude",
    wave,
    targetValue: wave.amplitude,
    tolerance: 0.1,
    startValue,
  };
}

// --------------------------------------------------------------------------
// Frequency & Wavelength
// --------------------------------------------------------------------------

function generateFrequencyWavelengthChallenge(variant: number): WaveNumericChallenge {
  const scale = variantScale(variant);
  const subtype = variant % 3;
  const wave: WaveParams = { amplitude: 1, frequency: round2(0.8 * scale), wavelength: round2(2.5 * scale), phase: 0 };

  if (subtype === 0) {
    return {
      kind: "numeric",
      id: nextChallengeId++,
      conceptId: WAVE_CONCEPT_FREQUENCY_WAVELENGTH,
      conceptTitle: "Frequency & Wavelength",
      prompt: "Watch the wave oscillate at a fixed point and determine its frequency, in Hz.",
      unit: "Hz",
      mode: "read",
      solveFor: "frequency",
      wave,
      targetValue: wave.frequency,
      tolerance: 0.1,
    };
  }
  if (subtype === 1) {
    return {
      kind: "numeric",
      id: nextChallengeId++,
      conceptId: WAVE_CONCEPT_FREQUENCY_WAVELENGTH,
      conceptTitle: "Frequency & Wavelength",
      prompt: "Measure the distance between two successive crests to determine the wavelength, in meters.",
      unit: "m",
      mode: "read",
      solveFor: "wavelength",
      wave,
      targetValue: wave.wavelength,
      tolerance: 0.15,
    };
  }
  return {
    kind: "numeric",
    id: nextChallengeId++,
    conceptId: WAVE_CONCEPT_FREQUENCY_WAVELENGTH,
    conceptTitle: "Frequency & Wavelength",
    prompt: "From the oscillation you observe, determine the period of this wave, in seconds.",
    unit: "s",
    mode: "read",
    solveFor: "period",
    wave,
    targetValue: round2(wavePeriod(wave.frequency)),
    tolerance: 0.1,
  };
}

// --------------------------------------------------------------------------
// Wave Speed
// --------------------------------------------------------------------------

function generateWaveSpeedChallenge(variant: number): WaveNumericChallenge {
  const scale = variantScale(variant);
  const subtype = variant % 3;
  const frequency = round2(1 * scale);
  const wavelength = round2(2 * scale);
  const wave: WaveParams = { amplitude: 1, frequency, wavelength, phase: 0 };
  const speed = round2(waveSpeed(frequency, wavelength));

  if (subtype === 0) {
    return {
      kind: "numeric",
      id: nextChallengeId++,
      conceptId: WAVE_CONCEPT_WAVE_SPEED,
      conceptTitle: "Wave Speed",
      prompt: `This wave has frequency ${frequency} Hz and wavelength ${wavelength} m. Using v = fλ, what is its wave speed, in m/s?`,
      unit: "m/s",
      mode: "read",
      solveFor: "waveSpeed",
      wave,
      targetValue: speed,
      tolerance: 0.2,
    };
  }
  if (subtype === 1) {
    // Inverse problem: frequency is hidden, the player must recover it from
    // the given speed and wavelength (f = v/lambda).
    return {
      kind: "numeric",
      id: nextChallengeId++,
      conceptId: WAVE_CONCEPT_WAVE_SPEED,
      conceptTitle: "Wave Speed",
      prompt: `This wave travels at ${speed} m/s with wavelength ${wavelength} m. What is its frequency, in Hz?`,
      unit: "Hz",
      mode: "read",
      solveFor: "frequency",
      // The wave still animates at its real (frequency, wavelength) - only
      // givenFieldsForWaveChallenge hides the frequency readout, since the
      // player must derive it from watching the actual animation, not from
      // a fabricated/NaN value.
      wave,
      targetValue: frequency,
      tolerance: 0.1,
    };
  }
  // Inverse problem: wavelength is hidden, the player must recover it from
  // the given speed and frequency (lambda = v/f).
  return {
    kind: "numeric",
    id: nextChallengeId++,
    conceptId: WAVE_CONCEPT_WAVE_SPEED,
    conceptTitle: "Wave Speed",
    prompt: `This wave travels at ${speed} m/s with frequency ${frequency} Hz. What is its wavelength, in meters?`,
    unit: "m",
    mode: "read",
    solveFor: "wavelength",
    wave,
    targetValue: wavelength,
    tolerance: 0.15,
  };
}

// --------------------------------------------------------------------------
// Superposition & Interference
// --------------------------------------------------------------------------

function generateSuperpositionChallenge(variant: number): WaveChallenge {
  const scale = variantScale(variant);
  const isConstructive = variant % 2 === 0;
  const amplitude1 = round2(1 * scale);
  const amplitude2 = round2(0.7 * scale);
  const wave1: WaveParams = { amplitude: amplitude1, frequency: 1, wavelength: 3, phase: 0 };
  const wave2: WaveParams = { amplitude: amplitude2, frequency: 1, wavelength: 3, phase: isConstructive ? 0 : Math.PI };

  const askResultantAmplitude = variant % 4 >= 2;
  if (askResultantAmplitude) {
    return {
      kind: "numeric",
      id: nextChallengeId++,
      conceptId: WAVE_CONCEPT_SUPERPOSITION,
      conceptTitle: "Superposition & Interference",
      prompt: "Two waves of these amplitudes overlap. What is the resultant amplitude where they interfere?",
      unit: "m",
      mode: "read",
      solveFor: "resultantAmplitude",
      wave: wave1,
      wave2,
      targetValue: round2(resultantAmplitude(wave1, wave2)),
      tolerance: 0.1,
    };
  }

  return {
    kind: "choice",
    id: nextChallengeId++,
    conceptId: WAVE_CONCEPT_SUPERPOSITION,
    conceptTitle: "Superposition & Interference",
    prompt: "Observe how these two waves combine. Is the interference constructive or destructive?",
    solveFor: "interferenceType",
    wave1,
    wave2,
    options: ["constructive", "destructive"],
    correctAnswer: classifyInterference(wave1, wave2),
  };
}

// The single entry point: dispatches on conceptId, cycling through a small
// set of deterministic subtypes/variants - never a random challenge, so
// (conceptId, variant) always reproduces the exact same WaveChallenge.
export function generateWaveChallenge(conceptId: WaveConceptId, variant = 0): WaveChallenge {
  if (conceptId === WAVE_CONCEPT_AMPLITUDE) return generateAmplitudeChallenge(variant);
  if (conceptId === WAVE_CONCEPT_FREQUENCY_WAVELENGTH) return generateFrequencyWavelengthChallenge(variant);
  if (conceptId === WAVE_CONCEPT_WAVE_SPEED) return generateWaveSpeedChallenge(variant);
  return generateSuperpositionChallenge(variant);
}

// --------------------------------------------------------------------------
// Given-field display - what the HUD shows as already-known, mirroring
// challengeLogic.ts's givenFieldsFor. Whichever field is the challenge's own
// solveFor is never shown here - the wave itself still animates using its
// real value (see the wave-speed inverse problems above), the player just
// has to derive that value rather than read it off the HUD.
// --------------------------------------------------------------------------

export function givenFieldsForWaveChallenge(challenge: WaveChallenge): { label: string; value: string }[] {
  if (challenge.kind === "choice") {
    return [
      { label: "Wave 1 amplitude", value: `${challenge.wave1.amplitude.toFixed(2)} m` },
      { label: "Wave 2 amplitude", value: `${challenge.wave2.amplitude.toFixed(2)} m` },
      { label: "Phase difference", value: `${((challenge.wave2.phase - challenge.wave1.phase) / Math.PI).toFixed(2)}π rad` },
    ];
  }
  const rows: { label: string; value: string }[] = [];
  if (challenge.conceptId === WAVE_CONCEPT_SUPERPOSITION && challenge.wave2) {
    rows.push({ label: "Wave 1 amplitude", value: `${challenge.wave.amplitude.toFixed(2)} m` });
    rows.push({ label: "Wave 2 amplitude", value: `${challenge.wave2.amplitude.toFixed(2)} m` });
    rows.push({ label: "Phase difference", value: `${((challenge.wave2.phase - challenge.wave.phase) / Math.PI).toFixed(2)}π rad` });
    return rows;
  }
  if (challenge.solveFor !== "amplitude") {
    rows.push({ label: "Amplitude", value: `${challenge.wave.amplitude.toFixed(2)} m` });
  }
  if (challenge.solveFor !== "frequency" && challenge.solveFor !== "period") {
    rows.push({ label: "Frequency", value: `${challenge.wave.frequency.toFixed(2)} Hz` });
  }
  if (challenge.solveFor !== "wavelength") {
    rows.push({ label: "Wavelength", value: `${challenge.wave.wavelength.toFixed(2)} m` });
  }
  return rows;
}

// --------------------------------------------------------------------------
// Answer validation + evaluation - same { value } | { error } shape as
// challengeLogic.ts's validateInput, so a numeric-answer UI can gate its
// submit button identically.
// --------------------------------------------------------------------------

export type WaveAnswerValidation = { value: number } | { error: string };

export function validateWaveAnswer(raw: string): WaveAnswerValidation {
  const trimmed = raw.trim();
  if (trimmed === "") return { error: "Enter a value." };
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return { error: "Enter a valid number." };
  if (Math.abs(value) > 100000) return { error: "That value is unrealistically large." };
  return { value };
}

export interface WaveNumericResult {
  readonly correct: boolean;
  readonly submittedValue: number;
  readonly targetValue: number;
}

export function evaluateWaveNumericAnswer(challenge: WaveNumericChallenge, submittedValue: number): WaveNumericResult {
  return {
    correct: Math.abs(submittedValue - challenge.targetValue) <= challenge.tolerance,
    submittedValue,
    targetValue: challenge.targetValue,
  };
}

export interface WaveChoiceResult {
  readonly correct: boolean;
  readonly submittedAnswer: InterferenceType;
  readonly correctAnswer: InterferenceType;
}

export function evaluateWaveChoiceAnswer(challenge: WaveChoiceChallenge, submittedAnswer: InterferenceType): WaveChoiceResult {
  return { correct: submittedAnswer === challenge.correctAnswer, submittedAnswer, correctAnswer: challenge.correctAnswer };
}

// --------------------------------------------------------------------------
// READY / SUBMITTED play state machine - completion is always tied to an
// explicit player submission (see this file's own header comment), never a
// timeout. Mirrors gravitationChallenge.ts's GravitationPlayState in spirit,
// but simpler: there is no physics outcome to wait for here (the wave keeps
// animating regardless of phase), only the player's own submit action.
// --------------------------------------------------------------------------

export type WavePlayPhase = "READY" | "SUBMITTED";

export interface WavePlayState {
  readonly phase: WavePlayPhase;
  readonly result: WaveNumericResult | WaveChoiceResult | null;
}

export function createWavePlayState(): WavePlayState {
  return { phase: "READY", result: null };
}

export function submitWaveNumericAnswer(challenge: WaveNumericChallenge, submittedValue: number): WavePlayState {
  return { phase: "SUBMITTED", result: evaluateWaveNumericAnswer(challenge, submittedValue) };
}

export function submitWaveChoiceAnswer(challenge: WaveChoiceChallenge, submittedAnswer: InterferenceType): WavePlayState {
  return { phase: "SUBMITTED", result: evaluateWaveChoiceAnswer(challenge, submittedAnswer) };
}

// Exposed for tests/consumers that want a fresh id sequence between runs
// (e.g. between test files) - challenge ids are otherwise just a monotonic
// counter, never meaningful physics.
export function resetWaveChallengeIdSequenceForTests(): void {
  nextChallengeId = 1;
}
