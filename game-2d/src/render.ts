import type { Challenge } from "./adaptiveEngine";
import {
  MODULE_PROJECTILE,
  MODULE_NEWTON,
  MODULE_WORK_ENERGY,
  MODULE_MOMENTUM,
  MODULE_CIRCULAR,
  CONCEPT_WORK,
  CONCEPT_GRAVITY_RANGE,
  CONCEPT_KINETIC_ENERGY,
  CONCEPT_WORK_ENERGY_THEOREM,
  CONCEPT_IMPULSE,
  CONCEPT_CONSERVATION_MOMENTUM,
} from "./adaptiveEngine";
import {
  RUN_DURATION_MS,
  experimentPhaseAt,
  runningDisplacementMetersFor,
  IMPULSE_TRACK_DISTANCE_M,
  impulseImpactProgress,
  impulseCartPositionMetersFor,
  impulseHasImpactedAt,
  momentumCollisionProgress,
  momentumCartPositionsMetersFor,
  momentumHasCollidedAt,
  circularSimParamsFor,
  circularAngleAt,
  circularRevolutionsRequired,
  circularRevolutionsCompletedAt,
} from "./experimentRunner";
import { centripetalForceFromSpeed, circularPositionAt, circularTangentDirectionAt, circularInwardDirectionAt } from "./physics";

// Speed & Range and Gravity & Trajectory share the same launch physics but
// solve for different unknowns - controlValue means "launch speed" for one
// and "gravity guess" for the other. This resolves which is which so the
// live preview curve and the actual flight always agree.
function flightParamsFor(challenge: Challenge, controlValue: number): { speed: number; gravity: number } {
  if (challenge.conceptId === CONCEPT_GRAVITY_RANGE) {
    return { speed: challenge.givenSpeed ?? 10, gravity: controlValue };
  }
  return { speed: controlValue, gravity: challenge.gravity ?? 9.8 };
}

export interface DrawState {
  challenge: Challenge;
  controlValue: number;
  phase: "playing" | "flying" | "result" | "transition";
  flightX: number | null;
  flightY: number | null;
  landingDistance: number | null;
  predicted: number;
  target: number;
  // performance.now() timestamp the current "flying" run started, or null
  // when not running - lets Newton/Work&Energy scenes animate real motion
  // (not just projectile flight) at full frame rate, independent of the
  // React state that gates when the result is actually computed.
  runStartedAt: number | null;
  // The current run's physics-derived presentation duration (see
  // experimentRunner.ts's *RunDurationMs functions) - the same value
  // GameCanvas.tsx uses to decide the run has physically completed, so the
  // cart/pod never keeps animating past the moment the result is computed
  // (or stops before it). Falls back to RUN_DURATION_MS when no run is
  // active yet.
  runDurationMs: number | null;
  reducedMotion: boolean;
}

// Smoothed values so force arrows/energy readouts ease toward their target
// each frame instead of snapping - persists across drawScene calls via
// module-level closure state (there is only ever one canvas on screen).
const smoothed = { predicted: 0, control: 0 };

// Idle/ambient animation + short-lived effect state - purely decorative,
// never read by GameCanvas.tsx or the adaptive engine. Nothing here can
// change score, mastery, difficulty or progression.
const anim = {
  lastTime: 0,
  cloudDrift: 0,
  wheelAngle: 0,
  prevPhase: "playing" as DrawState["phase"],
  impactActive: false,
  impactStart: 0,
  impactX: 0,
  flightTrail: [] as { x: number; y: number }[],
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// Deterministic pseudo-random (seeded by index) so foliage/grass texture is
// stable across frames instead of sparkling every repaint.
function hashRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

const PALETTE = {
  cyan: "#19b6d1",
  blue: "#2f6fe0",
  gold: "#f0a916",
  orange: "#e0682c",
  green: "#2f8f4e",
  ink: "#17182b",
  red: "#e6394b",
  electricBlue: "#3d5cff",
  violet: "#8a6cff",
};

export function drawScene(ctx: CanvasRenderingContext2D, w: number, h: number, s: DrawState): void {
  const now = performance.now();
  const dt = anim.lastTime ? clamp((now - anim.lastTime) / 1000, 0, 0.05) : 0.016;
  anim.lastTime = now;
  anim.cloudDrift += dt * 3.5;
  anim.wheelAngle += dt * (1.4 + Math.abs(smoothed.control) * 0.12);

  smoothed.predicted = lerp(smoothed.predicted, s.predicted, 0.15);
  smoothed.control = lerp(smoothed.control, s.controlValue, 0.2);

  // Detect the moment a projectile lands (flying -> result) to fire a short
  // impact burst at the landing spot.
  if (anim.prevPhase === "flying" && s.phase === "result" && s.landingDistance !== null) {
    anim.impactActive = true;
    anim.impactStart = now;
    anim.impactX = s.landingDistance;
  }
  if (s.phase === "flying") {
    anim.flightTrail.push({ x: s.flightX ?? 0, y: s.flightY ?? 0 });
    if (anim.flightTrail.length > 10) anim.flightTrail.shift();
  } else if (s.phase === "playing") {
    anim.flightTrail.length = 0;
  }
  anim.prevPhase = s.phase;

  drawEnvironment(ctx, w, h, s.challenge.moduleId);

  if (s.challenge.moduleId === MODULE_PROJECTILE) {
    drawProjectileScene(ctx, w, h, s, now);
  } else if (s.challenge.moduleId === MODULE_NEWTON) {
    drawTrackScene(ctx, w, h, s, false);
  } else if (s.challenge.moduleId === MODULE_MOMENTUM) {
    drawMomentumScene(ctx, w, h, s, now);
  } else if (s.challenge.moduleId === MODULE_CIRCULAR) {
    drawCircularScene(ctx, w, h, s);
  } else {
    drawTrackScene(ctx, w, h, s, true);
  }
}

const GROUND_Y_RATIO = 0.74;

// --------------------------------------------------------------------------
// Environment - layered sky / hills / trees, tinted per module so each
// experiment feels like its own place without ever turning the game world
// lavender (that palette belongs to the website chrome around it).
// --------------------------------------------------------------------------

interface EnvTheme {
  skyTop: string;
  skyMid: string;
  skyHorizon: string;
  hazeColor: string;
  farHill: string;
  midHill: string;
  groundTop: string;
  groundBottom: string;
  foliageA: string;
  foliageB: string;
  sun: string;
}

function themeFor(moduleId: string): EnvTheme {
  if (moduleId === MODULE_CIRCULAR) {
    // Physics Park circular-motion arena: deep violet dusk sky, electric-
    // blue/cyan haze - distinct from Momentum's own night arena (different
    // hue family: violet/electric-blue/cyan/gold vs. Momentum's blue/cyan)
    // so the two never read as a recolor of each other.
    return {
      skyTop: "#1a1240",
      skyMid: "#382a6e",
      skyHorizon: "#5a3a7e",
      hazeColor: "rgba(122,92,255,0.3)",
      farHill: "#2e2258",
      midHill: "#3f2e6e",
      groundTop: "#3a2f52",
      groundBottom: "#181428",
      foliageA: "#2f2452",
      foliageB: "#42336e",
      sun: "#19b6d1",
    };
  }
  if (moduleId === MODULE_MOMENTUM) {
    // Physics Park collision arena: dusk sky, electric-blue/cyan haze - a
    // distinct "night arena" identity so Momentum never reads as a recolor
    // of the other modules' daylight fields.
    return {
      skyTop: "#141a3d",
      skyMid: "#2a2f6b",
      skyHorizon: "#4a3a6b",
      hazeColor: "rgba(61,92,255,0.28)",
      farHill: "#2e2a52",
      midHill: "#3a2f5e",
      groundTop: "#3a3f52",
      groundBottom: "#1c1f2e",
      foliageA: "#2a2f52",
      foliageB: "#3a3f66",
      sun: "#19b6d1",
    };
  }
  if (moduleId === MODULE_WORK_ENERGY) {
    // Golden-hour energy lab: warm amber sky, dry-grass ground.
    return {
      skyTop: "#5f8fd6",
      skyMid: "#a9c3e8",
      skyHorizon: "#ffdfb0",
      hazeColor: "rgba(255,178,102,0.28)",
      farHill: "#b7a06a",
      midHill: "#c9925a",
      groundTop: "#caa155",
      groundBottom: "#96702f",
      foliageA: "#8a6a2e",
      foliageB: "#b98a3a",
      sun: "#ffcf6b",
    };
  }
  if (moduleId === MODULE_NEWTON) {
    // Crisp blue-cyan-lime test track.
    return {
      skyTop: "#4f92e6",
      skyMid: "#a4d3ee",
      skyHorizon: "#e3f7ee",
      hazeColor: "rgba(180,255,220,0.18)",
      farHill: "#7fb6ad",
      midHill: "#4f9d63",
      groundTop: "#5fae5f",
      groundBottom: "#356b3a",
      foliageA: "#2f6b3e",
      foliageB: "#3f8a4a",
      sun: "#fff1b8",
    };
  }
  // Projectile Motion: open morning field.
  return {
    skyTop: "#4a86dd",
    skyMid: "#8fc0ef",
    skyHorizon: "#e9f6ff",
    hazeColor: "rgba(255,244,214,0.25)",
    farHill: "#7fa6c9",
    midHill: "#5c9f68",
    groundTop: "#5fae5f",
    groundBottom: "#3a7a42",
    foliageA: "#2c6b3a",
    foliageB: "#3f8f4d",
    sun: "#ffe9a6",
  };
}

function drawEnvironment(ctx: CanvasRenderingContext2D, w: number, h: number, moduleId: string): void {
  const groundY = h * GROUND_Y_RATIO;
  const t = themeFor(moduleId);

  const sky = ctx.createLinearGradient(0, 0, 0, groundY);
  sky.addColorStop(0, t.skyTop);
  sky.addColorStop(0.6, t.skyMid);
  sky.addColorStop(1, t.skyHorizon);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, groundY);

  // Atmospheric haze band near the horizon.
  const haze = ctx.createLinearGradient(0, groundY - 90, 0, groundY);
  haze.addColorStop(0, "rgba(255,255,255,0)");
  haze.addColorStop(1, t.hazeColor);
  ctx.fillStyle = haze;
  ctx.fillRect(0, groundY - 90, w, 90);

  if (moduleId === MODULE_CIRCULAR) {
    drawNightStars(ctx, w, groundY);
  }

  drawSun(ctx, w * 0.86, h * 0.16, t.sun);
  drawCloudLayer(ctx, w, h, 0.55, 0.16, 0.5);
  drawCloudLayer(ctx, w, h, 0.85, 0.1, 0.32);

  drawHillLayer(ctx, w, groundY, t.farHill, 26, 0.65);
  scatterFoliage(ctx, w, groundY - 22, t.foliageA, 0.5, 6, 7);

  drawHillLayer(ctx, w, groundY, t.midHill, 48, 1);
  scatterFoliage(ctx, w, groundY - 6, t.foliageB, 0.85, 5, 13);

  // Ground
  const ground = ctx.createLinearGradient(0, groundY, 0, h);
  ground.addColorStop(0, t.groundTop);
  ground.addColorStop(1, t.groundBottom);
  ctx.fillStyle = ground;
  ctx.fillRect(0, groundY, w, h - groundY);
  drawGroundTexture(ctx, w, h, groundY, moduleId);
}

