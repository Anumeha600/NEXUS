import { describe, it, expect } from "vitest";
import { AdaptiveEngine, MODULE_GRAVITATION, CONCEPT_GRAVITATIONAL_FORCE, CONCEPT_ORBITAL_VELOCITY, CONCEPT_ESCAPE_VELOCITY, type Challenge } from "./adaptiveEngine";
import { GRAVITY_SIM_G, gravitationalForce, orbitalVelocity, escapeVelocity } from "./physics";
import type { GravitationSimStatus } from "./gravitationSim";
import {
  gravitationSimSetupFor,
  createGravitationPlayState,
  setGravitationVelocity,
  launchGravitationAttempt,
  applyGravitationSimStatus,
  resetGravitationAttempt,
  areGravitationControlsLocked,
} from "./gravitationChallenge";

// Same helper pattern adaptiveEngine.test.ts itself uses to force a specific
// concept/tier in isolation (mastery 0.1/0.5/0.9 -> Beginner/Intermediate/
// Advanced) - MODULE_GRAVITATION is excluded from MODULE_SEQUENCE, but
// directly instantiating the engine against it is the same pattern Layer 1's
// own tests use.
function gravitationChallenge(conceptId: string, mastery: number): Challenge {
  const engine = new AdaptiveEngine();
  engine.currentModuleId = MODULE_GRAVITATION;
  engine.currentConceptId = conceptId;
  engine.conceptMastery[conceptId] = mastery;
  return engine.generateNextChallenge();
}

