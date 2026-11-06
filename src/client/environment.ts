// Sky, sun, haze and exposure tuned to the real Pebble Beach photos (docs/research/pebble-look.md: clear afternoon, blue-grey
// aerial haze toward the far shore). Code-generated: three's physical Sky shader, a PMREM environment baked from it once per
// load for image-based light, an ACES tone map and exponential fog in the measured horizon colour.
import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';

/** Sun direction (three space, unit): about 35 degrees up, from the south-west over the bay on the coastal holes. */
export const SUN_DIR = new THREE.Vector3(0.55, 0.57, 0.61).normalize();
/** Photo swatches (pebble-look.md): horizon haze and the zenith, used by the fog, the ocean reflection and the far shore. */
export const HAZE = new THREE.Color('#9fb7cf');
export const ZENITH = new THREE.Color('#6f9fd3');

export interface Env { sky: Sky; sun: THREE.DirectionalLight; hemi: THREE.HemisphereLight; fog: THREE.FogExp2 }

/** Adds the sky, the lights and the fog to `scene` and configures the renderer's tone mapping. */
export function makeEnvironment(renderer: THREE.WebGLRenderer, scene: THREE.Scene): Env {
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.85;
  const sky = new Sky(); sky.scale.setScalar(10000); sky.frustumCulled = false;
  const u = sky.material.uniforms;
  u.turbidity!.value = 2.2; u.rayleigh!.value = 1.9; u.mieCoefficient!.value = 0.003; u.mieDirectionalG!.value = 0.82;
  u.cloudCoverage!.value = 0.12; u.cloudDensity!.value = 0.3; u.cloudElevation!.value = 0.55;   // a few fair-weather clouds, as on the clear-day photos
  u.sunPosition!.value.copy(SUN_DIR).multiplyScalar(1000);
  scene.add(sky);
  // image-based light from the same sky (once): soft blue fill in the shadows like the photos, specular on wet rock and water
  const pmrem = new THREE.PMREMGenerator(renderer), envScene = new THREE.Scene(), envSky = new Sky(); envSky.scale.setScalar(1000);
  Object.assign(envSky.material.uniforms.sunPosition!.value, SUN_DIR.clone().multiplyScalar(1000));
  for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG'] as const) envSky.material.uniforms[k]!.value = u[k]!.value;
  envSky.material.uniforms.cloudCoverage!.value = 0; envSky.material.uniforms.showSunDisc!.value = 0;
  envScene.add(envSky);
  scene.environment = pmrem.fromScene(envScene, 0, 1, 2000).texture; scene.environmentIntensity = 0.45;
  envSky.material.dispose(); pmrem.dispose();
  scene.background = null;
  const sun = new THREE.DirectionalLight('#fff2df', 3.4);
  const hemi = new THREE.HemisphereLight('#d6e2ea', '#56603e', 0.35);   // Lambert props get no IBL: this is their sky fill
  const fog = new THREE.FogExp2(HAZE.getHex(), 0.0011);
  scene.fog = fog; scene.add(sun, sun.target, hemi);
  return { sky, sun, hemi, fog };
}
/** Fog density for a tier's draw distance: about 60 % haze at the old linear fog's far end, so the far shore stays visible but blue-grey. */
export const fogDensity = (fogFar: number) => 1.15 / fogFar;
