"use client";

import { useCallback, useEffect, useState } from "react";
import GameFrame from "@/components/GameFrame";
import AIInsightCard, { type InsightState } from "@/components/AIInsightCard";
import { appendSessionAttempt, type LearningEvent } from "@nexus/shared";

interface ChallengeStartedPayload {
  module: string;
  concept: string;
  difficulty: string;
}

interface GameMessage {
  source: "nexus-game";
  type: "challenge_started" | "challenge_result";
  payload: ChallengeStartedPayload | LearningEvent;
}

function isGameMessage(data: unknown): data is GameMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { source?: unknown }).source === "nexus-game"
  );
}

export default function PlayExperience() {
  const [current, setCurrent] = useState<ChallengeStartedPayload | null>(null);
  const [insight, setInsight] = useState<InsightState>({ status: "idle" });

  const requestInsight = useCallback(async (event: LearningEvent) => {
    setInsight({ status: "loading" });
    try {
      const res = await fetch("/api/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });
      if (!res.ok) throw new Error("insight request failed");
      const data = await res.json();
      setInsight({
        status: "ready",
        headline: data.headline,
        explanation: data.explanation,
        suggestion: data.suggestion,
        concept: data.concept,
        confidence: data.confidence,
        source: data.source,
      });
      appendSessionAttempt({
        timestamp: Date.now(),
        module: event.module,
        concept: event.concept,
        success: event.success,
        performance: event.performance,
        masteryBefore: event.mastery_before,
        masteryAfter: event.mastery_after,
        insight: {
          headline: data.headline,
          explanation: data.explanation,
          suggestion: data.suggestion,
          confidence: data.confidence,
          source: data.source,
        },
      });
    } catch {
      setInsight({ status: "error" });
      appendSessionAttempt({
        timestamp: Date.now(),
        module: event.module,
        concept: event.concept,
        success: event.success,
        performance: event.performance,
        masteryBefore: event.mastery_before,
        masteryAfter: event.mastery_after,
      });
    }
  }, []);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      // The game is served from this same site's /game path, so it is
      // always same-origin - reject anything else outright.
      if (event.origin !== window.location.origin) return;
      if (!isGameMessage(event.data)) return;

      if (event.data.type === "challenge_started") {
        setCurrent(event.data.payload as ChallengeStartedPayload);
      } else if (event.data.type === "challenge_result") {
        void requestInsight(event.data.payload as LearningEvent);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [requestInsight]);

  return (
    <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
      <div>
        <GameFrame />
      </div>

      <div className="flex flex-col gap-6">
        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
          <h3 className="text-xs font-bold tracking-[0.15em] text-ink-muted uppercase">
            Right now
          </h3>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Module" value={current?.module ?? "—"} />
            <Row label="Concept" value={current?.concept ?? "—"} />
            <Row label="Difficulty" value={current?.difficulty ?? "—"} />
          </dl>
          {!current && (
            <p className="mt-3 text-xs text-ink-muted">
              Updates automatically once the game loads.
            </p>
          )}
        </div>

        <AIInsightCard state={insight} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-semibold text-ink">{value}</dd>
    </div>
  );
}
