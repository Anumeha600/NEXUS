"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AVAILABLE_MODULES, OPTIONAL_LABS, CURRICULUM, moduleByEngineId, playRouteFor, readSessionHistory } from "@nexus/shared";
import ModuleArtwork from "@/components/ModuleArtwork";

// "Coming soon" is only for modules with no working game at all - an
// optional lab (a real game, just outside the normal adaptive sequence -
// see OPTIONAL_LABS) renders as a normal Physics Lab card below instead.
const UNAVAILABLE_MODULES = CURRICULUM.filter((m) => !m.available && !m.optionalLab);

// The Physics Labs grid: every module with a real, working game behind it,
// in curriculum order - AVAILABLE_MODULES (the five in the normal adaptive
// sequence) followed by OPTIONAL_LABS (real games that live outside that
// sequence, e.g. Gravitation & Orbits - see curriculum.ts's ModuleInfo.
// optionalLab doc comment). This only changes how Play Hub *presents* those
// modules - it never touches `available`/`optionalLab` themselves, so
// TOTAL_MODULES/TOTAL_CONCEPTS, the adaptive MODULE_SEQUENCE, and the Learn
// page's lesson-content requirement stay exactly as they were.
const PHYSICS_LAB_MODULES = [...AVAILABLE_MODULES, ...OPTIONAL_LABS];

// The default journey a fresh AdaptiveEngine() opens on (see
// game-2d/src/adaptiveEngine.ts and curriculum.test.ts) - what "Start
// Adaptive Challenge" launches when there's no session to continue.
// Derived from curriculum order, never a hardcoded module id.
const DEFAULT_START_ROUTE = playRouteFor(AVAILABLE_MODULES[0].id) ?? "/play";

interface ContinueState {
  moduleTitle: string;
  moduleRoute: string;
  concept: string;
  masteryPct: number;
  difficulty: string;
}

const HOW_TO_PLAY_STEPS = [
  "Learn the concept",
  "Calculate your prediction",
  "Enter your answer",
  "Run the experiment",
  "Watch the Physics simulation",
  "Compare your result",
  "Read your AI insight",
  "Keep playing as NEXUS adapts",
];

