// --------------------------------------------------------------------------
// NEXUS 2D - CHALLENGE LOGIC
//
// Pure, deterministic functions connecting a Challenge (from
// adaptiveEngine.ts) to the numbers the game needs: what to physically
// simulate, what counts as "given" vs. "solve for", how to validate the
// player's typed answer, and what learning-event payload to send. No React,
// no DOM, no fetch - this is the layer the automated test suite exercises
// directly, and the layer GameCanvas.tsx calls into for everything that
// isn't rendering or component state.
// --------------------------------------------------------------------------

import {
  MODULE_PROJECTILE,
  MODULE_NEWTON,
  MODULE_MOMENTUM,
  MODULE_CIRCULAR,
  CONCEPT_SPEED_RANGE,
  CONCEPT_GRAVITY_RANGE,
  CONCEPT_FORCE_ACCELERATION,
  CONCEPT_WORK,
  CONCEPT_KINETIC_ENERGY,
  CONCEPT_WORK_ENERGY_THEOREM,
  CONCEPT_NET_FORCE,
  CONCEPT_FRICTION,
  CONCEPT_MOMENTUM,
  CONCEPT_IMPULSE,
  CONCEPT_CONSERVATION_MOMENTUM,
  CONCEPT_CENTRIPETAL_FORCE,
  CONCEPT_CENTRIPETAL_ACCELERATION,
  CONCEPT_CIRCULAR_SPEED,
  type Challenge,
} from "./adaptiveEngine";
import {
  newtonAcceleration,
  work,
  kineticEnergy,
  deltaKineticEnergy,
  momentum,
  impulse,
  totalMomentum,
  centripetalForceFromSpeed,
  centripetalAccelerationFromSpeed,
  circularSpeedFromOmega,
} from "./physics";

export function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function controlRangeFor(challenge: Challenge): { min: number; max: number; step: number } {
  switch (challenge.conceptId) {
    case CONCEPT_GRAVITY_RANGE:
      return { min: 1, max: 25, step: 3 };
    case CONCEPT_KINETIC_ENERGY:
      return { min: 0, max: 25, step: 6 };
    case CONCEPT_WORK_ENERGY_THEOREM:
      return { min: -250, max: 400, step: 120 };
    case CONCEPT_MOMENTUM:
      if (challenge.momentumSolveFor === "mass") return { min: 0, max: 15, step: 2 };
      if (challenge.momentumSolveFor === "velocity") return { min: -15, max: 15, step: 3 };
      return { min: -100, max: 100, step: 15 };
    case CONCEPT_IMPULSE:
      if (challenge.impulseSolveFor === "force") return { min: 0, max: 400, step: 40 };
      if (challenge.impulseSolveFor === "finalVelocity") return { min: -15, max: 15, step: 2 };
      return { min: -100, max: 100, step: 15 };
    case CONCEPT_CONSERVATION_MOMENTUM:
      return { min: -20, max: 20, step: 2 };
    case CONCEPT_CENTRIPETAL_FORCE:
      if (challenge.forceSolveFor === "speed") return { min: 0.5, max: 12, step: 1 };
      if (challenge.forceSolveFor === "radius") return { min: 0.5, max: 6, step: 0.5 };
      return { min: 0, max: 250, step: 20 };
    case CONCEPT_CENTRIPETAL_ACCELERATION:
      if (challenge.accelSolveFor === "speed") return { min: 0.5, max: 12, step: 1 };
      if (challenge.accelSolveFor === "radius") return { min: 0.5, max: 6, step: 0.5 };
      return { min: 0, max: 80, step: 8 };
    case CONCEPT_CIRCULAR_SPEED:
      if (challenge.speedSolveFor === "angularVelocity") return { min: 0.1, max: 6, step: 0.5 };
      if (challenge.speedSolveFor === "period") return { min: 0.1, max: 20, step: 2 };
      return { min: 0.1, max: 15, step: 1.5 };
    default:
      if (challenge.moduleId === MODULE_PROJECTILE) return { min: 2, max: 22, step: 6 };
      return { min: -30, max: 90, step: 40 };
  }
}

// Projectile Motion's two concepts solve for different unknowns using the
// exact same launch physics: Speed & Range gives gravity and asks for
// speed; Gravity & Trajectory gives speed and asks for gravity. Both
// concepts still launch a real projectile using both numbers together.
export function flightParamsFor(challenge: Challenge, controlValue: number): { speed: number; gravity: number } {
  if (challenge.conceptId === CONCEPT_GRAVITY_RANGE) {
    return { speed: challenge.givenSpeed ?? 10, gravity: controlValue };
  }
  return { speed: controlValue, gravity: challenge.gravity ?? 9.8 };
}

