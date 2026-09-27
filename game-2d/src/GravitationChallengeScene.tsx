"use client";

// --------------------------------------------------------------------------
// Gravitation & Orbits - Layer 4 built the launch/reset gameplay loop; Layer
// 5 wired completed attempts into the existing AdaptiveEngine; Layer 6 is
// educational-UX polish only - no new physics, no new correctness rule, no
// new mastery formula. All decision-making still lives in pure, tested
// modules - gravitationChallenge.ts (challenge -> sim setup, READY/RUNNING/
// OUTCOME state, presentational text helpers) and gravitationLearning.ts
// (completed attempt -> AdaptiveEngine update + LearningEvent). This
// component only wires those to React state and renders NEXUS-styled
// markup - the dark canvas (GravitationScene) is the one deliberate
// exception to NEXUS's light/premium chrome, representing space itself.
//
// Deliberately not wired into GameCanvas.tsx: MODULE_GRAVITATION is not in
// MODULE_SEQUENCE and Gravitation is not available in the curriculum, so
// this remains a standalone route/demo component.
// --------------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState } from "react";
import { AdaptiveEngine, MODULE_GRAVITATION, CONCEPT_GRAVITATIONAL_FORCE, type Challenge } from "./adaptiveEngine";
import { GRAVITY_SIM_G, orbitalVelocity, escapeVelocity } from "./physics";
import type { GravitationSimStatus, GravitationSimState } from "./gravitationSim";
import GravitationScene from "./GravitationScene";
import HowToPlay from "./HowToPlay";
import {
  gravitationSimSetupFor,
  createGravitationPlayState,
  setGravitationVelocity,
  launchGravitationAttempt,
  applyGravitationSimStatus,
  resetGravitationAttempt,
  areGravitationControlsLocked,
  gravitationOutcomeExplanation,
  gravitationUnsupportedPlayerMessage,
  velocitySliderPercent,
} from "./gravitationChallenge";
import { recordGravitationAttempt, type GravitationAttemptResult } from "./gravitationLearning";

const TERMINAL_OUTCOMES = ["collision", "orbit", "escape"] as const;
type TerminalOutcome = (typeof TERMINAL_OUTCOMES)[number];

function isTerminalOutcome(status: GravitationSimStatus): status is TerminalOutcome {
  return (TERMINAL_OUTCOMES as readonly string[]).includes(status);
}