export default function PlayHub() {
  // null = no continuable session (the truthful default, and what the
  // server renders too - see AIDashboardCard.tsx's identical pattern for
  // why this can't be computed during the initial render).
  const [session, setSession] = useState<ContinueState | null>(null);

  useEffect(() => {
    const history = readSessionHistory();
    const latest = history[history.length - 1];
    if (!latest) return;
    const mod = moduleByEngineId(latest.module);
    if (!mod?.available) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession({
      moduleTitle: mod.title,
      moduleRoute: `/play?module=${mod.id}`,
      concept: latest.concept,
      masteryPct: Math.round(latest.masteryAfter * 100),
      difficulty: latest.difficulty ?? "—",
    });
  }, []);

  return (
    <div className="flex flex-col gap-14">
      <div className="text-center">
        <span className="text-xs font-bold tracking-[0.2em] text-purple uppercase">Nexus / Play</span>
        <h1 className="mt-2 font-display text-3xl font-extrabold text-ink sm:text-4xl">NEXUS Play Lab</h1>
        <p className="mx-auto mt-3 max-w-xl text-ink-muted">Choose an experiment. NEXUS adapts the challenge as you learn.</p>
      </div>

      <div className="card-elevated relative mx-auto w-full max-w-2xl overflow-hidden rounded-3xl border border-border bg-white p-6">
        <div className="gradient-purple-blue absolute inset-x-0 top-0 h-1.5" />
        <div className="flex items-center gap-2">
          <span className="gradient-purple-blue flex h-7 w-7 items-center justify-center rounded-full text-sm text-white">✦</span>
          <span className="text-xs font-bold tracking-[0.15em] text-purple uppercase">Continue Your Adaptive Challenge</span>
        </div>

        {session ? (
          <>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[10px] font-bold text-ink-muted uppercase">Current Focus</p>
                <p className="mt-1 font-display text-sm font-bold text-ink sm:text-base">{session.concept}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-ink-muted uppercase">Mastery</p>
                <p className="mt-1 font-display text-sm font-bold text-ink sm:text-base">{session.masteryPct}%</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-ink-muted uppercase">Difficulty</p>
                <p className="mt-1 font-display text-sm font-bold text-ink sm:text-base">{session.difficulty}</p>
              </div>
            </div>
            <Link
              href={session.moduleRoute}
              className="gradient-purple-blue mt-5 inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:opacity-90"
            >
              Continue in {session.moduleTitle} <span aria-hidden="true">→</span>
            </Link>
          </>
        ) : (
          <>
            <p className="mt-4 text-sm text-ink-muted">Start your first adaptive challenge.</p>
            <Link
              href={DEFAULT_START_ROUTE}
              className="gradient-purple-blue mt-4 inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:opacity-90"
            >
              Start Adaptive Challenge <span aria-hidden="true">→</span>
            </Link>
          </>
        )}
      </div>

      <div>
        <h2 className="text-center font-display text-xl font-bold text-ink sm:text-2xl">Physics Labs</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PHYSICS_LAB_MODULES.map((mod, i) => (
            <div
              key={mod.id}
              className={`glass-card group flex flex-col overflow-hidden rounded-3xl ring-1 ${mod.theme.ring} transition hover:-translate-y-1`}
            >
              <div className="h-36 w-full overflow-hidden sm:h-40">
                <ModuleArtwork
                  moduleId={mod.id}
                  className="h-full w-full transition duration-300 group-hover:scale-[1.02]"
                />
              </div>

              <div className="flex flex-1 flex-col p-6">
                <div className={`h-1.5 w-16 rounded-full bg-gradient-to-r ${mod.theme.accent}`} />
                <p className="mt-4 text-[10px] font-bold tracking-widest text-ink-muted uppercase">Lab {i + 1}</p>
                <h3 className="mt-1 font-display text-lg font-bold text-ink">{mod.title}</h3>
                <p className="mt-1 text-xs font-bold tracking-wide text-ink-muted uppercase">{mod.tagline}</p>
                <p className="mt-3 text-sm text-ink-muted">{mod.description}</p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {mod.concepts.map((c) => (
                    <li key={c.id} className={`rounded-full px-3 py-1 text-xs font-semibold ${mod.theme.chip}`}>
                      {c.title}
                    </li>
                  ))}
                </ul>
                <Link
                  href={`/play?module=${mod.id}`}
                  className="gradient-purple-blue mt-6 inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-bold text-white transition group-hover:opacity-90"
                >
                  Play Lab <span aria-hidden="true">→</span>
                </Link>
              </div>
            </div>
          ))}
        </div>

        {UNAVAILABLE_MODULES.length > 0 && (
          <div className="mt-8 text-center">
            <p className="text-xs font-bold tracking-widest text-ink-muted uppercase">Coming Soon</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {UNAVAILABLE_MODULES.map((mod) => (
                <span
                  key={mod.id}
                  className="rounded-full border border-dashed border-border bg-white/60 px-4 py-1.5 text-xs font-semibold text-ink-muted"
                >
                  {mod.title}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-2xl rounded-3xl border border-border bg-white p-6 text-center">
        <p className="text-xs font-bold tracking-[0.15em] text-purple uppercase">Nexus Adaptive Mode</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
          Every experiment measures your performance. Your next challenge changes with what you demonstrate.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[10px] font-bold tracking-wide text-ink-muted uppercase">
          <span className="rounded-full bg-surface-lavender px-3 py-1.5">Your Performance</span>
          <span aria-hidden="true">→</span>
          <span className="rounded-full bg-surface-lavender px-3 py-1.5">Concept Mastery</span>
          <span aria-hidden="true">→</span>
          <span className="rounded-full bg-surface-lavender px-3 py-1.5">Adaptive Engine</span>
          <span aria-hidden="true">→</span>
          <span className="rounded-full bg-surface-lavender px-3 py-1.5">Next Challenge</span>
        </div>
      </div>

      <details className="mx-auto w-full max-w-2xl rounded-3xl border border-border bg-white p-6 [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-bold tracking-[0.15em] text-purple uppercase">
          How to Play
          <span aria-hidden="true" className="text-ink-muted">▾</span>
        </summary>
        <ol className="mt-4 space-y-1.5 text-sm text-ink-muted">
          {HOW_TO_PLAY_STEPS.map((step, i) => (
            <li key={step}>
              {i + 1}. {step}
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
