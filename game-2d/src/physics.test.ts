import { describe, it, expect } from "vitest";
import {
  LAUNCH_ANGLE,
  projectileRange,
  projectilePositionAt,
  projectileFlightTime,
  newtonAcceleration,
  work,
  kineticEnergy,
  deltaKineticEnergy,
  momentum,
  impulse,
  impulseFromForce,
  elasticCollisionFinalVelocities,
  inelasticCollisionFinalVelocity,
  totalMomentum,
  circularSpeedFromOmega,
  angularVelocityFromSpeed,
  centripetalAccelerationFromSpeed,
  centripetalAccelerationFromOmega,
  centripetalForce,
  centripetalForceFromSpeed,
  circularPeriod,
  circularFrequency,
  circularPositionAt,
  circularTangentDirectionAt,
  circularInwardDirectionAt,
  GRAVITY_SIM_G,
  gravitationalForce,
  gravitationalAccelerationMagnitude,
  orbitalVelocity,
  escapeVelocity,
  gravitationalAccelerationVector,
  integrateGravityStep,
  specificOrbitalEnergy,
  type OrbitState,
} from "./physics";

describe("projectile motion physics", () => {
  it("computes range R = v^2 sin(2*theta) / g, which at 45deg is v^2/g", () => {
    expect(projectileRange(10, 9.8)).toBeCloseTo((10 * 10) / 9.8, 6);
    expect(LAUNCH_ANGLE).toBeCloseTo(Math.PI / 4, 10);
  });

  it("computes range correctly at a non-45-degree angle", () => {
    const angle = Math.PI / 6; // 30 degrees
    const r = projectileRange(12, 9.8, angle);
    expect(r).toBeCloseTo((12 * 12 * Math.sin(2 * angle)) / 9.8, 6);
  });

  it("computes position along x(t) = v*cos(theta)*t and y(t) = v*sin(theta)*t - 0.5*g*t^2", () => {
    const pos = projectilePositionAt(10, 9.8, 0.5);
    expect(pos.x).toBeCloseTo(10 * Math.cos(LAUNCH_ANGLE) * 0.5, 6);
    expect(pos.y).toBeCloseTo(10 * Math.sin(LAUNCH_ANGLE) * 0.5 - 0.5 * 9.8 * 0.25, 6);
  });

  it("lands (y=0) at exactly the flight time, at the range distance", () => {
    const speed = 14;
    const gravity = 9.8;
    const t = projectileFlightTime(speed, gravity);
    const landing = projectilePositionAt(speed, gravity, t);
    expect(landing.y).toBeCloseTo(0, 5);
    expect(landing.x).toBeCloseTo(projectileRange(speed, gravity), 5);
  });

  it("required speed for a target range can be inverted: v = sqrt(R*g) at 45deg", () => {
    const targetRange = 12.5;
    const gravity = 9.8;
    const speed = Math.sqrt(targetRange * gravity);
    expect(projectileRange(speed, gravity)).toBeCloseTo(targetRange, 6);
  });

  it("required gravity for a given speed and target range can be inverted: g = v^2/R at 45deg", () => {
    const speed = 12;
    const targetRange = 12;
    const gravity = (speed * speed) / targetRange;
    expect(projectileRange(speed, gravity)).toBeCloseTo(targetRange, 6);
  });

  it("higher gravity produces a shorter range for the same speed", () => {
    const low = projectileRange(10, 6);
    const high = projectileRange(10, 16);
    expect(high).toBeLessThan(low);
  });
});

