"use client";

// --------------------------------------------------------------------------
// Gravitation & Orbits - Layer 3 standalone visual demo, extended in Layer 4
// to be drivable by an external launch/reset controller (see
// gravitationChallenge.ts) while still working exactly as before on its own
// (launched defaults to true) - still NOT wired into GameCanvas.tsx or the
// challenge flow; it owns its own canvas and requestAnimationFrame loop
// exactly like GameCanvas.tsx does for the five live modules, but as a fully
// separate component so nothing here can affect adaptive mastery,
// progression, or the existing modules.
// --------------------------------------------------------------------------

import { useEffect, useRef } from "react";
import { createGravitationSimState, advanceGravitationSim, type GravitationSimState, type GravitationSimStatus } from "./gravitationSim";
import { drawGravitationScene } from "./gravitationRender";

const DEFAULT_WIDTH = 720;
const DEFAULT_HEIGHT = 480;
// Matches the frame-delta clamp render.ts's own drawScene uses (anim dt) -
// caps a single rAF frame's real-time delta so a dropped/backgrounded frame
// can't feed a huge dt into advanceGravitationSim in one go.
const MAX_FRAME_DELTA_SECONDS = 0.05;

export interface GravitationSceneProps {
  starMass: number;
  orbitalRadius: number;
  initialVelocity: number;
  // Whether the simulation should advance - false keeps it parked at its
  // initial (idle) state, still drawn every frame. Defaults to true so this
  // component keeps working unchanged as a standalone always-running demo.
  launched?: boolean;
  // Bump this to force a fresh run with the same starMass/orbitalRadius/
  // initialVelocity (e.g. a "retry" with an unchanged velocity) - a plain
  // prop change to those three values already reseeds on its own.
  attemptId?: number;
  // Fires whenever gravitationSim.ts's own status changes - never a second
  // outcome classification, just surfacing the simulation's existing status
  // to whatever is controlling this component.
  onStatusChange?: (status: GravitationSimStatus) => void;
  width?: number;
  height?: number;
}

export default function GravitationScene({
  starMass,
  orbitalRadius,
  initialVelocity,
  launched = true,
  attemptId = 0,
  onStatusChange,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
}: GravitationSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GravitationSimState>(createGravitationSimState({ starMass, orbitalRadius, initialVelocity }));
  const lastReportedStatusRef = useRef<GravitationSimStatus | null>(null);
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  // A change to the initial conditions, or an explicit attemptId bump (a
  // retry with the same velocity), starts a fresh run.
  useEffect(() => {
    stateRef.current = createGravitationSimState({ starMass, orbitalRadius, initialVelocity });
    lastReportedStatusRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [starMass, orbitalRadius, initialVelocity, attemptId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let lastTime = 0;

    function frame(now: number) {
      const dt = lastTime ? Math.min((now - lastTime) / 1000, MAX_FRAME_DELTA_SECONDS) : 0;
      lastTime = now;
      if (launched) {
        stateRef.current = advanceGravitationSim(stateRef.current, dt);
      }
      if (stateRef.current.status !== lastReportedStatusRef.current) {
        lastReportedStatusRef.current = stateRef.current.status;
        onStatusChangeRef.current?.(stateRef.current.status);
      }
      drawGravitationScene(ctx as CanvasRenderingContext2D, width, height, stateRef.current);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [width, height, launched]);

  return <canvas ref={canvasRef} width={width} height={height} className="block h-auto w-full rounded-2xl" />;
}
