// The riverside under the hill town: the quay on the bay and the bank either side of it. What
// the river brings and takes: round coracles of bitumen-coated basketry (the quffa, still on the Euphrates and the
// Tigris a century ago), a slender reed boat, the landing stage, rows of storage jars, sealed provisions, sacks; north
// of the landing the market round them, its scribe among the stalls (market.js); a shadoof lifting water from the
// river to the gardens; nets drying on poles. The plants go with the scene's (hillScene.js):
// here only where they stand.

import * as THREE from 'three';
import { makeRng } from './rand.js';
import { makeKit, JAR } from './houseKit.js';
import { buildMarket } from './market.js';
import { addHull, setHull } from './shade.js';
import { heightAt, eastEdge } from './hillLand.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Y = V(0, 1, 0);
const at = (x, y, z, yaw = 0, s = 1) => new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromAxisAngle(Y, yaw), V(s, s, s));

// the places (on the quay's top and the bank)
// the boats from the Blender scene (hillScene.js places them), drawn in alongside the town's bank: their middles
// and turns (their length along their own z). (Each, like the quffas and reed boats below, where the bed under
// its whole hull lies deeper than its keel: the bank's wandering edge had the skiff aground on it)
// The cargo boat lies across the bay at a slant, its stern in by the bank at the
// north-east, its bow out to the river: from the quay, where one first stands, the eye runs along it to the open
// water, and it and the skiff close a V on the river, rather than its length standing broadside across the view
export const BOATS = { cargo: { x: -45.5, z: 10.5, yaw: -0.95 }, skiff: { x: -46.1, z: -0.9, yaw: Math.PI / 4 } };
// the landing stage out from the town's bank (buildRiverside): its top, and its steps down at the west end
export const STAGE = { x0: -43.6, x1: -36.8, z0: 3.6, z1: 5.8, y: 1.05, steps: 4, run: 0.35 };
// (the shadoof on the bank just north of the bay, where the grove begins; its few plots in the grove behind it)
export const SHADOOF = { x: eastEdge(-19) + 3.4, z: -19 };
export const FIELD = { x0: SHADOOF.x + 4, x1: SHADOOF.x + 12.5, z0: -28, z1: -19.5 };

// the villages' houses in the groves: middle, size (m), storeys
export const VILLAGE = [
  { x: -46, z: -36, w: 6, d: 5, storeys: 1 }, { x: -39, z: -60, w: 7, d: 6, storeys: 2 }, { x: -52, z: -74, w: 5.5, d: 5, storeys: 1 },
  { x: -22, z: -68, w: 8, d: 6, storeys: 2 }, { x: -33, z: -92, w: 6, d: 6, storeys: 1 }, { x: -2, z: -82, w: 7, d: 5, storeys: 1 },
  { x: -47, z: 60, w: 6, d: 5, storeys: 1 }, { x: -40, z: 80, w: 7, d: 6, storeys: 2 }, { x: -53, z: 96, w: 6, d: 5, storeys: 1 },
  { x: -20, z: 102, w: 8, d: 6, storeys: 2 }, { x: -32, z: 120, w: 6, d: 6, storeys: 1 },
];

