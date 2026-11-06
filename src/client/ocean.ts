// Carmel Bay water, code-generated (docs/research/pebble-look.md "Ocean"): a sea-level plane with a cobalt-to-turquoise gradient
// over the shallows from the hole's distance-to-land field, two scrolling normal maps generated here, sky reflection with Fresnel,
// sun glitter, and white surf where the water meets land (a thin broken edge plus swells that break toward the shore).
import * as THREE from 'three';
import { GRIDS } from '../shared/course-grid';
import { seaField } from './terrain';
import { HAZE, SUN_DIR, ZENITH } from './environment';

/** Sea level (three y, metres) per hole index: the cliff height along that hole's shore (pebble-look.md: 10-25 m faces on 6, 8-10;
 *  low rocks on 7 and 17; the 3 m sea wall on 18). Holes not listed sit 4 m above the water. */
export const SEA_Y: Record<number, number> = { 3: -6, 4: -6, 5: -9, 6: -3, 7: -14, 8: -11, 9: -9, 16: -3, 17: -3.2 };
export const seaY = (hole: number) => SEA_Y[hole] ?? -4;

/** Periodic value-noise fBm on the unit torus (so it tiles), octaves at `periods`. */
function fbm(n: number, periods: number[], seed: number, stretch = 1): Float32Array {
  const out = new Float32Array(n * n), hsh = (x: number, y: number, p: number, q: number) => { const v = Math.sin(((x % p + p) % p) * 127.1 + ((y % q + q) % q) * 311.7 + seed * 74.7 + p * 13.1) * 43758.5453; return v - Math.floor(v); };
  periods.forEach((P, o) => {
    const amp = 0.55 ** o, py = Math.max(1, Math.round(P * stretch));
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const fx = (x / n) * P, fy = (y / n) * py, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const a = hsh(ix, iy, P, py), b = hsh(ix + 1, iy, P, py), c = hsh(ix, iy + 1, P, py), d = hsh(ix + 1, iy + 1, P, py);
      out[y * n + x]! += amp * (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy - 0.5);
    }
  });
  return out;
}
let normals: THREE.DataTexture | null = null;
/** Tileable wave field: RG = slope, B = height, A = foam breakup noise. Wind-stretched fBm, so no regular stripes. */
export function waveTexture(n = 256): THREE.DataTexture {
  if (normals) return normals;
  const h = fbm(n, [4, 8, 16, 32, 64], 1, 2), f = fbm(n, [6, 12, 24], 7);
  const px = new Uint8Array(n * n * 4), H = (x: number, y: number) => h[((y + n) % n) * n + ((x + n) % n)]!;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const i = (y * n + x) * 4, dx = (H(x + 1, y) - H(x - 1, y)) * 9, dy = (H(x, y + 1) - H(x, y - 1)) * 9;
    px[i] = Math.max(0, Math.min(255, 128 + dx * 127)); px[i + 1] = Math.max(0, Math.min(255, 128 + dy * 127));
    px[i + 2] = Math.max(0, Math.min(255, 128 + H(x, y) * 200)); px[i + 3] = Math.max(0, Math.min(255, 128 + f[y * n + x]! * 300));
  }
  normals = new THREE.DataTexture(px, n, n); normals.wrapS = normals.wrapT = THREE.RepeatWrapping;
  normals.magFilter = THREE.LinearFilter; normals.minFilter = THREE.LinearMipmapLinearFilter; normals.generateMipmaps = true; normals.needsUpdate = true;
  return normals;
}

const VERT = /* glsl */`
#include <common>
#include <fog_pars_vertex>
varying vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
  vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const FRAG = /* glsl */`
