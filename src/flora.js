// The plants of the southern river country, early in the autumn (the date harvest; the barley cut in the spring,
// its stubble standing; sesame being cut; the reeds in tassel), as the land was planted in the Old Babylonian
// period:
//   date palms (Phoenix dactylifera) — in the town, and in groves along the river's levees and the canals: their
//     trunks clad in the cut bases of old fronds, their crowns of stiff, grey-green, V-set fronds from the
//     upright spear to the drooping oldest, a few dead ones hanging, ripe bunches of dates on orange stalks
//     among the lowest fronds, offshoots at the foot of some;
//   under and among them, as in the gardens the texts describe: pomegranates and figs, and beds of onions, leeks
//     and lettuce in the irrigated garden;
//   on the river: belts of tall reed (Phragmites) in tassel and cattails in the shallows; Euphrates poplars and
//     tamarisks (feathery, in pink flower) on the banks and along the canals;
//   on the dry ground: tufts of grass, camelthorn; in the fields, barley stubble, sesame and stacks of straw.
//
// The foliage is cards with cut-outs (plantTextures.js), their normals bent round each frond's or clump's own
// middle so a mass of leaves takes the light as one form (as in 环形废墟). Each kind of plant is instanced, in
// tiles, so the camera and the two shadow maps draw only what they see.

import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { Builder, mat, splitTiles } from './geo.js';
import { lodAdd } from './lod.js';
import { makeRng, fbm } from './rand.js';
import { heightAt, riverX, RIVER_HALF, CANALS, MODEL, WORLD, WATER_Y, LAGOON, LAGOON_Y, ISLANDS, polySigned, VIEWS } from './land.js';
import { lightMat } from './shade.js';
import { makePlantTextures, bootsBump } from './plantTextures.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const UP = V(0, 1, 0);
const smooth = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

// the ground the plants are stood on: land.js's (the wide scene) unless a scene gives its own (useGround)
let ground = heightAt;
export function useGround(fn) { ground = fn; }

// keeps trunks apart
export class Spacing {
  constructor(cell = 8) { this.cell = cell; this.map = new Map(); }
  key(i, j) { return i * 100003 + j; }
  ok(x, z, r) {
    const c = this.cell, i0 = Math.floor(x / c), j0 = Math.floor(z / c), n = Math.ceil((r + 12) / c);
    for (let i = i0 - n; i <= i0 + n; i++) for (let j = j0 - n; j <= j0 + n; j++) {
      for (const o of this.map.get(this.key(i, j)) || []) if (Math.hypot(o.x - x, o.z - z) < o.r + r) return false;
    }
    return true;
  }
  add(x, z, r) {
    const k = this.key(Math.floor(x / this.cell), Math.floor(z / this.cell));
    if (!this.map.has(k)) this.map.set(k, []);
    this.map.get(k).push({ x, z, r });
  }
}

// ---- shapes made once, used many times ----

// A date palm frond, 1 long along +x from its base. The rachis rises a little and droops towards the tip; the
// leaflets stand up from it either side in a V (the frond's own up is +y), reaching out as far as `reach` gives
// along its length (short stiff spines on the petiole, longest a third of the way out, short again at the tip);
// the outer part twists over, as old fronds do. Normals bent round a point under the base, so the crown's
// fronds together take the light like one rounded mass.
function frondGeometry({ rise = 0.12, droop = 0.32, twist = 0.5, segs = 10, wide = 1 } = {}) {
  const b = new Builder(true), C0 = V(-0.15, -0.45, 0);
  const reach = (u) => wide * (u < 0.14 ? 0.012 + 0.32 * u : 0.057 + 0.11 * smooth(0.14, 0.4, u)) * (1 - 0.72 * smooth(0.62, 1, u));
  const put = (x, y, z, u, v) => {
    const n = V(x, y, z).sub(C0).normalize();
    b.vert(x, y, z, n.x, n.y, n.z, u, v);
  };
  for (let i = 0; i <= segs; i++) {
    const u = i / segs, y = rise * u - droop * u * u, w = reach(u), fold = w * 0.6;
    const tw = twist * u * u, c = Math.cos(tw), s = Math.sin(tw);
    // the leaflets' tips, either side, turned about the rachis by the twist
    for (const [side, v] of [[-1, 0], [0, 0.5], [1, 1]]) {
      const oz = side * w, oy = side === 0 ? 0 : fold;
      put(u, y + oy * c - oz * s, oz * c + oy * s, u, v);
    }
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 3, d = a + 3;
    b.tri(a, a + 1, d + 1); b.tri(a, d + 1, d);
    b.tri(a + 1, a + 2, d + 2); b.tri(a + 1, d + 2, d + 1);
  }
  return b.build();
}

// A bunch of dates, hanging from where it rises among the lowest fronds: its stalk (the spadix) arching out
// along +x and down, then a fall of strands, each set with dates. Two geometries for the two kinds: the
// stalk and strands (spadix), the fruit (date).
function bunchGeometry(rng) {
  const stalk = new Builder(), fruit = new Builder();
  // (a date: six vertices, smooth-shaded, some two hundred to a bunch: a date is a few pixels across from the
  // lane, and the bunches, some eight hundred, were costing 5 million triangles a frame, three times over with
  // the sun's two shadow maps)
  const date = mergeVertices(new THREE.OctahedronGeometry(1, 0).deleteAttribute('uv').deleteAttribute('normal'));
  date.computeVertexNormals();
  const reachOut = 0.55 + rng() * 0.3, fall = 0.8 + rng() * 0.5;
  const sp = [V(0, 0, 0), V(reachOut * 0.45, 0.12, 0), V(reachOut * 0.85, -0.15, 0), V(reachOut, -fall * 0.6, 0), V(reachOut * 1.02, -fall, 0)];
  stalk.tube(sp, [0.045, 0.04, 0.035, 0.03, 0.025], 6);
  const along = (t) => {
    const f = t * (sp.length - 1), i = Math.min(Math.floor(f), sp.length - 2);
    return sp[i].clone().lerp(sp[i + 1], f - i);
  };
  const strands = 24 + Math.floor(rng() * 10), m = new THREE.Matrix4();
  for (let k = 0; k < strands; k++) {
    const t = 0.55 + 0.45 * (k / strands), s = along(t), a = rng() * TAU;
    const out = V(Math.cos(a), 0, Math.sin(a)).multiplyScalar(0.08 + rng() * 0.1);
    const len = 0.32 + rng() * 0.3;
    const pts = [s, s.clone().add(out).add(V(0.03, -len * 0.4, 0)), s.clone().addScaledVector(out, 1.6).add(V(0.02, -len, 0))];
    stalk.tube(pts, [0.008, 0.006, 0.005], 3);
    const nd = 6 + Math.floor(rng() * 4);
    for (let d = 0; d < nd; d++) {
      const f = 0.3 + 0.7 * (d / nd), i = f < 0.5 ? 0 : 1, g = f < 0.5 ? f * 2 : (f - 0.5) * 2;
      const p = pts[i].clone().lerp(pts[i + 1], g);
      const ang = rng() * TAU, off = V(Math.cos(ang) * 0.022, -0.02, Math.sin(ang) * 0.022);
      // a date: about 4 cm long, 2.4 across, hanging from its strand
      const q = new THREE.Quaternion().setFromUnitVectors(UP, V(off.x * 3, -1, off.z * 3).normalize());
      m.compose(p.add(off), q, V(0.012 + rng() * 0.003, 0.02 + rng() * 0.004, 0.012 + rng() * 0.003));
      fruit.add(date, m);
    }
  }
  return { stalk: stalk.build(), fruit: fruit.build() };
}

// A clump of leaf cards round a middle, normals bent outward from a point below it (the clump takes the light as
// a rounded mass, its edge stays leafy). droop: the cards hang (tamarisk sprays); flat: squashed
function clumpGeometry(rng, cards = 22, { droop = 0, flat = 1 } = {}) {
  const b = new Builder(true);
  const X = V(1, 0, 0), C0 = V(0, -0.4, 0);
  const rand3 = () => {
    for (;;) {
      const v = V(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1), l = v.lengthSq();
      if (l > 0.01 && l <= 1) return v.normalize();
    }
  };
  for (let k = 0; k < cards; k++) {
    const d = rand3();
    d.y = (d.y * 0.75 + 0.2) * flat;
    d.normalize();
    const c = d.clone().multiplyScalar(0.4 + 0.5 * rng());
    const n = d.clone().addScaledVector(rand3(), 0.7);
    n.y -= droop * 0.8;
    n.normalize();
    const ax0 = V().crossVectors(n, Math.abs(n.y) < 0.95 ? UP : X).normalize(), ay0 = V().crossVectors(n, ax0);
    const psi = rng() * TAU, cs = Math.cos(psi), sn = Math.sin(psi);
    const ax = ax0.clone().multiplyScalar(cs).addScaledVector(ay0, sn), ay = ay0.clone().multiplyScalar(cs).addScaledVector(ax0, -sn);
    const h = 0.48 + 0.2 * rng(), i0 = b.count;
    [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]].forEach(([sx, sy, u, v]) => {
      const p = c.clone().addScaledVector(ax, sx * h).addScaledVector(ay, sy * h);
      if (droop) p.y -= droop * 0.25 * (sy + 1) * Math.max(0, d.y + 0.3);
      const nn = p.clone().sub(C0).normalize();
      b.vert(p.x, p.y, p.z, nn.x, nn.y, nn.z, u, v);
    });
    b.tri(i0, i0 + 1, i0 + 2);
    b.tri(i0, i0 + 2, i0 + 3);
  }
  return b.build();
}

