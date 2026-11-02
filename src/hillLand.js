// The hill town's land and water: the mound the town is built on, rising some 14.5 m from its
// quay on the great river (the Euphrates, on which Uruk and Ur stood: the bay scene's river and bay, kept); to the east, past
// the mound's foot, the plain with its groves and a canal, and some 300 m off the Euphrates' east branch; across the river the
// reeds and palms, then fields in long strips back from their canals, an old village's tell among them, the steppe
// and, kilometres off, the desert's first dunes. The plain runs on to its horizon (FAR), the far off fading into
// the sky (shade.js uFarFade); what stands on it out there: farLand.js.
//
// Heights are from the water (0). Three.js coordinates: x east, y up, z south.

import * as THREE from 'three';
import { fbm, makeRng } from './rand.js';
import { lightMat, shared, MAX_CANALS } from './shade.js';
import { splitTiles } from './geo.js';
import { polySigned, polyDist, tellMesh } from './land.js';
import { eastEdge as bayEastEdge, westEdge as bayWestEdge, QUAY, waterMesh, WATER } from './bayLand.js';
import { smooth, moundY, inMound, inMoundWas, townGround, meshGround, EAST_BRANCH, CANAL, QUAY_Y } from './hillPlan.js';

export const REACH = 1600;   // the ground's finer part runs on to here; the rivers' and the canals' water too
export const FAR = 20000;    // and the plain to here (the horizon from the ziggurat's top: beyond, all sky)
// an old village's tell across the river, among the fields, to the right of the view west (farLand.js: its houses;
// where Ur once stood)
export const OLD_TELL = { x: -700, z: -380, r: 140, h: 17 };
// Ur (farLand.js): out in front of the ziggurat, as one looks down its great stair westwards over the river, to the
// left of its line; its middle some 1.2 km beyond the river's far bank (half as far
// as it was; in truth twelve, and north-east: brought into the view)
export const UR = { x: -1375, z: 730, r: 620 };
// how far into Ur's oval (x, z) is (1 its wall's line): the oval some 1.3 km by 0.8, lying north-west to
// south-east (farLand.js builds it so)
export const inUr = (x, z) => {
  const dx = x - UR.x, dz = z - UR.z, ax = Math.cos(0.5), az = Math.sin(0.5);
  return Math.hypot((dx * ax + dz * az) / 1.05, (-dx * az + dz * ax) / 0.65) / UR.r;
};
const ERIDU = OLD_TELL;
const E = EAST_BRANCH;

// The Euphrates here is the bay scene's river, brought in towards the town by RIVER_IN metres, and its bay, between the
// river and the quay, a third as deep (some 22 m from the bank to the quay, not 64): the quay as it was, the
// bay's shores drawn in to the moved bank. (bayLand.js keeps the bay scene's own)
export const RIVER_IN = 42;
export const eastEdge = (z) => bayEastEdge(z) + RIVER_IN;
export const westEdge = (z) => bayWestEdge(z) + RIVER_IN;
// The bay: a cove of smooth curves, not the cut of straight sides it was. Its back
// rounded under the town; on the north a low spit of sand running out to the river and hooking round at its tip,
// so the mouth opens to the south-west; the south shore sweeping out to the river longer and gentler. Drawn through
// these points (in the river at both ends) as a centripetal Catmull-Rom curve, closed
const BAY_KEYS = [
  [-66, -12], [-60.5, -10.5], [-57.2, -8.2], [-55, -10.2], [-51.5, -11.2], [-47, -9.8], [-42.5, -6.2], [-39.2, -1.5],
  [-37.4, 4], [-37, 10], [-37.6, 16], [-39.8, 21], [-44.2, 25.2], [-49.5, 28.4], [-54.5, 30.4], [-59, 31], [-66, 30.5],
];
export const BAY = (() => {
  const P = BAY_KEYS, n = P.length, out = [];
  for (let i = 0; i < n; i++) {
    const p = [P[(i - 1 + n) % n], P[i], P[(i + 1) % n], P[(i + 2) % n]];
    const t = [0];
    for (let k = 1; k < 4; k++) t.push(t[k - 1] + Math.hypot(p[k][0] - p[k - 1][0], p[k][1] - p[k - 1][1]) ** 0.5);
    const lerp = (a, b, ta, tb, u) => a.map((v, k) => ((tb - u) * v + (u - ta) * b[k]) / (tb - ta));
    for (let s = 0; s < 6; s++) {
      const u = t[1] + ((t[2] - t[1]) * s) / 6;
      const a1 = lerp(p[0], p[1], t[0], t[1], u), a2 = lerp(p[1], p[2], t[1], t[2], u), a3 = lerp(p[2], p[3], t[2], t[3], u);
      const b1 = lerp(a1, a2, t[0], t[2], u), b2 = lerp(a2, a3, t[1], t[3], u);
      out.push(lerp(b1, b2, t[1], t[2], u));
    }
  }
  return out;
})();
// how far inside the bay's outline (negative: outside); far from it, only that it is well outside
export const baySigned = (x, z) => (x > -76 && x < -27 && z > -22 && z < 41 ? polySigned(x, z, BAY) : -20);
export { QUAY };