// The true mass/radius/speed the Circular Motion simulation should actually
// animate with for a given submitted value - whichever of radius/speed is
// this challenge's own unknown (per forceSolveFor/accelSolveFor) is resolved
// from the player's own guess, exactly like Newton's cart animates using the
// predicted acceleration from the submitted force, or Momentum's "velocity"/
// "mass" sub-types plug the guess back into p=mv: the simulation shows what
// your prediction produces, never a value hidden from the player. Circular
// Speed's sub-types are all direct forward computations from two fully-given
// quantities (see adaptiveEngine.ts), so the guess never feeds its motion.
export function circularSimParamsFor(challenge: Challenge, controlValue: number): { mass: number; radius: number; speed: number } {
  const mass = challenge.mass ?? 1;
  if (challenge.conceptId === CONCEPT_CENTRIPETAL_FORCE) {
    const radius = challenge.forceSolveFor === "radius" ? controlValue : challenge.radius ?? 1;
    const speed = challenge.forceSolveFor === "speed" ? controlValue : challenge.speed ?? 1;
    return { mass, radius, speed };
  }
  if (challenge.conceptId === CONCEPT_CENTRIPETAL_ACCELERATION) {
    const radius = challenge.accelSolveFor === "radius" ? controlValue : challenge.radius ?? 1;
    const speed = challenge.accelSolveFor === "speed" ? controlValue : challenge.speed ?? 1;
    return { mass, radius, speed };
  }
  const radius = challenge.radius ?? 1;
  const speed = challenge.speed ?? circularSpeedFromOmega(challenge.angularVelocity ?? 1, radius);
  return { mass, radius, speed };
}

export function predictedValue(challenge: Challenge, controlValue: number): number {
  switch (challenge.conceptId) {
    case CONCEPT_WORK:
      return work(controlValue, challenge.distance ?? 0);
    case CONCEPT_KINETIC_ENERGY:
      return kineticEnergy(challenge.mass ?? 1, controlValue);
    case CONCEPT_WORK_ENERGY_THEOREM:
      return controlValue;
    case CONCEPT_NET_FORCE:
      return newtonAcceleration(controlValue, challenge.secondForce ?? 0, challenge.mass ?? 1);
    case CONCEPT_FRICTION:
      return newtonAcceleration(controlValue, -(challenge.frictionForce ?? 0), challenge.mass ?? 1);
    // Momentum: only "velocity" and "mass" sub-types have an unknown that
    // must be plugged back into p = mv to see what it produces - "momentum"
    // itself is what's being guessed directly (both mass and velocity are
    // already given), so the guess IS the measured value, same as
    // Work-Energy Theorem's work input above.
    case CONCEPT_MOMENTUM:
      if (challenge.momentumSolveFor === "velocity") return momentum(challenge.mass ?? 1, controlValue);
      if (challenge.momentumSolveFor === "mass") return momentum(controlValue, challenge.velocity ?? 1);
      return controlValue;
    // Impulse: every sub-type asks the player to solve directly for the
    // quantity being scored (impulse, the final velocity, or the force) -
    // there is no further formula to apply to the guess itself.
    case CONCEPT_IMPULSE:
      return controlValue;
    // Conservation of Momentum: the collision's outcome is fixed by the
    // given masses/velocities, never by the player's guess - the player is
    // predicting a value the fixed experiment will produce, then the
    // experiment runs and the real outcome is what's measured. The guess
    // itself is what's being scored against that real outcome.
    case CONCEPT_CONSERVATION_MOMENTUM:
      return controlValue;
    // Centripetal Force: Beginner asks the player to solve directly for the
    // force (mass/radius/speed all given, guess IS the measured value);
    // Intermediate/Advanced instead ask for the speed or radius that would
    // produce the given target force, so the guess must be plugged back into
    // F_c = mv^2/r to see what it actually produces.
    case CONCEPT_CENTRIPETAL_FORCE:
      if (challenge.forceSolveFor === "speed") return centripetalForceFromSpeed(challenge.mass ?? 1, controlValue, challenge.radius ?? 1);
      if (challenge.forceSolveFor === "radius") return centripetalForceFromSpeed(challenge.mass ?? 1, challenge.speed ?? 1, controlValue);
      return controlValue;
    // Centripetal Acceleration: same pattern as above using a_c = v^2/r.
    case CONCEPT_CENTRIPETAL_ACCELERATION:
      if (challenge.accelSolveFor === "speed") return centripetalAccelerationFromSpeed(controlValue, challenge.radius ?? 1);
      if (challenge.accelSolveFor === "radius") return centripetalAccelerationFromSpeed(challenge.speed ?? 1, controlValue);
      return controlValue;
    // Circular Speed: every sub-type asks the player to solve directly for
    // the quantity being scored (speed, angular velocity, or period) - there
    // is no further formula to apply to the guess itself, same as Impulse.
    case CONCEPT_CIRCULAR_SPEED:
      return controlValue;
    default:
      if (challenge.moduleId === MODULE_NEWTON) {
        return newtonAcceleration(controlValue, 0, challenge.mass ?? 1);
      }
      return 0; // projectile range/gravity result is only known after the flight animation
  }
}