// Cards standing crossed round the upright, their bottom edge on the ground: a tuft (grass, camelthorn, onions),
// 1 high and 1 across; normals bent out and up from below
function tuftGeometry(cards = 3, lean = 0) {
  const b = new Builder(true), C0 = V(0, -0.6, 0);
  for (let k = 0; k < cards; k++) {
    const a = (k / cards) * Math.PI, cx = Math.cos(a) * 0.5, cz = Math.sin(a) * 0.5;
    const i0 = b.count;
    for (const [sx, y, u, v] of [[-1, 0, 0, 0], [1, 0, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]]) {
      const p = V(cx * sx + lean * y * Math.cos(a + 1), y, cz * sx + lean * y * Math.sin(a + 1));
      const n = p.clone().sub(C0).normalize();
      b.vert(p.x, p.y, p.z, n.x, n.y, n.z, u, v);
    }
    b.tri(i0, i0 + 1, i0 + 2);
    b.tri(i0, i0 + 2, i0 + 3);
  }
  return b.build();
}

// A stand of reeds (Phragmites), about a metre across: tall stems, each with narrow leaves held out along it,
// arching over; the top of most a tassel (a card, its own geometry: plume). stems: how many; h: their height
// (m). cattail: the shorter cattail instead: sword leaves from the base and brown spikes on stalks
function reedGeometry(rng, { stems = 16, h = 3.2, cattail = false } = {}) {
  const leaves = new Builder(true), tops = new Builder(true);
  const card = (b, p, dir, side, len, wid, droopK, v0 = 0, v1 = 1, segs = 4) => {
    // a strap leaf from p along dir, bending down with droopK, `side` its width direction
    const i0 = b.count, C0 = p.clone().add(V(0, -0.6, 0));
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const q = p.clone().addScaledVector(dir, len * t).add(V(0, -droopK * len * t * t, 0));
      for (const s of [-1, 1]) {
        const r = q.clone().addScaledVector(side, (s * wid) / 2);
        const n = r.clone().sub(C0).normalize();
        b.vert(r.x, r.y, r.z, n.x, n.y, n.z, s < 0 ? 0 : 1, v0 + (v1 - v0) * t);
      }
    }
    for (let i = 0; i < segs; i++) {
      const a = i0 + i * 2;
      b.tri(a, a + 1, a + 3);
      b.tri(a, a + 3, a + 2);
    }
  };
  for (let k = 0; k < stems; k++) {
    const r = Math.sqrt(rng()) * 0.5, a = rng() * TAU;
    const base = V(Math.cos(a) * r, -0.05, Math.sin(a) * r);
    const lean = V((rng() - 0.5) * 0.25, 1, (rng() - 0.5) * 0.25).normalize();
    const H = h * (0.7 + rng() * 0.35);
    const side = V().crossVectors(lean, V(Math.cos(a + 1.3), 0, Math.sin(a + 1.3))).normalize();
    if (cattail) {
      // sword leaves from the base, standing up and arching over at the top
      for (let j = 0; j < 3; j++) {
        const d = V((rng() - 0.5) * 0.5, 1, (rng() - 0.5) * 0.5).normalize(), sd = V(Math.cos(a + j), 0, Math.sin(a + j));
        card(leaves, base, d, sd, H * (0.7 + rng() * 0.4), 0.05, 0.12 + rng() * 0.25);
      }
      if (rng() < 0.45) {
        // the spike: a brown sausage on its stalk (in the tops geometry, kind wood)
        const top = base.clone().addScaledVector(lean, H * 0.95);
        const stalkTop = base.clone().addScaledVector(lean, H * 0.78);
        card(tops, stalkTop, lean, side, H * 0.17, 0.07, 0, 0.45, 0.55, 2);
        card(tops, stalkTop, lean, V().crossVectors(lean, side), H * 0.17, 0.07, 0, 0.45, 0.55, 2);
        card(tops, base.clone().addScaledVector(lean, H * 0.4), lean, side, H * 0.38, 0.012, 0, 0.45, 0.55, 2);
        top.y += 0;
      }
      continue;
    }
    // the stem, a thin strap seen from two sides
    const sideB = V().crossVectors(lean, side).normalize();
    card(leaves, base, lean, side, H, 0.025, 0.02, 0.45, 0.55, 5);
    card(leaves, base, lean, sideB, H, 0.025, 0.02, 0.45, 0.55, 5);
    // leaves up the stem, alternate, held out and arching over
    const nl = 7 + Math.floor(rng() * 4);
    for (let j = 0; j < nl; j++) {
      const t = 0.18 + 0.72 * (j / nl), p = base.clone().addScaledVector(lean, H * t);
      const ang = a + j * Math.PI + (rng() - 0.5) * 0.8;
      const out = V(Math.cos(ang), 0.55 + rng() * 0.5, Math.sin(ang)).normalize();
      const sd = V().crossVectors(out, UP).normalize();
      card(leaves, p, out, sd, 0.35 + rng() * 0.25, 0.035, 0.6 + rng() * 0.5);
    }
    // the tassel (most stems in flower, late in the summer)
    if (rng() < 0.8) {
      const top = base.clone().addScaledVector(lean, H);
      const fa = a + (rng() - 0.5);
      const fd = V(Math.cos(fa), 0, Math.sin(fa));
      const i0 = tops.count, wv = 0.3 + rng() * 0.12, hv = 0.45 + rng() * 0.15;
      for (const [sx, sy, u, v] of [[-0.42, 0, 0, 0], [0.58, 0, 1, 0], [0.58, 1, 1, 1], [-0.42, 1, 0, 1]]) {
        const p = top.clone().addScaledVector(fd, sx * wv).add(V(0, (sy - 0.05) * hv, 0));
        const n = V(fd.z, 0.4, -fd.x).normalize();
        tops.vert(p.x, p.y, p.z, n.x, n.y, n.z, u, v);
      }
      tops.tri(i0, i0 + 1, i0 + 2);
      tops.tri(i0, i0 + 2, i0 + 3);
    }
  }
  return { leaves: leaves.build(), tops: tops.count ? tops.build() : null };
}

// ---- trees ----

// a date palm's trunk along pts: a tube whose uv runs in the boots' lattice (bootsBump: 4 bases round, 4 rows
// up a repeat), so they come out about cell metres across and up whatever the trunk's girth
function palmTrunk(b, pts, radii, seg, cell = 0.21) {
  const S = seg + 1, base = b.count;
  const t = V(), nrm = V(), bin = V(), d = V();
  const around = Math.max(1, Math.round((TAU * radii[Math.floor(radii.length / 2)]) / (4 * cell)));
  let len = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i) len += pts[i].distanceTo(pts[i - 1]);
    t.subVectors(pts[Math.min(i + 1, pts.length - 1)], pts[Math.max(i - 1, 0)]).normalize();
    if (i === 0) nrm.set(1, 0, 0);
    nrm.addScaledVector(t, -nrm.dot(t)).normalize();
    bin.crossVectors(t, nrm);
    const p = pts[i], r = radii[i];
    // (where its girth changes, as at the swollen foot, its faces tilt up or down with it)
    const i0 = Math.max(i - 1, 0), i1 = Math.min(i + 1, pts.length - 1);
    const slope = (radii[i1] - radii[i0]) / Math.max(pts[i1].distanceTo(pts[i0]), 1e-4);
    for (let j = 0; j < S; j++) {
      const ang = (j / seg) * TAU, c = Math.cos(ang), s = Math.sin(ang);
      d.set(nrm.x * c + bin.x * s, nrm.y * c + bin.y * s, nrm.z * c + bin.z * s);
      const nx = d.x - t.x * slope, ny = d.y - t.y * slope, nz = d.z - t.z * slope, nl = Math.hypot(nx, ny, nz);
      b.vert(p.x + d.x * r, p.y + d.y * r, p.z + d.z * r, nx / nl, ny / nl, nz / nl, (j / seg) * around, len / (4 * cell * 0.75));
    }
  }
  for (let i = 0; i < pts.length - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const a = base + i * S + j;
      b.tri(a, a + 1, a + S);
      b.tri(a + 1, a + S + 1, a + S);
    }
  }
}

const STUB = new THREE.BoxGeometry(1, 1, 1).translate(0.5, 0, 0);

