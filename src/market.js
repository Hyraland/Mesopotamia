// The market on the quay: in the towns of the river the quay, the kar, was where the
// merchants kept their trade, the goods coming in by boat; here, north of where one lands, round the heaps of jars
// and sacks just come ashore. The stalls stand in an L, a long row along the north
// and a short one down the east, by the town's first houses, the square they hold open to the landing, each under
// its own shade (a flat reed mat, a woven cloth, a mat leant steeply back), each with its one colour and its goods at
// three heights (on a mat on the ground, on a bench of brick, hung from the shade's front); in the middle the public
// balance and its weights, for all trade went by weight (of silver, of barley). By the jars, the scribe who writes
// the receipts and the contracts, watching the goods come up from the landing stage. At the row's west end, by the
// water, a pen of sheep. No one is there: the market has just stepped away.
//
// The stalls, from the pen: fish (dried, strung, and fresh on the bench); reed mats and baskets; woven cloth; the
// woodworker's, a lyre on his bench, its inlay of shell beside it; the potter's (the bevelled-rim bowls of Uruk,
// stacked, jugs, jars); dates, onions, oil; small figures for the household's shrine and for the temple (in clay and
// in gypsum, hands clasped), plaques, beads of carnelian and lapis.

import * as THREE from 'three';
import { JAR } from './houseKit.js';
import { clayTablet } from './buildingDetails.js';
import { votive, lyre } from './temple.js';
import { sheep } from './sheep.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Y = V(0, 1, 0);
const at = (x, y, z, yaw = 0, s = 1) => new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromAxisAngle(Y, yaw), typeof s === 'number' ? V(s, s, s) : s);

// the scribe's place (the shade's middle; yaw: its frame's turn, the scribe sitting at +v, east, his table before
// him at -v, looking out over it to the west, to the way up from the landing stage)
export const SCRIBE = { x: -32.3, z: 0.4, yaw: Math.PI / 2 };
// where the market stands (the scene's plants kept off it)
export const MARKET = { x0: -48.2, x1: -28.3, z0: -13, z1: 7.4 };
export const inMarket = (x, z, pad = 0) => x > MARKET.x0 - pad && x < MARKET.x1 + pad && z > MARKET.z0 - pad && z < MARKET.z1 + pad;

// (a bowl, a bevelled-rim bowl of Uruk, its wall a thickness: turned from its profile)
const BOWL = new THREE.LatheGeometry([[0, 0], [0.05, 0], [0.095, 0.075], [0.085, 0.077], [0.045, 0.012], [0, 0.012]].map(([r, h]) => new THREE.Vector2(r, h)), 12).deleteAttribute('uv');
BOWL.computeVertexNormals();
const SPHERE = new THREE.SphereGeometry(1, 8, 6).deleteAttribute('uv');
const TAIL = new THREE.ConeGeometry(1, 1, 4).deleteAttribute('uv');
const CYL = new THREE.CylinderGeometry(1, 1, 1, 12).deleteAttribute('uv');

