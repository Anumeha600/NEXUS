import { describe, it, expect } from "vitest";
import { computeWaveViewTransform, physicsToScreen } from "./wavesRender";

const W = 800;
const H = 400;

describe("wavesRender - physics-to-screen transform", () => {
  it("places the origin (x=0, y=0) at the left edge and vertical center", () => {
    const transform = computeWaveViewTransform(W, H, 2, 6);
    const origin = physicsToScreen(transform, 0, 0);
    expect(origin.x).toBe(transform.originX);
    expect(origin.y).toBe(H / 2);
  });

  it("a positive displacement maps to a smaller screen-y (up), negative maps to larger screen-y (down)", () => {
    const transform = computeWaveViewTransform(W, H, 2, 6);
    const up = physicsToScreen(transform, 1, 1);
    const down = physicsToScreen(transform, 1, -1);
    const mid = physicsToScreen(transform, 1, 0);
    expect(up.y).toBeLessThan(mid.y);
    expect(down.y).toBeGreaterThan(mid.y);
  });

  it("increasing x always increases screen-x (wave travels left to right)", () => {
    const transform = computeWaveViewTransform(W, H, 2, 6);
    const p1 = physicsToScreen(transform, 1, 0);
    const p2 = physicsToScreen(transform, 2, 0);
    expect(p2.x).toBeGreaterThan(p1.x);
  });

  it("a taller maxAmplitude produces a smaller vertical scale (pxPerMeterY), so bigger waves still fit", () => {
    const small = computeWaveViewTransform(W, H, 1, 6);
    const large = computeWaveViewTransform(W, H, 4, 6);
    expect(large.pxPerMeterY).toBeLessThan(small.pxPerMeterY);
  });

  it("a longer medium produces a smaller horizontal scale (pxPerMeterX)", () => {
    const short = computeWaveViewTransform(W, H, 2, 4);
    const long = computeWaveViewTransform(W, H, 2, 12);
    expect(long.pxPerMeterX).toBeLessThan(short.pxPerMeterX);
  });

  it("degenerate (zero) amplitude/medium length never produces NaN or Infinity", () => {
    const transform = computeWaveViewTransform(W, H, 0, 0);
    expect(Number.isFinite(transform.pxPerMeterX)).toBe(true);
    expect(Number.isFinite(transform.pxPerMeterY)).toBe(true);
  });
});
