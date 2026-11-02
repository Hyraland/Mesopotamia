// Sheep for the market's pen, made from "Sheep" by DibArts
// (https://sketchfab.com/3d-models/sheep-5b11b1aedc9a478eb5e2f3adcf0f4e2e, CC BY 4.0; models/sheep_dibarts, as in
// the yili_sheep walk), changed towards the sheep of the Uruk vase and the Standard of Ur: longer in the leg, the
// fleece closer to the body and coarser in colour (white, fawn or brown, not all cream), the rams with long horns
// twisting out sideways. Its parts: the body's skin, head and legs (Object_0), the fleece (Object_2), the eyes
// (Object_1 whites, Object_3 pupils), the hooves (Object_4); in the model's own units, its head along +z.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
// (by the nodes' names: each node holds one of the meshes, Object_4 the first)
const PARTS = { Object_4: 'skin', Object_5: 'white', Object_6: 'wool', Object_7: 'pupil', Object_8: 'hoof' };
let SHEEP = null;
// (the legs: below KNEE drawn out by LEG; the fleece drawn in towards the body's axis by TRIM)
const KNEE = -2.4, LEG = 1.55, TRIM = 0.96;

export async function loadSheep(url = 'models/sheep_dibarts/scene.gltf') {
  const gltf = await new GLTFLoader().loadAsync(url);
  gltf.scene.updateMatrixWorld(true);
  const parts = {};
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    // (back into the parts' own frame: the model's wrappers only turn it about and back)
    const g = o.geometry.clone();
    for (const a of Object.keys(g.attributes)) if (a !== 'position' && a !== 'normal') g.deleteAttribute(a);
    parts[PARTS[o.name] ?? o.name] = g;
  });
  // (the body's middle line, for drawing the fleece in towards it)
  const p = parts.wool.attributes.position;
  let cy = 0;
  for (let i = 0; i < p.count; i++) cy += p.getY(i);
  cy /= p.count;
  for (const [name, g] of Object.entries(parts)) {
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i), y = pos.getY(i);
      if (name === 'wool') { x *= TRIM; y = cy + (y - cy) * TRIM; }
      if (y < KNEE) y = KNEE + (y - KNEE) * LEG;
      pos.setXY(i, x, y);
    }
    g.computeVertexNormals();
  }
  const box = new THREE.Box3();
  for (const g of Object.values(parts)) { g.computeBoundingBox(); box.union(g.boundingBox); }
  SHEEP = { parts, foot: box.min.y, height: box.max.y - box.min.y, mid: (box.min.z + box.max.z) / 2 };
}

// a sheep standing at (x, y, z) on the ground, its head towards yaw (0: +z); h its height to the top of its head;
// coat: its fleece's kind; face: its head's and legs'; ram: horns. Nothing if the model is not loaded
export function sheep(get, x, y, z, yaw, { h = 0.95, coat = 'linen', face = 'hair', ram = false } = {}) {
  if (!SHEEP) return;
  const s = h / SHEEP.height;
  const m = new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(s, s, s))
    .multiply(new THREE.Matrix4().makeTranslation(0, -SHEEP.foot, -SHEEP.mid));
  const kinds = { skin: face, wool: coat, white: 'linen', pupil: 'dark', hoof: 'dark' };
  for (const [name, g] of Object.entries(SHEEP.parts)) get(kinds[name]).add(g, m);
  if (!ram) return;
  // the ram's horns: from the top of the head, out sideways, twisting round as they go, tapering
  for (const side of [-1, 1]) {
    const pts = [], radii = [];
    for (let k = 0; k <= 24; k++) {
      const t = k / 24, a = t * Math.PI * 4.2, r = 0.32 * (1 - 0.55 * t);
      pts.push(V(side * (0.3 + 1.9 * t), 1.55 + r * Math.cos(a) - 0.25 * t, 3.05 + r * Math.sin(a) - 0.2 * t).applyMatrix4(m));
      radii.push((0.17 - 0.13 * t) * s);
    }
    get('buff').tube(pts, radii, 7);
  }
}
