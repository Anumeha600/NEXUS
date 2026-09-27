import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @nexus/shared and @nexus/game-2d ship TypeScript source (no build
  // step) - Next.js only transpiles workspace packages it's explicitly
  // told about. Unlike web-3d, this app has no Godot/WebAssembly embed, so
  // no cross-origin-isolation headers are required.
  transpilePackages: ["@nexus/shared", "@nexus/game-2d"],
};

export default nextConfig;
