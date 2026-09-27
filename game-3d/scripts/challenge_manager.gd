extends Node

# --------------------------------------------------------------------------
# CHALLENGE MANAGER
#
# Owns the full challenge loop for whichever module is currently active:
#   generate challenge -> show it -> player attempts it ->
#   score attempt -> update mastery -> next challenge
#
# The adaptive logic itself (overall + concept + module mastery, difficulty,
# content selection, adaptation reasoning) lives in AdaptiveEngine
# (scripts/adaptive_engine.gd); this script is the glue between the 3D
# scene, the HUD, and the engine - for all three playable modules now.
# Player movement is entirely separate, in scripts/player.gd.
#
# Projectile Motion's own gameplay (launch_point/target/trajectory_preview,
# _launch(), _on_projectile_landed(), _physics_insight()) is untouched from
# the original single-module version of this file, aside from routing its
# result text through the shared _show_result() helper and a success
# glow/pulse. Newton's Laws and Work & Energy each live in their own
# clearly-named functions plus their own scripts/modules/*_challenge.gd
# (visuals) and *_physics.gd (shared math). Work & Energy deliberately
# reuses the SAME cart/arrow nodes as Newton's Laws (see
# _set_active_module_visible()) rather than a third near-identical arena.
#
# The three modules share code in exactly three places: _advance_to_
# challenge() (routes to whichever module/challenge comes next and fixes
# the module-switch cosmetic gap), _show_result() (one result-panel look
# for all three), and the small HUD/mastery-bar/difficulty-color helpers.
# Visual constants (colors) live in scripts/design/palette.gd - the single
# source of truth for the NEXUS design system.
# --------------------------------------------------------------------------

const AdaptiveEngineScript := preload("res://scripts/adaptive_engine.gd")
const LearningContentScript := preload("res://scripts/learning_content.gd")
const NewtonPhysicsScript := preload("res://scripts/modules/newton_physics.gd")
const NewtonChallengeScript := preload("res://scripts/modules/newton_challenge.gd")
const WorkEnergyPhysicsScript := preload("res://scripts/modules/work_energy_physics.gd")
const WorkEnergyChallengeScript := preload("res://scripts/modules/work_energy_challenge.gd")
const PaletteScript := preload("res://scripts/design/palette.gd")
const WebBridgeScript := preload("res://scripts/web_bridge.gd")
const PROJECTILE_SCENE: PackedScene = preload("res://scenes/projectile.tscn")

# Fixed 45 degree launch angle for the simplified projectile model (this
# matches the R = v^2 / g formula used in adaptive_engine.gd). The player
# controls "v", the launch speed in m/s - not a force.
const LAUNCH_ANGLE := PI / 4.0
const MIN_SPEED := 2.0
const MAX_SPEED := 22.0
const DEFAULT_SPEED := 8.0
const SPEED_STEP_PER_SECOND := 6.0
const RESULT_DISPLAY_TIME := 3.5

# Newton's Laws applied-force control range. Wide enough to cover every
# difficulty tier's required force (mass up to 10kg * accel up to 5 m/s^2,
# plus up to 10N of friction or a strongly opposing second force) with
# comfortable headroom in both directions.
const MIN_FORCE := -30.0
const MAX_FORCE := 90.0
const DEFAULT_FORCE := 0.0
const FORCE_STEP_PER_SECOND := 40.0

# Work & Energy control ranges - one per concept, since each controls a
# different physical quantity (force / velocity / net work directly).
const MIN_WORK_FORCE := -10.0
const MAX_WORK_FORCE := 60.0
const WORK_FORCE_STEP_PER_SECOND := 35.0
const MIN_VELOCITY := 0.0
const MAX_VELOCITY := 20.0
const VELOCITY_STEP_PER_SECOND := 8.0
const MIN_NET_WORK := -250.0
const MAX_NET_WORK := 400.0
const NET_WORK_STEP_PER_SECOND := 150.0

const MODULE_TRANSITION_DISPLAY_TIME := 2.0
const MASTERY_BAR_TWEEN_TIME := 0.4

@onready var launch_point: Node3D = get_node("../LaunchPoint")
@onready var target: Node3D = get_node("../Target")
@onready var runway: MeshInstance3D = get_node("../Runway")
@onready var boundary_near: Node3D = get_node("../BoundaryNear")
@onready var boundary_far: Node3D = get_node("../BoundaryFar")
@onready var target_disc: MeshInstance3D = get_node("../Target/Disc")
@onready var trajectory_preview: Node3D = get_node("../LaunchPoint/TrajectoryPreview")

# Shared "force arena" nodes - used by Newton's Laws AND Work & Energy.
@onready var newton_arena: Node3D = get_node("../NewtonArena")
@onready var newton_cart: MeshInstance3D = get_node("../NewtonArena/Cart")
@onready var newton_applied_arrow: MeshInstance3D = get_node("../NewtonArena/ArrowAnchor/AppliedForceArrow")
@onready var newton_target_arrow: MeshInstance3D = get_node("../NewtonArena/ArrowAnchor/TargetAccelArrow")
@onready var newton_target_arrow_head: MeshInstance3D = get_node("../NewtonArena/ArrowAnchor/TargetAccelArrowHead")
@onready var newton_secondary_arrow: MeshInstance3D = get_node("../NewtonArena/ArrowAnchor/SecondaryForceArrow")
@onready var we_displacement_indicator: Node3D = get_node("../NewtonArena/DisplacementIndicator")
@onready var we_displacement_line: MeshInstance3D = get_node("../NewtonArena/DisplacementIndicator/Line")
@onready var we_displacement_tick_end: MeshInstance3D = get_node("../NewtonArena/DisplacementIndicator/TickEnd")

