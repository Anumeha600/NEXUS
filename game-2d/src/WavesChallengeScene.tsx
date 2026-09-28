"use client";

// --------------------------------------------------------------------------
// Wave Motion - the challenge/game controller UI.
//
// Phase 2: wired to the existing AdaptiveEngine exactly like
// GravitationChallengeScene.tsx wires MODULE_GRAVITATION - this component
// owns one `new AdaptiveEngine(MODULE_WAVES)` instance for its lifetime,
// reads every challenge from `engine.generateNextChallenge()` (never
// constructs one itself), and hands a completed submission to
// wavesLearning.ts's recordWaveAttempt, which is the only place mastery is
// updated, content transitions are evaluated, and the next challenge is
// generated. This component never independently decides mastery, difficulty,
// or which challenge comes next - see wavesLearning.ts's own header comment
// for the full list of what it is not allowed to do.
//
// wavesChallenge.ts's pure generate/validate/evaluate functions are still
// exactly what generateNextChallenge/recordWaveAttempt call under the hood
// (via challenge.waveChallenge) - this file only reads that attached
// WaveChallenge to render the scene/controls, it never calls
// generateWaveChallenge itself.
//
// Completion is always tied to the player's own Submit click (see
// wavesChallenge.ts's own header comment) - the wave keeps animating
// regardless of phase, exactly like the brief's completion diagram:
// change/submit -> evaluate -> success/failure -> challenge completion.
// --------------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState } from "react";
import { AdaptiveEngine, MODULE_WAVES, type Challenge } from "./adaptiveEngine";
import { waveSpeed, type WaveParams, type InterferenceType } from "./wavesPhysics";
import { WAVE_CONCEPT_SUPERPOSITION, givenFieldsForWaveChallenge, validateWaveAnswer, type WaveChallenge, type WaveSolveTarget } from "./wavesChallenge";
import { recordWaveAttempt, type WaveAttemptResult } from "./wavesLearning";
import WavesScene from "./WavesScene";
import HowToPlay from "./HowToPlay";

interface PrimaryControls {
  readonly amplitude: number;
  readonly frequency: number;
  readonly wavelength: number;
}

// Same pattern as GameCanvas.tsx/GravitationChallengeScene.tsx's own
// newSessionId() - a per-session id generated once per mount.
function newWaveSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `waves-session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// What the primary control panel starts at for a given (non-superposition)
// challenge: every field takes the challenge's own true value EXCEPT the
// one being solved for in "match" mode, which starts at the challenge's own
// deliberately-off startValue instead - never the answer itself.
function initialControlsFor(waveChallenge: WaveChallenge): PrimaryControls {
  if (waveChallenge.kind === "choice" || waveChallenge.conceptId === WAVE_CONCEPT_SUPERPOSITION) {
    return { amplitude: 1, frequency: 1, wavelength: 3 };
  }
  const { wave, solveFor, mode, startValue } = waveChallenge;
  const amplitude = solveFor === "amplitude" && mode === "match" && startValue !== undefined ? startValue : wave.amplitude;
  return { amplitude, frequency: wave.frequency, wavelength: wave.wavelength };
}

// A field is editable only when the active challenge is specifically asking
// the player to produce IT via the live control ("match" mode) - every other
// field (and every field during "read" mode challenges) stays locked to the
// challenge's own fixed, true value, so the challenge can't be trivialized
// by just moving an unrelated slider.
function isFieldEditable(waveChallenge: WaveChallenge, field: WaveSolveTarget): boolean {
  if (waveChallenge.kind === "choice") return false;
  return waveChallenge.mode === "match" && waveChallenge.solveFor === field;
}

function ControlBox({ label, value, unit, editable, onChange, hidden }: { label: string; value: number; unit: string; editable: boolean; onChange: (v: number) => void; hidden: boolean }) {
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${editable ? "border-purple bg-white" : "border-border bg-surface-lavender/40"}`}>
      <p className="text-[10px] font-bold tracking-widest text-ink-muted uppercase">{label}</p>
      {hidden ? (
        <p className="mt-1 font-display text-lg font-extrabold text-ink-muted">?</p>
      ) : editable ? (
        <div className="mt-1 flex items-center gap-1.5">
          <input
            type="number"
            step={0.1}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full bg-transparent font-display text-lg font-extrabold text-ink outline-none"
          />
          <span className="text-xs font-semibold text-ink-muted">{unit}</span>
        </div>
      ) : (
        <p className="mt-1 font-display text-lg font-extrabold text-ink">
          {value.toFixed(2)} <span className="text-xs font-semibold text-ink-muted">{unit}</span>
        </p>
      )}
    </div>
  );
}

