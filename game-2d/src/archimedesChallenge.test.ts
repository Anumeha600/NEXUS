import { describe, it, expect, beforeEach } from "vitest";
import {
  ARCHIMEDES_CONCEPT_BUOYANT_FORCE,
  ARCHIMEDES_CONCEPT_APPARENT_WEIGHT,
  ARCHIMEDES_CONCEPT_DISPLACED_VOLUME,
  ARCHIMEDES_CONCEPT_FLUID_DENSITY,
  ARCHIMEDES_CONCEPT_FLOAT_SINK,
  ARCHIMEDES_FLUIDS,
  generateArchimedesChallenge,
  givenFieldsForArchimedesChallenge,
  validateArchimedesAnswer,
  evaluateArchimedesNumericAnswer,
  evaluateArchimedesChoiceAnswer,
  createArchimedesPlayState,
  measureInAir,
  submergeObject,
  submitArchimedesNumericAnswer,
  submitArchimedesChoiceAnswer,
  resetArchimedesAttempt,
  resetArchimedesChallengeIdSequenceForTests,
  initialFluidForChallenge,
  applyFluidToChallenge,
  type ArchimedesNumericChallenge,
  type ArchimedesChoiceChallenge,
} from "./archimedesChallenge";
import { weightFromMass, buoyantForce, apparentWeight, floatingOutcome, EARTH_GRAVITY } from "./archimedesPhysics";

function fluidNamed(name: string) {
  const fluid = ARCHIMEDES_FLUIDS.find((f) => f.name === name);
  if (!fluid) throw new Error(`no fluid named ${name}`);
  return fluid;
}

beforeEach(() => {
  resetArchimedesChallengeIdSequenceForTests();
});

describe("generateArchimedesChallenge - determinism", () => {
  it("the same (conceptId, variant) pair always reproduces the exact same challenge", () => {
    const a = generateArchimedesChallenge(ARCHIMEDES_CONCEPT_BUOYANT_FORCE, 2);
    const b = generateArchimedesChallenge(ARCHIMEDES_CONCEPT_BUOYANT_FORCE, 2);
    expect(a).toEqual({ ...b, id: a.id });
  });

  it("different variants of the same concept produce different setups", () => {
    const a = generateArchimedesChallenge(ARCHIMEDES_CONCEPT_APPARENT_WEIGHT, 0) as ArchimedesNumericChallenge;
    const b = generateArchimedesChallenge(ARCHIMEDES_CONCEPT_APPARENT_WEIGHT, 1) as ArchimedesNumericChallenge;
    expect(a.setup.mass).not.toBe(b.setup.mass);
  });

  it("generates a valid challenge for every one of the 5 concepts", () => {
    for (const conceptId of [
      ARCHIMEDES_CONCEPT_BUOYANT_FORCE,
      ARCHIMEDES_CONCEPT_APPARENT_WEIGHT,
      ARCHIMEDES_CONCEPT_DISPLACED_VOLUME,
      ARCHIMEDES_CONCEPT_FLUID_DENSITY,
      ARCHIMEDES_CONCEPT_FLOAT_SINK,
    ]) {
      const challenge = generateArchimedesChallenge(conceptId, 0);
      expect(challenge.conceptId).toBe(conceptId);
    }
  });

  it("uses sensible educational ranges, never absurd values", () => {
    for (let variant = 0; variant < 8; variant++) {
      const challenge = generateArchimedesChallenge(ARCHIMEDES_CONCEPT_BUOYANT_FORCE, variant) as ArchimedesNumericChallenge;
      expect(challenge.setup.mass).toBeGreaterThan(0);
      expect(challenge.setup.mass).toBeLessThan(10);
      expect(challenge.setup.objectVolume).toBeGreaterThan(0);
      expect(challenge.setup.objectVolume).toBeLessThan(0.01);
      expect(challenge.setup.fluidDensity).toBeGreaterThan(0);
    }
  });
});

