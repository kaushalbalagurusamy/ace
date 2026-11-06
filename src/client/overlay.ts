// Pure screen-space helpers for the HUD overlays: the ball marker, the pin indicator and the mini-map heading arrow.

export interface Marker { x: number; y: number; onScreen: boolean; dir: number }
/** Projects normalised device coordinates to pixels. If the point is behind the camera or outside the margin it is off screen, and `dir` is the
 *  screen angle (radians, 0 = right, +y down) from the screen centre toward it (flipped for points behind the camera, as a projected point mirrors). */
export function toMarker(ndcX: number, ndcY: number, behind: boolean, W: number, H: number, margin = 20): Marker {
  const x = (ndcX * 0.5 + 0.5) * W, y = (-ndcY * 0.5 + 0.5) * H, onScreen = !behind && x > margin && x < W - margin && y > margin && y < H - margin;
  const s = behind ? -1 : 1;
  return { x, y, onScreen, dir: Math.atan2(s * (y - H / 2), s * (x - W / 2)) };
}
/** Where to draw an edge arrow for an off-screen marker: on the ellipse inside the screen edge, clamped to the margin. */
export function edgePoint(dir: number, W: number, H: number, inset = 70): { x: number; y: number } {
  const cx = W / 2, cy = H / 2, rx = cx - inset, ry = cy - inset, t = 1 / Math.max(Math.abs(Math.cos(dir)) / rx, Math.abs(Math.sin(dir)) / ry);
  return { x: cx + Math.cos(dir) * t, y: cy + Math.sin(dir) * t };
}
/** Pin indicator opacity: fully visible far away, fading out within about 30 yd where the real flagstick is readable. */
export function pinOpacity(yardsToPin: number): number { return Math.min(1, Math.max(0, (yardsToPin - 30) / 20)); }

const TWO_PI = Math.PI * 2;
/** Wraps an angle to (-PI, PI]. */
export function wrapAngle(a: number): number { let r = a % TWO_PI; if (r > Math.PI) r -= TWO_PI; if (r <= -Math.PI) r += TWO_PI; return r; }
/** Heading arrow on the hole-up mini map: yaw is clockwise from +z (the pin direction) in radians; the map has +z up and +x right.
 *  Returns the screen rotation in radians for an arrow drawn pointing up (clockwise positive), already wrapped. */
export function mapArrowRotation(yawRad: number): number { return wrapAngle(yawRad); }
/** Unit vector of a heading in sim space: x right, z forward. */
export const headingVector = (yawRad: number) => ({ x: Math.sin(yawRad), z: Math.cos(yawRad) });