// the Euphrates' islands: bars of silt the river has laid down, long along its flow, low (half a metre over the
// water), their shores shelving into shallows where the reeds stand. z: where; off: from the river's middle;
// len, wid: their size (m)
export const ISLANDS = [
  { z: 62, off: -22, len: 36, wid: 9 },      // (across from the bay, by the far bank: in the view from the quay)
  { z: 150, off: -8, len: 78, wid: 18 },
  { z: -150, off: 9, len: 96, wid: 21 },
  { z: 370, off: 5, len: 130, wid: 26 },
  { z: -470, off: -11, len: 84, wid: 17 },
  { z: 640, off: -4, len: 110, wid: 22 },
].map((o) => ({ ...o, x: (eastEdge(o.z) + westEdge(o.z)) / 2 + o.off }));
// how far in an island a point is: 0 at its middle, 1 at its (ragged) shore
export function islandAt(x, z) {
  let best = Infinity;
  for (const o of ISLANDS) {
    const dx = (x - o.x) / (o.wid / 2), dz = (z - o.z) / (o.len / 2);
    if (Math.abs(dx) > 2 || Math.abs(dz) > 2) continue;
    const r = Math.hypot(dx, dz) / (1 + (fbm(x * 0.08, z * 0.08, 2, 61) - 0.5) * 0.5);
    best = Math.min(best, r);
  }
  return best;
}

// the land before the water is cut into it
function land(x, z) {
  const e = eastEdge(z), w = westEdge(z);
  let h;
  if (x > e - 20) {
    // the east bank: a low levee, then the plain, lifting a little again to the east branch's levees; the tell
    h = 0.9 + 0.25 * smooth(0, 40, x - e);
    h += (fbm(x * 0.008, z * 0.008, 3, 4) - 0.5) * 0.7 * smooth(60, 140, x);
    const de = Math.abs(x - E.x(z)) - E.half;
    if (de < 70) h += 0.6 * smooth(70, 4, de);
    // (the whole of the mound and its banks: east to the temple terrace's edge at 134 and south to the outer court's
    // at 119, and their banks beyond)
    if (x > -40 && x < 160 && z > -80 && z < 152) h = Math.max(h, moundY(x, z, h));
  } else if (x < w + 20) {
    // the far bank: a levee with its reeds and palms, falling gently to the fields behind; kilometres off the
    // steppe, rising a little, then the desert's edge and its low dunes
    const d = w - x;
    h = 0.8 - 0.5 * smooth(50, 200, d) + 0.8 * smooth(2600, 4200, d);
    const rise = smooth(4300, 6000, d);
    if (rise > 0) {
      const u = (x + z) * 0.7071 + (fbm(x * 0.0015, z * 0.0015, 2, 21) - 0.5) * 900;
      h += rise * (1.5 + 3.5 * (0.5 + 0.5 * Math.sin((u * Math.PI * 2) / 240)) ** 2.2);
    }
    const r = Math.hypot(x - ERIDU.x, z - ERIDU.z);
    if (r < 400) h += 3 * smooth(400, 0, r);
  } else h = -2;
  return h;
}