// Work-Energy Theorem: W_net = delta-KE, so KE_final = KE_initial + W_net.
// This derives the physically resulting final velocity from the player's
// work input, so the chain (work input -> net work -> change in kinetic
// energy -> final velocity) is genuinely computed and shown, not just a
// number the player matches against another number.
export function finalVelocityFromWork(challenge: Challenge, workInput: number): number {
  const mass = challenge.mass ?? 1;
  const initialVelocity = challenge.initialVelocity ?? 0;
  const initialKe = kineticEnergy(mass, initialVelocity);
  const finalKe = initialKe + workInput;
  return Math.sqrt(Math.max(0, (2 * finalKe) / mass));
}

export function targetValueOf(challenge: Challenge): number {
  switch (challenge.conceptId) {
    case CONCEPT_WORK:
      return challenge.targetWork ?? 0;
    case CONCEPT_KINETIC_ENERGY:
      return challenge.targetKe ?? 0;
    case CONCEPT_WORK_ENERGY_THEOREM:
      return challenge.requiredNetWork ?? 0;
    case CONCEPT_MOMENTUM:
      return challenge.targetMomentum ?? 0;
    case CONCEPT_IMPULSE:
      if (challenge.impulseSolveFor === "finalVelocity") return challenge.finalVelocity ?? 0;
      if (challenge.impulseSolveFor === "force") return (challenge.targetImpulse ?? 0) / (challenge.contactTime || 1);
      return impulse(challenge.mass ?? 0, challenge.initialVelocity ?? 0, challenge.finalVelocity ?? 0);
    case CONCEPT_CONSERVATION_MOMENTUM:
      return challenge.solveForCart === "B" ? challenge.finalVelocity2 ?? 0 : challenge.finalVelocity1 ?? 0;
    case CONCEPT_CENTRIPETAL_FORCE:
      return challenge.targetCentripetalForce ?? 0;
    case CONCEPT_CENTRIPETAL_ACCELERATION:
      return challenge.targetCentripetalAcceleration ?? 0;
    case CONCEPT_CIRCULAR_SPEED:
      if (challenge.speedSolveFor === "angularVelocity") return challenge.targetAngularVelocity ?? 0;
      if (challenge.speedSolveFor === "period") return challenge.targetPeriod ?? 0;
      return challenge.targetCircularSpeed ?? 0;
    default:
      if (challenge.moduleId === MODULE_PROJECTILE) return challenge.targetDistance ?? 0;
      return challenge.targetAcceleration ?? 0;
  }
}