describe("Buoyant Force challenge - given actual + apparent weight, find buoyant force", () => {
  it("the expected answer matches the physics module's own formulas exactly", () => {
    const challenge = generateArchimedesChallenge(ARCHIMEDES_CONCEPT_BUOYANT_FORCE, 3) as ArchimedesNumericChallenge;
    const expectedActual = weightFromMass(challenge.setup.mass, challenge.setup.gravity);
    const expectedBuoyant = buoyantForce(challenge.setup.fluidDensity, challenge.setup.gravity, challenge.setup.objectVolume);
    const expectedApparent = apparentWeight(expectedActual, expectedBuoyant);
    expect(challenge.actualWeight).toBeCloseTo(expectedActual, 1);
    expect(challenge.buoyantForce).toBeCloseTo(expectedBuoyant, 1);
    expect(challenge.apparentWeight).toBeCloseTo(expectedApparent, 1);
    expect(challenge.targetValue).toBe(challenge.buoyantForce);
    expect(challenge.solveFor).toBe("buoyantForce");
  });

  it("given fields show the actual and apparent weight, never the buoyant force itself", () => {
    const challenge = generateArchimedesChallenge(ARCHIMEDES_CONCEPT_BUOYANT_FORCE, 0);
    const fields = givenFieldsForArchimedesChallenge(challenge);
    const labels = fields.map((f) => f.label);
    expect(labels).toContain("Weight in air");
    expect(labels).toContain("Apparent weight (submerged)");
    expect(labels.some((l) => l.toLowerCase().includes("buoyant"))).toBe(false);
  });
});

describe("Apparent Weight challenge - given mass/fluid density/displaced volume, find apparent weight", () => {
  it("the expected answer matches the physics module exactly", () => {
    const challenge = generateArchimedesChallenge(ARCHIMEDES_CONCEPT_APPARENT_WEIGHT, 1) as ArchimedesNumericChallenge;
    expect(challenge.targetValue).toBe(challenge.apparentWeight);
    expect(challenge.solveFor).toBe("apparentWeight");
    expect(challenge.displacedVolume).toBe(challenge.setup.objectVolume);
  });
});

describe("Displaced Volume challenge - given buoyant force + fluid density, find displaced volume", () => {
  it("the expected answer matches the physics module exactly", () => {
    const challenge = generateArchimedesChallenge(ARCHIMEDES_CONCEPT_DISPLACED_VOLUME, 2) as ArchimedesNumericChallenge;
    expect(challenge.targetValue).toBe(challenge.displacedVolume);
    expect(challenge.solveFor).toBe("displacedVolume");
    expect(challenge.unit).toBe("m³");
  });
});

describe("Fluid Density challenge - given buoyant force + displaced volume, find fluid density", () => {
  it("the expected answer matches the setup's own fluid density exactly", () => {
    const challenge = generateArchimedesChallenge(ARCHIMEDES_CONCEPT_FLUID_DENSITY, 1) as ArchimedesNumericChallenge;
    expect(challenge.targetValue).toBe(challenge.setup.fluidDensity);
    expect(challenge.solveFor).toBe("fluidDensity");
  });
});

describe("Float / Sink challenge - three clear choice options, never a text field", () => {
  it("object density below fluid density is FLOAT", () => {
    const challenge = generateArchimedesChallenge(ARCHIMEDES_CONCEPT_FLOAT_SINK, 0) as ArchimedesChoiceChallenge;
    expect(challenge.correctAnswer).toBe("FLOAT");
    expect(challenge.correctAnswer).toBe(floatingOutcome(challenge.objectDensity, challenge.setup.fluidDensity));
  });

  it("object density above fluid density is SINK", () => {
    const challenge = generateArchimedesChallenge(ARCHIMEDES_CONCEPT_FLOAT_SINK, 1) as ArchimedesChoiceChallenge;
    expect(challenge.correctAnswer).toBe("SINK");
  });

  it("equal densities are NEUTRAL", () => {
    const challenge = generateArchimedesChallenge(ARCHIMEDES_CONCEPT_FLOAT_SINK, 2) as ArchimedesChoiceChallenge;
    expect(challenge.correctAnswer).toBe("NEUTRAL");
    expect(challenge.objectDensity).toBeCloseTo(challenge.setup.fluidDensity, 5);
  });

  it("offers exactly the 3 documented options", () => {
    const challenge = generateArchimedesChallenge(ARCHIMEDES_CONCEPT_FLOAT_SINK, 0) as ArchimedesChoiceChallenge;
    expect(challenge.options).toEqual(["FLOAT", "SINK", "NEUTRAL"]);
  });
});

