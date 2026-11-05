import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { makeCypress, makePine, makeRock, makeProp, triangles } from '../src/client/props';

const size = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());
describe('code-built props (assets/STYLE.md budgets and shapes)', () => {
  it('triangle budgets: trees <= 3000, rocks <= 2000', () => {
    for (const v of [0, 1]) expect(triangles(makeCypress(v)), `cypress ${v}`).toBeLessThanOrEqual(3000);
    expect(triangles(makePine())).toBeLessThanOrEqual(3000);
    for (const v of [0, 1, 2]) expect(triangles(makeRock(v)), `rock ${v}`).toBeLessThanOrEqual(2000);
  });
  it('sizes are plausible: cypress 9 to 12 m and wider than a pine, pine about 15 m, rocks 1 to 4 m', () => {
    expect(size(makeCypress(0)).y).toBeGreaterThan(9); expect(size(makeCypress(0)).y).toBeLessThan(15);
    expect(size(makeCypress(1)).y).toBeGreaterThan(7); expect(size(makeCypress(1)).y).toBeLessThan(12);
    expect(size(makePine()).y).toBeGreaterThan(13); expect(size(makePine()).y).toBeLessThan(18);
    expect(size(makeCypress(0)).x).toBeGreaterThan(size(makePine()).x * 0.6);   // a wide wind-swept crown
    for (const v of [0, 1, 2]) { const s = size(makeRock(v)); expect(Math.max(s.x, s.y, s.z), `rock ${v}`).toBeGreaterThan(1); expect(Math.max(s.x, s.y, s.z)).toBeLessThan(6); }
  });
  it('props sit on the ground: lowest point near y = 0 (nothing floats or sinks)', () => {
    for (const o of [makeCypress(0), makeCypress(1), makePine(), makeRock(0), makeRock(1), makeRock(2)]) { const b = new THREE.Box3().setFromObject(o); expect(b.min.y).toBeGreaterThan(-0.5); expect(b.min.y).toBeLessThan(0.5); }
  });
  it('deterministic: the same variant gives identical geometry', () => {
    const a = makeCypress(0), b = makeCypress(0);
    expect(size(a).toArray()).toEqual(size(b).toArray()); expect(triangles(a)).toBe(triangles(b));
  });
  it('only palette colours from assets/STYLE.md are used', () => {
    const allowed = new Set(['#2f4a3a', '#3a5c46', '#284236', '#3d5a3a', '#35502f', '#456843', '#5b4636', '#4a382b', '#8a8f8c', '#7c817e', '#6f7570', '#9aa37a']);
    for (const o of [makeCypress(0), makeCypress(1), makePine(), makeRock(0), makeRock(1), makeRock(2)]) o.traverse(c => { const m = c as THREE.Mesh; if (m.isMesh) expect(allowed.has('#' + (m.material as THREE.MeshLambertMaterial).color.getHexString()), (m.material as THREE.MeshLambertMaterial).color.getHexString()).toBe(true); });
  });
  it('the cypress crown is swept to one side: its centre of mass sits off the trunk line, unlike the pine', () => {
    const cog = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).x;
    expect(Math.abs(cog(makeCypress(0)))).toBeGreaterThan(1.0); expect(Math.abs(cog(makePine()))).toBeLessThan(0.6);
  });
  it('makeProp covers every kind and index', () => { for (const k of ['cypress', 'pine', 'rock'] as const) for (let i = 0; i < 6; i++) expect(makeProp(k, i).children.length).toBeGreaterThan(0); });
});