// What the HUD shows as "given" - the known quantities the player reasons
// from, distinct from the number they are solving for and typing in.
export function givenFieldsFor(challenge: Challenge): { label: string; value: string }[] {
  switch (challenge.conceptId) {
    case CONCEPT_SPEED_RANGE:
      return [
        { label: "Target Range", value: `${(challenge.targetDistance ?? 0).toFixed(1)} m` },
        { label: "Angle", value: "45°" },
        { label: "Gravity", value: `${(challenge.gravity ?? 9.8).toFixed(1)} m/s²` },
      ];
    case CONCEPT_GRAVITY_RANGE:
      return [
        { label: "Launch Speed", value: `${(challenge.givenSpeed ?? 0).toFixed(1)} m/s` },
        { label: "Angle", value: "45°" },
        { label: "Target Range", value: `${(challenge.targetDistance ?? 0).toFixed(1)} m` },
      ];
    case CONCEPT_FORCE_ACCELERATION:
      return [
        { label: "Mass", value: `${(challenge.mass ?? 0).toFixed(1)} kg` },
        { label: "Target Accel.", value: `${(challenge.targetAcceleration ?? 0).toFixed(1)} m/s²` },
      ];
    case CONCEPT_NET_FORCE:
      return [
        { label: "Mass", value: `${(challenge.mass ?? 0).toFixed(1)} kg` },
        { label: "Secondary Force", value: `${(challenge.secondForce ?? 0).toFixed(1)} N` },
        { label: "Target Accel.", value: `${(challenge.targetAcceleration ?? 0).toFixed(1)} m/s²` },
      ];
    case CONCEPT_FRICTION:
      return [
        { label: "Mass", value: `${(challenge.mass ?? 0).toFixed(1)} kg` },
        { label: "Friction", value: `${(challenge.frictionForce ?? 0).toFixed(1)} N` },
        { label: "Target Accel.", value: `${(challenge.targetAcceleration ?? 0).toFixed(1)} m/s²` },
      ];
    case CONCEPT_WORK:
      return [
        { label: "Distance", value: `${(challenge.distance ?? 0).toFixed(1)} m` },
        { label: "Target Work", value: `${(challenge.targetWork ?? 0).toFixed(1)} J` },
      ];
    case CONCEPT_KINETIC_ENERGY:
      return [
        { label: "Mass", value: `${(challenge.mass ?? 0).toFixed(1)} kg` },
        { label: "Target KE", value: `${(challenge.targetKe ?? 0).toFixed(1)} J` },
      ];
    case CONCEPT_WORK_ENERGY_THEOREM:
      return [
        { label: "Mass", value: `${(challenge.mass ?? 0).toFixed(1)} kg` },
        { label: "Initial Velocity", value: `${(challenge.initialVelocity ?? 0).toFixed(1)} m/s` },
        { label: "Target Velocity", value: `${(challenge.targetVelocity ?? 0).toFixed(1)} m/s` },
      ];
    // The target is only ever shown when it's in a DIFFERENT unit than what
    // the player is solving for (same rule as Work/Kinetic Energy above) -
    // never when the unknown IS the target's own unit, which would just
    // hand over the answer to retype.
    case CONCEPT_MOMENTUM:
      if (challenge.momentumSolveFor === "velocity") {
        return [
          { label: "Mass", value: `${(challenge.mass ?? 0).toFixed(1)} kg` },
          { label: "Target Momentum", value: `${(challenge.targetMomentum ?? 0).toFixed(1)} kg·m/s` },
        ];
      }
      if (challenge.momentumSolveFor === "mass") {
        return [
          { label: "Velocity", value: `${(challenge.velocity ?? 0).toFixed(1)} m/s` },
          { label: "Target Momentum", value: `${(challenge.targetMomentum ?? 0).toFixed(1)} kg·m/s` },
        ];
      }
      return [
        { label: "Mass", value: `${(challenge.mass ?? 0).toFixed(1)} kg` },
        { label: "Velocity", value: `${(challenge.velocity ?? 0).toFixed(1)} m/s` },
      ];
    case CONCEPT_IMPULSE:
      if (challenge.impulseSolveFor === "finalVelocity") {
        return [
          { label: "Mass", value: `${(challenge.mass ?? 0).toFixed(1)} kg` },
          { label: "Initial Velocity", value: `${(challenge.initialVelocity ?? 0).toFixed(1)} m/s` },
          { label: "Target Impulse", value: `${(challenge.targetImpulse ?? 0).toFixed(1)} N·s` },
        ];
      }
      if (challenge.impulseSolveFor === "force") {
        return [
          { label: "Mass", value: `${(challenge.mass ?? 0).toFixed(1)} kg` },
          { label: "Velocity Change", value: `${((challenge.finalVelocity ?? 0) - (challenge.initialVelocity ?? 0)).toFixed(1)} m/s` },
          { label: "Contact Time", value: `${(challenge.contactTime ?? 0).toFixed(2)} s` },
        ];
      }
      return [
        { label: "Mass", value: `${(challenge.mass ?? 0).toFixed(1)} kg` },
        { label: "Initial Velocity", value: `${(challenge.initialVelocity ?? 0).toFixed(1)} m/s` },
        { label: "Final Velocity", value: `${(challenge.finalVelocity ?? 0).toFixed(1)} m/s` },
      ];
    case CONCEPT_CONSERVATION_MOMENTUM:
      return [
        { label: "Cart A: Mass", value: `${(challenge.mass1 ?? 0).toFixed(1)} kg` },
        { label: "Cart A: Velocity", value: `${(challenge.velocity1 ?? 0).toFixed(1)} m/s` },
        { label: "Cart B: Mass", value: `${(challenge.mass2 ?? 0).toFixed(1)} kg` },
        { label: "Cart B: Velocity", value: `${(challenge.velocity2 ?? 0).toFixed(1)} m/s` },
        { label: "Collision", value: challenge.collisionType === "elastic" ? "Elastic" : "Perfectly Inelastic" },
      ];
    case CONCEPT_CENTRIPETAL_FORCE: {
      const rows: { label: string; value: string }[] = [{ label: "Mass", value: `${(challenge.mass ?? 0).toFixed(1)} kg` }];
      if (challenge.forceSolveFor !== "radius") rows.push({ label: "Radius", value: `${(challenge.radius ?? 0).toFixed(1)} m` });
      if (challenge.forceSolveFor !== "speed") rows.push({ label: "Speed", value: `${(challenge.speed ?? 0).toFixed(1)} m/s` });
      if (challenge.forceSolveFor !== "force") rows.push({ label: "Target Force", value: `${(challenge.targetCentripetalForce ?? 0).toFixed(1)} N` });
      return rows;
    }
    case CONCEPT_CENTRIPETAL_ACCELERATION: {
      const rows: { label: string; value: string }[] = [];
      if (challenge.accelSolveFor !== "radius") rows.push({ label: "Radius", value: `${(challenge.radius ?? 0).toFixed(1)} m` });
      if (challenge.accelSolveFor !== "speed") rows.push({ label: "Speed", value: `${(challenge.speed ?? 0).toFixed(1)} m/s` });
      if (challenge.accelSolveFor !== "acceleration")
        rows.push({ label: "Target Accel.", value: `${(challenge.targetCentripetalAcceleration ?? 0).toFixed(2)} m/s²` });
      return rows;
    }
    case CONCEPT_CIRCULAR_SPEED:
      if (challenge.speedSolveFor === "speed") {
        return [
          { label: "Radius", value: `${(challenge.radius ?? 0).toFixed(1)} m` },
          { label: "Angular Velocity", value: `${(challenge.angularVelocity ?? 0).toFixed(2)} rad/s` },
        ];
      }
      return [
        { label: "Radius", value: `${(challenge.radius ?? 0).toFixed(1)} m` },
        { label: "Speed", value: `${(challenge.speed ?? 0).toFixed(1)} m/s` },
      ];
    default:
      return [];
  }
}