// the ground's height anywhere
export function heightAt(x, z) {
  let h = land(x, z);
  // the town: its lanes, square, belvedere and garden terrace
  if (x > -45 && x < 105 && z > -80 && z < 90) h = townGround(x, z, h);
  // the Euphrates' channel: from either bank a shelf of shallows (a few metres to ten wide, where the reeds stand
  // in the water), then down into the channel; its islands rising out of it
  const e = eastEdge(z), w = westEdge(z);
  if (x < e + 2 && x > w - 2) {
    const d = Math.min(e - x, x - w), sw = 3 + 8 * fbm(z * 0.02, x > (e + w) / 2 ? 1 : 2, 2, 5);
    const shelf = -0.4 - 0.25 * fbm(x * 0.1, z * 0.1, 2, 6);
    h = d < 2 ? h + (shelf - h) * smooth(-1.5, 2, d) : shelf + (-2.4 - shelf) * smooth(sw, sw + 8, d);
    const r = islandAt(x, z);
    if (r < 1.6) h = Math.max(h, h + (0.35 + 0.35 * fbm(x * 0.05, z * 0.05, 2, 62) - h) * smooth(1.6, 0.55, r));
  }
  // the bay: shelving gently on its open shores; on its town side, where the quay's wall of fired brick stood,
  // a bank of trodden earth and silt from the town's foot (QUAY_Y) down into the water, its edge wandering, the
  // water reaching some 2.5 m out from where the wall's face was
  if (x < -25 && x > -75 && z > -25 && z < 40) {
    const sd = baySigned(x, z);
    const bed = -0.3 - 1.5 * smooth(0, 16, sd);
    if (sd > -7) {
      if (sd > 0) h = Math.min(h, bed);
      else h = h > 0.15 ? h + (0.15 - h) * smooth(-7, 0, sd) : h;
    }
    const q = polyDist(x, z, QUAY);
    if (q < 11) {
      const s = sd + (fbm(x * 0.12, z * 0.12, 2, 71) - 0.5) * 1.6, top = Math.max(h, QUAY_Y);
      const bank = s < 4 ? top + (-0.5 - top) * smooth(-0.5, 4, s) : -0.5 + (Math.min(bed, -0.5) + 0.5) * smooth(4, 10, s);
      h += (bank - h) * smooth(11, 7, q);
    }
  }
  // the east branch, and the canal led off it
  if (x > 200) {
    const de = Math.abs(x - E.x(z));
    if (de < E.half + 6) h += (-2.6 - h) * smooth(E.half + 2, E.half - 8, de);
  }
  if (x > 85 && z > -90 && z < -30) {
    const dc = polyDist(x, z, CANAL);
    if (dc < 6) h += (-0.9 - h) * smooth(4.2, 2.6, dc);
  }
  return h;
}

// how deep the water stands here (negative: dry)
export function waterDepth(x, z) {
  const wet = (x < eastEdge(z) + 1 && x > westEdge(z) - 1) || baySigned(x, z) > -1;
  return wet ? WATER - heightAt(x, z) : -1;
}

