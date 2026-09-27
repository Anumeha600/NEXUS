extends RefCounted

# --------------------------------------------------------------------------
# ADAPTIVE ENGINE
#
# Owns the learner model and every adaptive decision:
#   - OVERALL mastery (unchanged from earlier milestones)
#   - CONCEPT mastery, one value per learning concept, across every module
#   - MODULE mastery, derived from the mastery of a module's own concepts
#   - which concept/module is currently active, and when to advance either
#   - difficulty (challenge parameters) for whatever concept is active
#   - the human-readable reasons behind both the difficulty and content
#     decisions
#
# Content metadata (titles/descriptions/which parameters a concept varies)
# lives in learning_content.gd - this file only decides mastery and
# selection, never concept text.
#
# --------------------------------------------------------------------------
# OVERALL MASTERY MODEL (unchanged)
#
# `mastery` is a single 0..1 value tracking overall physics proficiency
# across every concept. It is updated after every attempt using an
# exponential moving average (EMA) of a per-attempt "performance" score,
# nudged by whether recent attempts are trending up or down.
#
#   performance = 0.6 * accuracy + 0.3 * success + 0.1 * speed
#   mastery = mastery + LEARNING_RATE * (performance - mastery)
#                     + TREND_WEIGHT * trend
#
# CONCEPT MASTERY uses the EXACT SAME update rule (same performance value,
# same EMA/trend math), just applied to a separate mastery value and
# history per concept. Overall mastery is a whole-game progress readout;
# concept mastery is what actually drives difficulty and content decisions.
#
# MODULE MASTERY is not tracked independently at all - it is always the
# plain average of that module's own concept masteries (see
# get_module_mastery()), so it can never drift out of sync with the
# concepts it summarizes.
# --------------------------------------------------------------------------

const LearningContentScript := preload("res://scripts/learning_content.gd")
const NewtonPhysicsScript := preload("res://scripts/modules/newton_physics.gd")
const WorkEnergyPhysicsScript := preload("res://scripts/modules/work_energy_physics.gd")

const LEARNING_RATE := 0.25
const TREND_WEIGHT := 0.05
const MAX_RESPONSE_TIME := 10.0 # seconds; responses at/above this score 0 on speed
const HISTORY_LIMIT := 5

# Content-transition thresholds, applied to the ACTIVE concept's own
# mastery (never the overall mastery, never randomness):
#   below STRUGGLE_THRESHOLD      -> keep practicing this concept
#   at/above MASTERED_THRESHOLD   -> move to the next concept (if any)
#   in between                    -> keep practicing, no transition yet
# These reuse the same 0.35/0.75-ish split already used for difficulty
# tiers below, so "mastered" lines up with entering the Advanced tier.
const STRUGGLE_THRESHOLD := 0.35
const MASTERED_THRESHOLD := 0.75

# A module becomes eligible to hand off to the next module once its own
# (average-of-concepts) mastery reaches this bar. Reuses MASTERED_THRESHOLD
# rather than inventing a second magic number - "module mastered" means the
# same 0.75 bar as "concept mastered".
const MODULE_MASTERED_THRESHOLD := MASTERED_THRESHOLD

var mastery: float = 0.3 # overall, start at a modest baseline rather than 0
var attempt_count: int = 0

var current_module_id: String = LearningContentScript.MODULE_PROJECTILE_MOTION
var current_content_id: String = LearningContentScript.SPEED_RANGE

# One mastery value per concept across the WHOLE curriculum (every module),
# not just the currently active module - a learner can be strong in one
# concept and weak in another at the same time. All start at the same
# modest baseline as overall mastery.
var concept_mastery: Dictionary = {}

var _performance_history: Array = []
var _concept_performance_history: Dictionary = {}


func _init() -> void:
	for module_id in LearningContentScript.MODULE_SEQUENCE:
		var module := LearningContentScript.get_module(module_id)
		for content_id in module.get("concept_sequence", []):
			concept_mastery[content_id] = 0.3


# Records one attempt: updates OVERALL mastery (exactly as before) and,
# additionally, the mastery of whichever concept was active for this
# attempt. Returns the attempt's performance score (0..1).
func record_attempt(distance_error: float, tolerance: float, success: bool, response_time: float) -> float:
	attempt_count += 1

	var accuracy := clampf(1.0 - distance_error / (tolerance * 3.0), 0.0, 1.0)
	var success_score := 1.0 if success else 0.0
	var speed_score := clampf(1.0 - response_time / MAX_RESPONSE_TIME, 0.0, 1.0)
	var performance := 0.6 * accuracy + 0.3 * success_score + 0.1 * speed_score

	mastery = _update_mastery(mastery, performance, _performance_history)

	var concept_history: Array = _concept_performance_history.get(current_content_id, [])
	concept_mastery[current_content_id] = _update_mastery(
		concept_mastery[current_content_id], performance, concept_history
	)
	_concept_performance_history[current_content_id] = concept_history

	return performance