describe("validateArchimedesAnswer - never a string comparison for a numeric physics answer", () => {
  it("accepts a valid non-negative number", () => {
    expect(validateArchimedesAnswer("14.7")).toEqual({ value: 14.7 });
  });

  it("rejects empty input", () => {
    expect(validateArchimedesAnswer("")).toEqual({ error: expect.any(String) });
  });

  it("rejects non-numeric input", () => {
    expect(validateArchimedesAnswer("abc")).toEqual({ error: expect.any(String) });
  });

  it("rejects a negative value - mass/volume/density/force are never negative here", () => {
    expect(validateArchimedesAnswer("-5")).toEqual({ error: expect.any(String) });
  });

  it("rejects an unrealistically large value", () => {
    expect(validateArchimedesAnswer("99999999")).toEqual({ error: expect.any(String) });
  });
});

describe("evaluateArchimedesNumericAnswer - tolerance-gated numeric comparison, never string equality", () => {
  it("an answer within tolerance is correct", () => {
    const challenge = generateArchimedesChallenge(ARCHIMEDES_CONCEPT_BUOYANT_FORCE, 0) as ArchimedesNumericChallenge;
    const result = evaluateArchimedesNumericAnswer(challenge, challenge.targetValue);
    expect(result.correct).toBe(true);
  });

  it("an answer far outside tolerance is incorrect", () => {
    const challenge = generateArchimedesChallenge(ARCHIMEDES_CONCEPT_BUOYANT_FORCE, 0) as ArchimedesNumericChallenge;
    const result = evaluateArchimedesNumericAnswer(challenge, challenge.targetValue + 1000);
    expect(result.correct).toBe(false);
  });

  it("an answer just inside the tolerance boundary is correct", () => {
    const challenge = generateArchimedesChallenge(ARCHIMEDES_CONCEPT_BUOYANT_FORCE, 0) as ArchimedesNumericChallenge;
    const result = evaluateArchimedesNumericAnswer(challenge, challenge.targetValue + challenge.tolerance * 0.99);
    expect(result.correct).toBe(true);
  });
});

describe("evaluateArchimedesChoiceAnswer", () => {
  it("the correct choice succeeds; any other option fails", () => {
    const challenge = generateArchimedesChallenge(ARCHIMEDES_CONCEPT_FLOAT_SINK, 0) as ArchimedesChoiceChallenge;
    const correct = evaluateArchimedesChoiceAnswer(challenge, challenge.correctAnswer);
    expect(correct.correct).toBe(true);
    const wrongOption = challenge.options.find((o) => o !== challenge.correctAnswer)!;
    const wrong = evaluateArchimedesChoiceAnswer(challenge, wrongOption);
    expect(wrong.correct).toBe(false);
  });
});

describe("ArchimedesPlayState - READY / MEASURING_AIR / MEASURING_WATER / RESULT", () => {
  it("starts in READY", () => {
    expect(createArchimedesPlayState().phase).toBe("READY");
  });

  it("walks through the full measurement sequence before an answer can be submitted", () => {
    const challenge = generateArchimedesChallenge(ARCHIMEDES_CONCEPT_BUOYANT_FORCE, 0) as ArchimedesNumericChallenge;
    let state = createArchimedesPlayState();
    state = measureInAir(state);
    expect(state.phase).toBe("MEASURING_AIR");
    state = submergeObject(state);
    expect(state.phase).toBe("MEASURING_WATER");
    state = submitArchimedesNumericAnswer(state, challenge, challenge.targetValue);
    expect(state.phase).toBe("RESULT");
    expect(state.result?.correct).toBe(true);
  });

  it("an answer submitted before MEASURING_WATER is a no-op - the interaction can't be skipped", () => {
    const challenge = generateArchimedesChallenge(ARCHIMEDES_CONCEPT_BUOYANT_FORCE, 0) as ArchimedesNumericChallenge;
    const ready = createArchimedesPlayState();
    expect(submitArchimedesNumericAnswer(ready, challenge, challenge.targetValue)).toBe(ready);

    const afterAir = measureInAir(ready);
    expect(submitArchimedesNumericAnswer(afterAir, challenge, challenge.targetValue)).toBe(afterAir);
  });

  it("submergeObject is a no-op unless already MEASURING_AIR", () => {
    const ready = createArchimedesPlayState();
    expect(submergeObject(ready)).toBe(ready);
  });

  it("a choice challenge's answer is submitted through submitArchimedesChoiceAnswer the same way", () => {
    const challenge = generateArchimedesChallenge(ARCHIMEDES_CONCEPT_FLOAT_SINK, 0) as ArchimedesChoiceChallenge;
    let state = createArchimedesPlayState();
    state = measureInAir(state);
    state = submergeObject(state);
    state = submitArchimedesChoiceAnswer(state, challenge, challenge.correctAnswer);
    expect(state.phase).toBe("RESULT");
    expect(state.result?.correct).toBe(true);
  });

  it("resetArchimedesAttempt returns to READY, clears the result, and bumps attemptId - never touches the challenge itself", () => {
    const challenge = generateArchimedesChallenge(ARCHIMEDES_CONCEPT_BUOYANT_FORCE, 0) as ArchimedesNumericChallenge;
    let state = createArchimedesPlayState();
    state = measureInAir(state);
    state = submergeObject(state);
    state = submitArchimedesNumericAnswer(state, challenge, challenge.targetValue);
    const beforeReset = state;
    state = resetArchimedesAttempt(state);
    expect(state.phase).toBe("READY");
    expect(state.result).toBeNull();
    expect(state.attemptId).toBe(beforeReset.attemptId + 1);
  });

  it("reset works from any phase, not only RESULT", () => {
    const midFlight = measureInAir(createArchimedesPlayState());
    const reset = resetArchimedesAttempt(midFlight);
    expect(reset.phase).toBe("READY");
  });
});