export function inputLabelFor(challenge: Challenge): string {
  switch (challenge.conceptId) {
    case CONCEPT_SPEED_RANGE:
      return "Launch speed (m/s)";
    case CONCEPT_GRAVITY_RANGE:
      return "Gravity (m/s²)";
    case CONCEPT_WORK:
      return "Force (N)";
    case CONCEPT_KINETIC_ENERGY:
      return "Velocity (m/s)";
    case CONCEPT_WORK_ENERGY_THEOREM:
      return "Work input (J)";
    case CONCEPT_MOMENTUM:
      if (challenge.momentumSolveFor === "velocity") return "Velocity (m/s)";
      if (challenge.momentumSolveFor === "mass") return "Mass (kg)";
      return "Momentum (kg·m/s)";
    case CONCEPT_IMPULSE:
      if (challenge.impulseSolveFor === "finalVelocity") return "Final velocity (m/s)";
      if (challenge.impulseSolveFor === "force") return "Force (N)";
      return "Impulse (N·s)";
    case CONCEPT_CONSERVATION_MOMENTUM:
      return challenge.solveForCart === "B" ? "Cart B's final velocity (m/s)" : "Cart A's final velocity (m/s)";
    case CONCEPT_CENTRIPETAL_FORCE:
      if (challenge.forceSolveFor === "speed") return "Speed (m/s)";
      if (challenge.forceSolveFor === "radius") return "Radius (m)";
      return "Centripetal force (N)";
    case CONCEPT_CENTRIPETAL_ACCELERATION:
      if (challenge.accelSolveFor === "speed") return "Speed (m/s)";
      if (challenge.accelSolveFor === "radius") return "Radius (m)";
      return "Centripetal acceleration (m/s²)";
    case CONCEPT_CIRCULAR_SPEED:
      if (challenge.speedSolveFor === "angularVelocity") return "Angular velocity (rad/s)";
      if (challenge.speedSolveFor === "period") return "Period (s)";
      return "Speed (m/s)";
    default:
      return "Applied force (N)";
  }
}

export function actionLabelFor(challenge: Challenge): string {
  if (challenge.moduleId === MODULE_PROJECTILE) return "LAUNCH";
  if (challenge.moduleId === MODULE_NEWTON) return "APPLY FORCE";
  if (challenge.moduleId === MODULE_MOMENTUM) return "RUN EXPERIMENT";
  if (challenge.moduleId === MODULE_CIRCULAR) return "RUN EXPERIMENT";
  if (challenge.conceptId === CONCEPT_WORK) return "APPLY FORCE";
  if (challenge.conceptId === CONCEPT_KINETIC_ENERGY) return "SET VELOCITY";
  return "APPLY WORK";
}

const POSITIVE_ONLY_CONCEPTS = new Set([CONCEPT_SPEED_RANGE, CONCEPT_GRAVITY_RANGE, CONCEPT_KINETIC_ENERGY]);

function positiveOnlyLabel(challenge: Challenge): string {
  if (challenge.conceptId === CONCEPT_SPEED_RANGE) return "Speed";
  if (challenge.conceptId === CONCEPT_GRAVITY_RANGE) return "Gravity";
  if (challenge.conceptId === CONCEPT_MOMENTUM) return "Mass";
  if (challenge.conceptId === CONCEPT_IMPULSE) return "Force";
  if (challenge.conceptId === CONCEPT_CENTRIPETAL_FORCE) {
    return challenge.forceSolveFor === "speed" ? "Speed" : challenge.forceSolveFor === "radius" ? "Radius" : "Force";
  }
  if (challenge.conceptId === CONCEPT_CENTRIPETAL_ACCELERATION) {
    return challenge.accelSolveFor === "speed" ? "Speed" : challenge.accelSolveFor === "radius" ? "Radius" : "Acceleration";
  }
  if (challenge.conceptId === CONCEPT_CIRCULAR_SPEED) {
    return challenge.speedSolveFor === "angularVelocity" ? "Angular velocity" : challenge.speedSolveFor === "period" ? "Period" : "Speed";
  }
  return "Velocity";
}

// Mass and force magnitude can never be zero or negative, unlike momentum,
// impulse, or any velocity in this module - all of which are signed
// quantities where direction is physically meaningful (see the module's
// difficulty tiers: "mixed directions" is a deliberate feature, not
// something to reject as invalid input). Every Circular Motion quantity -
// mass, radius, speed, angular velocity, centripetal force/acceleration,
// period - is a magnitude with no signed-direction analogue, so the whole
// module always requires positive input, unlike Momentum & Collisions.
function requiresPositiveInput(challenge: Challenge): boolean {
  if (POSITIVE_ONLY_CONCEPTS.has(challenge.conceptId)) return true;
  if (challenge.conceptId === CONCEPT_MOMENTUM) return challenge.momentumSolveFor === "mass";
  if (challenge.conceptId === CONCEPT_IMPULSE) return challenge.impulseSolveFor === "force";
  if (challenge.moduleId === MODULE_CIRCULAR) return true;
  return false;
}

