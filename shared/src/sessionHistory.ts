// --------------------------------------------------------------------------
// SESSION HISTORY - honest, no-backend learner-facing memory
//
// NEXUS has no accounts and no database. Rather than fabricate progress
// numbers, the dashboard and Insights page read a small, real record of
// what happened in THIS browser during THIS session, kept in
// localStorage. It is genuine data (not invented), it just doesn't
// persist across devices or browsers, and a cleared browser starts fresh.
// Every read/write is wrapped defensively - a private window, blocked
// storage, or an SSR render must never throw.
// --------------------------------------------------------------------------

import type { InsightConfidence } from "./insight";

export interface SessionAttempt {
  timestamp: number;
  module: string;
  concept: string;
  success: boolean;
  performance: number; // 0..1
  masteryBefore: number; // 0..1
  masteryAfter: number; // 0..1
  // Optional because older entries already sitting in a returning learner's
  // localStorage predate this field - always present for a freshly recorded
  // attempt (see PlayExperience.tsx), but a reader must not assume it exists.
  difficulty?: string;
  insight?: {
    headline: string;
    explanation: string;
    suggestion: string;
    confidence: InsightConfidence;
    source: "ai" | "fallback";
  };
}

const STORAGE_KEY = "nexus-session-history";
const MAX_ENTRIES = 50;

export function readSessionHistory(): SessionAttempt[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendSessionAttempt(entry: SessionAttempt): void {
  if (typeof window === "undefined") return;
  try {
    const history = readSessionHistory();
    history.push(entry);
    while (history.length > MAX_ENTRIES) history.shift();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    // Storage unavailable/blocked - the session just won't remember this
    // attempt. Never throw over a convenience feature.
  }
}

export function clearSessionHistory(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export interface SessionSummary {
  attemptCount: number;
  strongest: { concept: string; mastery: number } | null;
  focus: { concept: string; mastery: number } | null;
  pattern: string | null;
}

// Derives an honest summary from whatever attempts actually happened this
// session - never invents a concept or number that wasn't observed.
export function summarizeSession(history: SessionAttempt[]): SessionSummary {
  if (history.length === 0) {
    return { attemptCount: 0, strongest: null, focus: null, pattern: null };
  }

  const latestByConcept = new Map<string, SessionAttempt>();
  for (const attempt of history) {
    latestByConcept.set(attempt.concept, attempt);
  }
  const latestAttempts = Array.from(latestByConcept.values());

  const strongestAttempt = latestAttempts.reduce((best, a) =>
    a.masteryAfter > best.masteryAfter ? a : best,
  );
  const focusAttempt = latestAttempts.reduce((worst, a) =>
    a.masteryAfter < worst.masteryAfter ? a : worst,
  );

  const successCount = history.filter((a) => a.success).length;
  const successRate = successCount / history.length;
  let pattern: string | null = null;
  if (history.length >= 3) {
    pattern =
      successRate >= 0.7
        ? `You've succeeded on ${successCount} of your last ${history.length} attempts this session — strong consistency.`
        : successRate <= 0.3
          ? `You've struggled on ${history.length - successCount} of your last ${history.length} attempts this session — try slowing down and checking the target value before confirming.`
          : `A mixed session so far: ${successCount} of ${history.length} attempts on target.`;
  }

  return {
    attemptCount: history.length,
    strongest: { concept: strongestAttempt.concept, mastery: strongestAttempt.masteryAfter },
    focus: { concept: focusAttempt.concept, mastery: focusAttempt.masteryAfter },
    pattern,
  };
}
