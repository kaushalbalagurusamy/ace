// Sky, sun, haze and exposure tuned to the real Pebble Beach photos (docs/research/pebble-look.md: clear afternoon, blue-grey
// aerial haze toward the far shore). Code-generated: a gradient sky dome in the measured photo colours, a PMREM environment baked
// from it once per load for image-based light, an ACES tone map and exponential fog in the measured horizon colour.
import * as THREE from 'three';

/** Sun direction (three space, unit): about 38 degrees up, behind and to the right of a player facing the pin, as on the hole 7 tee photo
 *  (front-lit greens and trees; terrain.ts's bunker-lip shading uses the same direction in sim space). */
export const SUN_DIR = new THREE.Vector3(0.4, 0.62, -0.68).normalize();
/** Photo swatches (pebble-look.md): horizon haze and the zenith, used by the fog, the ocean reflection and the far shore. */
export const HAZE = new THREE.Color('#9fb7cf');
export const ZENITH = new THREE.Color('#4f86c9');

const SKY_VERT = /* glsl */`varying vec3 vDir; void main() { vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`;
// Gradient measured from the clear-day photos: deep blue zenith, a paler blue band toward the horizon, a warm glow around the sun,
// a few soft high streaks; below the horizon the haze colour (the ocean or the backdrop covers it).
const SKY_FRAG = /* glsl */`uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uHaze; uniform vec3 uSun; uniform float uDisc; uniform float uOvercast; varying vec3 vDir;
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec3 d = normalize(vDir); float y = max(d.y, 0.0);
  vec3 c = mix(uHorizon, uZenith, pow(y, 0.45));
  c = mix(uHaze, c, smoothstep(-0.02, 0.07, d.y));
  float s = max(dot(d, uSun), 0.0);
  c += vec3(1.0, 0.92, 0.78) * (pow(s, 8.0) * 0.18 + pow(s, 64.0) * 0.35) + uDisc * vec3(1.0, 0.95, 0.85) * smoothstep(0.9993, 0.9997, s) * 8.0;
  vec2 q = d.xz / (d.y + 0.12) * 1.6; float cl = smoothstep(0.62, 0.9, vn(q * vec2(0.6, 2.2)) * 0.65 + vn(q * 3.1) * 0.35) * smoothstep(0.02, 0.2, d.y);
  c = mix(c, vec3(0.92, 0.94, 0.97), cl * 0.55 * (1.0 - uOvercast));
  // marine layer: a low, even grey deck, brighter where the sun glows through it, darker in rolls (h18-marine-layer, h17-green)
  float deck = vn(q * vec2(0.35, 0.9)) * 0.6 + vn(q * 1.7) * 0.4;
  c = mix(c, mix(vec3(0.5, 0.55, 0.62), vec3(0.8, 0.83, 0.87), deck) + vec3(0.12, 0.11, 0.09) * pow(s, 6.0), uOvercast * smoothstep(-0.02, 0.06, d.y));
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
function skyDome(disc: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false,
    uniforms: { uZenith: { value: ZENITH.clone() }, uHorizon: { value: new THREE.Color('#9ebfe0') }, uHaze: { value: HAZE.clone() }, uSun: { value: SUN_DIR.clone() }, uDisc: { value: disc }, uOvercast: { value: 0 } } }));
  m.frustumCulled = false; m.renderOrder = -10; m.onBeforeRender = (_r, _s, cam) => { m.position.copy(cam.position); m.updateMatrixWorld(); };
  return m;
}

export interface Env { sky: THREE.Mesh; sun: THREE.DirectionalLight; hemi: THREE.HemisphereLight; fog: THREE.FogExp2; fogMul: number }

/** Sky presets (settings): the clear afternoon of most photos, or Monterey's marine layer (h18-marine-layer, h17-green): an overcast
 *  silver-grey deck, soft weak sun, brighter fill and thicker haze. */
export type SkyPreset = 'sunny' | 'marine';
export const SKY_PRESETS: readonly SkyPreset[] = ['sunny', 'marine'];
const PRESET = {
  sunny: { haze: '#9fb7cf', zenith: '#4f86c9', horizon: '#9ebfe0', overcast: 0, sun: 3.6, hemi: 0.35, env: 0.38, fog: 1, exposure: 0.9 },
  marine: { haze: '#aab3bb', zenith: '#8f9aa6', horizon: '#c0c6cc', overcast: 1, sun: 1.2, hemi: 0.95, env: 0.75, fog: 1.7, exposure: 0.95 },
} as const;

/** Adds the sky, the lights and the fog to `scene` and configures the renderer's tone mapping. */
export function makeEnvironment(renderer: THREE.WebGLRenderer, scene: THREE.Scene): Env {
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const sky = skyDome(1); scene.add(sky);
  scene.background = null;
  const sun = new THREE.DirectionalLight('#fff2df', 3.6);
  const hemi = new THREE.HemisphereLight('#d6e2ea', '#56603e', 0.35);   // Lambert props get no IBL: this is their sky fill
  const fog = new THREE.FogExp2(HAZE.getHex(), 0.0011);
  scene.fog = fog; scene.add(sun, sun.target, hemi);
  const env = { sky, sun, hemi, fog, fogMul: 1 }; setSky(env, renderer, scene, 'sunny');
  return env;
}
/** Applies a sky preset: the dome, lights, fog colour and the shared HAZE / ZENITH swatches (the ocean and the far shore read them when built). */
export function setSky(env: Env, renderer: THREE.WebGLRenderer, scene: THREE.Scene, p: SkyPreset) {
  const k = PRESET[p] ?? PRESET.sunny, u = (env.sky.material as THREE.ShaderMaterial).uniforms;
  HAZE.set(k.haze); ZENITH.set(k.zenith);
  u.uZenith!.value.copy(ZENITH); u.uHaze!.value.copy(HAZE); u.uHorizon!.value.set(k.horizon); u.uOvercast!.value = k.overcast; u.uDisc!.value = 1 - k.overcast;
  renderer.toneMappingExposure = k.exposure; env.sun.intensity = k.sun; env.hemi.intensity = k.hemi; env.fog.color.copy(HAZE); env.fogMul = k.fog;
  // image-based light from the same sky: soft blue (or grey) fill in the shadows like the photos, specular on wet rock and water
  const pmrem = new THREE.PMREMGenerator(renderer), envScene = new THREE.Scene(), envSky = skyDome(0), eu = (envSky.material as THREE.ShaderMaterial).uniforms;
  eu.uZenith!.value.copy(ZENITH); eu.uHaze!.value.copy(HAZE); eu.uHorizon!.value.set(k.horizon); eu.uOvercast!.value = k.overcast;
  envSky.onBeforeRender = () => {}; envSky.scale.setScalar(100); envScene.add(envSky);
  scene.environment?.dispose();
  scene.environment = pmrem.fromScene(envScene, 0, 0.1, 1000).texture; scene.environmentIntensity = k.env;
  (envSky.material as THREE.Material).dispose(); envSky.geometry.dispose(); pmrem.dispose();
}
/** Fog density for a tier's draw distance: about 70 % haze at the old linear fog's far end, so the far shore stays visible but blue-grey. */
export const fogDensity = (fogFar: number) => 1.15 / fogFar;