describe("gravitationSimSetupFor - challenge -> simulation configuration mapping", () => {
  describe("Gravitational Force", () => {
    it("Beginner (solve for force): starMass/orbitalRadius come straight from the challenge", () => {
      const c = gravitationChallenge(CONCEPT_GRAVITATIONAL_FORCE, 0.1);
      const setup = gravitationSimSetupFor(c);
      expect(setup.starMass).toBe(c.starMass);
      expect(setup.orbitalRadius).toBe(c.distanceFromStar);
      expect(setup.targetValue).toBe(c.targetGravitationalForce);
      expect(setup.targetUnit).toBe(c.unit);
    });

    it("Intermediate (solve for distance): orbitalRadius is recovered from F = GMm/r^2, and reproduces the same target force", () => {
      const c = gravitationChallenge(CONCEPT_GRAVITATIONAL_FORCE, 0.5);
      expect(c.distanceFromStar).toBeUndefined();
      const setup = gravitationSimSetupFor(c);
      expect(setup.starMass).toBe(c.starMass);
      expect(setup.orbitalRadius).toBeGreaterThan(0);
      const impliedForce = gravitationalForce(GRAVITY_SIM_G, c.starMass!, c.planetMass!, setup.orbitalRadius);
      expect(impliedForce).toBeCloseTo(c.targetGravitationalForce!, 1);
    });

    it("Advanced (solve for planetMass): orbitalRadius is simply the challenge's own distanceFromStar (planetMass doesn't affect the sim)", () => {
      const c = gravitationChallenge(CONCEPT_GRAVITATIONAL_FORCE, 0.9);
      expect(c.planetMass).toBeUndefined();
      const setup = gravitationSimSetupFor(c);
      expect(setup.starMass).toBe(c.starMass);
      expect(setup.orbitalRadius).toBe(c.distanceFromStar);
    });
  });

  describe("Orbital Velocity", () => {
    it("Beginner (solve for velocity): starMass/orbitalRadius come straight from the challenge, default velocity matches the target", () => {
      const c = gravitationChallenge(CONCEPT_ORBITAL_VELOCITY, 0.1);
      const setup = gravitationSimSetupFor(c);
      expect(setup.starMass).toBe(c.starMass);
      expect(setup.orbitalRadius).toBe(c.distanceFromStar);
      expect(setup.defaultInitialVelocity).toBeCloseTo(c.targetOrbitalVelocity!, 1);
    });

    it("Intermediate (solve for distance): orbitalRadius is recovered from v_orbit = sqrt(GM/r) and reproduces the same target velocity", () => {
      const c = gravitationChallenge(CONCEPT_ORBITAL_VELOCITY, 0.5);
      expect(c.distanceFromStar).toBeUndefined();
      const setup = gravitationSimSetupFor(c);
      expect(setup.starMass).toBe(c.starMass);
      const impliedVelocity = orbitalVelocity(GRAVITY_SIM_G, c.starMass!, setup.orbitalRadius);
      expect(impliedVelocity).toBeCloseTo(c.targetOrbitalVelocity!, 1);
    });

    it("Advanced (solve for starMass): starMass is recovered from v_orbit = sqrt(GM/r) and reproduces the same target velocity", () => {
      const c = gravitationChallenge(CONCEPT_ORBITAL_VELOCITY, 0.9);
      expect(c.starMass).toBeUndefined();
      const setup = gravitationSimSetupFor(c);
      expect(setup.orbitalRadius).toBe(c.distanceFromStar);
      const impliedVelocity = orbitalVelocity(GRAVITY_SIM_G, setup.starMass, c.distanceFromStar!);
      expect(impliedVelocity).toBeCloseTo(c.targetOrbitalVelocity!, 1);
    });
  });

  describe("Escape Velocity", () => {
    it("Beginner (solve for velocity): starMass/orbitalRadius come straight from the challenge", () => {
      const c = gravitationChallenge(CONCEPT_ESCAPE_VELOCITY, 0.1);
      const setup = gravitationSimSetupFor(c);
      expect(setup.starMass).toBe(c.starMass);
      expect(setup.orbitalRadius).toBe(c.distanceFromStar);
    });

    it("Intermediate (solve for distance): orbitalRadius is recovered from v_escape = sqrt(2GM/r) and reproduces the same target velocity", () => {
      const c = gravitationChallenge(CONCEPT_ESCAPE_VELOCITY, 0.5);
      expect(c.distanceFromStar).toBeUndefined();
      const setup = gravitationSimSetupFor(c);
      const impliedVelocity = escapeVelocity(GRAVITY_SIM_G, c.starMass!, setup.orbitalRadius);
      expect(impliedVelocity).toBeCloseTo(c.targetEscapeVelocity!, 1);
    });

    it("Advanced (solve for starMass): starMass is recovered from v_escape = sqrt(2GM/r) and reproduces the same target velocity", () => {
      const c = gravitationChallenge(CONCEPT_ESCAPE_VELOCITY, 0.9);
      expect(c.starMass).toBeUndefined();
      const setup = gravitationSimSetupFor(c);
      const impliedVelocity = escapeVelocity(GRAVITY_SIM_G, setup.starMass, c.distanceFromStar!);
      expect(impliedVelocity).toBeCloseTo(c.targetEscapeVelocity!, 1);
    });
  });

  it("every setup's velocity range covers fall, orbit, ellipse, and escape (min is 0, max comfortably exceeds escape velocity)", () => {
    for (const [conceptId, mastery] of [
      [CONCEPT_GRAVITATIONAL_FORCE, 0.1],
      [CONCEPT_ORBITAL_VELOCITY, 0.5],
      [CONCEPT_ESCAPE_VELOCITY, 0.9],
    ] as const) {
      const c = gravitationChallenge(conceptId, mastery);
      const setup = gravitationSimSetupFor(c);
      const vEscape = escapeVelocity(GRAVITY_SIM_G, setup.starMass, setup.orbitalRadius);
      expect(setup.minVelocity).toBe(0);
      expect(setup.maxVelocity).toBeGreaterThan(vEscape);
      expect(setup.defaultInitialVelocity).toBeGreaterThan(setup.minVelocity);
      expect(setup.defaultInitialVelocity).toBeLessThan(setup.maxVelocity);
      expect(setup.promptLabel.length).toBeGreaterThan(0);
    }
  });
});

