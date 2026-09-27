"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { hasLesson, playRouteFor, type ConceptInfo, type ModuleTheme } from "@nexus/shared";

// A quick physics briefing, not a textbook page: formula, variables, one key
// idea, one worked example, then a way to go play it. Only ever rendered for
// a concept hasLesson() has already confirmed has full content - see the
// guard below, which exists so a future caller can't accidentally open this
// on a curriculum-only concept and show empty fields.
export default function ConceptLessonPanel({
  concept,
  moduleId,
  moduleTitle,
  theme,
  onClose,
}: {
  concept: ConceptInfo;
  moduleId: string;
  moduleTitle: string;
  theme: ModuleTheme;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!hasLesson(concept)) return null;
  const playHref = playRouteFor(moduleId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 sm:items-center sm:p-6"
      style={{ animation: "lessonBackdropIn 0.15s ease-out" }}
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="concept-lesson-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border-2 border-white bg-white p-6 shadow-2xl outline-none sm:max-w-lg sm:rounded-3xl"
        style={{ animation: "lessonPanelIn 0.2s ease-out" }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-ink-muted uppercase">{moduleTitle}</p>
            <h3 id="concept-lesson-title" className="mt-0.5 font-display text-xl font-extrabold text-ink">
              {concept.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-lavender text-ink-muted hover:bg-purple hover:text-white"
          >
            ✕
          </button>
        </div>

        <p className="mt-3 text-sm text-ink-muted">{concept.description}</p>

        <div className={`mt-4 rounded-2xl bg-gradient-to-br ${theme.accent} p-5 text-center shadow-lg`}>
          <p className="text-[10px] font-bold tracking-[0.2em] text-white/80 uppercase">Formula</p>
          <p className="mt-1 whitespace-pre-line font-display text-xl leading-snug font-extrabold text-white sm:text-2xl">{concept.formula}</p>
        </div>

        <div className="mt-4">
          <p className="text-[10px] font-bold tracking-widest text-ink-muted uppercase">Variables</p>
          <div className="mt-2 space-y-1.5">
            {concept.variables!.map((v) => (
              <div key={v.symbol} className="flex items-baseline gap-2 text-sm">
                <span className={`shrink-0 rounded-md px-1.5 py-0.5 font-display text-xs font-bold ${theme.chip}`}>{v.symbol}</span>
                <span className="text-ink-muted">{v.meaning}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`mt-4 rounded-2xl bg-white p-3 ring-2 ${theme.ring}`}>
          <p className="text-[10px] font-bold tracking-widest text-purple uppercase">Key Idea</p>
          <p className="mt-1 text-sm font-semibold text-ink">{concept.keyIdea}</p>
        </div>

        <div className="mt-4 rounded-2xl bg-surface-lavender/60 p-4">
          <p className="text-[10px] font-bold tracking-widest text-ink-muted uppercase">Quick Example</p>
          <p className="mt-2 text-[10px] font-bold text-ink-muted uppercase">Given</p>
          <ul className="text-sm text-ink">
            {concept.example!.given.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] font-bold text-ink-muted uppercase">Calculate</p>
          <p className="font-display text-sm font-bold text-ink">{concept.example!.calculate}</p>
          <p className="mt-2 text-[10px] font-bold text-ink-muted uppercase">Solution</p>
          <p className="font-display text-sm font-bold text-green">{concept.example!.solution}</p>
        </div>

        {playHref && (
          <Link
            href={playHref}
            className="gradient-purple-blue mt-5 flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:opacity-90"
          >
            Try This in NEXUS <span aria-hidden="true">▶</span>
          </Link>
        )}
      </div>
    </div>
  );
}
