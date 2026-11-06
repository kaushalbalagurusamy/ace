import { describe, it, expect } from 'vitest';
import { edgePoint, headingVector, mapArrowRotation, pinOpacity, toMarker, wrapAngle } from '../src/client/overlay';

describe('screen-space projection and edge clamping', () => {
  const W = 1280, H = 720;
  it('a point at the centre of the view is on screen at the centre', () => { const m = toMarker(0, 0, false, W, H); expect(m.onScreen).toBe(true); expect(m.x).toBeCloseTo(640, 6); expect(m.y).toBeCloseTo(360, 6); });
  it('ndc (1, 1) is the top-right corner and is outside the margin; ndc beyond +-1 is off screen', () => {
    expect(toMarker(1, 1, false, W, H)).toMatchObject({ x: 1280, y: 0, onScreen: false }); expect(toMarker(2, 0, false, W, H).onScreen).toBe(false); expect(toMarker(0, -3, false, W, H).onScreen).toBe(false);
    expect(toMarker(0.9, 0.9, false, W, H).onScreen).toBe(true);
  });
  it('a point behind the camera is never on screen, even with in-range ndc, and its direction flips', () => {
    const ahead = toMarker(0.5, 0, false, W, H), behind = toMarker(0.5, 0, true, W, H);
    expect(behind.onScreen).toBe(false); expect(Math.abs(wrapAngle(behind.dir - ahead.dir))).toBeCloseTo(Math.PI, 6);
  });
  it('the direction points from the screen centre toward the marker (right = 0, down = +PI/2)', () => {
    expect(toMarker(2, 0, false, W, H).dir).toBeCloseTo(0, 6); expect(toMarker(0, -2, false, W, H).dir).toBeCloseTo(Math.PI / 2, 6); expect(toMarker(0, 2, false, W, H).dir).toBeCloseTo(-Math.PI / 2, 6);
  });
  it('edgePoint clamps to the inset ellipse for every direction, never outside the screen', () => {
    for (let i = 0; i < 72; i++) { const p = edgePoint((i / 72) * 2 * Math.PI, W, H, 70); expect(p.x).toBeGreaterThanOrEqual(69.9); expect(p.x).toBeLessThanOrEqual(W - 69.9); expect(p.y).toBeGreaterThanOrEqual(69.9); expect(p.y).toBeLessThanOrEqual(H - 69.9); }
    expect(edgePoint(0, W, H, 70)).toEqual({ x: 1210, y: 360 }); expect(edgePoint(Math.PI / 2, W, H, 70).y).toBeCloseTo(650, 6);
  });
});

describe('pin indicator fade', () => {
  it('fully visible at 50 yd and beyond, fading out between 50 and 30 yd, gone at 30 yd and closer', () => {
    expect(pinOpacity(600)).toBe(1); expect(pinOpacity(50)).toBe(1); expect(pinOpacity(40)).toBeCloseTo(0.5, 10); expect(pinOpacity(30)).toBe(0); expect(pinOpacity(5)).toBe(0);
  });
  it('opacity never leaves 0..1 and is monotone in the distance', () => { let prev = 0; for (let d = 0; d <= 700; d += 5) { const o = pinOpacity(d); expect(o).toBeGreaterThanOrEqual(0); expect(o).toBeLessThanOrEqual(1); expect(o).toBeGreaterThanOrEqual(prev); prev = o; } });
});

describe('mini-map heading arrow (camera yaw in stance = the aim direction)', () => {
  it('wrapAngle maps to (-PI, PI] across many turns', () => {
    expect(wrapAngle(0)).toBe(0); expect(wrapAngle(Math.PI)).toBeCloseTo(Math.PI, 10); expect(wrapAngle(-Math.PI)).toBeCloseTo(Math.PI, 10); expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI, 10);
    expect(wrapAngle(2 * Math.PI + 0.3)).toBeCloseTo(0.3, 10); expect(wrapAngle(-2 * Math.PI - 0.3)).toBeCloseTo(-0.3, 10); expect(wrapAngle(7.5)).toBeCloseTo(7.5 - 2 * Math.PI, 10);
  });
  it('yaw 0 points up the map toward the pin; a quarter turn right points right; the rotation wraps without jumping', () => {
    expect(mapArrowRotation(0)).toBe(0); expect(mapArrowRotation(Math.PI / 2)).toBeCloseTo(Math.PI / 2, 10); expect(mapArrowRotation(2 * Math.PI + 0.1)).toBeCloseTo(0.1, 10);
    const v0 = headingVector(0), v1 = headingVector(Math.PI / 2); expect(v0.x).toBeCloseTo(0, 10); expect(v0.z).toBeCloseTo(1, 10); expect(v1.x).toBeCloseTo(1, 10); expect(v1.z).toBeCloseTo(0, 10);
  });
  it('a small yaw step changes the rotation by the same small step across the 0/2PI seam (no jitter)', () => {
    const a = mapArrowRotation(2 * Math.PI - 0.01), b = mapArrowRotation(2 * Math.PI + 0.01); expect(Math.abs(wrapAngle(b - a))).toBeCloseTo(0.02, 10);
  });
});
