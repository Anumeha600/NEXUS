"use client";

import { useRef, useState } from "react";

type LoadState = "unsupported" | "loading" | "ready" | "error";

function detectSupport(): boolean {
  if (typeof window === "undefined") return true;
  const hasWasm = typeof WebAssembly === "object";
  let hasWebGL = false;
  try {
    const canvas = document.createElement("canvas");
    hasWebGL = !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    hasWebGL = false;
  }
  return hasWasm && hasWebGL;
}

export default function GameFrame() {
  const [state, setState] = useState<LoadState>(() =>
    detectSupport() ? "loading" : "unsupported",
  );
  const containerRef = useRef<HTMLDivElement>(null);

  const handleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen?.().catch(() => {
        /* Denied fullscreen just means the game stays inline - not fatal. */
      });
    }
  };

  return (
    <div>
      <div
        ref={containerRef}
        className="relative aspect-video w-full overflow-hidden rounded-2xl border-2 border-purple/20 bg-ink shadow-xl"
      >
        {(state === "loading" || state === "ready") && (
          <>
            <iframe
              title="NEXUS Physics Lab"
              src="/game/index.html"
              className="absolute inset-0 h-full w-full border-0"
              allow="autoplay; fullscreen; gamepad"
              onLoad={() => setState("ready")}
              onError={() => setState("error")}
            />
            {state === "loading" && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink">
                <span className="font-display text-xl font-bold text-white">
                  NEXUS
                </span>
                <span className="text-sm text-white/70">
                  Preparing Physics Lab…
                </span>
                <span className="mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-white/15">
                  <span className="block h-full w-1/3 animate-[loadingBar_1.2s_ease-in-out_infinite] rounded-full bg-gold" />
                </span>
              </div>
            )}
          </>
        )}

        {state === "unsupported" && (
          <FallbackMessage
            title="Your browser can't run NEXUS yet"
            body="NEXUS needs WebAssembly and WebGL support. Try the latest version of Chrome, Edge, or Firefox on a desktop or laptop."
          />
        )}

        {state === "error" && (
          <FallbackMessage
            title="NEXUS couldn't load"
            body="The Physics Lab failed to start. Reload the page, or try a different browser."
          />
        )}

      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink-muted">
          Desktop browser recommended · Controls: ↑ / ↓ adjust, Enter
          confirm, WASD + mouse to look around the lab.
        </p>
        <button
          type="button"
          onClick={handleFullscreen}
          className="rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:border-purple hover:text-purple"
        >
          Fullscreen ⤢
        </button>
      </div>
    </div>
  );
}

function FallbackMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-8 text-center">
      <span className="font-display text-lg font-bold text-white">
        {title}
      </span>
      <span className="max-w-sm text-sm text-white/70">{body}</span>
    </div>
  );
}
