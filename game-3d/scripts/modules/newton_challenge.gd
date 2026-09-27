extends RefCounted

# --------------------------------------------------------------------------
# NEWTON'S LAWS CHALLENGE VISUALS
#
# Owns the 3D presentation for the Newton's Laws module (cart + force
# arrows) - the equivalent of trajectory_preview.gd for Projectile Motion.
# Pure visualization: it holds no adaptive/mastery logic and does no
# scoring itself (see newton_physics.gd for the shared math and
# challenge_manager.gd for the adaptive-engine integration).
#
# Three arrows, two visual units:
#   - Applied-force arrow (solid cyan, no head): drawn in predicted
#     ACCELERATION, not raw force, so it's directly comparable to...
#   - Target-acceleration arrow (translucent gold, WITH a cone arrowhead
#     and a heavier shaft): the same unit, so the player can visually
#     match "what my force is producing" against "what's being asked for"
#     without the numbers spelled out. The arrowhead and heavier shaft are
#     what make it read as "the target" rather than a second applied-force
#     arrow, even at small Beginner-tier magnitudes.
#   - Secondary arrow (gold/red-ish, context only): whatever second/
#     friction force is already present for the active concept, drawn in
#     raw FORCE with its own minimum visible length so a small friction
#     value never disappears - the HUD's numeric label is always the
#     authoritative value; this arrow only illustrates it.
# --------------------------------------------------------------------------

const LearningContentScript := preload("res://scripts/learning_content.gd")
const NewtonPhysicsScript := preload("res://scripts/modules/newton_physics.gd")

const ACCEL_ARROW_SCALE := 0.9 # meters of arrow length per 1 m/s^2
const FORCE_ARROW_SCALE := 0.09 # meters of arrow length per 1 N

const ARROW_THICKNESS := 0.12
const MIN_ARROW_LENGTH := 0.15

# The target arrow is deliberately chunkier than the applied-force arrow
# (thicker shaft + a cone head) so it's never mistaken for it, and it's
# tall enough to stay legible even at the shortest Beginner-tier length.
const TARGET_ARROW_THICKNESS := 0.2
const TARGET_ARROWHEAD_LENGTH := 0.4

# A friction/second force below this would scale to a near-invisible sliver
# (e.g. 1.6 N * FORCE_ARROW_SCALE = 0.05m); the numeric HUD label is always
# the authoritative value, this floor only keeps the arrow legible.
const MIN_SECONDARY_ARROW_LENGTH := 0.45

var cart: MeshInstance3D
var applied_arrow: MeshInstance3D
var target_arrow: MeshInstance3D
var target_arrow_head: MeshInstance3D
var secondary_arrow: MeshInstance3D

var _cart_rest_position: Vector3


func setup(
	cart_node: MeshInstance3D,
	applied_arrow_node: MeshInstance3D,
	target_arrow_node: MeshInstance3D,
	target_arrow_head_node: MeshInstance3D,
	secondary_arrow_node: MeshInstance3D,
) -> void:
	cart = cart_node
	applied_arrow = applied_arrow_node
	target_arrow = target_arrow_node
	target_arrow_head = target_arrow_head_node
	secondary_arrow = secondary_arrow_node
	_cart_rest_position = cart.position


# Configures the arena for a brand new challenge: resets the cart, shows
# the target ghost arrow, shows/hides/colors the secondary force arrow for
# the active concept, and draws the applied-force arrow at zero.
func begin_challenge(challenge: Dictionary) -> void:
	cart.position = _cart_rest_position
	cart.scale = Vector3.ONE
	var content_id: String = challenge["content_id"]
	var second_force: float = challenge.get("second_force", 0.0)
	var friction_force: float = challenge.get("friction_force", 0.0)
	var mass: float = challenge["mass"]
	var extra := NewtonPhysicsScript.extra_force(content_id, second_force, friction_force)

	_orient_target_arrow(challenge["target_acceleration"] * ACCEL_ARROW_SCALE)
	_update_secondary_arrow(content_id, second_force, friction_force)
	update_applied_arrow(0.0, extra, mass)


# Called live as the player adjusts applied force (mirrors
# trajectory_preview.update_preview()'s live-update role).
func update_applied_arrow(applied_force: float, extra: float, mass: float) -> void:
	var accel := NewtonPhysicsScript.predicted_acceleration(applied_force, extra, mass)
	_orient_arrow(applied_arrow, accel * ACCEL_ARROW_SCALE)


func _update_secondary_arrow(content_id: String, second_force: float, friction_force: float) -> void:
	if content_id == LearningContentScript.NET_FORCE:
		secondary_arrow.visible = true
		_orient_arrow(secondary_arrow, second_force * FORCE_ARROW_SCALE, ARROW_THICKNESS, MIN_SECONDARY_ARROW_LENGTH)
	elif content_id == LearningContentScript.FRICTION:
		secondary_arrow.visible = true
		_orient_arrow(secondary_arrow, -friction_force * FORCE_ARROW_SCALE, ARROW_THICKNESS, MIN_SECONDARY_ARROW_LENGTH)
	else:
		secondary_arrow.visible = false


# Arrows are thin boxes stretched along local Z rather than X. The NEXUS
# world's camera always looks down world X (see nexus_world.tscn), so an
# arrow built along X is viewed almost perfectly edge-on and is invisible
# regardless of length - building along Z instead makes its length read
# clearly on screen. A positive length points one way and a negative
# length the other, consistently with the positive/negative force
# convention used throughout this module.
func _orient_arrow(arrow: MeshInstance3D, length: float, thickness: float = ARROW_THICKNESS, min_length: float = MIN_ARROW_LENGTH) -> void:
	var box := arrow.mesh as BoxMesh
	var abs_length: float = maxf(absf(length), min_length)
	box.size = Vector3(thickness, thickness, abs_length)
	var direction := 1.0 if length >= 0.0 else -1.0
	arrow.position.z = direction * abs_length / 2.0
	arrow.visible = true


# The target arrow gets its own function because it also carries a cone
# arrowhead at its tip - this, plus its heavier shaft, is what makes "the
# thing you're aiming for" immediately readable as distinct from "what
# you're currently doing" (the plain applied-force arrow), even though
# both are drawn in the same visual unit and can be similar lengths.
func _orient_target_arrow(length: float) -> void:
	_orient_arrow(target_arrow, length, TARGET_ARROW_THICKNESS)
	var abs_length: float = maxf(absf(length), MIN_ARROW_LENGTH)
	var direction := 1.0 if length >= 0.0 else -1.0
	target_arrow_head.position.z = direction * (abs_length + TARGET_ARROWHEAD_LENGTH / 2.0)
	# CylinderMesh points along local +Y by default; rotating +/-90 degrees
	# around X aligns that point along +/-Z, matching the shaft's direction.
	target_arrow_head.rotation_degrees = Vector3(direction * 90.0, 0.0, 0.0)
	target_arrow_head.visible = true


# A brief, purely cosmetic nudge so confirming an attempt feels tactile -
# NOT part of the physics model, just a visual acknowledgement. Runs for
# every attempt, success or failure, proportional to the actual outcome.
func play_confirm_nudge(actual_acceleration: float) -> void:
	var nudge := clampf(actual_acceleration * 0.05, -0.6, 0.6)
	cart.position = _cart_rest_position + Vector3(nudge, 0.0, 0.0)


# A brief, restrained acknowledgement played only on a SUCCESSFUL attempt,
# on top of the nudge above - a small settle rather than a decorative
# bounce, since the physics-accurate force arrows are what actually
# communicate correctness.
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
