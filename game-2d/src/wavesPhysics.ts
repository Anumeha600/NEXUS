// --------------------------------------------------------------------------
// Wave Motion - Layer 1: pure, deterministic wave-physics formulas.
//
// A single sinusoidal traveling wave is fully described by
//   y(x,t) = A * sin(k*x - omega*t + phi)
// with
//   k     = 2*pi / lambda        (wave number)
//   omega = 2*pi * f             (angular frequency)
//   T     = 1 / f                (period)
//   v     = f * lambda           (wave speed)
//
// No integration/stepping is needed (unlike gravitationSim.ts's orbit ODE) -
// displacement at any (x, t) is a closed-form evaluation, so there is no
// separate "sim" layer here. Superposition of two waves is just y1 + y2,
// evaluated pointwise - this file never re-derives a second interference
// model on top of that.
// --------------------------------------------------------------------------

export interface WaveParams {
  readonly amplitude: number;
  readonly frequency: number;
  readonly wavelength: number;
  // Phase offset in radians - defaults to 0 wherever omitted by callers.
  readonly phase: number;
}

// k = 2*pi / lambda.
export function waveNumber(wavelength: number): number {
  return (2 * Math.PI) / wavelength;
}

// omega = 2*pi*f.
export function angularFrequency(frequency: number): number {
  return 2 * Math.PI * frequency;
}

// T = 1/f.
export function wavePeriod(frequency: number): number {
  return 1 / frequency;
}

// v = f*lambda.
export function waveSpeed(frequency: number, wavelength: number): number {
  return frequency * wavelength;
}

// f = v/lambda - the inverse of waveSpeed, solved for frequency.
export function frequencyFromSpeed(speed: number, wavelength: number): number {
  return speed / wavelength;
}

// lambda = v/f - the inverse of waveSpeed, solved for wavelength.
export function wavelengthFromSpeed(speed: number, frequency: number): number {
  return speed / frequency;
}

// y(x,t) = A * sin(k*x - omega*t + phi).
export function waveDisplacementAt(wave: WaveParams, x: number, t: number): number {
  const k = waveNumber(wave.wavelength);
  const omega = angularFrequency(wave.frequency);
  return wave.amplitude * Math.sin(k * x - omega * t + wave.phase);
}

// Principle of superposition: the resultant displacement of two overlapping
// waves at the same point is simply the sum of each wave's own displacement
// there - never a separate "interference formula".
export function superpose(y1: number, y2: number): number {
  return y1 + y2;
}

// Convenience wrapper combining waveDisplacementAt + superpose for two full
// WaveParams at a given (x, t) - returns all three curves so a renderer or
// challenge can show the components alongside the resultant without
// recomputing them.
export function twoWaveDisplacementAt(wave1: WaveParams, wave2: WaveParams, x: number, t: number): { y1: number; y2: number; yTotal: number } {
  const y1 = waveDisplacementAt(wave1, x, t);
  const y2 = waveDisplacementAt(wave2, x, t);
  return { y1, y2, yTotal: superpose(y1, y2) };
}

export type InterferenceType = "constructive" | "destructive" | "partial";

// A phase difference of 0 (mod 2*pi) is fully constructive (waves crest
// together); a phase difference of pi (mod 2*pi) is fully destructive (crest
// meets trough). Anything else is only partial reinforcement/cancellation.
// Two equal-and-opposite amplitudes at a pi phase difference produce a flat
// resultant (perfect cancellation) - still classified "destructive" here
// since that is what the phase relationship itself represents, regardless of
// the two amplitudes' magnitudes.
const PHASE_MATCH_EPSILON = 1e-6;

function wrapPhase(phase: number): number {
  const twoPi = 2 * Math.PI;
  const wrapped = phase % twoPi;
  return wrapped < 0 ? wrapped + twoPi : wrapped;
}

export function classifyInterference(wave1: WaveParams, wave2: WaveParams): InterferenceType {
  const phaseDifference = wrapPhase(wave2.phase - wave1.phase);
  if (phaseDifference < PHASE_MATCH_EPSILON || Math.abs(phaseDifference - 2 * Math.PI) < PHASE_MATCH_EPSILON) {
    return "constructive";
  }
  if (Math.abs(phaseDifference - Math.PI) < PHASE_MATCH_EPSILON) {
    return "destructive";
  }
  return "partial";
}

// The resultant amplitude for two waves of the SAME frequency/wavelength,
// differing only in amplitude and phase - the standard two-wave-interference
// closed form, |A_total| = sqrt(A1^2 + A2^2 + 2*A1*A2*cos(deltaPhi)), which
// reduces to A1+A2 at deltaPhi=0 (constructive) and |A1-A2| at deltaPhi=pi
// (destructive).
export function resultantAmplitude(wave1: WaveParams, wave2: WaveParams): number {
  const deltaPhi = wave2.phase - wave1.phase;
  const sumSquares = wave1.amplitude * wave1.amplitude + wave2.amplitude * wave2.amplitude;
  const crossTerm = 2 * wave1.amplitude * wave2.amplitude * Math.cos(deltaPhi);
  return Math.sqrt(Math.max(0, sumSquares + crossTerm));
}
