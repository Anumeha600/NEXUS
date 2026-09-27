extends RefCounted

# --------------------------------------------------------------------------
# NEWTON'S LAWS PHYSICS
#
# Pure, deterministic math shared by the adaptive engine (challenge
# generation/scoring) and the gameplay/visual layer (challenge_manager.gd,
# newton_challenge.gd). No Node references, no scene dependencies - this is
# the single source of truth for the Newton's Laws formulas so difficulty
# generation and result scoring can never drift apart.
#
# Every Newton's Laws concept shares ONE relationship:
#
#   F_net = F_applied + F_extra
#   a = F_net / mass
#
# F_extra is what actually distinguishes the three concepts:
#   Force & Acceleration -> F_extra = 0                 (only the applied force acts)
#   Net Force            -> F_extra = second_force      (a second, already-present force)
#   Friction             -> F_extra = -friction_force    (opposes the applied force)
# --------------------------------------------------------------------------

const LearningContentScript := preload("res://scripts/learning_content.gd")


static func extra_force(content_id: String, second_force: float, friction_force: float) -> float:
	if content_id == LearningContentScript.NET_FORCE:
		return second_force
	if content_id == LearningContentScript.FRICTION:
		return -friction_force
	return 0.0


static func predicted_acceleration(applied_force: float, extra: float, mass: float) -> float:
	return (applied_force + extra) / mass


# The applied force a player would need for a perfect attempt - the same
# F_net = m*a relationship solved for F_applied.
static func required_force(target_acceleration: float, extra: float, mass: float) -> float:
	return target_acceleration * mass - extra
