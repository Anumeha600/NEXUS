import { describe, it, expect } from "vitest";
import {
  EARTH_GRAVITY,
  weightFromMass,
  buoyantForce,
  apparentWeight,
  buoyantForceFromWeights,
  densityFromMassAndVolume,
  displacedVolumeForSubmergedObject,
  displacedVolumeFromBuoyantForce,
  fluidDensityFromBuoyantForce,
  floatingOutcome,
  equilibriumDisplacedVolume,
} from "./archimedesPhysics";

describe("archimedesPhysics - weight (W = mg)", () => {
  it("normal mass produces the expected weight", () => {
    expect(weightFromMass(2, 9.8)).toBeCloseTo(19.6, 10);
    expect(weightFromMass(1, EARTH_GRAVITY)).toBeCloseTo(9.8, 10);
  });

  it("zero mass produces zero weight", () => {
    expect(weightFromMass(0, EARTH_GRAVITY)).toBe(0);
  });

  it("a negative mass throws rather than returning a nonsensical negative weight", () => {
    expect(() => weightFromMass(-2, EARTH_GRAVITY)).toThrow(/mass/i);
  });

  it("a non-finite mass throws", () => {
    expect(() => weightFromMass(NaN, EARTH_GRAVITY)).toThrow(/mass/i);
    expect(() => weightFromMass(Infinity, EARTH_GRAVITY)).toThrow(/mass/i);
  });

  it("a non-positive gravity throws", () => {
    expect(() => weightFromMass(2, 0)).toThrow(/gravity/i);
    expect(() => weightFromMass(2, -9.8)).toThrow(/gravity/i);
  });
});

describe("archimedesPhysics - buoyant force (F_B = rho_f * g * V_displaced)", () => {
  it("normal values match Archimedes' principle", () => {
    // Water (1000 kg/m^3), 0.0015 m^3 displaced: F_B = 1000*9.8*0.0015 = 14.7 N.
    expect(buoyantForce(1000, 9.8, 0.0015)).toBeCloseTo(14.7, 10);
  });

  it("zero displaced volume produces zero buoyant force", () => {
    expect(buoyantForce(1000, EARTH_GRAVITY, 0)).toBe(0);
  });

  it("different fluid densities scale the buoyant force proportionally", () => {
    const volume = 0.001;
    const water = buoyantForce(1000, EARTH_GRAVITY, volume);
    const oil = buoyantForce(920, EARTH_GRAVITY, volume);
    const mercury = buoyantForce(13600, EARTH_GRAVITY, volume);
    expect(water).toBeGreaterThan(oil);
    expect(mercury).toBeGreaterThan(water);
    expect(mercury / water).toBeCloseTo(13600 / 1000, 10);
  });

  it("a negative fluid density or displaced volume throws", () => {
    expect(() => buoyantForce(-1000, EARTH_GRAVITY, 0.001)).toThrow(/fluidDensity/i);
    expect(() => buoyantForce(1000, EARTH_GRAVITY, -0.001)).toThrow(/displacedVolume/i);
  });
});

describe("archimedesPhysics - apparent weight (W_apparent = W_actual - F_B)", () => {
  it("normal case: apparent weight is actual weight minus buoyant force", () => {
    expect(apparentWeight(20, 5)).toBeCloseTo(15, 10);
  });

  it("buoyant force less than actual weight leaves a positive apparent weight", () => {
    expect(apparentWeight(19.6, 14.7)).toBeCloseTo(4.9, 10);
  });

  it("buoyant force equal to actual weight gives exactly zero apparent weight (neutral buoyancy)", () => {
    expect(apparentWeight(10, 10)).toBe(0);
  });

  it("buoyant force exceeding actual weight clamps to zero, never negative - a real scale can't show negative tension", () => {
    expect(apparentWeight(10, 15)).toBe(0);
  });

  it("negative inputs throw", () => {
    expect(() => apparentWeight(-10, 5)).toThrow(/actualWeight/i);
    expect(() => apparentWeight(10, -5)).toThrow(/buoyantForce/i);
  });
});

