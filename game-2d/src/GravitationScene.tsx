"use client";

// --------------------------------------------------------------------------
// Gravitation & Orbits - Layer 3: a standalone, reusable visual demo of the
// Layer 2 simulation. Deliberately NOT wired into GameCanvas.tsx or the
// challenge flow - it owns its own canvas and its own requestAnimationFrame
// loop, exactly like GameCanvas.tsx does for the five live modules, but as a
// fully separate component so nothing here can affect adaptive mastery,
// progression, or the existing modules.
// --------------------------------------------------------------------------

import { useEffect, useRef } from "react";
import { createGravitationSimState, advanceGravitationSim, type GravitationSimState } from "./gravitationSim";
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
  width?: number;
  height?: number;
}

export default function GravitationScene({ starMass, orbitalRadius, initialVelocity, width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT }: GravitationSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef<GravitationSimState>(createGravitationSimState({ starMass, orbitalRadius, initialVelocity }));

  // A prop change starts a fresh run with the new initial conditions - this
  // component is a visual demo/preview, not a controlled replay surface.
  useEffect(() => {
    stateRef.current = createGravitationSimState({ starMass, orbitalRadius, initialVelocity });
  }, [starMass, orbitalRadius, initialVelocity]);

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
      stateRef.current = advanceGravitationSim(stateRef.current, dt);
      drawGravitationScene(ctx as CanvasRenderingContext2D, width, height, stateRef.current);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [width, height]);

  return <canvas ref={canvasRef} width={width} height={height} className="block h-auto w-full rounded-2xl" />;
}