// Every formula the Phase 1 physics layer (wavesPhysics.ts) actually
// implements - k, omega, T, v=f*lambda, the displacement equation, and
// superposition - never a formula the game doesn't model.
function WavesFormulaCard() {
  const formulas = [
    { label: "Wave Number", formula: "k = 2π / λ" },
    { label: "Angular Frequency", formula: "ω = 2πf" },
    { label: "Frequency", formula: "f = 1 / T" },
    { label: "Wave Speed", formula: "v = fλ" },
    { label: "Displacement", formula: "y = A sin(kx - ωt + φ)" },
    { label: "Superposition", formula: "y = y₁ + y₂" },
  ];
  const variables = [
    { symbol: "A", meaning: "amplitude" },
    { symbol: "f", meaning: "frequency" },
    { symbol: "λ", meaning: "wavelength" },
    { symbol: "v", meaning: "wave speed" },
    { symbol: "T", meaning: "period" },
  ];
  return (
    <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
      <p className="text-[10px] font-bold tracking-widest text-ink-muted uppercase">Formulas</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
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

const INTERFERENCE_OPTIONS: readonly InterferenceType[] = ["constructive", "destructive"];

// A small secondary action next to Submit - retries the CURRENT challenge
// from its initial state (see handleReset below). Deliberately a plain
// outline pill, visually subordinate to Submit's filled gradient button,
// never competing with it for attention.
function ResetButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Reset this challenge"
      className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border bg-white px-4 py-2.5 text-sm font-bold text-ink-muted transition hover:bg-surface-lavender/60 hover:text-ink"
    >
      <span aria-hidden="true">↻</span> Reset
    </button>
  );
}