describe("archimedesPhysics - buoyant force from measured weights (inverse of apparentWeight)", () => {
  it("recovers the buoyant force from actual and apparent weight measurements", () => {
    expect(buoyantForceFromWeights(19.6, 4.9)).toBeCloseTo(14.7, 10);
  });

  it("is the exact inverse of apparentWeight for any non-clamped case", () => {
    const actual = 25;
    const buoyant = 9;
    const apparent = apparentWeight(actual, buoyant);
    expect(buoyantForceFromWeights(actual, apparent)).toBeCloseTo(buoyant, 10);
  });

  it("an apparent weight greater than actual weight is rejected as a non-physical measurement pair", () => {
    expect(() => buoyantForceFromWeights(10, 15)).toThrow(/cannot exceed/i);
  });
});

describe("archimedesPhysics - density (rho = m / V)", () => {
  it("normal values", () => {
    expect(densityFromMassAndVolume(1, 0.001)).toBeCloseTo(1000, 10);
    expect(densityFromMassAndVolume(2, 0.002)).toBeCloseTo(1000, 10);
  });

  it("a zero or negative volume throws rather than dividing by zero", () => {
    expect(() => densityFromMassAndVolume(1, 0)).toThrow(/volume/i);
    expect(() => densityFromMassAndVolume(1, -0.001)).toThrow(/volume/i);
  });

  it("a negative mass throws", () => {
    expect(() => densityFromMassAndVolume(-1, 0.001)).toThrow(/mass/i);
  });
});

describe("archimedesPhysics - displaced volume", () => {
  it("a fully submerged object displaces exactly its own volume", () => {
    expect(displacedVolumeForSubmergedObject(0.0015)).toBe(0.0015);
  });

  it("a non-positive object volume throws", () => {
    expect(() => displacedVolumeForSubmergedObject(0)).toThrow(/objectVolume/i);
    expect(() => displacedVolumeForSubmergedObject(-0.001)).toThrow(/objectVolume/i);
  });

  it("displacedVolumeFromBuoyantForce is the exact inverse of buoyantForce", () => {
    const fluidDensity = 1000;
    const volume = 0.0015;
    const force = buoyantForce(fluidDensity, EARTH_GRAVITY, volume);
    expect(displacedVolumeFromBuoyantForce(force, fluidDensity, EARTH_GRAVITY)).toBeCloseTo(volume, 10);
  });
});

describe("archimedesPhysics - fluid density from buoyant force (inverse of buoyantForce)", () => {
  it("recovers the fluid density used to produce a given buoyant force", () => {
    const fluidDensity = 1025;
    const volume = 0.0012;
    const force = buoyantForce(fluidDensity, EARTH_GRAVITY, volume);
    expect(fluidDensityFromBuoyantForce(force, volume, EARTH_GRAVITY)).toBeCloseTo(fluidDensity, 8);
  });

  it("a non-positive displaced volume throws", () => {
    expect(() => fluidDensityFromBuoyantForce(10, 0, EARTH_GRAVITY)).toThrow(/displacedVolume/i);
  });
});

describe("archimedesPhysics - float / sink / neutral classification", () => {
  it("object density less than fluid density floats", () => {
    expect(floatingOutcome(600, 1000)).toBe("FLOAT");
  });

  it("object density greater than fluid density sinks", () => {
    expect(floatingOutcome(1500, 1000)).toBe("SINK");
  });

  it("equal densities are neutrally buoyant", () => {
    expect(floatingOutcome(1000, 1000)).toBe("NEUTRAL");
  });

  it("a negative density throws", () => {
    expect(() => floatingOutcome(-100, 1000)).toThrow(/objectDensity/i);
    expect(() => floatingOutcome(1000, -100)).toThrow(/fluidDensity/i);
  });
});

describe("archimedesPhysics - floating equilibrium displaced volume", () => {
  it("a floating object displaces exactly enough volume to balance its own weight", () => {
    // 0.5 kg object in water (1000 kg/m^3): displaces 0.0005 m^3 to float.
    const mass = 0.5;
    const fluidDensity = 1000;
    const displaced = equilibriumDisplacedVolume(mass, fluidDensity);
    expect(displaced).toBeCloseTo(0.0005, 10);
    // Self-consistency: the buoyant force at that displaced volume exactly
    // balances the object's own weight - the defining condition of float.
    expect(buoyantForce(fluidDensity, EARTH_GRAVITY, displaced)).toBeCloseTo(weightFromMass(mass, EARTH_GRAVITY), 10);
  });

  it("a non-positive fluid density throws", () => {
    expect(() => equilibriumDisplacedVolume(1, 0)).toThrow(/fluidDensity/i);
  });
});