#include <common>
#include <fog_pars_fragment>
uniform sampler2D uField; uniform sampler2D uWave; uniform vec4 uGrid; uniform float uTime;
uniform vec3 uSun; uniform vec3 uSunCol; uniform vec3 uZenith; uniform vec3 uHaze; uniform vec3 uShallow; uniform vec3 uDeep; uniform vec3 uFoam;
varying vec3 vW;
void main() {
  vec2 muv = (vec2(-vW.x, vW.z) - uGrid.xy) * uGrid.zw;
  float d = texture2D(uField, muv).g * 80.0;                         // metres from land
  vec2 p = vW.xz;
  vec4 w1 = texture2D(uWave, p * 0.021 + vec2(uTime * 0.006, uTime * 0.004));
  vec4 w2 = texture2D(uWave, p * 0.067 + vec2(-uTime * 0.011, uTime * 0.009));
  vec4 w3 = texture2D(uWave, p * 0.23 + vec2(uTime * 0.02, -uTime * 0.017));
  vec2 sl = (w1.xy - 0.5) * 0.9 + (w2.xy - 0.5) * 0.6 + (w3.xy - 0.5) * 0.35;
  vec3 V = normalize(cameraPosition - vW); float far = length(cameraPosition - vW);
  sl *= mix(1.0, 0.35, smoothstep(150.0, 900.0, far));              // calmer-looking distance (and no shimmer)
  vec3 n = normalize(vec3(sl.x, 1.0, sl.y));
  float ndv = max(dot(n, V), 0.0), fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
  vec3 R = reflect(-V, n); R.y = abs(R.y);
  vec3 sky = mix(mix(uHaze, uZenith, 0.55), uZenith, pow(clamp(R.y, 0.0, 1.0), 0.4));
  float sd = max(dot(R, uSun), 0.0);
  vec3 glint = uSunCol * (pow(sd, 900.0) * 9.0 + pow(sd, 90.0) * 0.35);
  float shallow = 1.0 - smoothstep(1.0, 45.0, d);
  vec3 body = mix(uDeep, uShallow, shallow) * (0.55 + 0.45 * max(uSun.y, 0.0));
  vec3 col = mix(body, sky, fres * 0.75) + glint;
  // surf: a thin broken white edge plus swells that rise and break as they run in toward the shore
  float nz = w2.a * 0.6 + w3.a * 0.4, hb = w1.b;
  float edge = 1.0 - smoothstep(0.0, 0.8 + 2.2 * nz, d);
  float sw = sin(d * 0.55 + uTime * 1.25 + hb * 4.0);
  float swell = smoothstep(0.9, 0.99, sw) * (1.0 - smoothstep(1.0, 10.0, d)) * smoothstep(0.45, 0.7, nz);
  float foam = clamp(edge * smoothstep(0.3, 0.6, nz + 0.2) + swell * 0.6, 0.0, 1.0);
  col = mix(col, uFoam, foam);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

/** The water for one coastal hole (null on inland holes): a 6 km plane at the hole's sea level, centred on the hole. */
export function makeOcean(hole: number): THREE.Mesh | null {
  const g = GRIDS[hole]!, f = seaField(hole); if (!g.coastal || !f.any) return null;
  f.tex.wrapS = f.tex.wrapT = THREE.ClampToEdgeWrapping;
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uField: { value: null }, uWave: { value: null }, uGrid: { value: new THREE.Vector4() }, uTime: { value: 0 },
      uSun: { value: SUN_DIR.clone() }, uSunCol: { value: new THREE.Color('#fff0dc') }, uZenith: { value: ZENITH.clone() }, uHaze: { value: HAZE.clone() },
      uShallow: { value: new THREE.Color('#2f86ad') }, uDeep: { value: new THREE.Color('#1c4a72') }, uFoam: { value: new THREE.Color('#eef2f2') },
    }]),
  });
  mat.uniforms.uField!.value = f.tex; mat.uniforms.uWave!.value = waveTexture();
  mat.uniforms.uGrid!.value.set(g.x0, g.z0, 1 / (g.nx * g.cell), 1 / (g.nz * g.cell));
  const m = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), mat);
  m.position.set(-(g.x0 + g.nx * g.cell / 2), seaY(hole), g.z0 + g.nz * g.cell / 2);
  m.onBeforeRender = () => { mat.uniforms.uTime!.value = performance.now() / 1000; };
  m.name = 'ocean'; return m;
}
