"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AdaptiveEngine, MODULE_PROJECTILE, MODULE_NEWTON, MODULE_WORK_ENERGY, MODULE_MOMENTUM, MODULE_CIRCULAR, CONCEPT_WORK_ENERGY_THEOREM, type Challenge } from "./adaptiveEngine";
import { projectileFlightTime, projectilePositionAt } from "./physics";
import { drawScene } from "./render";
import HowToPlay from "./HowToPlay";
import {
  controlRangeFor,
  flightParamsFor,
  predictedValue,
  finalVelocityFromWork,
  targetValueOf,
  givenFieldsFor,
  inputLabelFor,
  actionLabelFor,
  validateInput,
  physicsInsightFor,
  contextFor,
  buildLearningEventPayload,
  resultExtrasFor,
  type ResultExtraRow,
} from "./challengeLogic";
import { RUN_DURATION_MS, experimentPhaseAt, runningReadoutFor, nonProjectileRunDurationMs, projectileRunDurationMs } from "./experimentRunner";
import { newSessionAttemptId, updateSessionAttemptInsight, parseInsightResponse } from "@nexus/shared";

const CANVAS_W = 900;
const CANVAS_H = 480;
const RESULT_DISPLAY_MS = 3200;
const TRANSITION_DISPLAY_MS = 1800;
// A short, purely cosmetic settle beat after the physical simulation has
// already reached its endpoint (cart/pod/projectile at rest) before the
// result card appears - never a gate on when the run is considered
// complete, only how long the "it just stopped" moment lingers first.
const SETTLE_MS = 220;

type RunMeta =
  | { kind: "projectile"; speed: number; gravity: number; flightTimeSeconds: number; durationMs: number; responseTime: number; submittedValue: number }
  | { kind: "nonProjectile"; predicted: number; durationMs: number; responseTime: number; submittedValue: number };

type Phase = "playing" | "flying" | "result" | "transition";

interface AiInsightState {
  status: "idle" | "loading" | "ready" | "error";
  headline?: string;
  explanation?: string;
  suggestion?: string;
  source?: "ai" | "fallback";
}

const MODULE_TITLES: Record<string, string> = {
  [MODULE_PROJECTILE]: "Projectile Motion",
  [MODULE_NEWTON]: "Newton's Laws",
  [MODULE_WORK_ENERGY]: "Work & Energy",
  [MODULE_MOMENTUM]: "Momentum & Collisions",
  [MODULE_CIRCULAR]: "Circular Motion",
};

// The player types the answer, so the field always starts empty (never a
// pre-filled number to nudge) - that's the difference between "calculate
// this" and "hunt for it by trial and error."
function defaultControlText(): string {
  return "";
}

function newSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export interface ChallengeResultEvent {
  // The same id requestAiInsight below uses to later patch THIS SAME
  // SessionAttempt's insight field once its (async) AI response resolves -
  // see PlayExperience.tsx's handleResult, which must store it as the
  // SessionAttempt's own `id`.
  attemptId: string;
  moduleId: string;
  conceptId: string;
  conceptTitle: string;
  challengeType: string;
  targetValue: number;
  actualValue: number;
  unit: string;
  success: boolean;
  performance: number;
  masteryBefore: number;
  masteryAfter: number;
  difficulty: string;
  context: Record<string, number | string>;
}

