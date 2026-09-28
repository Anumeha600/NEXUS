// --------------------------------------------------------------------------
// Wave Motion - the visual representation of the Layer 1 wave physics.
//
// Mirrors the existing "physics.ts (formulas) / render.ts (drawing)" split -
// this file only maps numbers that already exist (from wavesPhysics.ts) onto
// pixels. No formula is duplicated here: every y-value drawn comes from
// waveDisplacementAt/twoWaveDisplacementAt.
//
// Unlike gravitationRender.ts's dark space theme (a deliberate exception for
// that module), this is NEXUS's normal light/premium chrome - a light card,
// not a sterile graph: a soft lavender/white medium with a glowing blue/cyan
// traveling wave, matching web-2d's own palette (globals.css's --nexus-blue/
// --nexus-cyan/--nexus-purple).
// --------------------------------------------------------------------------

import { waveDisplacementAt, waveNumber, type WaveParams } from "./wavesPhysics";

export interface WaveViewTransform {
  readonly originX: number;
  readonly originY: number;
  // Pixels per one physics-space meter, horizontally (x) and vertically (y)
  // independently - unlike gravitationRender.ts's uniform scale, a wave plot
  // is deliberately NOT isotropic: amplitude (meters) and the horizontal
  // medium (meters) occupy very different visual ranges, and a real physics
  // plot always scales each axis to fill the available space.
  readonly pxPerMeterX: number;
  readonly pxPerMeterY: number;
}

const PALETTE = {
  background: "#f8f7ff",
  backgroundGradientTop: "#ffffff",
  medium: "rgba(108,77,255,0.10)",
  equilibrium: "rgba(23,24,43,0.18)",
  wave: "#3478f6",
  waveGlow: "rgba(52,120,246,0.18)",
  wave2: "#f4b942",
  resultant: "#6c4dff",
  amplitudeMarker: "#20c7d9",
  wavelengthMarker: "#c98f14",
  particle: "#1f56c9",
  text: "#17182b",
  textMuted: "#5c5a72",
} as const;

// Fraction of the canvas height given to vertical margin above/below the
// equilibrium line, so a full-amplitude crest/trough never touches the
// canvas edge even for the largest amplitude the controls allow.
const VERTICAL_PADDING_FRACTION = 0.18;
const HORIZONTAL_PADDING_PX = 24;

export function computeWaveViewTransform(w: number, h: number, maxAmplitude: number, mediumLengthMeters: number): WaveViewTransform {
  const safeW = Math.max(w, 1);
  const safeH = Math.max(h, 1);
  const usableHeight = safeH * (1 - VERTICAL_PADDING_FRACTION * 2);
  const pxPerMeterY = usableHeight / (2 * Math.max(maxAmplitude, 1e-6));
  const usableWidth = safeW - HORIZONTAL_PADDING_PX * 2;
  const pxPerMeterX = usableWidth / Math.max(mediumLengthMeters, 1e-6);
  return { originX: HORIZONTAL_PADDING_PX, originY: safeH / 2, pxPerMeterX, pxPerMeterY };
}

export function physicsToScreen(transform: WaveViewTransform, x: number, y: number): { x: number; y: number } {
  return { x: transform.originX + x * transform.pxPerMeterX, y: transform.originY - y * transform.pxPerMeterY };
}

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, PALETTE.backgroundGradientTop);
  grad.addColorStop(1, PALETTE.background);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

function drawMedium(ctx: CanvasRenderingContext2D, transform: WaveViewTransform, w: number, h: number): void {
  ctx.fillStyle = PALETTE.medium;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = PALETTE.equilibrium;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(0, transform.originY);
  ctx.lineTo(w, transform.originY);
  ctx.stroke();
  ctx.setLineDash([]);
}

