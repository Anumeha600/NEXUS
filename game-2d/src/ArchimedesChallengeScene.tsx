"use client";

// --------------------------------------------------------------------------
// Archimedes / Buoyancy - Phase 1 game controller.
//
// Deliberately standalone, mirroring wavesChallenge.ts's own Phase 1 header
// note: no AdaptiveEngine, no LearningEvent, no mastery - this component
// owns only local React state (the current challenge + the READY/
// MEASURING_AIR/MEASURING_WATER/RESULT play state from archimedesChallenge.ts).
// Every challenge comes from generateArchimedesChallenge - this component
// never invents one itself. "Next Challenge" simply advances a local,
// deterministic cycle through the 5 concept types; there is no adaptive
// selection logic here yet (that is a later phase, once this experiment and
// its physics are proven out).
//
// HowToPlay/formula content below is local and standalone (a small "?"
// button + popup, and a formula card), per this phase's brief: the shared
// game-2d/src/HowToPlay.tsx system is not touched in Phase 1.
// --------------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState } from "react";
import ArchimedesScene from "./ArchimedesScene";
import {
  ARCHIMEDES_CONCEPTS,
  ARCHIMEDES_FLUIDS,
  generateArchimedesChallenge,
  givenFieldsForArchimedesChallenge,
  validateArchimedesAnswer,
  createArchimedesPlayState,
  measureInAir,
  submergeObject,
  submitArchimedesNumericAnswer,
  submitArchimedesChoiceAnswer,
  resetArchimedesAttempt,
  initialFluidForChallenge,
  applyFluidToChallenge,
  type ArchimedesChallenge,
  type ArchimedesNumericChallenge,
  type ArchimedesChoiceChallenge,
  type ArchimedesFluid,
} from "./archimedesChallenge";
import type { FloatingOutcome } from "./archimedesPhysics";

const FLOAT_SINK_OPTIONS: readonly FloatingOutcome[] = ["FLOAT", "SINK", "NEUTRAL"];

function nextChallengeFor(n: number): ArchimedesChallenge {
  const concept = ARCHIMEDES_CONCEPTS[n % ARCHIMEDES_CONCEPTS.length];
  return generateArchimedesChallenge(concept.id, n);
}

