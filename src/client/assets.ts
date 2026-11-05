// Loads the generated assets (models, textures) with graceful failure: every loader resolves to null when a file is missing,
// so the game keeps its code-built stand-ins (docs: assets/manifest.json lists every shipped file and its provenance).
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

interface Row { id: string; target_height_m?: number; height_m?: number }
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

const models = new Map<string, Promise<THREE.Object3D | null>>();
/** A normalised clone of a shipped model: scaled to its manifest height, centred on x/z, base at y = 0. null if it cannot load. */
export async function loadModel(id: string): Promise<THREE.Object3D | null> {
  if (!models.has(id)) {
    models.set(id, (async () => {
      try {
        const [g, all] = await Promise.all([gltf().loadAsync(`/assets/models/${id}.glb`), rows()]);
        const row = all.find(r => r.id === id), height = row?.target_height_m ?? row?.height_m ?? 1;
        const root = new THREE.Group(); root.add(g.scene);
        const box = new THREE.Box3().setFromObject(g.scene), size = box.getSize(new THREE.Vector3());
        const k = size.y > 0 ? height / size.y : 1; g.scene.scale.multiplyScalar(k);
        const b2 = new THREE.Box3().setFromObject(g.scene), c = b2.getCenter(new THREE.Vector3());
        g.scene.position.set(-c.x, -b2.min.y, -c.z);
        return root;
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
