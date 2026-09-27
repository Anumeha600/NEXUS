"use client";

import { useRef, useState } from "react";
import { AVAILABLE_MODULES, hasLesson, type ConceptInfo, type ModuleTheme } from "@nexus/shared";
import ConceptLessonPanel from "./ConceptLessonPanel";

// This maps a module's index to the same badge/ring styling the old
// hardcoded list used - the shared curriculum's own `theme` is a
// gradient/chip pairing meant for PhysicsJourney's cards and the concept
// lesson panel, not this page's plain numbered-badge layout, so the map here
// stays local to this component rather than forcing one theme shape to serve
// two different visual treatments.
const BADGE_STYLES = [
  { color: "bg-blue", ring: "border-blue/30" },
  { color: "bg-purple", ring: "border-purple/30" },
  { color: "bg-gold-dark", ring: "border-gold/40" },
];

// Only modules with a working game behind them belong on this map - a
// curriculum-only entry (available: false) has no lesson to actually walk
// through yet, so showing it here would be exactly the "claims to work but
// doesn't" placeholder this product avoids.
const MODULES = AVAILABLE_MODULES.map((mod, i) => ({
  id: mod.id,
  name: mod.title,
  concepts: mod.concepts,
  theme: mod.theme,
  badge: BADGE_STYLES[i % BADGE_STYLES.length],
}));

interface SelectedConcept {
  moduleId: string;
  moduleTitle: string;
  concept: ConceptInfo;
  theme: ModuleTheme;
}

export default function CurriculumMap() {
  const [selected, setSelected] = useState<SelectedConcept | null>(null);
  const lastFocusedRef = useRef<HTMLButtonElement | null>(null);

  function openConcept(button: HTMLButtonElement, mod: (typeof MODULES)[number], concept: ConceptInfo) {
    if (!hasLesson(concept)) return;
    lastFocusedRef.current = button;
    setSelected({ moduleId: mod.id, moduleTitle: mod.name, concept, theme: mod.theme });
  }

  function closePanel() {
    setSelected(null);
    lastFocusedRef.current?.focus();
  }

  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 text-center">
          <span className="text-xs font-bold tracking-[0.2em] text-purple uppercase">
            Learn
          </span>
          <h2 className="mt-2 font-display text-3xl font-extrabold text-ink sm:text-4xl">
            The curriculum map
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-ink-muted">
            This is the order concepts are introduced in — not a checklist
            of what you&apos;ve unlocked. Click any concept for a quick
            physics briefing, then try it in NEXUS.
          </p>
        </div>

        <div className="mt-12 flex flex-col items-center">
          {MODULES.map((mod, i) => (
            <div key={mod.name} className="flex w-full flex-col items-center">
              <div
                className={`card-elevated w-full max-w-md rounded-2xl border-2 bg-white p-6 ${mod.badge.ring}`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full ${mod.badge.color} font-display text-sm font-bold text-white`}
                  >
                    {i + 1}
                  </span>
                  <h3 className="font-display text-lg font-bold text-ink">
                    {mod.name}
                  </h3>
                </div>
                <ul className="mt-4 space-y-1 border-l-2 border-border pl-4">
                  {mod.concepts.map((concept) => {
                    const clickable = hasLesson(concept);
                    return (
                      <li
                        key={concept.id}
                        className="relative before:absolute before:-left-[21px] before:top-1/2 before:h-2 before:w-2 before:-translate-y-1/2 before:rounded-full before:bg-border"
                      >
                        <button
                          type="button"
                          disabled={!clickable}
                          onClick={(e) => openConcept(e.currentTarget, mod, concept)}
                          className={`group flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-medium transition ${
                            clickable
                              ? "cursor-pointer text-ink-muted hover:-translate-y-0.5 hover:bg-surface-lavender hover:text-ink hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple/50"
                              : "cursor-default text-ink-muted/70"
                          }`}
                        >
                          <span>{concept.title}</span>
                          {clickable && (
                            <span
                              aria-hidden="true"
                              className="text-ink-muted transition group-hover:translate-x-0.5 group-hover:text-purple"
                            >
                              →
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {i < MODULES.length - 1 && (
                <div className="my-2 flex h-10 flex-col items-center justify-center text-ink-muted/50">
                  <div className="h-full w-0.5 bg-border" />
                  <span className="-mt-1">↓</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <ConceptLessonPanel
          concept={selected.concept}
          moduleId={selected.moduleId}
          moduleTitle={selected.moduleTitle}
          theme={selected.theme}
          onClose={closePanel}
        />
      )}
    </section>
  );
}