describe("Archimedes challenge ids", () => {
  it("challenge ids are monotonically increasing and reset for tests", () => {
    const a = generateArchimedesChallenge(ARCHIMEDES_CONCEPT_BUOYANT_FORCE, 0);
    const b = generateArchimedesChallenge(ARCHIMEDES_CONCEPT_BUOYANT_FORCE, 0);
    expect(b.id).toBeGreaterThan(a.id);
    resetArchimedesChallengeIdSequenceForTests();
    const c = generateArchimedesChallenge(ARCHIMEDES_CONCEPT_BUOYANT_FORCE, 0);
    expect(c.id).toBe(1);
  });
});

describe("EARTH_GRAVITY is used consistently", () => {
  it("every generated setup uses the same real-world gravity constant", () => {
    for (const conceptId of [ARCHIMEDES_CONCEPT_BUOYANT_FORCE, ARCHIMEDES_CONCEPT_APPARENT_WEIGHT, ARCHIMEDES_CONCEPT_FLOAT_SINK] as const) {
      const challenge = generateArchimedesChallenge(conceptId, 0);
      expect(challenge.setup.gravity).toBe(EARTH_GRAVITY);
    }
  });
});

describe("ARCHIMEDES_FLUIDS - manual fluid selection data", () => {
  it("exposes exactly the 4 documented fluids at the documented densities", () => {
    expect(ARCHIMEDES_FLUIDS).toEqual([
      { name: "water", label: "Water", density: 1000 },
      { name: "salt water", label: "Salt Water", density: 1025 },
      { name: "olive oil", label: "Olive Oil", density: 920 },
      { name: "glycerin", label: "Glycerin", density: 1260 },
    ]);
  });
});

describe("initialFluidForChallenge - the fluid a challenge was actually generated with", () => {
  it("matches the challenge's own setup, for every concept", () => {
    for (const conceptId of [
      ARCHIMEDES_CONCEPT_BUOYANT_FORCE,
      ARCHIMEDES_CONCEPT_APPARENT_WEIGHT,
      ARCHIMEDES_CONCEPT_DISPLACED_VOLUME,
      ARCHIMEDES_CONCEPT_FLUID_DENSITY,
      ARCHIMEDES_CONCEPT_FLOAT_SINK,
    ]) {
      const challenge = generateArchimedesChallenge(conceptId, 1);
      const initial = initialFluidForChallenge(challenge);
      expect(initial.name).toBe(challenge.setup.fluidName);
      expect(initial.density).toBe(challenge.setup.fluidDensity);
    }
  });
});

