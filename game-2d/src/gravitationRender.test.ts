import { describe, it, expect } from "vitest";
import { GRAVITY_SIM_G, orbitalVelocity, escapeVelocity, gravitationalAccelerationVector } from "./physics";
import { createGravitationSimState, stepGravitationSim, type GravitationSimState } from "./gravitationSim";
import { computeGravitationViewTransform, physicsToScreen, physicsVectorToScreen } from "./gravitationRender";

const STAR_MASS = 100;
const RADIUS = 5;
const V_ORBIT = orbitalVelocity(GRAVITY_SIM_G, STAR_MASS, RADIUS);
const V_ESCAPE = escapeVelocity(GRAVITY_SIM_G, STAR_MASS, RADIUS);
const W = 800;
const H = 500;

function runSteps(state: GravitationSimState, count: number): GravitationSimState {
  let s = state;
  for (let i = 0; i < count; i++) s = stepGravitationSim(s);
  return s;
}

describe("gravitationRender - physics-to-screen transform", () => {
  it("keeps the star (physics-space origin) exactly centered in the viewport", () => {
    const state = createGravitationSimState({ starMass: STAR_MASS, orbitalRadius: RADIUS, initialVelocity: V_ORBIT });
    const transform = computeGravitationViewTransform(W, H, state);
    expect(transform.centerX).toBe(W / 2);
    expect(transform.centerY).toBe(H / 2);
    const starScreen = physicsToScreen(transform, state.config.starX, state.config.starY);
    expect(starScreen.x).toBe(W / 2);
    expect(starScreen.y).toBe(H / 2);
  });

  it("stays centered and produces a positive scale across the fall/orbit/ellipse/escape regimes", () => {
    const scenarios = [
      { label: "fall", v: V_ORBIT * 0.2, steps: 50 },
      { label: "circular", v: V_ORBIT, steps: 200 },
      { label: "elliptical", v: V_ORBIT * 1.15, steps: 200 },
      { label: "escape", v: V_ESCAPE * 1.2, steps: 200 },
    ];
    for (const { v, steps } of scenarios) {
      const state = runSteps(createGravitationSimState({ starMass: STAR_MASS, orbitalRadius: RADIUS, initialVelocity: v }), steps);
      const transform = computeGravitationViewTransform(W, H, state);
      expect(transform.centerX).toBe(W / 2);
      expect(transform.centerY).toBe(H / 2);
      expect(transform.scale).toBeGreaterThan(0);
      expect(Number.isFinite(transform.scale)).toBe(true);
    }
  });

  it("transforms trajectory points consistently: relative screen-space distances scale linearly with physics-space distances", () => {
    const state = runSteps(createGravitationSimState({ starMass: STAR_MASS, orbitalRadius: RADIUS, initialVelocity: V_ORBIT * 1.15 }), 300);
    const transform = computeGravitationViewTransform(W, H, state);
    expect(state.trajectory.length).toBeGreaterThan(2);

    for (let i = 1; i < state.trajectory.length; i++) {
      const a = state.trajectory[i - 1];
      const b = state.trajectory[i];
      const physicsDist = Math.hypot(b.x - a.x, b.y - a.y);
      const sa = physicsToScreen(transform, a.x, a.y);
      const sb = physicsToScreen(transform, b.x, b.y);
      const screenDist = Math.hypot(sb.x - sa.x, sb.y - sa.y);
      expect(screenDist).toBeCloseTo(physicsDist * transform.scale, 6);
    }

    // Mapping the same physics point twice is deterministic.
    const p = state.trajectory[0];
    expect(physicsToScreen(transform, p.x, p.y)).toEqual(physicsToScreen(transform, p.x, p.y));
  });

  it("preserves velocity vector direction exactly (a pure positive scale introduces no rotation or flip)", () => {
    const state = runSteps(createGravitationSimState({ starMass: STAR_MASS, orbitalRadius: RADIUS, initialVelocity: V_ORBIT * 1.15 }), 50);
    const transform = computeGravitationViewTransform(W, H, state);
    const physicsAngle = Math.atan2(state.planetVy, state.planetVx);
    const screenVector = physicsVectorToScreen(transform, state.planetVx, state.planetVy);
    const screenAngle = Math.atan2(screenVector.y, screenVector.x);
    expect(screenAngle).toBeCloseTo(physicsAngle, 10);
    expect(Math.hypot(screenVector.x, screenVector.y)).toBeCloseTo(Math.hypot(state.planetVx, state.planetVy) * transform.scale, 8);
  });

  it("the gravity vector (from gravitationalAccelerationVector) points from the planet toward the star, in both physics- and screen-space", () => {
    const state = runSteps(createGravitationSimState({ starMass: STAR_MASS, orbitalRadius: RADIUS, initialVelocity: V_ORBIT * 1.15 }), 50);
    const { ax, ay } = gravitationalAccelerationVector(state.config.G, state.config.starMass, state.planetX, state.planetY);

    // Physics-space: the acceleration direction must be the unit vector from
    // the planet toward the origin (the star).
    const r = Math.hypot(state.planetX, state.planetY);
    const accelMag = Math.hypot(ax, ay);
    expect(ax / accelMag).toBeCloseTo(-state.planetX / r, 8);
    expect(ay / accelMag).toBeCloseTo(-state.planetY / r, 8);

    // Screen-space: since the transform is a pure positive scale, the
    // gravity arrow's screen direction must point from the planet's screen
    // position toward the star's screen position too.
    const transform = computeGravitationViewTransform(W, H, state);
    const planetScreen = physicsToScreen(transform, state.planetX, state.planetY);
    const starScreen = physicsToScreen(transform, state.config.starX, state.config.starY);
    const gravityScreen = physicsVectorToScreen(transform, ax, ay);
    const angleToStar = Math.atan2(starScreen.y - planetScreen.y, starScreen.x - planetScreen.x);
    const gravityAngle = Math.atan2(gravityScreen.y, gravityScreen.x);
    expect(gravityAngle).toBeCloseTo(angleToStar, 8);
  });

  it("never produces NaN or Infinity for valid simulation states, including terminal collision/orbit/escape states", () => {
    const terminalScenarios = [
      { v: V_ORBIT * 0.2, expectStatus: "collision" as const },
      { v: V_ORBIT, expectStatus: "orbit" as const },
      { v: V_ESCAPE * 1.2, expectStatus: "escape" as const },
    ];

    const statesToCheck: GravitationSimState[] = [createGravitationSimState({ starMass: STAR_MASS, orbitalRadius: RADIUS, initialVelocity: V_ORBIT })];

    for (const { v, expectStatus } of terminalScenarios) {
      let s = createGravitationSimState({ starMass: STAR_MASS, orbitalRadius: RADIUS, initialVelocity: v });
      for (let i = 0; i < 5000 && s.status !== expectStatus; i++) s = stepGravitationSim(s);
      expect(s.status).toBe(expectStatus);
      statesToCheck.push(s);
    }

    for (const state of statesToCheck) {
      const transform = computeGravitationViewTransform(W, H, state);
      expect(Number.isFinite(transform.scale)).toBe(true);
      expect(Number.isFinite(transform.centerX)).toBe(true);
      expect(Number.isFinite(transform.centerY)).toBe(true);

      const star = physicsToScreen(transform, state.config.starX, state.config.starY);
      const planet = physicsToScreen(transform, state.planetX, state.planetY);
      expect(Number.isFinite(star.x)).toBe(true);
      expect(Number.isFinite(star.y)).toBe(true);
      expect(Number.isFinite(planet.x)).toBe(true);
      expect(Number.isFinite(planet.y)).toBe(true);

      for (const point of state.trajectory) {
        const p = physicsToScreen(transform, point.x, point.y);
        expect(Number.isFinite(p.x)).toBe(true);
        expect(Number.isFinite(p.y)).toBe(true);
      }

      const { ax, ay } = gravitationalAccelerationVector(state.config.G, state.config.starMass, state.planetX, state.planetY);
      const gravityScreen = physicsVectorToScreen(transform, ax, ay);
      expect(Number.isFinite(gravityScreen.x)).toBe(true);
      expect(Number.isFinite(gravityScreen.y)).toBe(true);
    }
  });
});