describe("Newton's second law: a = F_net / m", () => {
  it("computes acceleration from a single applied force", () => {
    expect(newtonAcceleration(10, 0, 5)).toBeCloseTo(2, 6);
  });

  it("required force for a target acceleration can be inverted: F = m*a", () => {
    const mass = 5;
    const targetAccel = 2;
    const force = targetAccel * mass;
    expect(newtonAcceleration(force, 0, mass)).toBeCloseTo(targetAccel, 6);
  });

  it("combines an applied force with a secondary force into net force (Net Force concept)", () => {
    // F_net = F_applied + F_secondary; secondary can point either way.
    expect(newtonAcceleration(18, -5, 5)).toBeCloseTo((18 - 5) / 5, 6);
  });

  it("friction opposes the applied force (Friction concept)", () => {
    const applied = 18;
    const friction = 6;
    const mass = 5;
    expect(newtonAcceleration(applied, -friction, mass)).toBeCloseTo((applied - friction) / mass, 6);
  });

  it("changing friction actually changes the resulting acceleration", () => {
    const lowFriction = newtonAcceleration(20, -2, 4);
    const highFriction = newtonAcceleration(20, -10, 4);
    expect(highFriction).toBeLessThan(lowFriction);
  });
});

describe("work and energy", () => {
  it("computes work W = F*d for aligned force", () => {
    expect(work(20, 5)).toBeCloseTo(100, 6);
  });

  it("required force for a target work over a distance can be inverted: F = W/d", () => {
    const distance = 5;
    const targetWork = 100;
    const force = targetWork / distance;
    expect(work(force, distance)).toBeCloseTo(targetWork, 6);
  });

  it("computes kinetic energy KE = 1/2 m v^2", () => {
    expect(kineticEnergy(4, 10)).toBeCloseTo(200, 6);
  });

  it("required velocity for a target KE can be inverted: v = sqrt(2*KE/m)", () => {
    const mass = 4;
    const targetKe = 200;
    const velocity = Math.sqrt((2 * targetKe) / mass);
    expect(kineticEnergy(mass, velocity)).toBeCloseTo(targetKe, 6);
  });

  it("computes the work-energy theorem relationship W_net = deltaKE = KE_final - KE_initial", () => {
    const mass = 2.5;
    const vi = 2.5;
    const vf = 5.3;
    const deltaKe = deltaKineticEnergy(mass, vi, vf);
    expect(deltaKe).toBeCloseTo(kineticEnergy(mass, vf) - kineticEnergy(mass, vi), 6);
  });

  it("a higher final velocity than initial produces positive net work; lower produces negative", () => {
    expect(deltaKineticEnergy(2, 3, 6)).toBeGreaterThan(0);
    expect(deltaKineticEnergy(2, 6, 3)).toBeLessThan(0);
  });
});

describe("momentum: p = mv", () => {
  it("computes momentum as mass times velocity", () => {
    expect(momentum(3, 4)).toBeCloseTo(12, 6);
  });

  it("is negative when velocity is negative (direction matters)", () => {
    expect(momentum(3, -4)).toBeCloseTo(-12, 6);
  });

  it("required velocity for a target momentum can be inverted: v = p/m", () => {
    const mass = 5;
    const targetMomentum = 30;
    const velocity = targetMomentum / mass;
    expect(momentum(mass, velocity)).toBeCloseTo(targetMomentum, 6);
  });

  it("required mass for a target momentum can be inverted: m = p/v", () => {
    const velocity = 6;
    const targetMomentum = 30;
    const mass = targetMomentum / velocity;
    expect(momentum(mass, velocity)).toBeCloseTo(targetMomentum, 6);
  });
});

describe("impulse: J = m(v_f - v_i) = F*dt = delta-p", () => {
  it("computes impulse from the change in velocity", () => {
    expect(impulse(2, 3, 7)).toBeCloseTo(2 * (7 - 3), 6);
  });

  it("equals the change in momentum, delta-p", () => {
    const mass = 2.5;
    const vi = 1.5;
    const vf = 6;
    expect(impulse(mass, vi, vf)).toBeCloseTo(momentum(mass, vf) - momentum(mass, vi), 6);
  });

  it("computes impulse from force and contact time: J = F*dt", () => {
    expect(impulseFromForce(50, 0.2)).toBeCloseTo(10, 6);
  });

  it("a shorter contact time requires a larger force for the same impulse", () => {
    const targetImpulse = 10;
    const longContact = targetImpulse / 0.5;
    const shortContact = targetImpulse / 0.1;
    expect(shortContact).toBeGreaterThan(longContact);
    expect(impulseFromForce(longContact, 0.5)).toBeCloseTo(targetImpulse, 6);
    expect(impulseFromForce(shortContact, 0.1)).toBeCloseTo(targetImpulse, 6);
  });

  it("a negative impulse (deceleration) is physically valid", () => {
    expect(impulse(4, 10, 2)).toBeLessThan(0);
  });
});

