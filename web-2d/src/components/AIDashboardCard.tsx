"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { readSessionHistory, summarizeSession, type SessionSummary } from "@nexus/shared";

export default function AIDashboardCard() {
  const [summary, setSummary] = useState<SessionSummary | null>(null);

  useEffect(() => {
    // Intentionally deferred to an effect rather than a lazy useState
    // initializer: the server can never see this browser's localStorage,
    // so computing it during the initial render would make the client's
    // first-hydration output diverge from the prerendered HTML. Reading it
    // post-mount instead means both environments agree on the initial
    // "no data" render, and the real summary fills in a moment later.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSummary(summarizeSession(readSessionHistory()));
  }, []);

  if (!summary) return null;

  return (
    <div className="card-elevated relative overflow-hidden rounded-3xl border border-border bg-white p-6">
      <div className="gradient-purple-blue absolute inset-x-0 top-0 h-1.5" />
      <div className="flex items-center gap-2">
        <span className="gradient-purple-blue flex h-7 w-7 items-center justify-center rounded-full text-sm text-white">
          ✦
        </span>
        <span className="text-xs font-bold tracking-[0.15em] text-purple uppercase">
          NEXUS AI Learning Insight
        </span>
      </div>

      {summary.attemptCount === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">
          No learning events yet this session.{" "}
          <Link href="/play" className="font-semibold text-purple underline">
            Play a challenge
          </Link>{" "}
          and NEXUS AI will start summarizing your strengths and focus areas
          right here.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {summary.strongest && (
            <div>
              <p className="text-xs font-bold text-ink-muted uppercase">Strongest concept</p>
              <p className="mt-1 font-display text-lg font-bold text-ink">
                {summary.strongest.concept} — {Math.round(summary.strongest.mastery * 100)}%
              </p>
            </div>
          )}
          {summary.focus && (
            <div>
              <p className="text-xs font-bold text-ink-muted uppercase">Current focus</p>
              <p className="mt-1 font-display text-lg font-bold text-ink">
                {summary.focus.concept} — {Math.round(summary.focus.mastery * 100)}%
              </p>
            </div>
          )}
          {summary.pattern && (
            <div className="sm:col-span-2">
              <p className="text-xs font-bold text-ink-muted uppercase">Recent pattern</p>
              <p className="mt-1 text-sm text-ink-muted">{summary.pattern}</p>
            </div>
          )}
        </div>
      )}

      <Link
        href="/insights"
        className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-purple"
      >
        View AI Insights <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
