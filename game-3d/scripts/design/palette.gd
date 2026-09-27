extends RefCounted

# --------------------------------------------------------------------------
# NEXUS DESIGN SYSTEM - color palette (colorful educational-game direction)
#
# Single source of truth for every color used across the HUD, the 3D arenas,
# and result/feedback states, so all three modules (Projectile Motion,
# Newton's Laws, Work & Energy) read as one product rather than three demos.
# Pure data - no nodes, no scene dependencies.
#
# "Physics Adventure Lab": a bright, colorful, stylized-realistic world -
# sky blue / royal blue / purple identity accents, fresh green + warm
# yellow/orange in the environment, cream/light-gray neutrals, deep navy
# text. Color communicated through materials, panels and borders, not
# blanket emissive glow.
#
#   Cyan/blue   -> player-controlled / interactive quantities
#   Gold/yellow -> target / objective / destination quantities
#   Green       -> successful completion
#   Orange/red  -> warning / failure / advanced difficulty
#   Purple      -> NEXUS identity / special UI accents
# --------------------------------------------------------------------------

const SURFACE_CREAM := Color(0.99, 0.97, 0.92, 0.95)
const SURFACE_CREAM_STRONG := Color(0.99, 0.97, 0.92, 0.98)
const HEADER_PURPLE := Color(0.36, 0.24, 0.62, 1.0)
const HEADER_BLUE := Color(0.15, 0.38, 0.78, 1.0)
const BORDER_GOLD := Color(0.92, 0.68, 0.16, 0.85)

const TEXT_DARK := Color(0.16, 0.16, 0.26, 1.0)
const TEXT_MUTED := Color(0.48, 0.46, 0.56, 1.0)

const CYAN := Color(0.1, 0.5, 0.85, 1.0)
const CYAN_BRIGHT := Color(0.18, 0.6, 0.92, 1.0)

const GOLD := Color(0.88, 0.62, 0.08, 1.0)
const GOLD_BRIGHT := Color(0.96, 0.72, 0.15, 1.0)

const GREEN := Color(0.18, 0.62, 0.32, 1.0)
const AMBER := Color(0.85, 0.58, 0.1, 1.0)
const RED := Color(0.85, 0.32, 0.2, 1.0)
const PURPLE := Color(0.5, 0.32, 0.78, 1.0)


static func difficulty_color(difficulty_name: String) -> Color:
	match difficulty_name:
		"Beginner":
			return GREEN
		"Intermediate":
			return AMBER
		_:
			return RED


static func outcome_color(success: bool) -> Color:
	return GREEN if success else RED
