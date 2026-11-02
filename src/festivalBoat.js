// The god's boat: at the festivals the gods went by water, Enki's boat from Eridu up
// to Nippur, Nanna's from Ur, carrying the god to visit another in his house. Here such a boat comes down the river
// past the quay every few minutes, under sail with the current, and goes on downstream into the haze.
//
// Long and high-ended as on the seals: a hull coated in bitumen, bound round with red bands towards its ends, its
// prow rising into a bundle of reeds curled over into a ring (Inanna's sign, as at the weavers' gate), its stern
// into a lower bundle bent forward; amidships the god's shrine, a little house of reed under an arched roof, a woven
// curtain over its door, two small ring-posts either side of it, offerings before it; a mast forward of it with a
// square linen sail, pennants of woven cloth streaming from poles at the stern, the steering oar lashed over the
// side. No one is seen aboard (the town is empty of people).
//
// Built about its own middle, its length along its own z (bow at +z), the waterline at y 0; moved each frame.

import * as THREE from 'three';
import { makeKit } from './houseKit.js';
import { makeRng } from './rand.js';
import { lightMat, addHull, setHull } from './shade.js';
import { weaveTexture } from './weaves.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const THIN = ['straw', 'linen', 'madder', 'indigo', 'saffron'];

// its course: down the river (the current runs south, +z) some 13 m out from the town's bank (deep enough under it
// all the way), from far upstream to far downstream; SPEED m/s, a pass every PERIOD s; at the start it is some way
// upstream, so it comes by soon; SCALE: the boat drawn a fifth larger than built
const FROM = -700, TO = 700, SPEED = 3.2, OUT = 13, START = -260, SCALE = 1.2;
const PERIOD = (TO - FROM) / SPEED;