@onready var module_label: Label = %ModuleLabel
@onready var concept_name_label: Label = %ConceptNameLabel
@onready var concept_description_label: Label = %ConceptDescriptionLabel

# TargetDistanceRow/SpeedRow (Projectile) and TargetAccelerationRow/
# AppliedForceRow (Newton's Laws + Work & Energy, GENERIC - reused across
# both) are the "big value" rows: a small static or dynamic caption above a
# large, semantically-colored number (gold = target/objective, cyan =
# player-controlled - see scripts/design/palette.gd). Only one pair is ever
# visible at a time. Their *_label children are also unique-named since
# their .text is set every HUD update; the two _caption children are only
# unique-named where the caption text itself must change per concept.
@onready var target_distance_row: Control = %TargetDistanceRow
@onready var target_distance_label: Label = %TargetDistanceLabel
@onready var speed_row: Control = %SpeedRow
@onready var speed_label: Label = %SpeedLabel
@onready var target_acceleration_row: Control = %TargetAccelerationRow
@onready var target_acceleration_caption: Label = %TargetAccelerationCaption
@onready var target_acceleration_label: Label = %TargetAccelerationLabel
@onready var applied_force_row: Control = %AppliedForceRow
@onready var applied_force_caption: Label = %AppliedForceCaption
@onready var applied_force_label: Label = %AppliedForceLabel

# Compact single-line "Label: value" fields - kept simple since they're
# supporting context rather than the primary quantity being compared.
# gravity_label is Projectile-only; mass_label/friction_label are GENERIC,
# reused across Newton's Laws and Work & Energy exactly as before.
@onready var gravity_label: Label = %GravityLabel
@onready var mass_label: Label = %MassLabel
@onready var friction_label: Label = %FrictionLabel
@onready var physics_hint_label: Label = %PhysicsHintLabel
@onready var controls_label: Label = %ControlsLabel
@onready var mastery_label: Label = %MasteryLabel
@onready var mastery_bar: ProgressBar = %MasteryBar
@onready var difficulty_dot: Label = %DifficultyDot
@onready var difficulty_label: Label = %DifficultyLabel
@onready var attempts_label: Label = %AttemptsLabel

# Result panel - one PanelContainer (result_box) holds two mutually
# exclusive content blocks: challenge_result (shown after every scored
# attempt, all three modules) and module_transition (shown only when the
# adaptive engine moves the player to a new module). See _show_result() and
# _show_module_transition().
@onready var result_box: PanelContainer = %ResultBox
@onready var challenge_result: Control = %ChallengeResult
@onready var header_label: Label = %HeaderLabel
@onready var target_value_label: Label = %TargetValueLabel
@onready var actual_value_label: Label = %ActualValueLabel
@onready var mastery_value_label: Label = %MasteryValueLabel
@onready var insight_caption_label: Label = %InsightCaptionLabel
@onready var insight_text_label: Label = %InsightTextLabel
@onready var next_text_label: Label = %NextTextLabel
@onready var module_transition: Control = %ModuleTransition
@onready var old_module_label: Label = %OldModuleLabel
@onready var new_module_label: Label = %NewModuleLabel

# The gravity actually used for the trajectory preview AND the real launch.
# It always comes from the CURRENT challenge (set in
# _begin_projectile_challenge()) so the displayed value, the preview, and
# the projectile can never disagree. The ProjectSettings default here is
# only a fallback before the first challenge is generated.
var _gravity: float = ProjectSettings.get_setting("physics/3d/default_gravity", 9.8)
var _adaptive_engine := AdaptiveEngineScript.new()
var _newton_challenge := NewtonChallengeScript.new()
var _work_energy_challenge := WorkEnergyChallengeScript.new()

var current_challenge: Dictionary = {}
var current_speed: float = DEFAULT_SPEED
var current_force: float = DEFAULT_FORCE
# Generic control value reused by every Work & Energy concept - its unit
# and meaning change with the active concept (Newtons for Work, m/s for
# Kinetic Energy, Joules for the Work-Energy Theorem's direct net-work
# control). See _predicted_work_energy_value()/_required_work_energy_
# control_value() for how it's interpreted.
var current_control_value: float = 0.0
var attempt_number: int = 0
var awaiting_result: bool = false
var _challenge_start_time_ms: int = 0
var _landing_marker: MeshInstance3D = null

# Full in-memory record of every attempt (Section 4: performance data).
var performance_history: Array = []


func _ready() -> void:
	_newton_challenge.setup(newton_cart, newton_applied_arrow, newton_target_arrow, newton_target_arrow_head, newton_secondary_arrow)
	_work_energy_challenge.setup(newton_cart, newton_applied_arrow, newton_target_arrow, newton_target_arrow_head, we_displacement_indicator, we_displacement_line, we_displacement_tick_end)

	attempt_number = 1
	current_challenge = _adaptive_engine.generate_next_challenge(attempt_number)
	_set_active_module_visible(_current_module_id())
	_begin_active_module_challenge()


func _process(delta: float) -> void:
	if awaiting_result:
		return
	match _current_module_id():
		LearningContentScript.MODULE_NEWTONS_LAWS:
			_process_newton_input(delta)
		LearningContentScript.MODULE_WORK_ENERGY:
			_process_work_energy_input(delta)
		_:
			_process_projectile_input(delta)


