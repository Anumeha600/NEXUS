extends Node3D

# A launched ball, animated with plain projectile kinematics rather than
# the physics engine. This keeps the flight deterministic and exactly
# matching the formula used in adaptive_engine.gd (distance = v^2/g at a
# 45 degree launch angle), regardless of which 3D physics backend the
# project is using.
#
#   x(t) = x0 + vx * t
#   y(t) = y0 + vy * t - 0.5 * g * t^2
#
# Launch and target sit at the same height, so flight time to return to
# that height is t_flight = 2 * vy / g, and the landing distance is
# simply vx * t_flight.

signal landed(distance: float)

const DESPAWN_DELAY := 1.5

var _origin: Vector3
var _velocity_x: float
var _velocity_y: float
var _gravity: float
var _elapsed: float = 0.0
var _flight_time: float = 0.0
var _has_landed: bool = false


func launch(speed: float, angle: float, gravity: float) -> void:
	_origin = global_position
	_velocity_x = speed * cos(angle)
	_velocity_y = speed * sin(angle)
	_gravity = gravity
	_flight_time = 2.0 * _velocity_y / _gravity


func _process(delta: float) -> void:
	if _has_landed:
		return

	_elapsed += delta
	if _elapsed >= _flight_time:
		_elapsed = _flight_time
		_has_landed = true

	global_position = Vector3(
		_origin.x + _velocity_x * _elapsed,
		_origin.y + _velocity_y * _elapsed - 0.5 * _gravity * _elapsed * _elapsed,
		_origin.z
	)

	if _has_landed:
		landed.emit(_velocity_x * _flight_time)
		await get_tree().create_timer(DESPAWN_DELAY).timeout
		queue_free()