// A date palm. lod 0: near (cut leaf-base stubs under the crown, roots, fruit, the full crown), 1: middle,
// 2: far (a thin trunk and a sparse crown). H: the trunk's height (0: an offshoot or a young palm, a crown from
// the ground). fruit: bunches of ripe dates. Its parts go into P (builders and instance lists).
export function datePalm(P, rng, x, z, { H = 10, lod = 0, fruit = true, dead = null, gy = ground(x, z) } = {}) {
  const tone = [rng(), rng()];   // how this palm's green differs from the next (all its fronds alike)
  const lean = rng() * TAU, leanAmt = H * (0.03 + rng() * rng() * 0.14), sway = rng() * 0.6;
  const n = lod === 2 ? 4 : Math.max(4, Math.round(H / 0.7));
  const R = 0.3 + rng() * 0.09;
  for (let i = 0; i <= n; i++) rng();   // (the dice its trunk's rings used to throw, still thrown: see own)
  // its own dice for the trunk's shape and its roots, apart from rng, so every palm and plant after it in a
  // scene stands where it did
  const own = makeRng((Math.floor(x * 97.3) * 73856093) ^ (Math.floor(z * 89.1) * 19349663) ^ 0x5bd1);
  // the trunk's girth at h metres up: a column, but not a cylinder. Its foot swollen into the root bole; the
  // lower trunk, its leaf bases long cut and worn, a little slimmer; thicker up where the bases still clad it,
  // most at the crown's foot; and gently swelling and narrowing with the better and the harder years (now and
  // then a marked neck, where a drought or a move all but stopped it)
  const neck = own() < 0.35 ? 0.25 + own() * 0.45 : -1, waveF = 0.5 + own() * 0.6, waveP = own() * TAU;
  const rAt = (h) => {
    const f = Math.min(Math.max(h / Math.max(H, 0.01), 0), 1);
    let k = 0.9 + 0.1 * smooth(0.25, 0.7, f) + 0.17 * smooth(0.7, 1, f) + 0.1 * smooth(H - 1.3, H - 0.2, h)
      + 0.035 * Math.sin(h * waveF + waveP) * smooth(1.2, 2.5, h) + 0.45 * (1 - smooth(-0.3, 1.5, h)) ** 2;
    if (neck > 0) k -= 0.1 * Math.exp(-((((f - neck) * H) / 0.6) ** 2));
    return R * k;
  };
  // its rings: close together at the foot, where the bole curves in; then about every 0.7 m
  const hs = lod === 2 ? Array.from({ length: n + 1 }, (_, i) => -0.3 + ((H + 0.3) * i) / n)
    : [-0.3, 0, 0.12, 0.28, 0.5, 0.8, 1.2].filter((h, i) => !i || h < H - 0.3);
  if (lod < 2) { const h0 = hs.at(-1), m = Math.max(1, Math.round((H - h0) / 0.7)); for (let i = 1; i <= m; i++) hs.push(h0 + ((H - h0) * i) / m); }
  const pts = [], radii = [];
  for (const h of hs) {
    // a slight S: the lean grows with height, the top turning back up a little
    const f = (h + 0.3) / (H + 0.3), l = leanAmt * (f * f) - sway * leanAmt * 0.3 * Math.sin(Math.PI * f);
    pts.push(V(x + Math.cos(lean) * l, gy + h, z + Math.sin(lean) * l));
    radii.push(rAt(h));
  }
  const top = pts.at(-1).clone();
  if (H > 0.4) {
    if (lod < 2) palmTrunk(P.trunk, pts, radii, lod === 0 ? 14 : 8);
    else P.trunkFar.tube(pts, radii.map((r) => r * 0.9), 5);
  }
  const axisDir = pts.at(-1).clone().sub(pts.at(-2) ?? pts.at(-1).clone().sub(UP)).normalize();
  // the crown's foot: the last cut leaf bases standing out round the trunk, and roots at its own foot
  if (lod === 0 && H > 1.2) {
    for (let k = 0; k < 34; k++) {
      const a = k * 2.39996 + rng() * 0.2, f = k / 34, y = top.y - 0.15 - f * 1.3;
      const out = V(Math.cos(a), 0, Math.sin(a));
      const p = top.clone().addScaledVector(axisDir, y - top.y).addScaledVector(out, rAt(y - gy) * 0.88);
      const dir = out.clone().multiplyScalar(0.8).add(V(0, 1, 0)).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(V(1, 0, 0), dir);
      q.multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), rng()));
      P.trunk.add(STUB, new THREE.Matrix4().compose(p, q, V(0.22 + 0.12 * f, 0.05, 0.14 + 0.04 * rng())), { flat: true, uv: [0, 0] });
    }
    for (let k = 0; k < 26 * 3; k++) rng();   // (the dice the old roots threw)
    // the roots: out of the bole's lowest rim, all round, low along the ground and soon into it, some no more
    // than their backs showing (roots leaving the trunk higher up stood out from it as a comb of dark sticks; the
    // bole itself is the root mass)
    for (let k = 0; k < 44; k++) {
      const a = (k / 44) * TAU + (own() - 0.5) * 0.12, h = 0.03 + own() * 0.12, reach = 0.12 + own() * 0.32;
      const out = V(Math.cos(a), 0, Math.sin(a)), side = V(-out.z, 0, out.x).multiplyScalar((own() - 0.5) * reach * 0.5);
      const e = V(x, 0, z).addScaledVector(out, rAt(0) + reach).add(side);
      // (on the ground where it truly is: a palm's own foot, gy, may be a little under or over it)
      const ge = Math.max(gy, ground(e.x, e.z)), gs = Math.max(gy, ground(x + out.x * rAt(0), z + out.z * rAt(0)));
      e.y = ge - 0.03;
      const s = V(x, gs + h, z).addScaledVector(out, rAt(h) * 0.96);
      const m1 = s.clone().lerp(e, 0.35).add(V(0, 0.03, 0)).add(side.clone().multiplyScalar(0.3));
      const m2 = s.clone().lerp(e, 0.7).add(V(0, 0.01, 0)).add(side.clone().multiplyScalar(0.8));
      const th = 0.014 + own() ** 2 * 0.02;
      P.roots.tube([s, m1, m2, e], [th * 1.2, th, th * 0.85, th * 0.7], 4);
    }
  }
  // the crown: fronds in a spiral (137.5° apart), from the young upright spear at the middle out and down to
  // the oldest, drooping below the horizontal; the older ones set a little lower on the trunk
  const N = lod === 0 ? 44 + Math.floor(rng() * 12) : lod === 1 ? 30 : 18;
  const L = (H < 1 ? 1.6 + rng() * 1.6 : 3.4 + rng() * 1.3) * (lod === 2 ? 1.1 : 1);
  const phase = rng() * TAU;
  for (let k = 0; k < N; k++) {
    const f = k / N;
    // (an offshoot's or a young palm's oldest fronds rest on the ground rather than in it)
    const el = Math.max(1.3 - 2.05 * f ** 0.85 + (rng() - 0.5) * 0.18, H < 1.5 ? -0.2 : H < 4 ? -0.5 : -1);
    const az = phase + k * 2.39996 + (rng() - 0.5) * 0.25;
    const len = L * (0.5 + 0.5 * smooth(0, 0.22, f)) * (0.88 + rng() * 0.24);
    const at = top.clone().addScaledVector(axisDir, -f * 0.55).add(V(Math.cos(az) * R * 0.4 * f, 0, Math.sin(az) * R * 0.4 * f));
    const variant = lod > 0 ? 3 : f < 0.3 ? 0 : f < 0.72 ? 1 : 2;
    // (+x along the frond: turned by -az about the upright to point at az)
    const m = mat(at.x, at.y, at.z, (rng() - 0.5) * 0.5, -az, el, len);
    P.fronds[variant].push({ m, c: [tone[0] + (rng() - 0.5) * 0.1, tone[1] + (rng() - 0.5) * 0.1], tex: k % 2 });
  }
  // dead fronds hanging under the crown (the grower cuts them; a few are always left)
  const nd = dead ?? (lod === 2 ? 0 : Math.floor(rng() ** 1.6 * 6));
  for (let k = 0; k < nd; k++) {
    const az = rng() * TAU, len = L * (0.8 + rng() * 0.25), at = top.clone().addScaledVector(axisDir, -0.6 - rng() * 0.6);
    P.dead.push({ m: mat(at.x, at.y, at.z, (rng() - 0.5) * 0.8, -az, -1.2 - rng() * 0.3, len), c: [rng(), rng()] });
  }
  // the dates: bunches on their stalks, out from among the lowest green fronds' bases
  if (fruit && lod === 0 && H > 3) {
    const nb = 4 + Math.floor(rng() * 6), a0 = rng() * TAU;
    for (let k = 0; k < nb; k++) {
      const az = a0 + (k / nb) * TAU + (rng() - 0.5) * 0.5;
      const at = top.clone().addScaledVector(axisDir, -0.45 - rng() * 0.35).add(V(Math.cos(az) * rAt(H - 0.6), 0, Math.sin(az) * rAt(H - 0.6)));
      P.bunches[k % 2].push({ m: mat(at.x, at.y, at.z, 0, -az, (rng() - 0.5) * 0.2, 0.85 + rng() * 0.35), c: [rng(), rng()] });
    }
  }
  return top;
}