describe("gravitation play state machine (READY / RUNNING / OUTCOME)", () => {
  function setupFor(mastery: number) {
    return gravitationSimSetupFor(gravitationChallenge(CONCEPT_ORBITAL_VELOCITY, mastery));
  }

  it("starts in READY with the setup's default initial velocity - the initial velocity is passed correctly into play state", () => {
    const setup = setupFor(0.1);
    const state = createGravitationPlayState(setup);
    expect(state.phase).toBe("READY");
    expect(state.velocity).toBe(setup.defaultInitialVelocity);
    expect(state.attemptId).toBe(0);
    expect(state.outcomeStatus).toBeNull();
  });

  it("setGravitationVelocity updates velocity while READY", () => {
    const setup = setupFor(0.1);
    let state = createGravitationPlayState(setup);
    state = setGravitationVelocity(state, 7.25);
    expect(state.velocity).toBe(7.25);
  });

  it("launch transitions READY -> RUNNING", () => {
    const setup = setupFor(0.1);
    let state = createGravitationPlayState(setup);
    expect(state.phase).toBe("READY");
    state = launchGravitationAttempt(state);
    expect(state.phase).toBe("RUNNING");
  });

  it("controls are unavailable (locked) while RUNNING - velocity changes are ignored and launching again is a no-op", () => {
    const setup = setupFor(0.1);
    let state = createGravitationPlayState(setup);
    state = launchGravitationAttempt(state);
    expect(areGravitationControlsLocked(state)).toBe(true);

    const beforeVelocity = state.velocity;
    state = setGravitationVelocity(state, beforeVelocity + 50);
    expect(state.velocity).toBe(beforeVelocity);

    const relaunched = launchGravitationAttempt(state);
    expect(relaunched).toEqual(state);
  });

  it("controls are unlocked in READY", () => {
    const setup = setupFor(0.1);
    const state = createGravitationPlayState(setup);
    expect(areGravitationControlsLocked(state)).toBe(false);
  });

  it.each([["collision"], ["orbit"], ["escape"]] as [GravitationSimStatus][])(
    "simulation outcome '%s' is surfaced correctly: RUNNING -> OUTCOME with that status recorded",
    (status) => {
      const setup = setupFor(0.1);
      let state = createGravitationPlayState(setup);
      state = launchGravitationAttempt(state);
      state = applyGravitationSimStatus(state, status);
      expect(state.phase).toBe("OUTCOME");
      expect(state.outcomeStatus).toBe(status);
    },
  );

  it("intermediate 'running' status while RUNNING does not end the attempt", () => {
    const setup = setupFor(0.1);
    let state = createGravitationPlayState(setup);
    state = launchGravitationAttempt(state);
    state = applyGravitationSimStatus(state, "running");
    expect(state.phase).toBe("RUNNING");
    expect(state.outcomeStatus).toBeNull();
  });

  it("a status change while still READY (before launch) is ignored", () => {
    const setup = setupFor(0.1);
    let state = createGravitationPlayState(setup);
    state = applyGravitationSimStatus(state, "collision");
    expect(state.phase).toBe("READY");
    expect(state.outcomeStatus).toBeNull();
  });

  it("reset returns OUTCOME to READY, restores the default velocity, clears the outcome, and bumps attemptId", () => {
    const setup = setupFor(0.1);
    let state = createGravitationPlayState(setup);
    state = launchGravitationAttempt(state);
    state = applyGravitationSimStatus(state, "collision");
    expect(state.phase).toBe("OUTCOME");

    const reset = resetGravitationAttempt(state, setup);
    expect(reset.phase).toBe("READY");
    expect(reset.velocity).toBe(setup.defaultInitialVelocity);
    expect(reset.outcomeStatus).toBeNull();
    expect(reset.attemptId).toBe(state.attemptId + 1);
  });

  it("running the same launch/outcome/reset sequence twice is deterministic", () => {
    const setup = setupFor(0.5);
    function runOnce() {
      let s = createGravitationPlayState(setup);
      s = setGravitationVelocity(s, setup.defaultInitialVelocity * 0.5);
      s = launchGravitationAttempt(s);
      s = applyGravitationSimStatus(s, "collision");
      return resetGravitationAttempt(s, setup);
    }
    expect(runOnce()).toEqual(runOnce());
  });
});