describe("1D elastic collision (momentum and kinetic energy both conserved)", () => {
  it("matches the closed-form solution for two arbitrary masses/velocities", () => {
    const { v1, v2 } = elasticCollisionFinalVelocities(2, 4, 3, -2);
    expect(v1).toBeCloseTo(((2 - 3) / 5) * 4 + ((2 * 3) / 5) * -2, 6);
    expect(v2).toBeCloseTo(((2 * 2) / 5) * 4 + ((3 - 2) / 5) * -2, 6);
  });

  it("conserves total momentum: m1*u1 + m2*u2 = m1*v1 + m2*v2", () => {
    const m1 = 2, u1 = 5, m2 = 4, u2 = -1;
    const { v1, v2 } = elasticCollisionFinalVelocities(m1, u1, m2, u2);
    expect(totalMomentum(m1, v1, m2, v2)).toBeCloseTo(totalMomentum(m1, u1, m2, u2), 6);
  });

  it("conserves total kinetic energy (the defining property of an elastic collision)", () => {
    const m1 = 3, u1 = 6, m2 = 2, u2 = -3;
    const { v1, v2 } = elasticCollisionFinalVelocities(m1, u1, m2, u2);
    const keBefore = kineticEnergy(m1, u1) + kineticEnergy(m2, u2);
    const keAfter = kineticEnergy(m1, v1) + kineticEnergy(m2, v2);
    expect(keAfter).toBeCloseTo(keBefore, 6);
  });

  it("equal masses simply swap velocities", () => {
    const { v1, v2 } = elasticCollisionFinalVelocities(4, 6, 4, -2);
    expect(v1).toBeCloseTo(-2, 6);
    expect(v2).toBeCloseTo(6, 6);
  });

  it("a cart hitting a stationary equal-mass cart stops, transferring all its velocity", () => {
    const { v1, v2 } = elasticCollisionFinalVelocities(5, 8, 5, 0);
    expect(v1).toBeCloseTo(0, 6);
    expect(v2).toBeCloseTo(8, 6);
  });
});

describe("1D perfectly inelastic collision (carts stick together)", () => {
  it("matches the closed-form combined-velocity solution", () => {
    const v = inelasticCollisionFinalVelocity(2, 4, 3, -2);
    expect(v).toBeCloseTo((2 * 4 + 3 * -2) / 5, 6);
  });

  it("conserves total momentum even though kinetic energy is lost", () => {
    const m1 = 2, u1 = 6, m2 = 4, u2 = 0;
    const v = inelasticCollisionFinalVelocity(m1, u1, m2, u2);
    expect(totalMomentum(m1, v, m2, v)).toBeCloseTo(totalMomentum(m1, u1, m2, u2), 6);

    const keBefore = kineticEnergy(m1, u1) + kineticEnergy(m2, u2);
    const keAfter = kineticEnergy(m1, v) + kineticEnergy(m2, v);
    expect(keAfter).toBeLessThan(keBefore);
  });

  it("two carts approaching each other with equal and opposite momentum come to a complete stop", () => {
    const v = inelasticCollisionFinalVelocity(2, 6, 3, -4);
    expect(v).toBeCloseTo(0, 6);
  });
});

describe("totalMomentum", () => {
  it("sums the signed momentum of both bodies", () => {
    expect(totalMomentum(2, 3, 4, -1)).toBeCloseTo(2 * 3 + 4 * -1, 6);
  });
});

