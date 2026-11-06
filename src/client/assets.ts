// Loads the generated assets (models, textures) with graceful failure: every loader resolves to null when a file is missing,
// so the game keeps its code-built stand-ins (docs: assets/manifest.json lists every shipped file and its provenance).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

interface Row { id: string; target_height_m?: number; height_m?: number; orient_deg?: number[]; qa?: { verdict?: string } }
let manifest: Promise<Row[]> | null = null;
const rows = () => (manifest ??= fetch('/assets/manifest.json').then(async r => (r.ok ? ((await r.json()) as Row[]) : [] as Row[])).catch(() => [] as Row[]));

let loader: GLTFLoader | null = null;
const gltf = () => {
  if (!loader) {
    const draco = new DRACOLoader().setDecoderPath('/draco/');
    loader = new GLTFLoader().setDRACOLoader(draco).setMeshoptDecoder(MeshoptDecoder);
  }
  return loader;
};

const raws = new Map<string, Promise<{ scene: THREE.Object3D; row: Row } | null>>();
/** A shipped model as loaded (no normalisation) with its manifest row, or null if its row is not PASS or it cannot load. */
export async function loadRaw(id: string): Promise<{ scene: THREE.Object3D; row: Row } | null> {
  if (!raws.has(id)) {
    raws.set(id, (async () => {
      try {
        const row = (await rows()).find(r => r.id === id);
        if (!row || row.qa?.verdict !== 'PASS') return null; // owner rule: a 3D model ships only after its fidelity check passed; until then the code-built stand-in stays
        return { scene: (await gltf().loadAsync(`/assets/models/${id}.glb`)).scene, row };
      } catch { return null; }
    })());
  }
  const r = await raws.get(id)!;
  return r ? { scene: cloneSkinned(r.scene), row: r.row } : null;
}

/** Wraps a model in a group, scaled to `height` metres, centred on x/z, base at y = 0. */
export function normalise(scene: THREE.Object3D, height: number): THREE.Group {
  const root = new THREE.Group(); root.add(scene);
  scene.updateMatrixWorld(true);   // a fresh skinned clone's bones have identity world matrices until updated, which breaks its bounding box
  const size = new THREE.Box3().setFromObject(scene).getSize(new THREE.Vector3());
  scene.scale.multiplyScalar(size.y > 0 ? height / size.y : 1);
  const b2 = new THREE.Box3().setFromObject(scene), c = b2.getCenter(new THREE.Vector3());
  scene.position.set(-c.x, -b2.min.y, -c.z);
  return root;
}

const models = new Map<string, Promise<THREE.Object3D | null>>();
/** A normalised clone of a shipped model: scaled to its manifest height, centred on x/z, base at y = 0. null if it cannot load. */
export async function loadModel(id: string): Promise<THREE.Object3D | null> {
  if (!models.has(id)) {
    models.set(id, (async () => {
      try {
        const r = await loadRaw(id);
        return r ? normalise(r.scene, r.row.target_height_m ?? r.row.height_m ?? 1) : null;
      } catch { return null; }
    })());
  }
  const m = await models.get(id)!;
  return m ? cloneSkinned(m) : null;
}

const textures = new Map<string, Promise<THREE.Texture | null>>();
export function loadTexture(id: string): Promise<THREE.Texture | null> {
  if (!textures.has(id)) textures.set(id, new Promise(res => new THREE.TextureLoader().load(`/assets/textures/${id}.jpg`, t => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; res(t);
  }, undefined, () => res(null))));
  return textures.get(id)!;
}

export interface PropSpot { kind: 'cypress' | 'pine' | 'rock'; x: number; z: number; scale: number; rotY: number }
