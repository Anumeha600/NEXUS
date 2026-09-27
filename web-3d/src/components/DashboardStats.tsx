"use client";

import { useEffect, useState } from "react";
import { readSessionHistory, summarizeSession, TOTAL_CONCEPTS, TOTAL_MODULES } from "@nexus/shared";

export default function DashboardStats() {
  const [overallMastery, setOverallMastery] = useState<string>("—");
  const [recentPerformance, setRecentPerformance] = useState<string>("—");

  useEffect(() => {
    // See AIDashboardCard.tsx: deferred to an effect (not a lazy useState
    // initializer) so the server-rendered "—" placeholder always matches
    // the client's first hydration pass, since the server can never see
    // this browser's localStorage.
    const history = readSessionHistory();
    if (history.length === 0) return;
    const summary = summarizeSession(history);
    const seen = [summary.strongest, summary.focus].filter(Boolean) as { mastery: number }[];
    if (seen.length > 0) {
      const avg = seen.reduce((s, x) => s + x.mastery, 0) / seen.length;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOverallMastery(`${Math.round(avg * 100)}%`);
    }
    const successCount = history.filter((a) => a.success).length;
    setRecentPerformance(`${Math.round((successCount / history.length) * 100)}%`);
  }, []);

  const stats = [
    { value: overallMastery, label: "Overall Mastery (this session)", color: "text-purple" },
    { value: String(TOTAL_CONCEPTS), label: "Core Concepts", color: "text-blue" },
    { value: String(TOTAL_MODULES), label: "Physics Modules", color: "text-cyan" },
    { value: recentPerformance, label: "Recent Performance", color: "text-gold-dark" },
  ];

  return (
    <div className="relative mx-auto mt-14 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="card-elevated rounded-2xl border border-border bg-white px-5 py-5 text-center"
        >
          <div className={`font-display text-2xl font-extrabold sm:text-3xl ${stat.color}`}>
            {stat.value}
          </div>
          <div className="mt-1 text-[11px] font-semibold tracking-wide text-ink-muted uppercase">
            {stat.label}
          </div>
        </div>
      ))}
    </div>
  );
}