// a grid whose spacing grows away from the town: 1 m over the mound and the quay; finer again (bands) where the
// east branch runs, so its banks are not cut into saw teeth
function axis(lo, hi, edge, band = null) {
  const out = [];
  for (let v = lo; v <= hi; v += 1) out.push(v);
  const grow = (from, sign) => {
    const more = [];
    let v = from, step = 1;
    while (Math.abs(v) < edge) {
      const inBand = band && v * sign > 0 && band(v);
      step = Math.min(step * 1.07, inBand ? inBand : Math.abs(v) < 900 ? 22 : Math.abs(v) < 3000 ? 60 : Math.abs(v) < 8000 ? 200 : 600);
      v += sign * step;
      more.push(Math.max(-edge, Math.min(edge, v)));
    }
    return more;
  };
  return [...grow(lo, -1).reverse(), ...out, ...grow(hi, 1)];
}

// the fields on the plain between the town and the east branch, early in the autumn: some watered for the sowing,
// some ploughed (both darker, damp), the rest stubble or fallow (the plain's own colour). Low bunds between them
export const FIELDS = [];
{
  const rng = makeRng(91);
  for (let z = -420; z < 420;) {
    const d = 30 + rng() * 40;
    for (let x = 110; x < 360;) {
      const w = 35 + rng() * 55, f = { x0: x + 1.5, x1: x + w - 1.5, z0: z + 1.5, z1: z + d - 1.5 };
      x += w;
      if (f.x1 > E.x(f.z0) - E.half - 25 || f.x1 > E.x(f.z1) - E.half - 25) break;
      if ([[f.x0, f.z0], [f.x1, f.z0], [f.x0, f.z1], [f.x1, f.z1]].some(([px, pz]) => polyDist(px, pz, CANAL) < 9 || inMoundWas(px, pz, -30))) continue;
      const r = rng();
      f.wet = r < 0.3 ? 0.75 : r < 0.62 ? 0.4 : 0;
      if (f.wet) FIELDS.push(f);
    }
    z += d;
  }
}

// The plain's canals out beyond the walk, led off either river's banks: each some kilometres long, bending a
// little, now and then a branch off it. The fields lie in long strips back from them (shade.js farFields), palms
// along their banks (farLand.js). Each up to four points
export const FAR_CANALS = [];
{
  const rng = makeRng(611);
  const canal = (x, z, a, len, turn, n = 3) => {
    const pts = [[x, z]];
    for (let i = 0; i < n; i++) {
      a += (rng() - 0.5) * turn;
      x += (Math.cos(a) * len) / n;
      z += (Math.sin(a) * len) / n;
      pts.push([x, z]);
    }
    FAR_CANALS.push(pts);
    return { pts, a };
  };
  const branch = (c) => {
    if (rng() > 0.65) return;
    const [x, z] = c.pts[1 + Math.floor(rng() * 2)];
    canal(x, z, c.a + (rng() < 0.5 ? -1 : 1) * (0.9 + rng() * 0.5), 700 + rng() * 900, 0.3, 2);
  };
  // west of the Euphrates, heading out west (one straight across from the town, in the view over the river, on to
  // Ur: the eye follows its palms there)
  branch(canal(westEdge(120) - 4, 120, Math.atan2(UR.z - 120, UR.x - westEdge(120)), Math.hypot(UR.x - westEdge(120), UR.z - 120) - UR.r * 0.95, 0.08));
  for (let z = -6500; z < 8000; z += 1100 + rng() * 700) {
    if (Math.abs(z - 120) < 500) continue;
    branch(canal(westEdge(z) - 4, z, Math.PI + (rng() - 0.5) * 0.7, 2000 + rng() * 1600, 0.5));
  }
  // east of the east branch, heading out east
  for (let z = -5000; z < 7000; z += 1300 + rng() * 800) branch(canal(E.x(z) + E.half + 4, z, (rng() - 0.5) * 0.8, 1800 + rng() * 1800, 0.5));
  // between the rivers, north and south of the walk: off the Euphrates' east bank towards its east branch
  for (let z = -4500; z < 7000; z += 900 + rng() * 600) {
    if (z > -1300 && z < 900) continue;
    const x0 = eastEdge(z) + 4, len = E.x(z) - E.half - 40 - x0;
    if (len > 500) canal(x0, z, (rng() - 0.5) * 0.3, len, 0.15, 2);
  }
  // (a canal led into Ur's mound ends at its wall; one led off from inside it is not dug)
  for (let i = FAR_CANALS.length - 1; i >= 0; i--) {
    const pts = FAR_CANALS[i], R = 1.12;
    if (inUr(...pts[0]) < R) { FAR_CANALS.splice(i, 1); continue; }
    const k = pts.findIndex(([x, z]) => inUr(x, z) < R);
    if (k < 0) continue;
    let [ax, az] = pts[k - 1], [bx, bz] = pts[k];
    for (let j = 0; j < 20; j++) {
      const mx = (ax + bx) / 2, mz = (az + bz) / 2;
      if (inUr(mx, mz) < R) [bx, bz] = [mx, mz]; else [ax, az] = [mx, mz];
    }
    pts.length = k;
    pts.push([ax, az]);
  }
  FAR_CANALS.length = Math.min(FAR_CANALS.length, MAX_CANALS);
}
// how much of the plain is farmed here (0 round the walk, on the banks, the steppe and the desert)
export function farmAt(x, z) {
  // (on this side the plain's own fields, FIELDS; across the river, beyond its palms, the fields begin at once)
  const e = eastEdge(z), w = westEdge(z), n = fbm(x * 0.002, z * 0.002, 2, 81) - 0.5;
  const kTown = x < w ? 1 : smooth(430, 700, Math.hypot(x - 40, z - 20));
  if (kTown <= 0) return 0;
  let k = 0;
  if (x < w) {
    const d = w - x;
    k = smooth(90, 170, d) * (1 - smooth(2300 + n * 900, 3000 + n * 900, d));
    k = Math.max(k, smooth(UR.r * 2.6, UR.r * 1.4, Math.hypot(x - UR.x, z - UR.z)));   // (and all round Ur)
  } else if (x > e) {
    const de = x - E.x(z);
    if (de < 0) k = smooth(110, 190, x - e) * smooth(E.half + 30, E.half + 90, -de);
    else k = smooth(E.half + 50, E.half + 120, de) * (1 - smooth(5000 + n * 1500, 6500 + n * 1500, de));
  }
  return k * kTown;
}

