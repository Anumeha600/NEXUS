"use client";

import { useState } from "react";
import { MODULE_PROJECTILE, MODULE_NEWTON, MODULE_WORK_ENERGY, MODULE_MOMENTUM, MODULE_CIRCULAR, type Challenge } from "./adaptiveEngine";
import { actionLabelFor } from "./challengeLogic";

interface HelpContent {
  description: string;
  readStep: string;
  adjustStep: string;
  observeStep: string;
  confirmStep: string;
  physicsTip: string;
}

// One shared "?" How to Play component for every module - content only,
// never a per-module reimplementation. Step 3 ("Press X") is deliberately
// NOT stored here as static text: the actual button label (actionLabelFor)
// differs by module and even by concept ("LAUNCH", "APPLY FORCE", "RUN
// EXPERIMENT", "SET VELOCITY", "APPLY WORK" - see challengeLogic.ts), so
// HowToPlay renders that step from the same function the real button uses
// rather than claiming a label that might not be what's on screen.
const HELP_CONTENT: Record<string, HelpContent> = {
  [MODULE_PROJECTILE]: {
    description: "Launch a projectile at NEXUS's fixed 45° angle and match the target range.",
    readStep: "Read the target quantity shown in the control panel.",
    adjustStep: "Adjust the launch speed using the controls.",
    observeStep: "Watch the projectile follow its physical trajectory.",
    confirmStep: "Enter/confirm your answer to complete the challenge.",
    physicsTip: "At the fixed 45° launch angle, range follows R = v² / g.",
  },
  [MODULE_NEWTON]: {
    description: "Push a cart with an applied force and see Newton's Second Law respond in real time.",
    readStep: "Read the cart mass and force setup.",
    adjustStep: "Adjust the controlled force using the controls.",
    observeStep: "Observe how the cart accelerates along the track.",
    confirmStep: "Enter/confirm the requested physics value.",
    physicsTip: "Newton's second law relates net force, mass and acceleration: F_net = ma.",
  },
  [MODULE_WORK_ENERGY]: {
    description: "Move an object along the energy track and connect force, distance, and kinetic energy.",
    readStep: "Read the force, mass and distance shown.",
    adjustStep: "Adjust the requested value.",
    observeStep: "Observe the object moving along the energy track.",
    confirmStep: "Enter/confirm the requested energy/work value.",
    physicsTip: "Net work changes kinetic energy: W_net = ΔK.",
  },
  [MODULE_MOMENTUM]: {
    description: "Set up a cart collision and see how momentum transfers between the carts.",
    readStep: "Read the cart masses and velocities.",
    adjustStep: "Adjust the requested quantity.",
    observeStep: "Watch the carts move and collide.",
    confirmStep: "Observe the post-collision motion and confirm your answer.",
    physicsTip: "For an isolated collision, total momentum is conserved.",
  },
  [MODULE_CIRCULAR]: {
    description: "Run a Ferris-wheel circular-motion experiment and track the object's speed and centripetal force.",
    readStep: "Read the radius, mass and current circular-motion values.",
    adjustStep: "Adjust the requested quantity.",
    observeStep: "Watch the object/cabin move around the circular path.",
    confirmStep: "Confirm the requested centripetal quantity.",
    physicsTip: "Centripetal force always points toward the center: F_c = mv² / r.",
  },
};

// Every currently playable module must have an entry above - this is what a
// future 6th module (or a typo in a moduleId constant) can't silently skip:
// see HowToPlay.test.ts.
export function hasHowToPlayContent(moduleId: string): boolean {
  return moduleId in HELP_CONTENT;
}

// Purely a presentational overlay: opening/closing it never touches
// challenge, phase, or any adaptive-engine state - see GameCanvas.tsx, which
// owns all of that and renders this unconditionally for every module.
export default function HowToPlay({ challenge, belowFullscreenButton }: { challenge: Challenge; belowFullscreenButton: boolean }) {
  const [open, setOpen] = useState(false);
  const content = HELP_CONTENT[challenge.moduleId];
  if (!content) return null;

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close how to play" : "How to play"}
        aria-expanded={open}
        title="How to Play"
        className={`pointer-events-auto absolute right-4 z-20 flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold shadow-lg ${
          belowFullscreenButton ? "top-16" : "top-4"
        } ${open ? "bg-purple text-white" : "bg-white/90 text-ink hover:bg-white"}`}
      >
        ?
      </button>
      {open && (
        <div
          className={`pointer-events-auto absolute right-4 z-20 w-64 max-w-[calc(100%-2rem)] rounded-2xl border-2 border-purple/30 bg-white/95 p-4 shadow-xl ${
            belowFullscreenButton ? "top-28" : "top-16"
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold tracking-widest text-purple uppercase">How to Play</p>
            <button onClick={() => setOpen(false)} aria-label="Close" className="text-ink-muted hover:text-ink">
              ✕
            </button>
          </div>
          <p className="mt-1.5 text-[11px] text-ink-muted">{content.description}</p>
          <ol className="mt-2 space-y-1 text-xs text-ink">
            <li>1. {content.readStep}</li>
            <li>2. {content.adjustStep}</li>
            <li>3. Press &ldquo;{actionLabelFor(challenge)}&rdquo;.</li>
            <li>4. {content.observeStep}</li>
            <li>5. {content.confirmStep}</li>
          </ol>
          <div className="mt-3 rounded-xl bg-surface-lavender/50 p-2">
            <p className="text-[9px] font-bold tracking-widest text-purple uppercase">Physics Tip</p>
            <p className="mt-1 text-[11px] text-ink-muted">{content.physicsTip}</p>
          </div>
        </div>
      )}
    </>
  );
}
