extends RefCounted

# --------------------------------------------------------------------------
# LEARNING CONTENT
#
# Static registry of the NEXUS curriculum: subject -> modules -> concepts.
# This is pure data (titles, descriptions, objectives, which challenge
# parameters a concept varies) and holds no mastery values. It makes no
# adaptive decisions either - that logic lives entirely in adaptive_engine.gd,
# which reads this data but does not own it.
#
# All three modules (Projectile Motion, Newton's Laws, Work & Energy) have
# real gameplay (see challenge_manager.gd and adaptive_engine.gd's
# generate_next_challenge). Each module's "playable" flag still marks this
# explicitly so a future, not-yet-implemented module can never be mistaken
# for a real challenge by its callers.
# --------------------------------------------------------------------------

const SUBJECT_PHYSICS := "physics"

# --- Concept ids, grouped by the module they belong to -------------------

const SPEED_RANGE := "speed_range"
const GRAVITY_RANGE := "gravity_range"

const FORCE_ACCELERATION := "force_acceleration"
const NET_FORCE := "net_force"
const FRICTION := "friction"

const WORK := "work"
const KINETIC_ENERGY := "kinetic_energy"
const WORK_ENERGY_THEOREM := "work_energy_theorem"

# --- Module ids ------------------------------------------------------------

const MODULE_PROJECTILE_MOTION := "projectile_motion"
const MODULE_NEWTONS_LAWS := "newtons_laws"
const MODULE_WORK_ENERGY := "work_energy"

# Learning order across the subject. next_module_id() walks this list.
const MODULE_SEQUENCE := [MODULE_PROJECTILE_MOTION, MODULE_NEWTONS_LAWS, MODULE_WORK_ENERGY]

const MODULES := {
	MODULE_PROJECTILE_MOTION: {
		"module_id": MODULE_PROJECTILE_MOTION,
		"subject": SUBJECT_PHYSICS,
		"title": "Projectile Motion",
		"description": "Launch projectiles and discover how speed and gravity shape their range.",
		"playable": true,
		"concept_sequence": [SPEED_RANGE, GRAVITY_RANGE],
	},
	MODULE_NEWTONS_LAWS: {
		"module_id": MODULE_NEWTONS_LAWS,
		"subject": SUBJECT_PHYSICS,
		"title": "Newton's Laws",
		"description": "Investigate how forces, mass, and friction determine an object's acceleration.",
		"playable": true,
		"concept_sequence": [FORCE_ACCELERATION, NET_FORCE, FRICTION],
	},
	MODULE_WORK_ENERGY: {
		"module_id": MODULE_WORK_ENERGY,
		"subject": SUBJECT_PHYSICS,
		"title": "Work & Energy",
		"description": "Connect force and motion to work and kinetic energy.",
		"playable": true,
		"concept_sequence": [WORK, KINETIC_ENERGY, WORK_ENERGY_THEOREM],
	},
}

# --- Concept data ------------------------------------------------------------
#
# Fields (per section 3 of the Physics curriculum spec):
#   content_id, module_id, title, description, learning_objective,
#   difficulty_levels, prerequisite_concept ("" if none), parameters
#   (which challenge inputs this concept varies - only meaningful once a
#   concept is playable), feedback_text (a static insight/encouragement
#   line; challenge_manager.gd's dynamic per-attempt insight is separate
#   and unaffected by this).

