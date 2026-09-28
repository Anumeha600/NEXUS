// --------------------------------------------------------------------------
// Archimedes / Buoyancy - Phase 1: pure, deterministic physics formulas.
//
// Mirrors wavesPhysics.ts's shape: a self-contained pure module, no
// rendering, no adaptive/mastery logic, no React. Real SI units throughout
// (kg, m^3, kg/m^3, N, m/s^2) - unlike gravitationPhysics's simulation-scale
// G=1 (see physics.ts's GRAVITY_SIM_G), buoyancy has no equivalent need to
// rescale: mass/volume/density ranges that are pedagogically legible
// (single-digit kg, sub-0.01 m^3 volumes, water-like densities) already
// produce forces in a sane, readable Newton range with real g.
//
// Unlike wavesPhysics.ts (which deliberately lets an invalid input like a
// zero wavelength fall through to Infinity/NaN, since a negative wave
// amplitude is still a physically sane phase flip), mass/volume/density here
// are never physically negative - a negative value is always a caller bug,
// not a valid physics state, so every function that takes one throws rather
// than silently returning a nonsensical negative force or density.
// --------------------------------------------------------------------------

// Real Earth surface gravity, matching physics.ts's own CONCEPT_SPEED_RANGE
// default (9.8) - real SI, not a simulation-scale unit like GRAVITY_SIM_G.
export const EARTH_GRAVITY = 9.8;

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative finite number, got ${value}.`);
  }
}

function assertPositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite number, got ${value}.`);
  }
}

// W = mg.
export function weightFromMass(mass: number, gravity: number): number {
  assertNonNegativeFinite(mass, "mass");
  assertPositiveFinite(gravity, "gravity");
  return mass * gravity;
}

// F_B = rho_f * g * V_displaced - Archimedes' principle: the buoyant force
// equals the weight of the fluid displaced by the submerged volume.
export function buoyantForce(fluidDensity: number, gravity: number, displacedVolume: number): number {
  assertNonNegativeFinite(fluidDensity, "fluidDensity");
  assertPositiveFinite(gravity, "gravity");
  assertNonNegativeFinite(displacedVolume, "displacedVolume");
  return fluidDensity * gravity * displacedVolume;
}

// W_apparent = W_actual - F_B, clamped at zero. A buoyant force exceeding
// actual weight means the object would float/rise on its own - a spring
// scale holding it under can never read negative tension, only zero (the
// string simply goes slack), so 0 is the real physical reading, not merely a
// convenient floor.
export function apparentWeight(actualWeight: number, buoyantForceValue: number): number {
  assertNonNegativeFinite(actualWeight, "actualWeight");
  assertNonNegativeFinite(buoyantForceValue, "buoyantForce");
  return Math.max(0, actualWeight - buoyantForceValue);
}

// F_B = W_actual - W_apparent - the measurement-based route to buoyant force
// (inverse of apparentWeight above), used by the BUOYANT_FORCE challenge
// type: given what the scale read in air and submerged, recover the force
// buoyancy contributed. Submerging an object never increases its measured
// weight, so an apparentWeight greater than actualWeight is not a valid pair
// of measurements for this experiment - a caller bug, not a physical state -
// and is rejected rather than silently returning a negative force.
export function buoyantForceFromWeights(actualWeight: number, apparentWeightValue: number): number {
  assertNonNegativeFinite(actualWeight, "actualWeight");
  assertNonNegativeFinite(apparentWeightValue, "apparentWeight");
  if (apparentWeightValue > actualWeight) {
    throw new Error(`apparentWeight (${apparentWeightValue}) cannot exceed actualWeight (${actualWeight}) - submerging an object never increases its measured weight.`);
  }
  return actualWeight - apparentWeightValue;
}

// rho = m / V.
export function densityFromMassAndVolume(mass: number, volume: number): number {
  assertNonNegativeFinite(mass, "mass");
  assertPositiveFinite(volume, "volume");
  return mass / volume;
}

// For a fully submerged object, the displaced volume IS the object's own
// volume - never a separate quantity computed some other way.
export function displacedVolumeForSubmergedObject(objectVolume: number): number {
  assertPositiveFinite(objectVolume, "objectVolume");
  return objectVolume;
}

// V_displaced = F_B / (rho_f * g) - inverse of buoyantForce, solved for
// volume (the DISPLACED_VOLUME challenge type).
export function displacedVolumeFromBuoyantForce(buoyantForceValue: number, fluidDensity: number, gravity: number): number {
  assertNonNegativeFinite(buoyantForceValue, "buoyantForce");
  assertPositiveFinite(fluidDensity, "fluidDensity");
  assertPositiveFinite(gravity, "gravity");
  return buoyantForceValue / (fluidDensity * gravity);
}

// rho_f = F_B / (g * V_displaced) - inverse of buoyantForce, solved for
// fluid density (the FLUID_DENSITY challenge type).
export function fluidDensityFromBuoyantForce(buoyantForceValue: number, displacedVolume: number, gravity: number): number {
  assertNonNegativeFinite(buoyantForceValue, "buoyantForce");
  assertPositiveFinite(displacedVolume, "displacedVolume");
  assertPositiveFinite(gravity, "gravity");
  return buoyantForceValue / (gravity * displacedVolume);
}

export type FloatingOutcome = "FLOAT" | "SINK" | "NEUTRAL";

// Comparing object density to fluid density is the standard float/sink test
// - equivalent to comparing weight to the buoyant force a fully submerged
// object of that volume would experience (both terms share the same g*V
// factor, which cancels), but density is the quantity the FLOAT_SINK
// challenge type is actually given, so this compares densities directly
// rather than re-deriving forces just to compare them.
const NEUTRAL_DENSITY_EPSILON = 1e-9;

export function floatingOutcome(objectDensity: number, fluidDensity: number): FloatingOutcome {
  assertNonNegativeFinite(objectDensity, "objectDensity");
  assertNonNegativeFinite(fluidDensity, "fluidDensity");
  const diff = objectDensity - fluidDensity;
  if (Math.abs(diff) < NEUTRAL_DENSITY_EPSILON) return "NEUTRAL";
  return diff < 0 ? "FLOAT" : "SINK";
}

// Floating equilibrium: rho_fluid * g * V_displaced = m * g  =>  V_displaced
// = m / rho_fluid - the volume a floating object must actually submerge to
// balance its own weight. For a real floater this is at most the object's
// own total volume; a caller passing a sinking object's density/mass here
// gets a V_displaced that EXCEEDS its own total volume, which is exactly the
// "this object cannot actually float" signal - see floatingOutcome above for
// the classification itself.
export function equilibriumDisplacedVolume(mass: number, fluidDensity: number): number {
  assertNonNegativeFinite(mass, "mass");
  assertPositiveFinite(fluidDensity, "fluidDensity");
  return mass / fluidDensity;
}
