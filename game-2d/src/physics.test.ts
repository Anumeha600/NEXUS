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
