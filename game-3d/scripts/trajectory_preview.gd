extends Node3D

# --------------------------------------------------------------------------
# TRAJECTORY PREVIEW
#
# A small dotted arc that shows where the projectile WOULD land if launched
# right now, at the currently chosen speed. It is a pure visualization -
# it holds no adaptive/mastery logic and never actually fires anything.
#
# This node lives as a child of LaunchPoint, so its local-space math below
# (x, y relative to (0,0,0)) already matches world space at the launch
# point without any extra offset.
#
# IMPORTANT: this mirrors the exact same kinematic model used in
# scripts/projectile.gd (fixed 45 degree launch, same x(t)/y(t) equations).
# If projectile.gd's flight equations ever change, update this to match -
# the preview must never predict a different landing than the real shot.
#
#   x(t) = v * cos(theta) * t
#   y(t) = v * sin(theta) * t - 0.5 * g * t^2
#   flight_time = 2 * v * sin(theta) / g   (launch and landing at same height)
# --------------------------------------------------------------------------

const POINT_COUNT := 14
const DOT_RADIUS := 0.08
const DOT_COLOR := Color(0.11, 0.48, 0.82, 1.0) # clean blue/cyan "predicted path" look

var _dots: Array = []


func _ready() -> void:
	for i in range(POINT_COUNT):
		var dot := MeshInstance3D.new()
		var mesh := SphereMesh.new()
		mesh.radius = DOT_RADIUS
		mesh.height = DOT_RADIUS * 2.0
		dot.mesh = mesh

		# Subtle fade along the arc - the near (launch) end reads as certain,
		# the far (predicted landing) end reads as a lighter prediction.
		var fade: float = lerpf(0.95, 0.4, float(i) / float(POINT_COUNT - 1))
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color(DOT_COLOR.r, DOT_COLOR.g, DOT_COLOR.b, fade)
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		dot.material_override = mat

		add_child(dot)
		_dots.append(dot)

	visible = false


# Recomputes the dotted arc for the given launch speed/angle/gravity and
# shows it. Only called when the speed changes or a challenge begins -
# never every frame - so this stays cheap.
func update_preview(speed: float, angle: float, gravity: float) -> void:
	var velocity_x := speed * cos(angle)
	var velocity_y := speed * sin(angle)
	var flight_time := 2.0 * velocity_y / gravity

	for i in range(POINT_COUNT):
		var t: float = flight_time * float(i) / float(POINT_COUNT - 1)
		var x := velocity_x * t
		var y := velocity_y * t - 0.5 * gravity * t * t
		_dots[i].position = Vector3(x, y, 0.0)

	visible = true


func clear_preview() -> void:
	visible = false