export default function GameCanvas({
  initialModuleId,
  onChallengeStarted,
  onChallengeResult,
}: {
  initialModuleId?: string;
  onChallengeStarted?: (moduleId: string, conceptTitle: string, difficulty: string) => void;
  onChallengeResult?: (event: ChallengeResultEvent) => void;
}) {
  const engineRef = useRef(new AdaptiveEngine(initialModuleId));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef(performance.now());
  const flightStartRef = useRef(0);
  // What the current "flying" run actually is and how long it's meant to
  // take, physically - the single record the rAF loop reads each frame to
  // both animate and to decide (never a parallel timer) whether the run has
  // physically reached its endpoint.
  const runMetaRef = useRef<RunMeta | null>(null);
  // Guards finishAttempt() against firing more than once for the same run -
  // set the instant physical completion is detected inside the rAF loop.
  const completionHandledRef = useRef(false);
  const sessionIdRef = useRef(newSessionId());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    reducedMotionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    setFullscreenSupported(typeof document !== "undefined" && document.fullscreenEnabled === true);
    function onFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === wrapperRef.current);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!wrapperRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      wrapperRef.current.requestFullscreen().catch(() => {});
    }
  }, []);

  // Latest-ref pattern: a caller that passes a fresh inline function every
  // render (identity changes each time) must never make the effect below
  // re-fire on that identity change alone - that previously caused an
  // infinite render loop (effect fires -> calls the callback -> caller's
  // state updates -> caller re-renders -> new function identity -> effect
  // fires again). Depending only on `challenge` and reading the callback
  // through a ref breaks that loop regardless of caller discipline.
  const onChallengeStartedRef = useRef(onChallengeStarted);
  useEffect(() => {
    onChallengeStartedRef.current = onChallengeStarted;
  });

  const [challenge, setChallenge] = useState<Challenge>(() => engineRef.current.generateNextChallenge());
  const [controlText, setControlText] = useState<string>(() => defaultControlText());
  const [inputError, setInputError] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("playing");
  const [landingDistance, setLandingDistance] = useState<number | null>(null);
  const [result, setResult] = useState<{
    success: boolean;
    targetText: string;
    actualText: string;
    errorText: string;
    performancePct: number;
    masteryBefore: number;
    masteryAfter: number;
    physicsInsight: string;
    extraRows: ResultExtraRow[] | null;
  } | null>(null);
  const [transitionInfo, setTransitionInfo] = useState<{ from: string; to: string } | null>(null);
  const [aiInsight, setAiInsight] = useState<AiInsightState>({ status: "idle" });
  const [attempts, setAttempts] = useState(1);
  // Ticks a few times a second while an experiment is running, purely to
  // re-render the live "EXPERIMENT RUNNING" numbers - the canvas animation
  // itself runs at full frame rate independently via the rAF loop below.
  const [, forceRunningTick] = useState(0);

  // Parsed for live preview/rendering only - submission goes through
  // validateInput() separately, which is the actual gate.
  const parsedControl = Number(controlText);
  const safeControlValue = Number.isFinite(parsedControl) ? parsedControl : 0;

  // Notify the host page (Right Now readout) whenever a new challenge begins.
  useEffect(() => {
    onChallengeStartedRef.current?.(challenge.moduleId, challenge.conceptTitle, challenge.difficulty);
    startTimeRef.current = performance.now();
  }, [challenge]);

  const adjust = useCallback(
    (dir: 1 | -1) => {
      if (phase !== "playing") return;
      const range = controlRangeFor(challenge);
      const current = Number.isFinite(Number(controlText)) ? Number(controlText) : (range.min + range.max) / 2;
      const next = Math.min(range.max, Math.max(range.min, current + dir * range.step * 0.15));
      setControlText(next.toFixed(1));
      setInputError(null);
    },
    [phase, challenge, controlText],
  );

  const confirm = useCallback(() => {
    if (phase !== "playing") return;
    const validation = validateInput(controlText, challenge);
    if ("error" in validation) {
      setInputError(validation.error);
      return;
    }
    setInputError(null);
    const value = validation.value;
    const responseTime = (performance.now() - startTimeRef.current) / 1000;

    completionHandledRef.current = false;

    if (challenge.moduleId === MODULE_PROJECTILE) {
      const { speed, gravity } = flightParamsFor(challenge, value);
      const flightTimeSeconds = projectileFlightTime(speed, gravity);
      runMetaRef.current = {
        kind: "projectile",
        speed,
        gravity,
        flightTimeSeconds,
        durationMs: projectileRunDurationMs(flightTimeSeconds),
        responseTime,
        submittedValue: value,
      };
      flightStartRef.current = performance.now();
      setPhase("flying");
      return;
    }

    // Non-projectile modules get the same kind of visible "the experiment
    // is running" beat as a projectile's flight: the cart/pod actually
    // moves (real kinematics from the same predicted value below), driven
    // by flightStartRef so render.ts's rAF loop can animate every frame.
    // The run is only ever declared complete from inside that same loop,
    // once it detects the physical endpoint has actually been reached - see
    // the completion check in the render effect below.
    const predicted = predictedValue(challenge, value);
    runMetaRef.current = {
      kind: "nonProjectile",
      predicted,
      durationMs: nonProjectileRunDurationMs(challenge, value),
      responseTime,
      submittedValue: value,
    };
    flightStartRef.current = performance.now();
    setPhase("flying");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, challenge, controlText]);

  // Re-render the "EXPERIMENT RUNNING" HUD readout a few times a second
  // while non-projectile modules are running - the canvas motion itself is
  // driven by the rAF loop below, not by this timer.
  useEffect(() => {
    if (phase !== "flying" || challenge.moduleId === MODULE_PROJECTILE) return;
    const id = window.setInterval(() => forceRunningTick((t) => t + 1), 80);
    return () => window.clearInterval(id);
  }, [phase, challenge.moduleId]);

  function finishAttempt(actualValue: number, responseTime: number, submittedValue: number) {
    const target = targetValueOf(challenge);
    const error = Math.abs(actualValue - target);
    const success = error <= challenge.tolerance;
    const engine = engineRef.current;

    const masteryBefore = engine.conceptMastery[challenge.conceptId];
    const performance_ = engine.recordAttempt(error, challenge.tolerance, success, responseTime);
    const masteryAfter = engine.conceptMastery[challenge.conceptId];
    const previousModule = engine.currentModuleId;
    engine.evaluateContentTransition();

    setResult({
      success,
      targetText: `${target.toFixed(2)} ${challenge.unit}`,
      actualText: `${actualValue.toFixed(2)} ${challenge.unit}`,
      errorText: `${error.toFixed(2)} ${challenge.unit}`,
      performancePct: Math.round(performance_ * 100),
      masteryBefore,
      masteryAfter,
      physicsInsight: physicsInsightFor(challenge, success, actualValue, target),
      extraRows: resultExtrasFor(challenge),
    });
    setPhase("result");

    // Generated once and shared by both calls below: onChallengeResult
    // (which PlayExperience.tsx uses as the SessionAttempt's own `id` when
    // it appends the entry) and requestAiInsight (which uses the SAME id to
    // patch that exact entry's insight once the async AI response resolves -
    // never a second LearningEvent, never a second history entry).
    const attemptId = newSessionAttemptId();

    onChallengeResult?.({
      attemptId,
      moduleId: challenge.moduleId,
      conceptId: challenge.conceptId,
      conceptTitle: challenge.conceptTitle,
      challengeType: challenge.conceptId,
      targetValue: target,
      actualValue,
      unit: challenge.unit,
      success,
      performance: performance_,
      masteryBefore,
      masteryAfter,
      difficulty: challenge.difficulty,
      context: contextFor(challenge, submittedValue, actualValue),
    });

    requestAiInsight(attemptId, challenge, actualValue, success, performance_, masteryBefore, masteryAfter, submittedValue, attempts, engine.getRecentAttemptCount(challenge.conceptId));

    window.setTimeout(() => {
      const moduleChanged = engine.currentModuleId !== previousModule;
      if (moduleChanged) {
        setTransitionInfo({ from: MODULE_TITLES[previousModule], to: MODULE_TITLES[engine.currentModuleId] });
        setPhase("transition");
        window.setTimeout(advance, TRANSITION_DISPLAY_MS);
      } else {
        advance();
      }
    }, RESULT_DISPLAY_MS);
  }

  function advance() {
    const engine = engineRef.current;
    runMetaRef.current = null;
    completionHandledRef.current = false;
    const next = engine.generateNextChallenge();
    setChallenge(next);
    setControlText(defaultControlText());
    setInputError(null);
    setLandingDistance(null);
    setResult(null);
    setTransitionInfo(null);
    setAiInsight({ status: "idle" });
    setAttempts((a) => a + 1);
    setPhase("playing");
  }

  async function requestAiInsight(
    attemptId: string,
    ch: Challenge,
    actual: number,
    success: boolean,
    performance_: number,
    masteryBefore: number,
    masteryAfter: number,
    submittedValue: number,
    attemptNumber: number,
    recentAttempts: number,
  ) {
    setAiInsight({ status: "loading" });
    try {
      const payload = buildLearningEventPayload({
        challenge: ch,
        submittedValue,
        actualValue: actual,
        success,
        performance: performance_,
        masteryBefore,
        masteryAfter,
        sessionId: sessionIdRef.current,
        attemptNumber,
        recentAttempts,
      });
      const res = await fetch("/api/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("insight failed");
      const data = await res.json();
      setAiInsight({ status: "ready", headline: data.headline, explanation: data.explanation, suggestion: data.suggestion, source: data.source });
      // Phase 5A: persist the SAME response onto the SessionAttempt
      // PlayExperience.tsx's handleResult already appended (keyed by
      // attemptId, the id onChallengeResult carried) - never a second
      // LearningEvent, never a second history entry. A response that
      // doesn't validate is silently dropped, exactly like the in-game
      // aiInsight state above already tolerates a malformed response.
      const insight = parseInsightResponse(data);
      if (insight) updateSessionAttemptInsight(attemptId, insight);
    } catch {
      setAiInsight({ status: "error" });
    }
  }

  // Keyboard controls: arrows do small nudges, Enter submits. Typing
  // directly into the input field (below) is the primary interaction.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "INPUT") {
        if (e.key === "Enter") confirm();
        return;
      }
      if (e.key === "ArrowUp") adjust(1);
      else if (e.key === "ArrowDown") adjust(-1);
      else if (e.key === "Enter") confirm();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [adjust, confirm]);

  // Render loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const maybeCtx = canvas.getContext("2d");
    if (!maybeCtx) return;
    const ctx: CanvasRenderingContext2D = maybeCtx;
    let raf = 0;

    function frame() {
      let flightProgressX: number | null = null;
      let flightProgressY: number | null = null;
      const meta = runMetaRef.current;

      if (phase === "flying" && meta) {
        const elapsedMs = performance.now() - flightStartRef.current;

        if (meta.kind === "projectile") {
          // t maps the presentation clock (0..durationMs) onto the real
          // flight timeline (0..flightTimeSeconds) - at t=1 the projectile
          // is exactly at its physical landing point, never short of it.
          const t = Math.min(elapsedMs / meta.durationMs, 1);
          const pos = projectilePositionAt(meta.speed, meta.gravity, t * meta.flightTimeSeconds);
          flightProgressX = pos.x;
          flightProgressY = pos.y;
        }

        // The physical simulation itself declares completion: only once
        // elapsed time reaches the run's real physics-derived duration
        // (never a fixed/arbitrary timer) do we allow finishAttempt to run.
        // Guarded so it can only fire once per run, and delayed by a short
        // cosmetic settle beat (the object is already at rest by then -
        // progress is clamped to 1 above) rather than gating anything.
        if (!completionHandledRef.current && elapsedMs >= meta.durationMs) {
          completionHandledRef.current = true;
          window.setTimeout(() => {
            if (meta.kind === "projectile") {
              const landed = projectilePositionAt(meta.speed, meta.gravity, meta.flightTimeSeconds).x;
              setLandingDistance(landed);
              finishAttempt(landed, meta.responseTime, meta.submittedValue);
            } else {
              finishAttempt(meta.predicted, meta.responseTime, meta.submittedValue);
            }
          }, SETTLE_MS);
        }
      }

      drawScene(ctx, CANVAS_W, CANVAS_H, {
        challenge,
        controlValue: safeControlValue,
        phase,
        flightX: flightProgressX,
        flightY: flightProgressY,
        landingDistance,
        predicted: predictedValue(challenge, safeControlValue),
        target: targetValueOf(challenge),
        runStartedAt: phase === "flying" ? flightStartRef.current : null,
        runDurationMs: meta?.durationMs ?? null,
        reducedMotion: reducedMotionRef.current,
      });
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge, safeControlValue, phase, landingDistance]);

  const engine = engineRef.current;

  const runElapsedMs = phase === "flying" ? performance.now() - flightStartRef.current : 0;
  const runDurationMs = runMetaRef.current?.durationMs ?? RUN_DURATION_MS;
  const runPhase = experimentPhaseAt(runElapsedMs, runDurationMs);
  const runningReadout =
    phase === "flying" && challenge.moduleId !== MODULE_PROJECTILE ? runningReadoutFor(challenge, safeControlValue, runPhase.progress, runDurationMs) : null;
  // The physical endpoint has been reached but the result hasn't appeared
  // yet (still inside the short settle beat) - label the HUD accordingly
  // instead of leaving it reading "Running" over an object that has already
  // stopped moving.
  const runLabel = runPhase.phase === "complete" ? "Experiment Complete" : "Experiment Running";

  return (
    <div ref={wrapperRef} className={isFullscreen ? "flex h-screen w-screen items-center justify-center bg-black" : "block w-full"}>
      <div
        className={
          isFullscreen
            ? "relative h-full w-full overflow-hidden bg-sky-900"
            : "relative w-full overflow-hidden rounded-2xl border-2 border-purple/20 bg-sky-900 shadow-xl"
        }
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className={isFullscreen ? "block h-full w-full object-contain" : "block h-auto w-full"}
        />

        {fullscreenSupported && (
          <button
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            className="pointer-events-auto absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-lg font-bold text-ink shadow-lg hover:bg-white"
          >
            ⛶
          </button>
        )}

        <HowToPlay challenge={challenge} belowFullscreenButton={fullscreenSupported} />

        {runningReadout && (
          <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-2xl border-2 border-cyan/60 bg-white/95 px-4 py-2 text-center shadow-lg">
            <p className="text-[10px] font-bold tracking-widest text-cyan uppercase">{runLabel}</p>
            <div className="mt-1 flex gap-4">
              {runningReadout.lines.map((l) => (
                <div key={l.label}>
                  <p className="text-[9px] font-bold text-ink-muted uppercase">{l.label}</p>
                  <p className="font-display text-sm font-extrabold text-ink">{l.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* HUD overlay - what's GIVEN, not what you're solving for */}
        <div className="pointer-events-none absolute left-4 top-4 z-10 max-w-[270px] rounded-2xl border-2 border-gold/70 bg-white/95 p-4 shadow-lg">
        <p className="text-[10px] font-bold tracking-widest text-purple uppercase">{MODULE_TITLES[challenge.moduleId]}</p>
        <p className="font-display text-base font-extrabold text-ink">{challenge.conceptTitle}</p>
        <div className="mt-2 space-y-1 text-xs">
          {givenFieldsFor(challenge).map((f) => (
            <div key={f.label} className="flex items-center justify-between gap-3">
              <span className="text-ink-muted">{f.label}</span>
              <span className="font-display font-bold text-gold-dark">{f.value}</span>
            </div>
          ))}
        </div>
        {challenge.conceptId === CONCEPT_WORK_ENERGY_THEOREM && (
          <p className="mt-2 text-[11px] font-semibold text-purple">
            {(challenge.initialVelocity ?? 0).toFixed(1)} m/s → work {safeControlValue.toFixed(0)} J → final{" "}
            {finalVelocityFromWork(challenge, safeControlValue).toFixed(1)} m/s
          </p>
        )}
        <div className="mt-2">
          <p className="text-[10px] font-bold text-ink-muted uppercase">Mastery</p>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-black/10">
            <div
              className="h-full rounded-full bg-blue transition-all duration-500 ease-out"
              style={{ width: `${engine.conceptMastery[challenge.conceptId] * 100}%` }}
            />
          </div>
        </div>
        <p className="mt-2 text-[11px] font-semibold text-ink-muted">
          {challenge.difficulty} · Attempt {attempts}
        </p>
      </div>

      {/* Solve-and-submit control: numeric input is the primary interaction.
          w-[calc(100%-2rem)]/max-w-md caps this row to the canvas card's own
          width (minus its side margin) at every viewport, and flex-wrap on
          the panel below lets RUN EXPERIMENT's wide label drop to its own
          line instead of forcing the row past the card's edge - the panel
          grows taller, never wider than its card, so the button can never
          render outside it. */}
      <div className="pointer-events-auto absolute bottom-4 left-1/2 z-10 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 flex-col items-center gap-1.5">
        <div className="flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full border-2 border-border bg-white/95 px-3 py-2 shadow-lg">
          <button
            onClick={() => adjust(-1)}
            disabled={phase !== "playing"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-lavender text-lg font-bold text-purple hover:bg-purple hover:text-white disabled:opacity-40"
            aria-label="Decrease"
          >
            −
          </button>
          <label className="flex flex-col items-center px-1">
            <span className="text-[9px] font-bold tracking-widest text-ink-muted uppercase">{inputLabelFor(challenge)}</span>
            <input
              type="text"
              inputMode="decimal"
              value={controlText}
              disabled={phase !== "playing"}
              onChange={(e) => {
                setControlText(e.target.value);
                setInputError(null);
              }}
              placeholder="?"
              className="w-24 rounded-lg border border-border bg-surface-lavender/40 px-2 py-0.5 text-center font-display text-base font-extrabold text-ink outline-none focus:border-purple disabled:opacity-60"
            />
          </label>
          <button
            onClick={() => adjust(1)}
            disabled={phase !== "playing"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-lavender text-lg font-bold text-purple hover:bg-purple hover:text-white disabled:opacity-40"
            aria-label="Increase"
          >
            +
          </button>
          <button
            onClick={confirm}
            disabled={phase !== "playing"}
            className="gradient-purple-blue shrink-0 rounded-full px-5 py-2 text-sm font-bold text-white disabled:opacity-40"
          >
            {actionLabelFor(challenge)}
          </button>
        </div>
        {inputError ? (
          <p className="rounded-full bg-white/95 px-3 py-1 text-[11px] font-bold text-red shadow">{inputError}</p>
        ) : (
          <p className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold text-ink-muted shadow-sm">
            Type your answer · ↑ / ↓ adjust · Enter to submit
          </p>
        )}
      </div>

        {/* Result overlay */}
        {(phase === "result" || phase === "transition") && result && phase === "result" && (
          <ResultOverlay result={result} aiInsight={aiInsight} />
        )}

        {phase === "transition" && transitionInfo && <TransitionOverlay info={transitionInfo} />}
      </div>
    </div>
  );
}

function ResultOverlay({
  result,
  aiInsight,
}: {
  result: {
    success: boolean;
    targetText: string;
    actualText: string;
    errorText: string;
    performancePct: number;
    masteryBefore: number;
    masteryAfter: number;
    physicsInsight: string;
    extraRows: ResultExtraRow[] | null;
  };
  aiInsight: AiInsightState;
}) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 p-6" style={{ animation: "fadeIn 0.2s ease-out" }}>
      <div className="w-full max-w-sm rounded-3xl border-2 border-gold/60 bg-white p-6 shadow-2xl" style={{ animation: "popIn 0.25s ease-out" }}>
        <h3 className={`text-center font-display text-xl font-extrabold ${result.success ? "text-green" : "text-red"}`}>
          {result.success ? "✓ Experiment Complete" : "Not Quite — Recalculate"}
        </h3>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[10px] font-bold text-ink-muted uppercase">Target</p>
            <p className="font-display text-base font-bold text-gold-dark">{result.targetText}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-ink-muted uppercase">Actual</p>
            <p className="font-display text-base font-bold text-blue">{result.actualText}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-ink-muted uppercase">Error</p>
            <p className="font-display text-base font-bold text-ink">{result.errorText}</p>
          </div>
        </div>
        <p className="mt-3 text-center text-sm font-semibold text-ink">
          Performance: {result.performancePct}% · Mastery: {Math.round(result.masteryBefore * 100)}% → {Math.round(result.masteryAfter * 100)}%
        </p>
        <p className="mt-3 text-center text-xs text-ink-muted">{result.physicsInsight}</p>

        {result.extraRows && (
          <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-surface-lavender/50 p-2 text-center sm:grid-cols-3">
            {result.extraRows.map((row) => (
              <div key={row.label}>
                <p className="text-[9px] font-bold text-ink-muted uppercase">{row.label}</p>
                <p className="font-display text-sm font-bold text-purple">{row.value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 rounded-2xl border border-purple/20 bg-surface-lavender/50 p-3">
          <p className="text-[10px] font-bold tracking-widest text-purple uppercase">✦ Nexus AI Learning Insight</p>
          {aiInsight.status === "loading" && <p className="mt-1 text-xs text-ink-muted">Generating learning insight…</p>}
          {aiInsight.status === "ready" && (
            <>
              <p className="mt-1 text-sm font-bold text-ink">{aiInsight.headline}</p>
              <p className="mt-1 text-xs text-ink-muted">{aiInsight.explanation}</p>
              <p className="mt-1 text-xs font-semibold text-purple">→ {aiInsight.suggestion}</p>
            </>
          )}
          {aiInsight.status === "error" && <p className="mt-1 text-xs text-ink-muted">Insight unavailable this time.</p>}
        </div>
      </div>
    </div>
  );
}

function TransitionOverlay({ info }: { info: { from: string; to: string } }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50">
      <div className="rounded-3xl border-2 border-gold bg-white px-8 py-6 text-center shadow-2xl" style={{ animation: "popIn 0.3s ease-out" }}>
        <p className="text-xs font-bold tracking-widest text-ink-muted uppercase">Module Mastered</p>
        <p className="font-display text-lg font-bold text-ink">{info.from}</p>
        <p className="my-1 text-2xl text-gold-dark">↓</p>
        <p className="text-xs font-bold tracking-widest text-ink-muted uppercase">New Experiment Unlocked</p>
        <p className="font-display text-2xl font-extrabold text-purple">{info.to}</p>
      </div>
    </div>
  );
}

