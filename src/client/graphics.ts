// Graphics presets (PRD/06 "Graphics presets"): the tier table, the Auto pick from the hardware, the runtime step down/up,
// per-tier texture URLs and the saved preference. Pure logic, no DOM or three, so it is unit tested.
export type Tier = 'low' | 'medium' | 'high' | 'ultra';
export type Pref = 'auto' | Tier;
export const TIERS: readonly Tier[] = ['low', 'medium', 'high', 'ultra'];
export const TIER_LABEL: Record<Tier, string> = { low: 'Low', medium: 'Medium', high: 'High', ultra: 'Ultra' };

export interface TierSpec {
  /** turf albedo size in px: the only size this tier downloads */ tex: 512 | 1024 | 2048;
  /** extra close-range detail sampling of the turf (no extra download) */ detail: boolean;
  /** instanced rough grass radius around the camera in m (0 = off) and clump spacing in m */ grassM: number; grassSpacing: number;
  /** sun shadow map size (0 = no shadows) */ shadow: number;
  pixelRatio: (dpr: number) => number;
  /** MSAA needs a new WebGL context, so it applies from the next page load */ antialias: boolean;
  /** share of the hole's trees and rocks placed */ foliage: number;
  fogNear: number; fogFar: number; far: number;
}
export const SPEC: Record<Tier, TierSpec> = {
  low: { tex: 512, detail: false, grassM: 0, grassSpacing: 0, shadow: 0, pixelRatio: () => 0.75, antialias: false, foliage: 0.5, fogNear: 160, fogFar: 650, far: 900 },
  medium: { tex: 1024, detail: false, grassM: 0, grassSpacing: 0, shadow: 1024, pixelRatio: () => 1, antialias: true, foliage: 0.75, fogNear: 200, fogFar: 800, far: 1200 },
  high: { tex: 2048, detail: false, grassM: 30, grassSpacing: 0.45, shadow: 2048, pixelRatio: d => Math.min(d, 1.5), antialias: true, foliage: 1, fogNear: 220, fogFar: 900, far: 2000 },
  ultra: { tex: 2048, detail: true, grassM: 50, grassSpacing: 0.36, shadow: 4096, pixelRatio: d => Math.min(d, 2), antialias: true, foliage: 1, fogNear: 260, fogFar: 1100, far: 2000 },
};

export const SURFACES = ['fairway', 'firstcut', 'rough', 'fringe', 'green', 'sand'] as const;
export type SurfaceId = (typeof SURFACES)[number];
/** The per-tier copies made by scripts/turf_tiles.sh; Low never resolves anything larger than 512. */
export const turfUrls = (t: Tier) => SURFACES.map(s => `/assets/textures/turf/${SPEC[t].tex}/turf-${s}.jpg`);

export interface Hardware { renderer?: string; maxTexture: number; memoryGB?: number; cores?: number; mobile: boolean }
const at = (i: number) => TIERS[Math.max(0, Math.min(3, i))]!;
/** Initial Auto tier from the unmasked renderer string when the browser gives it, else from memory and cores. */
export function pickTier(h: Hardware): Tier {
  const r = h.renderer ?? '', mem = h.memoryGB, cores = h.cores;
  if (/swiftshader|llvmpipe|software|basic render/i.test(r) || (mem ?? 8) <= 2 || (cores ?? 8) <= 2 || h.maxTexture < 8192) return 'low';
  if (h.mobile) return (mem ?? 0) >= 6 ? 'medium' : 'low';
  let t: Tier;
  if (/RTX\s*\d0[6-9]0|RX\s*[6-9]\d{3}|Apple M\d+ (Max|Ultra)/i.test(r)) t = 'ultra';
  else if (/Apple M([2-9]|1 Pro)|GeForce|RTX|Radeon (RX|Pro)|Arc\(?\w*\)? A\d/i.test(r)) t = 'high';
  else if (/Apple M1|Intel|Adreno|Mali|Radeon/i.test(r)) t = 'medium';
  else t = (mem ?? 8) <= 4 && (cores ?? 8) <= 4 ? 'low' : 'medium';   // masked ("Apple GPU") or unknown: safe middle, adaptation can climb one
  return h.maxTexture < 16384 && TIERS.indexOf(t) > 1 ? 'medium' : t;
}

