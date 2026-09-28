// --------------------------------------------------------------------------
// Archimedes / Buoyancy - the visual representation of the Phase 1 physics.
//
// Mirrors the existing "physics.ts (formulas) / render.ts (drawing)" split,
// same as wavesRender.ts: this file only maps numbers that already exist
// (actualWeight, buoyantForce, from archimedesChallenge.ts's own derivation
// over archimedesPhysics.ts) onto pixels. No formula is duplicated here -
// the buoyant-force arrow's length and the balance readout are both driven
// directly by the caller's own already-computed values.
//
// NEXUS's normal light/premium chrome (a light card, not a sterile diagram):
// a soft lavender/white lab bench, a glass beaker, a violet/blue/cyan/gold
// palette matching wavesRender.ts's own PALETTE and web-2d's globals.css.
// --------------------------------------------------------------------------

const PALETTE = {
  backgroundTop: "#ffffff",
  backgroundBottom: "#f8f7ff",
  bench: "rgba(23,24,43,0.10)",
  standMetal: "#8a86ad",
  standMetalDark: "#5c5a72",
  spring: "#6c4dff",
  balanceCase: "#17182b",
  balanceFace: "#ffffff",
  balanceText: "#17182b",
  string: "#5c5a72",
  block: "#f4b942",
  blockDark: "#c98f14",
  glass: "rgba(108,77,255,0.14)",
  glassEdge: "rgba(92,90,114,0.55)",
  fluid: "rgba(52,120,246,0.28)",
  fluidSurface: "rgba(32,199,217,0.9)",
  weightArrow: "#d1483a",
  buoyantArrow: "#20c7d9",
  displacedHighlight: "rgba(32,199,217,0.35)",
  text: "#17182b",
  textMuted: "#5c5a72",
} as const;

// Subtle per-fluid tint, keyed by the same lowercase fluid names
// archimedesChallenge.ts's FLUIDS list uses - a small nod to which fluid is
// selected (water's usual blue, salt water a slightly deeper/cooler blue,
// olive oil a warm amber-green, glycerin a soft violet), never a large
// visual redesign. Falls back to the original water tones for any
// unrecognized name so this never breaks if a new fluid is added.
const FLUID_TINTS: Readonly<Record<string, { fluid: string; fluidSurface: string }>> = {
  water: { fluid: "rgba(52,120,246,0.28)", fluidSurface: "rgba(32,199,217,0.9)" },
  "salt water": { fluid: "rgba(37,99,235,0.32)", fluidSurface: "rgba(14,165,197,0.9)" },
  "olive oil": { fluid: "rgba(168,140,32,0.26)", fluidSurface: "rgba(202,164,44,0.9)" },
  glycerin: { fluid: "rgba(139,92,246,0.26)", fluidSurface: "rgba(124,77,255,0.9)" },
};

function fluidTintFor(fluidName: string): { fluid: string; fluidSurface: string } {
  return FLUID_TINTS[fluidName] ?? FLUID_TINTS.water;
}

export interface ArchimedesViewOptions {
  // The true, fully-submerged buoyant force (N) this challenge's setup
  // produces - the arrow and readout below scale toward this as `progress`
  // approaches 1, never a separately-invented "visual" force.
  readonly actualWeight: number;
  readonly buoyantForce: number;
  // 0 = fully in air, 1 = fully submerged - the caller (ArchimedesScene.tsx)
  // owns easing this over time; this function only ever draws one frame at
  // one progress value, exactly like drawWaveScene draws one frame at one
  // elapsed time.
  readonly progress: number;
  readonly fluidName: string;
}

const BEAKER_LEFT_FRAC = 0.32;
const BEAKER_RIGHT_FRAC = 0.72;
const BEAKER_TOP_FRAC = 0.5;
const BEAKER_BOTTOM_FRAC = 0.92;
const FLUID_TOP_FRAC = 0.62; // resting fluid surface, before any displacement rise
const AIR_BLOCK_CENTER_Y_FRAC = 0.24;
const SUBMERGED_BLOCK_CENTER_Y_FRAC = 0.78;
const BLOCK_HALF_SIZE = 26;
const BALANCE_X_FRAC = 0.52;
const BALANCE_TOP_FRAC = 0.06;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, PALETTE.backgroundTop);
  grad.addColorStop(1, PALETTE.backgroundBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Bench line near the bottom - a simple horizontal surface the stand and
  // beaker both visually rest on.
  ctx.fillStyle = PALETTE.bench;
  ctx.fillRect(0, h * 0.94, w, h * 0.06);
}