export function buildFestivalBoat(scene, { eastEdge }) {
  const rng = makeRng(5150);
  const kit = makeKit({ rng, heightAt: () => -3, openAt: () => false });
  const { get, box, cloth, paintedJar, weave } = kit;
  const HALF = 6.5, GUN = 0.72;
  // (the hull's half beam, depth under the gunwale, and the rise of its ends, at u along it, -1 stern to 1 bow)
  const beam = (u) => 1.35 * Math.max(0, 1 - u * u) ** 0.5 + 0.04;
  const deep = (u) => 1.05 * Math.max(0, 1 - u * u) ** 0.35 + 0.03;
  const rise = (u) => (u > 0 ? 2.7 : 1.9) * Math.max(0, Math.abs(u) - 0.6) ** 2 / 0.16;

  // ---- the hull: rings of its section along it, outside and (faces turned in) inside ----
  {
    const b = get('dark'), S = 11, N = 44, base = b.count;
    for (let i = 0; i <= N; i++) {
      const u = -1 + (2 * i) / N, w = beam(u), d = deep(u), cy = rise(u) + GUN;
      for (let j = 0; j < S; j++) {
        const a = Math.PI * (j / (S - 1));
        b.vert(-Math.cos(a) * w, cy - Math.sin(a) * d, u * HALF, -Math.cos(a), -Math.sin(a), 0);
      }
    }
    const inner = b.count;
    for (let k = base; k < inner; k++) b.vert(b.p[3 * k], b.p[3 * k + 1], b.p[3 * k + 2], -b.n[3 * k], -b.n[3 * k + 1], -b.n[3 * k + 2]);
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < S - 1; j++) {
        const a = base + i * S + j, c = inner + i * S + j;
        b.tri(a, a + 1, a + S); b.tri(a + 1, a + S + 1, a + S);
        b.tri(c, c + S, c + 1); b.tri(c + 1, c + S, c + S + 1);
      }
    }
    // red bands bound round it towards its ends; a wooden rail along each gunwale
    for (const u of [-0.82, -0.74, -0.66, 0.66, 0.74, 0.82, 0.9]) {
      const w = beam(u) + 0.03, d = deep(u) + 0.03, cy = rise(u) + GUN, pts = [];
      for (let j = 0; j <= 12; j++) { const a = Math.PI * (j / 12); pts.push(V(-Math.cos(a) * w, cy - Math.sin(a) * d + 0.02, u * HALF)); }
      get('madder').tube(pts, pts.map(() => 0.05), 5);
    }
    for (const s of [-1, 1]) {
      const pts = [];
      for (let i = 0; i <= 20; i++) { const u = -0.86 + (1.72 * i) / 20; pts.push(V(s * beam(u), rise(u) + GUN + 0.03, u * HALF)); }
      get('wood').tube(pts, pts.map(() => 0.07), 6);
    }
    // the deck, planks across
    for (let z = -4.6; z < 4.7; z += 0.5) { const w = beam(z / HALF) * 0.94; box('wood', 0, GUN - 0.24, z, 2 * w, 0.06, 0.48); }
  }
  // ---- the prow: the hull's end carried up into a bundle of reeds, bound in red, its head curled back over into a
  // ring; the stern's lower, bent forward ----
  const bundle = (path, girth, n, bindings) => {
    const tan = path.map((_, i) => V().subVectors(path[Math.min(i + 1, path.length - 1)], path[Math.max(i - 1, 0)]).normalize());
    const side = V(1, 0, 0);
    for (let k = 0; k < n; k++) {
      const rr = Math.sqrt((k + 0.5) / n), a = k * 2.39996, pts = [];
      for (let i = 0; i < path.length; i++) {
        const up = V().crossVectors(tan[i], side).normalize(), R = girth[i] * (1 + 0.06 * Math.sin(i * 0.9 + k * 1.7));
        pts.push(path[i].clone().addScaledVector(side, Math.cos(a) * rr * R).addScaledVector(up, Math.sin(a) * rr * R));
      }
      get('straw').tube(pts, pts.map(() => 0.035), 5);
    }
    for (const i of bindings) {
      const up = V().crossVectors(tan[i], side).normalize(), R = girth[i] + 0.025, pts = [];
      for (let j = 0; j <= 30; j++) {
        const g = (j / 10) * Math.PI * 2;
        pts.push(path[i].clone().addScaledVector(side, Math.cos(g) * R).addScaledVector(up, Math.sin(g) * R).addScaledVector(tan[i], (j / 30 - 0.5) * 0.14));
      }
      get('madder').tube(pts, pts.map(() => 0.02), 4);
    }
  };
  {
    const yb = rise(1) + GUN, path = [], girth = [];
    for (let k = 0; k <= 7; k++) { path.push(V(0, yb - 0.6 + k * 0.36, HALF - 0.1 + k * 0.05)); girth.push(0.22 - k * 0.012); }
    const top = path.at(-1), r = 0.68;
    for (let k = 1; k <= 22; k++) {
      const f = (k / 22) * Math.PI * 1.7;
      path.push(V(0, top.y + r * Math.sin(f), top.z - r + r * Math.cos(f)));
      girth.push(0.14 - 0.05 * (k / 22));
    }
    bundle(path, girth, 12, [1, 3, 5, 9, path.length - 1]);
  }
  {
    const yb = rise(-1) + GUN, path = [], girth = [];
    for (let k = 0; k <= 8; k++) { const f = k / 8; path.push(V(0, yb - 0.5 + f * 1.3, -HALF + 0.1 - 0.35 * Math.sin(f * 1.4) + 0.5 * f * f)); girth.push(0.18 - f * 0.08); }
    bundle(path, girth, 10, [1, 4, 7]);
  }

  // ---- the shrine: walls of reed matting, an arched roof of reed, its door to the bow under a woven curtain ----
  const SZ = -1.0, SL = 3.2, SW = 1.9, DY = GUN - 0.21, WH = 1.6;
  {
    // (its walls: reeds standing side by side, bound across in red, on a backing of matting behind them)
    for (const s of [-1, 1]) box('straw', s * (SW / 2 - 0.07), DY + WH / 2, SZ, 0.06, WH, SL);
    box('straw', 0, DY + WH / 2, SZ - SL / 2 + 0.07, SW, WH, 0.06);
    for (const s of [-1, 1]) box('straw', s * (SW / 2 - 0.3), DY + WH / 2, SZ + SL / 2 - 0.07, 0.6, WH, 0.06);
    const reeds = (ax, az, bx, bz) => {
      const len = Math.hypot(bx - ax, bz - az), n = Math.round(len / 0.065);
      for (let k = 0; k <= n; k++) {
        const x = ax + ((bx - ax) * k) / n, z = az + ((bz - az) * k) / n, lean = 0.012 * Math.sin(k * 2.7);
        get('straw').tube([V(x, DY - 0.02, z), V(x + lean, DY + WH + 0.04 * Math.sin(k * 1.3), z)], [0.034, 0.03], 4);
      }
      for (const y of [DY + 0.35, DY + 0.95, DY + WH - 0.12]) get('madder').tube([V(ax, y, az), V(bx, y, bz)], [0.022, 0.022], 4);
    };
    const hx = SW / 2 - 0.02, z0 = SZ - SL / 2 + 0.02, z1 = SZ + SL / 2 - 0.02;
    reeds(-hx, z0, -hx, z1); reeds(hx, z0, hx, z1); reeds(-hx, z0, hx, z0);
    reeds(-hx, z1, -0.38, z1); reeds(0.38, z1, hx, z1);
    box('dark', 0, DY + 0.75, SZ + SL / 2 - 0.1, 0.7, 1.5, 0.04);
    // (the roof: a half barrel, its ribs bundles of reed bound in red)
    const roof = new THREE.CylinderGeometry(SW / 2 + 0.05, SW / 2 + 0.05, SL + 0.2, 18, 1, true, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2).deleteAttribute('uv');
    get('straw').add(roof, new THREE.Matrix4().makeTranslation(0, DY + WH, SZ));
    roof.dispose();
    for (let k = 0; k <= 4; k++) {
      const z = SZ - SL / 2 - 0.05 + ((SL + 0.1) * k) / 4, pts = [];
      for (let j = 0; j <= 12; j++) { const a = Math.PI * (j / 12); pts.push(V(-Math.cos(a) * (SW / 2 + 0.1), DY + WH + Math.sin(a) * (SW / 2 + 0.1), z)); }
      get(k % 2 ? 'straw' : 'madder').tube(pts, pts.map(() => (k % 2 ? 0.06 : 0.045)), 5);
    }
    // the curtain over the door, woven, stirring a little against it
    const wv = weave(rng), cz = SZ + SL / 2 + 0.02;
    cloth((i, j) => V(-0.38 + 0.76 * (j / 3), DY + 1.55 - 1.45 * (i / 4), cz + 0.02 * Math.sin(j * 2.1)), 4, 3, wv, true, V(0, 0, 1), (i) => [0, 0, 0.12 * (i / 4), 0]);
    // two small ring-posts either side of the door
    for (const s of [-1, 1]) {
      const px = s * 0.62, pz = cz + 0.25, yT = DY + 2.1, r = 0.2, path = [], girth = [];
      for (let k = 0; k <= 4; k++) { path.push(V(px, DY + (k / 4) * (yT - DY), pz)); girth.push(0.06); }
      for (let k = 1; k <= 16; k++) { const f = Math.PI - (k / 16) * Math.PI * 1.75; path.push(V(px + s * r * (1 + Math.cos(f)), yT + r * Math.sin(f), pz)); girth.push(0.05); }
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        get('straw').tube(path.map((p, i) => p.clone().add(V(Math.cos(a) * girth[i] * 0.6 * (i > 4 ? 0 : 1), 0, Math.sin(a) * girth[i] * 0.6))), path.map(() => 0.025), 4);
      }
      for (const y of [DY + 0.6, DY + 1.4]) get('madder').add(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 8).deleteAttribute('uv'), new THREE.Matrix4().makeTranslation(px, y, pz));
    }
    // offerings before the door: painted jars, a basket of dates
    paintedJar(-0.55, DY, SZ + SL / 2 + 0.9, 0.55, 0.4, 0);
    paintedJar(0.5, DY, SZ + SL / 2 + 1.0, 0.5, 2.1, 2);
    get('straw').add(new THREE.CylinderGeometry(0.26, 0.2, 0.25, 12).deleteAttribute('uv'), new THREE.Matrix4().makeTranslation(0, DY + 0.13, SZ + SL / 2 + 1.35));
    get('date').add(new THREE.SphereGeometry(0.24, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).deleteAttribute('uv'), new THREE.Matrix4().compose(V(0, DY + 0.24, SZ + SL / 2 + 1.35), new THREE.Quaternion(), V(1, 0.5, 1)));
  }

  // ---- the mast and its square sail, full of the wind, its foot bordered red; the stays ----
  // (the yard braced round, the sail set at a slant across the boat, as with the wind on her quarter: seen from the
  // bank, not edge on)
  const MZ = 2.9, MT = 7.6, YY = 7.2, SAILW = 4.4, SAILB = 2.7, BR = 0.6, cb = Math.cos(BR), sb = Math.sin(BR);
  const brace = (p) => { const dx = p.x, dz = p.z - MZ; return V(dx * cb + dz * sb, p.y, -dx * sb + dz * cb + MZ); };
  const fwd = V(sb, 0, cb), fl = (a, w = 2) => [fwd.x * a, 0, fwd.z * a, w];
  {
    get('wood').tube([V(0, DY, MZ), V(0, MT, MZ)], [0.12, 0.07], 8);
    get('wood').tube([brace(V(-SAILW / 2 - 0.2, YY, MZ + 0.12)), brace(V(SAILW / 2 + 0.2, YY, MZ + 0.12))], [0.06, 0.06], 6);
    const bell = (u, v) => 0.6 * Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(1, v * 1.15));
    const at = (i, j, rows) => { const u = j / 6, v = i / rows; return brace(V(-SAILW / 2 + SAILW * u, YY - 0.05 - (YY - SAILB) * v, MZ + 0.18 + bell(u, v))); };
    cloth((i, j) => at(i, j, 7), 7, 6, ['linen'], true, fwd, (i, j) => fl(0.18 * Math.sin((Math.PI * j) / 6) * (i / 7)));
    // (red bands along its foot and under the yard)
    cloth((i, j) => at(0.5 + i * 0.6, j, 7).addScaledVector(fwd, 0.015), 1, 6, ['madder'], true, fwd, (i, j) => fl(0.18 * Math.sin((Math.PI * j) / 6) * ((0.5 + i * 0.6) / 7)));
    cloth((i, j) => at(7 + i * 0.6, j, 7.6).addScaledVector(fwd, 0.015), 1, 6, ['madder'], true, fwd, (i, j) => fl(0.18 * Math.sin((Math.PI * j) / 6)));
    for (const end of [V(0, GUN + 0.9, HALF - 0.6), V(0, GUN + 0.5, -HALF + 0.9)]) get('straw').tube([V(0, MT - 0.1, MZ), end], [0.014, 0.014], 3);
    for (const s of [-1, 1]) get('straw').tube([brace(V(s * SAILW / 2, SAILB, MZ + 0.2)), V(s * (beam(-0.3) - 0.05), GUN + 0.1, -1.9)], [0.012, 0.012], 3);
  }
  // ---- at the stern: two poles, a long pennant of woven cloth streaming from each; the steering oar ----
  for (const s of [-1, 1]) {
    const pz = -4.4, px = s * 0.75, top = DY + 3.6;
    get('wood').tube([V(px, DY, pz), V(px, top, pz)], [0.05, 0.035], 6);
    const L = 2.0, wv = weave(rng);
    cloth((i, j) => { const v = i / 8, wid = 0.42 * (1 - 0.55 * v); return V(px + s * (0.12 * v + 0.1 * Math.sin(v * 7)), top - 0.05 - wid * j - 1.3 * v * v, pz - L * v * (1 - 0.25 * v)); }, 8, 1, wv, false, V(1, 0, 0), (i) => [0, 0, -0.8 * (i / 8) * L, 1]);
  }
  {
    const a = V(1.05, GUN + 1.9, -4.9), b = V(1.55, -0.5, -7.3);
    get('wood').tube([a, b], [0.07, 0.06], 6);
    const blade = V().subVectors(b, a).normalize();
    get('wood').add(new THREE.BoxGeometry(0.06, 1.3, 0.38).deleteAttribute('uv'), new THREE.Matrix4().compose(b.clone().addScaledVector(blade, -0.5), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), blade), V(1, 1, 1)));
    for (const dy of [0, 0.05, 0.1]) get('straw').add(new THREE.TorusGeometry(0.1, 0.02, 4, 10).rotateX(Math.PI / 2).deleteAttribute('uv'), new THREE.Matrix4().makeTranslation(1.12, GUN + 0.05 + dy, -4.95));
  }

  // ---- into meshes (as houseKit's, but each part moving with the boat: no tiles, no fixed distance to hide at) ----
  const outer = new THREE.Group(), inner = new THREE.Group();
  outer.rotation.order = 'YXZ';
  outer.add(inner);
  for (const [key, b] of Object.entries(kit.B)) {
    if (!b.count) continue;
    const [kind, flap] = key.split('~'), wv = kind.startsWith('weave') ? +kind.slice(5) : null;
    const material = wv !== null ? lightMat({ kind: 'linen', side: THREE.DoubleSide, flap: true, colorMap: weaveTexture(wv) })
      : lightMat({ kind, side: THIN.includes(kind) ? THREE.DoubleSide : THREE.FrontSide, flap: !!flap });
    const m = new THREE.Mesh(b.build(), material);
    if (material.userData.depthMat) m.customDepthMaterial = material.userData.depthMat;
    m.castShadow = m.receiveShadow = true;
    m.frustumCulled = false;
    inner.add(m);
  }
  outer.scale.setScalar(SCALE);
  scene.add(outer);
  // (no water drawn inside its hull)
  const hull = addHull(0, 0, 0, HALF * 0.86 * SCALE, 1.3 * SCALE, { k: 0.7 });

  // where it is along its course at time t (s), and its heading there
  const place = (t) => {
    const s = (((t + (START - FROM) / SPEED) % PERIOD) + PERIOD) % PERIOD;
    const z = FROM + SPEED * s, x = eastEdge(z) - OUT;
    const yaw = Math.atan2(eastEdge(z + 4) - eastEdge(z - 4), 8);
    return { x, z, yaw };
  };
  const tick = (t) => {
    const { x, z, yaw } = place(t);
    outer.position.set(x, 0.02 * Math.sin(1.1 * t) + 0.01 * Math.sin(2.3 * t), z);
    outer.rotation.set(0.012 * Math.sin(0.8 * t + 1), yaw, 0.02 * Math.sin(0.65 * t));
    if (hull >= 0) setHull(hull, x, z, yaw);
  };
  tick(0);
  return {
    group: outer, tick, place,
  };
}