describe("applyFluidToChallenge - manual fluid selection produces physically real changes", () => {
  it("preserves the challenge identity (id, conceptId, solveFor) and the object's own physical parameters", () => {
    const original = generateArchimedesChallenge(ARCHIMEDES_CONCEPT_BUOYANT_FORCE, 0) as ArchimedesNumericChallenge;
    const changed = applyFluidToChallenge(original, fluidNamed("glycerin")) as ArchimedesNumericChallenge;
    expect(changed.id).toBe(original.id);
    expect(changed.conceptId).toBe(original.conceptId);
    expect(changed.solveFor).toBe(original.solveFor);
    expect(changed.setup.mass).toBe(original.setup.mass);
    expect(changed.setup.objectVolume).toBe(original.setup.objectVolume);
  });

  it("a higher fluid density produces a greater buoyant force and a lower apparent weight", () => {
    const base = generateArchimedesChallenge(ARCHIMEDES_CONCEPT_APPARENT_WEIGHT, 0) as ArchimedesNumericChallenge;
    const inWater = applyFluidToChallenge(base, fluidNamed("water")) as ArchimedesNumericChallenge;
    const inGlycerin = applyFluidToChallenge(base, fluidNamed("glycerin")) as ArchimedesNumericChallenge;
    expect(inGlycerin.buoyantForce).toBeGreaterThan(inWater.buoyantForce);
    expect(inGlycerin.apparentWeight).toBeLessThan(inWater.apparentWeight);
    // Actual (in-air) weight never depends on the fluid - only mass/gravity do.
    expect(inGlycerin.actualWeight).toBe(inWater.actualWeight);
  });

  it("a lower fluid density produces a smaller buoyant force and a higher apparent weight", () => {
    const base = generateArchimedesChallenge(ARCHIMEDES_CONCEPT_APPARENT_WEIGHT, 0) as ArchimedesNumericChallenge;
    const inWater = applyFluidToChallenge(base, fluidNamed("water")) as ArchimedesNumericChallenge;
    const inOliveOil = applyFluidToChallenge(base, fluidNamed("olive oil")) as ArchimedesNumericChallenge;
    expect(inOliveOil.buoyantForce).toBeLessThan(inWater.buoyantForce);
    expect(inOliveOil.apparentWeight).toBeGreaterThan(inWater.apparentWeight);
  });

  it("every recomputed field matches archimedesPhysics.ts's own formulas exactly for the new fluid", () => {
    const base = generateArchimedesChallenge(ARCHIMEDES_CONCEPT_BUOYANT_FORCE, 2) as ArchimedesNumericChallenge;
    const saltWater = fluidNamed("salt water");
    const changed = applyFluidToChallenge(base, saltWater) as ArchimedesNumericChallenge;
    const expectedBuoyant = buoyantForce(saltWater.density, base.setup.gravity, base.setup.objectVolume);
    const expectedApparent = apparentWeight(weightFromMass(base.setup.mass, base.setup.gravity), expectedBuoyant);
    expect(changed.buoyantForce).toBeCloseTo(expectedBuoyant, 1);
    expect(changed.apparentWeight).toBeCloseTo(expectedApparent, 1);
    expect(changed.targetValue).toBe(changed.buoyantForce);
  });

  it("the FLUID_DENSITY concept's target tracks the newly selected fluid's own density", () => {
    const base = generateArchimedesChallenge(ARCHIMEDES_CONCEPT_FLUID_DENSITY, 0) as ArchimedesNumericChallenge;
    const changed = applyFluidToChallenge(base, fluidNamed("glycerin")) as ArchimedesNumericChallenge;
    expect(changed.targetValue).toBe(1260);
    expect(changed.setup.fluidDensity).toBe(1260);
  });

  it("displayed prompt text never mentions the old fluid after a fluid change - no stale challenge text", () => {
    const base = generateArchimedesChallenge(ARCHIMEDES_CONCEPT_BUOYANT_FORCE, 1) as ArchimedesNumericChallenge; // starts on "salt water"
    expect(base.setup.fluidName).toBe("salt water");
    const changed = applyFluidToChallenge(base, fluidNamed("water")) as ArchimedesNumericChallenge;
    expect(changed.prompt).toContain("water");
    expect(changed.prompt).not.toContain("salt water");
  });

  it("Float/Sink: preserves the object's own density but recomputes the correct float/sink answer for the new fluid", () => {
    // variant 5 generates an object exactly as dense as its original fluid
    // (salt water, 1025 kg/m^3) - a NEUTRAL case whose classification
    // against a DIFFERENT fluid depends entirely on that fluid's density.
    const base = generateArchimedesChallenge(ARCHIMEDES_CONCEPT_FLOAT_SINK, 5) as ArchimedesChoiceChallenge;
    expect(base.setup.fluidName).toBe("salt water");
    expect(base.correctAnswer).toBe("NEUTRAL");

    const inWater = applyFluidToChallenge(base, fluidNamed("water")) as ArchimedesChoiceChallenge;
    expect(inWater.objectDensity).toBe(base.objectDensity);
    expect(inWater.setup.mass).toBe(base.setup.mass);
    expect(inWater.correctAnswer).toBe(floatingOutcome(base.objectDensity, 1000));
    expect(inWater.correctAnswer).toBe("SINK");

    const inGlycerin = applyFluidToChallenge(base, fluidNamed("glycerin")) as ArchimedesChoiceChallenge;
    expect(inGlycerin.objectDensity).toBe(base.objectDensity);
    expect(inGlycerin.correctAnswer).toBe(floatingOutcome(base.objectDensity, 1260));
    expect(inGlycerin.correctAnswer).toBe("FLOAT");
  });

  it("cycling through every fluid transition never desyncs the challenge from its own setup", () => {
    let challenge: ArchimedesNumericChallenge = generateArchimedesChallenge(ARCHIMEDES_CONCEPT_BUOYANT_FORCE, 0) as ArchimedesNumericChallenge;
    const sequence = ["salt water", "olive oil", "glycerin", "water"];
    for (const name of sequence) {
      const fluid = fluidNamed(name);
      challenge = applyFluidToChallenge(challenge, fluid) as ArchimedesNumericChallenge;
      expect(challenge.setup.fluidDensity).toBe(fluid.density);
      expect(challenge.setup.fluidName).toBe(fluid.name);
      const expectedBuoyant = buoyantForce(fluid.density, challenge.setup.gravity, challenge.setup.objectVolume);
      expect(challenge.buoyantForce).toBeCloseTo(expectedBuoyant, 1);
    }
  });
});