func _unhandled_input(event: InputEvent) -> void:
	if awaiting_result or not event.is_action_pressed("launch_projectile"):
		return
	match _current_module_id():
		LearningContentScript.MODULE_NEWTONS_LAWS:
			_confirm_force()
		LearningContentScript.MODULE_WORK_ENERGY:
			_confirm_work_energy()
		_:
			_launch()


func _current_module_id() -> String:
	return current_challenge.get("module_id", LearningContentScript.MODULE_PROJECTILE_MOTION)


# --------------------------------------------------------------------------
# SHARED ROUTING - called after every scored attempt in any module, once
# the adaptive engine has produced the next challenge. This is what fixes
# the old cosmetic gap: the engine can silently move on to a different
# module internally, and this is the one place that notices and switches
# the visible scene/HUD to match - refreshing the HUD immediately (before
# the transition banner even finishes) so the player is never looking at
# stale module/concept/control information.
# --------------------------------------------------------------------------
func _advance_to_challenge(next_challenge: Dictionary) -> void:
	if not next_challenge.get("playable", true):
		# The engine moved on to a module with no gameplay yet. Keep
		# looping on the last real challenge instead of switching to
		# something the scene can't show.
		_begin_active_module_challenge()
		awaiting_result = false
		return

	var next_module_id: String = next_challenge.get("module_id", LearningContentScript.MODULE_PROJECTILE_MOTION)
	var previous_module_id := _current_module_id()

	if next_module_id != previous_module_id:
		var old_title: String = LearningContentScript.get_module(previous_module_id).get("title", "")
		var new_title: String = LearningContentScript.get_module(next_module_id).get("title", "")
		current_challenge = next_challenge
		_set_active_module_visible(next_module_id)
		_update_hud() # refresh module/concept/controls now - never leave stale info showing
		_show_module_transition(old_title, new_title)
		await get_tree().create_timer(MODULE_TRANSITION_DISPLAY_TIME).timeout
	else:
		current_challenge = next_challenge

	_begin_active_module_challenge()
	awaiting_result = false


func _begin_active_module_challenge() -> void:
	match _current_module_id():
		LearningContentScript.MODULE_NEWTONS_LAWS:
			_begin_newton_challenge()
		LearningContentScript.MODULE_WORK_ENERGY:
			_begin_work_energy_challenge()
		_:
			_begin_projectile_challenge()
	_emit_challenge_started()


func _set_active_module_visible(module_id: String) -> void:
	# LaunchPoint/Target are Projectile Motion only. NewtonArena (cart +
	# force arrows) is reused as-is for BOTH Newton's Laws and Work &
	# Energy - same visual grammar, different meaning per module/concept -
	# rather than building a second near-identical arena.
	var is_projectile := module_id == LearningContentScript.MODULE_PROJECTILE_MOTION
	launch_point.visible = is_projectile
	target.visible = is_projectile
	runway.visible = is_projectile
	boundary_near.visible = is_projectile
	boundary_far.visible = is_projectile
	newton_arena.visible = not is_projectile


# --------------------------------------------------------------------------
# RESULT PRESENTATION - shared by all three modules so they read as one
# product. Populates the ChallengeResult block directly (see nexus_world.
# tscn) rather than building one long string, so TARGET/ACTUAL/MASTERY read
# as distinct, visually prominent numbers instead of plain paragraph text.
# --------------------------------------------------------------------------
func _show_result(success: bool, target_text: String, actual_text: String, overall_before: float, overall_after: float, insight: String, next_summary: String) -> void:
	result_box.visible = true
	module_transition.visible = false
	challenge_result.visible = true

	header_label.text = "GREAT EXPERIMENT" if success else "TRY AGAIN"
	header_label.add_theme_color_override("font_color", PaletteScript.outcome_color(success))

	target_value_label.text = target_text
	actual_value_label.text = actual_text
	mastery_value_label.text = "%d%% → %d%%" % [
		int(round(overall_before * 100.0)), int(round(overall_after * 100.0)),
	]

	insight_caption_label.text = "PHYSICS INSIGHT" if success else "WHAT HAPPENED"
	insight_text_label.text = insight
	next_text_label.text = next_summary

	_animate_result_box_in()


# Shown instead of a normal challenge result whenever the adaptive engine
# moves the player to a new module - same panel, same "one product" chrome,
# a distinct block of content (see nexus_world.tscn's ModuleTransition).
func _show_module_transition(old_title: String, new_title: String) -> void:
	result_box.visible = true
	challenge_result.visible = false
	module_transition.visible = true

	old_module_label.text = old_title.to_upper()
	new_module_label.text = new_title.to_upper()

	_animate_result_box_in()


func _clear_result_display() -> void:
	result_box.visible = false
	challenge_result.visible = false
	module_transition.visible = false


# A restrained fade + scale-in so the result panel (a normal result OR a
# module transition) never just snaps into place.
func _animate_result_box_in() -> void:
	result_box.pivot_offset = result_box.size / 2.0
	result_box.scale = Vector2.ONE * 0.94
	result_box.modulate.a = 0.0
	var tween := create_tween()
	tween.set_parallel(true)
	tween.tween_property(result_box, "scale", Vector2.ONE, 0.22).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tween.tween_property(result_box, "modulate:a", 1.0, 0.18)


func _difficulty_color(name: String) -> Color:
	return PaletteScript.difficulty_color(name)