// a trunk and branches as tubes (kind: P.bark or P.wood), from (x, gy, z): H high, leaning, r0 thick at its foot
function trunkPath(rng, x, gy, z, H, lean, n = 5, wiggle = 0.4) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n, w = i > 0 && i < n ? wiggle : 0;
    pts.push(V(x + lean.x * f * f + (rng() - 0.5) * w, gy - 0.3 + (H + 0.3) * f, z + lean.z * f * f + (rng() - 0.5) * w));
  }
  return pts;
}
const along = (pts, f) => {
  const t = f * (pts.length - 1), i = Math.min(Math.floor(t), pts.length - 2);
  return pts[i].clone().lerp(pts[i + 1], t - i);
};
const clump = (list, rng, c, s, squash = 0.7, tone = null) => {
  list.push({ m: mat(c.x, c.y, c.z, (rng() - 0.5) * 0.35, rng() * TAU, (rng() - 0.5) * 0.35, s, s * squash, s), c: tone ? [tone[0] + (rng() - 0.5) * 0.1, tone[1] + (rng() - 0.5) * 0.1] : [rng(), rng()] });
};

// The Euphrates poplar: a leaning, often crooked trunk, a few long limbs up and out, an open, uneven crown of
// small grey-green leaves in separate masses
export function poplar(P, rng, x, z, scale = 1) {
  const gy = ground(x, z), H = (8 + rng() * 6) * scale, r0 = (0.22 + rng() * 0.15) * scale;
  const lean = V((rng() - 0.5) * 3, 0, (rng() - 0.5) * 3).multiplyScalar(scale);
  const pts = trunkPath(rng, x, gy, z, H * 0.65, lean, 4, 0.5 * scale);
  P.bark.tube(pts, pts.map((_, i) => r0 * (1 - 0.45 * (i / 4)) * (i === 0 ? 1.25 : 1)), 8);
  const tone = [rng(), rng()];
  const nb = 3 + Math.floor(rng() * 3);
  for (let k = 0; k < nb; k++) {
    const a = (k / nb) * TAU + rng() * 0.9, L = (2.5 + rng() * 3.5) * scale;
    const s = along(pts, 0.55 + rng() * 0.45);
    const e = s.clone().add(V(Math.cos(a) * L * 0.6, H * (0.25 + rng() * 0.3), Math.sin(a) * L * 0.6));
    const m = s.clone().lerp(e, 0.5).add(V((rng() - 0.5) * 0.8, 0, (rng() - 0.5) * 0.8));
    P.bark.tube([s, m, e], [r0 * 0.45, r0 * 0.3, 0.05], 5);
    for (let j = 0; j < 2 + Math.floor(rng() * 2); j++) {
      const c = s.clone().lerp(e, 0.55 + j * 0.25).add(V((rng() - 0.5) * 1.6, (rng() - 0.3) * 1.2, (rng() - 0.5) * 1.6).multiplyScalar(scale));
      clump(P.poplar, rng, c, (1.8 + rng() * 1.6) * scale, 0.65, tone);
    }
  }
  clump(P.poplar, rng, pts[pts.length - 1].clone().add(V(0, 1.2 * scale, 0)), (2.2 + rng()) * scale, 0.7, tone);
}

// The tamarisk: several slender stems leaning out from the foot, an airy crown of feathery grey-green sprays
// that droop at their tips, pink plumes of flower at many of the ends
export function tamarisk(P, rng, x, z, scale = 1) {
  const gy = ground(x, z), tone = [rng(), rng()];
  const ns = 3 + Math.floor(rng() * 4);
  for (let k = 0; k < ns; k++) {
    const a = rng() * TAU, H = (2.6 + rng() * 2.8) * scale;
    const lean = V(Math.cos(a), 0, Math.sin(a)).multiplyScalar((0.6 + rng() * 1.6) * scale);
    const pts = trunkPath(rng, x + Math.cos(a) * 0.15, gy, z + Math.sin(a) * 0.15, H, lean, 4, 0.3 * scale);
    P.wood.tube(pts, pts.map((_, i) => (0.08 + rng() * 0.04) * scale * (1 - 0.6 * (i / 4))), 5);
    for (let j = 0; j < 3; j++) {
      const c = along(pts, 0.5 + j * 0.22).add(V((rng() - 0.5) * 1.2, rng() * 0.6, (rng() - 0.5) * 1.2).multiplyScalar(scale));
      clump(P.tamarisk, rng, c, (1.3 + rng() * 1.0) * scale, 0.75, tone);
    }
    const tip = pts[pts.length - 1];
    if (rng() < 0.75) {
      for (let j = 0; j < 1 + Math.floor(rng() * 3); j++) {
        const c = tip.clone().add(V((rng() - 0.5) * 1.3, 0.2 + rng() * 0.4, (rng() - 0.5) * 1.3).multiplyScalar(scale));
        clump(P.bloom, rng, c, (0.7 + rng() * 0.5) * scale, 0.9);
      }
    }
  }
}

// The pomegranate: a big shrub of several thin stems, a dense rounded crown of small narrow glossy leaves, red
// fruit hanging on its outside
export function pomegranate(P, rng, x, z, scale = 1, gy = ground(x, z)) {
  const tone = [rng(), rng()], H = (2.4 + rng() * 1.4) * scale, ns = 3 + Math.floor(rng() * 3);
  const crown = V(x, gy + H * 0.62, z);
  for (let k = 0; k < ns; k++) {
    const a = rng() * TAU, lean = V(Math.cos(a), 0, Math.sin(a)).multiplyScalar((0.5 + rng() * 0.6) * scale);
    const pts = trunkPath(rng, x, gy, z, H * (0.6 + rng() * 0.3), lean, 3, 0.2 * scale);
    P.wood.tube(pts, pts.map((_, i) => 0.06 * scale * (1 - 0.5 * (i / 3))), 5);
    clump(P.leaf, rng, pts[3].clone().add(V(0, 0.2 * scale, 0)), (1.2 + rng() * 0.5) * scale, 0.85, tone);
    clump(P.leaf, rng, along(pts, 0.6).add(V(0, 0.1, 0)), (1.0 + rng() * 0.4) * scale, 0.85, tone);
  }
  clump(P.leaf, rng, crown.clone().add(V(0, 0.4 * scale, 0)), 1.7 * scale, 0.85, tone);
  clump(P.leaf, rng, crown.clone().add(V((rng() - 0.5) * 0.8, 0.9 * scale, (rng() - 0.5) * 0.8)), 1.4 * scale, 0.85, tone);
  const nf = Math.floor((8 + rng() * 14) * scale);
  for (let k = 0; k < nf; k++) {
    const a = rng() * TAU, el = (rng() - 0.6) * 1.1, r = (0.9 + rng() * 0.4) * scale;
    const p = crown.clone().add(V(Math.cos(a) * Math.cos(el) * r, 0.2 + Math.sin(el) * r * 0.75, Math.sin(a) * Math.cos(el) * r));
    const s = 0.045 + rng() * 0.02;
    P.fruit.push({ m: mat(p.x, p.y, p.z, rng(), rng() * TAU, 0, s, s * 0.92, s), c: [rng(), rng()] });
  }
}

// The fig: a short smooth grey trunk soon dividing into a few spreading limbs, a broad, low crown of big lobed
// leaves
export function fig(P, rng, x, z, scale = 1, gy = ground(x, z)) {
  const tone = [rng(), rng()], r0 = 0.16 * scale;
  const pts = trunkPath(rng, x, gy, z, 1.1 * scale, V(), 2, 0);
  P.bark.tube(pts, [r0 * 1.2, r0, r0 * 0.9], 7);
  const top = pts[2];
  const nb = 3 + Math.floor(rng() * 2);
  for (let k = 0; k < nb; k++) {
    const a = (k / nb) * TAU + rng() * 0.6, L = (1.8 + rng() * 1.2) * scale;
    const e = top.clone().add(V(Math.cos(a) * L, (1.4 + rng() * 1.2) * scale, Math.sin(a) * L));
    P.bark.tube([top, top.clone().lerp(e, 0.5).add(V(0, 0.3, 0)), e], [r0 * 0.6, r0 * 0.45, 0.04], 5);
    clump(P.fig, rng, e.clone().add(V(0, 0.2, 0)), (1.4 + rng() * 0.6) * scale, 0.6, tone);
    clump(P.fig, rng, top.clone().lerp(e, 0.6).add(V(0, 0.6 * scale, 0)), (1.2 + rng() * 0.4) * scale, 0.6, tone);
  }
  clump(P.fig, rng, top.clone().add(V(0, 2.4 * scale, 0)), 1.6 * scale, 0.6, tone);
}

