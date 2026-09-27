extends RefCounted

# --------------------------------------------------------------------------
# WORK & ENERGY CHALLENGE VISUALS
#
# Deliberately reuses the SAME cart + arrow nodes as Newton's Laws (see
# challenge_manager.gd's _set_active_module_visible()) rather than building
# a second near-identical arena - one shared "force arena" visual grammar
# for both modules, just re-scaled here for energy/work quantities (Joules)
# instead of acceleration. This is what keeps Work & Energy from feeling
# like a separate game bolted onto NEXUS.
#
# Same two-arrow pattern as newton_challenge.gd: a solid cyan arrow for
# "what the player is currently producing" and a translucent gold arrow
# with a cone arrowhead for "what's being asked for" - both drawn in the
# SAME unit (Joules) for every Work & Energy concept, so they're always
# directly comparable regardless of which quantity the player controls
# (force, velocity, or net work directly).
# --------------------------------------------------------------------------

const LearningContentScript := preload("res://scripts/learning_content.gd")

const ENERGY_ARROW_SCALE := 0.02 # meters of arrow length per 1 Joule
const ARROW_THICKNESS := 0.12
const TARGET_ARROW_THICKNESS := 0.2
const TARGET_ARROWHEAD_LENGTH := 0.4
const MIN_ARROW_LENGTH := 0.15

var cart: MeshInstance3D
var applied_arrow: MeshInstance3D
var target_arrow: MeshInstance3D
var target_arrow_head: MeshInstance3D
var displacement_indicator: Node3D
var displacement_line: MeshInstance3D
var displacement_tick_end: MeshInstance3D

var _cart_rest_position: Vector3


func setup(
	cart_node: MeshInstance3D,
	applied_arrow_node: MeshInstance3D,
	target_arrow_node: MeshInstance3D,
	target_arrow_head_node: MeshInstance3D,
	displacement_indicator_node: Node3D,
	displacement_line_node: MeshInstance3D,
	displacement_tick_end_node: MeshInstance3D,
) -> void:
	cart = cart_node
	applied_arrow = applied_arrow_node
	target_arrow = target_arrow_node
	target_arrow_head = target_arrow_head_node
	displacement_indicator = displacement_indicator_node
	displacement_line = displacement_line_node
	displacement_tick_end = displacement_tick_end_node
	_cart_rest_position = cart.position


# Configures the arena for a brand new challenge: resets the cart, shows
# the target ghost arrow at the target quantity (Joules), draws the
# predicted-value arrow at zero, and - for the Work concept only - shows a
# real-scale displacement indicator (<---- 5 m ---->) along the ground, so
# "distance" is an actual measured length rather than just an HUD number.
func begin_challenge(challenge: Dictionary, target_value: float) -> void:
	cart.position = _cart_rest_position
	cart.scale = Vector3.ONE
	_orient_target_arrow(target_value * ENERGY_ARROW_SCALE)
	update_predicted_arrow(0.0)

	if challenge.get("content_id", "") == LearningContentScript.WORK:
		_show_displacement(challenge.get("distance", 0.0))
	else:
		displacement_indicator.visible = false


# Real-world-scale (1 meter = 1 engine unit) measurement bracket: a line
# from the cart's position out to `distance` meters, with tick marks at
# both ends - the actual displacement W = F*d is being measured over, not
# an arbitrary arrow-scaled abstraction like the force/energy arrows.
func _show_displacement(distance: float) -> void:
	var line_mesh := displacement_line.mesh as BoxMesh
	line_mesh.size.z = maxf(distance, 0.1)
	displacement_line.position.z = distance / 2.0
	displacement_tick_end.position.z = distance
	displacement_indicator.visible = true


# Called live as the player adjusts whatever quantity the active concept
# actually controls (force, velocity, or net work) - the caller has
# already converted that into the predicted Joule value.
func update_predicted_arrow(predicted_value: float) -> void:
	_orient_arrow(applied_arrow, predicted_value * ENERGY_ARROW_SCALE, ARROW_THICKNESS)


# Arrows are thin boxes stretched along local Z (see newton_challenge.gd's
# _orient_arrow for why - the world camera looks down X, so an arrow built
# along X would be viewed edge-on and invisible regardless of length).
func _orient_arrow(arrow: MeshInstance3D, length: float, thickness: float) -> void:
	var box := arrow.mesh as BoxMesh
	var abs_length: float = maxf(absf(length), MIN_ARROW_LENGTH)
	box.size = Vector3(thickness, thickness, abs_length)
	var direction := 1.0 if length >= 0.0 else -1.0
	arrow.position.z = direction * abs_length / 2.0
	arrow.visible = true


func _orient_target_arrow(length: float) -> void:
	_orient_arrow(target_arrow, length, TARGET_ARROW_THICKNESS)
	var abs_length: float = maxf(absf(length), MIN_ARROW_LENGTH)
	var direction := 1.0 if length >= 0.0 else -1.0
	target_arrow_head.position.z = direction * (abs_length + TARGET_ARROWHEAD_LENGTH / 2.0)
	target_arrow_head.rotation_degrees = Vector3(direction * 90.0, 0.0, 0.0)
	target_arrow_head.visible = true


# A brief, purely cosmetic nudge so confirming an attempt feels tactile -
# NOT part of the physics model. Runs for every attempt, success or
# failure, proportional to the actual predicted value.
func play_confirm_nudge(predicted_value: float) -> void:
	var nudge := clampf(predicted_value * 0.01, -0.6, 0.6)
	cart.position = _cart_rest_position + Vector3(nudge, 0.0, 0.0)


# A brief, restrained acknowledgement played only on a SUCCESSFUL attempt -
# a small settle rather than a decorative bounce, since the physics-accurate
# arrows/values are what actually communicate correctness.
func play_success_feedback() -> void:
	var mat := cart.material_override as StandardMaterial3D
	var base_energy: float = mat.emission_energy_multiplier if mat else 0.12
	if mat:
		mat.emission_energy_multiplier = base_energy * 1.8
		var glow_tween := cart.create_tween()
		glow_tween.tween_property(mat, "emission_energy_multiplier", base_energy, 0.3)

	var scale_tween := cart.create_tween()
	scale_tween.tween_property(cart, "scale", Vector3.ONE * 1.05, 0.1).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	scale_tween.tween_property(cart, "scale", Vector3.ONE, 0.16).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)


func reset_cart() -> void:
	cart.position = _cart_rest_position
	cart.scale = Vector3.ONE