// A small, self-contained "?" popup - the same visual language as the
// shared HowToPlay.tsx (small circular button, top-right, a card popup below
// it) but local to this scene, per this phase's brief.
function ArchimedesHowToPlay() {
  const [open, setOpen] = useState(false);
  const steps = [
    "Measure the object's weight in air.",
    "Lower it into the fluid.",
    "Observe the apparent weight once fully submerged.",
    "Determine the buoyant force this challenge asks for.",
    "Relate the buoyant force to the fluid it displaced.",
  ];
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close how to play" : "How to play"}
        className="pointer-events-auto absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-lg font-bold text-ink shadow-lg hover:bg-white"
      >
        ?
      </button>
      {open && (
        <div className="pointer-events-auto absolute right-4 top-16 z-20 w-64 max-w-[calc(100%-2rem)] rounded-2xl border-2 border-purple/30 bg-white/95 p-4 shadow-xl">
          <p className="text-[10px] font-bold tracking-widest text-purple uppercase">How to Play</p>
          <ol className="mt-2 space-y-1 text-xs text-ink-muted">
            {steps.map((step, i) => (
              <li key={step}>
                {i + 1}. {step}
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  );
}

function ArchimedesFormulaCard() {
  const formulas = [
    { label: "Weight", formula: "W = mg" },
    { label: "Buoyant Force", formula: "F_B = ρ_f g V" },
    { label: "Apparent Weight", formula: "W_apparent = W − F_B" },
  ];
  const variables = [
    { symbol: "W", meaning: "weight (N)" },
    { symbol: "m", meaning: "mass (kg)" },
    { symbol: "g", meaning: "gravity (9.8 m/s²)" },
    { symbol: "ρ_f", meaning: "fluid density (kg/m³)" },
    { symbol: "V", meaning: "displaced volume (m³)" },
  ];
  return (
    <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
      <p className="text-[10px] font-bold tracking-widest text-ink-muted uppercase">Formulas</p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {formulas.map((f) => (
          <div key={f.label} className="gradient-blue-cyan rounded-2xl p-3 text-center shadow-sm">
            <p className="text-[9px] font-bold tracking-widest text-white/80 uppercase">{f.label}</p>
            <p className="mt-1 font-display text-sm font-extrabold text-white">{f.formula}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {variables.map((v) => (
          <div key={v.symbol} className="flex items-center gap-1.5 rounded-full bg-blue/10 px-3 py-1">
            <span className="font-display text-xs font-bold text-blue-dark">{v.symbol}</span>
            <span className="text-xs text-ink-muted">{v.meaning}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ArchimedesChallengeScene() {
  const challengeIndexRef = useRef(0);
  // The challenge exactly as generated (never mutated) - "Next Challenge"
  // replaces this wholesale; a fluid change never does.
  const [baseChallenge, setBaseChallenge] = useState<ArchimedesChallenge>(() => nextChallengeFor(challengeIndexRef.current));
  const [selectedFluid, setSelectedFluid] = useState<ArchimedesFluid>(() => initialFluidForChallenge(baseChallenge));
  const [playState, setPlayState] = useState(() => createArchimedesPlayState());
  const [answerText, setAnswerText] = useState("");
  const [choiceAnswer, setChoiceAnswer] = useState<FloatingOutcome | null>(null);

  // The challenge actually displayed/graded - baseChallenge re-derived for
  // whichever fluid is currently selected, from archimedesPhysics.ts's own
  // formulas (applyFluidToChallenge), never a separately faked value. Same
  // id/conceptId as baseChallenge - this is never a second challenge.
  const challenge = useMemo(() => applyFluidToChallenge(baseChallenge, selectedFluid), [baseChallenge, selectedFluid]);

  // A brand new challenge (Next Challenge) starts over completely: its own
  // default fluid, and a fresh play state.
  useEffect(() => {
    setSelectedFluid(initialFluidForChallenge(baseChallenge));
    setPlayState(createArchimedesPlayState());
    setAnswerText("");
    setChoiceAnswer(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseChallenge]);

  const submerged = playState.phase === "MEASURING_WATER" || playState.phase === "RESULT";
  const givenFields = givenFieldsForArchimedesChallenge(challenge);
  const answerValidation = challenge.kind === "numeric" ? validateArchimedesAnswer(answerText) : null;
  const answerError = answerValidation && "error" in answerValidation ? answerValidation.error : null;

  function handleMeasureAir() {
    setPlayState((prev) => measureInAir(prev));
  }

  function handleSubmerge() {
    setPlayState((prev) => submergeObject(prev));
  }

  function handleSubmit() {
    if (playState.phase !== "MEASURING_WATER" || challenge.kind !== "numeric") return;
    if (!answerValidation || "error" in answerValidation) return;
    setPlayState((prev) => submitArchimedesNumericAnswer(prev, challenge as ArchimedesNumericChallenge, answerValidation.value));
  }

  function handleChoiceSubmit(option: FloatingOutcome) {
    if (playState.phase !== "MEASURING_WATER" || challenge.kind !== "choice") return;
    setChoiceAnswer(option);
    setPlayState((prev) => submitArchimedesChoiceAnswer(prev, challenge as ArchimedesChoiceChallenge, option));
  }

  function handleNextChallenge() {
    challengeIndexRef.current += 1;
    setBaseChallenge(nextChallengeFor(challengeIndexRef.current));
  }

  // Changing fluid returns the experiment to its initial (READY / in-air)
  // measurement state - reusing resetArchimedesAttempt, the same pure
  // reset used by the Reset button below, rather than a second mechanism.
  // Never leaves a stale air/apparent-weight reading from the old fluid.
  function handleFluidChange(fluid: ArchimedesFluid) {
    setSelectedFluid(fluid);
    setPlayState((prev) => resetArchimedesAttempt(prev));
    setAnswerText("");
    setChoiceAnswer(null);
  }

  // Restores the initial fluid and a fresh play state for this SAME
  // challenge (never generates a new one, never touches AdaptiveEngine/
  // mastery/attempts - there is none of that wired into Phase 1 anyway).
  function handleReset() {
    setSelectedFluid(initialFluidForChallenge(baseChallenge));
    setPlayState((prev) => resetArchimedesAttempt(prev));
    setAnswerText("");
    setChoiceAnswer(null);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
        <p className="text-[10px] font-bold tracking-widest text-purple uppercase">{challenge.conceptTitle}</p>
        <p className="mt-1.5 text-sm font-semibold text-ink">{challenge.prompt}</p>
        {givenFields.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
            {givenFields.map((f) => (
              <span key={f.label}>
                {f.label}: <span className="font-semibold text-ink">{f.value}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="relative overflow-hidden rounded-3xl border-2 border-purple/20 shadow-xl">
        <ArchimedesScene
          actualWeight={challenge.kind === "numeric" ? challenge.actualWeight : challenge.setup.mass * challenge.setup.gravity}
          buoyantForce={challenge.kind === "numeric" ? challenge.buoyantForce : 0}
          fluidName={challenge.setup.fluidName}
          submerged={submerged}
          resetToken={challenge.id * 10_000 + playState.attemptId}
        />
        <ArchimedesHowToPlay />
      </div>

      <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-bold tracking-widest text-ink-muted uppercase">Experiment</p>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2">
              <span className="text-[10px] font-bold tracking-widest text-ink-muted uppercase">Fluid</span>
              <select
                value={selectedFluid.name}
                onChange={(e) => {
                  const next = ARCHIMEDES_FLUIDS.find((f) => f.name === e.target.value);
                  if (next) handleFluidChange(next);
                }}
                aria-label="Fluid"
                className="rounded-full border border-border bg-surface-lavender/40 px-3 py-1.5 text-xs font-bold text-ink outline-none focus:border-purple"
              >
                {ARCHIMEDES_FLUIDS.map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-bold text-ink-muted transition hover:bg-surface-lavender/60 hover:text-ink"
            >
              ↻ Reset
            </button>
          </div>
        </div>

        {playState.phase === "READY" && (
          <div className="mt-3">
            <p className="text-sm text-ink-muted">The object is hanging in air, above the {challenge.setup.fluidName}.</p>
            <button
              type="button"
              onClick={handleMeasureAir}
              className="gradient-purple-blue mt-3 inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold text-white shadow-lg transition hover:opacity-90"
            >
              Measure Weight in Air
            </button>
          </div>
        )}

        {playState.phase === "MEASURING_AIR" && (
          <div className="mt-3">
            <p className="text-sm text-ink-muted">
              Weight in air: <span className="font-display font-bold text-ink">{(challenge.setup.mass * challenge.setup.gravity).toFixed(2)} N</span>
            </p>
            <button
              type="button"
              onClick={handleSubmerge}
              className="gradient-purple-blue mt-3 inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold text-white shadow-lg transition hover:opacity-90"
            >
              Lower into Fluid
            </button>
          </div>
        )}

        {(playState.phase === "MEASURING_WATER" || playState.phase === "RESULT") && (
          <div className="mt-3">
            {challenge.kind === "numeric" && (
              <p className="text-sm text-ink-muted">
                Apparent weight (submerged): <span className="font-display font-bold text-ink">{challenge.apparentWeight.toFixed(2)} N</span>
              </p>
            )}

            {playState.phase === "MEASURING_WATER" && (
              <div className="mt-3">
                <label className="text-xs font-bold tracking-widest text-ink-muted uppercase">Your Answer</label>
                {challenge.kind === "choice" ? (
                  <div className="mt-2 flex flex-wrap gap-3">
                    {FLOAT_SINK_OPTIONS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => handleChoiceSubmit(option)}
                        className={`inline-flex items-center justify-center rounded-full border px-6 py-2.5 text-sm font-bold capitalize transition ${
                          choiceAnswer === option ? "gradient-purple-blue border-transparent text-white" : "border-border bg-white text-ink hover:bg-surface-lavender/60"
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-lavender/40 px-3 py-2 focus-within:border-purple">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={answerText}
                        onChange={(e) => setAnswerText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSubmit();
                        }}
                        aria-invalid={answerError !== null}
                        className="w-28 bg-transparent text-center font-display text-lg font-extrabold text-ink outline-none"
                      />
                      <span className="text-sm font-semibold text-ink-muted">{challenge.unit}</span>
                    </div>
                    <button
                      type="button"
                      disabled={answerError !== null}
                      onClick={handleSubmit}
                      className="gradient-purple-blue inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold text-white shadow-lg transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
                    >
                      Submit
                    </button>
                  </div>
                )}
                {answerError && <p className="mt-2 text-xs font-bold text-red">{answerError}</p>}
              </div>
            )}
          </div>
        )}
      </div>

      {playState.phase === "RESULT" && playState.result && (
        <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
          <p className={`text-sm font-bold ${playState.result.correct ? "text-green" : "text-red"}`}>{playState.result.correct ? "Correct!" : "Not quite."}</p>
          {"targetValue" in playState.result ? (
            <p className="mt-1 text-xs text-ink-muted">
              Target {playState.result.targetValue} {challenge.kind === "numeric" ? challenge.unit : ""} &middot; Your answer {playState.result.submittedValue}{" "}
              {challenge.kind === "numeric" ? challenge.unit : ""}
            </p>
          ) : (
            <p className="mt-1 text-xs text-ink-muted">
              Correct answer: {playState.result.correctAnswer} &middot; Your answer {playState.result.submittedAnswer}
            </p>
          )}
          <button
            type="button"
            onClick={handleNextChallenge}
            className="mt-3 inline-flex items-center justify-center gap-2 rounded-full border border-border bg-surface-lavender/60 px-5 py-2 text-sm font-bold text-ink transition hover:bg-surface-lavender"
          >
            Next Challenge
          </button>
        </div>
      )}

      <ArchimedesFormulaCard />
    </div>
  );
}