# --------------------------------------------------------------------------
# WEB -> WEBSITE BRIDGE (additive, optional) - thin wrappers over the
# shared scripts/web_bridge.gd, which also backs the 2D client
# (challenge_manager_2d.gd), so the AI event contract is defined exactly
# once. Pure, one-way notification: nothing here reads a response, awaits
# anything, or feeds back into the adaptive engine - mastery, difficulty,
# and progression are entirely unaffected by whether a website is even
# listening. No-op on native builds or a standalone Web build - see
# WebBridgeScript.post_to_parent().
# --------------------------------------------------------------------------

func _emit_challenge_started() -> void:
	WebBridgeScript.post_to_parent(WebBridgeScript.challenge_started_message(
		_current_module_id(), current_challenge.get("concept_name", ""), _adaptive_engine.get_difficulty_name()
	))


func _emit_challenge_result(
	content_id: String,
	target_value: float,
	actual_value: float,
	unit: String,
	performance: float,
	success: bool,
	mastery_before: float,
	mastery_after: float,
	context: Dictionary = {},
) -> void:
	WebBridgeScript.post_to_parent(WebBridgeScript.challenge_result_message(
		_current_module_id(), current_challenge.get("concept_name", ""), content_id,
		target_value, actual_value, unit, performance, success,
		mastery_before, mastery_after, _adaptive_engine.get_difficulty_name(),
		attempt_number, context,
	))


func _animate_mastery_bar(target_value: float) -> void:
	if is_equal_approx(mastery_bar.value, target_value):
		return
	var tween := create_tween()
	tween.tween_property(mastery_bar, "value", target_value, MASTERY_BAR_TWEEN_TIME).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)


# A small, restrained scale + glow pulse for a successful Projectile Motion
# hit - Newton's Laws and Work & Energy use their own play_success_
# feedback() (kept in their own files since they also own the cart).
func _pulse_success_glow(node: Node3D, mesh_for_glow: MeshInstance3D) -> void:
	var mat := mesh_for_glow.material_override as StandardMaterial3D
	var base_energy: float = mat.emission_energy_multiplier if mat else 0.15
	if mat:
		mat.emission_energy_multiplier = base_energy * 1.8
		var glow_tween := create_tween()
		glow_tween.tween_property(mat, "emission_energy_multiplier", base_energy, 0.3)

	var scale_tween := create_tween()
	scale_tween.tween_property(node, "scale", Vector3.ONE * 1.06, 0.1).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	scale_tween.tween_property(node, "scale", Vector3.ONE, 0.16).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)


# ==========================================================================
# PROJECTILE MOTION - gameplay/scoring logic unchanged from the original
# single-module version of this file (only renamed _begin_challenge ->
# _begin_projectile_challenge, result text now built via _show_result(),
# and a success pulse added).
# ==========================================================================

func _process_projectile_input(delta: float) -> void:
	# Note: the InputMap action names ("force_increase"/"force_decrease")
	# are kept as-is from the project's input configuration; for
	# Projectile Motion they just mean "increase/decrease the launch
	# speed" and aren't renamed here to avoid touching project.godot for a
	# purely internal identifier. Newton's Laws and Work & Energy reuse the
	# same two actions as a generic "adjust the controllable quantity" up/
	# down pair.
	if Input.is_action_pressed("force_increase"):
		current_speed = clampf(current_speed + SPEED_STEP_PER_SECOND * delta, MIN_SPEED, MAX_SPEED)
		_update_hud()
		trajectory_preview.update_preview(current_speed, LAUNCH_ANGLE, _gravity)
	elif Input.is_action_pressed("force_decrease"):
		current_speed = clampf(current_speed - SPEED_STEP_PER_SECOND * delta, MIN_SPEED, MAX_SPEED)
		_update_hud()
		trajectory_preview.update_preview(current_speed, LAUNCH_ANGLE, _gravity)


# Sets up the 3D scene + HUD for whatever challenge is currently in
# `current_challenge` (called for the first Projectile challenge and again
# after every Projectile result screen finishes).
func _begin_projectile_challenge() -> void:
	current_speed = DEFAULT_SPEED
	_gravity = current_challenge["gravity"]
	_clear_result_display()
	if _landing_marker:
		_landing_marker.queue_free()
		_landing_marker = null
	_position_target()
	_challenge_start_time_ms = Time.get_ticks_msec()
	_update_hud()
	trajectory_preview.update_preview(current_speed, LAUNCH_ANGLE, _gravity)


func _position_target() -> void:
	var distance: float = current_challenge["target_distance"]
	var tolerance: float = current_challenge["tolerance"]

	target.scale = Vector3.ONE
	target.position = launch_point.position + Vector3.RIGHT * distance

	var disc_mesh := target_disc.mesh as CylinderMesh
	disc_mesh.top_radius = tolerance
	disc_mesh.bottom_radius = tolerance

	_set_target_color(PaletteScript.GOLD) # neutral gold while the challenge is active


func _set_target_color(color: Color) -> void:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.emission_enabled = true
	mat.emission = color
	mat.emission_energy_multiplier = 0.6
	target_disc.material_override = mat


# Drops a small flat ring at the actual landing spot so the player can see
# target vs. actual at a glance. Colored the same as the target (green for
# success, red for failure) to tie the two together.
func _spawn_landing_marker(landing_distance: float, success: bool) -> void:
	if _landing_marker:
		_landing_marker.queue_free()

	var marker := MeshInstance3D.new()
	var mesh := TorusMesh.new()
	mesh.inner_radius = 0.12
	mesh.outer_radius = 0.22
	marker.mesh = mesh

	var mat := StandardMaterial3D.new()
	mat.albedo_color = PaletteScript.outcome_color(success)
	mat.emission_enabled = true
	mat.emission = mat.albedo_color
	mat.emission_energy_multiplier = 0.9
	marker.material_override = mat

	marker.position = launch_point.position + Vector3.RIGHT * landing_distance
	get_parent().add_child(marker)
	_landing_marker = marker


