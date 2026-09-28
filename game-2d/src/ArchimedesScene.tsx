"use client";

// --------------------------------------------------------------------------
// Archimedes / Buoyancy - the standalone visual demo, mirroring
// WavesScene.tsx/GravitationScene.tsx's own shape: owns its own canvas and
// requestAnimationFrame loop, and hands every frame's numbers straight to
// archimedesRender.ts. Not wired into GameCanvas.tsx or any existing module -
// a fully separate component, per this phase's scope.
//
// Unlike WavesScene.tsx's continuously-running physics clock (a wave
// oscillates forever), the object here only ever needs to move between two
// fixed states - "in air" and "fully submerged" - so this eases a single
// `progress` value (0..1) toward whichever state `submerged` currently says,
// over a fixed real-time duration, read fresh from performance.now() every
// frame exactly the way GameCanvas.tsx's own flight animation is (never a
// setTimeout-driven completion, so there is no stale-callback race to guard
// against - see this file's own animation effect below). Interrupting a
// transition mid-flight (toggling `submerged` again before the previous
// transition finished) restarts cleanly from wherever the object currently
// is, never snapping backward.
// --------------------------------------------------------------------------

import { useEffect, useRef } from "react";
import { drawArchimedesScene } from "./archimedesRender";

const DEFAULT_WIDTH = 640;
const DEFAULT_HEIGHT = 440;
const TRANSITION_DURATION_MS = 900;

export interface ArchimedesSceneProps {
  readonly actualWeight: number;
  readonly buoyantForce: number;
  readonly fluidName: string;
  // Whether the object should be (or be moving toward being) fully
  // submerged - the scene owns easing `progress` toward 0 or 1 accordingly.
  readonly submerged: boolean;
  // Bumped to force an immediate, unanimated snap back to progress=0 (in
  // air) - used when a new challenge/reset means "start over", never for
  // the ordinary air<->water transition itself.
  readonly resetToken?: number;
  readonly width?: number;
  readonly height?: number;
}

export default function ArchimedesScene({
  actualWeight,
  buoyantForce,
  fluidName,
  submerged,
  resetToken = 0,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
}: ArchimedesSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef({ actualWeight, buoyantForce, fluidName });
  propsRef.current = { actualWeight, buoyantForce, fluidName };

  // The eased animation state - read and mutated only inside the rAF loop
  // below (progressRef) or by the two effects that react to `submerged`/
  // `resetToken` changing (the rest). Never React state: this value changes
  // every frame, and re-rendering the component 60x/sec for a number that
  // only ever feeds a canvas draw would be pure waste - exactly why
  // WavesScene.tsx's own elapsedRef is a ref too.
  const progressRef = useRef(0);
  const fromRef = useRef(0);
  const targetRef = useRef(0);
  const transitionStartRef = useRef(0);
  const lastSubmergedRef = useRef(submerged);

  useEffect(() => {
    if (submerged !== lastSubmergedRef.current) {
      lastSubmergedRef.current = submerged;
      fromRef.current = progressRef.current;
      targetRef.current = submerged ? 1 : 0;
      transitionStartRef.current = performance.now();
    }
  }, [submerged]);

  // A reset always snaps immediately to the in-air state, never an eased
  // transition - the same "attemptId bump -> fresh state, no lingering
  // animation from the previous attempt" contract GravitationScene.tsx's own
  // attemptId prop already uses.
  useEffect(() => {
    progressRef.current = 0;
    fromRef.current = 0;
    targetRef.current = 0;
    lastSubmergedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetToken]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;

    function frame() {
      const from = fromRef.current;
      const target = targetRef.current;
      if (from !== target) {
        const elapsed = performance.now() - transitionStartRef.current;
        const t = Math.min(elapsed / TRANSITION_DURATION_MS, 1);
        progressRef.current = from + (target - from) * t;
        if (t >= 1) fromRef.current = target;
      } else {
        progressRef.current = target;
      }

      const p = propsRef.current;
      drawArchimedesScene(ctx as CanvasRenderingContext2D, width, height, {
        actualWeight: p.actualWeight,
        buoyantForce: p.buoyantForce,
        progress: progressRef.current,
        fluidName: p.fluidName,
      });
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [width, height]);

  return <canvas ref={canvasRef} width={width} height={height} className="block h-auto w-full rounded-2xl" />;
}
