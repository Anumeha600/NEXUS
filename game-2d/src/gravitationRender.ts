// --------------------------------------------------------------------------
// Gravitation & Orbits - Layer 3: the visual representation of the Layer 2
// simulation. This file owns exactly two things:
//
//   1. A physics-space -> screen-space coordinate transform (pure, tested).
//   2. Canvas drawing functions that read gravitationSim.ts's state and
//      physics.ts's own gravitationalAccelerationVector - never a second
//      orbital-mechanics implementation. No equation, integration step, or
//      outcome-classification logic is duplicated here; this file only maps
//      numbers that already exist onto pixels.
//
// Mirrors the existing "physics.ts (formulas) / render.ts (drawing)" split -
// this is Gravitation's own render.ts, kept separate so render.ts (shared by
// the five live modules) stays untouched.
// --------------------------------------------------------------------------

import { gravitationalAccelerationVector } from "./physics";
import type { GravitationSimState, GravitationSimStatus } from "./gravitationSim";

export interface GravitationViewTransform {
  readonly centerX: number;
  readonly centerY: number;
  // Screen pixels per one physics-space unit. A single uniform scale (never
  // separate x/y factors) so circles stay circular and aspect ratio is
  // preserved.
  readonly scale: number;
}

export interface GravitationViewOptions {
  // Fraction of the available half-viewport kept as empty margin around the
  // orbital extent, so vectors/labels near the planet have room to draw.
  readonly paddingFraction?: number;
}

const DEFAULT_PADDING_FRACTION = 0.2;
// Even a tight circular orbit gets this much margin beyond its own radius,
// so the orbit path never touches the viewport edge.
const MIN_EXTENT_MULTIPLIER = 1.4;
// Once the planet is genuinely departing (beyond the sim's own escape
// confirmation radius), the view stops growing further with it - the point
// has already been demonstrated, and continuing to zoom out would shrink the
// star and orbit region to invisibility.
const MAX_EXTENT_ESCAPE_MULTIPLIER = 1.3;

// The only input this needs from GravitationSimState - kept as a narrow type
// so the pure transform can be unit-tested without constructing a full
// simulation state.
export type GravitationExtentInput = Pick<GravitationSimState, "planetX" | "planetY" | "trajectory"> & {
  config: Pick<GravitationSimState["config"], "initialRadius" | "escapeConfirmRadius">;
};

// Computes a transform that keeps the star (always at physics-space origin)
// centered in the viewport, fits the current orbital extent (launch radius,
// current planet distance, and trajectory history) inside it with a uniform
// scale, and caps how far it zooms out once a trajectory is clearly
// escaping - so circular orbits, wide ellipses, falls, and escapes all stay
// legible without the caller ever touching simulation units.
export function computeGravitationViewTransform(w: number, h: number, state: GravitationExtentInput, options?: GravitationViewOptions): GravitationViewTransform {
  const paddingFraction = options?.paddingFraction ?? DEFAULT_PADDING_FRACTION;
  const safeW = Math.max(w, 1);
  const safeH = Math.max(h, 1);

  const currentDistance = Math.hypot(state.planetX, state.planetY);
  let extent = Math.max(state.config.initialRadius * MIN_EXTENT_MULTIPLIER, currentDistance);
  for (const point of state.trajectory) {
    extent = Math.max(extent, Math.hypot(point.x, point.y));
  }
  const extentCap = state.config.escapeConfirmRadius * MAX_EXTENT_ESCAPE_MULTIPLIER;
  extent = Math.min(extent, extentCap);
  // Guards against a degenerate (zero-radius) configuration ever producing a
  // division by zero below.
  extent = Math.max(extent, 1e-6);

  const availableRadiusPx = (Math.min(safeW, safeH) / 2) * (1 - paddingFraction);
  const scale = availableRadiusPx / extent;

  return { centerX: safeW / 2, centerY: safeH / 2, scale };
}

