import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
// A shallow tapered ceramic head: a real face and bevel, not a coloured quad.
// (six sides and the face; the foot is in the wall and never seen)
const CONE = (() => {
  const g = new THREE.CylinderGeometry(0.9, 1, 1, 6, 1, false);
  const keep = g.groups[0].count + g.groups[1].count;
  g.setIndex(Array.from(g.index.array.slice(0, keep)));
  g.clearGroups();
  return g.deleteAttribute('uv');
})();
export function coneHead(builder, centre, normal, radius = 0.039, depth = 0.035) {
  const matrix = new THREE.Matrix4().compose(centre, new THREE.Quaternion().setFromUnitVectors(UP, normal), V(radius, depth, radius));
  builder.add(CONE, matrix);
}

// One local rectangle, including sloping roofs. No layout RNG is consumed:
// changing the workmanship must not reshuffle the town or its furnishings.
export function wovenReedMat(get, x, y, z, w, d, yaw = 0, slopeX = 0, slopeZ = 0) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const point = (u, v, lift = 0) => V(x + c * u + s * v, y + slopeX * u + slopeZ * v + lift, z - s * u + c * v);
  const count = Math.max(2, Math.ceil(d / 0.075));
  for (let i = 0; i <= count; i++) {
    const v = -d / 2 + i * d / count;
    get('straw').tube([point(-w / 2, v), point(0, v, -0.018), point(w / 2, v)], [0.024, 0.023, 0.021], 5);
  }
  for (let u = -w / 2 + 0.06; u < w / 2; u += 0.24) {
    const points = [];
    // (over one reed, under the next: a stitch a reed is enough at walking distance)
    for (let j = 0; j <= count; j++) points.push(point(u, -d / 2 + j * d / count, j % 2 ? -0.025 : 0.026));
    get('linen').tube(points, points.map(() => 0.008), 3);
  }
  // The binding remains visible at the rim; structural timber is below it.
  for (const v of [-d / 2 + 0.07, d / 2 - 0.07]) {
    get('wood').tube([point(-w / 2 - 0.08, v, -0.08), point(w / 2 + 0.08, v, -0.08)], [0.055, 0.05], 7);
  }
  for (const u of [-w / 2 + 0.08, w / 2 - 0.08]) {
    get('wood').tube([point(u, -d / 2 - 0.07, -0.08), point(u, d / 2 + 0.07, -0.08)], [0.05, 0.045], 7);
    for (const v of [-d / 2 + 0.08, d / 2 - 0.08]) {
      const points = [];
      for (let j = 0; j <= 40; j++) {
        const a = j / 10 * Math.PI * 2;
        points.push(point(u + (j / 40 - 0.5) * 0.11, v + Math.sin(a) * 0.065, -0.065 + Math.cos(a) * 0.065));
      }
      get('straw').tube(points, points.map(() => 0.009), 4);
    }
  }
}

// A clay tablet (the scribe's on the quay, riverside.js): a small cushion of clay, its
// edges rounded, w by d and 3.5 cm thick, lying on a surface at (x, y, z) turned rot about its face's normal (up;
// or face: another, for one propped on its edge); its face written in rows of small wedges, or left smooth (a new
// one, or one in a stack). Its wedges are thrown by a hash of where it lies: no layout RNG is consumed
const TABLET = new RoundedBoxGeometry(1, 1, 1, 2, 0.18).deleteAttribute('uv');
export function clayTablet(get, x, y, z, w, d, rot = 0, { kind = 'buff', lines = true, face = UP } = {}) {
  const q = new THREE.Quaternion().setFromUnitVectors(UP, face).multiply(new THREE.Quaternion().setFromAxisAngle(UP, rot));
  const at = (u, h, v) => V(u, h, v).applyQuaternion(q).add(V(x, y, z));
  get(kind).add(TABLET, new THREE.Matrix4().compose(at(0, 0.016, 0), q, V(w, 0.035, d)));
  if (!lines) return;
  const hash = (k) => { const t = Math.sin(x * 127.1 + z * 311.7 + y * 74.7 + k * 19.19) * 43758.5453; return t - Math.floor(t); };
  const m = get('mud'), n = face, rows = Math.floor(d / 0.022) - 1;
  for (let row = 0; row < rows; row++) {
    for (let k = 0, nk = 3 + Math.floor(hash(row) * (w / 0.02 - 3)); k < nk; k++) {
      const u = -w / 2 + 0.012 + k * 0.019 + hash(row * 31 + k) * 0.004, v = -d / 2 + 0.016 + row * 0.022;
      const i0 = m.count;
      for (const [a, b] of [[u, v], [u + 0.012, v - 0.004], [u + 0.012, v + 0.004]]) { const p = at(a, 0.0345, b); m.vert(p.x, p.y, p.z, n.x, n.y, n.z); }
      m.tri(i0, i0 + 2, i0 + 1);
    }
  }
}
