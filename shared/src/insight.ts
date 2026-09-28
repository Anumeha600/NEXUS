// --------------------------------------------------------------------------
// AI LEARNING INSIGHT - adapter layer
//
//   Godot / Web Client -> Learning Event -> NEXUS AI API (this file, called
//   from src/app/api/insight/route.ts) -> LLM provider (if configured) ->
//   Structured Learning Insight -> NEXUS UI.
//
// NEXUS has two intelligent systems, and they do not overlap:
//   - The ADAPTIVE ENGINE (scripts/adaptive_engine.gd) answers "what should
//     the learner do next?" - difficulty, challenge parameters, concept and
//     module progression, mastery. Entirely deterministic. Untouched by
//     anything in this file.
//   - AI LEARNING INSIGHT (this file) answers "why did the learner perform
//     this way, and how should we explain it?" - it explains, after the
//     fact, using only the numbers it was given. It cannot change a score,
//     a mastery value, a difficulty choice, or a progression decision.
//
// Security: no API key is read, stored, or referenced on the client
// anywhere in this project. LLM_API_KEY / LLM_BASE_URL / LLM_MODEL are
// read here, server-side only (this file is never imported by a "use
// client" component). If any of the three is unset, or the provider call
// fails, times out, or returns something that doesn't validate, this
// silently resolves through the deterministic fallback below - the game
// and the insight UI never break because AI is unavailable.
// --------------------------------------------------------------------------

// Concept-specific numbers that don't fit the generic target/actual shape.
// Populated by whichever module emitted the event - see
// scripts/challenge_manager.gd's _emit_challenge_result(). Examples:
//   Projectile: { launch_speed, target_range, actual_range, gravity }
//   Newton:     { mass, applied_force, extra_force, target_acceleration, actual_acceleration }
//   Work&Energy:{ mass, force, distance, target_work, actual_work }
export type LearningEventContext = Record<string, number | string>;

export interface LearningEvent {
  session_id?: string;
  module: string;
  concept: string;
  challenge_type: string;
  difficulty: string;

  target_value: number;
  actual_value: number;
  unit: string;

  success: boolean;
  performance: number; // 0..1, matches adaptive_engine.gd's per-attempt score

  mastery_before: number; // 0..1
  mastery_after: number; // 0..1

  attempt_number?: number;
  recent_attempts?: number;

  context?: LearningEventContext;
}

export type InsightConfidence = "high" | "medium" | "low";

export interface LearningInsight {
  headline: string;
  explanation: string;
  suggestion: string;
  concept: string;
  confidence: InsightConfidence;
  source: "ai" | "fallback";
}

const LLM_TIMEOUT_MS = 8000;

export async function generateInsight(event: LearningEvent): Promise<LearningInsight> {
  const aiResult = await tryLlmProvider(event);
  if (aiResult) {
    return { ...aiResult, source: "ai" };
  }
  return { ...deterministicFallback(event), source: "fallback" };
}

type RawInsight = Omit<LearningInsight, "source">;

// Returns null (never throws) whenever a live call can't be made or can't
// be trusted - missing config, network failure, timeout, or a response
// that doesn't validate against the exact expected shape. The caller
// always has the deterministic fallback to reach for. The UI must never
// render arbitrary, unvalidated model output.
async function tryLlmProvider(event: LearningEvent): Promise<RawInsight | null> {
  const apiKey = process.env.LLM_API_KEY;
  const baseUrl = process.env.LLM_BASE_URL;
  const model = process.env.LLM_MODEL;
  if (!apiKey || !baseUrl || !model) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    // Generic OpenAI-compatible chat-completions call - works with OpenAI
    // itself or any provider/proxy exposing the same schema at
    // LLM_BASE_URL, configured entirely through server-side env vars. No
    // provider-specific SDK, so swapping providers never requires a
    // code change here, only the three env vars.
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        // Generous enough for a reasoning model (e.g. Groq's gpt-oss family)
        // whose completion_tokens budget covers its own hidden reasoning
        // trace as well as the final JSON content - a low budget here
        // truncates the JSON mid-string before the model reaches its
        // closing brace, which JSON.parse below would otherwise report as
        // a malformed response and silently fall back on every call.
        max_tokens: 700,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(event) },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content: unknown = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return null;

    return validateInsightShape(JSON.parse(content));
  } catch {
    // Network error, timeout, or malformed JSON - fall back silently.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

const VALID_CONFIDENCE: InsightConfidence[] = ["high", "medium", "low"];

// The UI never blindly renders arbitrary model output - every field is
// checked before anything from the provider reaches a component.
function validateInsightShape(parsed: unknown): RawInsight | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const p = parsed as Record<string, unknown>;
  if (
    typeof p.headline === "string" &&
    typeof p.explanation === "string" &&
    typeof p.suggestion === "string" &&
    typeof p.concept === "string" &&
    typeof p.confidence === "string" &&
    VALID_CONFIDENCE.includes(p.confidence as InsightConfidence)
  ) {
    return {
      headline: p.headline,
      explanation: p.explanation,
      suggestion: p.suggestion,
      concept: p.concept,
      confidence: p.confidence as InsightConfidence,
    };
  }
  return null;
}