// how wet, salty or sandy the ground is (shade.js ROCKY's zone)
function zoneAt(x, z, h) {
  const e = eastEdge(z), w = westEdge(z);
  let near = Math.min(Math.abs(x - e), Math.abs(x - w), Math.max(-baySigned(x, z), 0));
  if (x < e && x > w) near = Math.min(near, h < 0.6 ? 0 : 5);   // (the islands: damp silt all over)
  if (x > 200) near = Math.min(near, Math.abs(Math.abs(x - E.x(z)) - E.half));
  if (x > 85 && z > -90 && z < -30) near = Math.min(near, Math.abs(polyDist(x, z, CANAL) - 3));
  let wet = smooth(2.2, 0.2, near) * smooth(0.8, 0.2, h - WATER);
  if (x > 80 && x < 400) for (const f of FIELDS) if (x > f.x0 && x < f.x1 && z > f.z0 && z < f.z1) wet = Math.max(wet, f.wet);
  const d = w - x;
  // (salt on the steppe beyond the fields, in patches)
  const salt = 0.36 * smooth(2600, 3000, d) * (1 - smooth(3900, 4400, d));
  // (grass over the banks: either side of the river, some sixty metres back from the water, thinning; not in the
  // town, on the quay or on the salt; as a negative salt, shade.js)
  let grass = 0;
  if (salt < 0.01 && h > 0.05) {
    const dw = Math.min(Math.abs(x - e), Math.abs(x - w));
    grass = smooth(75, 20, dw) * (0.55 + 0.45 * fbm(x * 0.02, z * 0.02, 2, 33));
    if (x > -45 && x < 140 && z > -80 && z < 110 && (inMound(x, z, -6) || polyDist(x, z, QUAY) < 9)) grass = 0;
  }
  // (the desert's sand; where there is none, a negative sand: how much is farmed, shade.js farFields)
  const sand = smooth(4400, 5600, d);
  return [wet, salt > 0.01 ? salt : -grass, sand > 0.001 ? sand : -farmAt(x, z)];
}