// ---- where everything grows ----

// the city's own palms, where the Blender scene put them (tools/build_mesopotamia.py; Blender (x, y) is
// (x, -z) here), with their heights
const CITY_PALMS = [[-30, -40, 10], [-29, -20, 8], [-33, 3, 11], [-32, 27, 9], [-29, 54, 12], [36, -37, 10], [43, -49, 9],
  [62, 32, 10], [43, 53, 12], [59, 55, 9], [35, 64, 11], [-61, -39, 10], [-62, 9, 9], [-60, 54, 11]].map(([x, y, h]) => [x, -y, h]);
// the irrigated pocket garden (Blender (51, 43), 17 x 20 m; its four beds at x 45, 49, 53, 57)
const GARDEN = { x0: 42.5, x1: 59.5, z0: -53, z1: -33, beds: [45, 49, 53, 57] };
// the courtyards (Blender house centres and sizes) and what grows in each: a tree in the open court
const COURTS = [
  { x: -17, y: -48, w: 14, d: 13, tree: 'pomegranate' }, { x: 1, y: -54, w: 14, d: 14, tree: 'fig' },
  { x: 22, y: -51, w: 14, d: 13, tree: null }, { x: -25, y: -10, w: 12, d: 15, tree: 'pomegranate' },
  { x: 55, y: -9, w: 13, d: 16, tree: 'palm' }, { x: 55, y: 16, w: 12, d: 15, tree: 'pomegranate' },
  { x: 15, y: 66, w: 16, d: 12, tree: 'fig' }, { x: -5, y: 66, w: 12, d: 12, tree: null },
].map((c) => ({ ...c, z: -c.y }));

// an empty set of plants: the builders and instance lists the plant builders fill, plantMeshes draws
export function newPlants() {
  return {
    trunk: new Builder(true), trunkFar: new Builder(), roots: new Builder(), bark: new Builder(), wood: new Builder(),
    fronds: [[], [], [], []], dead: [], bunches: [[], []], poplar: [], tamarisk: [], bloom: [], leaf: [], fig: [], fruit: [],
    reeds: [[], []], cattails: [], grass: [], camel: [], licorice: [], herbs: [], leeks: [], stubble: [], sesame: [], stacks: [],
    vines: [],
  };
}

