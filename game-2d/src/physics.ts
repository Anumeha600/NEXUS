// --------------------------------------------------------------------------
// NEXUS 2D - PHYSICS
//
// Deterministic, real physics - the exact same equations used by the 3D
// client's GDScript (game-3d/scripts/projectile.gd,
// game-3d/scripts/modules/newton_physics.gd,
// game-3d/scripts/modules/work_energy_physics.gd). Pure functions, no
// rendering, no adaptive/mastery logic - see adaptiveEngine.ts for that.
// --------------------------------------------------------------------------

export const LAUNCH_ANGLE = Math.PI / 4; // 45 degrees, matches the 3D client

// x(t) = v*cos(theta)*t
// y(t) = v*sin(theta)*t - 0.5*g*t^2
// Range at landing height = v^2 * sin(2*theta) / g
export function projectileRange(speed: number, gravity: number, angle = LAUNCH_ANGLE): number {
  return (speed * speed * Math.sin(2 * angle)) / gravity;
}

export function projectilePositionAt(speed: number, gravity: number, t: number, angle = LAUNCH_ANGLE) {
  const vx = speed * Math.cos(angle);
  const vy = speed * Math.sin(angle);
  return { x: vx * t, y: vy * t - 0.5 * gravity * t * t };
}

export function projectileFlightTime(speed: number, gravity: number, angle = LAUNCH_ANGLE): number {
  const vy = speed * Math.sin(angle);
  return (2 * vy) / gravity;
}

// Newton's Second Law: a = F_net / m, where F_net = applied_force + extra
// (extra is a signed second force - opposing for friction, arbitrary
// direction for "net force" challenges).
export function newtonAcceleration(appliedForce: number, extraForce: number, mass: number): number {
  return (appliedForce + extraForce) / mass;
}

export function work(force: number, displacement: number): number {
  return force * displacement;
}

export function kineticEnergy(mass: number, velocity: number): number {
  return 0.5 * mass * velocity * velocity;
}

export function deltaKineticEnergy(mass: number, initialVelocity: number, targetVelocity: number): number {
  return kineticEnergy(mass, targetVelocity) - kineticEnergy(mass, initialVelocity);
}

// Momentum: p = mv.
export function momentum(mass: number, velocity: number): number {
  return mass * velocity;
}

// Impulse-momentum theorem: J = m(v_f - v_i), which equals F*dt for a
// constant force over that same interval (see impulseFromForce below) -
// both are the same physical quantity, computed two different ways.
export function impulse(mass: number, initialVelocity: number, finalVelocity: number): number {
  return mass * (finalVelocity - initialVelocity);
}

export function impulseFromForce(force: number, contactTime: number): number {
  return force * contactTime;
}

// 1D elastic collision (kinetic energy AND momentum both conserved) - the
// standard closed-form solution for two masses m1, m2 with pre-collision
// velocities u1, u2.
export function elasticCollisionFinalVelocities(m1: number, u1: number, m2: number, u2: number): { v1: number; v2: number } {
  const totalMass = m1 + m2;
  const v1 = ((m1 - m2) / totalMass) * u1 + ((2 * m2) / totalMass) * u2;
  const v2 = ((2 * m1) / totalMass) * u1 + ((m2 - m1) / totalMass) * u2;
  return { v1, v2 };
}

// 1D perfectly inelastic collision - the two bodies stick together and move
// at one common final velocity.
export function inelasticCollisionFinalVelocity(m1: number, u1: number, m2: number, u2: number): number {
  return (m1 * u1 + m2 * u2) / (m1 + m2);
}

// Total momentum of a two-body system - used both pre- and post-collision to
// demonstrate conservation (the two calls should agree to within floating
// point error for a real, isolated collision).
export function totalMomentum(m1: number, v1: number, m2: number, v2: number): number {
  return m1 * v1 + m2 * v2;
}

// --------------------------------------------------------------------------
// Circular Motion - uniform circular motion. Speed magnitude stays constant
// while velocity direction continuously changes (tangent to the circle);
// centripetal acceleration/force always point toward the center. Centripetal
// force is never a separate, mysterious force - it is whatever net inward
// force the circular path requires (F_c = ma_c), computed the same way for
// every concept below.
// --------------------------------------------------------------------------

// v = omega * r
export function circularSpeedFromOmega(omega: number, radius: number): number {
  return omega * radius;
}

// omega = v / r
export function angularVelocityFromSpeed(speed: number, radius: number): number {
  return speed / radius;
}

// a_c = v^2 / r
export function centripetalAccelerationFromSpeed(speed: number, radius: number): number {
  return (speed * speed) / radius;
}

// a_c = omega^2 * r
export function centripetalAccelerationFromOmega(omega: number, radius: number): number {
  return omega * omega * radius;
}

// F_c = m * a_c
export function centripetalForce(mass: number, centripetalAcceleration: number): number {
  return mass * centripetalAcceleration;
}

// F_c = m*v^2/r
export function centripetalForceFromSpeed(mass: number, speed: number, radius: number): number {
  return mass * centripetalAccelerationFromSpeed(speed, radius);
}

// T = 2*pi*r / v
export function circularPeriod(radius: number, speed: number): number {
  return (2 * Math.PI * radius) / speed;
}

// f = 1/T
export function circularFrequency(period: number): number {
  return 1 / period;
}

// Position on a circle of the given radius at angle theta (standard math
// convention: theta=0 on the +x axis, increasing counter-clockwise),
// centered on the origin - callers translate to wherever the arena's center
// sits on screen.
export function circularPositionAt(radius: number, theta: number): { x: number; y: number } {
  return { x: radius * Math.cos(theta), y: radius * Math.sin(theta) };
}

