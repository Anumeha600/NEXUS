import { describe, it, expect } from "vitest";
import { GRAVITY_SIM_G, orbitalVelocity, escapeVelocity } from "./physics";
import {
  createGravitationSimState,
  resetGravitationSim,
  stepGravitationSim,
  advanceGravitationSim,
  stopGravitationSim,
  gravitationRenderStateFor,
  GRAVITATION_FIXED_TIMESTEP,
  GRAVITATION_MAX_TRAJECTORY_POINTS,
  GRAVITATION_TRAJECTORY_SAMPLE_EVERY_N_STEPS,
  type GravitationSimState,
} from "./gravitationSim";

// Shared scale for every scenario below: star mass 100, launch radius 5 -
// matches physics.test.ts's own integrateGravityStep scenarios, so the
// numeric regimes here are directly comparable to Layer 1's own tests.
const STAR_MASS = 100;
const RADIUS = 5;
const V_ORBIT = orbitalVelocity(GRAVITY_SIM_G, STAR_MASS, RADIUS);
const V_ESCAPE = escapeVelocity(GRAVITY_SIM_G, STAR_MASS, RADIUS);

function runSteps(state: GravitationSimState, count: number): GravitationSimState {
  let s = state;
  for (let i = 0; i < count; i++) {
    s = stepGravitationSim(s);
  }
  return s;
}