export function buildMarket(kit, { rng, gy, jar, sack, basket }) {
  const { get, box, cloth, weave, paintedJar } = kit;
  const put = (kind, geo, p, s, yaw = 0, q = null) => get(kind).add(geo, new THREE.Matrix4().compose(p, q ?? new THREE.Quaternion().setFromAxisAngle(Y, yaw), typeof s === 'number' ? V(s, s, s) : s));
  const tube = (kind, pts, r, seg = 6) => get(kind).tube(pts, Array.isArray(r) ? r : pts.map(() => r), seg);

  // ---- a stall: its frame (u across its front, v out to its front), its poles, its shade, its bench ----
  // roof: 'reed' a flat mat falling a little to the front, 'cloth' a woven cloth stretched sagging, 'lean' a mat
  // leant steeply back to a low back edge; bench: a bench of brick along its front
  const stall = ({ x, z, yaw, w = 2.6, d = 2.0, h = 2.15, roof = 'reed', bench = true }) => {
    const loc = (u, v) => V(x + Math.cos(yaw) * u + Math.sin(yaw) * v, 0, z - Math.sin(yaw) * u + Math.cos(yaw) * v);
    const y = gy(x, z);
    const P = (u, v, dy = 0) => loc(u, v).setY(y + dy);
    // (the lean-to's back kept high enough for the mats rolled and stood under it)
    const front = h, back = roof === 'lean' ? h - 0.35 : h + 0.2;
    for (const u of [-w / 2 + 0.1, w / 2 - 0.1]) {
      for (const [v, top] of [[d / 2 - 0.1, front], [-d / 2 + 0.1, back]]) tube('wood', [P(u, v, -0.2), P(u, v, top)], [0.055, 0.045], 6);
      tube('wood', [P(u, d / 2 - 0.1, front - 0.04), P(u, -d / 2 + 0.1, back - 0.04)], 0.045, 5);
    }
    tube('wood', [P(-w / 2 - 0.1, d / 2 - 0.1, front - 0.06), P(w / 2 + 0.1, d / 2 - 0.1, front - 0.06)], 0.05, 6);
    if (roof === 'cloth') {
      const wv = weave(rng);
      cloth((i, j) => {
        const u = -w / 2 + (w * j) / 5, v = d / 2 - (d * i) / 4, k = Math.sin((Math.PI * j) / 5) * Math.sin((Math.PI * i) / 4);
        return P(u, v, front + (back - front) * (i / 4) + 0.02 - 0.16 * k);
      }, 4, 5, wv, true, V(0, 1, 0), (i, j) => [0, 0.08 * Math.sin((Math.PI * j) / 5) * Math.sin((Math.PI * i) / 4), 0, 2]);
      // (its front edge let down a little, a valance)
      cloth((i, j) => P(-w / 2 + (w * j) / 5, d / 2 + 0.02, front + 0.02 - 0.3 * i), 1, 5, wv, true, loc(0, 1).sub(loc(0, 0)), (i) => [0, 0, 0.1 * i, 0]);
    } else {
      const c = P(0, 0, (front + back) / 2 + 0.06);
      // (the mat's slope is its rise towards +v, the front)
      kit.reedMat(c.x, c.y, c.z, w + 0.3, d + 0.3, yaw, 0, (front - back) / (d - 0.2));
    }
    if (bench) {
      const b = P(0, d / 2 - 0.35, 0.25);
      box(roof === 'cloth' ? 'plaster' : 'firedbrick', b.x, b.y, b.z, w - 0.4, 0.5, 0.5, yaw);
    }
    return { loc, P, y, yaw, w, d, front, benchTop: y + 0.5 };
  };

  // ---- the fish, by the water: fresh fish in rows on the bench, dried ones strung from the shade's front, a
  // basket of them, a jar of brine ----
  {
    const S = stall({ x: -43.2, z: -11.0, yaw: 0, roof: 'reed' });
    const fish = (p, len, kind, yaw, pitch = 0) => {
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
      put(kind, SPHERE, p, V(0.055 * len / 0.36, 0.04 * len / 0.36, len / 2), 0, q);
      const t = V(0, 0, -len / 2 - 0.04).applyQuaternion(q).add(p);
      put(kind, TAIL, t, V(0.05, 0.08, 0.025), 0, q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0))));
    };
    for (let k = 0; k < 9; k++) {
      const p = S.P(-0.95 + k * 0.24, S.d / 2 - 0.35 + (k % 2) * 0.08, 0.53);
      fish(p, 0.34 + rng() * 0.12, 'stone', S.yaw + Math.PI / 2 + (rng() - 0.5) * 0.3);
    }
    // (the strings of dried fish, hung from the front beam)
    for (let s = 0; s < 5; s++) {
      const u = -1.0 + s * 0.5, top = S.P(u, S.d / 2 - 0.1, S.front - 0.08);
      tube('straw', [top, top.clone().setY(top.y - 0.95)], 0.008, 3);
      for (let k = 0; k < 4; k++) fish(top.clone().setY(top.y - 0.2 - k * 0.2), 0.22, 'buff', S.yaw + rng() * 0.6, Math.PI / 2);
    }
    const b = S.P(0.9, -0.3);
    basket(b.x, b.z, 0.85);
    for (let k = 0; k < 4; k++) fish(V(b.x + (rng() - 0.5) * 0.3, S.y + 0.48, b.z + (rng() - 0.5) * 0.3), 0.3, 'stone', rng() * 6, 0.2);
    const j = S.P(-0.85, -0.45);
    jar(j.x, j.z, 0.75, 'clay');
  }
  // ---- reed mats and baskets: mats rolled and leant against the back, flat ones in a stack, baskets of every
  // size, bundles of reeds tied ----
  {
    const S = stall({ x: -40.0, z: -11.0, yaw: 0, roof: 'lean', bench: false });
    for (let k = 0; k < 6; k++) {
      const p = S.P(-1.0 + k * 0.38, -0.65, 0), tilt = 0.25 + rng() * 0.12;
      const q = new THREE.Quaternion().setFromAxisAngle(Y, S.yaw).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-tilt, 0, 0)));
      put('straw', CYL, V(0, 0.8, 0).applyQuaternion(q).add(p), V(0.12, 1.6, 0.12), 0, q);
      put('madder', CYL, V(0, 0.4, 0).applyQuaternion(q).add(p), V(0.125, 0.04, 0.125), 0, q);
    }
    for (let k = 0; k < 5; k++) { const p = S.P(0.1, 0.3, 0.025 + k * 0.05); box('straw', p.x, p.y, p.z, 1.5, 0.045, 1.0, S.yaw + (rng() - 0.5) * 0.08); }
    // (baskets for sale, empty, the small ones set in the big: one under the shade, the rest out in front)
    for (const [u, v, s] of [[-0.95, 0.4, 0.6], [0.45, 1.45, 0.8], [1.05, 1.55, 0.55]]) { const p = S.P(u, v); basket(p.x, p.z, s); }
    { const p = S.P(0.45, 1.45); basket(p.x, p.z, 0.5, S.y + 0.3); }
    // (bundles of reeds, tied, lying in front, two on three)
    const q = V(Math.cos(S.yaw), 0, -Math.sin(S.yaw));
    for (let k = 0; k < 5; k++) {
      const top = k > 2, p = S.P(-0.65, 1.3 + (top ? (k - 3) * 0.2 + 0.1 : (k % 3) * 0.2), 0.07 + (top ? 0.12 : 0));
      for (let r = 0; r < 5; r++) {
        const o = V(0, (r % 2) * 0.03, (r - 2) * 0.016);
        tube('straw', [p.clone().add(o).addScaledVector(q, -0.65), p.clone().add(o).addScaledVector(q, 0.65)], 0.022, 4);
      }
      for (const t of [-0.4, 0.4]) put('wood', CYL, p.clone().addScaledVector(q, t), V(0.075, 0.03, 0.075), 0, new THREE.Quaternion().setFromUnitVectors(Y, q));
    }
  }
  // ---- woven cloth: three lengths hung from a rail at the back, folded stacks on the bench, one thrown over it ----
  {
    const S = stall({ x: -36.8, z: -11.0, yaw: 0, roof: 'cloth', w: 2.8 });
    const r0 = S.P(-1.2, -0.55, 1.9), r1 = S.P(1.2, -0.55, 1.9);
    tube('wood', [r0, r1], 0.03, 5);
    for (let k = 0; k < 3; k++) {
      const u0 = -1.1 + k * 0.78, wv = weave(rng), L = 1.5 + rng() * 0.2;
      cloth((i, j) => S.P(u0 + 0.7 * (j / 3), -0.55 + 0.02 * Math.sin(j + k), 1.88 - L * (i / 4)), 4, 3, wv, true, V(0, 0, 1), (i) => [0, 0, 0.12 * (i / 4), 1]);
    }
    const kinds = ['linen', 'madder', 'saffron', 'linen', 'buff', 'madder'];
    for (let k = 0; k < 4; k++) {
      let y2 = S.benchTop;
      for (let n = 0; n < 2 + Math.floor(rng() * 3); n++) { const p = S.P(-0.9 + k * 0.5, S.d / 2 - 0.35, 0); const h = 0.07 + rng() * 0.03; box(kinds[(k + n) % kinds.length], p.x, y2 + h / 2, p.z, 0.4, h, 0.34, (rng() - 0.5) * 0.1); y2 += h; }
    }
    const wv = weave(rng);
    cloth((i, j) => { const v = S.d / 2 - 0.62 + Math.min(i, 2) * 0.27, dy = i < 3 ? 0.505 : 0.505 - (i - 2) * 0.22; return S.P(0.55 + 0.6 * (j / 2), i < 3 ? v : S.d / 2 - 0.08, dy); }, 5, 2, wv, false, V(0, 1, 0));
  }
  // ---- the woodworker's: his bench, a lyre on it in the making (its inlay of shell and red stone laid out by
  // it), planks leant against the back, a pot of bitumen ----
  {
    const S = stall({ x: -33.5, z: -11.3, yaw: 0, roof: 'reed', bench: false });
    const b = S.P(0, 0.1, 0.38);
    box('wood', b.x, b.y, b.z, 1.9, 0.08, 0.7, S.yaw);
    for (const [u, v] of [[-0.85, -0.2], [0.85, -0.2], [-0.85, 0.4], [0.85, 0.4]]) { const p = S.P(u, v, 0.17); box('wood', p.x, p.y, p.z, 0.08, 0.34, 0.08, S.yaw); }
    lyre(put, tube, null, S.P(-0.3, 0.1, 0.42), S.yaw);
    for (let k = 0; k < 14; k++) { const p = S.P(0.45 + (k % 5) * 0.08, -0.05 + Math.floor(k / 5) * 0.09, 0.43); box(k % 4 === 0 ? 'madder' : 'lime', p.x, p.y, p.z, 0.05, 0.012, 0.05, rng() * 0.3); }
    for (let k = 0; k < 5; k++) {
      const p = S.P(-1.0 + k * 0.45, -0.75, 0.75), q = new THREE.Quaternion().setFromAxisAngle(Y, S.yaw).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.18, 0, 0)));
      put('wood', new THREE.BoxGeometry(0.3, 1.5, 0.04).deleteAttribute('uv'), p, 1, 0, q);
    }
    const t = S.P(0.95, 0.75);
    put('dark', CYL, V(t.x, S.y + 0.12, t.z), V(0.16, 0.24, 0.16));
    tube('wood', [V(t.x, S.y + 0.2, t.z), V(t.x + 0.15, S.y + 0.6, t.z + 0.1)], 0.015, 4);
  }
  // ---- the potter's: towers of bevelled-rim bowls, jugs and jars on a mat, a painted jar or two ----
  {
    const S = stall({ x: -30.3, z: -11.0, yaw: 0, roof: 'reed', h: 2.3 });
    for (let t = 0; t < 7; t++) {
      const p = t < 4 ? S.P(-0.95 + t * 0.32, S.d / 2 - 0.35, 0) : S.P(-0.8 + (t - 4) * 0.45, 0.1, 0);
      const n = 5 + Math.floor(rng() * 6), base = t < 4 ? S.benchTop : S.y;
      for (let k = 0; k < n; k++) put('clay', BOWL, V(p.x, base + k * 0.033, p.z), 1, rng() * 6);
    }
    for (const [u, v, s, k] of [[0.75, 0.2, 0.55, 'buff'], [1.05, -0.2, 0.7, 'clay'], [0.55, -0.45, 0.45, 'buff'], [-0.2, -0.55, 0.8, 'clay']]) { const p = S.P(u, v); get(k).add(JAR, at(p.x, S.y - 0.02, p.z, rng() * 6, s)); }
    const pj = S.P(0.9, S.d / 2 - 0.35);
    paintedJar(pj.x, S.benchTop - 0.01, pj.z, 0.42, rng() * 6, 1);
    const m = S.P(0, -0.15);
    box('straw', m.x, S.y + 0.01, m.z, 2.2, 0.02, 1.3, S.yaw);
  }
  // ---- dates, onions, oil: baskets of dates, strings of onions from the front beam, oil in sealed jars, a sack of
  // lentils ----
  {
    const S = stall({ x: -30.1, z: -6.5, yaw: -Math.PI / 2, roof: 'cloth' });
    for (let k = 0; k < 3; k++) {
      const p = S.P(-0.8 + k * 0.75, S.d / 2 - 0.35);
      get('straw').add(new THREE.CylinderGeometry(0.22, 0.18, 0.2, 12).deleteAttribute('uv'), at(p.x, S.benchTop + 0.1, p.z));
      // (a heap of dates: a mound of them, single dates over it)
      put('date', SPHERE, V(p.x, S.benchTop + 0.17, p.z), V(0.19, 0.07, 0.19));
      for (let n = 0; n < 16; n++) {
        const a = n * 2.4, r = 0.03 + 0.15 * Math.sqrt((n + 0.5) / 16), h = 0.07 * (1 - (r / 0.19) ** 2);
        put('date', SPHERE, V(p.x + Math.cos(a) * r, S.benchTop + 0.18 + h, p.z + Math.sin(a) * r), V(0.022, 0.02, 0.034), a);
      }
    }
    for (let s = 0; s < 6; s++) {
      const top = S.P(-1.05 + s * 0.42, S.d / 2 - 0.1, S.front - 0.08);
      tube('straw', [top, top.clone().setY(top.y - 0.75)], 0.008, 3);
      for (let k = 0; k < 7; k++) put(s % 3 === 1 ? 'linen' : 'buff', SPHERE, V(top.x + (k % 2 - 0.5) * 0.05, top.y - 0.12 - k * 0.09, top.z), V(0.05, 0.045, 0.05));
    }
    for (const [u, v] of [[-0.9, -0.5], [-0.4, -0.6], [0.1, -0.5]]) { const p = S.P(u, v), top = jar(p.x, p.z, 0.7, 'buff'); box('mud', p.x, top + 0.01, p.z, 0.24, 0.07, 0.24); }
    const sk = S.P(0.8, -0.3);
    sack(sk.x, sk.z, 0.85);
  }
  // ---- figures for the household's shrine and for the temple: small figures of clay and of gypsum, hands clasped,
  // on a bench under a red cloth, clay plaques propped behind, strings of beads of carnelian and lapis hung from a
  // rod ----
  {
    const S = stall({ x: -30.1, z: -3.0, yaw: -Math.PI / 2, roof: 'reed', w: 2.4 });
    const c = S.P(0, S.d / 2 - 0.35, 0.505);
    box('madder', c.x, c.y, c.z, 2.0, 0.012, 0.54, S.yaw);
    // (each figure faces out, to the one at the stall: votive's own way, +x, turned to the stall's +v)
    const face = S.yaw - Math.PI / 2;
    const turned = (cx, cz) => (kind, geo, p, s) => {
      const d = V(p.x - cx, 0, p.z - cz).applyAxisAngle(Y, face);
      put(kind, geo, V(cx + d.x, p.y, cz + d.z), s, face);
    };
    for (let k = 0; k < 7; k++) {
      const p = S.P(-0.85 + k * 0.28, S.d / 2 - 0.3 + (k % 2) * 0.12);
      votive(turned(p.x, p.z), p.x, S.benchTop + 0.012, p.z, 0.16 + rng() * 0.1, rng, k % 3 === 0 ? 'lime' : 'buff');
    }
    for (let k = 0; k < 4; k++) { const p = S.P(-0.75 + k * 0.5, S.d / 2 - 0.52); clayTablet(get, p.x, S.benchTop + 0.14, p.z, 0.16, 0.24, Math.PI / 2, { kind: 'clay', lines: false, face: V(Math.sin(S.yaw), 0.35, Math.cos(S.yaw)).normalize() }); }
    const r0 = S.P(-1.0, S.d / 2 - 0.1, 1.75), r1 = S.P(1.0, S.d / 2 - 0.1, 1.75);
    tube('wood', [r0, r1], 0.02, 4);
    for (let s = 0; s < 9; s++) {
      const top = r0.clone().lerp(r1, (s + 0.5) / 9), n = 9 + Math.floor(rng() * 5), kind = s % 3 === 2 ? 'indigo' : 'madder';
      for (let k = 0; k < n; k++) {
        const a = (k / (n - 1)) * Math.PI, dx = Math.cos(S.yaw) * 0.06 * Math.cos(a), dz = -Math.sin(S.yaw) * 0.06 * Math.cos(a);
        put(kind, SPHERE, V(top.x + dx, top.y - 0.04 - 0.35 * Math.sin(a), top.z + dz), 0.017);
      }
    }
  }

  // ---- in the middle, the public balance: a beam on a post, two pans on cords; its weights (of stone, the
  // olive shape of the early ones, before the duck-shaped weights of later times) in a row on a mat; a basket ----
  {
    const x = -35.4, z = -5.6, y = gy(x, z), by = y + 1.5;
    tube('wood', [V(x, y - 0.2, z), V(x, by + 0.08, z)], [0.07, 0.055], 7);
    for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; tube('wood', [V(x, y + 0.5, z), V(x + Math.cos(a) * 0.5, y - 0.05, z + Math.sin(a) * 0.5)], 0.04, 5); }
    tube('wood', [V(x - 0.7, by, z), V(x + 0.7, by, z)], 0.035, 6);
    for (const s of [-1, 1]) {
      const px = x + s * 0.66;
      put('bronze', new THREE.CylinderGeometry(0.2, 0.14, 0.05, 14).deleteAttribute('uv'), V(px, y + 0.75, z), 1);
      for (const d of [[-0.12, 0], [0.12, 0], [0, 0.12]]) tube('straw', [V(px, by, z), V(px + d[0], y + 0.77, z + d[1])], 0.004, 3);
    }
    box('straw', x + 0.2, y + 0.012, z + 1.0, 1.2, 0.02, 0.6);
    for (let k = 0; k < 6; k++) put('stone', SPHERE, V(x - 0.25 + k * 0.16, y + 0.03 + 0.012 * (6 - k), z + 1.0), V(0.075 - k * 0.008, 0.045 - k * 0.004, 0.05 - k * 0.005));
    basket(x + 1.0, z + 0.9, 0.7);
  }

  // ---- the pen of sheep, at the row's west end by the water: a fence of reed bundles on posts, open to the
  // square at its gate; a trough, hay; sheep, a ram among them ----
  {
    const x0 = -47.8, x1 = -44.8, z0 = -12.6, z1 = -9.9, y = gy((x0 + x1) / 2, (z0 + z1) / 2), gx = (x0 + x1) / 2 + 0.4;
    const edge = [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, gx + 0.6, z1], [gx - 0.6, z1, x0, z1], [x0, z1, x0, z0]];
    for (const [ax, az, bx, bz] of edge) {
      const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 0.7));
      for (let k = 0; k <= n; k++) { const px = ax + ((bx - ax) * k) / n, pz = az + ((bz - az) * k) / n; tube('wood', [V(px, gy(px, pz) - 0.2, pz), V(px, gy(px, pz) + 0.95, pz)], 0.04, 5); }
      for (const h of [0.3, 0.6, 0.88]) tube('straw', [V(ax, gy(ax, az) + h, az), V(bx, gy(bx, bz) + h, bz)], 0.05, 6);
    }
    box('wood', x0 + 0.5, y + 0.15, (z0 + z1) / 2, 0.4, 0.3, 1.3);
    put('straw', SPHERE, V(x0 + 0.6, y, z0 + 0.5), V(0.5, 0.3, 0.45));
    // (where they stand, from the pen's north-west corner)
    const flock = [
      { x: 1.1, z: 0.8, yaw: 0.6, coat: 'linen', face: 'hair', ram: true, h: 1.0 },
      { x: 2.3, z: 0.6, yaw: -1.9, coat: 'buff', face: 'buff' },
      { x: 1.9, z: 1.8, yaw: 2.6, coat: 'hair', face: 'dark' },
      { x: 0.8, z: 2.1, yaw: 1.4, coat: 'linen', face: 'buff' },
      { x: 2.5, z: 1.4, yaw: -0.4, coat: 'linen', face: 'hair', h: 0.85 },
    ];
    for (const f of flock) sheep(get, x0 + f.x, gy(x0 + f.x, z0 + f.z), z0 + f.z, f.yaw, f);
  }

  // ---- the scribe's corner (it was on the quay's south side), just north of the
  // jars come ashore, facing the way up from the landing stage: a reed shade on four poles; a low table, a tablet on it being written, its stylus, a cylinder seal, a
  // balance; a reed mat in the sun with fresh tablets drying in rows; a jar of old tablets ----
  {
    const { x: sx, z: sz, yaw } = SCRIBE, y = gy(sx, sz);
    const loc = (u, v) => V(sx + Math.cos(yaw) * u + Math.sin(yaw) * v, 0, sz - Math.sin(yaw) * u + Math.cos(yaw) * v);
    for (const [u, v] of [[-1.5, -1.4], [1.5, -1.4], [-1.5, 1.4], [1.5, 1.4]]) { const p = loc(u, v); box('wood', p.x, y + 1.15 + (v > 0 ? 0.15 : 0), p.z, 0.11, 2.3 + (v > 0 ? 0.3 : 0), 0.11); }
    { const p = loc(0, 0); kit.reedMat(p.x, y + 2.42, p.z, 3.4, 3.2, yaw, 0, 0.09); }
    // the table (low: the scribe sits on the ground), its legs; the cushion he sits on
    const t = loc(0, -0.35), ty = y + 0.5;
    box('wood', t.x, ty, t.z, 1.5, 0.07, 0.7, yaw);
    for (const [u, v] of [[-0.65, -0.28], [0.65, -0.28], [-0.65, 0.28], [0.65, 0.28]]) { const p = loc(u, v - 0.35); box('wood', p.x, ty / 2 + y / 2, p.z, 0.06, ty - y, 0.06); }
    box('madder', loc(0, 0.55).x, y + 0.03, loc(0, 0.55).z, 1.2, 0.04, 0.8, yaw);
    const tablet = (p, y0, w, d, rot, kind = 'buff', lines = true) => clayTablet(get, p.x, y0, p.z, w, d, rot, { kind, lines });
    // (the ground's height as drawn: its mesh, a metre grid, between its points; or the ground's own, if higher)
    const groundY = (x, z) => {
      const x0 = Math.floor(x), z0 = Math.floor(z), fx = x - x0, fz = z - z0;
      const mesh = (gy(x0, z0) * (1 - fx) + gy(x0 + 1, z0) * fx) * (1 - fz) + (gy(x0, z0 + 1) * (1 - fx) + gy(x0 + 1, z0 + 1) * fx) * fz;
      return Math.max(mesh, gy(x, z));
    };
    tablet(loc(-0.15, -0.35), ty + 0.035, 0.11, 0.16, yaw + 0.15);
    tablet(loc(0.35, -0.42), ty + 0.035, 0.08, 0.11, yaw - 0.3, 'clay');
    get('wood').tube([loc(0.05, -0.2).setY(ty + 0.05), loc(0.25, -0.12).setY(ty + 0.055)], [0.008, 0.006], 4);   // (the stylus)
    { const p = loc(-0.5, -0.45); get('stone').add(new THREE.CylinderGeometry(0.025, 0.025, 0.06, 10).rotateZ(Math.PI / 2).deleteAttribute('uv'), at(p.x, ty + 0.06, p.z, yaw)); }
    // the balance: an upright, a beam, two pans on cords
    {
      const p = loc(0.6, -0.5), by = ty + 0.42;
      box('bronze', p.x, (ty + by) / 2, p.z, 0.025, by - ty, 0.025);
      const q0 = loc(0.32, -0.5), q1 = loc(0.88, -0.5);
      get('bronze').tube([q0.clone().setY(by), q1.clone().setY(by)], [0.012, 0.012], 5);
      for (const q of [q0, q1]) {
        get('bronze').add(new THREE.CylinderGeometry(0.075, 0.05, 0.025, 12).deleteAttribute('uv'), at(q.x, ty + 0.12, q.z));
        get('straw').tube([q.clone().setY(ty + 0.13), q.clone().setY(by)], [0.004, 0.004], 3);
      }
    }
    // the mat of drying tablets, beside the shade in the sun (to its north, the jars to its south), laid over the
    // ground as it lies
    const MU = 2.9;
    const matY = (u, v) => { const p = loc(u, v); return groundY(p.x, p.z) + 0.02; };
    cloth((i, j) => { const u = MU - 0.95 + (1.9 * j) / 8, v = 0.3 - 0.7 + (1.4 * i) / 6; return loc(u, v).setY(matY(u, v)); }, 6, 8, ['straw'], true, V(0, 1, 0));
    for (let r = 0; r < 5; r++) {
      for (let k = 0; k < 7; k++) {
        const u = MU - 0.75 + k * 0.25, v = 0.3 - 0.52 + r * 0.26, p = loc(u, v);
        const w = 0.09 + rng() * 0.03, d = 0.12 + rng() * 0.04;
        let ty2 = -Infinity;
        for (const [du, dv] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2], [0, 0]]) ty2 = Math.max(ty2, matY(u + du, v + dv));
        tablet(p, ty2 + 0.004, w, d, yaw + (rng() - 0.5) * 0.12, 'buff', rng() < 0.7);
      }
    }
    // the archive: an old jar, tablets stacked by it; a basket of tablets
    // (clear of the shade's posts and of each other)
    { const p = loc(-0.95, 0.85); jar(p.x, p.z, 0.85, 'clay'); const q = loc(0.05, 1.3); basket(q.x, q.z, 0.6); for (let k = 0; k < 4; k++) tablet(q, y + 0.27 + k * 0.035, 0.1, 0.14, rng() * 6, 'clay', false); }
    for (let k = 0; k < 6; k++) { const p = loc(-1.2 + (k % 3) * 0.14, 0.2); tablet(p, y + Math.floor(k / 3) * 0.035, 0.1, 0.15, yaw + 0.1 * k, 'clay', false); }
  }
  // the goods that were on the quay's south side, by the stalls they belong to: bales of reed mats and cloth, tied;
  // baskets; two great jars
  // (the bales across the way from the scribe's shade, at the quay's edge, waiting to be counted)
  for (let k = 0; k < 3; k++) {
    const x = -37.9 + (k % 2) * 0.12, z = -2.9 + k * 1.1, y = gy(x, z), r = Math.PI / 2 + 0.1 * k - 0.1;
    box(k === 1 ? 'linen' : 'straw', x, y + 0.35, z, 1.0, 0.7, 0.75, r);
    for (const o of [-0.3, 0.3]) box('dark', x + Math.cos(r) * o, y + 0.35, z - Math.sin(r) * o, 0.05, 0.72, 0.77, r);
  }
  // baskets set down full: one of onions by their stall, one of barley
  for (const [x, z, kind] of [[-32.0, -4.9, 'buff'], [-32.6, -8.7, 'straw']]) {
    const s = 0.8 + rng() * 0.1, y = gy(x, z);
    basket(x, z, s);
    put(kind, SPHERE, V(x, y + 0.42 * s, z), V(0.34 * s, 0.1 * s, 0.34 * s));
    if (kind === 'buff') for (let n = 0; n < 9; n++) { const a = n * 2.4, r = 0.25 * s * Math.sqrt((n + 0.5) / 9); put(n % 3 ? 'buff' : 'linen', SPHERE, V(x + Math.cos(a) * r, y + 0.5 * s, z + Math.sin(a) * r), V(0.055, 0.05, 0.055)); }
  }
  for (const [x, z, s] of [[-29.5, -8.6], [-38.0, -4.2]].map(([x, z], k) => [x, z, 1.25 - k * 0.15])) jar(x, z, s, 'buff');
}