// Maps a physics-space point to a screen-space pixel coordinate. Uses the
// same "add, don't flip" convention as this codebase's existing
// circularPositionAt usage (render.ts's drawCircularScene: `centerY +
// pos.y`) - orientation is arbitrary for an abstract orbit view, so the
// simulation's own sign convention is kept as-is rather than introducing a
// second one.
export function physicsToScreen(transform: GravitationViewTransform, x: number, y: number): { x: number; y: number } {
  return { x: transform.centerX + x * transform.scale, y: transform.centerY + y * transform.scale };
}

// Maps a physics-space vector (velocity, acceleration, ...) to a
// screen-space direction/length - a pure scale, no translation, so a
// vector's direction is preserved exactly (only its magnitude changes).
export function physicsVectorToScreen(transform: GravitationViewTransform, vx: number, vy: number): { x: number; y: number } {
  return { x: vx * transform.scale, y: vy * transform.scale };
}

const SPACE_PALETTE = {
  starCore: "#fff4d6",
  starGlow: "rgba(255,214,140,0.85)",
  velocity: "#19b6d1",
  gravity: "#f0a916",
  planet: "#8fd3ff",
  distance: "rgba(255,255,255,0.55)",
  trajectoryRunning: "rgba(143,211,255,0.55)",
  trajectoryOrbit: "rgba(120,220,180,0.6)",
  trajectoryCollision: "rgba(230,80,80,0.6)",
  trajectoryEscape: "rgba(170,140,255,0.65)",
};

const STATUS_LABEL: Record<GravitationSimStatus, string> = {
  idle: "READY",
  running: "RUNNING",
  orbit: "ORBIT",
  collision: "COLLISION",
  escape: "ESCAPE",
  stopped: "STOPPED",
};

function trajectoryColorFor(status: GravitationSimStatus): string {
  if (status === "orbit") return SPACE_PALETTE.trajectoryOrbit;
  if (status === "collision") return SPACE_PALETTE.trajectoryCollision;
  if (status === "escape") return SPACE_PALETTE.trajectoryEscape;
  return SPACE_PALETTE.trajectoryRunning;
}