export type InputValidation = { value: number } | { error: string };

export function validateInput(raw: string, challenge: Challenge): InputValidation {
  const trimmed = raw.trim();
  if (trimmed === "") return { error: "Enter a value." };
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return { error: "Enter a valid number." };
  if (Math.abs(value) > 100000) return { error: "That value is unrealistically large." };
  if (requiresPositiveInput(challenge) && value <= 0) {
    return { error: `${positiveOnlyLabel(challenge)} must be greater than 0.` };
  }
  return { value };
}

export function physicsInsightFor(challenge: Challenge, success: boolean, actual: number, target: number): string {
  if (success) {
    if (challenge.moduleId === MODULE_PROJECTILE) return "At 45°, range is approximately v²sin(2θ)/g.";
    if (challenge.moduleId === MODULE_NEWTON) return "Newton's Second Law: acceleration equals net force divided by mass.";
    if (challenge.conceptId === CONCEPT_WORK_ENERGY_THEOREM) return "Your work input matched the change in kinetic energy needed to reach the target velocity.";
    if (challenge.conceptId === CONCEPT_MOMENTUM) return "Momentum is the product of mass and velocity: p = mv.";
    if (challenge.conceptId === CONCEPT_IMPULSE) return "Impulse equals the change in momentum, J = m(v_f - v_i), which is also force times contact time.";
    if (challenge.conceptId === CONCEPT_CONSERVATION_MOMENTUM) return "Total momentum before the collision equals total momentum after - momentum is conserved.";
    if (challenge.conceptId === CONCEPT_CENTRIPETAL_FORCE) return "Centripetal force is the net inward force required for circular motion: F_c = mv²/r.";
    if (challenge.conceptId === CONCEPT_CENTRIPETAL_ACCELERATION)
      return "Centripetal acceleration points toward the center even though speed stays constant, because the velocity's direction keeps changing: a_c = v²/r.";
    if (challenge.conceptId === CONCEPT_CIRCULAR_SPEED) return "Circular speed connects angular velocity and radius: v = ωr.";
    return "Work and energy are directly connected through force and displacement.";
  }
  const tooLow = actual < target;
  if (challenge.conceptId === CONCEPT_GRAVITY_RANGE) {
    return tooLow
      ? "A lower gravity than you entered would let the projectile travel farther."
      : "A higher gravity than you entered would bring the projectile down sooner.";
  }
  if (challenge.moduleId === MODULE_PROJECTILE) return tooLow ? "Increasing speed increases range." : "A smaller speed increase produces a smaller range.";
  if (challenge.moduleId === MODULE_NEWTON) return tooLow ? "Greater net force produces greater acceleration." : "The net force overshot the target.";
  if (challenge.conceptId === CONCEPT_WORK_ENERGY_THEOREM) {
    return tooLow
      ? "More work input means a bigger increase in kinetic energy, and a higher final velocity."
      : "That much work produced more kinetic energy change than the target velocity needed.";
  }
  if (challenge.conceptId === CONCEPT_MOMENTUM) {
    return tooLow ? "A larger mass or velocity produces more momentum." : "That combination of mass and velocity produces less momentum than you predicted.";
  }
  if (challenge.conceptId === CONCEPT_IMPULSE) {
    return tooLow
      ? "A bigger velocity change (or a longer contact time at the same force) produces a larger impulse."
      : "That impact produces a smaller impulse than you predicted.";
  }
  if (challenge.conceptId === CONCEPT_CONSERVATION_MOMENTUM) {
    return tooLow
      ? "Re-check the collision equations - the real final velocity is higher than you predicted, even though total momentum is always conserved."
      : "Re-check the collision equations - the real final velocity is lower than you predicted, even though total momentum is always conserved.";
  }
  if (challenge.conceptId === CONCEPT_CENTRIPETAL_FORCE) {
    return tooLow
      ? "A larger speed (squared) or a smaller radius requires more centripetal force."
      : "That combination of speed and radius requires less centripetal force than you predicted.";
  }
  if (challenge.conceptId === CONCEPT_CENTRIPETAL_ACCELERATION) {
    return tooLow
      ? "A larger speed or a smaller radius produces more centripetal acceleration."
      : "That combination of speed and radius produces less centripetal acceleration than you predicted.";
  }
  if (challenge.conceptId === CONCEPT_CIRCULAR_SPEED) {
    return tooLow
      ? "A larger angular velocity or a larger radius produces a higher circular speed."
      : "That combination produces a smaller circular speed than you predicted.";
  }
  return tooLow ? "Increase the controlled quantity to reach the target." : "The result overshot the target.";
}

