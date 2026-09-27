extends RefCounted

# --------------------------------------------------------------------------
# WEB -> WEBSITE BRIDGE (shared by the 3D and 2D clients)
#
# Posts a small JSON message to the parent window when running as a Web
# export inside a browser, so the surrounding website
# (website/src/components/PlayExperience.tsx) can show a live "what are
# you doing right now" readout and request an AI learning insight
# (website/src/app/api/insight). Pure, one-way notification: nothing here
# reads a response, awaits anything, or feeds back into the adaptive
# engine - mastery, difficulty, and progression are entirely unaffected by
# whether a website is even listening.
#
# Both challenge_manager.gd (3D) and challenge_manager_2d.gd (2D) call
# these same static functions, so the AI event contract is defined exactly
# once regardless of which client is running.
#
# On a native build, or a Web build running standalone/not inside a
# browser, JavaScriptBridge doesn't exist and post_to_parent() is a no-op.
# --------------------------------------------------------------------------

static func post_to_parent(message: Dictionary) -> void:
	if not OS.has_feature("web"):
		return
	if not Engine.has_singleton("JavaScriptBridge"):
		return
	var json := JSON.stringify(message)
	JavaScriptBridge.eval("window.parent.postMessage(%s, window.location.origin)" % json, true)


static func challenge_started_message(module_id: String, concept_name: String, difficulty_name: String) -> Dictionary:
	return {
		"source": "nexus-game",
		"type": "challenge_started",
		"payload": {
			"module": module_id,
			"concept": concept_name,
			"difficulty": difficulty_name,
		},
	}


static func challenge_result_message(
	module_id: String,
	concept_name: String,
	content_id: String,
	target_value: float,
	actual_value: float,
	unit: String,
	performance: float,
	success: bool,
	mastery_before: float,
	mastery_after: float,
	difficulty_name: String,
	attempt_number: int,
	context: Dictionary,
) -> Dictionary:
	return {
		"source": "nexus-game",
		"type": "challenge_result",
		"payload": {
			"module": module_id,
			"concept": concept_name,
			"challenge_type": content_id,
			"target_value": target_value,
			"actual_value": actual_value,
			"unit": unit,
			"performance": performance,
			"success": success,
			"mastery_before": mastery_before,
			"mastery_after": mastery_after,
			"difficulty": difficulty_name,
			"attempt_number": attempt_number,
			"context": context,
		},
	}