function drawStandAndBalance(ctx: CanvasRenderingContext2D, w: number, h: number, reading: number): { balanceBottomX: number; balanceBottomY: number } {
  const standX = w * (BEAKER_RIGHT_FRAC + 0.06);
  const topY = h * BALANCE_TOP_FRAC;
  const armLeftX = w * (BALANCE_X_FRAC - 0.22);

  // Vertical support pole + horizontal arm the balance hangs from.
  ctx.strokeStyle = PALETTE.standMetal;
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(standX, h * 0.94);
  ctx.lineTo(standX, topY);
  ctx.lineTo(armLeftX, topY);
  ctx.stroke();
  ctx.fillStyle = PALETTE.standMetalDark;
  ctx.beginPath();
  ctx.arc(standX, h * 0.94, 10, 0, Math.PI * 2);
  ctx.fill();

  // Spring balance case: a small rounded box with a coiled spring above a
  // digital-style readout, hanging from the arm.
  const balanceX = w * BALANCE_X_FRAC;
  const springTopY = topY;
  const springBottomY = topY + 46;
  ctx.strokeStyle = PALETTE.spring;
  ctx.lineWidth = 3;
  ctx.beginPath();
  const coils = 6;
  for (let i = 0; i <= coils; i++) {
    const y = lerp(springTopY, springBottomY, i / coils);
    const x = balanceX + (i % 2 === 0 ? -9 : 9);
    if (i === 0) ctx.moveTo(balanceX, y);
    else ctx.lineTo(x, y);
  }
  ctx.lineTo(balanceX, springBottomY);
  ctx.stroke();

  const caseW = 92;
  const caseH = 44;
  const caseX = balanceX - caseW / 2;
  const caseY = springBottomY;
  ctx.fillStyle = PALETTE.balanceCase;
  ctx.beginPath();
  ctx.roundRect(caseX, caseY, caseW, caseH, 10);
  ctx.fill();
  ctx.fillStyle = PALETTE.balanceFace;
  ctx.beginPath();
  ctx.roundRect(caseX + 6, caseY + 6, caseW - 12, caseH - 12, 6);
  ctx.fill();
  ctx.fillStyle = PALETTE.balanceText;
  ctx.font = "700 15px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${reading.toFixed(2)} N`, balanceX, caseY + caseH / 2 + 5);

  return { balanceBottomX: balanceX, balanceBottomY: caseY + caseH };
}

function drawBeakerAndFluid(ctx: CanvasRenderingContext2D, w: number, h: number, progress: number, fluidName: string): { fluidSurfaceY: number; beakerLeft: number; beakerRight: number } {
  const left = w * BEAKER_LEFT_FRAC;
  const right = w * BEAKER_RIGHT_FRAC;
  const top = h * BEAKER_TOP_FRAC;
  const bottom = h * BEAKER_BOTTOM_FRAC;

  // Fluid surface rises slightly as the object displaces it - purely
  // illustrative (not scaled to the exact displaced volume in pixels), just
  // enough for the rise to read as "the water level went up".
  const restingSurfaceY = h * FLUID_TOP_FRAC;
  const fluidSurfaceY = restingSurfaceY - progress * 8;
  const tint = fluidTintFor(fluidName);

  ctx.fillStyle = tint.fluid;
  ctx.beginPath();
  ctx.rect(left, fluidSurfaceY, right - left, bottom - fluidSurfaceY);
  ctx.fill();

  ctx.strokeStyle = tint.fluidSurface;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left, fluidSurfaceY);
  ctx.lineTo(right, fluidSurfaceY);
  ctx.stroke();

  // Glass beaker outline, drawn over the fluid so the glass edge reads on
  // top of the water fill.
  ctx.strokeStyle = PALETTE.glassEdge;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(left, top);
  ctx.lineTo(left, bottom);
  ctx.lineTo(right, bottom);
  ctx.lineTo(right, top);
  ctx.stroke();

  ctx.fillStyle = PALETTE.textMuted;
  ctx.font = "700 11px system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(fluidName.toUpperCase(), left + 8, bottom - 10);

  return { fluidSurfaceY, beakerLeft: left, beakerRight: right };
}