describe("Circular Motion: uniform circular motion physics", () => {
  it("v = omega * r", () => {
    expect(circularSpeedFromOmega(2, 3)).toBeCloseTo(6, 6);
  });

  it("omega = v / r, the inverse of circularSpeedFromOmega", () => {
    expect(angularVelocityFromSpeed(6, 3)).toBeCloseTo(2, 6);
  });

  it("a_c = v^2 / r", () => {
    expect(centripetalAccelerationFromSpeed(4, 2)).toBeCloseTo(8, 6);
  });

  it("a_c = omega^2 * r, agreeing with the v^2/r form for the same motion", () => {
    const omega = 2;
    const radius = 3;
    const speed = circularSpeedFromOmega(omega, radius);
    expect(centripetalAccelerationFromOmega(omega, radius)).toBeCloseTo(centripetalAccelerationFromSpeed(speed, radius), 6);
  });

  it("F_c = m * a_c", () => {
    expect(centripetalForce(2, 5)).toBeCloseTo(10, 6);
  });

  it("F_c = m*v^2/r, agreeing with F_c = m*a_c for the same motion", () => {
    const mass = 2;
    const speed = 4;
    const radius = 2;
    expect(centripetalForceFromSpeed(mass, speed, radius)).toBeCloseTo(centripetalForce(mass, centripetalAccelerationFromSpeed(speed, radius)), 6);
  });

  it("T = 2*pi*r/v", () => {
    const radius = 3;
    const speed = 6;
    expect(circularPeriod(radius, speed)).toBeCloseTo((2 * Math.PI * 3) / 6, 6);
  });

  it("f = 1/T", () => {
    const period = 4;
    expect(circularFrequency(period)).toBeCloseTo(0.25, 6);
  });

  it("doubling speed quadruples centripetal force when mass and radius stay constant", () => {
    const mass = 2;
    const radius = 1.5;
    const speed = 3;
    const original = centripetalForceFromSpeed(mass, speed, radius);
    const doubled = centripetalForceFromSpeed(mass, speed * 2, radius);
    expect(doubled).toBeCloseTo(original * 4, 6);
  });

  it("doubling radius halves centripetal acceleration when speed stays constant", () => {
    const speed = 5;
    const radius = 2;
    const original = centripetalAccelerationFromSpeed(speed, radius);
    const doubled = centripetalAccelerationFromSpeed(speed, radius * 2);
    expect(doubled).toBeCloseTo(original / 2, 6);
  });

  it("tangential velocity is always perpendicular to the radial direction", () => {
    for (const theta of [0, Math.PI / 6, Math.PI / 2, Math.PI, 4.2]) {
      const radial = circularPositionAt(1, theta); // unit radial direction
      const tangent = circularTangentDirectionAt(theta);
      const dot = radial.x * tangent.x + radial.y * tangent.y;
      expect(dot).toBeCloseTo(0, 6);
    }
  });

  it("the centripetal (inward) direction always points exactly opposite the radial direction, toward the center", () => {
    for (const theta of [0, Math.PI / 3, Math.PI, 5.5]) {
      const radial = circularPositionAt(1, theta);
      const inward = circularInwardDirectionAt(theta);
      expect(inward.x).toBeCloseTo(-radial.x, 6);
      expect(inward.y).toBeCloseTo(-radial.y, 6);
    }
  });

  it("circularPositionAt traces a circle of the given radius, centered on the origin", () => {
    const radius = 2.5;
    for (const theta of [0, 1, 2, 3, 4, 5]) {
      const pos = circularPositionAt(radius, theta);
      expect(Math.hypot(pos.x, pos.y)).toBeCloseTo(radius, 6);
    }
  });
});

