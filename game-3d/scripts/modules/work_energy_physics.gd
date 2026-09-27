extends RefCounted

# --------------------------------------------------------------------------
# WORK & ENERGY PHYSICS
#
# Pure, deterministic math shared by the adaptive engine (challenge
# generation/scoring) and the gameplay/visual layer (challenge_manager.gd,
# work_energy_challenge.gd). No Node references, no scene dependencies -
# mirrors newton_physics.gd's role for the Newton's Laws module.
#
# Three concepts, two formulas, never a third conflicting one:
#
#   Work                  -> W = F * d
#   Kinetic Energy        -> KE = 1/2 * m * v^2
#   Work-Energy Theorem   -> W_net = delta_KE
#
# The Work-Energy Theorem concept is literally "solve for the required
# delta-KE" using the exact same kinetic_energy() function the Kinetic
# Energy concept uses - not a separate/competing formula.
# --------------------------------------------------------------------------

static func work(force: float, displacement: float) -> float:
	return force * displacement


static func kinetic_energy(mass: float, velocity: float) -> float:
	return 0.5 * mass * velocity * velocity


static func delta_kinetic_energy(mass: float, initial_velocity: float, target_velocity: float) -> float:
	return kinetic_energy(mass, target_velocity) - kinetic_energy(mass, initial_velocity)


# The force a player would need for a perfect Work attempt, given a fixed
# displacement - W = F*d solved for F.
static func required_force_for_work(target_work: float, displacement: float) -> float:
	return target_work / displacement


# The velocity a player would need for a perfect Kinetic Energy attempt,
# given a fixed mass - KE = 1/2*m*v^2 solved for v (v >= 0).
static func required_velocity_for_ke(target_ke: float, mass: float) -> float:
	return sqrt(2.0 * target_ke / mass)


# The net work a player would need for a perfect Work-Energy Theorem
# attempt - exactly the required delta-KE, named for what is actually being
# solved for (can be negative when the target velocity is lower than the
# initial one, since slowing an object down requires negative net work).
static func required_net_work(mass: float, initial_velocity: float, target_velocity: float) -> float:
	return delta_kinetic_energy(mass, initial_velocity, target_velocity)