describe("Reset + fluid interaction - reset restores the initial fluid without altering challenge identity", () => {
  it("resetArchimedesAttempt never touches setup/fluid - that stays the caller's (the scene's) responsibility", () => {
    const challenge = generateArchimedesChallenge(ARCHIMEDES_CONCEPT_BUOYANT_FORCE, 0) as ArchimedesNumericChallenge;
    let state = createArchimedesPlayState();
    state = measureInAir(state);
    state = submergeObject(state);
    state = submitArchimedesNumericAnswer(state, challenge, challenge.targetValue);
    const reset = resetArchimedesAttempt(state);
    expect(reset.phase).toBe("READY");
    expect(reset.result).toBeNull();
    // resetArchimedesAttempt is pure play-state machinery - it never receives
    // or mutates a challenge, so "restoring the initial fluid" is entirely a
    // matter of the caller re-applying initialFluidForChallenge, never a
    // second reset mechanism inside this module.
    expect(challenge.setup.fluidName).toBe("water");
  });

  it("re-applying the initial fluid after a fluid change reproduces the exact original challenge fields", () => {
    const original = generateArchimedesChallenge(ARCHIMEDES_CONCEPT_APPARENT_WEIGHT, 3) as ArchimedesNumericChallenge;
    const initialFluid = initialFluidForChallenge(original);
    const changedAway = applyFluidToChallenge(original, fluidNamed("glycerin")) as ArchimedesNumericChallenge;
    const restored = applyFluidToChallenge(changedAway, initialFluid) as ArchimedesNumericChallenge;
    expect(restored).toEqual(original);
  });

  it("a fluid change followed by reset never changes the challenge's id or conceptId - the same experiment, never a new one", () => {
    const original = generateArchimedesChallenge(ARCHIMEDES_CONCEPT_DISPLACED_VOLUME, 0) as ArchimedesNumericChallenge;
    const changedAway = applyFluidToChallenge(original, fluidNamed("olive oil")) as ArchimedesNumericChallenge;
    const restored = applyFluidToChallenge(changedAway, initialFluidForChallenge(original)) as ArchimedesNumericChallenge;
    expect(restored.id).toBe(original.id);
    expect(restored.conceptId).toBe(original.conceptId);
  });
});