// Per-concept context reported alongside a learning event - each concept
// reports the quantities that actually describe it (e.g. Kinetic Energy
// reports velocity, never a force; Gravity & Trajectory reports the
// submitted/correct gravity, never a generic "control_value").
export function contextFor(challenge: Challenge, controlValue: number, actualValue: number): Record<string, number | string> {
  if (challenge.moduleId === MODULE_PROJECTILE) {
    if (challenge.conceptId === CONCEPT_GRAVITY_RANGE) {
      return {
        given_speed: challenge.givenSpeed ?? 0,
        submitted_gravity: controlValue,
        correct_gravity: challenge.gravity ?? 0,
        target_range: challenge.targetDistance ?? 0,
        actual_range: actualValue,
      };
    }
    return { launch_speed: controlValue, target_range: challenge.targetDistance ?? 0, actual_range: actualValue, gravity: challenge.gravity ?? 9.8 };
  }
  if (challenge.moduleId === MODULE_NEWTON) {
    return {
      mass: challenge.mass ?? 0,
      applied_force: controlValue,
      extra_force: (challenge.secondForce ?? 0) - (challenge.frictionForce ?? 0),
      target_acceleration: challenge.targetAcceleration ?? 0,
      actual_acceleration: actualValue,
    };
  }
  if (challenge.conceptId === CONCEPT_WORK_ENERGY_THEOREM) {
    const finalVelocity = finalVelocityFromWork(challenge, controlValue);
    const achievedDeltaKe = deltaKineticEnergy(challenge.mass ?? 1, challenge.initialVelocity ?? 0, finalVelocity);
    return {
      mass: challenge.mass ?? 0,
      initial_velocity: challenge.initialVelocity ?? 0,
      target_velocity: challenge.targetVelocity ?? 0,
      work_input: controlValue,
      required_net_work: challenge.requiredNetWork ?? 0,
      resulting_final_velocity: round1(finalVelocity),
      achieved_delta_ke: round1(achievedDeltaKe),
    };
  }
  if (challenge.conceptId === CONCEPT_KINETIC_ENERGY) {
    return {
      mass: challenge.mass ?? 0,
      velocity: controlValue,
      target_kinetic_energy: challenge.targetKe ?? 0,
    };
  }
  if (challenge.conceptId === CONCEPT_MOMENTUM) {
    const mass = challenge.mass ?? (challenge.momentumSolveFor === "mass" ? controlValue : 0);
    const velocity = challenge.velocity ?? (challenge.momentumSolveFor === "velocity" ? controlValue : 0);
    return {
      mass,
      velocity,
      momentum_solve_for: challenge.momentumSolveFor ?? "momentum",
      submitted_value: controlValue,
      target_momentum: challenge.targetMomentum ?? 0,
      actual_momentum: actualValue,
    };
  }
  if (challenge.conceptId === CONCEPT_IMPULSE) {
    const finalVelocity = challenge.impulseSolveFor === "finalVelocity" ? controlValue : challenge.finalVelocity ?? 0;
    return {
      mass: challenge.mass ?? 0,
      initial_velocity: challenge.initialVelocity ?? 0,
      final_velocity: finalVelocity,
      impulse_solve_for: challenge.impulseSolveFor ?? "impulse",
      contact_time: challenge.contactTime ?? 0,
      target_impulse: challenge.targetImpulse ?? impulse(challenge.mass ?? 0, challenge.initialVelocity ?? 0, finalVelocity),
      submitted_value: controlValue,
    };
  }
  if (challenge.conceptId === CONCEPT_CONSERVATION_MOMENTUM) {
    const momentumBefore = totalMomentum(challenge.mass1 ?? 0, challenge.velocity1 ?? 0, challenge.mass2 ?? 0, challenge.velocity2 ?? 0);
    const momentumAfter = totalMomentum(challenge.mass1 ?? 0, challenge.finalVelocity1 ?? 0, challenge.mass2 ?? 0, challenge.finalVelocity2 ?? 0);
    return {
      mass1: challenge.mass1 ?? 0,
      mass2: challenge.mass2 ?? 0,
      initial_velocity1: challenge.velocity1 ?? 0,
      initial_velocity2: challenge.velocity2 ?? 0,
      final_velocity1: challenge.finalVelocity1 ?? 0,
      final_velocity2: challenge.finalVelocity2 ?? 0,
      collision_type: challenge.collisionType ?? "inelastic",
      solve_for_cart: challenge.solveForCart ?? "A",
      momentum_before: round1(momentumBefore),
      momentum_after: round1(momentumAfter),
    };
  }
  if (challenge.moduleId === MODULE_CIRCULAR) {
    const { mass, radius, speed } = circularSimParamsFor(challenge, controlValue);
    return {
      mass,
      radius,
      speed,
      angular_velocity: round2(speed / radius),
      centripetal_acceleration: round2(centripetalAccelerationFromSpeed(speed, radius)),
      centripetal_force: round1(centripetalForceFromSpeed(mass, speed, radius)),
      revolutions_completed: challenge.revolutions ?? 1,
      concept_solve_for: challenge.forceSolveFor ?? challenge.accelSolveFor ?? challenge.speedSolveFor ?? "unknown",
      target_value: targetValueOf(challenge),
      actual_value: actualValue,
    };
  }
  return {
    mass: challenge.mass ?? 0,
    control_value: controlValue,
    distance: challenge.distance ?? 0,
  };
}