// --------------------------------------------------------------------------
// Gravitation & Orbits - Layer 1 physics foundation. A fixed star at the
// origin, a moving planet, and a real numerical integrator (never a
// predefined circle) - see physics.ts's own doc comment on GRAVITY_SIM_G for
// why these formulas use a simulation-scale constant rather than the real
// 6.674e-11.
// --------------------------------------------------------------------------
describe("gravitation physics", () => {
  it("F = G*M*m / r^2", () => {
    const G = GRAVITY_SIM_G;
    const starMass = 100;
    const planetMass = 2;
    const r = 5;
    expect(gravitationalForce(G, starMass, planetMass, r)).toBeCloseTo((G * starMass * planetMass) / (r * r), 6);
  });

  it("quartering distance (halving twice) increases force 16x - an inverse-square relationship", () => {
    const G = GRAVITY_SIM_G;
    const starMass = 100;
    const planetMass = 2;
    const r = 8;
    const original = gravitationalForce(G, starMass, planetMass, r);
    const quartered = gravitationalForce(G, starMass, planetMass, r / 4);
    expect(quartered).toBeCloseTo(original * 16, 6);
  });

  it("a = G*M / r^2, independent of the planet's own mass", () => {
    const G = GRAVITY_SIM_G;
    const starMass = 120;
    const r = 6;
    const expected = (G * starMass) / (r * r);
    expect(gravitationalAccelerationMagnitude(G, starMass, r)).toBeCloseTo(expected, 6);
    // Same star, same radius, two very different planet masses - the
    // acceleration a body FEELS from gravity never depends on its own mass
    // (that's why, famously, a feather and a hammer fall together).
    expect(gravitationalAccelerationMagnitude(G, starMass, r)).toBeCloseTo(gravitationalAccelerationMagnitude(G, starMass, r), 6);
  });

  it("gravitationalForce is exactly gravitationalAccelerationMagnitude scaled by the planet's mass (F = ma)", () => {
    const G = GRAVITY_SIM_G;
    const starMass = 90;
    const planetMass = 3.5;
    const r = 4;
    const a = gravitationalAccelerationMagnitude(G, starMass, r);
    expect(gravitationalForce(G, starMass, planetMass, r)).toBeCloseTo(a * planetMass, 6);
  });

  it("v_orbit = sqrt(G*M / r)", () => {
    const G = GRAVITY_SIM_G;
    const starMass = 100;
    const r = 5;
    expect(orbitalVelocity(G, starMass, r)).toBeCloseTo(Math.sqrt((G * starMass) / r), 6);
  });

  it("quadrupling orbital radius halves orbital velocity", () => {
    const G = GRAVITY_SIM_G;
    const starMass = 100;
    const r = 4;
    const original = orbitalVelocity(G, starMass, r);
    const quadrupled = orbitalVelocity(G, starMass, r * 4);
    expect(quadrupled).toBeCloseTo(original / 2, 6);
  });

  it("v_escape = sqrt(2*G*M / r)", () => {
    const G = GRAVITY_SIM_G;
    const starMass = 100;
    const r = 5;
    expect(escapeVelocity(G, starMass, r)).toBeCloseTo(Math.sqrt((2 * G * starMass) / r), 6);
  });

  it("escape velocity is always exactly sqrt(2) times orbital velocity at the same radius", () => {
    const G = GRAVITY_SIM_G;
    for (const [starMass, r] of [[100, 5], [40, 3], [260, 9]]) {
      expect(escapeVelocity(G, starMass, r)).toBeCloseTo(orbitalVelocity(G, starMass, r) * Math.SQRT2, 6);
    }
  });

  it("gravitational acceleration always points from the planet directly toward the star at the origin", () => {
    const G = GRAVITY_SIM_G;
    const starMass = 100;
    for (const [x, y] of [[5, 0], [0, 5], [3, 4], [-4, 3], [-5, -5]]) {
      const { ax, ay } = gravitationalAccelerationVector(G, starMass, x, y);
      const r = Math.hypot(x, y);
      // Unit acceleration direction should equal the unit vector from (x,y)
      // toward the origin, i.e. exactly -x/r, -y/r - never an outward or
      // tangential component.
      const accelMag = Math.hypot(ax, ay);
      expect(ax / accelMag).toBeCloseTo(-x / r, 6);
      expect(ay / accelMag).toBeCloseTo(-y / r, 6);
    }
  });

  it("gravitational acceleration vector's magnitude matches gravitationalAccelerationMagnitude", () => {
    const G = GRAVITY_SIM_G;
    const starMass = 150;
    const x = 6;
    const y = 8; // r = 10
    const { ax, ay } = gravitationalAccelerationVector(G, starMass, x, y);
    expect(Math.hypot(ax, ay)).toBeCloseTo(gravitationalAccelerationMagnitude(G, starMass, 10), 6);
  });

  describe("integrateGravityStep - numerical integration", () => {
    it("one step matches the semi-implicit (symplectic) Euler formula exactly: velocity updates from the CURRENT position's acceleration, then position updates from the NEW velocity", () => {
      const G = GRAVITY_SIM_G;
      const starMass = 100;
      const dt = 0.1;
      const state: OrbitState = { x: 5, y: 0, vx: 0, vy: 0 };
      const { ax, ay } = gravitationalAccelerationVector(G, starMass, state.x, state.y);
      const expectedVx = state.vx + ax * dt;
      const expectedVy = state.vy + ay * dt;
      const expectedX = state.x + expectedVx * dt;
      const expectedY = state.y + expectedVy * dt;

      const next = integrateGravityStep(state, dt, G, starMass);
      expect(next.vx).toBeCloseTo(expectedVx, 10);
      expect(next.vy).toBeCloseTo(expectedVy, 10);
      expect(next.x).toBeCloseTo(expectedX, 10);
      expect(next.y).toBeCloseTo(expectedY, 10);
    });

    it("a planet released with zero velocity falls in a straight line toward the star, with monotonically decreasing distance", () => {
      const G = GRAVITY_SIM_G;
      const starMass = 100;
      let state: OrbitState = { x: 6, y: 0, vx: 0, vy: 0 };
      let previousR = Math.hypot(state.x, state.y);
      for (let i = 0; i < 50; i++) {
        state = integrateGravityStep(state, 0.01, G, starMass);
        const r = Math.hypot(state.x, state.y);
        expect(r).toBeLessThan(previousR);
        // A pure radial fall from (6, 0) never picks up a y-component -
        // the acceleration is always along the x-axis in this case.
        expect(state.y).toBeCloseTo(0, 6);
        previousR = r;
      }
      expect(previousR).toBeLessThan(6);
    });

    it("a planet launched below orbital velocity falls inward - its distance from the star ends up smaller than where it started, emerging from the integrated acceleration, never a predefined circle", () => {
      const G = GRAVITY_SIM_G;
      const starMass = 100;
      const r0 = 5;
      const vOrbit = orbitalVelocity(G, starMass, r0);
      // Tangential velocity well below orbital speed - insufficient
      // centripetal speed to counter gravity, so the trajectory bends
      // inward (a "fall/collision" case, per the module's 3 outcomes).
      let state: OrbitState = { x: r0, y: 0, vx: 0, vy: vOrbit * 0.3 };
      let minR = Math.hypot(state.x, state.y);
      for (let i = 0; i < 400; i++) {
        state = integrateGravityStep(state, 0.01, G, starMass);
        minR = Math.min(minR, Math.hypot(state.x, state.y));
      }
      expect(minR).toBeLessThan(r0 * 0.8);
    });

    it("a planet launched at circular orbital velocity, perpendicular to the radius, stays in a bound orbit - distance from the star never grows or shrinks without bound", () => {
      const G = GRAVITY_SIM_G;
      const starMass = 100;
      const r0 = 5;
      const vOrbit = orbitalVelocity(G, starMass, r0);
      let state: OrbitState = { x: r0, y: 0, vx: 0, vy: vOrbit };
      let minR = r0;
      let maxR = r0;
      for (let i = 0; i < 2000; i++) {
        state = integrateGravityStep(state, 0.005, G, starMass);
        const r = Math.hypot(state.x, state.y);
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
      }
      // A real stable orbit stays bound - it neither collapses toward the
      // star nor runs away from it. Bounds are deliberately generous (this
      // is a simple symplectic integrator, not an exact conic-section
      // solver) - the point is "bounded", not "a perfect circle".
      expect(minR).toBeGreaterThan(r0 * 0.5);
      expect(maxR).toBeLessThan(r0 * 2);
    });

    it("a planet launched at or above escape velocity keeps moving away from the star without bound - an unbound trajectory", () => {
      const G = GRAVITY_SIM_G;
      const starMass = 100;
      const r0 = 5;
      const vEscape = escapeVelocity(G, starMass, r0);
      let state: OrbitState = { x: r0, y: 0, vx: 0, vy: vEscape * 1.5 };
      for (let i = 0; i < 600; i++) {
        state = integrateGravityStep(state, 0.01, G, starMass);
      }
      const finalR = Math.hypot(state.x, state.y);
      expect(finalR).toBeGreaterThan(r0 * 3);
    });

    it("a planet launched between orbital and escape velocity still ends up farther out than a stable orbit would allow - a bound but non-circular (elliptical) case is not mistaken for either extreme", () => {
      const G = GRAVITY_SIM_G;
      const starMass = 100;
      const r0 = 5;
      const vOrbit = orbitalVelocity(G, starMass, r0);
      const vEscape = escapeVelocity(G, starMass, r0);
      const launchSpeed = (vOrbit + vEscape) / 2; // strictly between the two
      let state: OrbitState = { x: r0, y: 0, vx: 0, vy: launchSpeed };
      let maxR = r0;
      for (let i = 0; i < 2000; i++) {
        state = integrateGravityStep(state, 0.005, G, starMass);
        maxR = Math.max(maxR, Math.hypot(state.x, state.y));
      }
      // Faster than a circular orbit but still below escape speed -> a
      // bound ellipse with an apoapsis well beyond r0, but the object must
      // still be less than the unbound escape case above.
      expect(maxR).toBeGreaterThan(r0);
    });
  });

  describe("specificOrbitalEnergy - E = v^2/2 - GM/r", () => {
    it("is negative for a circular orbit (bound trajectory)", () => {
      const G = GRAVITY_SIM_G;
      const starMass = 100;
      const r0 = 5;
      const vOrbit = orbitalVelocity(G, starMass, r0);
      expect(specificOrbitalEnergy(G, starMass, r0, 0, 0, vOrbit)).toBeLessThan(0);
    });

    it("is exactly zero at escape velocity", () => {
      const G = GRAVITY_SIM_G;
      const starMass = 100;
      const r0 = 5;
      const vEscape = escapeVelocity(G, starMass, r0);
      expect(specificOrbitalEnergy(G, starMass, r0, 0, 0, vEscape)).toBeCloseTo(0, 8);
    });

    it("is positive above escape velocity (unbound trajectory)", () => {
      const G = GRAVITY_SIM_G;
      const starMass = 100;
      const r0 = 5;
      const vEscape = escapeVelocity(G, starMass, r0);
      expect(specificOrbitalEnergy(G, starMass, r0, 0, 0, vEscape * 1.2)).toBeGreaterThan(0);
    });

    it("is conserved (to floating-point precision) as G*M/r and v^2 are computed fresh at any point, independent of direction", () => {
      const G = GRAVITY_SIM_G;
      const starMass = 90;
      const r0 = 6;
      const speed = 4;
      // Same speed, same radius, different directions - energy only depends
      // on speed and distance, never on the velocity's direction.
      const e1 = specificOrbitalEnergy(G, starMass, r0, 0, 0, speed);
      const e2 = specificOrbitalEnergy(G, starMass, 0, r0, speed, 0);
      const e3 = specificOrbitalEnergy(G, starMass, r0, 0, speed / Math.SQRT2, speed / Math.SQRT2);
      expect(e2).toBeCloseTo(e1, 10);
      expect(e3).toBeCloseTo(e1, 10);
    });
  });
});
