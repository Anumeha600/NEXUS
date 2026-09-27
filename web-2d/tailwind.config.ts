import type { Config } from "tailwindcss";

// @nexus/game-2d is a separate workspace package - its .tsx source lives
// outside this app's own src/ tree (only symlinked into node_modules), so
// it must be listed explicitly or its utility classes are never generated.
const config: Config = {
  content: [
    "./src/**/*.{ts,tsx}",
    "../game-2d/src/**/*.{ts,tsx}",
  ],
};

export default config;