# Shared EMA + trend update rule (see header comment). `history` is
# mutated in place (it's the caller's own rolling history array), so the
# same function serves both the overall and per-concept mastery values.
func _update_mastery(current: float, performance: float, history: Array) -> float:
	history.append(performance)
	if history.size() > HISTORY_LIMIT:
		history.pop_front()

	var trend := _recent_trend(history)
	return clampf(current + LEARNING_RATE * (performance - current) + TREND_WEIGHT * trend, 0.0, 1.0)


# Compares the average of the most recent half of a history to the older
# half. Positive = improving, negative = declining, 0 if not enough data.
func _recent_trend(history: Array) -> float:
	var n := history.size()
	if n < 4:
		return 0.0
	var half := n / 2
	var recent := history.slice(n - half, n)
	var older := history.slice(0, n - half)
	return _average(recent) - _average(older)


func _average(values: Array) -> float:
	if values.is_empty():
		return 0.0
	var total := 0.0
	for v in values:
		total += v
	return total / values.size()


# Module mastery is derived, never stored: the plain average of the
# mastery of every concept in that module's own sequence. This keeps
# module mastery permanently consistent with its concepts - there is no
# separate value that could drift out of sync.
func get_module_mastery(module_id: String) -> float:
	var sequence: Array = LearningContentScript.get_module(module_id).get("concept_sequence", [])
	if sequence.is_empty():
		return 0.0
	var total := 0.0
	for content_id in sequence:
		total += concept_mastery.get(content_id, 0.0)
	return total / sequence.size()


# Turns a CONCEPT mastery change into a short, honest difficulty
# explanation. Concept mastery (not overall mastery) is what actually
# drives the next challenge's difficulty, so this must be derived from
# the concept delta - never invented.
func get_adaptation_reason(concept_mastery_before: float, concept_mastery_after: float) -> String:
	var delta := concept_mastery_after - concept_mastery_before
	if delta > 0.01:
		return "Difficulty increased."
	elif delta < -0.01:
		return "Challenge simplified."
	else:
		return "Difficulty maintained."


# Decides whether to keep practicing the current concept, advance to the
# next concept in the current module, or (once every concept in the
# module is mastered) hand off to the next module entirely. Uses ONLY the
# active concept's own mastery, and the active module's derived mastery
# for the module-level gate - never overall mastery, never randomness.
# May mutate current_content_id and/or current_module_id. Returns a short,
# honest explanation of whatever it decided.
func evaluate_content_transition() -> String:
	var content := LearningContentScript.get_content(current_content_id)
	var concept_name: String = content.get("title", "")
	var m: float = concept_mastery[current_content_id]

	if m < STRUGGLE_THRESHOLD:
		return "%s needs more practice." % concept_name

	if m >= MASTERED_THRESHOLD:
		var next_id := LearningContentScript.next_content_id(current_content_id)
		if next_id != current_content_id:
			var next_content := LearningContentScript.get_content(next_id)
			var next_name: String = next_content.get("title", "")
			current_content_id = next_id
			return "%s mastered.\nIntroducing %s." % [concept_name, next_name]

		# Last concept in this module - only the module's own derived
		# mastery decides whether the whole module can hand off next.
		var module_mastery := get_module_mastery(current_module_id)
		if module_mastery >= MODULE_MASTERED_THRESHOLD:
			var next_module_id := LearningContentScript.next_module_id(current_module_id)
			if next_module_id != current_module_id:
				var module_title: String = LearningContentScript.get_module(current_module_id).get("title", "")
				var next_module_title: String = LearningContentScript.get_module(next_module_id).get("title", "")
				current_module_id = next_module_id
				current_content_id = LearningContentScript.first_content_id_of_module(next_module_id)
				return "%s module mastered.\nIntroducing %s." % [module_title, next_module_title]
			else:
				return "%s mastered.\nContinuing advanced practice." % concept_name

		return "%s mastered.\nContinuing practice to complete this module." % concept_name

	return "%s in progress." % concept_name


func _tier_name(m: float) -> String:
	if m < 0.4:
		return "Beginner"
	elif m < 0.75:
		return "Intermediate"
	else:
		return "Advanced"


