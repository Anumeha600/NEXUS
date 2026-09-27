"use client";

// --------------------------------------------------------------------------
// Gravitation & Orbits - Layer 4 built the launch/reset gameplay loop; Layer
// 5 wires its completed attempts into the existing AdaptiveEngine. All of
// the actual decision-making still lives in pure, tested modules -
// gravitationChallenge.ts (challenge -> sim setup, READY/RUNNING/OUTCOME
// state) and gravitationLearning.ts (completed attempt -> AdaptiveEngine
// update + LearningEvent). This component only wires those to React state,
// owns the AdaptiveEngine instance (exactly like GameCanvas.tsx owns its own
// `engineRef` for the five live modules), and renders minimal feedback -
// never a second mastery/correctness computation.
//
// Deliberately not wired into GameCanvas.tsx: MODULE_GRAVITATION is not in
// MODULE_SEQUENCE and Gravitation is not available in the curriculum, so
// this remains a standalone route/demo component.
// --------------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState } from "react";
import { AdaptiveEngine, MODULE_GRAVITATION, type Challenge } from "./adaptiveEngine";
import type { GravitationSimStatus, GravitationSimState } from "./gravitationSim";
import GravitationScene from "./GravitationScene";
import {
  gravitationSimSetupFor,
  createGravitationPlayState,
  setGravitationVelocity,
  launchGravitationAttempt,
  applyGravitationSimStatus,
  resetGravitationAttempt,
  areGravitationControlsLocked,
} from "./gravitationChallenge";
import { recordGravitationAttempt, type GravitationAttemptResult } from "./gravitationLearning";

const OUTCOME_MESSAGE: Record<Exclude<GravitationSimStatus, "idle" | "running" | "stopped">, string> = {
  orbit: "Stable orbit achieved.",
  collision: "The planet fell into the star.",
  escape: "The planet escaped the star's gravity.",
};

const TERMINAL_STATUSES: ReadonlySet<GravitationSimStatus> = new Set(["collision", "orbit", "escape"]);

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
    if (!TERMINAL_STATUSES.has(status)) return;

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
    <div className="flex flex-col gap-3">
      <div className="rounded-xl bg-black/30 p-3 text-sm text-white">
        <p className="font-semibold">{setup.promptLabel}</p>
        <p className="mt-1 text-white/70">
          Star mass: {setup.starMass.toFixed(1)} &middot; Orbital radius: {setup.orbitalRadius.toFixed(2)} &middot; Target: {setup.targetValue}{" "}
          {setup.targetUnit}
        </p>
      </div>

      <GravitationScene
        starMass={setup.starMass}
        orbitalRadius={setup.orbitalRadius}
        initialVelocity={playState.velocity}
        launched={playState.phase !== "READY"}
        attemptId={playState.attemptId}
        onStatusChange={handleStatusChange}
      />

      <div className="flex flex-wrap items-center gap-3 text-sm text-white">
        <label className="flex items-center gap-2">
          Initial velocity:
          <input
            type="range"
            min={setup.minVelocity}
            max={setup.maxVelocity}
            step={0.01}
            value={playState.velocity}
            disabled={controlsLocked}
            onChange={(e) => setPlayState((prev) => setGravitationVelocity(prev, Number(e.target.value)))}
          />
          <span>{playState.velocity.toFixed(2)} m/s</span>
        </label>

        <button type="button" disabled={playState.phase !== "READY"} onClick={handleLaunch}>
          Launch
        </button>

        <button type="button" disabled={playState.phase !== "OUTCOME"} onClick={handleReset}>
          Reset
        </button>

        {playState.phase === "OUTCOME" && playState.outcomeStatus && playState.outcomeStatus in OUTCOME_MESSAGE && (
          <span className="font-semibold">{OUTCOME_MESSAGE[playState.outcomeStatus as keyof typeof OUTCOME_MESSAGE]}</span>
        )}
      </div>

      {attemptResult && (
        <div className="rounded-xl bg-black/30 p-3 text-sm text-white">
          {attemptResult.supported ? (
            <>
              <p>{attemptResult.success ? "Correct for this challenge." : "Not what this challenge asked for."}</p>
              <p className="text-white/70">
                Mastery: {(attemptResult.masteryBefore * 100).toFixed(0)}% &rarr; {(attemptResult.masteryAfter * 100).toFixed(0)}% &middot;
                Performance: {(attemptResult.performance * 100).toFixed(0)}%
              </p>
              <p className="text-white/70">{attemptResult.adaptationNote}</p>
              <button type="button" className="mt-1" onClick={() => setChallenge(attemptResult.nextChallenge)}>
                Next Challenge ({attemptResult.nextChallenge.conceptTitle})
              </button>
            </>
          ) : (
            <p className="text-white/70">Not scored: {attemptResult.reason}</p>
          )}
        </div>
      )}
    </div>
  );
}