// a strip of water along a line of (x, z) points with a half width at each, cut across into `cols`
function strip(line, cols, flowOf, speed) {
  const pts = [], ix = [], S = cols + 1;
  for (const { x, z, nx, nz, half } of line) for (let k = 0; k <= cols; k++) { const u = -1 + (2 * k) / cols; pts.push([x + nx * u * half, z + nz * u * half]); }
  for (let r = 0; r < line.length - 1; r++) {
    for (let k = 0; k < cols; k++) {
      const a = r * S + k;
      ix.push(a, a + S, a + S + 1, a, a + S + 1, a + 1);
    }
  }
  return waterMesh(pts, ix, flowOf, speed, heightAt);
}

// floors: level floors laid over the ground ({x0, x1, z0, z1, y, n: the way their open front faces}, the floor's
// body hiding what is under it). The mesh's points under one kept well below it, and those under the house behind
// it below it: the mesh drawn between a point under it and one on the slope round it rose through it by its walls.
// The points round it in the open (the lane before it, the ground beside it) as they are
export function buildHillLand(scene, { floors = [] } = {}) {
  const backs = floors.map((f) => ({
    x0: f.n.x > 0.5 ? f.x0 - 1 : f.x0, x1: f.n.x < -0.5 ? f.x1 + 1 : f.x1,
    z0: f.n.z > 0.5 ? f.z0 - 1 : f.z0, z1: f.n.z < -0.5 ? f.z1 + 1 : f.z1, y: f.y,
  }));
  const inR = (r, x, z) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
  const under = (x, z, h) => {
    floors.forEach((f, i) => { if (inR(f, x, z)) h = Math.min(h, f.y - 0.6); else if (inR(backs[i], x, z)) h = Math.min(h, f.y); });
    return h;
  };
  const group = new THREE.Group();
  // the ground
  const xs = axis(-125, 140, FAR, (v) => (v > 140 && v < 700 ? 6 : 0));
  const zs = axis(-75, 110, FAR, (v) => (Math.abs(v) < 520 ? 7 : 0));
  const nx = xs.length, nz = zs.length;
  const pos = new Float32Array(nx * nz * 3), zone = new Float32Array(nx * nz * 3);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      // (round the little square, under the walls, the mesh's own: hillPlan.js meshGround)
      const k = (j * nx + i) * 3, h = under(xs[i], zs[j], meshGround(xs[i], zs[j], heightAt(xs[i], zs[j])));
      pos.set([xs[i], h, zs[j]], k);
      zone.set(zoneAt(xs[i], zs[j], h), k);
    }
  }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
  let n = 0;
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i;
      idx.set([a, a + nx, a + 1, a + 1, a + nx, a + nx + 1], n);
      n += 6;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('zone', new THREE.BufferAttribute(zone, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeVertexNormals();
  const groundMat = lightMat({ kind: 'ground' });
  // (its fine part, round the town and the bay, in tiles 60 m across, so the view and the shadow maps leave out
  // those they do not reach; the plain beyond in tiles 1.5 km across)
  const parts = splitTiles(g, 60, [-130, -80, 140, 110]).flatMap((p) => (p.boundingSphere.radius > 200 ? splitTiles(p, 1500) : [p]));
  for (const part of parts) {
    const ground = new THREE.Mesh(part, groundMat);
    ground.receiveShadow = ground.castShadow = true;
    group.add(ground);
  }
  // (the far canals, for the ground's fields: shade.js farFields)
  FAR_CANALS.forEach((pts, i) => {
    const q = [0, 1, 2, 3].map((k) => pts[Math.min(k, pts.length - 1)]), xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
    shared.uCanalP.value[2 * i].set(q[0][0], q[0][1], q[1][0], q[1][1]);
    shared.uCanalP.value[2 * i + 1].set(q[2][0], q[2][1], q[3][0], q[3][1]);
    shared.uCanalBox.value[i].set(Math.min(...xs) - 1100, Math.min(...zs) - 1100, Math.max(...xs) + 1100, Math.max(...zs) + 1100);
  });
  shared.uCanalN.value = FAR_CANALS.length;

  // the Euphrates and its bay, one sheet of water (as in the bay scene): a strip along the river, each row near the
  // bay running on east over it
  {
    const bayEast = (z) => {
      let m = -Infinity;
      for (let i = 0; i < BAY.length; i++) {
        const [xa, za] = BAY[i], [xb, zb] = BAY[(i + 1) % BAY.length];
        if ((za <= z) !== (zb <= z)) m = Math.max(m, xa + ((z - za) / (zb - za)) * (xb - xa));
      }
      return m;
    };
    const pts = [], ix = [], L = 40, Eb = 48, S = L + Eb + 1;
    let rows = 0;
    for (let z = -FAR; z <= FAR; z += Math.abs(z) < 45 ? 1 : Math.abs(z) < 400 ? 3 : Math.abs(z) < REACH ? 12 : Math.abs(z) < 5000 ? 60 : 250) {
      const w0 = westEdge(z) - 2, e0 = eastEdge(z) + 2, e1 = Math.max(e0, bayEast(z) + 3);
      for (let k = 0; k <= L; k++) pts.push([w0 + ((e0 - w0) * k) / L, z]);
      for (let k = 1; k <= Eb; k++) pts.push([e0 + ((e1 - e0) * k) / Eb, z]);
      rows++;
    }
    for (let r = 0; r < rows - 1; r++) {
      for (let k = 0; k < S - 1; k++) {
        const a = r * S + k;
        ix.push(a, a + S, a + S + 1, a, a + S + 1, a + 1);
      }
    }
    // (the current some 0.9 m/s in the channel; in the bay, off it, only a slow drift)
    group.add(waterMesh(pts, ix, (x, z) => [x - (eastEdge(z) + westEdge(z)) / 2, z + REACH, 1 - 0.85 * smooth(eastEdge(z) - 2, eastEdge(z) + 12, x)], 0.9, heightAt));
  }
  // the east branch: a strip along its winding middle
  {
    const line = [];
    for (let z = -FAR; z <= FAR; z += Math.abs(z) < 500 ? 8 : Math.abs(z) < REACH ? 24 : 80) {
      const dx = E.x(z + 1) - E.x(z - 1), l = Math.hypot(dx, 2);
      line.push({ x: E.x(z), z, nx: 2 / l, nz: -dx / l, half: E.half + 3 });
    }
    group.add(strip(line, 16, (x, z) => [x - E.x(z), z + REACH], 0.4));
  }
  // the canal
  {
    const line = [];
    for (let i = 0; i < CANAL.length - 1; i++) {
      const [ax, az] = CANAL[i], [bx, bz] = CANAL[i + 1], len = Math.hypot(bx - ax, bz - az);
      for (let t = 0; t < len; t += 3) {
        const x = ax + ((bx - ax) * t) / len, z = az + ((bz - az) * t) / len;
        line.push({ x, z, nx: -(bz - az) / len, nz: (bx - ax) / len, half: 3.6 });
      }
    }
    line.push({ x: CANAL.at(-1)[0] + 6, z: CANAL.at(-1)[1], nx: 0, nz: 1, half: 3.6 });
    group.add(strip(line, 4, (x, z) => [polyDist(x, z, CANAL), x], 0.25));
  }
  // the old village's tell
  for (const m of tellMesh(OLD_TELL.x, OLD_TELL.z, OLD_TELL.r, OLD_TELL.h, 31, false, heightAt)) group.add(m);
  scene.add(group);
  return { group };
}
