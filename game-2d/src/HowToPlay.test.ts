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
import { MODULE_PROJECTILE, MODULE_NEWTON, MODULE_WORK_ENERGY, MODULE_MOMENTUM, MODULE_CIRCULAR } from "./adaptiveEngine";
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
});
