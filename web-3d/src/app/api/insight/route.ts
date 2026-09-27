import { NextResponse } from "next/server";
import { generateInsight, type LearningEvent } from "@nexus/shared";

// POST /api/insight
//
// Accepts a structured LearningEvent describing one scored attempt from
// the Godot game's adaptive engine, and returns a short, personalized
// explanation: {headline, explanation, suggestion, concept, confidence,
// source}. `source` is "ai" only when LLM_API_KEY/LLM_BASE_URL/LLM_MODEL
// are configured server-side AND the provider call succeeded AND its
// response validated against the exact expected shape; otherwise it is
// "fallback" and the text comes from deterministic, rule-based logic. No
// API key is ever read on the client, and a slow or failing provider can
// never break this endpoint - see src/lib/insight.ts.
export async function POST(request: Request) {
  let body: Partial<LearningEvent>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const required: (keyof LearningEvent)[] = [
    "module",
    "concept",
    "challenge_type",
    "target_value",
    "actual_value",
    "unit",
    "performance",
    "success",
    "mastery_before",
    "mastery_after",
    "difficulty",
  ];
  const missing = required.filter((key) => body[key] === undefined);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing fields: ${missing.join(", ")}` },
      { status: 400 },
    );
  }

  const insight = await generateInsight(body as LearningEvent);
  return NextResponse.json(insight);
}