// Deterministic pseudo-random background starfield, seeded by index so it
// doesn't sparkle/reshuffle every frame - same technique as render.ts's own
// hashRandom, kept local since render.ts doesn't export it.
function starfieldRandom(seed: number): number {
  const x = Math.sin(seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#05061a");
  grad.addColorStop(1, "#0c0f2e");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // A sparse, subtle starfield - enough to read as "space" without
  // competing with the orbit/trajectory it's the backdrop for.
  const starCount = 70;
  for (let i = 0; i < starCount; i++) {
    const x = starfieldRandom(i * 2 + 1) * w;
    const y = starfieldRandom(i * 2 + 2) * h;
    const r = 0.4 + starfieldRandom(i * 3 + 5) * 1.1;
    const alpha = 0.25 + starfieldRandom(i * 5 + 7) * 0.45;
    ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const outerGlow = ctx.createRadialGradient(x, y, 0, x, y, 46);
  outerGlow.addColorStop(0, SPACE_PALETTE.starGlow);
  outerGlow.addColorStop(1, "rgba(255,214,140,0)");
  ctx.fillStyle = outerGlow;
  ctx.beginPath();
  ctx.arc(x, y, 46, 0, Math.PI * 2);
  ctx.fill();

  const core = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, 16);
  core.addColorStop(0, "#fffdf5");
  core.addColorStop(0.5, "#ffd27a");
  core.addColorStop(1, "#e0862c");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(x, y, 16, 0, Math.PI * 2);
  ctx.fill();
}

function drawTrajectory(ctx: CanvasRenderingContext2D, transform: GravitationViewTransform, state: GravitationSimState): void {
  if (state.trajectory.length < 2) return;
  ctx.save();
  ctx.strokeStyle = trajectoryColorFor(state.status);
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.beginPath();
  state.trajectory.forEach((point, i) => {
    const p = physicsToScreen(transform, point.x, point.y);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.stroke();
  ctx.restore();
}

function drawPlanet(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const grad = ctx.createRadialGradient(x - 2, y - 2, 0.5, x, y, 7);
  grad.addColorStop(0, "#f4fbff");
  grad.addColorStop(0.55, SPACE_PALETTE.planet);
  grad.addColorStop(1, "#2f6fe0");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, 7, 0, Math.PI * 2);
  ctx.fill();
}

// A simple labeled arrow from (x, y) in the given screen-space direction
// (dx, dy), clamped to a readable length range - visualization-only, no
// physics computed here.
function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number, color: string, label: string, minLen: number, maxLen: number): void {
  const rawLen = Math.hypot(dx, dy);
  if (rawLen < 1e-9) return;
  const len = Math.min(Math.max(rawLen, minLen), maxLen);
  const angle = Math.atan2(dy, dx);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(len - 7, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(len, 0);
  ctx.lineTo(len - 7, -4);
  ctx.lineTo(len - 7, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const lx = x + Math.cos(angle) * (len + 10);
  const ly = y + Math.sin(angle) * (len + 10);
  ctx.font = "700 9px system-ui, sans-serif";
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.fillText(label, lx, ly);
  ctx.textAlign = "left";
}

function drawDistanceIndicator(ctx: CanvasRenderingContext2D, star: { x: number; y: number }, planet: { x: number; y: number }, distance: number): void {
  ctx.save();
  ctx.strokeStyle = SPACE_PALETTE.distance;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  ctx.moveTo(star.x, star.y);
  ctx.lineTo(planet.x, planet.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  const midX = (star.x + planet.x) / 2;
  const midY = (star.y + planet.y) / 2;
  const label = `r = ${distance.toFixed(2)}`;
  ctx.font = "700 10px system-ui, sans-serif";
  const textW = ctx.measureText(label).width;
  ctx.fillStyle = "rgba(5,6,26,0.6)";
  ctx.fillRect(midX - textW / 2 - 5, midY - 15, textW + 10, 16);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.textAlign = "center";
  ctx.fillText(label, midX, midY - 3);
  ctx.textAlign = "left";
}

function drawStatusBadge(ctx: CanvasRenderingContext2D, w: number, status: GravitationSimStatus): void {
  const label = STATUS_LABEL[status];
  ctx.font = "700 11px system-ui, sans-serif";
  const textW = ctx.measureText(label).width;
  const x = w - textW - 26;
  const y = 16;
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(x - 6, y - 12, textW + 12, 20);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(label, x, y + 3);
}

// The Layer 3 entry point: draws one frame of the gravitation scene from
// simulation state alone. Every position, vector, and label comes from
// GravitationSimState / physics.ts - nothing here advances time or decides
// an outcome.
export function drawGravitationScene(ctx: CanvasRenderingContext2D, w: number, h: number, state: GravitationSimState): void {
  drawBackground(ctx, w, h);

  const transform = computeGravitationViewTransform(w, h, state);
  const star = physicsToScreen(transform, state.config.starX, state.config.starY);
  const planet = physicsToScreen(transform, state.planetX, state.planetY);
  const distance = Math.hypot(state.planetX, state.planetY);

  drawTrajectory(ctx, transform, state);
  drawStar(ctx, star.x, star.y);
  drawDistanceIndicator(ctx, star, planet, distance);
  drawPlanet(ctx, planet.x, planet.y);

  const velocityScreen = physicsVectorToScreen(transform, state.planetVx, state.planetVy);
  drawArrow(ctx, planet.x, planet.y, velocityScreen.x, velocityScreen.y, SPACE_PALETTE.velocity, "VELOCITY", 18, 70);

  const { ax, ay } = gravitationalAccelerationVector(state.config.G, state.config.starMass, state.planetX, state.planetY);
  const gravityScreen = physicsVectorToScreen(transform, ax, ay);
  drawArrow(ctx, planet.x, planet.y, gravityScreen.x, gravityScreen.y, SPACE_PALETTE.gravity, "GRAVITY", 18, 70);

  drawStatusBadge(ctx, w, state.status);
}