export default function WavesChallengeScene() {
  // One AdaptiveEngine instance for the lifetime of this component, exactly
  // as GravitationChallengeScene.tsx owns one for MODULE_GRAVITATION - never
  // recreated, never mutated from outside wavesLearning.ts.
  const [engine] = useState(() => new AdaptiveEngine(MODULE_WAVES));
  const [challenge, setChallenge] = useState<Challenge>(() => engine.generateNextChallenge());
  const waveChallenge = challenge.waveChallenge!;

  const [controls, setControls] = useState<PrimaryControls>(() => initialControlsFor(waveChallenge));
  const [answerText, setAnswerText] = useState("");
  const [choiceAnswer, setChoiceAnswer] = useState<InterferenceType | null>(null);
  const [attemptResult, setAttemptResult] = useState<WaveAttemptResult | null>(null);

  const sessionIdRef = useRef(newWaveSessionId());
  const attemptNumberRef = useRef(0);
  // Decision time (challenge shown -> Submit clicked) - the same quantity
  // GameCanvas.tsx/gravitationLearning.ts measure as "responseTime" for
  // every other module.
  const readyShownAtRef = useRef(performance.now());

  useEffect(() => {
    setControls(initialControlsFor(waveChallenge));
    setAnswerText("");
    setChoiceAnswer(null);
    setAttemptResult(null);
    readyShownAtRef.current = performance.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge]);

  const isSuperposition = waveChallenge.conceptId === WAVE_CONCEPT_SUPERPOSITION;
  const derivedWaveSpeed = waveSpeed(controls.frequency, controls.wavelength);
  const givenFields = givenFieldsForWaveChallenge(waveChallenge);
  const locked = attemptResult !== null;

  const primaryWave: WaveParams = { amplitude: controls.amplitude, frequency: controls.frequency, wavelength: controls.wavelength, phase: 0 };
  const sceneWave1 = isSuperposition ? (waveChallenge.kind === "choice" ? waveChallenge.wave1 : waveChallenge.wave) : primaryWave;
  const sceneWave2 = isSuperposition ? waveChallenge.wave2 : undefined;

  const answerValidation = waveChallenge.kind === "numeric" && waveChallenge.mode === "read" ? validateWaveAnswer(answerText) : null;
  const answerError = answerValidation && "error" in answerValidation ? answerValidation.error : null;

  function handleControlChange(field: keyof PrimaryControls, value: number) {
    if (!Number.isFinite(value)) return;
    setControls((prev) => ({ ...prev, [field]: value }));
  }

  function submitAttempt(params: { submittedValue?: number; submittedChoice?: InterferenceType }) {
    attemptNumberRef.current += 1;
    const responseTimeSeconds = (performance.now() - readyShownAtRef.current) / 1000;
    const result = recordWaveAttempt(engine, {
      challenge,
      ...params,
      responseTimeSeconds,
      sessionId: sessionIdRef.current,
      attemptNumber: attemptNumberRef.current,
    });
    setAttemptResult(result);
  }

  function handleSubmit() {
    if (locked || waveChallenge.kind === "choice") return;
    if (waveChallenge.mode === "match") {
      submitAttempt({ submittedValue: controls[waveChallenge.solveFor as keyof PrimaryControls] ?? controls.amplitude });
      return;
    }
    if (!answerValidation || "error" in answerValidation) return;
    submitAttempt({ submittedValue: answerValidation.value });
  }

  function handleChoiceSubmit(option: InterferenceType) {
    if (locked || waveChallenge.kind !== "choice") return;
    setChoiceAnswer(option);
    submitAttempt({ submittedChoice: option });
  }

  function handleNextChallenge() {
    if (!attemptResult || !attemptResult.supported) return;
    setChallenge(attemptResult.nextChallenge);
  }

  // Retries the SAME challenge from its initial state - purely local UI/game
  // state, exactly mirroring the reset this component's own [challenge]
  // effect above already does whenever a genuinely new challenge arrives.
  // Never touches `challenge`/`engine` - no AdaptiveEngine call, no
  // recordWaveAttempt, no attemptNumberRef increment, so mastery and the
  // adaptive engine's progression are completely unaffected.
  function handleReset() {
    setControls(initialControlsFor(waveChallenge));
    setAnswerText("");
    setChoiceAnswer(null);
    setAttemptResult(null);
    readyShownAtRef.current = performance.now();
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
        <p className="text-[10px] font-bold tracking-widest text-purple uppercase">
          {challenge.conceptTitle} &middot; {challenge.difficulty}
        </p>
        <p className="mt-1.5 text-sm font-semibold text-ink">{waveChallenge.prompt}</p>
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
        <WavesScene wave={sceneWave1} wave2={sceneWave2} showMarkers={!isSuperposition} showParticle={!isSuperposition} />
        <HowToPlay challenge={challenge} belowFullscreenButton={false} />
      </div>

      {!isSuperposition && (
        <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
          <p className="text-xs font-bold tracking-widest text-ink-muted uppercase">Wave Controls</p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ControlBox
              label="Amplitude"
              value={controls.amplitude}
              unit="m"
              editable={!locked && isFieldEditable(waveChallenge, "amplitude")}
              hidden={waveChallenge.kind === "numeric" && waveChallenge.mode === "read" && waveChallenge.solveFor === "amplitude"}
              onChange={(v) => handleControlChange("amplitude", v)}
            />
            <ControlBox
              label="Frequency"
              value={controls.frequency}
              unit="Hz"
              editable={!locked && isFieldEditable(waveChallenge, "frequency")}
              hidden={waveChallenge.kind === "numeric" && waveChallenge.mode === "read" && (waveChallenge.solveFor === "frequency" || waveChallenge.solveFor === "period")}
              onChange={(v) => handleControlChange("frequency", v)}
            />
            <ControlBox
              label="Wavelength"
              value={controls.wavelength}
              unit="m"
              editable={!locked && isFieldEditable(waveChallenge, "wavelength")}
              hidden={waveChallenge.kind === "numeric" && waveChallenge.mode === "read" && waveChallenge.solveFor === "wavelength"}
              onChange={(v) => handleControlChange("wavelength", v)}
            />
          </div>
          <p className="mt-3 text-sm text-ink-muted">
            Wave speed: <span className="font-display font-bold text-ink">v = fλ = {derivedWaveSpeed.toFixed(2)} m/s</span>
          </p>
        </div>
      )}

      <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
        <label className="text-xs font-bold tracking-widest text-ink-muted uppercase">Your Answer</label>

        {waveChallenge.kind === "choice" ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {INTERFERENCE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                disabled={locked}
                onClick={() => handleChoiceSubmit(option)}
                className={`inline-flex items-center justify-center rounded-full border px-6 py-2.5 text-sm font-bold capitalize transition disabled:pointer-events-none disabled:opacity-40 ${
                  choiceAnswer === option ? "gradient-purple-blue border-transparent text-white" : "border-border bg-white text-ink hover:bg-surface-lavender/60"
                }`}
              >
                {option}
              </button>
            ))}
            <ResetButton onClick={handleReset} />
          </div>
        ) : waveChallenge.mode === "match" ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <p className="text-sm text-ink-muted">
              Set the amplitude control above to <span className="font-semibold text-ink">{waveChallenge.targetValue} m</span>, then submit.
            </p>
            <ResetButton onClick={handleReset} />
            <button
              type="button"
              disabled={locked}
              onClick={handleSubmit}
              className="gradient-purple-blue inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold text-white shadow-lg transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
            >
              Submit
            </button>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-lavender/40 px-3 py-2 focus-within:border-purple">
              <input
                type="text"
                inputMode="decimal"
                value={answerText}
                disabled={locked}
                onChange={(e) => setAnswerText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmit();
                }}
                aria-invalid={answerError !== null}
                className="w-28 bg-transparent text-center font-display text-lg font-extrabold text-ink outline-none disabled:opacity-60"
              />
              <span className="text-sm font-semibold text-ink-muted">{waveChallenge.unit}</span>
            </div>
            <ResetButton onClick={handleReset} />
            <button
              type="button"
              disabled={locked || answerError !== null}
              onClick={handleSubmit}
              className="gradient-purple-blue inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold text-white shadow-lg transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
            >
              Submit
            </button>
          </div>
        )}
        {answerError && <p className="mt-2 text-xs font-bold text-red">{answerError}</p>}
      </div>

      {attemptResult && attemptResult.supported && (
        <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
          <p className={`text-sm font-bold ${attemptResult.success ? "text-green" : "text-red"}`}>
            {attemptResult.success ? "Correct!" : "Not quite."}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Target {attemptResult.event.target_value} {attemptResult.event.unit} &middot; Your answer {attemptResult.event.actual_value} {attemptResult.event.unit}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Mastery: {(attemptResult.masteryBefore * 100).toFixed(0)}% &rarr; {(attemptResult.masteryAfter * 100).toFixed(0)}%
          </p>
          <p className="mt-1 text-xs text-ink-muted">{attemptResult.adaptationNote}</p>
          <button
            type="button"
            onClick={handleNextChallenge}
            className="mt-3 inline-flex items-center justify-center gap-2 rounded-full border border-border bg-surface-lavender/60 px-5 py-2 text-sm font-bold text-ink transition hover:bg-surface-lavender"
          >
            Next Challenge: {attemptResult.nextChallenge.conceptTitle}
          </button>
        </div>
      )}

      <WavesFormulaCard />
    </div>
  );
}
