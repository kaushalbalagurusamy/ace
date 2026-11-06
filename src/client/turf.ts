// Loads one tier's turf (albedo + derived normal/roughness) as two texture arrays, baked in a worker. null on any failure,
// so the terrain keeps its canvas colours (the fallback look).
import * as THREE from 'three';
import { SPEC, turfUrls, type Tier } from './graphics';

export interface Turf { size: number; alb: THREE.DataArrayTexture; nrm: THREE.DataArrayTexture }
const cache = new Map<number, Promise<Turf | null>>();

const array = (data: Uint8Array, n: number, layers: number, srgb: boolean) => {
  const t = new THREE.DataArrayTexture(data, n, n, layers);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.onUpdate = () => { (t.image as { data: Uint8Array | null }).data = null; };   // the GPU has it: drop the CPU copy (up to 100 MB on High)
  t.needsUpdate = true; return t;
};

export function loadTurf(tier: Tier): Promise<Turf | null> {
  const size = SPEC[tier].tex, hit = cache.get(size); if (hit) return hit;
  const p = new Promise<Turf | null>(res => {
    let w: Worker;
    try { w = new Worker(new URL('./turf-worker.ts', import.meta.url), { type: 'module' }); } catch { res(null); return; }
    w.onmessage = (e: MessageEvent<{ n: number; alb: Uint8Array; nrm: Uint8Array; error?: string }>) => {
      w.terminate();
      if (e.data.error) { console.warn('turf textures unavailable, keeping the flat colours:', e.data.error); res(null); return; }
      const { n, alb, nrm } = e.data, L = alb.length / (n * n * 4);
      res({ size, alb: array(alb, n, L, true), nrm: array(nrm, n >> 1, L, false) });
    };
    w.onerror = () => { w.terminate(); res(null); };
    w.postMessage({ urls: turfUrls(tier) });
  });
  cache.set(size, p); return p;
}
/** Frees a size that is no longer used (after a tier change). */
export function dropTurf(size: number) { const p = cache.get(size); cache.delete(size); void p?.then(t => { t?.alb.dispose(); t?.nrm.dispose(); }); }
