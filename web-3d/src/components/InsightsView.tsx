"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { readSessionHistory, summarizeSession, type SessionAttempt, type SessionSummary } from "@nexus/shared";

export default function InsightsView() {
  const [history, setHistory] = useState<SessionAttempt[]>([]);
  const [summary, setSummary] = useState<SessionSummary>({ attemptCount: 0, strongest: null, focus: null, pattern: null });

  useEffect(() => {
    // See AIDashboardCard.tsx for why this reads localStorage inside an
    // effect rather than a lazy initializer (SSR/hydration safety).
    const h = readSessionHistory();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHistory(h);
    setSummary(summarizeSession(h));
  }, []);

  const recentWithInsight = [...history].reverse().filter((a) => a.insight).slice(0, 5);

  if (summary.attemptCount === 0) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border-2 border-dashed border-border bg-white p-10 text-center">
        <p className="font-display text-lg font-bold text-ink">No learning events yet this session</p>
        <p className="mt-2 text-sm text-ink-muted">
          NEXUS AI analyzes real attempts, not invented statistics. Play a
          few challenges and this page will fill in with your actual
          strengths, focus areas, and recent AI explanations.
        </p>
        <Link href="/play" className="gradient-purple-blue mt-5 inline-block rounded-full px-6 py-2.5 text-sm font-bold text-white">
          Play NEXUS
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <Section title="Overall Learning Pattern">
        <p className="text-sm text-ink-muted">
          {summary.pattern ?? `${summary.attemptCount} attempt${summary.attemptCount === 1 ? "" : "s"} recorded this session so far — a clear pattern will appear after a few more.`}
        </p>
      </Section>

      <div className="grid gap-6 sm:grid-cols-2">
        <Section title="Strengths" accent="text-green">
          {summary.strongest ? (
            <p className="text-sm text-ink">
              <span className="font-display font-bold">{summary.strongest.concept}</span> —{" "}
              {Math.round(summary.strongest.mastery * 100)}% mastery
            </p>
          ) : (
            <p className="text-sm text-ink-muted">Not enough data yet.</p>
          )}
        </Section>

        <Section title="Focus Areas" accent="text-red">
          {summary.focus ? (
            <p className="text-sm text-ink">
              <span className="font-display font-bold">{summary.focus.concept}</span> —{" "}
              {Math.round(summary.focus.mastery * 100)}% mastery
            </p>
          ) : (
            <p className="text-sm text-ink-muted">Not enough data yet.</p>
          )}
        </Section>
      </div>

      <Section title="Recent AI Insights">
        {recentWithInsight.length === 0 ? (
          <p className="text-sm text-ink-muted">No AI explanations recorded yet this session.</p>
        ) : (
          <div className="space-y-3">
            {recentWithInsight.map((a) => (
              <div key={a.timestamp} className="rounded-2xl border border-border bg-surface-lavender/40 p-4">
                <p className="text-xs font-bold text-ink-muted uppercase">{a.concept}</p>
                <p className="mt-1 text-sm font-bold text-ink">{a.insight?.headline}</p>
                <p className="mt-1 text-xs text-ink-muted">{a.insight?.explanation}</p>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="Recommended Practice">
        <p className="text-sm text-ink-muted">
          {summary.focus
            ? `Spend your next few attempts on ${summary.focus.concept} — it's your lowest-mastery concept this session.`
            : "Keep playing to get a personalized recommendation."}
        </p>
        <Link href="/play" className="gradient-purple-blue mt-4 inline-block rounded-full px-6 py-2.5 text-sm font-bold text-white">
          Continue Playing
        </Link>
      </Section>
    </div>
  );
}

function Section({ title, accent, children }: { title: string; accent?: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className={`text-xs font-bold tracking-[0.2em] uppercase ${accent ?? "text-purple"}`}>{title}</h2>
      <div className="mt-3 rounded-2xl border border-border bg-white p-5 shadow-sm">{children}</div>
    </div>
  );
}