export function buildRiverside(scene) {
  const rng = makeRng(4242);
  const kit = makeKit({ rng, heightAt, openAt: () => false });
  // (where the pieces go: the riverside's one kit, or, while a boat afloat is built, that boat's own, so that it
  // can rock on the water: afloat, sway)
  let cur = kit;
  const get = (k) => cur.get(k), box = (...a) => cur.box(...a);
  const { paintedJar } = kit;
  const gy = (x, z) => heightAt(x, z);
  const jar = (x, z, s = 1, kind = rng() < 0.6 ? 'clay' : 'buff', y = gy(x, z) - 0.02) => {
    get(kind).add(JAR, at(x, y, z, rng() * 6, s));
    return y + 1.11 * s;
  };
  const sack = (x, z, s = 1, y = gy(x, z)) => {
    const g = new THREE.SphereGeometry(0.34, 10, 7).deleteAttribute('uv');
    get('linen').add(g, new THREE.Matrix4().compose(V(x, y + 0.36 * s, z), new THREE.Quaternion().setFromAxisAngle(Y, rng() * 6), V(s, s * 1.25, s * 0.85)));
    const n = new THREE.CylinderGeometry(0.07, 0.11, 0.16, 8).deleteAttribute('uv');
    get('straw').add(n, at(x, y + 0.8 * s, z, 0, s));
  };
  // (a coiled basket of palm leaf, as they were made: its coils standing out round it, its rim rolled, its inside
  // the brown of the weave, so it reads a basket, not a tub of water)
  const basket = (x, z, s = 1, y = gy(x, z)) => {
    get('straw').add(new THREE.CylinderGeometry(0.4, 0.33, 0.55, 14, 1, true).deleteAttribute('uv'), at(x, y + 0.27 * s, z, 0, s));
    get('wood').add(new THREE.CircleGeometry(0.39, 14).rotateX(-Math.PI / 2).deleteAttribute('uv'), at(x, y + 0.42 * s, z, 0, s));
    get('straw').add(new THREE.TorusGeometry(0.4, 0.03, 5, 16).rotateX(Math.PI / 2).deleteAttribute('uv'), at(x, y + 0.54 * s, z, 0, s));
    for (let h = 0.06; h < 0.5; h += 0.075) get('straw').add(new THREE.TorusGeometry(0.333 + 0.067 * (h / 0.55), 0.016, 4, 16).rotateX(Math.PI / 2).deleteAttribute('uv'), at(x, y + h * s, z, 0, s));
  };

  // ---- the boats ----
  // a boat tied up: a rope of twisted palm fibre from `from` (a point on the boat) to a stake driven into the bank
  // the way `land` points ([dx, dz]), where the ground first stands clear of the water, and a little beyond; the
  // rope sagging a little between them, a few turns round the stake's head
  const moor = (from, land) => {
    let sx = from.x, sz = from.z;
    for (let t = 0.5; t < 14; t += 0.25) {
      sx = from.x + land[0] * t; sz = from.z + land[1] * t;
      if (heightAt(sx, sz) > 0.3) { sx += land[0] * 0.6; sz += land[1] * 0.6; break; }
    }
    const g = heightAt(sx, sz), top = g + 0.7;
    const stake = new THREE.CylinderGeometry(0.045, 0.06, 1.1, 7).deleteAttribute('uv');
    kit.get('wood').add(stake, new THREE.Matrix4().compose(V(sx, g + 0.15, sz), new THREE.Quaternion().setFromEuler(new THREE.Euler(land[1] * 0.12, 0, -land[0] * 0.12)), V(1, 1, 1)));
    const end = V(sx - land[0] * 0.05, top - 0.12, sz - land[1] * 0.05), len = from.distanceTo(end), sag = Math.min(0.3, 0.05 * len);
    const pts = [];
    for (let k = 0; k <= 10; k++) { const t = k / 10; pts.push(from.clone().lerp(end, t).add(V(0, -sag * Math.sin(Math.PI * t), 0))); }
    kit.get('straw').tube(pts, pts.map(() => 0.016), 5);
    for (const dy of [0, 0.035]) kit.get('straw').add(new THREE.TorusGeometry(0.06, 0.016, 4, 10).rotateX(Math.PI / 2).deleteAttribute('uv'), at(sx, top - 0.12 + dy, sz));
  };
  // a boat afloat, built as its own group about its middle (x, z), so it can rock on the water; hull: its cut-out in
  // the water (addHull's index) and that's turn
  const floating = [];
  const afloat = (x, z, build) => {
    cur = makeKit({ rng, heightAt, openAt: () => false });
    const hull = build();
    const outer = new THREE.Group(), inner = new THREE.Group();
    outer.position.set(x, 0, z);
    outer.rotation.order = 'YXZ';
    inner.position.set(-x, 0, -z);
    outer.add(inner);
    cur.meshes(inner, []);
    scene.add(outer);
    cur = kit;
    floating.push({ g: outer, x, z, yaw: 0, hull });
  };
  // a coracle: a big round basket, near flat-bottomed, its sides upright and turning in a little at the top; its
  // bottom and the foot of its sides coated with bitumen, the weave of reed showing above and inside; a thin rim
  const lathe = (pts) => { const g = new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), 32).deleteAttribute('uv'); g.computeVertexNormals(); return g; };
  const QUFFA = lathe([[0, 0.02], [1.0, 0.03], [1.36, 0.12], [1.5, 0.34], [1.505, 0.4]]);
  const WEAVE = lathe([[1.505, 0.4], [1.49, 0.62], [1.41, 0.8], [1.36, 0.79], [1.43, 0.6], [1.44, 0.34], [1.3, 0.16], [0.95, 0.1], [0, 0.09]]);
  const RIM = new THREE.TorusGeometry(1.39, 0.045, 5, 32).rotateX(Math.PI / 2).deleteAttribute('uv');
  const quffa = (x, z, y, s, { flip = false, tilt = 0, load = false } = {}) => {
    const m = new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(flip ? Math.PI : tilt, rng() * 6, 0)), V(s, s, s));
    if (flip) m.premultiply(new THREE.Matrix4().makeTranslation(0, 0.8 * s, 0));
    get('dark').add(QUFFA, m);
    get('straw').add(WEAVE, m);
    get('wood').add(RIM, m.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0.8, 0)));

    // (its load: jars and sacks, or melons and a heap of reed bundles)
    if (load === 'jars') {
      for (let k = 0; k < 6; k++) {
        const a = k * 1.05 + 0.3, r = k ? 0.75 : 0;
        get(k % 2 ? 'clay' : 'buff').add(JAR, at(x + Math.cos(a) * r * s, y + 0.1 * s, z + Math.sin(a) * r * s, rng() * 6, 0.55 * s));
      }
    } else if (load === 'sacks') {
      for (let k = 0; k < 4; k++) sack(x + Math.cos(k * 1.6) * 0.6 * s, z + Math.sin(k * 1.6) * 0.6 * s, 0.85 * s, y + 0.1 * s);
      get('straw').add(new THREE.CylinderGeometry(0.16, 0.16, 1.9, 8).rotateZ(Math.PI / 2).deleteAttribute('uv'), at(x, y + 0.75 * s, z, rng() * 6, s));
    }
  };
  // (afloat: no water inside it; tied by its rim to a stake up the bank, east)
  const quffaAfloat = (x, z, y, s, opts) => {
    afloat(x, z, () => { quffa(x, z, y, s, opts); return { i: addHull(x, z, 0, 1.3 * s, 1.3 * s, { k: 0.5 }), lx: 0, lz: 0, yaw: 0 }; });
    moor(V(x + 1.42 * s, y + 0.8 * s, z), [1, 0]);
  };
  quffaAfloat(-44.5, 18.5, -0.2, 1, { load: 'jars' });     // afloat by the bank, loaded with jars
  quffaAfloat(-43.6, 15.0, -0.24, 0.9, { load: 'sacks' });  // afloat by the bank, with sacks
  quffa(-53, 34.0, gy(-53, 34.0) - 0.05, 0.95, { flip: true });       // upturned on the bay's south shore
  quffa(-56.2, 35.8, gy(-56.2, 35.8) - 0.1, 0.85, { tilt: 0.35 });    // drawn up, leaning
  // a reed boat: long and slender, its ends swept up, coated black
  const reedBoat = (x, z, yaw, len = 6.4) => {
    const b = get('dark'), S = 9, N = 26, base = b.count;
    const ring = [];
    for (let i = 0; i <= N; i++) {
      const u = -1 + (2 * i) / N, w = 0.48 * Math.max(0, 1 - u * u) ** 0.55 + 0.03, d = 0.34 * Math.max(0, 1 - u * u) ** 0.4 + 0.02;
      const cy = 0.95 * Math.max(0, Math.abs(u) - 0.55) ** 2 / 0.2, along = (u * len) / 2;
      for (let j = 0; j < S; j++) {
        const a = Math.PI * (j / (S - 1)), sx = -Math.cos(a) * w, sy = cy - Math.sin(a) * d + 0.32;
        const p = V(along, sy, sx).applyAxisAngle(Y, yaw).add(V(x, 0, z));
        const n = V(0, -Math.sin(a), -Math.cos(a)).applyAxisAngle(Y, yaw);
        b.vert(p.x, p.y, p.z, n.x, n.y, n.z);
      }
      ring.push(i);
    }
    // (its outside, and its inside: the same rings again, facing in; with only one, the hull's near side was gone
    // from a boat seen from beside it)
    const inner = b.count;
    for (let k = base; k < inner; k++) b.vert(b.p[3 * k], b.p[3 * k + 1], b.p[3 * k + 2], -b.n[3 * k], -b.n[3 * k + 1], -b.n[3 * k + 2]);
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < S - 1; j++) {
        const a = base + i * S + j, c = inner + i * S + j;
        b.tri(a, a + 1, a + S); b.tri(a + 1, a + S + 1, a + S);
        b.tri(c, c + S, c + 1); b.tri(c + 1, c + S, c + S + 1);
      }
    }
    // (thwarts, a punting pole lying in it)
    for (const u of [-0.3, 0.25]) box('wood', x + Math.sin(yaw) * 0 + Math.cos(yaw) * u * len / 2, 0.3, z - Math.sin(yaw) * u * len / 2, 0.08, 0.06, 0.9, yaw);
    get('wood').tube([V(x - Math.cos(yaw) * 2.6, 0.38, z + Math.sin(yaw) * 2.6 + 0.15), V(x + Math.cos(yaw) * 3.4, 0.5, z - Math.sin(yaw) * 3.4 + 0.1)], [0.035, 0.03], 5);
  };
  // (afloat by the bay's shores, each tied by the end nearer the bank; no water inside them)
  const reedTied = (x, z, yaw, len, end, land) => {
    afloat(x, z, () => { reedBoat(x, z, yaw, len); return { i: addHull(x, z, yaw + Math.PI / 2, (len / 2) * 0.8, 0.42, { k: 1 }), lx: 0, lz: 0, yaw: yaw + Math.PI / 2 }; });
    moor(V(x + Math.cos(yaw) * end * len * 0.46, 0.75, z - Math.sin(yaw) * end * len * 0.46), land);
  };
  reedTied(-51, 23, 0.6, 6.4, 1, [0.5, 0.85]);
  reedTied(-49.5, -6, -0.45, 6.6, 1, [0.15, -0.99]);   // (in under the spit)
  // the landing stage: the one straight, built thing in the cove's soft shore, out
  // from the town's bank under the quay. A pier of fired brick, its foot sealed with bitumen where the water
  // laps, a coping course along its top, steps down into the water at its end for those going down to the boats,
  // two posts of palm log to tie up to; on it a jar and a coil of rope
  {
    const { x0, x1, z0, z1, y } = STAGE, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = z1 - z0;
    kit.box('firedbrick', cx, (y - 1.0) / 2, cz, x1 - x0, y + 1.0, w);
    kit.box('firedbrick', cx - 0.02, y + 0.04, cz, x1 - x0 + 0.04, 0.08, w + 0.1);
    kit.box('dark', cx - 0.02, 0.1, cz, x1 - x0 + 0.04, 0.5, w + 0.04);
    for (let k = 1; k <= STAGE.steps; k++) {
      const top = y - 0.25 * k, xa = x0 - (k - 1) * STAGE.run, xb = x0 - k * STAGE.run;
      kit.box('firedbrick', (xa + xb) / 2 - 0.005, (top - 1.0) / 2, cz, 0.36, top + 1.0, w - 0.2);
      if (top < 0.4) kit.box('dark', (xa + xb) / 2 - 0.01, Math.max(top - 0.25, -0.15) / 2 + Math.min(top, 0.35) / 2 - 0.005, cz, 0.37, Math.min(top, 0.35) - Math.max(top - 0.25, -0.15) - 0.01, w - 0.18);
    }
    for (const px of [x0 + 0.7, x0 + 3.2]) {
      kit.get('wood').tube([V(px, y - 0.1, z1 - 0.18), V(px, y + 0.85, z1 - 0.18)], [0.11, 0.1], 7);
      for (const dy of [0.55, 0.6]) kit.get('straw').add(new THREE.TorusGeometry(0.11, 0.018, 4, 10).rotateX(Math.PI / 2).deleteAttribute('uv'), at(px, y + dy, z1 - 0.18));
    }
    kit.get('clay').add(JAR, at(x1 - 1.2, y + 0.06, z0 + 0.5, 0.4, 0.8));
    for (let k = 0; k < 3; k++) kit.get('straw').add(new THREE.TorusGeometry(0.28 - k * 0.07, 0.025, 4, 14).rotateX(Math.PI / 2).deleteAttribute('uv'), at(x1 - 2.4, y + 0.1 + k * 0.04, z0 + 0.55));
  }
  // a line from a point on a boat to the head of one of the landing stage's posts, sagging a little
  const tie = (from, px, pz) => {
    const end = V(px, STAGE.y + 0.6, pz), len = from.distanceTo(end), sag = Math.min(0.25, 0.06 * len), pts = [];
    for (let k = 0; k <= 10; k++) { const t = k / 10; pts.push(from.clone().lerp(end, t).add(V(0, -sag * Math.sin(Math.PI * t), 0))); }
    kit.get('straw').tube(pts, pts.map(() => 0.016), 5);
  };
  // the cargo boat and the skiff (hillScene.js): the cargo boat by its stern, a line to the landing stage's post
  // and one up the bank; the skiff by its bow
  {
    const end = (b, lz, y) => V(b.x + Math.sin(b.yaw) * lz, y, b.z + Math.cos(b.yaw) * lz);
    const C = BOATS.cargo, S = BOATS.skiff;
    tie(end(C, -4.8, 1.05), STAGE.x0 + 0.7, STAGE.z1 - 0.18);
    moor(end(C, -4.6, 1.05), [0.86, 0.51]);
    moor(end(S, 3.4, 0.95), [0.71, -0.71]);
  }

  // ---- on the quay: the cargo, counted ----
  // storage jars in rows, some sealed with a clay stopper and a cord; provisions for the town's stores. Against the
  // first house's wall, north of the start, the painted ones at the wall
  for (let k = 0; k < 9; k++) {
    const x = -33.4 + (k % 3) * 1.15 + (rng() - 0.5) * 0.1, z = 3.1 + Math.floor(k / 3) * 1.15 + (rng() - 0.5) * 0.1, s = 1.15 + rng() * 0.2;
    const top = jar(x, z, s);
    if (k % 2 === 0) {
      get('earth').add(new THREE.CylinderGeometry(0.33 * s, 0.35 * s, 0.1, 14).deleteAttribute('uv'), at(x, top - 0.02, z));
      get('straw').add(new THREE.TorusGeometry(0.31 * s, 0.025, 5, 14).rotateX(Math.PI / 2).deleteAttribute('uv'), at(x, top - 0.12, z));
    }
  }
  for (let k = 0; k < 4; k++) paintedJar(-29.7 + (k % 2) * 1.1, gy(-29.7, 4.0) - 0.03, 4.0 + Math.floor(k / 2) * 1.2, 1.05 + rng() * 0.15, rng() * 6, k % 3);
  // sacks of barley, in a heap along the same wall, south of the jars
  for (let k = 0; k < 9; k++) {
    const row = k < 5 ? 0 : 1, x = -32.6 + (k < 5 ? k : k - 5 + 0.5) * 0.78, z = 6.75 + (rng() - 0.5) * 0.15;
    sack(x, z + (row ? 0.1 : 0), 0.95 + rng() * 0.15, gy(x, z) + row * 0.55);
  }
  // the market north of the landing, round the heaps of jars and sacks; in it the scribe's corner, and the bales
  // and baskets that were on the quay's south side, where the old temple's ruins now stand (market.js)
  buildMarket(kit, { rng, gy, jar, sack, basket });

  // ---- along the bank: a shadoof lifting water to the plots; nets on poles ----
  {
    const { x, z } = SHADOOF, y = gy(x, z);
    // two posts and a crossbar, the long sweep pivoting on it: a lump of mud at the short end, a leather bucket
    // on a rope at the long end, out over the water
    for (const o of [-0.45, 0.45]) get('wood').tube([V(x, y - 0.2, z + o), V(x + 0.05, y + 2.4, z + o * 0.8)], [0.09, 0.07], 6);
    get('wood').tube([V(x + 0.05, y + 2.35, z - 0.5), V(x + 0.05, y + 2.35, z + 0.5)], [0.06, 0.06], 6);
    // (at rest: the weighted end down, the bucket's end up over the water)
    const pv = V(x + 0.05, y + 2.42, z), dir = V(-Math.cos(0.38), Math.sin(0.38), 0);
    const p0 = pv.clone().addScaledVector(dir, -2.3), p1 = pv.clone().addScaledVector(dir, 4.6);
    get('wood').tube([p0, pv, p1], [0.07, 0.065, 0.045], 6);
    get('mud').add(new THREE.SphereGeometry(0.42, 10, 8).deleteAttribute('uv'), new THREE.Matrix4().compose(p0.clone().add(V(0, -0.15, 0)), new THREE.Quaternion(), V(1, 0.85, 1)));
    const by = p1.y - 1.9;
    get('straw').tube([p1, V(p1.x, by + 0.35, p1.z)], [0.012, 0.012], 3);
    get('dark').add(new THREE.CylinderGeometry(0.22, 0.16, 0.34, 10, 1, true).deleteAttribute('uv'), at(p1.x, by + 0.17, p1.z));
    // the channel it fills, along to the plots
    box('mud', (x + FIELD.x0) / 2 + 2, y - 0.02, z - 1.2, FIELD.x0 - x + 4, 0.06, 0.55);
  }
  // the plots: low earth ridges round small square basins (the leeks and herbs in them are the scene's)
  const plots = [];
  for (let px = FIELD.x0; px < FIELD.x1 - 3; px += 4.2) {
    for (let pz = FIELD.z0; pz < FIELD.z1 - 3; pz += 4.2) {
      const y = gy(px + 2, pz + 2);
      for (const [cx, cz, sx, sz] of [[px + 2, pz, 4.2, 0.35], [px, pz + 2, 0.35, 4.2]]) box('earth', cx, y + 0.06, cz, sx, 0.2, sz);
      plots.push({ x: px + 2.1, z: pz + 2.1, y, crop: rng() < 0.55 ? 'leeks' : rng() < 0.6 ? 'herbs' : 'bare' });
    }
  }
  // nets drying on poles, behind the market's fish stall (they were on the bay's south shore); a
  // fish basket. A net knotted by hand of flax or palm-fibre cord: a
  // diamond mesh, drawn long by its own weight, the colour of the cord; thrown over a pole between two forked posts
  // and left to hang as it fell, in folds deepening downwards, its foot uneven, the clay sinkers along it
  for (const [nx, nz, yaw] of [[-44.7, -13.2, 0.06], [-41.2, -13.45, -0.05]]) {
    const y = gy(nx, nz), W = 3.4, H = 1.55, top = y + 2.15;
    const ax = V(Math.cos(yaw), 0, -Math.sin(yaw)), nrm = V(Math.sin(yaw), 0, Math.cos(yaw)), c = V(nx, 0, nz);
    // the posts, each forked at its head; the pole laid in the forks
    for (const sd of [-1, 1]) {
      const b = c.clone().addScaledVector(ax, sd * (W / 2 + 0.2)), h = top + 0.04;
      get('wood').tube([b.clone().setY(y - 0.2), b.clone().setY(h - 0.12)], [0.05, 0.042], 5);
      for (const f of [-1, 1]) get('wood').tube([b.clone().setY(h - 0.12), b.clone().setY(h + 0.06).addScaledVector(nrm, f * 0.07)], [0.03, 0.022], 4);
    }
    get('wood').tube([c.clone().addScaledVector(ax, -W / 2 - 0.45).setY(top), c.clone().addScaledVector(ax, W / 2 + 0.45).setY(top + 0.03)], [0.032, 0.028], 6);
    // the net: s across (−1..1), t down (0 at the pole, 1 at its foot). Longer than the pole is high, its foot lies
    // gathered on the ground behind; gathered on the pole in five bunches, so it falls in folds, deeper the lower;
    // not quite the pole's width, a little to one side
    const g0 = gy(nx, nz) + 0.03;
    const P = (s, t) => {
      const len = 2.3 - 0.3 * (0.5 + 0.5 * Math.cos(s * Math.PI * 2.3 + nx));
      let yy = top - 0.03 - t * len, out = (0.05 + 0.2 * t) * Math.sin(s * Math.PI * 5 + nz) + 0.05 * t;
      if (yy < g0) { out -= (g0 - yy) * 0.9; yy = g0; }
      return c.clone().addScaledVector(ax, s * (W / 2) * 0.85 * (1 - 0.12 * t) - 0.12).addScaledVector(nrm, out).setY(yy);
    };
    // the cords: one set running down to the right, one to the left, crossing in diamonds drawn out long by the
    // net's weight (m: their spacing across; sl: how far one runs across on its way down), each a little uneven
    const m = 0.06, sl = 0.3, n = 18;
    for (const dir of [-1, 1]) {
      for (let s0 = -1 - sl, q = 0; s0 <= 1 + sl; s0 += m, q++) {
        const pts = [], wob = 0.012 * Math.sin(q * 12.9898 + dir * 78.233);
        for (let k = 0; k <= n; k++) {
          const t = k / n, sv = s0 + dir * t * sl + wob * Math.sin(t * 9 + q);
          if (sv >= -1 && sv <= 1) pts.push(P(sv, t));
        }
        if (pts.length > 1) get('straw').tube(pts, pts.map(() => 0.005), 3);
      }
    }
    // its head rope along the pole, its foot rope, and the sinkers, little rings of fired clay, lying with it
    const head = [], footR = [];
    for (let k = 0; k <= 24; k++) { const sv = -1 + k / 12; head.push(P(sv, 0)); footR.push(P(sv, 1)); }
    get('straw').tube(head, head.map(() => 0.012), 4);
    get('straw').tube(footR, footR.map(() => 0.01), 4);
    for (let k = 0; k <= 12; k++) {
      const p = P(-1 + k / 6, 1);
      get('clay').add(new THREE.TorusGeometry(0.035, 0.018, 5, 8).rotateX(Math.PI / 2).deleteAttribute('uv'), at(p.x, p.y - 0.01, p.z, yaw));
    }
  }
  basket(-39.0, -13.9, 0.8);
  // (the bread oven, its firewood and its potted plant, that stood on the bank above the quay, are gone: the old
  // hall's ruins are there now)

  // ---- in the groves north and south of the quay, half seen among the palms: the houses of the riverside's
  // villages, plain, a storey or two, their doors on the side towards the town ----
  const village = [];
  for (const v of VILLAGE) {
    const h = { x0: v.x - v.w / 2, x1: v.x + v.w / 2, z0: v.z - v.d / 2, z1: v.z + v.d / 2 };
    // (not where the river's wandering bank comes in under it)
    if ([h.x0 - 2, h.x1 + 2].some((x) => [h.z0 - 2, h.z1 + 2].some((z) => gy(x, z) < 0.5))) continue;
    village.push(v);
    kit.build(h, { storeys: v.storeys });
    const fz = v.z > 0 ? h.z0 - 0.02 : h.z1 + 0.02, s = v.z > 0 ? -1 : 1, dx = v.x + (rng() - 0.5) * (v.w - 2), y = gy(dx, fz + s * 0.6);
    box('dark', dx, y + 0.95, fz, 0.95, 1.9, 0.08);
    box('wood', dx, y + 2.0, fz + s * 0.06, 1.4, 0.18, 0.2);
  }

  const walkables = kit.meshes(scene, ['wood', 'stone', 'straw', 'linen', 'earth', 'clay', 'buff', 'dark', 'firedbrick']);
  // the boats afloat, rocking where they lie tied: rising and settling on the small waves, rolling and pitching a
  // little, swinging slowly on their lines (no more than their ropes, fixed, would let them); their cut-outs in
  // the water going with them. (hillScene.js adds the cargo boat and the skiff)
  const sway = (t) => {
    floating.forEach((e, k) => {
      const p = k * 1.93 + 0.4;
      const yaw = e.yaw + 0.006 * Math.sin(0.23 * t + p);
      e.g.rotation.set(0.007 * Math.sin(1.15 * t + 1.7 * p), yaw, 0.018 * Math.sin(0.9 * t + p));
      e.g.position.y = 0.012 * Math.sin(1.3 * t + p) + 0.006 * Math.sin(2.3 * t + 2 * p);
      if (e.hull) {
        const { i, lx, lz } = e.hull, c = Math.cos(yaw), sn = Math.sin(yaw);
        setHull(i, e.x + lx * c + lz * sn, e.z - lx * sn + lz * c, yaw - e.yaw + e.hull.yaw);
      }
    });
  };
  return { walkables, plots, decor: kit.decor, village, floating, sway };
}