// Twinkling stars for the Circular Motion "Physics Park" dusk sky only -
// purely decorative, seeded so they don't sparkle randomly across frames.
function drawNightStars(ctx: CanvasRenderingContext2D, w: number, groundY: number): void {
  ctx.save();
  for (let i = 0; i < 40; i++) {
    const x = hashRandom(i * 12.7) * w;
    const y = hashRandom(i * 7.3 + 3) * groundY * 0.55;
    const r = 0.6 + hashRandom(i * 3.1 + 9) * 1.2;
    const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(performance.now() / 900 + i));
    ctx.fillStyle = `rgba(255,255,255,${0.5 * twinkle})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSun(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, 70);
  glow.addColorStop(0, "rgba(255,244,214,0.55)");
  glow.addColorStop(1, "rgba(255,244,214,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, 70, 0, Math.PI * 2);
  ctx.fill();

  const core = ctx.createRadialGradient(x - 6, y - 6, 2, x, y, 24);
  core.addColorStop(0, "#fffdf2");
  core.addColorStop(1, color);
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(x, y, 22, 0, Math.PI * 2);
  ctx.fill();
}

function drawCloudLayer(ctx: CanvasRenderingContext2D, w: number, h: number, ySeed: number, opacity: number, speed: number): void {
  const y = h * 0.1 + ySeed * 40;
  for (let i = 0; i < 3; i++) {
    const baseX = ((i * 260 + anim.cloudDrift * speed * 10) % (w + 240)) - 120;
    drawCloud(ctx, baseX, y + i * 22, 0.8 + hashRandom(i + ySeed * 7) * 0.6, opacity);
  }
}

function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, opacity: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const puffs: [number, number, number][] = [
    [0, 0, 22],
    [26, -8, 17],
    [-24, -5, 15],
    [12, 10, 16],
    [-10, 9, 14],
  ];
  for (const [px, py, r] of puffs) {
    const grad = ctx.createRadialGradient(px - r * 0.3, py - r * 0.4, r * 0.1, px, py, r);
    grad.addColorStop(0, `rgba(255,255,255,${opacity + 0.15})`);
    grad.addColorStop(1, `rgba(214,226,238,${opacity})`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawHillLayer(ctx: CanvasRenderingContext2D, w: number, groundY: number, color: string, amp: number, alpha: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, groundY - amp * 0.5);
  ctx.quadraticCurveTo(w * 0.16, groundY - amp * 1.5, w * 0.36, groundY - amp * 0.75);
  ctx.quadraticCurveTo(w * 0.5, groundY - amp * 0.25, w * 0.64, groundY - amp * 1.1);
  ctx.quadraticCurveTo(w * 0.82, groundY - amp * 1.7, w * 0.94, groundY - amp * 0.6);
  ctx.quadraticCurveTo(w * 0.98, groundY - amp * 0.35, w, groundY - amp * 0.5);
  ctx.lineTo(w, groundY + 4);
  ctx.lineTo(0, groundY + 4);
  ctx.closePath();
  ctx.fill();

  // A slightly darker ridge line along the top edge for a crisp silhouette
  // against the sky instead of a soft, hazy edge.
  ctx.globalAlpha = Math.min(1, alpha + 0.15);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function scatterFoliage(ctx: CanvasRenderingContext2D, w: number, baseY: number, tone: string, alpha: number, count: number, seedOffset: number): void {
  for (let i = 0; i < count; i++) {
    const r1 = hashRandom(i * 3.1 + seedOffset);
    const r2 = hashRandom(i * 5.7 + seedOffset + 1);
    const x = 40 + r1 * (w - 80);
    const y = baseY - r2 * 14;
    const scale = alpha; // reuse as a proxy: background layer (0.5) = smaller
    const kind = Math.floor(hashRandom(i * 9.3 + seedOffset) * 3);
    ctx.globalAlpha = alpha < 0.7 ? 0.55 : 0.95;
    if (kind === 0) drawRoundTree(ctx, x, y, 0.55 * scale + 0.4, tone);
    else if (kind === 1) drawPineTree(ctx, x, y, 0.55 * scale + 0.4, tone);
    else drawBush(ctx, x, y, 0.5 * scale + 0.35, tone);
    ctx.globalAlpha = 1;
  }
}

function shadowUnder(ctx: CanvasRenderingContext2D, x: number, groundY: number, rx: number): void {
  const grad = ctx.createRadialGradient(x, groundY, 0, x, groundY, rx);
  grad.addColorStop(0, "rgba(20,30,20,0.28)");
  grad.addColorStop(1, "rgba(20,30,20,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(x, groundY, rx, rx * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawRoundTree(ctx: CanvasRenderingContext2D, x: number, groundY: number, scale: number, tone: string): void {
  ctx.save();
  ctx.translate(x, groundY);
  ctx.scale(scale, scale);
  shadowUnder(ctx, 0, 2, 22);

  // Tapered trunk with a branch fork.
  const trunkGrad = ctx.createLinearGradient(-5, 0, 5, 0);
  trunkGrad.addColorStop(0, "#5a4128");
  trunkGrad.addColorStop(1, "#7a5b36");
  ctx.fillStyle = trunkGrad;
  ctx.beginPath();
  ctx.moveTo(-5, 0);
  ctx.lineTo(-3, -34);
  ctx.lineTo(3, -34);
  ctx.lineTo(5, 0);
  ctx.closePath();
  ctx.fill();

  // Irregular canopy from overlapping lumps, two-tone for a lit side.
  const lumps: [number, number, number][] = [
    [0, -46, 24],
    [-16, -38, 16],
    [16, -40, 17],
    [-6, -58, 15],
    [10, -56, 14],
  ];
  for (const [lx, ly, lr] of lumps) {
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.arc(lx, ly, lr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(-10, -54, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawPineTree(ctx: CanvasRenderingContext2D, x: number, groundY: number, scale: number, tone: string): void {
  ctx.save();
  ctx.translate(x, groundY);
  ctx.scale(scale, scale);
  shadowUnder(ctx, 0, 2, 18);

  ctx.fillStyle = "#5a4128";
  ctx.fillRect(-3, -14, 6, 14);

  const tiers = [
    { y: -14, w: 26, h: 22 },
    { y: -30, w: 20, h: 20 },
    { y: -44, w: 14, h: 18 },
  ];
  for (const tier of tiers) {
    const grad = ctx.createLinearGradient(0, tier.y - tier.h, 0, tier.y);
    grad.addColorStop(0, "#ffffff33");
    grad.addColorStop(0.15, tone);
    grad.addColorStop(1, "#1f3f28");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, tier.y - tier.h);
    ctx.quadraticCurveTo(tier.w * 0.7, tier.y - tier.h * 0.3, tier.w * 0.55, tier.y);
    ctx.lineTo(-tier.w * 0.55, tier.y);
    ctx.quadraticCurveTo(-tier.w * 0.7, tier.y - tier.h * 0.3, 0, tier.y - tier.h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawBush(ctx: CanvasRenderingContext2D, x: number, groundY: number, scale: number, tone: string): void {
  ctx.save();
  ctx.translate(x, groundY);
  ctx.scale(scale, scale);
  shadowUnder(ctx, 0, 1, 16);
  const lumps: [number, number, number][] = [
    [-8, -8, 10],
    [8, -9, 11],
    [0, -14, 10],
  ];
  for (const [lx, ly, lr] of lumps) {
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.arc(lx, ly, lr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawGroundTexture(ctx: CanvasRenderingContext2D, w: number, h: number, groundY: number, moduleId: string): void {
  const isEnergy = moduleId === MODULE_WORK_ENERGY;
  ctx.strokeStyle = isEnergy ? "rgba(90,60,20,0.25)" : "rgba(20,60,20,0.25)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 60; i++) {
    const rx = hashRandom(i * 3.3);
    const ry = hashRandom(i * 7.7 + 1);
    const x = rx * w;
    const y = groundY + 6 + ry * (h - groundY - 10);
    const len = 4 + hashRandom(i * 1.9) * 5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (hashRandom(i * 5.1) - 0.5) * 3, y - len);
    ctx.stroke();
  }
  // A few small rocks for terrain variation.
  ctx.fillStyle = "rgba(90,90,95,0.35)";
  for (let i = 0; i < 5; i++) {
    const x = (0.12 + i * 0.19) * w + hashRandom(i * 4.4) * 20;
    const y = groundY + 14 + hashRandom(i * 8.8) * (h - groundY - 30);
    ctx.beginPath();
    ctx.ellipse(x, y, 6, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// --------------------------------------------------------------------------
// Projectile Motion
// --------------------------------------------------------------------------

const PX_PER_METER = 22;
const LAUNCH_ORIGIN_X = 110;

function drawProjectileScene(ctx: CanvasRenderingContext2D, w: number, h: number, s: DrawState, now: number): void {
  const groundY = h * GROUND_Y_RATIO;
  const originX = LAUNCH_ORIGIN_X;
  const originY = groundY - 16;
  const { speed: flightSpeed, gravity } = flightParamsFor(s.challenge, s.controlValue);

  drawMeasurementTrack(ctx, w, groundY, originX);
  drawTargetBoard(ctx, originX + (s.challenge.targetDistance ?? 0) * PX_PER_METER, originY);

  if (s.phase === "playing" && flightSpeed > 0 && gravity > 0) {
    drawTrajectoryCurve(ctx, originX, originY, flightSpeed, gravity);
  }

  drawLauncher(ctx, originX, originY, s.phase === "playing");

  if (s.phase === "flying" && s.flightX !== null && s.flightY !== null) {
    const x = originX + s.flightX * PX_PER_METER;
    const y = originY - s.flightY * PX_PER_METER;
    drawFlightTrail(ctx, originX, originY);
    drawProjectileBall(ctx, x, y);
  }

  if (anim.impactActive) {
    const elapsed = (now - anim.impactStart) / 1000;
    if (elapsed > 0.6) {
      anim.impactActive = false;
    } else {
      drawImpactBurst(ctx, originX + anim.impactX * PX_PER_METER, originY, elapsed);
    }
  }
}

function drawMeasurementTrack(ctx: CanvasRenderingContext2D, w: number, groundY: number, originX: number): void {
  ctx.strokeStyle = "rgba(60,40,20,0.35)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(originX - 20, groundY + 3);
  ctx.lineTo(w - 20, groundY + 3);
  ctx.stroke();

  ctx.font = "600 11px system-ui, sans-serif";
  for (let m = 5; m <= 25; m += 5) {
    const x = originX + m * PX_PER_METER;
    if (x > w - 24) continue;
    // Small marker post + plaque, embedded in the track rather than
    // floating UI text over the grass.
    ctx.strokeStyle = "rgba(60,40,20,0.55)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x, groundY + 3);
    ctx.lineTo(x, groundY - 9);
    ctx.stroke();
    ctx.fillStyle = "#f4efe2";
    roundRect(ctx, x - 12, groundY - 22, 24, 13, 3);
    ctx.fill();
    ctx.strokeStyle = "rgba(23,24,43,0.25)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = PALETTE.ink;
    ctx.textAlign = "center";
    ctx.fillText(`${m}m`, x, groundY - 12.5);
    ctx.textAlign = "left";
  }
}

function drawLauncher(ctx: CanvasRenderingContext2D, x: number, y: number, showProjectile: boolean): void {
  shadowUnder(ctx, x, y + 2, 28);

  // Base plate.
  const baseGrad = ctx.createLinearGradient(x - 26, y, x + 26, y);
  baseGrad.addColorStop(0, "#5b6472");
  baseGrad.addColorStop(0.5, "#8b96a6");
  baseGrad.addColorStop(1, "#5b6472");
  ctx.fillStyle = baseGrad;
  roundRect(ctx, x - 26, y - 6, 52, 12, 3);
  ctx.fill();

  // Support strut back to a rear leg for a "rig" feel.
  ctx.strokeStyle = "#6b7482";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x - 16, y - 4);
  ctx.lineTo(x - 30, y + 10);
  ctx.stroke();

  // Pivot bolt.
  ctx.fillStyle = "#3c4552";
  ctx.beginPath();
  ctx.arc(x, y - 10, 6, 0, Math.PI * 2);
  ctx.fill();

  // Barrel, angled at 45 degrees.
  ctx.save();
  ctx.translate(x, y - 10);
  ctx.rotate(-Math.PI / 4);
  const barrelGrad = ctx.createLinearGradient(0, -7, 0, 7);
  barrelGrad.addColorStop(0, "#cfd6de");
  barrelGrad.addColorStop(0.35, "#465162");
  barrelGrad.addColorStop(1, "#232a34");
  ctx.fillStyle = barrelGrad;
  roundRect(ctx, -4, -7, 46, 14, 5);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  roundRect(ctx, -2, -5.5, 40, 3, 1.5);
  ctx.fill();
  if (showProjectile) {
    const ballGrad = ctx.createRadialGradient(38, -5, 1, 40, 0, 8);
    ballGrad.addColorStop(0, "#ffe3a8");
    ballGrad.addColorStop(1, PALETTE.orange);
    ctx.fillStyle = ballGrad;
    ctx.beginPath();
    ctx.arc(40, 0, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawTrajectoryCurve(ctx: CanvasRenderingContext2D, originX: number, originY: number, speed: number, gravity: number): void {
  const vy = speed * Math.sin(Math.PI / 4);
  const vx = speed * Math.cos(Math.PI / 4);
  const flightTime = (2 * vy) / gravity;
  const points: { x: number; y: number }[] = [];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const t = (flightTime * i) / steps;
    const x = originX + vx * t * PX_PER_METER;
    const y = originY - (vy * t - 0.5 * gravity * t * t) * PX_PER_METER;
    points.push({ x, y });
  }

  const trace = (lineWidth: number, alpha: number) => {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.strokeStyle = `rgba(25,182,209,${alpha})`;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  };
  trace(9, 0.14);
  trace(2.5, 0.85);

  // Direction chevrons along the curve.
  for (const frac of [0.28, 0.55, 0.8]) {
    const idx = Math.min(points.length - 2, Math.floor(frac * points.length));
    const p0 = points[idx];
    const p1 = points[idx + 1];
    const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    ctx.save();
    ctx.translate(p0.x, p0.y);
    ctx.rotate(angle);
    ctx.fillStyle = "rgba(25,182,209,0.8)";
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, -4);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawFlightTrail(ctx: CanvasRenderingContext2D, originX: number, originY: number): void {
  const trail = anim.flightTrail;
  for (let i = 0; i < trail.length; i++) {
    const alpha = (i / trail.length) * 0.35;
    const x = originX + trail[i].x * PX_PER_METER;
    const y = originY - trail[i].y * PX_PER_METER;
    ctx.fillStyle = `rgba(224,104,44,${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, 3 + (i / trail.length) * 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawProjectileBall(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const grad = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, 9);
  grad.addColorStop(0, "#ffe3a8");
  grad.addColorStop(1, PALETTE.orange);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.fill();
}

function drawTargetBoard(ctx: CanvasRenderingContext2D, x: number, groundY: number): void {
  const impactPulse =
    anim.impactActive && Math.abs(x - (LAUNCH_ORIGIN_X + anim.impactX * PX_PER_METER)) < 30
      ? 1 + Math.max(0, 0.18 - (performance.now() - anim.impactStart) / 1000) * 1.4
      : 1;

  shadowUnder(ctx, x, groundY + 3, 16);

  // Post.
  const postGrad = ctx.createLinearGradient(x - 3, 0, x + 3, 0);
  postGrad.addColorStop(0, "#6b4a2f");
  postGrad.addColorStop(1, "#8a6238");
  ctx.fillStyle = postGrad;
  ctx.fillRect(x - 3, groundY - 34, 6, 34);

  ctx.save();
  ctx.translate(x, groundY - 40);
  ctx.scale(impactPulse, impactPulse);
  ctx.scale(1, 0.86);

  const rings: [number, string][] = [
    [17, PALETTE.ink],
    [13, "#f4efe2"],
    [9, PALETTE.gold],
    [5, PALETTE.orange],
  ];
  for (const [r, color] of rings) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.beginPath();
  ctx.arc(-5, -6, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = PALETTE.ink;
  ctx.font = "700 10px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("TARGET", x, groundY - 64);
  ctx.textAlign = "left";
}

function drawImpactBurst(ctx: CanvasRenderingContext2D, x: number, y: number, elapsed: number): void {
  const progress = clamp(elapsed / 0.55, 0, 1);
  const alpha = 1 - progress;
  const spread = 6 + progress * 26;
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI * 2 * i) / 8;
    const px = x + Math.cos(angle) * spread;
    const py = y - 8 + Math.sin(angle) * spread * 0.6;
    ctx.strokeStyle = i % 2 === 0 ? PALETTE.gold : PALETTE.orange;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x, y - 8);
    ctx.lineTo(px, py);
    ctx.stroke();
  }
  ctx.restore();
}

