"use client";

// --------------------------------------------------------------------------
// Gravitation & Orbits - Layer 4: the thin "UI/controller" from the layer's
// architecture brief. All of the actual logic lives in gravitationChallenge.ts
// (pure, tested) - this component only wires that logic to React state and
// to GravitationScene's props. It takes an already-generated Challenge (from
// `new AdaptiveEngine(MODULE_GRAVITATION)`, exactly like every other module
// uses AdaptiveEngine) as a prop; it does not create the engine, record
// attempts, or touch mastery/progression - that is explicitly out of scope
// for this layer.
//
// Deliberately not wired into GameCanvas.tsx: MODULE_GRAVITATION is not in
// MODULE_SEQUENCE and Gravitation is not available in the curriculum, so
// this remains a standalone route/demo component, per the Layer 4 brief.
// --------------------------------------------------------------------------

import { useEffect, useMemo, useState } from "react";
import type { Challenge } from "./adaptiveEngine";
import type { GravitationSimStatus } from "./gravitationSim";
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

const OUTCOME_MESSAGE: Record<Exclude<GravitationSimStatus, "idle" | "running" | "stopped">, string> = {
  orbit: "Stable orbit achieved.",
  collision: "The planet fell into the star.",
  escape: "The planet escaped the star's gravity.",
};

export default function GravitationChallengeScene({ challenge }: { challenge: Challenge }) {
  const setup = useMemo(() => gravitationSimSetupFor(challenge), [challenge]);
  const [playState, setPlayState] = useState(() => createGravitationPlayState(setup));

  // A new challenge (e.g. the caller advanced to the next one) starts a
  // fresh READY state for its own setup.
  useEffect(() => {
    setPlayState(createGravitationPlayState(setup));
  }, [setup]);

  const controlsLocked = areGravitationControlsLocked(playState);

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
        onStatusChange={(status) => setPlayState((prev) => applyGravitationSimStatus(prev, status))}
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

        <button
          type="button"
          disabled={playState.phase !== "READY"}
          onClick={() => setPlayState((prev) => launchGravitationAttempt(prev))}
        >
          Launch
        </button>

        <button type="button" disabled={playState.phase !== "OUTCOME"} onClick={() => setPlayState((prev) => resetGravitationAttempt(prev, setup))}>
          Reset
        </button>

        {playState.phase === "OUTCOME" && playState.outcomeStatus && playState.outcomeStatus in OUTCOME_MESSAGE && (
          <span className="font-semibold">{OUTCOME_MESSAGE[playState.outcomeStatus as keyof typeof OUTCOME_MESSAGE]}</span>
        )}
      </div>
    </div>
  );
}