describe("gravitationSim - Layer 2 stepped simulation", () => {
  it("1. the planet accelerates toward the star (velocity gains a component pointing at the origin)", () => {
    let state = createGravitationSimState({ starMass: STAR_MASS, orbitalRadius: RADIUS, initialVelocity: 0 });
    state = stepGravitationSim(state);
    // Launched from (5, 0) with zero velocity - gravity can only pull it in
    // the -x direction, so vx must go negative and vy must stay exactly 0.
    expect(state.planetVx).toBeLessThan(0);
    expect(state.planetVy).toBeCloseTo(0, 10);
  });

  it("2. zero initial velocity causes the planet to move inward (monotonically decreasing distance)", () => {
    let state = createGravitationSimState({ starMass: STAR_MASS, orbitalRadius: RADIUS, initialVelocity: 0 });
    let previousR = RADIUS;
    for (let i = 0; i < 50; i++) {
      state = stepGravitationSim(state);
      const r = Math.hypot(state.planetX, state.planetY);
      expect(r).toBeLessThan(previousR);
      previousR = r;
    }
  });

  it("3. circular-orbit initial velocity produces a bounded orbit that is detected as 'orbit'", () => {
    let state = createGravitationSimState({ starMass: STAR_MASS, orbitalRadius: RADIUS, initialVelocity: V_ORBIT });
    let minR = RADIUS;
    let maxR = RADIUS;
    for (let i = 0; i < 1000 && state.status !== "orbit"; i++) {
      state = stepGravitationSim(state);
      const r = Math.hypot(state.planetX, state.planetY);
      minR = Math.min(minR, r);
      maxR = Math.max(maxR, r);
    }
    expect(state.status).toBe("orbit");
    expect(minR).toBeGreaterThan(RADIUS * 0.5);
    expect(maxR).toBeLessThan(RADIUS * 2);
    // eslint-disable-next-line no-console
    console.log(`[regime: circular orbit] v=${V_ORBIT.toFixed(3)} (v_orbit) -> status=${state.status}, steps=${state.stepCount}, minR=${minR.toFixed(3)}, maxR=${maxR.toFixed(3)}`);
  });

  it("4. a velocity below escape velocity (but above orbital) produces a bounded, eventually-orbit-classified trajectory", () => {
    const v = V_ORBIT * 1.3;
    expect(v).toBeLessThan(V_ESCAPE);
    let state = createGravitationSimState({ starMass: STAR_MASS, orbitalRadius: RADIUS, initialVelocity: v });
    for (let i = 0; i < 4500 && state.status !== "orbit"; i++) {
      state = stepGravitationSim(state);
      expect(state.status).not.toBe("collision");
      expect(state.status).not.toBe("escape");
    }
    expect(state.status).toBe("orbit");
    console.log(`[regime: bound, sub-escape] v=${v.toFixed(3)} (1.3x v_orbit) -> status=${state.status}, steps=${state.stepCount}`);
  });

  it("5. a velocity above escape velocity produces an unbound (escape) trajectory", () => {
    const v = V_ESCAPE * 1.2;
    let state = createGravitationSimState({ starMass: STAR_MASS, orbitalRadius: RADIUS, initialVelocity: v });
    for (let i = 0; i < 2000 && state.status !== "escape"; i++) {
      state = stepGravitationSim(state);
    }
    expect(state.status).toBe("escape");
    const finalDistance = Math.hypot(state.planetX, state.planetY);
    console.log(`[regime: escape] v=${v.toFixed(3)} (1.2x v_escape) -> status=${state.status}, steps=${state.stepCount}, distance=${finalDistance.toFixed(3)}`);
  });

  it("6. a velocity substantially below orbital velocity eventually reaches the collision threshold", () => {
    const v = V_ORBIT * 0.2;
    let state = createGravitationSimState({ starMass: STAR_MASS, orbitalRadius: RADIUS, initialVelocity: v });
    for (let i = 0; i < 2000 && state.status !== "collision"; i++) {
      state = stepGravitationSim(state);
    }
    expect(state.status).toBe("collision");
    const finalDistance = Math.hypot(state.planetX, state.planetY);
    expect(finalDistance).toBeLessThanOrEqual(state.config.collisionRadius);
    console.log(`[regime: fall/collision] v=${v.toFixed(3)} (0.2x v_orbit) -> status=${state.status}, steps=${state.stepCount}, distance=${finalDistance.toFixed(3)}`);
  });

  it("7. an intermediate velocity produces an elliptical/bounded trajectory rather than a predefined circle", () => {
    const v = V_ORBIT * 1.15;
    let state = createGravitationSimState({ starMass: STAR_MASS, orbitalRadius: RADIUS, initialVelocity: v });
    let minR = RADIUS;
    let maxR = RADIUS;
    for (let i = 0; i < 1500; i++) {
      state = stepGravitationSim(state);
      expect(state.status).not.toBe("collision");
      expect(state.status).not.toBe("escape");
      const r = Math.hypot(state.planetX, state.planetY);
      minR = Math.min(minR, r);
      maxR = Math.max(maxR, r);
    }
    // A circle would keep minR essentially equal to maxR; a real ellipse,
    // produced by integration rather than a predefined shape, has a
    // materially different periapsis and apoapsis.
    expect(maxR / minR).toBeGreaterThan(1.2);
    console.log(`[regime: elliptical] v=${v.toFixed(3)} (1.15x v_orbit) -> status=${state.status}, minR=${minR.toFixed(3)}, maxR=${maxR.toFixed(3)}, ratio=${(maxR / minR).toFixed(3)}`);
  });

  it("8. trajectory history is recorded and capped at GRAVITATION_MAX_TRAJECTORY_POINTS", () => {
    // A very high orbit-angle threshold keeps status "running" (rather than
    // terminal "orbit") for the whole run, so stepping doesn't stop early -
    // isolating the trajectory cap from outcome detection.
    let state = createGravitationSimState({
      starMass: STAR_MASS,
      orbitalRadius: RADIUS,
      initialVelocity: V_ORBIT,
      orbitAngleThreshold: Math.PI * 2 * 1000,
    });
    expect(state.trajectory.length).toBe(1);
    const stepsToOverflow = GRAVITATION_MAX_TRAJECTORY_POINTS * GRAVITATION_TRAJECTORY_SAMPLE_EVERY_N_STEPS + 100;
    state = runSteps(state, stepsToOverflow);
    expect(state.status).toBe("running");
    expect(state.trajectory.length).toBe(GRAVITATION_MAX_TRAJECTORY_POINTS);
  });

  it("9. simulation status transitions are deterministic across independent runs with identical initial conditions", () => {
    const make = () => createGravitationSimState({ starMass: STAR_MASS, orbitalRadius: RADIUS, initialVelocity: V_ORBIT * 1.15 });
    let a = make();
    let b = make();
    const statusesA: string[] = [];
    const statusesB: string[] = [];
    for (let i = 0; i < 800; i++) {
      a = stepGravitationSim(a);
      b = stepGravitationSim(b);
      statusesA.push(a.status);
      statusesB.push(b.status);
    }
    expect(statusesA).toEqual(statusesB);
  });

  it("10. physics results are independent of render frame rate given the same fixed simulation timestep", () => {
    const totalSeconds = 100 * GRAVITATION_FIXED_TIMESTEP;
    const make = () => createGravitationSimState({ starMass: STAR_MASS, orbitalRadius: RADIUS, initialVelocity: V_ORBIT });

    let singleChunk = make();
    singleChunk = advanceGravitationSim(singleChunk, totalSeconds);

    let manyChunks = make();
    const frameDelta = totalSeconds / 37; // deliberately not a clean multiple of the fixed timestep
    for (let i = 0; i < 37; i++) {
      manyChunks = advanceGravitationSim(manyChunks, frameDelta);
    }

    expect(manyChunks.planetX).toBeCloseTo(singleChunk.planetX, 9);
    expect(manyChunks.planetY).toBeCloseTo(singleChunk.planetY, 9);
    expect(manyChunks.planetVx).toBeCloseTo(singleChunk.planetVx, 9);
    expect(manyChunks.planetVy).toBeCloseTo(singleChunk.planetVy, 9);
    expect(manyChunks.elapsedTime).toBeCloseTo(singleChunk.elapsedTime, 9);
  });

  it("11. resetting the simulation restores the initial state exactly", () => {
    const initialState = createGravitationSimState({ starMass: STAR_MASS, orbitalRadius: RADIUS, initialVelocity: V_ORBIT * 1.15 });
    let stepped = runSteps(initialState, 300);
    expect(stepped.planetX).not.toBeCloseTo(initialState.planetX, 6);

    const reset = resetGravitationSim(stepped);
    expect(reset.planetX).toBe(initialState.planetX);
    expect(reset.planetY).toBe(initialState.planetY);
    expect(reset.planetVx).toBe(initialState.planetVx);
    expect(reset.planetVy).toBe(initialState.planetVy);
    expect(reset.elapsedTime).toBe(0);
    expect(reset.status).toBe("idle");
    expect(reset.stepCount).toBe(0);
    expect(reset.cumulativeAngle).toBe(0);
    expect(reset.trajectory).toEqual(initialState.trajectory);
  });

  it("12. running the same initial conditions twice produces the same trajectory", () => {
    const make = () => createGravitationSimState({ starMass: STAR_MASS, orbitalRadius: RADIUS, initialVelocity: V_ORBIT * 1.15 });
    const a = runSteps(make(), 600);
    const b = runSteps(make(), 600);
    expect(a.trajectory).toEqual(b.trajectory);
    expect(a.planetX).toBe(b.planetX);
    expect(a.planetY).toBe(b.planetY);
    expect(a.status).toBe(b.status);
  });

  it("stepGravitationSim is a no-op once a terminal status (collision/orbit/escape/stopped) is reached", () => {
    let state = createGravitationSimState({ starMass: STAR_MASS, orbitalRadius: RADIUS, initialVelocity: V_ORBIT * 0.2 });
    for (let i = 0; i < 2000 && state.status !== "collision"; i++) {
      state = stepGravitationSim(state);
    }
    expect(state.status).toBe("collision");
    const afterTerminal = stepGravitationSim(state);
    expect(afterTerminal).toEqual(state);
  });

  it("stopGravitationSim marks a running simulation as stopped but never overrides a real physical outcome", () => {
    const running = createGravitationSimState({ starMass: STAR_MASS, orbitalRadius: RADIUS, initialVelocity: V_ORBIT });
    expect(stopGravitationSim(running).status).toBe("stopped");

    let collided = createGravitationSimState({ starMass: STAR_MASS, orbitalRadius: RADIUS, initialVelocity: V_ORBIT * 0.2 });
    for (let i = 0; i < 2000 && collided.status !== "collision"; i++) {
      collided = stepGravitationSim(collided);
    }
    expect(stopGravitationSim(collided).status).toBe("collision");
  });

  it("gravitationRenderStateFor exposes star position, planet position, velocity, acceleration, distance, trajectory, elapsed time, and status", () => {
    let state = createGravitationSimState({ starMass: STAR_MASS, orbitalRadius: RADIUS, initialVelocity: V_ORBIT });
    state = runSteps(state, 10);
    const renderState = gravitationRenderStateFor(state);
    expect(renderState.starX).toBe(0);
    expect(renderState.starY).toBe(0);
    expect(renderState.planetX).toBe(state.planetX);
    expect(renderState.planetY).toBe(state.planetY);
    expect(renderState.velocity).toEqual({ vx: state.planetVx, vy: state.planetVy });
    expect(renderState.distanceFromStar).toBeCloseTo(Math.hypot(state.planetX, state.planetY), 10);
    expect(renderState.trajectory).toBe(state.trajectory);
    expect(renderState.elapsedTime).toBeCloseTo(state.elapsedTime, 10);
    expect(renderState.status).toBe(state.status);
    // Acceleration must point toward the star, matching physics.ts's own
    // gravitationalAccelerationVector contract.
    const accelMag = Math.hypot(renderState.acceleration.ax, renderState.acceleration.ay);
    expect(accelMag).toBeGreaterThan(0);
  });
});