func _launch() -> void:
	awaiting_result = true
	trajectory_preview.clear_preview()
	var response_time := (Time.get_ticks_msec() - _challenge_start_time_ms) / 1000.0

	var projectile: Node3D = PROJECTILE_SCENE.instantiate()
	get_parent().add_child(projectile)
	projectile.global_position = launch_point.global_position

	projectile.launch(current_speed, LAUNCH_ANGLE, _gravity)
	projectile.landed.connect(_on_projectile_landed.bind(response_time))


func _on_projectile_landed(landing_distance: float, response_time: float) -> void:
	var target_distance: float = current_challenge["target_distance"]
	var tolerance: float = current_challenge["tolerance"]
	var content_id: String = current_challenge["content_id"]
	var error := absf(landing_distance - target_distance)
	var success := error <= tolerance

	# Snapshot both mastery values BEFORE this attempt updates them. The
	# concept-before/after pair drives the difficulty explanation; the
	# overall pair is just the familiar whole-game progress readout.
	var overall_before := _adaptive_engine.mastery
	var concept_before: float = _adaptive_engine.concept_mastery[content_id]

	var performance := _adaptive_engine.record_attempt(error, tolerance, success, response_time)

	var overall_after := _adaptive_engine.mastery
	var concept_after: float = _adaptive_engine.concept_mastery[content_id]
	var difficulty_reason := _adaptive_engine.get_adaptation_reason(concept_before, concept_after)
	# May advance current_content_id - must run AFTER concept_after is read.
	var content_reason := _adaptive_engine.evaluate_content_transition()
	var insight := _physics_insight(content_id, success, landing_distance, target_distance, _gravity)

	performance_history.append({
		"challenge_id": current_challenge["id"],
		"content_id": content_id,
		"success": success,
		"target_distance": target_distance,
		"actual_distance": landing_distance,
		"error": error,
		"performance": performance,
		"response_time": response_time,
		"attempt_number": attempt_number,
	})

	_spawn_landing_marker(landing_distance, success)
	_set_target_color(PaletteScript.outcome_color(success))
	if success:
		_pulse_success_glow(target, target_disc)

	_show_result(
		success,
		"%.1f m" % target_distance,
		"%.1f m" % landing_distance,
		overall_before, overall_after,
		insight,
		"%s %s" % [difficulty_reason, content_reason],
	)
	_emit_challenge_result(content_id, target_distance, landing_distance, "m", performance, success, concept_before, concept_after, {
		"launch_speed": current_speed,
		"target_range": target_distance,
		"actual_range": landing_distance,
		"gravity": _gravity,
	})
	_update_hud()

	await get_tree().create_timer(RESULT_DISPLAY_TIME).timeout
	attempt_number += 1
	var next_challenge := _adaptive_engine.generate_next_challenge(attempt_number)
	await _advance_to_challenge(next_challenge)


# A one-line physics takeaway tied to what actually happened this attempt.
# Since range R = v^2 / g at the fixed 45 degree launch angle used here,
# range grows with the SQUARE of speed - never call this "force". For the
# Gravity & Range concept, the insight is phrased around the actual
# gravity value used for this shot instead.
func _physics_insight(content_id: String, success: bool, landing_distance: float, target_distance: float, gravity: float) -> String:
	if content_id == LearningContentScript.GRAVITY_RANGE:
		if success:
			return "At 45 degrees, range is approximately v^2/g - here g=%.1f m/s^2." % gravity
		elif landing_distance < target_distance:
			return "Higher gravity reduces range; try increasing speed."
		else:
			return "Lower gravity increases range for the same speed."

	if success:
		return "At 45 degrees, range is approximately v^2/g."
	elif landing_distance < target_distance:
		return "Increasing speed increases range."
	else:
		return "A small increase in speed can produce a larger increase in range."


# ==========================================================================
# NEWTON'S LAWS - same loop shape as Projectile Motion (begin -> live input
# preview -> confirm -> score -> record_attempt -> evaluate_content_
# transition -> next challenge), built on the shared F_net = m*a model in
# newton_physics.gd.
# ==========================================================================

func _process_newton_input(delta: float) -> void:
	var changed := false
	if Input.is_action_pressed("force_increase"):
		current_force = clampf(current_force + FORCE_STEP_PER_SECOND * delta, MIN_FORCE, MAX_FORCE)
		changed = true
	elif Input.is_action_pressed("force_decrease"):
		current_force = clampf(current_force - FORCE_STEP_PER_SECOND * delta, MIN_FORCE, MAX_FORCE)
		changed = true

	if changed:
		var extra := NewtonPhysicsScript.extra_force(
			current_challenge["content_id"],
			current_challenge.get("second_force", 0.0),
			current_challenge.get("friction_force", 0.0),
		)
		_newton_challenge.update_applied_arrow(current_force, extra, current_challenge["mass"])
		_update_hud()


# Sets up the arena + HUD for whatever challenge is currently in
# `current_challenge` (called for the first Newton's Laws challenge and
# again after every Newton's Laws result screen finishes).
func _begin_newton_challenge() -> void:
	current_force = DEFAULT_FORCE
	_clear_result_display()
	_challenge_start_time_ms = Time.get_ticks_msec()
	_newton_challenge.begin_challenge(current_challenge)
	_update_hud()