const WINDOW_MS = 2500, DOWN_MS = 20, UP_MS = 12, UP_HOLD_MS = 10000, STALL_MS = 250, RETRY_MS = 45000, N = 1024;
/** Rolling frame-time window. Above 20 ms on average: one tier down. Under 12 ms for ~10 s: one tier up, never above
 *  the initial tier + 1, and not back into a tier it left for being slow within 45 s. Decisions wait while `busy`. No allocation per sample. */
export class Adaptive {
  tier: Tier;
  private readonly max: number;
  private ts = new Float64Array(N); private dts = new Float64Array(N);
  private head = 0; private len = 0; private sum = 0; private start = -1; private goodSince = -1;
  private banned = -1; private bannedUntil = 0;
  constructor(initial: Tier) { this.tier = initial; this.max = Math.min(3, TIERS.indexOf(initial) + 1); }
  /** Empties the window (after a switch, a stall or a tier the player picked by hand). */
  reset(now: number) { this.len = 0; this.sum = 0; this.start = now; this.goodSince = -1; }
  sample(dtMs: number, now: number, busy: boolean): Tier | null {
    if (this.start < 0) this.start = now - dtMs;
    if (dtMs > STALL_MS) { this.reset(now); return null; }   // tab switch or a load stall, not the steady frame rate
    if (this.len === N) { this.sum -= this.dts[(this.head - N + N) % N]!; this.len--; }
    this.ts[this.head] = now; this.dts[this.head] = dtMs; this.sum += dtMs; this.head = (this.head + 1) % N; this.len++;
    while (this.len > 1 && now - this.ts[(this.head - this.len + N) % N]! > WINDOW_MS) { this.sum -= this.dts[(this.head - this.len + N) % N]!; this.len--; }
    if (now - this.start < WINDOW_MS) return null;
    const avg = this.sum / this.len;
    if (avg >= UP_MS) this.goodSince = -1; else if (this.goodSince < 0) this.goodSince = this.ts[(this.head - this.len + N) % N]!;
    if (busy) return null;
    const i = TIERS.indexOf(this.tier);
    if (avg > DOWN_MS && i > 0) { this.banned = i; this.bannedUntil = now + RETRY_MS; return this.go(i - 1, now); }
    if (this.goodSince >= 0 && now - this.goodSince >= UP_HOLD_MS && i < this.max && !(i + 1 === this.banned && now < this.bannedUntil)) return this.go(i + 1, now);
    return null;
  }
  private go(i: number, now: number) { this.tier = at(i); this.reset(now); return this.tier; }
}

type Store = Pick<Storage, 'getItem' | 'setItem'>;
const KEY = 'ace.gfx';
// `localStorage` is read inside the try: merely touching it throws when site data is blocked.
export function loadPref(s?: Pick<Store, 'getItem'>): Pref {
  try { const v = (s ?? localStorage).getItem(KEY); return v === 'auto' || TIERS.includes(v as Tier) ? (v as Pref) : 'auto'; } catch { return 'auto'; }
}
export function savePref(p: Pref, s?: Pick<Store, 'setItem'>): boolean { try { (s ?? localStorage).setItem(KEY, p); return true; } catch { return false; } }

/** Browser-only: what pickTier needs, from a throwaway WebGL2 context and navigator. */
export function probeHardware(): Hardware {
  let renderer: string | undefined, maxTexture = 4096;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      renderer = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER)); maxTexture = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch { /* no WebGL2: Low */ }
  const nav = navigator as Navigator & { deviceMemory?: number; userAgentData?: { mobile?: boolean } };
  const ipadOs = /Macintosh/.test(nav.userAgent) && nav.maxTouchPoints > 1;
  return { renderer, maxTexture, memoryGB: nav.deviceMemory, cores: nav.hardwareConcurrency, mobile: nav.userAgentData?.mobile ?? (ipadOs || /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent)) };
}