// Samples and strokes y(x,t) across the full medium length - the actual
// traveling-wave curve, never a pre-baked/static path shifted each frame.
function strokeWaveCurve(ctx: CanvasRenderingContext2D, transform: WaveViewTransform, wave: WaveParams, t: number, mediumLengthMeters: number, color: string, lineWidth: number): void {
  const samples = 220;
  ctx.beginPath();
  for (let i = 0; i <= samples; i++) {
    const x = (i / samples) * mediumLengthMeters;
    const y = waveDisplacementAt(wave, x, t);
    const p = physicsToScreen(transform, x, y);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
}

function strokeResultantCurve(
  ctx: CanvasRenderingContext2D,
  transform: WaveViewTransform,
  wave1: WaveParams,
  wave2: WaveParams,
  t: number,
  mediumLengthMeters: number,
  color: string,
): void {
  const samples = 220;
  ctx.beginPath();
  for (let i = 0; i <= samples; i++) {
    const x = (i / samples) * mediumLengthMeters;
    const y = waveDisplacementAt(wave1, x, t) + waveDisplacementAt(wave2, x, t);
    const p = physicsToScreen(transform, x, y);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
}

// A soft glow behind the primary wave curve, drawn as a wider, translucent
// stroke of the same curve underneath the crisp line - purely cosmetic, uses
// the exact same sampled points so it can never visually diverge from the
// real curve above it.
function drawWaveGlow(ctx: CanvasRenderingContext2D, transform: WaveViewTransform, wave: WaveParams, t: number, mediumLengthMeters: number): void {
  strokeWaveCurve(ctx, transform, wave, t, mediumLengthMeters, PALETTE.waveGlow, 9);
}

// A marker particle riding the wave at a fixed medium position - the classic
// "watch this point bob up and down" visualization for reading off frequency
// (how fast it oscillates) as distinct from wave speed (how fast crests
// travel down the medium).
const PARTICLE_X_METERS = 0; // leftmost point of the medium, always visible.

function drawOscillatingParticle(ctx: CanvasRenderingContext2D, transform: WaveViewTransform, wave: WaveParams, t: number): void {
  const y = waveDisplacementAt(wave, PARTICLE_X_METERS, t);
  const p = physicsToScreen(transform, PARTICLE_X_METERS, y);
  ctx.beginPath();
  ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.particle;
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawAmplitudeMarker(ctx: CanvasRenderingContext2D, transform: WaveViewTransform, wave: WaveParams, mediumLengthMeters: number): void {
  // Marked at the wave's own first crest (x where kx + phi = pi/2), so the
  // bracket always lands visibly on a real peak of the curve rather than an
  // arbitrary fixed x that might catch the wave near a zero-crossing.
  const k = waveNumber(wave.wavelength);
  let crestX = (Math.PI / 2 - wave.phase) / k;
  crestX = ((crestX % wave.wavelength) + wave.wavelength) % wave.wavelength;
  if (crestX > mediumLengthMeters * 0.85) crestX -= wave.wavelength;

  const top = physicsToScreen(transform, crestX, wave.amplitude);
  const bottom = physicsToScreen(transform, crestX, 0);
  ctx.save();
  ctx.strokeStyle = PALETTE.amplitudeMarker;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(top.x, top.y);
  ctx.lineTo(bottom.x, bottom.y);
  ctx.stroke();
  // Tick caps at both ends of the bracket.
  ctx.beginPath();
  ctx.moveTo(top.x - 5, top.y);
  ctx.lineTo(top.x + 5, top.y);
  ctx.moveTo(bottom.x - 5, bottom.y);
  ctx.lineTo(bottom.x + 5, bottom.y);
  ctx.stroke();
  ctx.restore();

  const label = `A = ${wave.amplitude.toFixed(2)} m`;
  ctx.font = "700 11px system-ui, sans-serif";
  ctx.fillStyle = PALETTE.amplitudeMarker;
  ctx.textAlign = "left";
  ctx.fillText(label, top.x + 10, (top.y + bottom.y) / 2 + 4);
}

function drawWavelengthMarker(ctx: CanvasRenderingContext2D, transform: WaveViewTransform, wave: WaveParams, mediumLengthMeters: number): void {
  const k = waveNumber(wave.wavelength);
  let startX = (Math.PI / 2 - wave.phase) / k;
  startX = ((startX % wave.wavelength) + wave.wavelength) % wave.wavelength;
  const endX = startX + wave.wavelength;
  if (endX > mediumLengthMeters * 0.95) {
    startX -= wave.wavelength;
  }
  const finalStartX = Math.max(startX, 0);
  const finalEndX = finalStartX + wave.wavelength;
  if (finalEndX > mediumLengthMeters) return;

  const y = wave.amplitude * 1.35 + 0.15;
  const p1 = physicsToScreen(transform, finalStartX, y);
  const p2 = physicsToScreen(transform, finalEndX, y);
  ctx.save();
  ctx.strokeStyle = PALETTE.wavelengthMarker;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y - 5);
  ctx.lineTo(p1.x, p1.y + 5);
  ctx.moveTo(p2.x, p2.y - 5);
  ctx.lineTo(p2.x, p2.y + 5);
  ctx.stroke();
  ctx.restore();

  const label = `λ = ${wave.wavelength.toFixed(2)} m`;
  ctx.font = "700 11px system-ui, sans-serif";
  ctx.fillStyle = PALETTE.wavelengthMarker;
  ctx.textAlign = "center";
  ctx.fillText(label, (p1.x + p2.x) / 2, p1.y - 10);
  ctx.textAlign = "left";
}

export interface DrawWaveSceneOptions {
  readonly wave: WaveParams;
  readonly t: number;
  readonly mediumLengthMeters: number;
  readonly maxAmplitude: number;
  readonly showMarkers?: boolean;
  readonly showParticle?: boolean;
}

// The single-wave scene entry point - draws one frame of the primary
// traveling wave from wave params + elapsed time alone. Every position on
// the curve comes straight from wavesPhysics.ts's waveDisplacementAt.
export function drawWaveScene(ctx: CanvasRenderingContext2D, w: number, h: number, options: DrawWaveSceneOptions): void {
  const { wave, t, mediumLengthMeters, maxAmplitude, showMarkers = true, showParticle = true } = options;
  drawBackground(ctx, w, h);
  const transform = computeWaveViewTransform(w, h, maxAmplitude, mediumLengthMeters);
  drawMedium(ctx, transform, w, h);
  drawWaveGlow(ctx, transform, wave, t, mediumLengthMeters);
  strokeWaveCurve(ctx, transform, wave, t, mediumLengthMeters, PALETTE.wave, 3);
  if (showMarkers) {
    drawAmplitudeMarker(ctx, transform, wave, mediumLengthMeters);
    drawWavelengthMarker(ctx, transform, wave, mediumLengthMeters);
  }
  if (showParticle) {
    drawOscillatingParticle(ctx, transform, wave, t);
  }
}

export interface DrawSuperpositionSceneOptions {
  readonly wave1: WaveParams;
  readonly wave2: WaveParams;
  readonly t: number;
  readonly mediumLengthMeters: number;
  readonly maxAmplitude: number;
}

// The two-wave interference scene entry point - draws both component waves
// (thin, distinguishable colors) and their resultant (thick, primary color)
// on the same axes, so a student can visually confirm the resultant is
// exactly the pointwise sum of the two components.
export function drawSuperpositionScene(ctx: CanvasRenderingContext2D, w: number, h: number, options: DrawSuperpositionSceneOptions): void {
  const { wave1, wave2, t, mediumLengthMeters, maxAmplitude } = options;
  drawBackground(ctx, w, h);
  const transform = computeWaveViewTransform(w, h, maxAmplitude, mediumLengthMeters);
  drawMedium(ctx, transform, w, h);
  strokeWaveCurve(ctx, transform, wave1, t, mediumLengthMeters, PALETTE.wave, 1.75);
  strokeWaveCurve(ctx, transform, wave2, t, mediumLengthMeters, PALETTE.wave2, 1.75);
  strokeResultantCurve(ctx, transform, wave1, wave2, t, mediumLengthMeters, PALETTE.resultant);
}

export const WAVE_SCENE_PALETTE = PALETTE;