// Unit tangential velocity direction at angle theta (the derivative of
// circularPositionAt with respect to theta, normalized) - always
// perpendicular to the radial direction (cos theta, sin theta).
export function circularTangentDirectionAt(theta: number): { x: number; y: number } {
  return { x: -Math.sin(theta), y: Math.cos(theta) };
}

// Unit centripetal (inward, toward-center) direction at angle theta -
// exactly opposite the radial direction, never an outward "centrifugal"
// arrow in this inertial-frame simulation.
export function circularInwardDirectionAt(theta: number): { x: number; y: number } {
  return { x: -Math.cos(theta), y: -Math.sin(theta) };
}

// --------------------------------------------------------------------------
// Gravitation & Orbits - Newtonian two-body gravity with a fixed, dominant
// star at the origin and a moving planet. This is Layer 1 (the physics/
// challenge foundation) only - no rendering, no GameCanvas wiring; the
// module is not reachable from the UI yet (see shared/src/curriculum.ts's
// `available: false` and adaptiveEngine.ts's MODULE_GRAVITATION doc comment).
//
// SIMULATION-SCALE G: GRAVITY_SIM_G is deliberately not the real-world
// 6.674e-11 - at that scale, star/planet masses and distances that are
// pedagogically legible (single/double-digit numbers, matching every other
// module's "friendly" ranges - see Circular Motion's radius/speed) would
// produce forces and velocities far too small to be meaningful on-screen or
// in a typed answer box. Using G=1 ("natural units", the standard
// simplification for real-time orbital-mechanics games/education) keeps
// F = GMm/r^2, v_orbit = sqrt(GM/r), and v_escape = sqrt(2GM/r) as the exact
// same formulas a textbook uses, just in units chosen for this game rather
// than SI - the physics (including which of two velocities produces a
// fall/orbit/escape, and the ratio v_escape = sqrt(2) * v_orbit) is
// identical regardless of G's numeric value.
export const GRAVITY_SIM_G = 1;

// F = GMm / r^2 - Newton's law of gravitation. Always positive (a
// magnitude); direction is handled separately by
// gravitationalAccelerationVector below, exactly like Circular Motion keeps
// centripetalForce's magnitude and circularInwardDirectionAt's direction as
// two separate concerns.
export function gravitationalForce(G: number, starMass: number, planetMass: number, distance: number): number {
  return (G * starMass * planetMass) / (distance * distance);
}

// a = GM / r^2 - gravitational acceleration magnitude, independent of the
// orbiting body's own mass (the planet's mass cancels out of F=ma when
// F=GMm/r^2, which is precisely why every object falls at the same rate in a
// given gravitational field regardless of its own mass).
export function gravitationalAccelerationMagnitude(G: number, starMass: number, distance: number): number {
  return (G * starMass) / (distance * distance);
}

// v_orbit = sqrt(GM / r) - the speed at which centripetal acceleration
// v^2/r exactly equals gravitational acceleration GM/r^2, producing a
// stable circular orbit at radius r.
export function orbitalVelocity(G: number, starMass: number, radius: number): number {
  return Math.sqrt((G * starMass) / radius);
}

// v_escape = sqrt(2GM / r) - the speed at which kinetic energy exactly
// equals the magnitude of gravitational potential energy, so the planet's
// total mechanical energy is zero and it never falls back (an unbound,
// parabolic-at-minimum trajectory). Always exactly sqrt(2) times
// orbitalVelocity at the same radius - never computed independently of it,
// since both come from the same GM/r quantity.
export function escapeVelocity(G: number, starMass: number, radius: number): number {
  return Math.sqrt((2 * G * starMass) / radius);
}

export interface OrbitState {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

// The gravitational acceleration VECTOR on a planet at (x, y), with the star
// fixed at the origin - magnitude from gravitationalAccelerationMagnitude,
// direction always exactly toward the origin (unit vector -x/r, -y/r),
// never an outward or tangential component. This is the one place direction
// enters the simulation; every other gravitation function above returns a
// magnitude only.
export function gravitationalAccelerationVector(G: number, starMass: number, x: number, y: number): { ax: number; ay: number } {
  const r = Math.hypot(x, y);
  const a = gravitationalAccelerationMagnitude(G, starMass, r);
  return { ax: (-a * x) / r, ay: (-a * y) / r };
}

// One semi-implicit ("symplectic"/Euler-Cromer) integration step: velocity
// is updated from the CURRENT position's acceleration first, then position
// is advanced using the NEW velocity - unlike explicit Euler (update
// position from the old velocity, then velocity from the old acceleration),
// this is symplectic, so it conserves orbital energy on average over many
// steps instead of steadily gaining it. That distinction is exactly why a
// stable-orbit initial velocity stays in a bounded loop here instead of
// slowly spiraling outward - the standard, simplest stable integrator for
// real-time orbital simulations, and the deliberate choice over a fixed
// pre-drawn circle: the trajectory is genuinely produced by integrating
// this acceleration step by step, never faked.
export function integrateGravityStep(state: OrbitState, dt: number, G: number, starMass: number): OrbitState {
  const { ax, ay } = gravitationalAccelerationVector(G, starMass, state.x, state.y);
  const vx = state.vx + ax * dt;
  const vy = state.vy + ay * dt;
  const x = state.x + vx * dt;
  const y = state.y + vy * dt;
  return { x, y, vx, vy };
}
