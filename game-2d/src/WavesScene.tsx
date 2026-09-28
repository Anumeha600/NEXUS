"use client";

// --------------------------------------------------------------------------
// Wave Motion - the standalone visual demo, mirroring GravitationScene.tsx's
// own shape: owns its own canvas and requestAnimationFrame loop, advances a
// deterministic time-based simulation (elapsed seconds), and hands every
// frame's numbers straight to wavesRender.ts. Not wired into GameCanvas.tsx
// or any existing module - a fully separate component, per this phase's
// scope (Play Hub / product integration is Phase 2+).
//
// There is no fixed-timestep accumulator here (unlike gravitationSim.ts's
// ODE integration) because wave displacement is a closed-form function of
// elapsed time - y(x,t) is evaluated fresh every frame from the real
// requestAnimationFrame clock, so animation speed is never a hidden,
// separately-tuned constant. Changing frequency/wavelength/wave speed
// changes what that same clock produces, nothing else.
// --------------------------------------------------------------------------

import { useEffect, useRef } from "react";
import { drawWaveScene, drawSuperpositionScene } from "./wavesRender";
import type { WaveParams } from "./wavesPhysics";

const DEFAULT_WIDTH = 720;
const DEFAULT_HEIGHT = 340;
// Matches render.ts/GravitationScene.tsx's own frame-delta clamp - caps a
// single rAF frame's real-time delta so a dropped/backgrounded frame can't
// jump the animation forward in one visible leap.
const MAX_FRAME_DELTA_SECONDS = 0.05;

export interface WavesSceneProps {
  wave: WaveParams;
  // When set, renders both this wave and `wave` as two overlapping
  // component waves plus their resultant (superposition mode), instead of
  // the single traveling wave.
  wave2?: WaveParams;
  mediumLengthMeters?: number;
  // The vertical scale is fixed to this regardless of the current
  // amplitude, so turning the amplitude control up/down rescales the visible
  // wave rather than resizing the whole viewport under the player.
  maxAmplitude?: number;
  // Freezes elapsed time at 0 - used for a static "before you launch" frame.
  running?: boolean;
  showMarkers?: boolean;
  showParticle?: boolean;
  width?: number;
  height?: number;
}

export default function WavesScene({
  wave,
  wave2,
  mediumLengthMeters = 6,
  maxAmplitude = 2.5,
  running = true,
  showMarkers = true,
  showParticle = true,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
}: WavesSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const elapsedRef = useRef(0);
  const propsRef = useRef({ wave, wave2, mediumLengthMeters, maxAmplitude, running, showMarkers, showParticle });
  propsRef.current = { wave, wave2, mediumLengthMeters, maxAmplitude, running, showMarkers, showParticle };

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
      const p = propsRef.current;
      if (p.running) {
        elapsedRef.current += dt;
      }

      if (p.wave2) {
        drawSuperpositionScene(ctx as CanvasRenderingContext2D, width, height, {
          wave1: p.wave,
          wave2: p.wave2,
          t: elapsedRef.current,
          mediumLengthMeters: p.mediumLengthMeters,
          maxAmplitude: p.maxAmplitude,
        });
      } else {
        drawWaveScene(ctx as CanvasRenderingContext2D, width, height, {
          wave: p.wave,
          t: elapsedRef.current,
          mediumLengthMeters: p.mediumLengthMeters,
          maxAmplitude: p.maxAmplitude,
          showMarkers: p.showMarkers,
          showParticle: p.showParticle,
        });
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [width, height]);

  return <canvas ref={canvasRef} width={width} height={height} className="block h-auto w-full rounded-2xl" />;
}