func _confirm_force() -> void:
	awaiting_result = true
	var response_time := (Time.get_ticks_msec() - _challenge_start_time_ms) / 1000.0

	var mass: float = current_challenge["mass"]
	var target_acceleration: float = current_challenge["target_acceleration"]
	var tolerance: float = current_challenge["tolerance"]
	var content_id: String = current_challenge["content_id"]
	var required_force: float = current_challenge.get("required_force", 0.0)
	var extra := NewtonPhysicsScript.extra_force(
		content_id, current_challenge.get("second_force", 0.0), current_challenge.get("friction_force", 0.0)
	)
	var actual_acceleration := NewtonPhysicsScript.predicted_acceleration(current_force, extra, mass)
	var error := absf(actual_acceleration - target_acceleration)
	var success := error <= tolerance

	_newton_challenge.play_confirm_nudge(actual_acceleration)
	if success:
		_newton_challenge.play_success_feedback()

	var overall_before := _adaptive_engine.mastery
	var concept_before: float = _adaptive_engine.concept_mastery[content_id]

	var performance := _adaptive_engine.record_attempt(error, tolerance, success, response_time)

	var overall_after := _adaptive_engine.mastery
	var concept_after: float = _adaptive_engine.concept_mastery[content_id]
	var difficulty_reason := _adaptive_engine.get_adaptation_reason(concept_before, concept_after)
	var content_reason := _adaptive_engine.evaluate_content_transition()
	var insight := _newton_insight(content_id, success, current_force, required_force)

	performance_history.append({
		"challenge_id": current_challenge["id"],
		"content_id": content_id,
		"success": success,
		"target_acceleration": target_acceleration,
		"actual_acceleration": actual_acceleration,
		"error": error,
		"performance": performance,
		"response_time": response_time,
		"attempt_number": attempt_number,
	})

	_show_result(
		success,
		"%.1f m/s²" % target_acceleration,
		"%.1f m/s²" % actual_acceleration,
		overall_before, overall_after,
		insight,
		"%s %s" % [difficulty_reason, content_reason],
	)
	_emit_challenge_result(content_id, target_acceleration, actual_acceleration, "m/s^2", performance, success, concept_before, concept_after, {
		"mass": mass,
		"applied_force": current_force,
		"extra_force": extra,
		"target_acceleration": target_acceleration,
		"actual_acceleration": actual_acceleration,
	})
	_update_hud()

	await get_tree().create_timer(RESULT_DISPLAY_TIME).timeout
	attempt_number += 1
	var next_challenge := _adaptive_engine.generate_next_challenge(attempt_number)
	await _advance_to_challenge(next_challenge)


# A one-line physics takeaway tied to what actually happened this attempt,
# phrased for a school Physics learner - never a generic "Wrong!".
func _newton_insight(content_id: String, success: bool, applied_force: float, required_force: float) -> String:
	if success:
		if content_id == LearningContentScript.FRICTION:
			return "Net force determines acceleration. Part of your applied force overcame friction - the rest produced the motion."
		elif content_id == LearningContentScript.NET_FORCE:
			return "Net force determines acceleration. Combining your applied force with the other force gave the right net force for this mass."
		else:
			return "Newton's Second Law: acceleration equals net force divided by mass (a = F / m)."

	var too_little := applied_force < required_force
	if content_id == LearningContentScript.FRICTION:
		if too_little:
			return "Part of the applied force is used to overcome friction - you applied too little to reach the target acceleration."
		else:
			return "You applied more force than friction required - ease off to hit the target acceleration."
	elif content_id == LearningContentScript.NET_FORCE:
		if too_little:
			return "You applied too little net force. For the same mass, greater net force produces greater acceleration."
		else:
			return "The net force was too large for this mass - the acceleration overshot the target."
	else:
		if too_little:
			return "You applied too little force. For the same mass, greater force produces greater acceleration."
		else:
			return "You applied more force than needed - the acceleration overshot the target."


# ==========================================================================
# WORK & ENERGY - same loop shape again (begin -> live input preview ->
# confirm -> score -> record_attempt -> evaluate_content_transition -> next
# challenge). Every concept boils down to "compare a predicted value in
# Joules against a target value in Joules"; only HOW the predicted value is
# computed from the player's one control changes per concept (see
# _predicted_work_energy_value()). See work_energy_physics.gd for the two
# formulas involved (W = F*d, KE = 1/2*m*v^2) and the shared arena reuse
# note on _set_active_module_visible() above.
# ==========================================================================

func _work_energy_control_range(content_id: String) -> Vector3:
	match content_id:
		LearningContentScript.WORK:
			return Vector3(MIN_WORK_FORCE, MAX_WORK_FORCE, WORK_FORCE_STEP_PER_SECOND)
		LearningContentScript.KINETIC_ENERGY:
			return Vector3(MIN_VELOCITY, MAX_VELOCITY, VELOCITY_STEP_PER_SECOND)
		_:
			return Vector3(MIN_NET_WORK, MAX_NET_WORK, NET_WORK_STEP_PER_SECOND)


# The predicted quantity (always in Joules) that the player's current
# control value produces for the active concept.
func _predicted_work_energy_value() -> float:
	var content_id: String = current_challenge["content_id"]
	match content_id:
		LearningContentScript.WORK:
			return WorkEnergyPhysicsScript.work(current_control_value, current_challenge["distance"])
		LearningContentScript.KINETIC_ENERGY:
			return WorkEnergyPhysicsScript.kinetic_energy(current_challenge["mass"], current_control_value)
		_: # Work-Energy Theorem: the player controls net work directly.
			return current_control_value


