import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { Adaptive, SPEC, SURFACES, loadPref, pickTier, savePref, turfUrls, type Hardware } from '../src/client/graphics';
import { TURF, bakeLayer } from '../src/client/turf-bake';

const hw = (o: Partial<Hardware>): Hardware => ({ maxTexture: 16384, mobile: false, ...o });

describe('Auto tier from the hardware (initial pick)', () => {
  it('software rasterisers and tiny devices get Low', () => {
    expect(pickTier(hw({ renderer: 'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)' }))).toBe('low');
    expect(pickTier(hw({ renderer: 'llvmpipe (LLVM 15.0.7, 256 bits)' }))).toBe('low');
    expect(pickTier(hw({ memoryGB: 2 }))).toBe('low');
    expect(pickTier(hw({ cores: 2 }))).toBe('low');
    expect(pickTier(hw({ maxTexture: 4096 }))).toBe('low');
  });
  it('phones: Low, or Medium for a strong one', () => {
    expect(pickTier(hw({ mobile: true, renderer: 'Adreno (TM) 610', memoryGB: 4 }))).toBe('low');
    expect(pickTier(hw({ mobile: true, renderer: 'Apple GPU', memoryGB: 8 }))).toBe('medium');
  });
  it('an M1 MacBook Air or Intel integrated graphics start at Medium', () => {
    expect(pickTier(hw({ renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)', memoryGB: 8, cores: 8 }))).toBe('medium');
    expect(pickTier(hw({ renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)', memoryGB: 8, cores: 8 }))).toBe('medium');
  });
  it('newer Apple chips and mainstream discrete GPUs get High', () => {
    expect(pickTier(hw({ renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M3, Unspecified Version)', memoryGB: 8, cores: 8 }))).toBe('high');
    expect(pickTier(hw({ renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Pro, Unspecified Version)', memoryGB: 8, cores: 10 }))).toBe('high');
    expect(pickTier(hw({ renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Direct3D11 vs_5_0 ps_5_0, D3D11)', memoryGB: 8, cores: 8 }))).toBe('high');
  });
  it('high-end GPUs get Ultra', () => {
    expect(pickTier(hw({ renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)', memoryGB: 8, cores: 16 }))).toBe('ultra');
    expect(pickTier(hw({ renderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Max, Unspecified Version)', memoryGB: 8, cores: 12 }))).toBe('ultra');
    expect(pickTier(hw({ renderer: 'ANGLE (AMD, AMD Radeon RX 7800 XT Direct3D11 vs_5_0 ps_5_0, D3D11)', memoryGB: 8, cores: 16 }))).toBe('ultra');
  });
  it('a masked renderer string falls back to memory and cores', () => {
    expect(pickTier(hw({ renderer: undefined, memoryGB: 8, cores: 8 }))).toBe('medium');
    expect(pickTier(hw({ renderer: 'Apple GPU', cores: 10 }))).toBe('medium');
    expect(pickTier(hw({ renderer: undefined, memoryGB: 4, cores: 4 }))).toBe('low');
  });
  it('a big GPU is still capped by a small max texture size', () => {
    expect(pickTier(hw({ renderer: 'NVIDIA GeForce RTX 4090', maxTexture: 8192 }))).toBe('medium');
  });
});

describe('the tier table', () => {
  it('matches the owner spec', () => {
    expect([SPEC.low.tex, SPEC.medium.tex, SPEC.high.tex, SPEC.ultra.tex]).toEqual([512, 1024, 2048, 2048]);
    expect([SPEC.low.grassM, SPEC.medium.grassM, SPEC.high.grassM, SPEC.ultra.grassM]).toEqual([0, 0, 30, 50]);
    expect([SPEC.low.shadow, SPEC.medium.shadow, SPEC.high.shadow, SPEC.ultra.shadow]).toEqual([0, 1024, 2048, 4096]);
    expect(SPEC.low.pixelRatio(2)).toBe(0.75); expect(SPEC.medium.pixelRatio(2)).toBe(1);
    expect(SPEC.high.pixelRatio(2)).toBe(1.5); expect(SPEC.high.pixelRatio(1)).toBe(1);
    expect(SPEC.ultra.pixelRatio(3)).toBe(2); expect(SPEC.ultra.pixelRatio(1.25)).toBe(1.25);
    expect(SPEC.ultra.detail).toBe(true); expect(SPEC.high.detail).toBe(false);
  });
});

describe('texture URLs per tier: each device downloads only its own size', () => {
  it('Low never resolves a 2048 (or 1024) file', () => {
    const u = turfUrls('low');
    expect(u).toHaveLength(SURFACES.length);
    for (const x of u) { expect(x).toContain('/512/'); expect(x).not.toMatch(/2048|1024/); }
  });
  it('Medium is 1024, High and Ultra are 2048', () => {
    for (const x of turfUrls('medium')) expect(x).toMatch(/\/1024\/turf-[a-z]+\.jpg$/);
    for (const t of ['high', 'ultra'] as const) for (const x of turfUrls(t)) expect(x).toMatch(/\/2048\/turf-[a-z]+\.jpg$/);
  });
  it('every resolved file is shipped', () => {
    for (const t of ['low', 'medium', 'high', 'ultra'] as const) for (const x of turfUrls(t)) expect(existsSync(x.slice(1)), x).toBe(true);
  });
});

describe('runtime adaptation: rolling window, hysteresis, never mid-shot', () => {
  /** Feeds frames of `ms` each for `secs` seconds from `t0`; returns the last switch and the time reached. */
  const run = (a: Adaptive, ms: number, secs: number, t0: number, busy = false) => {
    let t = t0, out: string | null = null;
    for (let i = 0; i < (secs * 1000) / ms; i++) { t += ms; const r = a.sample(ms, t, busy); if (r) out = r; }
    return { out, t };
  };
  it('steps down one tier when the window averages above 20 ms', () => {
    const a = new Adaptive('high');
    expect(run(a, 25, 1, 0).out).toBeNull();          // not a full window yet
    const r = run(a, 25, 3, 1000);
    expect(r.out).toBe('medium'); expect(a.tier).toBe('medium');
  });
  it('holds steady between 12 and 20 ms (hysteresis band)', () => {
    const a = new Adaptive('medium');
    expect(run(a, 16, 30, 0).out).toBeNull(); expect(a.tier).toBe('medium');
  });
  it('steps up only after about 10 s under 12 ms, and never above the initial tier + 1', () => {
    const a = new Adaptive('medium');
    expect(run(a, 8, 8, 0).out).toBeNull();
    let r = run(a, 8, 4, 8000); expect(r.out).toBe('high');
    r = run(a, 8, 60, r.t); expect(r.out).toBeNull(); expect(a.tier).toBe('high');
  });
  it('a single hitch does not drop the tier, and stalls (tab switch) are ignored', () => {
    const a = new Adaptive('high');
    let t = 0; for (let i = 0; i < 300; i++) { t += 16; a.sample(i === 150 ? 90 : 16, t, false); }
    expect(a.sample(5000, t + 5000, false)).toBeNull();
    expect(a.tier).toBe('high');
  });
  it('does not step straight back up into a tier it just left for being slow', () => {
    const a = new Adaptive('high');
    let r = run(a, 25, 4, 0); expect(r.out).toBe('medium');
    r = run(a, 8, 20, r.t); expect(r.out).toBeNull();     // fast again, but High just failed
    r = run(a, 8, 30, r.t); expect(r.out).toBe('high');   // retried after the cool-off
  });
  it('never switches while a shot is in flight or a swing is in progress; switches at rest', () => {
    const a = new Adaptive('high');
    const r = run(a, 30, 6, 0, true);
    expect(r.out).toBeNull(); expect(a.tier).toBe('high');
    expect(a.sample(30, r.t + 30, false)).toBe('medium');
  });
  it('Low is the floor', () => {
    const a = new Adaptive('low');
    expect(run(a, 40, 20, 0).out).toBeNull(); expect(a.tier).toBe('low');
  });
});

describe('turf bake (normal and roughness derived from luminance)', () => {
  const img = (n: number, f: (x: number, y: number) => number) => { const a = new Uint8Array(n * n * 4); for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = f(x, y), i = (y * n + x) * 4; a[i] = a[i + 1] = a[i + 2] = v; a[i + 3] = 255; } return a; };
  it('a flat image bakes flat slopes and is pulled toward the palette mean', () => {
    const { albedo, normal } = bakeLayer(img(8, () => 100), 8, TURF.fairway);
    expect(normal.length).toBe(4 * 4 * 4); expect(normal[0]).toBe(128); expect(normal[1]).toBe(128);
    expect(albedo[1]! - albedo[0]!).toBeGreaterThan(20);   // fairway target is green: G gained over R
  });
  it('brightness rising to +x tilts the normal toward -x (a slope facing away from the rise)', () => {
    const { normal } = bakeLayer(img(16, x => 40 + x * 10), 16, TURF.rough);
    expect(normal[(1 * 8 + 3) * 4]!).toBeLessThan(128); expect(normal[(1 * 8 + 3) * 4 + 1]!).toBe(128);
  });
});

describe('graphics preference storage', () => {
  const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };
  it('defaults to Auto and round-trips a manual tier', () => {
    const s = mem(); expect(loadPref(s)).toBe('auto');
    expect(savePref('ultra', s)).toBe(true); expect(loadPref(s)).toBe('ultra');
    s.setItem('ace.gfx', 'bogus'); expect(loadPref(s)).toBe('auto');
  });
  it('storage that throws never breaks load or save', () => {
    const bad = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    expect(loadPref(bad)).toBe('auto'); expect(savePref('low', bad)).toBe(false);
  });
});

describe('manifest provenance for the turf images', () => {
  const rows = JSON.parse(readFileSync('assets/manifest.json', 'utf8')) as Record<string, unknown>[];
  const sha = (f: string) => createHash('sha256').update(readFileSync(f)).digest('hex');
  for (const s of SURFACES) it(`turf-${s} has a full row and matching hashes`, () => {
    const r = rows.find(x => x.id === `turf-${s}`) as { tool: string; model: string; prompt: string; date: string; licence: string; sha256: string; file: string; variants: Record<string, { file: string; sha256: string }> };
    expect(r).toBeTruthy();
    expect(r.tool).toBe('OpenAI images'); expect(r.model).toBe('gpt-image-2-2026-04-21');
    expect(r.prompt).toMatch(/seamless/i); expect(r.prompt).toMatch(/top-down/i); expect(r.prompt).toMatch(/photograph/i);
    expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}$/); expect(r.licence).toBeTruthy();
    expect(r.sha256).toBe(sha(r.file));
    for (const px of ['512', '1024', '2048']) { const v = r.variants[px]!; expect(v.file).toBe(`assets/textures/turf/${px}/turf-${s}.jpg`); expect(v.sha256).toBe(sha(v.file)); }
  });
});