// --------------------------------------------------------------------------
// Newton's Laws + Work & Energy - share a rail-track environment but with
// distinct hero objects: an experimental cart for Newton, a glowing energy
// pod for Work & Energy, so the two never read as a recolor of each other.
// --------------------------------------------------------------------------

function drawTrackScene(ctx: CanvasRenderingContext2D, w: number, h: number, s: DrawState, isEnergyStation: boolean): void {
  const groundY = h * GROUND_Y_RATIO;
  const trackY = groundY - 34;

  // Real motion during the run, not a decorative animation unrelated to
  // the physics: displacement comes from the same predicted value (Newton)
  // or given distance (Work) the eventual result uses.
  let objOffsetPx = 0;
  if (s.runStartedAt !== null && s.phase === "flying") {
    const durationMs = s.runDurationMs ?? RUN_DURATION_MS;
    const progress = experimentPhaseAt(performance.now() - s.runStartedAt, durationMs).progress;
    const displacementM = runningDisplacementMetersFor(s.challenge, s.controlValue, progress, durationMs);
    const pxPerMeter = isEnergyStation && s.challenge.conceptId === CONCEPT_WORK ? 18 : 15;
    const motionScale = s.reducedMotion ? 0.15 : 1;
    objOffsetPx = clamp(displacementM * pxPerMeter, -160, 160) * motionScale;
  }
  const objX = w * 0.42 + objOffsetPx;

  drawRail(ctx, w, trackY, isEnergyStation);

  if (isEnergyStation && s.challenge.conceptId === CONCEPT_WORK) {
    const distance = s.challenge.distance ?? 5;
    drawDistanceRuler(ctx, objX, trackY, distance);
  }

  if (isEnergyStation) {
    drawEnergyPod(ctx, objX, trackY, smoothed.predicted, s.target);
  } else {
    drawCart(ctx, objX, trackY);
  }

  // Force arrows only make physical sense when the controlled quantity is
  // actually a force in Newtons - Kinetic Energy (velocity) and
  // Work-Energy Theorem (work in Joules) control something else entirely,
  // so drawing a "force" vector scaled by their raw number would be a unit
  // mismatch dressed up as physics.
  const controlIsForce = s.challenge.conceptId !== CONCEPT_KINETIC_ENERGY && s.challenge.conceptId !== CONCEPT_WORK_ENERGY_THEOREM;
  if (controlIsForce) {
    const arrowY = trackY - 58;
    const controlScale = 1.6;
    drawForceArrow(ctx, objX, arrowY, smoothed.control * controlScale, PALETTE.cyan, false, "Applied");

    const targetAccel = s.challenge.targetAcceleration ?? 0;
    if (!isEnergyStation) {
      drawForceArrow(ctx, objX, arrowY - 26, targetAccel * 18, PALETTE.gold, true, "Target");
    }

    if (s.challenge.secondForce !== undefined) {
      drawForceArrow(ctx, objX, arrowY + 26, s.challenge.secondForce * controlScale, PALETTE.orange, false, "Force B");
    } else if (s.challenge.frictionForce !== undefined) {
      drawForceArrow(ctx, objX, arrowY + 26, -s.challenge.frictionForce * controlScale, PALETTE.orange, false, "Friction");
    }
  }

  if (isEnergyStation) {
    drawEnergyMeter(ctx, w, groundY, smoothed.predicted, s.target);
  }
}