function drawBlockAndString(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  progress: number,
  balanceBottomX: number,
  balanceBottomY: number,
): { blockX: number; blockY: number } {
  const blockX = balanceBottomX;
  const airY = h * AIR_BLOCK_CENTER_Y_FRAC;
  const submergedY = h * SUBMERGED_BLOCK_CENTER_Y_FRAC;
  const blockY = lerp(airY, submergedY, progress);

  ctx.strokeStyle = PALETTE.string;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(balanceBottomX, balanceBottomY);
  ctx.lineTo(blockX, blockY - BLOCK_HALF_SIZE);
  ctx.stroke();

  ctx.fillStyle = PALETTE.block;
  ctx.strokeStyle = PALETTE.blockDark;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(blockX - BLOCK_HALF_SIZE, blockY - BLOCK_HALF_SIZE, BLOCK_HALF_SIZE * 2, BLOCK_HALF_SIZE * 2, 6);
  ctx.fill();
  ctx.stroke();

  return { blockX, blockY };
}

function drawForceArrow(ctx: CanvasRenderingContext2D, x: number, y: number, length: number, direction: 1 | -1, color: string, label: string): void {
  if (length < 2) return;
  const endY = y + direction * length;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, endY);
  ctx.stroke();
  const headSize = 7;
  ctx.beginPath();
  ctx.moveTo(x, endY);
  ctx.lineTo(x - headSize, endY - direction * headSize);
  ctx.lineTo(x + headSize, endY - direction * headSize);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();

  ctx.font = "700 11px system-ui, sans-serif";
  ctx.fillStyle = color;
  ctx.textAlign = direction === 1 ? "right" : "left";
  ctx.fillText(label, direction === 1 ? x - 10 : x + 10, endY - direction * 4);
}

// Pixels per Newton for the force arrows - a fixed visual scale (not a
// physical unit conversion) chosen so a typical educational-range weight
// (a few kg, a few tens of N) reads as a clearly visible but not
// off-canvas arrow.
const PX_PER_NEWTON = 3.5;
const MAX_ARROW_LENGTH = 90;

export function drawArchimedesScene(ctx: CanvasRenderingContext2D, w: number, h: number, options: ArchimedesViewOptions): void {
  const { actualWeight, buoyantForce, progress, fluidName } = options;
  const clampedProgress = Math.min(1, Math.max(0, progress));

  // Buoyant force phases in as the object enters the fluid - proportional to
  // how far through the lowering it currently is, reaching its full,
  // physically-real value only once fully submerged (progress = 1). The
  // reading shown on the balance is always actualWeight minus whatever
  // buoyant force currently applies, matching apparentWeight's own clamp.
  const currentBuoyant = buoyantForce * clampedProgress;
  const currentReading = Math.max(0, actualWeight - currentBuoyant);

  drawBackground(ctx, w, h);
  const { balanceBottomX, balanceBottomY } = drawStandAndBalance(ctx, w, h, currentReading);
  drawBeakerAndFluid(ctx, w, h, clampedProgress, fluidName);
  const { blockX, blockY } = drawBlockAndString(ctx, w, h, clampedProgress, balanceBottomX, balanceBottomY);

  const weightArrowLength = Math.min(MAX_ARROW_LENGTH, actualWeight * PX_PER_NEWTON);
  drawForceArrow(ctx, blockX, blockY, weightArrowLength, 1, PALETTE.weightArrow, "W");

  if (currentBuoyant > 0.01) {
    const buoyantArrowLength = Math.min(MAX_ARROW_LENGTH, currentBuoyant * PX_PER_NEWTON);
    drawForceArrow(ctx, blockX, blockY, buoyantArrowLength, -1, PALETTE.buoyantArrow, "F_B");
  }

  // A soft highlight ring around the block while submerged - the "displaced
  // fluid" cue the brief asks for, without claiming a pixel-exact volume.
  if (clampedProgress > 0.02) {
    ctx.save();
    ctx.globalAlpha = 0.5 * clampedProgress;
    ctx.fillStyle = PALETTE.displacedHighlight;
    ctx.beginPath();
    ctx.arc(blockX, blockY, BLOCK_HALF_SIZE * 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export const ARCHIMEDES_SCENE_PALETTE = PALETTE;