# Difficulty shown on the HUD is the CURRENT concept's own tier, not the
# overall mastery - each concept progresses through Beginner/Intermediate/
# Advanced independently.
func get_difficulty_name() -> String:
	return _tier_name(concept_mastery[current_content_id])


# Builds the next challenge purely from the active concept's own mastery.
# Distance/tolerance scale smoothly *within* a tier so consecutive
# challenges don't feel like a random jump. Gravity only varies for the
# "Gravity & Range" concept; Speed & Range always uses the project's
# standard gravity, exactly as in earlier milestones.
#
# All three modules have real gameplay parameters now. The playable-check
# and _generate_placeholder_challenge() below remain in place for whatever
# module comes after Work & Energy, so a future addition to
# learning_content.gd's MODULE_SEQUENCE can never be mistaken for a real
# challenge before its own generator exists.
func generate_next_challenge(challenge_id: int) -> Dictionary:
	var content := LearningContentScript.get_content(current_content_id)
	var module := LearningContentScript.get_module(current_module_id)
	if not module.get("playable", false):
		return _generate_placeholder_challenge(challenge_id, content)

	if current_module_id == LearningContentScript.MODULE_NEWTONS_LAWS:
		return _generate_newton_challenge(challenge_id, content)

	if current_module_id == LearningContentScript.MODULE_WORK_ENERGY:
		return _generate_work_energy_challenge(challenge_id, content)

	var concept_m: float = concept_mastery[current_content_id]

	var tier_min: float
	var tier_max: float
	var dist_range: Vector2
	var tol_range: Vector2
	var gravity_range: Vector2

	if concept_m < 0.4:
		tier_min = 0.0
		tier_max = 0.4
		dist_range = Vector2(4.0, 8.0)
		tol_range = Vector2(1.5, 1.0)
		gravity_range = Vector2(6.0, 9.8)
	elif concept_m < 0.75:
		tier_min = 0.4
		tier_max = 0.75
		dist_range = Vector2(8.0, 14.0)
		tol_range = Vector2(1.0, 0.6)
		gravity_range = Vector2(9.8, 14.0)
	else:
		tier_min = 0.75
		tier_max = 1.0
		dist_range = Vector2(14.0, 20.0)
		tol_range = Vector2(0.6, 0.3)
		gravity_range = Vector2(14.0, 19.6)

	var t := clampf((concept_m - tier_min) / (tier_max - tier_min), 0.0, 1.0)
	var target_distance := lerpf(dist_range.x, dist_range.y, t)
	var tolerance := lerpf(tol_range.x, tol_range.y, t)

	# Simplified horizontal launch model: a fixed 45 degree launch angle
	# means range R = v^2 / g (since sin(2 * 45deg) == 1). Gravity is the
	# project's standard value unless the active concept is specifically
	# about varying gravity.
	var default_gravity: float = ProjectSettings.get_setting("physics/3d/default_gravity", 9.8)
	var gravity: float = default_gravity
	if current_content_id == LearningContentScript.GRAVITY_RANGE:
		gravity = lerpf(gravity_range.x, gravity_range.y, t)

	var expected_speed := sqrt(target_distance * gravity)

	return {
		"id": challenge_id,
		"playable": true,
		"target_distance": target_distance,
		"tolerance": tolerance,
		"gravity": gravity,
		"expected_speed": expected_speed,
		"difficulty": _tier_name(concept_m),
		"content_id": current_content_id,
		"module_id": current_module_id,
		"concept_name": content.get("title", ""),
		"concept_description": content.get("description", ""),
	}


