import type { NextConfig } from "next";

// The Godot Web export under /public/game uses threads (see
// GODOT_THREADS_ENABLED in game/index.html), which requires
// SharedArrayBuffer, which in turn requires the page to be
// cross-origin-isolated. These two headers are applied site-wide (not just
// under /game) because a sub-frame can only become cross-origin-isolated
// if the TOP-LEVEL document serving it is isolated too. next/font/google
// self-hosts font files at build time, so there is no external
// cross-origin resource on the page that COEP: require-corp would block.
const isolationHeaders = [
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
];

const nextConfig: NextConfig = {
  // @nexus/shared ships TypeScript source (no build step) - Next.js only
  // transpiles workspace packages it's explicitly told about.
  transpilePackages: ["@nexus/shared"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: isolationHeaders,
      },
    ];
  },
};

export default nextConfig;