// Same pattern as GameCanvas.tsx's own newSessionId() - a per-session id
// generated once per mount, not persisted anywhere.
function newGravitationSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `gravitation-session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function trajectoryRadiusExtent(state: GravitationSimState): { minRadius: number; maxRadius: number } {
  let minRadius = Math.hypot(state.planetX, state.planetY);
  let maxRadius = minRadius;
  for (const point of state.trajectory) {
    const r = Math.hypot(point.x, point.y);
    minRadius = Math.min(minRadius, r);
    maxRadius = Math.max(maxRadius, r);
  }
  return { minRadius, maxRadius };
}

// A small, self-contained formula reference - mirrors the visual vocabulary
// of web-2d's ConceptLessonPanel (gradient "FORMULA" block + symbol chips)
// without depending on shared/src/curriculum.ts's ConceptInfo/available
// flag, since gravitation's curriculum entry stays unavailable. Only the
// three formulas the simulation actually uses - no unrelated abstractions.
function GravitationFormulaCard() {
  const formulas = [
    { label: "Gravitational Force", formula: "F = GMm / r²" },
    { label: "Orbital Velocity", formula: "v = √(GM / r)" },
    { label: "Escape Velocity", formula: "v = √(2GM / r)" },
  ];
  const variables = [
    { symbol: "G", meaning: "gravitational constant" },
    { symbol: "M", meaning: "star mass" },
    { symbol: "m", meaning: "planet mass" },
    { symbol: "r", meaning: "distance from star" },
    { symbol: "v", meaning: "velocity" },
  ];

  return (
    <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
      <p className="text-[10px] font-bold tracking-widest text-ink-muted uppercase">Formulas</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {formulas.map((f) => (
          <div key={f.label} className="rounded-2xl bg-gradient-to-br from-blue to-purple p-3 text-center shadow-sm">
            <p className="text-[9px] font-bold tracking-widest text-white/80 uppercase">{f.label}</p>
            <p className="mt-1 font-display text-base font-extrabold text-white">{f.formula}</p>
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

export default function GravitationChallengeScene() {
  // One AdaptiveEngine instance for the lifetime of this component, exactly
  // as GameCanvas.tsx owns one for the five live modules - never recreated,
  // never mutated from outside gravitationLearning.ts.
  const [engine] = useState(() => new AdaptiveEngine(MODULE_GRAVITATION));
  const [challenge, setChallenge] = useState<Challenge>(() => engine.generateNextChallenge());
  const setup = useMemo(() => gravitationSimSetupFor(challenge), [challenge]);
  const [playState, setPlayState] = useState(() => createGravitationPlayState(setup));
  const [attemptResult, setAttemptResult] = useState<GravitationAttemptResult | null>(null);

  const sessionIdRef = useRef(newGravitationSessionId());
  const attemptNumberRef = useRef(0);
  // Decision time (READY shown -> Launch clicked) - the same quantity
  // GameCanvas.tsx measures as "responseTime" for the five live modules.
  // Captured at Launch, read back once the simulation reaches a terminal
  // status, so a physically long orbit demonstration never inflates it.
  const readyShownAtRef = useRef(performance.now());
  const pendingResponseTimeRef = useRef(0);

  // A new challenge (from this component's own engine, after a completed
  // attempt) starts a fresh READY state for its own setup.
  useEffect(() => {
    setPlayState(createGravitationPlayState(setup));
    setAttemptResult(null);
    readyShownAtRef.current = performance.now();
  }, [setup]);

  const controlsLocked = areGravitationControlsLocked(playState);
  const isGravitationalForce = challenge.conceptId === CONCEPT_GRAVITATIONAL_FORCE;

  // Reference velocities for the slider's own markers and the outcome
  // feedback - always derivable from setup.starMass/orbitalRadius via the
  // same physics.ts formulas the adaptive engine itself used, regardless of
  // which field a given tier happened to hide.
  const vOrbit = useMemo(() => orbitalVelocity(GRAVITY_SIM_G, setup.starMass, setup.orbitalRadius), [setup]);
  const vEscape = useMemo(() => escapeVelocity(GRAVITY_SIM_G, setup.starMass, setup.orbitalRadius), [setup]);

  function handleLaunch() {
    pendingResponseTimeRef.current = (performance.now() - readyShownAtRef.current) / 1000;
    setPlayState((prev) => launchGravitationAttempt(prev));
  }

  function handleReset() {
    setPlayState((prev) => resetGravitationAttempt(prev, setup));
    setAttemptResult(null);
    readyShownAtRef.current = performance.now();
  }

  function handleStatusChange(status: GravitationSimStatus, state: GravitationSimState) {
    setPlayState((prev) => applyGravitationSimStatus(prev, status));
    if (!isTerminalOutcome(status)) return;

    attemptNumberRef.current += 1;
    const { minRadius, maxRadius } = trajectoryRadiusExtent(state);
    const result = recordGravitationAttempt(engine, {
      challenge,
      setup,
      launchVelocity: playState.velocity,
      outcomeStatus: status,
      elapsedSimTime: state.elapsedTime,
      minRadius,
      maxRadius,
      responseTimeSeconds: pendingResponseTimeRef.current,
      sessionId: sessionIdRef.current,
      attemptNumber: attemptNumberRef.current,
    });
    setAttemptResult(result);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-bold tracking-widest text-purple uppercase">
            {challenge.conceptTitle} &middot; {challenge.difficulty}
          </p>
          {isGravitationalForce && (
            <span className="rounded-full bg-gold/10 px-3 py-1 text-[10px] font-bold tracking-wide text-gold-dark uppercase">Exploration only</span>
          )}
        </div>
        <p className="mt-1.5 text-sm font-semibold text-ink">{setup.promptLabel}</p>
        <p className="mt-2 text-xs text-ink-muted">
          Star mass {setup.starMass.toFixed(1)} &middot; Starting radius {setup.orbitalRadius.toFixed(2)}
          {!isGravitationalForce && (
            <>
              {" "}
              &middot; Target {setup.targetValue} {setup.targetUnit}
            </>
          )}
        </p>
      </div>

      <div className="relative overflow-hidden rounded-3xl border-2 border-purple/20 bg-sky-900 shadow-xl">
        <GravitationScene
          starMass={setup.starMass}
          orbitalRadius={setup.orbitalRadius}
          initialVelocity={playState.velocity}
          launched={playState.phase !== "READY"}
          attemptId={playState.attemptId}
          onStatusChange={handleStatusChange}
        />
        <HowToPlay challenge={challenge} belowFullscreenButton={false} />
      </div>

      <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <label htmlFor="gravitation-velocity" className="text-xs font-bold tracking-widest text-ink-muted uppercase">
            Initial velocity
          </label>
          <span className="font-display text-lg font-extrabold text-ink">{playState.velocity.toFixed(2)} m/s</span>
        </div>

        <div className="relative mt-3">
          <input
            id="gravitation-velocity"
            type="range"
            min={setup.minVelocity}
            max={setup.maxVelocity}
            step={0.01}
            value={playState.velocity}
            disabled={controlsLocked}
            onChange={(e) => setPlayState((prev) => setGravitationVelocity(prev, Number(e.target.value)))}
            className="w-full accent-purple disabled:opacity-50"
          />
          <div className="pointer-events-none relative mt-1 h-8 w-full text-[9px] font-bold uppercase">
            <span
              className="absolute -translate-x-1/2 text-blue-dark"
              style={{ left: `${velocitySliderPercent(setup.minVelocity, setup.maxVelocity, vOrbit)}%` }}
            >
              &#9650;
              <br />
              orbit
            </span>
            <span
              className="absolute -translate-x-1/2 text-gold-dark"
              style={{ left: `${velocitySliderPercent(setup.minVelocity, setup.maxVelocity, vEscape)}%` }}
            >
              &#9650;
              <br />
              escape
            </span>
          </div>
        </div>
        <p className="mt-1 text-[11px] text-ink-muted">
          Orbital velocity &asymp; {vOrbit.toFixed(2)} m/s &middot; Escape velocity &asymp; {vEscape.toFixed(2)} m/s
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={playState.phase !== "READY"}
            onClick={handleLaunch}
            className="gradient-purple-blue inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold text-white shadow-lg transition hover:opacity-90 disabled:pointer-events-none disabled:opacity-40"
          >
            Launch
          </button>
          <button
            type="button"
            disabled={playState.phase !== "OUTCOME"}
            onClick={handleReset}
            className="inline-flex items-center justify-center rounded-full border border-border bg-white px-6 py-2.5 text-sm font-bold text-ink transition hover:bg-surface-lavender/60 disabled:pointer-events-none disabled:opacity-40"
          >
            Reset
          </button>
          {playState.phase === "OUTCOME" && playState.outcomeStatus && isTerminalOutcome(playState.outcomeStatus) && (
            <span className="text-sm font-semibold text-ink">{gravitationOutcomeExplanation(playState.outcomeStatus)}</span>
          )}
        </div>
      </div>

      {attemptResult && (
        <div className="rounded-3xl border border-border bg-white p-5 shadow-sm">
          {attemptResult.supported ? (
            <>
              <p className={`text-sm font-bold ${attemptResult.success ? "text-green" : "text-red"}`}>
                {attemptResult.success ? "Success for this challenge." : "Not what this challenge asked for."}
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                Selected velocity {playState.velocity.toFixed(2)} m/s &middot; Orbital {vOrbit.toFixed(2)} m/s &middot; Escape {vEscape.toFixed(2)} m/s
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                Mastery: {(attemptResult.masteryBefore * 100).toFixed(0)}% &rarr; {(attemptResult.masteryAfter * 100).toFixed(0)}%
              </p>
              <p className="mt-1 text-xs text-ink-muted">{attemptResult.adaptationNote}</p>
              <button
                type="button"
                onClick={() => setChallenge(attemptResult.nextChallenge)}
                className="mt-3 inline-flex items-center justify-center gap-2 rounded-full border border-border bg-surface-lavender/60 px-5 py-2 text-sm font-bold text-ink transition hover:bg-surface-lavender"
              >
                Next Challenge: {attemptResult.nextChallenge.conceptTitle}
              </button>
            </>
          ) : (
            <p className="text-sm text-ink-muted">{gravitationUnsupportedPlayerMessage()}</p>
          )}
        </div>
      )}

      <GravitationFormulaCard />
    </div>
  );
}