# Builds the next Newton's Laws challenge purely from the active concept's
# own mastery, using the same three-tier banding (and the same
# smooth-within-tier interpolation) as generate_next_challenge() above -
# just with mass/target acceleration/tolerance in place of
# distance/tolerance/gravity. Force & Acceleration never varies
# second_force/friction_force (both stay 0); Net Force only varies
# second_force; Friction only varies friction_force - see
# newton_physics.gd's extra_force() for how each concept actually uses
# these numbers.
func _generate_newton_challenge(challenge_id: int, content: Dictionary) -> Dictionary:
	var concept_m: float = concept_mastery[current_content_id]

	var tier_index: int
	var tier_min: float
	var tier_max: float
	var mass_range: Vector2
	var accel_range: Vector2
	var tol_range: Vector2
	var round_to_clean_values := false

	if concept_m < 0.4:
		tier_index = 0
		tier_min = 0.0
		tier_max = 0.4
		mass_range = Vector2(1.0, 3.0)
		accel_range = Vector2(1.0, 2.0)
		tol_range = Vector2(0.8, 0.5)
		round_to_clean_values = true
	elif concept_m < 0.75:
		tier_index = 1
		tier_min = 0.4
		tier_max = 0.75
		mass_range = Vector2(3.0, 6.0)
		accel_range = Vector2(1.5, 3.0)
		tol_range = Vector2(0.5, 0.3)
	else:
		tier_index = 2
		tier_min = 0.75
		tier_max = 1.0
		mass_range = Vector2(6.0, 10.0)
		accel_range = Vector2(2.5, 5.0)
		tol_range = Vector2(0.3, 0.15)

	var t := clampf((concept_m - tier_min) / (tier_max - tier_min), 0.0, 1.0)
	var mass := lerpf(mass_range.x, mass_range.y, t)
	var target_acceleration := lerpf(accel_range.x, accel_range.y, t)
	var tolerance := lerpf(tol_range.x, tol_range.y, t)

	if round_to_clean_values:
		mass = round(mass)
		target_acceleration = round(target_acceleration * 2.0) / 2.0 # nearest 0.5

	var second_force := 0.0
	var friction_force := 0.0

	if current_content_id == LearningContentScript.NET_FORCE:
		# Beginner: a small aiding (same-direction) second force. Advanced:
		# a larger opposing second force, matching the "opposing forces"
		# guidance for higher difficulty. Intermediate sweeps through zero.
		var second_force_range: Vector2
		match tier_index:
			0: second_force_range = Vector2(1.0, 3.0)
			1: second_force_range = Vector2(3.0, -2.0)
			_: second_force_range = Vector2(-3.0, -8.0)
		second_force = lerpf(second_force_range.x, second_force_range.y, t)
	elif current_content_id == LearningContentScript.FRICTION:
		var friction_range: Vector2
		match tier_index:
			0: friction_range = Vector2(0.5, 2.0)
			1: friction_range = Vector2(2.0, 5.0)
			_: friction_range = Vector2(5.0, 10.0)
		friction_force = lerpf(friction_range.x, friction_range.y, t)

	var extra := NewtonPhysicsScript.extra_force(current_content_id, second_force, friction_force)
	var required_force := NewtonPhysicsScript.required_force(target_acceleration, extra, mass)

	return {
		"id": challenge_id,
		"playable": true,
		"module_id": current_module_id,
		"content_id": current_content_id,
		"concept_name": content.get("title", ""),
		"concept_description": content.get("description", ""),
		"difficulty": _tier_name(concept_m),
		"mass": mass,
		"target_acceleration": target_acceleration,
		"tolerance": tolerance,
		"second_force": second_force,
		"friction_force": friction_force,
		"required_force": required_force,
	}