export function buildFlora(scene, land) {
  useGround(heightAt);
  const rng = makeRng(1901);
  const P = newPlants();
  const space = new Spacing(8);
  const inModel = (x, z, m = 0) => x > MODEL.x0 - m && x < MODEL.x1 + m && z > MODEL.z0 - m && z < MODEL.z1 + m;
  const riverD = (x, z) => x - riverX(z);   // + east of the river's middle
  const nearCity = (x, z) => Math.hypot(x, z + 3);
  const lodAt = (x, z) => (nearCity(x, z) < 115 ? 0 : nearCity(x, z) < 340 ? 1 : 2);
  const free = (x, z, m) => !land.solidAt(x, z, m) && land.pathDist(x, z) > 2.2 + m;

  // the town's palms, mature and tall, with their dates; one or two offshoots at the foot of some
  for (const [x, z, h] of CITY_PALMS) {
    datePalm(P, rng, x, z, { H: h + rng() * 2, lod: 0, dead: Math.floor(rng() * 3) });
    space.add(x, z, 4);
    if (rng() < 0.4) {
      const a = rng() * TAU, ox = x + Math.cos(a) * 1.1, oz = z + Math.sin(a) * 1.1;
      if (free(ox, oz, 0.4)) datePalm(P, rng, ox, oz, { H: 0, lod: 0, fruit: false, dead: 0 });
    }
  }

  // the garden: palms round its edge, pomegranates and a fig under them, beds of onions, leeks and lettuce
  for (const [x, z, h] of [[42.6, -37, 9], [59.8, -41, 11], [51, -32.2, 8], [59.6, -51.5, 7]]) {
    datePalm(P, rng, x, z, { H: h, lod: 0 });
    space.add(x, z, 3);
  }
  for (const [x, z] of [[43.2, -46], [59.2, -46.5], [47, -32.6], [55, -32.6]]) pomegranate(P, rng, x, z, 0.9);
  fig(P, rng, 61.5, -35.5, 0.95);
  for (const bx of GARDEN.beds) {
    for (let z = -51.6; z < -34.4; z += 0.45) {
      for (const dx of [-0.75, 0, 0.75]) {
        const x = bx + dx + (rng() - 0.5) * 0.08, y = 0.33, zz = z + (rng() - 0.5) * 0.1;
        // onions and leeks (straps) in two rows, lettuce down the middle
        if (dx !== 0) P.leeks.push({ m: mat(x, y, zz, 0, rng() * TAU, 0, 0.3 + rng() * 0.15, 0.4 + rng() * 0.2, 0.3), c: [rng(), rng()] });
        else if (rng() < 0.8) P.herbs.push({ m: mat(x, y, zz, 0, rng() * TAU, 0, 0.42 + rng() * 0.12, 0.26, 0.42), c: [rng(), rng()] });
      }
    }
  }

  // the courtyards' trees, in the open court (tried round its middle until one is clear of the house's things)
  for (const c of COURTS) {
    if (!c.tree) continue;
    for (let tries = 0; tries < 30; tries++) {
      const x = c.x + (rng() - 0.5) * (c.w - 8), z = c.z + (rng() - 0.5) * (c.d - 5);
      if (land.solidAt(x, z, c.tree === 'palm' ? 0.6 : 0.9)) continue;
      const gy = 0.32;
      if (c.tree === 'pomegranate') pomegranate(P, rng, x, z, 0.8, gy);
      else if (c.tree === 'fig') fig(P, rng, x, z, 0.75, gy);
      else datePalm(P, rng, x, z, { H: 2.5, lod: 0, fruit: false, dead: 0, gy });
      break;
    }
  }

  // the groves, gathered into masses as the plan draws them: a long belt on the west
  // bank behind its reeds, a block north of the town and one south of it, each dense and dark with a clear edge;
  // inside them palms in rough rows some seven metres apart (a jittered grid), a few gaps where one has died
  // or been felled; of every age (offshoots and young palms among the tall). Between the blocks the town's
  // mound stands clear
  const fields = land.fields;
  const inField = (x, z, m = 3) => fields.some((f) => x > f.x0 - m && x < f.x1 + m && z > f.z0 - m && z < f.z1 + m);
  // (viewpoint 1's line of sight to the ziggurat, kept open through the north block)
  const V1 = { x: riverX(-150) + 12.5, z: -150 };
  const sightDist = (x, z) => {
    const dx = 0 - V1.x, dz = -22 - V1.z, t = Math.min(Math.max(((x - V1.x) * dx + (z - V1.z) * dz) / (dx * dx + dz * dz), 0), 1);
    return Math.hypot(x - V1.x - dx * t, z - V1.z - dz * t);
  };
  const inMass = (x, z) => {
    const d = x - riverX(z), rag = (fbm(x * 0.03, z * 0.03, 2, 9) - 0.5) * 10;
    if (d < 0) return -d > 24 && -d < 78 + 18 * Math.sin(z * 0.02) + rag;
    if (z < -100) return d > 16 && d < 110 + 30 * Math.sin(z * 0.011) + rag && !(z > -168 && z < -132 && d < 19)
      && sightDist(x, z) > 9 + rag * 0.4;
    if (z > 92) return d > 14 && d < 115 + 25 * Math.sin(z * 0.013 + 1) + rag;
    return false;
  };
  const GROVE_REACH = 640, STEP = 7;
  let groves = 0;
  const plantPalm = (x, z, young = 0.24) => {
    const lod = lodAt(x, z), r = rng();
    datePalm(P, rng, x, z, { H: r < 0.08 ? 0 : r < young ? 1.5 + rng() * 3 : 7 + rng() * 9, lod, fruit: lod === 0 && rng() < 0.85 });
    space.add(x, z, 2.5);
    groves++;
    // offshoots in a clump at the foot of some
    if (r > young && rng() < 0.15 && lod < 2) {
      for (let k = 0; k < 1 + Math.floor(rng() * 2); k++) {
        const a = rng() * TAU;
        datePalm(P, rng, x + Math.cos(a) * 1.2, z + Math.sin(a) * 1.2, { H: 0, lod, fruit: false, dead: 0 });
      }
    }
  };
  for (let gz = -GROVE_REACH; gz <= GROVE_REACH; gz += STEP) {
    for (let gx = -GROVE_REACH; gx <= GROVE_REACH; gx += STEP) {
      const x = gx + (rng() - 0.5) * 3, z = gz + (rng() - 0.5) * 3;
      if (!inMass(x, z) || rng() < 0.08 || fbm(x * 0.013 + 40, z * 0.013, 3, 5) > 0.72) continue;
      if (inModel(x, z, 7) || inField(x, z) || land.solidAt(x, z, 1.2)) continue;
      plantPalm(x, z);
    }
  }
  // along the canals across the back-slope (and the west bank's), a row of palms either side at the foot of the
  // embankment, eight or nine metres apart, a few missing: the vertical rhythm over the open fields
  for (const c of CANALS) {
    if (c.raised === false) continue;
    for (const g of c.segs) {
      const ux = (g.bx - g.ax) / g.len, uz = (g.bz - g.az) / g.len;
      for (let t = 4; t < g.len; t += 8 + rng() * 1.5) {
        for (const side of [-1, 1]) {
          if (rng() < 0.12) continue;
          const off = c.hw + 10.5 + (rng() - 0.5) * 1.2;
          const x = g.ax + ux * t - uz * off * side, z = g.az + uz * t + ux * off * side;
          if (Math.abs(x) > GROVE_REACH + 200 || Math.abs(z) > GROVE_REACH + 200) continue;
          if (inMass(x, z) || inModel(x, z, 7) || land.solidAt(x, z, 1) || !space.ok(x, z, 2.5) || sightDist(x, z) < 10) continue;
          if (x - riverX(z) < -228) continue;   // (the west canals run out into the salt flat)
          plantPalm(x, z, 0.12);
        }
      }
    }
  }
  // gardens at the foot of the town's mound: a knot of palms with pomegranates under them
  for (const [cx, cz] of [[78, 30], [80, -60], [-8, 92]]) {
    for (let k = 0; k < 9; k++) {
      const a = k * 2.39996 + rng() * 0.4, r = 3 + Math.sqrt(k) * 4.2, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (land.solidAt(x, z, 1) || !space.ok(x, z, 2.2)) continue;
      if (k % 3 === 2) pomegranate(P, rng, x, z, 0.9 + rng() * 0.3);
      else plantPalm(x, z, 0.3);
    }
  }

  // under the near groves, as in the gardens: pomegranates and figs, between the palms
  for (let n = 0, tries = 0; n < 160 && tries < 12000; tries++) {
    const z = (rng() * 2 - 1) * 300, x = riverX(z) + (rng() < 0.65 ? 1 : -1) * (14 + rng() * 110);
    if (!inMass(x, z) || inModel(x, z, 3) || land.solidAt(x, z, 1.2) || !space.ok(x, z, 1.8) || sightDist(x, z) < 10) continue;
    if (rng() < 0.7) pomegranate(P, rng, x, z, 0.85 + rng() * 0.4);
    else fig(P, rng, x, z, 0.9 + rng() * 0.4);
    space.add(x, z, 1.8);
    n++;
  }

  // the river's banks: reeds in a belt along the water (thicker on the west bank, broken by the quay and the
  // water steps on the east), cattails in the shallows among them; behind them tamarisks and Euphrates
  // poplars, with licorice on the bank tops
  const reedRng = makeRng(2207);
  const reedAt = (x, z, s, near, water) => {
    const h = heightAt(x, z), y = Math.max(h, water - 0.15);
    if (h < water && reedRng() < 0.3) P.cattails.push({ m: mat(x, y, z, 0, reedRng() * TAU, 0, s, s * (0.8 + reedRng() * 0.3), s), c: [reedRng(), reedRng()] });
    else P.reeds[near ? 0 : 1].push({ m: mat(x, y, z, (reedRng() - 0.5) * 0.1, reedRng() * TAU, (reedRng() - 0.5) * 0.1, s, s * (0.75 + reedRng() * 0.4), s), c: [reedRng(), reedRng()] });
  };
  for (let z = -WORLD + 20; z < WORLD - 20; z += 0.9 + reedRng() * 0.9) {
    const rx = riverX(z);
    for (const side of [1, -1]) {
      const near = Math.abs(z) < 260;
      if (!near && reedRng() < 0.45) continue;
      if (side > 0 && z > -2 && z < 36) continue;   // the quay, the cargo shade and the water steps
      const rows = side < 0 ? 3 : 1 + (reedRng() < 0.5 ? 1 : 0);
      for (let r = 0; r < rows; r++) {
        if (reedRng() < 0.2) continue;
        const d = RIVER_HALF - 1.2 + r * 1.1 + (reedRng() - 0.5) * 0.8;
        reedAt(rx + side * d, z + (reedRng() - 0.5) * 0.8, 0.8 + reedRng() * 0.5, near, WATER_Y);
      }
    }
  }
  // the way in from viewpoint 1: the bank path north of the town runs between the river's reeds and a second
  // wall of them on its landward side, a tunnel one walks out of to see the town
  for (let z = -186; z < -128; z += 0.7 + reedRng() * 0.5) {
    const x = riverX(z) + 15.2 + (reedRng() - 0.5) * 1.4;
    if (z > -124 && z < -112) continue;   // (the north canal and its bridge)
    reedAt(x, z, 1.05 + reedRng() * 0.35, true, WATER_Y);
    if (reedRng() < 0.5) reedAt(x + 1 + reedRng(), z, 1 + reedRng() * 0.3, true, WATER_Y);
  }
  // the canals' edges: a thinner line of reeds
  for (const c of CANALS) {
    for (const g of c.segs) {
      for (let t = 0; t < g.len; t += 1.6 + reedRng() * 2.5) {
        if (reedRng() < 0.35) continue;
        const side = reedRng() < 0.5 ? 1 : -1, off = c.hw + 0.2 + reedRng() * 0.6;
        const x = g.ax + (g.bx - g.ax) * (t / g.len) - ((g.bz - g.az) / g.len) * off * side;
        const z = g.az + (g.bz - g.az) * (t / g.len) + ((g.bx - g.ax) / g.len) * off * side;
        if (Math.abs(x) > WORLD - 20 || Math.abs(z) > WORLD - 20) continue;
        if (Math.abs(x - (riverX(-150) + 12.5)) < 3.5 && Math.abs(z + 118) < 6) continue;   // (the bridge)
        const k = 0.6 + reedRng() * 0.4;
        P.reeds[Math.hypot(x, z) < 260 ? 0 : 1].push({ m: mat(x, heightAt(x, z), z, 0, reedRng() * TAU, 0, k, k * 0.8, k), c: [reedRng(), reedRng()] });
      }
    }
  }
  // (viewpoint 3, on the lagoon's east shore: the water in front of it kept open, from a little right of the
  // ziggurat's line round past the sun's glitter on the left; the reeds stand either side as a frame)
  const V3 = VIEWS.lagoon;
  const lagoonView = (x, z) => {
    const dx = x - V3.x, dz = z - V3.z, r = Math.hypot(dx, dz);
    if (r > 70) return false;
    const a = Math.atan2(dz, dx), aZig = Math.atan2(-22 - V3.z, 0 - V3.x);
    const da = Math.atan2(Math.sin(a - aZig), Math.cos(a - aZig));
    return da > -0.8 && da < 0.14;
  };
  // the lagoon: a ring of reeds in its shallows, broken here and there to open water, cattails among them; its
  // islands all reed; tamarisks on its shore
  for (let i = 0; i < LAGOON.length; i++) {
    const [ax, az] = LAGOON[i], [bx, bz] = LAGOON[(i + 1) % LAGOON.length], l = Math.hypot(bx - ax, bz - az);
    const nx = (bz - az) / l, nz = -(bx - ax) / l;   // (inwards: the outline runs clockwise on the screen's plan)
    for (let t = 0; t < l; t += 0.9 + reedRng() * 0.8) {
      if (fbm((ax + (bx - ax) * (t / l)) * 0.05, (az + (bz - az) * (t / l)) * 0.05, 2, 77) > 0.62) continue;   // (open gaps)
      for (let r = 0; r < 4; r++) {
        if (reedRng() < 0.25) continue;
        const o = -1 + r * 1.6 + reedRng() * 1.2;
        let x = ax + (bx - ax) * (t / l) + nx * o, z = az + (bz - az) * (t / l) + nz * o;
        if (polySigned(x, z, LAGOON) < -1.5) { x -= 2 * nx * o; z -= 2 * nz * o; }
        const h = heightAt(x, z);
        if (h < LAGOON_Y - 0.9 || h > LAGOON_Y + 0.4) continue;
        if (lagoonView(x, z)) continue;
        reedAt(x, z, 0.85 + reedRng() * 0.45, true, LAGOON_Y);
      }
    }
  }
  for (const [cx, cz, r] of ISLANDS) {
    for (let k = 0; k < r * r * 1.1; k++) {
      const a = reedRng() * TAU, rr = Math.sqrt(reedRng()) * (r + 1.5);
      reedAt(cx + Math.cos(a) * rr, cz + Math.sin(a) * rr, 0.9 + reedRng() * 0.45, true, LAGOON_Y);
    }
  }
  for (let k = 0, tries = 0; k < 16 && tries < 400; tries++) {
    const i = Math.floor(rng() * LAGOON.length), [ax, az] = LAGOON[i], [bx, bz] = LAGOON[(i + 1) % LAGOON.length], t = rng();
    const x = ax + (bx - ax) * t, z = az + (bz - az) * t, out = 6 + rng() * 10;
    const cx = (x - 200) / Math.hypot(x - 200, z - 30), cz = (z - 30) / Math.hypot(x - 200, z - 30);
    const px = x + cx * out, pz = z + cz * out;
    if (land.solidAt(px, pz, 1.5) || inField(px, pz, 1) || !space.ok(px, pz, 2.5)) continue;
    tamarisk(P, rng, px, pz, 0.8 + rng() * 0.4);
    space.add(px, pz, 2.5);
    k++;
  }
  // tamarisks and poplars on the river's banks and by the canals (the poplars only near water)
  for (let n = 0, tries = 0; n < 420 && tries < 20000; tries++) {
    let x, z;
    if (rng() < 0.7) {
      z = (rng() * 2 - 1) * (WORLD - 40);
      x = riverX(z) + (rng() < 0.6 ? -1 : 1) * (RIVER_HALF + 2 + rng() * 16);
    } else {
      const c = CANALS[Math.floor(rng() * CANALS.length)], g = c.segs[Math.floor(rng() * c.segs.length)], t = rng();
      const side = rng() < 0.5 ? -1 : 1, off = c.hw + 4 + rng() * 9;
      x = g.ax + (g.bx - g.ax) * t - ((g.bz - g.az) / g.len) * off * side;
      z = g.az + (g.bz - g.az) * t + ((g.bx - g.ax) / g.len) * off * side;
    }
    if (land.solidAt(x, z, 1.5) || inField(x, z, 1) || !space.ok(x, z, 2.5) || sightDist(x, z) < 10) continue;
    if (inModel(x, z, 2) && riverD(x, z) > 0 && !(z > 36 || z < -60)) continue;   // not in the harbour
    if (riverD(x, z) < -230) continue;                                               // nor out on the salt flat
    const far = Math.hypot(x, z) > 450;
    if (rng() < 0.62) tamarisk(P, rng, x, z, (far ? 1.1 : 0.85) + rng() * 0.45);
    else poplar(P, rng, x, z, 0.8 + rng() * 0.4);
    space.add(x, z, 2.5);
    n++;
  }
  // a few tamarisks in the town (by the stores, the harbour shade, the workshops) and on the west bank
  for (const [x, z] of [[-36, -50], [-40, 40], [33, 45], [-17, 66], [66, -2], [-64, 28], [-66, -24], [-63, 62], [-65, -63]]) {
    if (!land.solidAt(x, z, 1.2)) tamarisk(P, rng, x, z, 0.9 + rng() * 0.3);
  }
  // licorice: low green shrubs on the bank tops
  for (let z = -400; z < 400; z += 2 + rng() * 5) {
    for (const side of [1, -1]) {
      if (rng() < 0.5) continue;
      const x = riverX(z) + side * (RIVER_HALF + 1.2 + rng() * 5);
      if (land.solidAt(x, z, 0.5) || (side > 0 && z > -2 && z < 36)) continue;
      const s = 0.6 + rng() * 0.5;
      P.licorice.push({ m: mat(x, heightAt(x, z) + s * 0.25, z, 0, rng() * TAU, 0, s, s * 0.6, s), c: [rng(), rng()] });
    }
  }

  // dry ground: grass tufts and camelthorn; sparse on the open plain and the mound's flanks, at the feet of walls in
  // the town (out of the way of feet), along the bunds and the embankments; on the salt flat and the desert's edge
  // only camelthorn, few and far between
  const grassRng = makeRng(3301);
  for (let n = 0; n < 30000; n++) {
    const R = grassRng() < 0.5 ? 90 : 360;
    const x = (grassRng() * 2 - 1) * R - (R > 100 ? 60 : 0), z = (grassRng() * 2 - 1) * R;
    if (land.solidAt(x, z, 0.15) || land.pathDist(x, z) < 2.6) continue;
    const town = inModel(x, z), w = -riverD(x, z);
    if (town && !land.solidAt(x, z, 1.4) && grassRng() < 0.85) continue;   // in the town, mostly by the walls
    if (!town && inField(x, z, -1) && grassRng() < 0.9) continue;          // the fields have their own
    const dry = w > 125;
    if (dry && grassRng() < 0.8) continue;
    const y = heightAt(x, z);
    const s = 0.25 + grassRng() * 0.35;
    if (dry || (!town && grassRng() < 0.18)) P.camel.push({ m: mat(x, y - 0.02, z, 0, grassRng() * TAU, 0, s * 1.6, s * 1.1, s * 1.6), c: [grassRng(), grassRng()] });
    else P.grass.push({ m: mat(x, y - 0.02, z, (grassRng() - 0.5) * 0.2, grassRng() * TAU, (grassRng() - 0.5) * 0.2, s * 1.4, s, s * 1.4), c: [grassRng(), grassRng()] });
  }

  // the fields near enough to see: stubble standing in tufts, sesame in rows (some of it cut and stood in
  // shocks to dry), stacks of straw
  const fieldRng = makeRng(4409);
  for (const f of fields) {
    const dist = Math.hypot((f.x0 + f.x1) / 2, (f.z0 + f.z1) / 2);
    if (dist > 520) continue;
    if (f.crop === 'stubble') {
      const step = dist < 260 ? 0.75 : 1.8;
      for (let x = f.x0 + 0.5; x < f.x1; x += step) {
        for (let z = f.z0 + 0.5; z < f.z1; z += step) {
          const px = x + (fieldRng() - 0.5) * step, pz = z + (fieldRng() - 0.5) * step, s = 0.26 + fieldRng() * 0.16;
          P.stubble.push({ m: mat(px, heightAt(px, pz) + 0.02, pz, 0, fieldRng() * TAU, 0, s * 1.8, s, s * 1.8), c: [fieldRng(), fieldRng()] });
        }
      }
      for (let k = 0; k < 1 + Math.floor(fieldRng() * 3); k++) {
        const x = f.x0 + 6 + fieldRng() * (f.x1 - f.x0 - 12), z = f.z0 + 6 + fieldRng() * (f.z1 - f.z0 - 12), s = 1.6 + fieldRng() * 1.2;
        P.stacks.push({ m: mat(x, heightAt(x, z) - 0.1, z, 0, fieldRng() * TAU, 0, s, s * (0.9 + fieldRng() * 0.4), s), c: [fieldRng(), fieldRng()] });
      }
    } else if (f.crop === 'sesame') {
      const cut = fieldRng() * 0.6;
      const along = f.rows === 'x';
      const [a0, a1, b0, b1] = along ? [f.x0, f.x1, f.z0, f.z1] : [f.z0, f.z1, f.x0, f.x1];
      for (let b = b0 + 0.6; b < b1; b += 0.9) {
        for (let a = a0 + 0.3; a < a1; a += 0.5) {
          const x = along ? a : b, z = along ? b : a;
          if ((a - a0) / (a1 - a0) < cut) continue;
          const s = 0.7 + fieldRng() * 0.4;
          P.sesame.push({ m: mat(x + (fieldRng() - 0.5) * 0.15, heightAt(x, z), z + (fieldRng() - 0.5) * 0.15, (fieldRng() - 0.5) * 0.15, fieldRng() * TAU, (fieldRng() - 0.5) * 0.15, s * 0.6, s * 1.25, s * 0.6), c: [fieldRng(), fieldRng()] });
        }
      }
      // the cut part: shocks of sesame stood up to dry, in rows
      for (let b = b0 + 3; b < b1 - 2; b += 6) {
        for (let a = a0 + 3; a < a0 + (a1 - a0) * cut - 2; a += 5) {
          const x = along ? a : b, z = along ? b : a, s = 0.75 + fieldRng() * 0.2;
          P.stacks.push({ m: mat(x, heightAt(x, z) - 0.05, z, 0, fieldRng() * TAU, 0, s * 0.45, s * 0.9, s * 0.45), c: [fieldRng(), fieldRng()], shock: true });
        }
      }
    }
  }

  plantMeshes(scene, P);
  const fronds = P.fronds.reduce((a, l) => a + l.length, 0);
  return {
    counts: {
      groves, fronds, dead: P.dead.length, bunches: P.bunches[0].length + P.bunches[1].length, poplarClumps: P.poplar.length,
      tamariskClumps: P.tamarisk.length, reeds: P.reeds[0].length + P.reeds[1].length, cattails: P.cattails.length,
      grass: P.grass.length + P.camel.length, stubble: P.stubble.length, sesame: P.sesame.length, fruit: P.fruit.length,
    },
  };
}

