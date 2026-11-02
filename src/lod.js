// What is drawn by how far off it is, from the camera, every frame (lodUpdate): tiles of small things left out
// beyond a distance, a fine and a plain version of the same things swapped. Each mesh shown while its distance (from
// the camera to its bounds, 0 inside them) lies in [min, max); hidden, it is left out of the shadow maps too.

import * as THREE from 'three';

const items = [];
const _c = new THREE.Vector3();

export function lodAdd(mesh, { min = 0, max = Infinity } = {}) {
  const g = mesh.geometry;
  if (!g.boundingSphere) g.computeBoundingSphere();
  const s = mesh.isInstancedMesh && mesh.boundingSphere ? mesh.boundingSphere : g.boundingSphere;
  items.push({ mesh, c: s.center.clone().applyMatrix4(mesh.matrixWorld), r: s.radius, min, max });
}

export function lodUpdate(eye) {
  for (const it of items) {
    const d = Math.max(0, _c.copy(it.c).distanceTo(eye) - it.r);
    it.mesh.visible = d >= it.min && d < it.max;
  }
}
