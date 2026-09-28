// --------------------------------------------------------------------------
// HowToPlay - one shared "?" help component for every module
//
// This only tests the content data (hasHowToPlayContent), not rendering -
// there's no component-rendering harness in this repo (see the project's
// notes on that gap). What matters for correctness here is that every
// currently playable module actually has an entry, so HowToPlay never
// silently shows a "?" button with nothing behind it.
// --------------------------------------------------------------------------
import { describe, it, expect } from "vitest";
import { MODULE_PROJECTILE, MODULE_NEWTON, MODULE_WORK_ENERGY, MODULE_MOMENTUM, MODULE_CIRCULAR, MODULE_GRAVITATION, MODULE_WAVES } from "./adaptiveEngine";
import { hasHowToPlayContent } from "./HowToPlay";

const PLAYABLE_MODULES = [MODULE_PROJECTILE, MODULE_NEWTON, MODULE_WORK_ENERGY, MODULE_MOMENTUM, MODULE_CIRCULAR];

describe("HowToPlay content", () => {
  it("every currently playable module has How to Play content", () => {
    for (const moduleId of PLAYABLE_MODULES) {
      expect(hasHowToPlayContent(moduleId), `${moduleId} should have How to Play content`).toBe(true);
    }
  });

  it("Projectile Motion has help content", () => {
    expect(hasHowToPlayContent(MODULE_PROJECTILE)).toBe(true);
  });

  it("Newton's Laws has help content", () => {
    expect(hasHowToPlayContent(MODULE_NEWTON)).toBe(true);
  });

  it("Work & Energy has help content", () => {
    expect(hasHowToPlayContent(MODULE_WORK_ENERGY)).toBe(true);
  });

  it("Momentum & Collisions has help content", () => {
    expect(hasHowToPlayContent(MODULE_MOMENTUM)).toBe(true);
  });

  it("Circular Motion has help content", () => {
    expect(hasHowToPlayContent(MODULE_CIRCULAR)).toBe(true);
  });

  it("an unrecognized module id has no help content, rather than falling back to something misleading", () => {
    expect(hasHowToPlayContent("not-a-real-module")).toBe(false);
  });

  // Gravitation is not in PLAYABLE_MODULES above because it isn't reachable
  // through GameCanvas.tsx/MODULE_SEQUENCE yet - but its own standalone
  // GravitationChallengeScene already renders this shared component, so its
  // content must exist too.
  it("Gravitation & Orbits has help content, for its standalone GravitationChallengeScene", () => {
    expect(hasHowToPlayContent(MODULE_GRAVITATION)).toBe(true);
  });

  // Wave Motion is not in PLAYABLE_MODULES either, for the same reason as
  // Gravitation - its own standalone WavesChallengeScene renders this shared
  // component, so its content must exist too.
  it("Wave Motion has help content, for its standalone WavesChallengeScene", () => {
    expect(hasHowToPlayContent(MODULE_WAVES)).toBe(true);
  });
});