func _target_work_energy_value() -> float:
	var content_id: String = current_challenge["content_id"]
	match content_id:
		LearningContentScript.WORK:
			return current_challenge["target_work"]
		LearningContentScript.KINETIC_ENERGY:
			return current_challenge["target_ke"]
		_:
			return current_challenge["required_net_work"]


# The control value (not the predicted Joule value) a player would need for
# a perfect attempt - used only to phrase "too little"/"too much" feedback.
func _required_work_energy_control_value() -> float:
	var content_id: String = current_challenge["content_id"]
	match content_id:
		LearningContentScript.WORK:
			return current_challenge["required_force"]
		LearningContentScript.KINETIC_ENERGY:
			return current_challenge["required_velocity"]
		_:
			return current_challenge["required_net_work"]


func _process_work_energy_input(delta: float) -> void:
	var range := _work_energy_control_range(current_challenge["content_id"])
	var changed := false
	if Input.is_action_pressed("force_increase"):
		current_control_value = clampf(current_control_value + range.z * delta, range.x, range.y)
		changed = true
	elif Input.is_action_pressed("force_decrease"):
		current_control_value = clampf(current_control_value - range.z * delta, range.x, range.y)
		changed = true

	if changed:
		_work_energy_challenge.update_predicted_arrow(_predicted_work_energy_value())
		_update_hud()


# Sets up the arena + HUD for whatever challenge is currently in
# `current_challenge` (called for the first Work & Energy challenge and
# again after every Work & Energy result screen finishes).
func _begin_work_energy_challenge() -> void:
	current_control_value = 0.0
	_clear_result_display()
	_challenge_start_time_ms = Time.get_ticks_msec()
	_work_energy_challenge.begin_challenge(current_challenge, _target_work_energy_value())
	_update_hud()


func _confirm_work_energy() -> void:
	awaiting_result = true
	var response_time := (Time.get_ticks_msec() - _challenge_start_time_ms) / 1000.0

	var content_id: String = current_challenge["content_id"]
	var tolerance: float = current_challenge["tolerance"]
	var target_value := _target_work_energy_value()
	var predicted_value := _predicted_work_energy_value()
	var required_control_value := _required_work_energy_control_value()
	var error := absf(predicted_value - target_value)
	var success := error <= tolerance

	_work_energy_challenge.play_confirm_nudge(predicted_value)
	if success:
		_work_energy_challenge.play_success_feedback()

	var overall_before := _adaptive_engine.mastery
	var concept_before: float = _adaptive_engine.concept_mastery[content_id]

	var performance := _adaptive_engine.record_attempt(error, tolerance, success, response_time)

	var overall_after := _adaptive_engine.mastery
	var concept_after: float = _adaptive_engine.concept_mastery[content_id]
	var difficulty_reason := _adaptive_engine.get_adaptation_reason(concept_before, concept_after)
	var content_reason := _adaptive_engine.evaluate_content_transition()
	var insight := _work_energy_insight(content_id, success, current_control_value, required_control_value)

	performance_history.append({
		"challenge_id": current_challenge["id"],
		"content_id": content_id,
		"success": success,
		"target_value": target_value,
		"predicted_value": predicted_value,
		"error": error,
		"performance": performance,
		"response_time": response_time,
		"attempt_number": attempt_number,
	})

	_show_result(
		success,
		"%.1f J" % target_value,
		"%.1f J" % predicted_value,
		overall_before, overall_after,
		insight,
		"%s %s" % [difficulty_reason, content_reason],
	)
	_emit_challenge_result(content_id, target_value, predicted_value, "J", performance, success, concept_before, concept_after, {
		"mass": current_challenge.get("mass", 0.0),
		"force": current_control_value,
		"distance": current_challenge.get("distance", 0.0),
		"target_work": target_value,
		"actual_work": predicted_value,
	})
	_update_hud()

	await get_tree().create_timer(RESULT_DISPLAY_TIME).timeout
	attempt_number += 1
	var next_challenge := _adaptive_engine.generate_next_challenge(attempt_number)
	await _advance_to_challenge(next_challenge)


# A one-line physics takeaway tied to what actually happened this attempt,
# phrased for a school Physics learner - never a generic "Wrong!".
func _work_energy_insight(content_id: String, success: bool, control_value: float, required_control_value: float) -> String:
	if success:
		match content_id:
			LearningContentScript.WORK:
				return "Work equals force times displacement: W = F x d."
			LearningContentScript.KINETIC_ENERGY:
				return "Kinetic energy grows with the square of velocity: KE = 1/2 x m x v²."
			_:
				return "The work-energy theorem: net work equals the change in kinetic energy (W_net = delta KE)."

	var too_little := control_value < required_control_value
	match content_id:
		LearningContentScript.WORK:
			if too_little:
				return "You applied too little force for this distance - work is force times displacement."
			else:
				return "You applied more force than needed - the predicted work overshot the target."
		LearningContentScript.KINETIC_ENERGY:
			if too_little:
				return "A higher velocity is needed - kinetic energy grows with the SQUARE of velocity."
			else:
				return "That velocity produces more kinetic energy than the target - ease off."
		_:
			if too_little:
				return "More net work is needed to reach that change in speed - remember W_net = delta KE."
			else:
				return "That much net work overshoots the required change in kinetic energy."


