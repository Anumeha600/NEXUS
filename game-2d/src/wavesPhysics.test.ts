import { describe, it, expect } from "vitest";
import {
  waveNumber,
  angularFrequency,
  wavePeriod,
  waveSpeed,
  frequencyFromSpeed,
  wavelengthFromSpeed,
  waveDisplacementAt,
  superpose,
  twoWaveDisplacementAt,
  classifyInterference,
  resultantAmplitude,
  type WaveParams,
} from "./wavesPhysics";

describe("wavesPhysics - Layer 1 pure formulas", () => {
  it("1. k = 2*pi/lambda", () => {
    expect(waveNumber(1)).toBeCloseTo(2 * Math.PI, 10);
    expect(waveNumber(2)).toBeCloseTo(Math.PI, 10);
    expect(waveNumber(4 * Math.PI)).toBeCloseTo(0.5, 10);
  });

  it("2. omega = 2*pi*f", () => {
    expect(angularFrequency(1)).toBeCloseTo(2 * Math.PI, 10);
    expect(angularFrequency(0.5)).toBeCloseTo(Math.PI, 10);
    expect(angularFrequency(0)).toBe(0);
  });

  it("3. T = 1/f", () => {
    expect(wavePeriod(1)).toBeCloseTo(1, 10);
    expect(wavePeriod(2)).toBeCloseTo(0.5, 10);
    expect(wavePeriod(0.25)).toBeCloseTo(4, 10);
  });

  it("4. v = f*lambda (and its inverses)", () => {
    expect(waveSpeed(2, 3)).toBeCloseTo(6, 10);
    expect(frequencyFromSpeed(6, 3)).toBeCloseTo(2, 10);
    expect(wavelengthFromSpeed(6, 2)).toBeCloseTo(3, 10);
  });

  it("5. wave displacement at known x/t matches y = A sin(kx - omega*t + phi)", () => {
    const wave: WaveParams = { amplitude: 2, frequency: 1, wavelength: 2, phase: 0 };
    // At x=0, t=0: y = A*sin(0) = 0.
    expect(waveDisplacementAt(wave, 0, 0)).toBeCloseTo(0, 10);
    // k = pi, omega = 2*pi. At x = 0.5 (k*x = pi/2), t=0: y = A*sin(pi/2) = A.
    expect(waveDisplacementAt(wave, 0.5, 0)).toBeCloseTo(2, 10);
    // At x=0, t = T/4 = 0.25 (omega*t = pi/2): y = A*sin(-pi/2) = -A.
    expect(waveDisplacementAt(wave, 0, 0.25)).toBeCloseTo(-2, 10);
    // A phase offset of pi/2 at x=0,t=0 gives y = A*sin(pi/2) = A.
    const shifted: WaveParams = { ...wave, phase: Math.PI / 2 };
    expect(waveDisplacementAt(shifted, 0, 0)).toBeCloseTo(2, 10);
  });

  it("6. amplitude scales peak displacement linearly, independent of frequency/wavelength", () => {
    const base: WaveParams = { amplitude: 1, frequency: 3, wavelength: 5, phase: 0 };
    const doubled: WaveParams = { ...base, amplitude: 2 };
    // Evaluated at the crest (kx - omega*t + phi = pi/2) for both.
    const kx = Math.PI / 2;
    expect(waveDisplacementAt(base, kx / waveNumber(base.wavelength), 0)).toBeCloseTo(1, 8);
    expect(waveDisplacementAt(doubled, kx / waveNumber(doubled.wavelength), 0)).toBeCloseTo(2, 8);
  });

  it("7. increasing frequency increases oscillation rate (shorter period at a fixed point)", () => {
    const slow: WaveParams = { amplitude: 1, frequency: 1, wavelength: 4, phase: 0 };
    const fast: WaveParams = { ...slow, frequency: 2 };
    // Half a period of `slow` (t=0.5) returns to zero-crossing the same way
    // a full period of `fast` (t=0.5) does - both complete a whole number of
    // cycles at x=0, so both are back at y=0 there.
    expect(waveDisplacementAt(slow, 0, wavePeriod(slow.frequency))).toBeCloseTo(waveDisplacementAt(slow, 0, 0), 10);
    expect(waveDisplacementAt(fast, 0, wavePeriod(fast.frequency))).toBeCloseTo(waveDisplacementAt(fast, 0, 0), 10);
    // At a quarter of the slow period, `fast` (double the frequency) has
    // already completed a half cycle further than `slow`.
    const t = wavePeriod(slow.frequency) / 4;
    const slowPhaseProgress = angularFrequency(slow.frequency) * t;
    const fastPhaseProgress = angularFrequency(fast.frequency) * t;
    expect(fastPhaseProgress).toBeCloseTo(2 * slowPhaseProgress, 10);
  });

  it("8. increasing wavelength increases spatial spacing between crests", () => {
    const short: WaveParams = { amplitude: 1, frequency: 1, wavelength: 2, phase: 0 };
    const long: WaveParams = { ...short, wavelength: 4 };
    // Distance between successive crests is exactly the wavelength - crest
    // condition k*x = pi/2 (mod 2*pi) => x = wavelength/4 for the first crest.
    const shortCrestX = (Math.PI / 2) / waveNumber(short.wavelength);
    const longCrestX = (Math.PI / 2) / waveNumber(long.wavelength);
    expect(shortCrestX).toBeCloseTo(short.wavelength / 4, 10);
    expect(longCrestX).toBeCloseTo(long.wavelength / 4, 10);
    expect(longCrestX).toBeGreaterThan(shortCrestX);
  });

  it("9. superposition is the pointwise sum of the two component displacements", () => {
    expect(superpose(1.5, -0.5)).toBeCloseTo(1, 10);
    const wave1: WaveParams = { amplitude: 1, frequency: 1, wavelength: 2, phase: 0 };
    const wave2: WaveParams = { amplitude: 0.5, frequency: 1, wavelength: 2, phase: Math.PI / 4 };
    const { y1, y2, yTotal } = twoWaveDisplacementAt(wave1, wave2, 0.3, 0.1);
    expect(yTotal).toBeCloseTo(y1 + y2, 10);
  });

  it("10. constructive interference (phase difference 0) - resultant amplitude is the sum", () => {
    const wave1: WaveParams = { amplitude: 2, frequency: 1, wavelength: 2, phase: 0 };
    const wave2: WaveParams = { amplitude: 1.5, frequency: 1, wavelength: 2, phase: 0 };
    expect(classifyInterference(wave1, wave2)).toBe("constructive");
    expect(resultantAmplitude(wave1, wave2)).toBeCloseTo(3.5, 10);
    // The two waves crest together at any x, t - their sum's magnitude peaks
    // at exactly A1+A2.
    const { yTotal } = twoWaveDisplacementAt(wave1, wave2, 0.5, 0);
    expect(Math.abs(yTotal)).toBeCloseTo(3.5, 8);
  });

  it("11. destructive interference (phase difference pi) - resultant amplitude is the difference", () => {
    const wave1: WaveParams = { amplitude: 2, frequency: 1, wavelength: 2, phase: 0 };
    const wave2: WaveParams = { amplitude: 1.5, frequency: 1, wavelength: 2, phase: Math.PI };
    expect(classifyInterference(wave1, wave2)).toBe("destructive");
    expect(resultantAmplitude(wave1, wave2)).toBeCloseTo(0.5, 10);
  });

  it("11b. equal-and-opposite destructive interference cancels completely", () => {
    const wave1: WaveParams = { amplitude: 1, frequency: 1, wavelength: 2, phase: 0 };
    const wave2: WaveParams = { amplitude: 1, frequency: 1, wavelength: 2, phase: Math.PI };
    expect(classifyInterference(wave1, wave2)).toBe("destructive");
    expect(resultantAmplitude(wave1, wave2)).toBeCloseTo(0, 10);
    const { yTotal } = twoWaveDisplacementAt(wave1, wave2, 1.234, 5.678);
    expect(yTotal).toBeCloseTo(0, 10);
  });

  it("12. edge/invalid inputs behave predictably rather than throwing", () => {
    // Zero wavelength/frequency produce infinities/NaN through ordinary
    // floating-point division, never an exception - callers that generate
    // challenges are responsible for never producing these.
    expect(waveNumber(0)).toBe(Infinity);
    expect(wavePeriod(0)).toBe(Infinity);
    expect(waveSpeed(0, 5)).toBe(0);
    expect(frequencyFromSpeed(5, 0)).toBe(Infinity);
    // A negative amplitude is just a pi phase flip - still a finite, sane
    // displacement, no special-casing required.
    const negativeAmplitude: WaveParams = { amplitude: -1, frequency: 1, wavelength: 2, phase: 0 };
    expect(waveDisplacementAt(negativeAmplitude, 0.5, 0)).toBeCloseTo(-1, 10);
    // A partial (non-0, non-pi) phase difference is neither constructive nor
    // destructive.
    const wave1: WaveParams = { amplitude: 1, frequency: 1, wavelength: 2, phase: 0 };
    const wave2: WaveParams = { amplitude: 1, frequency: 1, wavelength: 2, phase: Math.PI / 3 };
    expect(classifyInterference(wave1, wave2)).toBe("partial");
  });
});