// the plants of a set (newPlants), into meshes: the trunks and stems as one mesh each, everything else instanced in
// tiles. Returns nothing; the meshes are added to scene
export function plantMeshes(scene, P) {
  const rng = makeRng(1901);
  const tex = makePlantTextures();
  // (in tiles 60 m across round the town, so the view and the shadow maps leave out those they do not reach; the
  // groves beyond, where tiles would be many, together)
  const plain = (builder, material, geo = null) => {
    if (!builder.count) return null;
    for (const g of splitTiles(geo ?? builder.build(), 60, [-160, -160, 220, 200])) {
      const m = new THREE.Mesh(g, material);
      m.castShadow = m.receiveShadow = true;
      if (material.userData.depthMat) m.customDepthMaterial = material.userData.depthMat;
      scene.add(m);
    }
  };
  // the palms' trunks, clad in their leaf bases (the bump), in tiles too (they are many)
  const barkMat = lightMat({ kind: 'bark' });
  const bootsMat = lightMat({ kind: 'bark' });
  bootsMat.bumpMap = bootsBump();
  bootsMat.bumpScale = 3;
  plain(P.trunk, bootsMat);
  plain(P.trunkFar, barkMat);
  plain(P.roots, barkMat);
  plain(P.bark, barkMat);
  plain(P.wood, lightMat({ kind: 'wood' }));

  // (in tiles TILE m across, each its own mesh, so what the view or a shadow map does not reach is left out; tile:
  // smaller for the reeds, the most of all, so the near shadow map, 44 m across, leaves out more of them. layer: 1
  // for what only the near shadow map draws (main.js). max: left out beyond so far off (lod.js); far: { at, geo,
  // material }: beyond at, a plainer version of the same plants instead)
  const TILE = 120;
  const instanced = (geo, material, list, shadow = true, { tile = TILE, layer = 0, max = Infinity, far = null } = {}) => {
    if (!list.length) return 0;
    const tiles = new Map(), p = V();
    list.forEach((it, i) => {
      p.setFromMatrixPosition(it.m);
      const key = `${Math.floor(p.x / tile)},${Math.floor(p.z / tile)}`;
      if (!tiles.has(key)) tiles.set(key, []);
      tiles.get(key).push(i);
    });
    const c = new THREE.Color();
    for (const idx of tiles.values()) {
      const make = (g, mat, sh) => {
        const m = new THREE.InstancedMesh(g, mat, idx.length);
        idx.forEach((i, j) => {
          m.setMatrixAt(j, list[i].m);
          const [r, gg] = list[i].c;
          m.setColorAt(j, c.setRGB(Math.min(Math.max(r, 0), 1), Math.min(Math.max(gg, 0), 1), 0));
        });
        m.castShadow = sh;
        m.receiveShadow = true;
        if (mat.userData.depthMat) m.customDepthMaterial = mat.userData.depthMat;
        m.computeBoundingSphere();
        m.boundingSphere.radius += 5;   // (room for the wind's sway)
        if (layer) m.layers.set(layer);
        scene.add(m);
        return m;
      };
      const m = make(geo, material, shadow);
      if (far) {
        lodAdd(m, { max: far.at });
        lodAdd(make(far.geo, far.material ?? material, false), { min: far.at, max });
      } else if (max < Infinity) lodAdd(m, { max });
    }
    return list.length;
  };
  const leafMat = (kind, map, bent = true) => lightMat({ kind, alphaMap: map, side: THREE.DoubleSide, bent });
  // fronds: three shapes (young and upright, mature, old and drooping), each with two leaflet patterns
  const frondMats = [leafMat('palm', tex.frond), leafMat('palm', tex.frondB)];
  const frondGeos = [
    frondGeometry({ rise: 0.1, droop: 0.12, twist: 0.25 }),
    frondGeometry({ rise: 0.12, droop: 0.3, twist: 0.5 }),
    frondGeometry({ rise: 0.04, droop: 0.42, twist: 0.8 }),
  ];
  frondGeos.forEach((g, v) => [0, 1].forEach((t) => instanced(g, frondMats[t], P.fronds[v].filter((f) => f.tex === t))));
  // (farther off, a lighter frond, a little broader: fewer of them fill the crown as well)
  instanced(frondGeometry({ rise: 0.1, droop: 0.3, twist: 0.4, segs: 6, wide: 1.45 }), frondMats[0], P.fronds[3]);
  instanced(frondGeos[2], leafMat('deadfrond', tex.dryFrond), P.dead);
  const spadixMat = lightMat({ kind: 'spadix' }), dateMat = lightMat({ kind: 'date' });
  const bunchRng = makeRng(77);
  for (const list of P.bunches) {
    const b = bunchGeometry(bunchRng);
    // (no shadows of their own: they hang in the crown's; none drawn from 70 m off, where a bunch is a few pixels)
    instanced(b.stalk, spadixMat, list, false, { max: 70 });
    instanced(b.fruit, dateMat, list, false, { max: 70 });
  }
  const crownRng = makeRng(88);
  const split = (list, n) => Array.from({ length: n }, (_, i) => list.filter((_, j) => j % n === i));
  split(P.poplar, 2).forEach((l) => instanced(clumpGeometry(crownRng, 24), leafMat('poplar', tex.poplar), l));
  split(P.tamarisk, 2).forEach((l) => instanced(clumpGeometry(crownRng, 20, { droop: 0.7 }), leafMat('tamarisk', tex.tamarisk), l));
  instanced(clumpGeometry(crownRng, 10, { droop: 0.2 }), leafMat('bloom', tex.bloom), P.bloom);
  split(P.leaf, 2).forEach((l) => instanced(clumpGeometry(crownRng, 26), leafMat('leaf', tex.narrow), l));
  instanced(clumpGeometry(crownRng, 18, { flat: 0.8 }), leafMat('leaf', tex.fig), P.fig);
  const fruitGeo = mergeVertices(new THREE.IcosahedronGeometry(1, 1).deleteAttribute('uv').deleteAttribute('normal'));
  fruitGeo.computeVertexNormals();
  instanced(fruitGeo, lightMat({ kind: 'fruit' }), P.fruit);
  // reeds: two stands (a full one near, a sparser one far: some ten thousand of those line the far banks, so
  // only four stems each), their tassels; cattails
  const reedLeafMat = leafMat('reed', tex.strap, false), plumeMat = leafMat('plume', tex.plume, false);
  const reedNear = reedGeometry(makeRng(5), { stems: 16 }), reedFar = reedGeometry(makeRng(6), { stems: 4 });
  // (the near stands: in 40 m tiles, cast only into the near shadow map (layer 1: the far map's reach, 220 m, held
  // three million of their triangles, for shadows one hardly sees from afar); from 45 m off, the sparser stand)
  const R = { tile: 40, layer: 1 };
  instanced(reedNear.leaves, reedLeafMat, P.reeds[0], true, { ...R, far: { at: 45, geo: reedFar.leaves } });
  instanced(reedNear.tops, plumeMat, P.reeds[0], true, { ...R, far: { at: 45, geo: reedFar.tops } });
  // (the far ones cast no shadow: the belts along the banks are long, and their shadows far off hardly show)
  instanced(reedFar.leaves, reedLeafMat, P.reeds[1], false, { layer: 1 });
  instanced(reedFar.tops, plumeMat, P.reeds[1], false, { layer: 1 });
  const cat = reedGeometry(makeRng(7), { stems: 9, h: 2.1, cattail: true });
  instanced(cat.leaves, reedLeafMat, P.cattails);
  if (cat.tops) instanced(cat.tops, lightMat({ kind: 'wood', side: THREE.DoubleSide }), P.cattails);
  // the ground's small plants
  const tuft3 = tuftGeometry(3, 0.1);
  instanced(tuft3, leafMat('grass', tex.grass), P.grass, true);
  instanced(tuftGeometry(3, 0), leafMat('grass', tex.camel), P.camel, true);
  instanced(clumpGeometry(crownRng, 12, { flat: 0.7 }), leafMat('herb', tex.narrow), P.licorice);
  instanced(tuft3, leafMat('herb', tex.greenTuft), P.leeks);
  instanced(clumpGeometry(crownRng, 10, { flat: 0.6 }), leafMat('herb', tex.fig), P.herbs);
  // grape vines (on the trellises over doors): clumps of their five-lobed leaves
  instanced(clumpGeometry(crownRng, 16, { flat: 0.55, droop: 0.3 }), leafMat('vine', tex.vine), P.vines);
  instanced(tuftGeometry(2, 0), leafMat('crop', tex.grass), P.stubble, false);
  instanced(tuftGeometry(2, 0.03), leafMat('crop', tex.sesame), P.sesame);
  // straw stacks (domes) and sesame shocks (cones), solid
  const dome = new THREE.SphereGeometry(1, 14, 8, 0, TAU, 0, Math.PI / 2).deleteAttribute('uv');
  const cone = new THREE.ConeGeometry(1, 1.6, 9, 1, false).translate(0, 0.8, 0).deleteAttribute('uv');
  instanced(dome, lightMat({ kind: 'grain' }), P.stacks.filter((s) => !s.shock));
  instanced(cone, lightMat({ kind: 'crop' }), P.stacks.filter((s) => s.shock));
}