const SYSTEM_PROMPT = `You are NEXUS Learning Insight, a Physics learning assistant. Your role is to explain a learner's actual performance using only the structured "learning event" JSON you are given - never invent or alter a measurement, an equation result, or any number not present in the input.

Rules:
1. Never invent measurements.
2. Never change the supplied result.
3. Never determine mastery - it is already computed and given to you.
4. Never determine difficulty - it is decided elsewhere.
5. Never decide progression - it is decided elsewhere.
6. Use the supplied Physics equations/context for the concept (see event.context).
7. Keep explanations concise - one sentence of real physics reasoning.
8. Explain WHY the result happened, not just what happened.
9. Give exactly one actionable next step.
10. Adapt your tone to the learner's performance (success vs. struggle) without being generic or motivational filler.
11. Do not overwhelm the learner with theory beyond what explains this attempt.

Respond with JSON only (no prose, no markdown fences) in exactly this shape:
{"headline": string, "explanation": string, "suggestion": string, "concept": string, "confidence": "high"|"medium"|"low"}
"headline" is under 8 words. "concept" echoes event.concept. "confidence" reflects how directly the supplied data supports your explanation.`;

function deterministicFallback(event: LearningEvent): RawInsight {
  const actual = round1(event.actual_value);
  const target = round1(event.target_value);
  const delta = actual - target;
  const magnitude = Math.abs(delta);
  const tooLow = delta < 0;

  if (event.success) {
    return {
      headline: "Right on target",
      explanation: `Your result of ${actual} ${event.unit} matched the ${target} ${event.unit} target for ${event.concept}.`,
      suggestion: "Try the next challenge - it will be a little more demanding.",
      concept: event.concept,
      confidence: "high",
    };
  }

  const byModule: Record<string, Omit<RawInsight, "concept" | "confidence">> = {
    projectile_motion: {
      headline: tooLow ? "Your launch speed was too low" : "Your launch speed was too high",
      explanation:
        "At 45 degrees, projectile range increases with the square of launch speed, so a small speed change produces a larger range change.",
      suggestion: tooLow
        ? "Try increasing the launch speed slightly on your next attempt."
        : "Try easing off the launch speed slightly on your next attempt.",
    },
    newtons_laws: {
      headline: tooLow ? "Your applied force was too low" : "Your applied force was too high",
      explanation:
        "For the same mass, acceleration depends on net force - increasing the applied force increases the resulting acceleration when opposing forces stay the same.",
      suggestion: tooLow
        ? "Increase the applied force gradually and watch the predicted acceleration."
        : "Reduce the applied force gradually and watch the predicted acceleration.",
    },
    work_energy: {
      headline: tooLow ? "Your work was lower than the target" : "Your work was higher than the target",
      explanation: "Work depends on both force and displacement: W = F x d.",
      suggestion: tooLow
        ? "Try increasing the applied force while keeping the distance fixed."
        : "Try reducing the applied force while keeping the distance fixed.",
    },
    circular_motion: {
      headline: tooLow ? "Your result was under the target" : "Your result was over the target",
      explanation: "Centripetal force and acceleration both depend on speed squared, so a small change in speed produces a much larger change in force or acceleration.",
      suggestion: tooLow
        ? "Check whether speed, radius, or mass needs to increase to reach the target."
        : "Check whether speed, radius, or mass needs to decrease to reach the target.",
    },
  };

  const base = byModule[event.module] ?? {
    headline: tooLow ? "Your result was under the target" : "Your result was over the target",
    explanation: `You were off by ${magnitude.toFixed(1)} ${event.unit} on ${event.concept}.`,
    suggestion: "Review the relationship this concept is testing and try again.",
  };

  return { ...base, concept: event.concept, confidence: "medium" };
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