export interface ResultExtraRow {
  label: string;
  value: string;
}

// Extra, explanatory rows for the result card - never a separate scoring
// system (see the module's result-card spec), just the same physics the
// experiment already ran, surfaced for the two concepts where seeing the
// before/after numbers is the point (Impulse, Conservation of Momentum).
// Always derived from the challenge's own true, fixed physics fields -
// never from the player's guess, which may have been wrong.
export function resultExtrasFor(challenge: Challenge): ResultExtraRow[] | null {
  if (challenge.conceptId === CONCEPT_CONSERVATION_MOMENTUM) {
    const before = totalMomentum(challenge.mass1 ?? 0, challenge.velocity1 ?? 0, challenge.mass2 ?? 0, challenge.velocity2 ?? 0);
    const after = totalMomentum(challenge.mass1 ?? 0, challenge.finalVelocity1 ?? 0, challenge.mass2 ?? 0, challenge.finalVelocity2 ?? 0);
    return [
      { label: "Momentum Before", value: `${before.toFixed(1)} kg·m/s` },
      { label: "Momentum After", value: `${after.toFixed(1)} kg·m/s` },
    ];
  }
  if (challenge.conceptId === CONCEPT_IMPULSE) {
    const mass = challenge.mass ?? 0;
    const vi = challenge.initialVelocity ?? 0;
    const vf = challenge.finalVelocity ?? vi;
    return [
      { label: "Initial Momentum", value: `${momentum(mass, vi).toFixed(1)} kg·m/s` },
      { label: "Final Momentum", value: `${momentum(mass, vf).toFixed(1)} kg·m/s` },
      { label: "Impulse", value: `${impulse(mass, vi, vf).toFixed(1)} N·s` },
    ];
  }
  // Circular Motion: only shown when every quantity involved is a real,
  // fixed given on the challenge itself (never the player's guess) - for the
  // Intermediate/Advanced sub-types, radius or speed IS the unknown being
  // solved for, so there is no true value to report here until the player
  // has answered (matching the "never from a guess" rule above).
  if (challenge.conceptId === CONCEPT_CENTRIPETAL_FORCE && challenge.radius !== undefined && challenge.speed !== undefined) {
    return [
      { label: "Mass", value: `${(challenge.mass ?? 0).toFixed(1)} kg` },
      { label: "Radius", value: `${challenge.radius.toFixed(1)} m` },
      { label: "Speed", value: `${challenge.speed.toFixed(1)} m/s` },
    ];
  }
  if (challenge.conceptId === CONCEPT_CENTRIPETAL_ACCELERATION && challenge.radius !== undefined && challenge.speed !== undefined) {
    return [
      { label: "Radius", value: `${challenge.radius.toFixed(1)} m` },
      { label: "Speed", value: `${challenge.speed.toFixed(1)} m/s` },
    ];
  }
  if (challenge.conceptId === CONCEPT_CIRCULAR_SPEED && challenge.radius !== undefined) {
    const rows: ResultExtraRow[] = [{ label: "Radius", value: `${challenge.radius.toFixed(1)} m` }];
    if (challenge.speed !== undefined) rows.push({ label: "Speed", value: `${challenge.speed.toFixed(1)} m/s` });
    if (challenge.angularVelocity !== undefined) rows.push({ label: "Angular Velocity", value: `${challenge.angularVelocity.toFixed(2)} rad/s` });
    return rows;
  }
  return null;
}

export interface LearningEventPayload {
  session_id: string;
  module: string;
  concept: string;
  challenge_type: string;
  difficulty: string;
  target_value: number;
  actual_value: number;
  unit: string;
  success: boolean;
  performance: number;
  mastery_before: number;
  mastery_after: number;
  attempt_number: number;
  recent_attempts: number;
  context: Record<string, number | string>;
}

// The exact payload shape sent to /api/insight - pulled into one pure
// function so the test suite can verify every concept produces a valid,
// concept-appropriate learning event without mocking fetch or React state.
export function buildLearningEventPayload(params: {
  challenge: Challenge;
  submittedValue: number;
  actualValue: number;
  success: boolean;
  performance: number;
  masteryBefore: number;
  masteryAfter: number;
  sessionId: string;
  attemptNumber: number;
  recentAttempts: number;
}): LearningEventPayload {
  const { challenge, submittedValue, actualValue, success, performance, masteryBefore, masteryAfter, sessionId, attemptNumber, recentAttempts } = params;
  return {
    session_id: sessionId,
    module: challenge.moduleId,
    concept: challenge.conceptTitle,
    challenge_type: challenge.conceptId,
    difficulty: challenge.difficulty,
    target_value: targetValueOf(challenge),
    actual_value: actualValue,
    unit: challenge.unit,
    success,
    performance,
    mastery_before: masteryBefore,
    mastery_after: masteryAfter,
    attempt_number: attemptNumber,
    recent_attempts: recentAttempts,
    context: contextFor(challenge, submittedValue, actualValue),
  };
}