function drawRail(ctx: CanvasRenderingContext2D, w: number, trackY: number, warm: boolean): void {
  const left = 60;
  const right = w - 60;

  // Support legs.
  ctx.strokeStyle = warm ? "#8a6a2e" : "#5b6472";
  ctx.lineWidth = 6;
  for (let x = left + 20; x < right; x += 90) {
    ctx.beginPath();
    ctx.moveTo(x, trackY + 14);
    ctx.lineTo(x - 8, trackY + 34);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, trackY + 14);
    ctx.lineTo(x + 8, trackY + 34);
    ctx.stroke();
  }

  // Rail beam.
  const beamGrad = ctx.createLinearGradient(0, trackY - 8, 0, trackY + 14);
  beamGrad.addColorStop(0, warm ? "#f0c988" : "#cfd6de");
  beamGrad.addColorStop(0.5, warm ? "#caa155" : "#8b96a6");
  beamGrad.addColorStop(1, warm ? "#8a6a2e" : "#465162");
  ctx.fillStyle = beamGrad;
  roundRect(ctx, left, trackY - 8, right - left, 20, 5);
  ctx.fill();

  // Rivets.
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  for (let x = left + 14; x < right; x += 34) {
    ctx.beginPath();
    ctx.arc(x, trackY + 2, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawDistanceRuler(ctx: CanvasRenderingContext2D, startX: number, trackY: number, distance: number): void {
  const endX = startX + distance * 18;
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(startX, trackY - 26);
  ctx.lineTo(endX, trackY - 26);
  ctx.moveTo(startX, trackY - 32);
  ctx.lineTo(startX, trackY - 20);
  ctx.moveTo(endX, trackY - 32);
  ctx.lineTo(endX, trackY - 20);
  ctx.stroke();
  ctx.fillStyle = "#f4efe2";
  roundRect(ctx, (startX + endX) / 2 - 24, trackY - 48, 48, 16, 4);
  ctx.fill();
  ctx.strokeStyle = "rgba(23,24,43,0.25)";
  ctx.stroke();
  ctx.fillStyle = PALETTE.ink;
  ctx.font = "700 11px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${distance.toFixed(1)} m`, (startX + endX) / 2, trackY - 37);
  ctx.textAlign = "left";
}

function drawCart(ctx: CanvasRenderingContext2D, x: number, trackY: number): void {
  const cartW = 62;
  const cartH = 30;
  const bodyY = trackY - 8 - cartH;

  shadowUnder(ctx, x, trackY + 4, 34);

  const wheelR = 9;
  const wheelXs = [x - cartW / 2 + 13, x + cartW / 2 - 13];
  ctx.strokeStyle = "#2a2f38";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(wheelXs[0], trackY - 8);
  ctx.lineTo(wheelXs[1], trackY - 8);
  ctx.stroke();

  for (const wx of wheelXs) {
    const wy = trackY - 8;
    const tireGrad = ctx.createRadialGradient(wx - 2, wy - 2, 1, wx, wy, wheelR);
    tireGrad.addColorStop(0, "#4a5561");
    tireGrad.addColorStop(1, "#1c2128");
    ctx.fillStyle = tireGrad;
    ctx.beginPath();
    ctx.arc(wx, wy, wheelR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#c7cdd6";
    ctx.beginPath();
    ctx.arc(wx, wy, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#c7cdd6";
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 4; i++) {
      const a = anim.wheelAngle + (i * Math.PI) / 2;
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.lineTo(wx + Math.cos(a) * wheelR * 0.8, wy + Math.sin(a) * wheelR * 0.8);
      ctx.stroke();
    }
  }

  // Chassis.
  const bodyGrad = ctx.createLinearGradient(x, bodyY, x, bodyY + cartH);
  bodyGrad.addColorStop(0, "#4d84ea");
  bodyGrad.addColorStop(1, "#2555b3");
  ctx.fillStyle = bodyGrad;
  roundRect(ctx, x - cartW / 2, bodyY, cartW, cartH, 8);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  roundRect(ctx, x - cartW / 2 + 4, bodyY + 3, cartW - 8, 5, 2.5);
  ctx.fill();
  ctx.fillStyle = PALETTE.cyan;
  ctx.fillRect(x - cartW / 2 + 6, bodyY + cartH - 9, cartW - 12, 4);
}

function drawEnergyPod(ctx: CanvasRenderingContext2D, x: number, trackY: number, magnitude: number, targetMagnitude: number): void {
  const ref = Math.max(Math.abs(targetMagnitude), Math.abs(magnitude), 1);
  const intensity = clamp(Math.abs(magnitude) / ref, 0.12, 1);
  const podW = 56;
  const podH = 26;
  const bodyY = trackY - 6 - podH;

  shadowUnder(ctx, x, trackY + 4, 32);

  const glowR = 40 + intensity * 24;
  const glow = ctx.createRadialGradient(x, bodyY + podH / 2, 4, x, bodyY + podH / 2, glowR);
  glow.addColorStop(0, `rgba(240,169,22,${0.35 * intensity + 0.08})`);
  glow.addColorStop(1, "rgba(240,169,22,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, bodyY + podH / 2, glowR, 0, Math.PI * 2);
  ctx.fill();

  // Runner skid beneath the pod (it slides, it doesn't roll).
  ctx.fillStyle = "#5b4525";
  roundRect(ctx, x - podW / 2 + 4, trackY - 8, podW - 8, 5, 2.5);
  ctx.fill();

  const bodyGrad = ctx.createLinearGradient(x, bodyY, x, bodyY + podH);
  bodyGrad.addColorStop(0, "#fff3d6");
  bodyGrad.addColorStop(0.4, lerpColor("#caa155", "#ffcf6b", intensity));
  bodyGrad.addColorStop(1, "#8a6a2e");
  ctx.fillStyle = bodyGrad;
  roundRect(ctx, x - podW / 2, bodyY, podW, podH, 13);
  ctx.fill();

  // Glowing core window.
  const coreGrad = ctx.createRadialGradient(x, bodyY + podH / 2, 1, x, bodyY + podH / 2, 10);
  coreGrad.addColorStop(0, "#fff8e6");
  coreGrad.addColorStop(1, `rgba(224,104,44,${0.5 + intensity * 0.5})`);
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(x, bodyY + podH / 2, 8, 0, Math.PI * 2);
  ctx.fill();

  if (intensity > 0.25) {
    for (let i = 0; i < 3; i++) {
      const t = ((performance.now() / 900 + i / 3) % 1);
      const mx = x - podW / 2 - 4 - t * 14;
      ctx.fillStyle = `rgba(255,207,107,${(1 - t) * 0.5 * intensity})`;
      ctx.beginPath();
      ctx.arc(mx, bodyY + podH / 2 + (i - 1) * 6, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function lerpColor(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
  const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
  const r = Math.round(lerp(ar, br, t));
  const g = Math.round(lerp(ag, bg, t));
  const bl = Math.round(lerp(ab, bb, t));
  return `rgb(${r},${g},${bl})`;
}

function drawEnergyMeter(ctx: CanvasRenderingContext2D, w: number, groundY: number, magnitude: number, targetMagnitude: number): void {
  const barX = w - 62;
  const tubeH = 150;
  const tubeY = groundY - tubeH - 14;
  const tubeW = 22;

  const ref = Math.max(Math.abs(targetMagnitude), Math.abs(magnitude), 1);
  const fillFrac = clamp(Math.abs(magnitude) / ref, 0, 1);
  const fillH = fillFrac * (tubeH - 6);

  if (fillFrac > 0.1) {
    const glow = ctx.createRadialGradient(barX + tubeW / 2, tubeY + tubeH - fillH, 2, barX + tubeW / 2, tubeY + tubeH - fillH, 30);
    glow.addColorStop(0, `rgba(240,169,22,${0.3 * fillFrac})`);
    glow.addColorStop(1, "rgba(240,169,22,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(barX + tubeW / 2, tubeY + tubeH - fillH, 30, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(255,255,255,0.35)";
  roundRect(ctx, barX, tubeY, tubeW, tubeH, tubeW / 2);
  ctx.fill();

  ctx.save();
  roundRect(ctx, barX + 3, tubeY + 3, tubeW - 6, tubeH - 6, (tubeW - 6) / 2);
  ctx.clip();
  const fillGrad = ctx.createLinearGradient(0, tubeY + tubeH, 0, tubeY);
  fillGrad.addColorStop(0, PALETTE.gold);
  fillGrad.addColorStop(1, "#ffe9a6");
  ctx.fillStyle = fillGrad;
  ctx.fillRect(barX + 3, tubeY + tubeH - fillH, tubeW - 6, fillH + 6);
  ctx.restore();

  ctx.strokeStyle = "rgba(90,60,20,0.5)";
  ctx.lineWidth = 2;
  roundRect(ctx, barX, tubeY, tubeW, tubeH, tubeW / 2);
  ctx.stroke();

  ctx.fillStyle = PALETTE.ink;
  ctx.font = "700 11px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("ENERGY", barX + tubeW / 2, tubeY - 10);
  ctx.textAlign = "left";
}

function drawForceArrow(ctx: CanvasRenderingContext2D, x: number, y: number, length: number, color: string, thick: boolean, label: string): void {
  const len = clamp(length, -140, 140);
  const dir = len >= 0 ? 1 : -1;
  const absLen = Math.max(Math.abs(len), 10);
  const shaftW = thick ? 6 : 4.5;
  const headLen = thick ? 12 : 9;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);

  const grad = ctx.createLinearGradient(0, 0, absLen, 0);
  grad.addColorStop(0, color);
  grad.addColorStop(1, "rgba(255,255,255,0.4)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, -shaftW / 2);
  ctx.lineTo(absLen - headLen, -shaftW / 2.6);
  ctx.lineTo(absLen - headLen, shaftW / 2.6);
  ctx.lineTo(0, shaftW / 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(absLen, 0);
  ctx.lineTo(absLen - headLen, -headLen * 0.55);
  ctx.lineTo(absLen - headLen, headLen * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "rgba(23,24,43,0.7)";
  ctx.font = "600 9px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, x + dir * (absLen + 4) * 0.5, y - shaftW - 3);
  ctx.textAlign = "left";
}

// --------------------------------------------------------------------------
// Momentum & Collisions - a night-lit "Physics Park" collision arena,
// deliberately distinct from Newton/Work & Energy's daylight rail scenes:
// a glowing electric-blue rail, a red dashed collision marker at the
// track's center, and angular orange/cyan carts with real depth. Every
// position drawn here comes from experimentRunner.ts's momentum/impulse
// kinematics - never a value computed only for display.
// --------------------------------------------------------------------------

const MOMENTUM_PX_PER_METER = 24;

function drawMomentumScene(ctx: CanvasRenderingContext2D, w: number, h: number, s: DrawState, now: number): void {
  const groundY = h * GROUND_Y_RATIO;
  const trackY = groundY - 34;
  const centerX = w * 0.5;

  drawCollisionRail(ctx, w, trackY);
  drawMeasurementGrid(ctx, w, trackY, centerX);

  const durationMs = s.runDurationMs ?? RUN_DURATION_MS;
  const progress =
    s.runStartedAt !== null && s.phase === "flying"
      ? experimentPhaseAt(performance.now() - s.runStartedAt, durationMs).progress
      : s.phase === "result" || s.phase === "transition"
        ? 1
        : 0;

  if (s.challenge.conceptId === CONCEPT_CONSERVATION_MOMENTUM) {
    drawConservationScene(ctx, s.challenge, trackY, centerX, progress, durationMs, now);
  } else if (s.challenge.conceptId === CONCEPT_IMPULSE) {
    drawImpulseSceneMomentum(ctx, s.challenge, trackY, centerX, progress, durationMs, now);
  } else {
    drawSingleMomentumCartScene(ctx, s, trackY, centerX);
  }
}

function drawCollisionRail(ctx: CanvasRenderingContext2D, w: number, trackY: number): void {
  const left = 40;
  const right = w - 40;

  ctx.strokeStyle = "rgba(61,92,255,0.5)";
  ctx.lineWidth = 5;
  for (let x = left + 20; x < right; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, trackY + 14);
    ctx.lineTo(x - 7, trackY + 32);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, trackY + 14);
    ctx.lineTo(x + 7, trackY + 32);
    ctx.stroke();
  }

  const beamGrad = ctx.createLinearGradient(0, trackY - 8, 0, trackY + 14);
  beamGrad.addColorStop(0, "#4a5580");
  beamGrad.addColorStop(0.5, "#232840");
  beamGrad.addColorStop(1, "#12141f");
  ctx.fillStyle = beamGrad;
  roundRect(ctx, left, trackY - 8, right - left, 20, 5);
  ctx.fill();

  ctx.save();
  ctx.globalAlpha = 0.75;
  ctx.strokeStyle = PALETTE.electricBlue;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left, trackY - 8);
  ctx.lineTo(right, trackY - 8);
  ctx.stroke();
  ctx.restore();
}

function drawMeasurementGrid(ctx: CanvasRenderingContext2D, w: number, trackY: number, centerX: number): void {
  ctx.strokeStyle = "rgba(25,182,209,0.25)";
  ctx.lineWidth = 1;
  for (let m = -9; m <= 9; m++) {
    const x = centerX + m * MOMENTUM_PX_PER_METER;
    if (x < 44 || x > w - 44) continue;
    ctx.beginPath();
    ctx.moveTo(x, trackY - 8);
    ctx.lineTo(x, trackY + 14);
    ctx.stroke();
  }

  ctx.save();
  ctx.strokeStyle = PALETTE.red;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(centerX, trackY - 46);
  ctx.lineTo(centerX, trackY + 14);
  ctx.stroke();
  ctx.restore();
}

function drawMomentumCart(ctx: CanvasRenderingContext2D, x: number, trackY: number, accentColor: string, label: string): void {
  const cartW = 58;
  const cartH = 32;
  const bodyY = trackY - 10 - cartH;

  shadowUnder(ctx, x, trackY + 4, 32);

  const wheelR = 8;
  const wheelXs = [x - cartW / 2 + 12, x + cartW / 2 - 12];
  for (const wx of wheelXs) {
    const wy = trackY - 8;
    const tireGrad = ctx.createRadialGradient(wx - 2, wy - 2, 1, wx, wy, wheelR);
    tireGrad.addColorStop(0, "#5a6577");
    tireGrad.addColorStop(1, "#14161f");
    ctx.fillStyle = tireGrad;
    ctx.beginPath();
    ctx.arc(wx, wy, wheelR, 0, Math.PI * 2);
    ctx.fill();
  }

  // Angular, wedge-shaped chassis - deliberately distinct from Newton's
  // rounded cart, giving Momentum's carts their own visual identity.
  const bodyGrad = ctx.createLinearGradient(x, bodyY, x, bodyY + cartH);
  bodyGrad.addColorStop(0, lerpColor(accentColor, "#ffffff", 0.55));
  bodyGrad.addColorStop(1, accentColor);
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(x - cartW / 2, bodyY + cartH);
  ctx.lineTo(x - cartW / 2 + 7, bodyY + 6);
  ctx.lineTo(x + cartW / 2 - 7, bodyY + 6);
  ctx.lineTo(x + cartW / 2, bodyY + cartH);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.35)";
  roundRect(ctx, x - 14, bodyY + 10, 28, 9, 3);
  ctx.fill();

  ctx.fillStyle = "#0e0f18";
  roundRect(ctx, x - 12, bodyY - 17, 24, 14, 3);
  ctx.fill();
  ctx.fillStyle = accentColor;
  ctx.font = "800 11px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, x, bodyY - 7);
  ctx.textAlign = "left";
}

function drawImpactPad(ctx: CanvasRenderingContext2D, x: number, trackY: number, impacted: boolean): void {
  const glow = impacted ? 1 : 0.4;
  const grad = ctx.createRadialGradient(x, trackY - 20, 2, x, trackY - 20, 34);
  grad.addColorStop(0, `rgba(230,57,75,${0.5 * glow})`);
  grad.addColorStop(1, "rgba(230,57,75,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, trackY - 20, 34, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = PALETTE.red;
  roundRect(ctx, x - 8, trackY - 44, 16, 44, 4);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  roundRect(ctx, x - 8, trackY - 44, 5, 44, 2);
  ctx.fill();
}

// Two carts approaching, colliding once (never teleporting through each
// other), then separating (elastic) or sticking together (perfectly
// inelastic) - the flagship visual for Conservation of Momentum. Every
// position comes from momentumCartPositionsMetersFor, the same function the
// experiment's real physics uses.
function drawConservationScene(
  ctx: CanvasRenderingContext2D,
  challenge: Challenge,
  trackY: number,
  centerX: number,
  progress: number,
  durationMs: number,
  now: number,
): void {
  const positions = momentumCartPositionsMetersFor(challenge, progress, durationMs);
  const xA = centerX + positions.xA * MOMENTUM_PX_PER_METER;
  const xB = centerX + positions.xB * MOMENTUM_PX_PER_METER;
  const collisionP = momentumCollisionProgress(challenge, durationMs);
  const collided = momentumHasCollidedAt(challenge, progress, durationMs);

  drawMomentumCart(ctx, xA, trackY, PALETTE.orange, "A");
  drawMomentumCart(ctx, xB, trackY, PALETTE.cyan, "B");

  const arrowY = trackY - 66;
  const shownVel1 = collided ? challenge.finalVelocity1 ?? 0 : challenge.velocity1 ?? 0;
  const shownVel2 = collided ? challenge.finalVelocity2 ?? 0 : challenge.velocity2 ?? 0;
  drawForceArrow(ctx, xA, arrowY, shownVel1 * 6, PALETTE.orange, false, `${shownVel1.toFixed(1)} m/s`);
  drawForceArrow(ctx, xB, arrowY, shownVel2 * 6, PALETTE.cyan, false, `${shownVel2.toFixed(1)} m/s`);

  if (collided && progress < collisionP + 0.15) {
    void now;
    const localElapsed = ((progress - collisionP) / 0.15) * 0.5;
    drawImpactBurst(ctx, (xA + xB) / 2, trackY - 8, localElapsed);
  }
}

// A single cart approaching a spring-loaded impact pad, then departing at a
// new, real physical velocity - see impulseCartPositionMetersFor. The pad
// visibly reacts (a red glow burst) only once the cart has actually reached
// it, never before.
function drawImpulseSceneMomentum(
  ctx: CanvasRenderingContext2D,
  challenge: Challenge,
  trackY: number,
  centerX: number,
  progress: number,
  durationMs: number,
  now: number,
): void {
  void now;
  const startX = centerX - 150;
  const impactP = impulseImpactProgress(challenge, durationMs);
  const padX = startX + IMPULSE_TRACK_DISTANCE_M * MOMENTUM_PX_PER_METER;

  const displacementM = impulseCartPositionMetersFor(challenge, progress, durationMs);
  const cartX = startX + displacementM * MOMENTUM_PX_PER_METER;
  const impacted = impulseHasImpactedAt(challenge, progress, durationMs);

  drawImpactPad(ctx, padX, trackY, impacted);
  drawMomentumCart(ctx, cartX, trackY, PALETTE.orange, "A");

  const vi = challenge.initialVelocity ?? 0;
  const vf = challenge.finalVelocity ?? vi;
  const shownVelocity = impacted ? vf : vi;
  drawForceArrow(ctx, cartX, trackY - 66, shownVelocity * 6, PALETTE.orange, false, `${shownVelocity.toFixed(1)} m/s`);

  if (impacted && progress < impactP + 0.15) {
    const localElapsed = ((progress - impactP) / 0.15) * 0.5;
    drawImpactBurst(ctx, padX, trackY - 8, localElapsed);
  }
}

// The Momentum concept (p = mv) is deliberately simple - a single cart
// cruising at its given/guessed velocity, no collision event yet (see the
// module's spec: "collision complexity can be low" for this first concept).
function drawSingleMomentumCartScene(ctx: CanvasRenderingContext2D, s: DrawState, trackY: number, centerX: number): void {
  let objOffsetPx = 0;
  if (s.runStartedAt !== null && s.phase === "flying") {
    const durationMs = s.runDurationMs ?? RUN_DURATION_MS;
    const progress = experimentPhaseAt(performance.now() - s.runStartedAt, durationMs).progress;
    const displacementM = runningDisplacementMetersFor(s.challenge, s.controlValue, progress, durationMs);
    objOffsetPx = displacementM * MOMENTUM_PX_PER_METER;
  }
  const x = centerX - 80 + objOffsetPx;
  drawMomentumCart(ctx, x, trackY, PALETTE.orange, "A");

  const velocity = s.challenge.velocity ?? s.controlValue;
  drawForceArrow(ctx, x, trackY - 66, velocity * 6, PALETTE.orange, false, `${velocity.toFixed(1)} m/s`);
}

// --------------------------------------------------------------------------
// Circular Motion - "Ferris Wheel Physics Park": a large illustrated Ferris
// wheel standing in an evening park (lamp posts, benches, a pathway), with
// structural supports, rotating spokes, rim lights, and upright passenger
// gondolas. This is a pure re-skin of the same uniform-circular-motion
// visualization the module always had - the highlighted gondola is simply
// the previous "orbiting object" drawn as a cabin instead of a pod, at the
// exact same angle, and the whole wheel (rim, spokes, every gondola) turns
// by that one tracked angle. No outward "centrifugal" arrow is ever drawn
// here (see physics.ts's circularInwardDirectionAt doc comment: this is the
// inertial-frame view). Every position/vector still comes from physics.ts's
// circularPositionAt/circularTangentDirectionAt/circularInwardDirectionAt
// and experimentRunner.ts's circularSimParamsFor/circularAngleAt - never a
// value computed only for display. There is only ever one circular-motion
// simulation; the wheel never invents its own rotation.
// --------------------------------------------------------------------------

const FERRIS_CABIN_COUNT = 8;

function drawCircularScene(ctx: CanvasRenderingContext2D, w: number, h: number, s: DrawState): void {
  const centerX = w * 0.52;
  const centerY = h * 0.4;
  const groundY = h * GROUND_Y_RATIO;

  const { mass, radius, speed } = circularSimParamsFor(s.challenge, s.controlValue);
  const safeRadius = radius > 0 && Number.isFinite(radius) ? radius : s.challenge.radius ?? 1.5;
  const safeSpeed = speed > 0 && Number.isFinite(speed) ? speed : s.challenge.speed ?? 3;

  // A fixed on-screen size band regardless of the challenge's true radius
  // (1-4m across difficulty tiers) - larger true radii use a smaller
  // meters-per-pixel scale so the wheel stays comfortably on screen while
  // still visually growing/shrinking with the real radius.
  const pxPerMeter = clamp(130 / Math.max(safeRadius, 0.5), 22, 56);
  const radiusPx = safeRadius * pxPerMeter;

  const durationMs = s.runDurationMs ?? RUN_DURATION_MS;
  const progress =
    s.phase === "flying" && s.runStartedAt !== null
      ? experimentPhaseAt(performance.now() - s.runStartedAt, durationMs).progress
      : s.phase === "result" || s.phase === "transition"
        ? 1
        : 0;
  const angle = circularAngleAt(s.challenge, progress);

  drawParkForeground(ctx, w, groundY, centerX);
  drawFerrisSupports(ctx, centerX, centerY, groundY);
  drawFerrisSpokes(ctx, centerX, centerY, radiusPx, angle);
  drawFerrisRim(ctx, centerX, centerY, radiusPx);
  drawFerrisCabins(ctx, centerX, centerY, radiusPx, angle);
  drawFerrisHub(ctx, centerX, centerY);

  const pos = circularPositionAt(radiusPx, angle);
  const objX = centerX + pos.x;
  const objY = centerY + pos.y;
  const tangent = circularTangentDirectionAt(angle);
  const inward = circularInwardDirectionAt(angle);
  const tangentAngle = Math.atan2(tangent.y, tangent.x);
  const inwardAngle = Math.atan2(inward.y, inward.x);

  const centripetalForceN = centripetalForceFromSpeed(mass, safeSpeed, safeRadius);
  drawVectorArrow(ctx, objX, objY, tangentAngle, clamp(safeSpeed * 7, 16, 90), PALETTE.cyan, "VELOCITY", `${safeSpeed.toFixed(1)} m/s`);
  drawVectorArrow(ctx, objX, objY, inwardAngle, clamp(centripetalForceN * 0.8, 16, 90), PALETTE.gold, "CENTRIPETAL FORCE", `Fc = ${centripetalForceN.toFixed(1)} N`);

  const revolutionsCompleted = circularRevolutionsCompletedAt(s.challenge, progress);
  drawLapSign(ctx, centerX, centerY, radiusPx, revolutionsCompleted, circularRevolutionsRequired(s.challenge));
}

// A curved evening pathway plus a couple of lamp posts and benches flanking
// the wheel - just enough park identity to read as "a place", never busy
// enough to compete with the wheel itself.
function drawParkForeground(ctx: CanvasRenderingContext2D, w: number, groundY: number, cx: number): void {
  ctx.save();
  ctx.fillStyle = "rgba(70,58,110,0.4)";
  ctx.beginPath();
  ctx.moveTo(0, groundY + 42);
  ctx.quadraticCurveTo(w * 0.5, groundY + 20, w, groundY + 42);
  ctx.lineTo(w, groundY + 74);
  ctx.quadraticCurveTo(w * 0.5, groundY + 50, 0, groundY + 74);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(150,130,210,0.25)";
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(0, groundY + 58);
  ctx.quadraticCurveTo(w * 0.5, groundY + 35, w, groundY + 58);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  drawLampPost(ctx, cx - 210, groundY);
  drawLampPost(ctx, cx + 210, groundY);
  drawBench(ctx, cx - 275, groundY);
  drawBench(ctx, cx + 275, groundY);
}

function drawLampPost(ctx: CanvasRenderingContext2D, x: number, groundY: number): void {
  shadowUnder(ctx, x, groundY + 2, 10);
  ctx.strokeStyle = "#241a3e";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x, groundY);
  ctx.lineTo(x, groundY - 60);
  ctx.stroke();
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x - 7, groundY - 60);
  ctx.lineTo(x + 7, groundY - 60);
  ctx.stroke();

  const flicker = 0.75 + 0.25 * Math.sin(performance.now() / 620 + x);
  const glow = ctx.createRadialGradient(x, groundY - 63, 0, x, groundY - 63, 22);
  glow.addColorStop(0, `rgba(255,225,160,${0.75 * flicker})`);
  glow.addColorStop(1, "rgba(255,225,160,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, groundY - 63, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff4d6";
  ctx.beginPath();
  ctx.arc(x, groundY - 63, 5, 0, Math.PI * 2);
  ctx.fill();
}

function drawBench(ctx: CanvasRenderingContext2D, x: number, groundY: number): void {
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "#3a2f52";
  roundRect(ctx, x - 17, groundY - 15, 34, 4, 2);
  ctx.fill();
  roundRect(ctx, x - 17, groundY - 6, 34, 4, 2);
  ctx.fill();
  ctx.fillRect(x - 15, groundY - 11, 2.5, 11);
  ctx.fillRect(x + 12.5, groundY - 11, 2.5, 11);
  ctx.restore();
}

// The wheel's fixed A-frame support legs, converging on a static axle beam
// at the hub - the one part of the structure that never rotates.
function drawFerrisSupports(ctx: CanvasRenderingContext2D, cx: number, cy: number, groundY: number): void {
  const baseSpread = 78;
  const topOffset = 20;
  const hubY = cy + 6;

  shadowUnder(ctx, cx - baseSpread, groundY + 2, 16);
  shadowUnder(ctx, cx + baseSpread, groundY + 2, 16);

  const legs: [number, number, number, number, number][] = [
    [cx - baseSpread, groundY, cx - topOffset, hubY, 7],
    [cx + baseSpread, groundY, cx + topOffset, hubY, 7],
    [cx - baseSpread * 0.5, groundY, cx + topOffset, hubY, 3],
    [cx + baseSpread * 0.5, groundY, cx - topOffset, hubY, 3],
  ];
  ctx.save();
  ctx.lineCap = "round";
  for (const [x1, y1, x2, y2, lw] of legs) {
    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    grad.addColorStop(0, "#211838");
    grad.addColorStop(0.55, "#5a4a92");
    grad.addColorStop(1, "#9a86d9");
    ctx.strokeStyle = grad;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.strokeStyle = "#4a3a7e";
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(cx - topOffset - 8, hubY);
  ctx.lineTo(cx + topOffset + 8, hubY);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - topOffset - 8, hubY - 3);
  ctx.lineTo(cx + topOffset + 8, hubY - 3);
  ctx.stroke();
  ctx.restore();
}

// The rim: a glowing metallic ring with a string of small colored bulbs -
// premium illumination rather than neon overload.
function drawFerrisRim(ctx: CanvasRenderingContext2D, cx: number, cy: number, radiusPx: number): void {
  const glow = ctx.createRadialGradient(cx, cy, radiusPx * 0.75, cx, cy, radiusPx * 1.18);
  glow.addColorStop(0, "rgba(122,92,255,0)");
  glow.addColorStop(0.85, "rgba(122,92,255,0.22)");
  glow.addColorStop(1, "rgba(122,92,255,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, radiusPx * 1.18, 0, Math.PI * 2);
  ctx.fill();

  const rimGrad = ctx.createLinearGradient(cx - radiusPx, cy - radiusPx, cx + radiusPx, cy + radiusPx);
  rimGrad.addColorStop(0, "#d8d4ff");
  rimGrad.addColorStop(0.45, PALETTE.electricBlue);
  rimGrad.addColorStop(1, "#241a44");
  ctx.save();
  ctx.strokeStyle = rimGrad;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(cx, cy, radiusPx, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(cx, cy, radiusPx - 5.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  const bulbCount = 16;
  const bulbColors = [PALETTE.violet, PALETTE.electricBlue, PALETTE.cyan, PALETTE.gold];
  for (let i = 0; i < bulbCount; i++) {
    const a = (i / bulbCount) * Math.PI * 2;
    const bx = cx + Math.cos(a) * radiusPx;
    const by = cy + Math.sin(a) * radiusPx;
    const color = bulbColors[i % bulbColors.length];
    const twinkle = 0.6 + 0.4 * Math.sin(performance.now() / 500 + i * 1.7);
    const bulbGlow = ctx.createRadialGradient(bx, by, 0, bx, by, 6);
    bulbGlow.addColorStop(0, color);
    bulbGlow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save();
    ctx.globalAlpha = twinkle;
    ctx.fillStyle = bulbGlow;
    ctx.beginPath();
    ctx.arc(bx, by, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff8e6";
    ctx.beginPath();
    ctx.arc(bx, by, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// Structural spokes rotate with the same tracked angle as everything else -
// there is no separate decorative rotation to keep in sync.
function drawFerrisSpokes(ctx: CanvasRenderingContext2D, cx: number, cy: number, radiusPx: number, wheelAngle: number): void {
  ctx.save();
  ctx.strokeStyle = "rgba(210,200,255,0.28)";
  ctx.lineWidth = 2;
  const spokeCount = FERRIS_CABIN_COUNT * 2;
  for (let i = 0; i < spokeCount; i++) {
    const a = wheelAngle + (i / spokeCount) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a) * radiusPx, cy + Math.sin(a) * radiusPx);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFerrisHub(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  const pulse = 0.85 + 0.15 * Math.sin(performance.now() / 500);
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 24 * pulse);
  glow.addColorStop(0, "rgba(240,169,22,0.6)");
  glow.addColorStop(1, "rgba(240,169,22,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, 24 * pulse, 0, Math.PI * 2);
  ctx.fill();

  const hubGrad = ctx.createRadialGradient(cx - 3, cy - 3, 1, cx, cy, 9);
  hubGrad.addColorStop(0, "#fff3d6");
  hubGrad.addColorStop(1, PALETTE.gold);
  ctx.fillStyle = hubGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "700 8px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("CENTER", cx, cy + 22);
  ctx.textAlign = "left";
}

// Every gondola's angle comes from the same tracked `wheelAngle` (the
// physics theta) offset by a fixed phase - the whole wheel rotates as one
// rigid body and cabin 0 always lands exactly on the tracked rider's
// position. Cabins are only ever translated, never rotated, so they read as
// hanging gondolas rather than dots pinned to a spinning disc. Drawn back-
// to-front so the highlighted (tracked) cabin always renders on top.
function drawFerrisCabins(ctx: CanvasRenderingContext2D, cx: number, cy: number, radiusPx: number, wheelAngle: number): void {
  for (let i = FERRIS_CABIN_COUNT - 1; i >= 0; i--) {
    const a = wheelAngle + (i / FERRIS_CABIN_COUNT) * Math.PI * 2;
    const x = cx + Math.cos(a) * radiusPx;
    const y = cy + Math.sin(a) * radiusPx;
    drawGondola(ctx, x, y, i === 0);
  }
}

function drawGondola(ctx: CanvasRenderingContext2D, x: number, y: number, highlighted: boolean): void {
  ctx.save();
  ctx.translate(x, y);

  if (highlighted) {
    const pulse = 0.85 + 0.15 * Math.sin(performance.now() / 260);
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 22 * pulse);
    glow.addColorStop(0, "rgba(25,182,209,0.55)");
    glow.addColorStop(1, "rgba(25,182,209,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 22 * pulse, 0, Math.PI * 2);
    ctx.fill();
  }

  const gw = highlighted ? 17 : 12;
  const gh = highlighted ? 21 : 15;
  const bodyGrad = ctx.createLinearGradient(-gw / 2, -gh / 2, gw / 2, gh / 2);
  if (highlighted) {
    bodyGrad.addColorStop(0, "#fff6d0");
    bodyGrad.addColorStop(1, PALETTE.gold);
  } else {
    bodyGrad.addColorStop(0, "#d6d4ff");
    bodyGrad.addColorStop(1, "#6a5ea8");
  }
  ctx.fillStyle = bodyGrad;
  roundRect(ctx, -gw / 2, -gh / 2, gw, gh, 4);
  ctx.fill();
  ctx.strokeStyle = highlighted ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.3)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = highlighted ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.45)";
  ctx.beginPath();
  ctx.arc(0, -gh * 0.08, gw * 0.24, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// A rotatable vector arrow (unlike drawForceArrow, which only ever points
// left/right) - used for the velocity (tangent) and centripetal force
// (inward) vectors, which point in a continuously changing direction as the
// object orbits. Draws a small caption above the numeric readout so both
// the name and the value are visible without a textbook-sized label.
function drawVectorArrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  length: number,
  color: string,
  caption: string,
  valueText: string,
): void {
  const len = Math.max(length, 10);
  const shaftW = 5;
  const headLen = 11;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  const grad = ctx.createLinearGradient(0, 0, len, 0);
  grad.addColorStop(0, color);
  grad.addColorStop(1, "rgba(255,255,255,0.45)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, -shaftW / 2);
  ctx.lineTo(len - headLen, -shaftW / 2.6);
  ctx.lineTo(len - headLen, shaftW / 2.6);
  ctx.lineTo(0, shaftW / 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(len, 0);
  ctx.lineTo(len - headLen, -headLen * 0.55);
  ctx.lineTo(len - headLen, headLen * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const lx = x + Math.cos(angle) * (len + 18);
  const ly = y + Math.sin(angle) * (len + 18);
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "700 8px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(caption, lx, ly - 8);
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = "700 10px system-ui, sans-serif";
  ctx.fillText(valueText, lx, ly + 4);
  ctx.textAlign = "left";
}

function drawLapSign(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radiusPx: number,
  revolutionsCompleted: number,
  revolutionsRequired: number,
): void {
  const y = cy - radiusPx - 26;
  const text = `Rev ${revolutionsCompleted.toFixed(1)} / ${revolutionsRequired}`;
  ctx.font = "700 11px system-ui, sans-serif";
  const textW = ctx.measureText(text).width;
  ctx.fillStyle = "rgba(23,18,45,0.55)";
  roundRect(ctx, cx - textW / 2 - 10, y - 13, textW + 20, 22, 11);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.textAlign = "center";
  ctx.fillText(text, cx, y + 3);
  ctx.textAlign = "left";
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