const CONTENT := {
	SPEED_RANGE: {
		"content_id": SPEED_RANGE,
		"module_id": MODULE_PROJECTILE_MOTION,
		"title": "Speed & Range",
		"description": "Explore how launch speed affects distance.",
		"learning_objective": "Predict how a projectile's range changes as launch speed increases.",
		"difficulty_levels": ["Beginner", "Intermediate", "Advanced"],
		"prerequisite_concept": "",
		"parameters": ["speed"],
		"feedback_text": "At a fixed launch angle, range grows with the square of speed.",
	},
	GRAVITY_RANGE: {
		"content_id": GRAVITY_RANGE,
		"module_id": MODULE_PROJECTILE_MOTION,
		"title": "Gravity & Range",
		"description": "Explore how gravity affects projectile range.",
		"learning_objective": "Predict how a projectile's range changes as gravity increases or decreases.",
		"difficulty_levels": ["Beginner", "Intermediate", "Advanced"],
		"prerequisite_concept": SPEED_RANGE,
		"parameters": ["speed", "gravity"],
		"feedback_text": "Stronger gravity pulls a projectile down sooner, shortening its range.",
	},
	FORCE_ACCELERATION: {
		"content_id": FORCE_ACCELERATION,
		"module_id": MODULE_NEWTONS_LAWS,
		"title": "Force & Acceleration",
		"description": "Explore how applied force and mass determine acceleration (Newton's Second Law).",
		"learning_objective": "Predict how acceleration changes as applied force or mass changes.",
		"difficulty_levels": ["Beginner", "Intermediate", "Advanced"],
		"prerequisite_concept": "",
		"parameters": ["applied_force", "mass"],
		"feedback_text": "Acceleration is directly proportional to force and inversely proportional to mass: a = F / m.",
	},
	NET_FORCE: {
		"content_id": NET_FORCE,
		"module_id": MODULE_NEWTONS_LAWS,
		"title": "Net Force",
		"description": "Combine multiple forces acting on an object to find the net force.",
		"learning_objective": "Compute the net force from several forces and predict the resulting motion.",
		"difficulty_levels": ["Beginner", "Intermediate", "Advanced"],
		"prerequisite_concept": FORCE_ACCELERATION,
		"parameters": ["applied_force", "second_force", "mass"],
		"feedback_text": "Forces combine as vectors - opposing forces partially cancel instead of adding directly.",
	},
	FRICTION: {
		"content_id": FRICTION,
		"module_id": MODULE_NEWTONS_LAWS,
		"title": "Friction",
		"description": "Explore how friction opposes motion and reduces net force.",
		"learning_objective": "Predict how the friction force changes with surface and normal force, and its effect on acceleration.",
		"difficulty_levels": ["Beginner", "Intermediate", "Advanced"],
		"prerequisite_concept": NET_FORCE,
		"parameters": ["applied_force", "friction_force", "mass"],
		"feedback_text": "Friction opposes motion; a rougher surface or heavier object increases the friction force.",
	},
	WORK: {
		"content_id": WORK,
		"module_id": MODULE_WORK_ENERGY,
		"title": "Work",
		"description": "Explore how applied force and displacement combine to produce work.",
		"learning_objective": "Predict how work changes as applied force or displacement changes.",
		"difficulty_levels": ["Beginner", "Intermediate", "Advanced"],
		"prerequisite_concept": FORCE_ACCELERATION,
		"parameters": ["applied_force", "distance"],
		"feedback_text": "Work equals force times displacement in the direction of force: W = F x d.",
	},
	KINETIC_ENERGY: {
		"content_id": KINETIC_ENERGY,
		"module_id": MODULE_WORK_ENERGY,
		"title": "Kinetic Energy",
		"description": "Explore how mass and velocity determine an object's kinetic energy.",
		"learning_objective": "Predict how kinetic energy changes as mass or velocity changes.",
		"difficulty_levels": ["Beginner", "Intermediate", "Advanced"],
		"prerequisite_concept": WORK,
		"parameters": ["mass", "velocity"],
		"feedback_text": "Kinetic energy grows with the square of velocity: KE = 1/2 * m * v^2.",
	},
	WORK_ENERGY_THEOREM: {
		"content_id": WORK_ENERGY_THEOREM,
		"module_id": MODULE_WORK_ENERGY,
		"title": "Work-Energy Theorem",
		"description": "Connect work and energy: the net work done on an object equals its change in kinetic energy.",
		"learning_objective": "Predict the net work needed to change an object's velocity using the work-energy theorem.",
		"difficulty_levels": ["Beginner", "Intermediate", "Advanced"],
		"prerequisite_concept": KINETIC_ENERGY,
		"parameters": ["initial_velocity", "target_velocity", "mass"],
		"feedback_text": "The work-energy theorem: net work equals the change in kinetic energy, W_net = delta KE.",
	},
}


static func get_content(content_id: String) -> Dictionary:
	return CONTENT.get(content_id, {})


static func get_module(module_id: String) -> Dictionary:
	return MODULES.get(module_id, {})


static func get_module_for_content(content_id: String) -> String:
	return get_content(content_id).get("module_id", "")


# Returns the first concept in a module's own learning sequence, or ""
# if the module id is unknown.
static func first_content_id_of_module(module_id: String) -> String:
	var sequence: Array = get_module(module_id).get("concept_sequence", [])
	return sequence[0] if not sequence.is_empty() else ""


# Returns the next concept WITHIN THE SAME MODULE as content_id, or the
# same id if content_id is already the last concept in its module (moving
# to a different module is a separate decision - see adaptive_engine.gd's
# module-mastery gate - never automatic here).
static func next_content_id(content_id: String) -> String:
	var module_id := get_module_for_content(content_id)
	var sequence: Array = get_module(module_id).get("concept_sequence", [])
	var idx := sequence.find(content_id)
	if idx == -1 or idx + 1 >= sequence.size():
		return content_id
	return sequence[idx + 1]


# Returns the next module in the subject's learning sequence, or the same
# id if module_id is already the last module.
static func next_module_id(module_id: String) -> String:
	var idx := MODULE_SEQUENCE.find(module_id)
	if idx == -1 or idx + 1 >= MODULE_SEQUENCE.size():
		return module_id
	return MODULE_SEQUENCE[idx + 1]