# Builds the next Work & Energy challenge purely from the active concept's
# own mastery, using the same three-tier banding as the other two modules.
# Mass is shown for every concept (narrative/visual continuity with the
# shared cart), but note it is NEVER part of the Work formula (W = F*d has
# no mass term) - it only matters for Kinetic Energy and the Work-Energy
# Theorem. Each concept returns its own additional fields; see
# work_energy_physics.gd for the one formula each uses.
func _generate_work_energy_challenge(challenge_id: int, content: Dictionary) -> Dictionary:
	var concept_m: float = concept_mastery[current_content_id]

	var tier_index: int
	var tier_min: float
	var tier_max: float
	var mass_range: Vector2
	var round_to_clean_values := false

	if concept_m < 0.4:
		tier_index = 0
		tier_min = 0.0
		tier_max = 0.4
		mass_range = Vector2(1.0, 3.0)
		round_to_clean_values = true
	elif concept_m < 0.75:
		tier_index = 1
		tier_min = 0.4
		tier_max = 0.75
		mass_range = Vector2(3.0, 6.0)
	else:
		tier_index = 2
		tier_min = 0.75
		tier_max = 1.0
		mass_range = Vector2(6.0, 10.0)

	var t := clampf((concept_m - tier_min) / (tier_max - tier_min), 0.0, 1.0)
	var mass := lerpf(mass_range.x, mass_range.y, t)
	if round_to_clean_values:
		mass = round(mass)

	var base := {
		"id": challenge_id,
		"playable": true,
		"module_id": current_module_id,
		"content_id": current_content_id,
		"concept_name": content.get("title", ""),
		"concept_description": content.get("description", ""),
		"difficulty": _tier_name(concept_m),
		"mass": mass,
	}

	if current_content_id == LearningContentScript.WORK:
		var distance_range: Vector2
		var work_range: Vector2
		var tol_range: Vector2
		match tier_index:
			0:
				distance_range = Vector2(3.0, 6.0)
				work_range = Vector2(20.0, 60.0)
				tol_range = Vector2(15.0, 10.0)
			1:
				distance_range = Vector2(6.0, 10.0)
				work_range = Vector2(60.0, 150.0)
				tol_range = Vector2(10.0, 6.0)
			_:
				distance_range = Vector2(10.0, 15.0)
				work_range = Vector2(150.0, 300.0)
				tol_range = Vector2(6.0, 3.0)

		var distance := lerpf(distance_range.x, distance_range.y, t)
		var target_work := lerpf(work_range.x, work_range.y, t)
		var tolerance := lerpf(tol_range.x, tol_range.y, t)
		if round_to_clean_values:
			distance = round(distance)
			target_work = round(target_work / 5.0) * 5.0

		base["distance"] = distance
		base["target_work"] = target_work
		base["tolerance"] = tolerance
		base["required_force"] = WorkEnergyPhysicsScript.required_force_for_work(target_work, distance)
		return base

	if current_content_id == LearningContentScript.KINETIC_ENERGY:
		var ke_range: Vector2
		var tol_range: Vector2
		match tier_index:
			0:
				ke_range = Vector2(4.0, 20.0)
				tol_range = Vector2(4.0, 2.0)
			1:
				ke_range = Vector2(20.0, 80.0)
				tol_range = Vector2(2.0, 1.0)
			_:
				ke_range = Vector2(80.0, 200.0)
				tol_range = Vector2(1.0, 0.5)

		var target_ke := lerpf(ke_range.x, ke_range.y, t)
		var tolerance := lerpf(tol_range.x, tol_range.y, t)
		if round_to_clean_values:
			target_ke = round(target_ke)

		base["target_ke"] = target_ke
		base["tolerance"] = tolerance
		base["required_velocity"] = WorkEnergyPhysicsScript.required_velocity_for_ke(target_ke, mass)
		return base

	# WORK_ENERGY_THEOREM. Advanced tier's target range dips below its
	# initial-velocity range, so a fully mastered learner sometimes has to
	# solve for a NEGATIVE net work (slowing the object down) - a more
	# demanding combination, exactly as the difficulty spec asks for.
	var initial_range: Vector2
	var target_v_range: Vector2
	var tol_range: Vector2
	match tier_index:
		0:
			initial_range = Vector2(1.0, 3.0)
			target_v_range = Vector2(3.0, 6.0)
			tol_range = Vector2(15.0, 10.0)
		1:
			initial_range = Vector2(2.0, 5.0)
			target_v_range = Vector2(6.0, 10.0)
			tol_range = Vector2(10.0, 6.0)
		_:
			initial_range = Vector2(3.0, 6.0)
			target_v_range = Vector2(5.0, 2.0)
			tol_range = Vector2(6.0, 3.0)

	var initial_velocity := lerpf(initial_range.x, initial_range.y, t)
	var target_velocity := lerpf(target_v_range.x, target_v_range.y, t)
	var tolerance := lerpf(tol_range.x, tol_range.y, t)
	if round_to_clean_values:
		initial_velocity = round(initial_velocity)
		target_velocity = round(target_velocity)

	base["initial_velocity"] = initial_velocity
	base["target_velocity"] = target_velocity
	base["tolerance"] = tolerance
	base["required_net_work"] = WorkEnergyPhysicsScript.required_net_work(mass, initial_velocity, target_velocity)
	return base


# Structured placeholder for a concept whose module has no gameplay yet.
# Still reflects the real difficulty tier for that concept's mastery so the
# adaptive loop (mastery -> difficulty) is demonstrable even before the
# challenge itself exists - it deliberately omits any gameplay-shaped keys
# (target_distance/gravity/expected_speed) so a caller can never mistake it
# for a real challenge; callers must check "playable" first.
func _generate_placeholder_challenge(challenge_id: int, content: Dictionary) -> Dictionary:
	var concept_m: float = concept_mastery[current_content_id]
	return {
		"id": challenge_id,
		"playable": false,
		"difficulty": _tier_name(concept_m),
		"content_id": current_content_id,
		"module_id": current_module_id,
		"concept_name": content.get("title", ""),
		"concept_description": content.get("description", ""),
		"learning_objective": content.get("learning_objective", ""),
		"placeholder_note": "Gameplay for this module is not implemented yet.",
	}