# ==========================================================================
# HUD - shared header fields (module/concept/mastery/difficulty/attempts)
# always update; the module-specific fields below them are swapped based
# on which module is active. Hierarchy matches across all three modules:
#   NEXUS / PHYSICS · [module] / CONCEPT / [concept] / CHALLENGE /
#   [game-specific fields] / MASTERY / Difficulty / Attempts / Controls
# ==========================================================================

func _update_hud() -> void:
	module_label.text = "PHYSICS · %s" % LearningContentScript.get_module(_current_module_id()).get("title", "")
	concept_name_label.text = current_challenge.get("concept_name", "")
	concept_description_label.text = current_challenge.get("concept_description", "")
	mastery_label.text = "%d%%" % int(round(_adaptive_engine.mastery * 100.0))
	_animate_mastery_bar(_adaptive_engine.mastery * 100.0)
	var difficulty_name := _adaptive_engine.get_difficulty_name()
	difficulty_label.text = difficulty_name
	var diff_color := _difficulty_color(difficulty_name)
	difficulty_label.add_theme_color_override("font_color", diff_color)
	difficulty_dot.add_theme_color_override("font_color", diff_color)
	attempts_label.text = "Attempts: %d" % attempt_number

	match _current_module_id():
		LearningContentScript.MODULE_NEWTONS_LAWS:
			_update_newton_hud_fields()
		LearningContentScript.MODULE_WORK_ENERGY:
			_update_work_energy_hud_fields()
		_:
			_update_projectile_hud_fields()


func _update_projectile_hud_fields() -> void:
	target_distance_row.visible = true
	speed_row.visible = true
	gravity_label.visible = true
	mass_label.visible = false
	target_acceleration_row.visible = false
	applied_force_row.visible = false
	friction_label.visible = false

	target_distance_label.text = "%.1f m" % current_challenge.get("target_distance", 0.0)
	speed_label.text = "%.1f m/s" % current_speed
	gravity_label.text = "Gravity: %.1f m/s²" % current_challenge.get("gravity", _gravity)
	physics_hint_label.text = "Physics: at 45°, range grows with speed squared."
	controls_label.text = "↑ / ↓        Adjust Speed\nEnter        Launch"


func _update_newton_hud_fields() -> void:
	target_distance_row.visible = false
	speed_row.visible = false
	gravity_label.visible = false
	mass_label.visible = true
	target_acceleration_row.visible = true
	applied_force_row.visible = true

	mass_label.text = "Mass: %.1f kg" % current_challenge.get("mass", 0.0)
	target_acceleration_caption.text = "TARGET ACCELERATION"
	target_acceleration_label.text = "%.1f m/s²" % current_challenge.get("target_acceleration", 0.0)
	applied_force_caption.text = "APPLIED FORCE"
	applied_force_label.text = "%.1f N" % current_force

	if current_challenge.get("content_id", "") == LearningContentScript.FRICTION:
		friction_label.visible = true
		friction_label.text = "Friction: %.1f N" % current_challenge.get("friction_force", 0.0)
	else:
		friction_label.visible = false

	physics_hint_label.text = "Physics: Newton's Second Law - acceleration equals net force divided by mass."
	controls_label.text = "↑ / ↓        Adjust Force\nEnter        Confirm"


func _update_work_energy_hud_fields() -> void:
	target_distance_row.visible = false
	speed_row.visible = false
	gravity_label.visible = false
	mass_label.visible = true
	target_acceleration_row.visible = true
	applied_force_row.visible = true
	friction_label.visible = true

	mass_label.text = "Mass: %.1f kg" % current_challenge.get("mass", 0.0)

	match current_challenge.get("content_id", ""):
		LearningContentScript.WORK:
			friction_label.text = "Distance: %.1f m" % current_challenge.get("distance", 0.0)
			target_acceleration_caption.text = "TARGET WORK"
			target_acceleration_label.text = "%.1f J" % current_challenge.get("target_work", 0.0)
			applied_force_caption.text = "APPLIED FORCE"
			applied_force_label.text = "%.1f N" % current_control_value
			physics_hint_label.text = "Physics: Work equals force times displacement (W = F x d)."
		LearningContentScript.KINETIC_ENERGY:
			var predicted_ke := WorkEnergyPhysicsScript.kinetic_energy(current_challenge.get("mass", 0.0), current_control_value)
			friction_label.text = "Predicted KE: %.1f J" % predicted_ke
			target_acceleration_caption.text = "TARGET KE"
			target_acceleration_label.text = "%.1f J" % current_challenge.get("target_ke", 0.0)
			applied_force_caption.text = "VELOCITY"
			applied_force_label.text = "%.1f m/s" % current_control_value
			physics_hint_label.text = "Physics: Kinetic energy grows with the square of velocity (KE = 1/2 m v²)."
		_:
			friction_label.text = "Velocity: %.1f -> %.1f m/s" % [current_challenge.get("initial_velocity", 0.0), current_challenge.get("target_velocity", 0.0)]
			target_acceleration_caption.text = "REQUIRED ΔKE"
			target_acceleration_label.text = "%.1f J" % current_challenge.get("required_net_work", 0.0)
			applied_force_caption.text = "NET WORK"
			applied_force_label.text = "%.1f J" % current_control_value
			physics_hint_label.text = "Physics: Work-Energy Theorem - net work equals the change in kinetic energy."

	controls_label.text = "↑ / ↓        Adjust\nEnter        Confirm"
