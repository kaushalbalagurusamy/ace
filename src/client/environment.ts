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
const SKY_FRAG = /* glsl */`uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uHaze; uniform vec3 uSun; uniform float uDisc; varying vec3 vDir;
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec3 d = normalize(vDir); float y = max(d.y, 0.0);
  vec3 c = mix(uHorizon, uZenith, pow(y, 0.45));
  c = mix(uHaze, c, smoothstep(-0.02, 0.07, d.y));
  float s = max(dot(d, uSun), 0.0);
  c += vec3(1.0, 0.92, 0.78) * (pow(s, 8.0) * 0.18 + pow(s, 64.0) * 0.35) + uDisc * vec3(1.0, 0.95, 0.85) * smoothstep(0.9993, 0.9997, s) * 8.0;
  vec2 q = d.xz / (d.y + 0.12) * 1.6; float cl = smoothstep(0.62, 0.9, vn(q * vec2(0.6, 2.2)) * 0.65 + vn(q * 3.1) * 0.35) * smoothstep(0.02, 0.2, d.y);
  c = mix(c, vec3(0.92, 0.94, 0.97), cl * 0.55);
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
function skyDome(disc: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false,
    uniforms: { uZenith: { value: ZENITH.clone() }, uHorizon: { value: new THREE.Color('#9ebfe0') }, uHaze: { value: HAZE.clone() }, uSun: { value: SUN_DIR.clone() }, uDisc: { value: disc } } }));
  m.frustumCulled = false; m.renderOrder = -10; m.onBeforeRender = (_r, _s, cam) => { m.position.copy(cam.position); m.updateMatrixWorld(); };
  return m;
}

export interface Env { sky: THREE.Mesh; sun: THREE.DirectionalLight; hemi: THREE.HemisphereLight; fog: THREE.FogExp2 }

/** Adds the sky, the lights and the fog to `scene` and configures the renderer's tone mapping. */
export function makeEnvironment(renderer: THREE.WebGLRenderer, scene: THREE.Scene): Env {
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
  const sky = skyDome(1); scene.add(sky);
  // image-based light from the same sky (once): soft blue fill in the shadows like the photos, specular on wet rock and water
  const pmrem = new THREE.PMREMGenerator(renderer), envScene = new THREE.Scene(), envSky = skyDome(0);
  envSky.onBeforeRender = () => {}; envSky.scale.setScalar(100); envScene.add(envSky);
  scene.environment = pmrem.fromScene(envScene, 0, 0.1, 1000).texture; scene.environmentIntensity = 0.38;
  (envSky.material as THREE.Material).dispose(); pmrem.dispose();
  scene.background = null;
  const sun = new THREE.DirectionalLight('#fff2df', 3.6);
  const hemi = new THREE.HemisphereLight('#d6e2ea', '#56603e', 0.35);   // Lambert props get no IBL: this is their sky fill
  const fog = new THREE.FogExp2(HAZE.getHex(), 0.0011);
  scene.fog = fog; scene.add(sun, sun.target, hemi);
  return { sky, sun, hemi, fog };
}
/** Fog density for a tier's draw distance: about 70 % haze at the old linear fog's far end, so the far shore stays visible but blue-grey. */
export const fogDensity = (fogFar: number) => 1.15 / fogFar;
