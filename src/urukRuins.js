// What is left of an Uruk temple south of the quay, a thousand years older than the town, after the pillar hall of
// Eanna: two rows of four great round pillars, each as thick as a room (2.5 m
// across: the pillars of Eanna were 2.6), wide apart, covered in a mosaic of clay cones, red, black and white, in
// zigzags and diamonds; beyond them a court, and across its far end the temple's front: a wall of buttresses and
// stepped niches, half-columns of mosaic on them (as on the walls of Eanna), a dado of mosaic in the niches, its
// door between two towers. No platform and no stair: the old floor is under the ground now, the pillars and the
// wall come up out of it with sand drifted round their feet. What stands is broken off at uneven heights, low near
// the quay and higher on the way in. One of the first pillars has fallen, north-east, in one piece. The cones are lost from
// the tops down (the weather), a row at a time, and kept low down (the sand covered them), up to an edge that steps
// along their rows; cones and brick fallen out round the feet.
// The hall runs along the river, close by its water.
import * as THREE from 'three';
import { makeKit } from './houseKit.js';
import { coneHead } from './buildingDetails.js';
import { makeRng, vnoise } from './rand.js';
import { heightAt } from './hillLand.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;

// the hall's frame: u along the colonnade (south, along the river's line), v across it (east, away from the
// water); its first pillar on the river side, by the bay's shore (towards the river and
// a little back from the quay, for the wider hall)
const O = { x: -40.3, z: 23.0 }, U = [0.05, 0.99875], W = [0.99875, -0.05];
const YAW = Math.atan2(-W[1], W[0]);   // (a box's x along v, its z along u)
export const ruinAt = (u, v) => [O.x + U[0] * u + W[0] * v, O.z + U[1] * u + W[1] * v];
const frameOf = (x, z) => [(x - O.x) * U[0] + (z - O.z) * U[1], (x - O.x) * W[0] + (z - O.z) * W[1]];

// the pillars (h what stands above the ground; d its mosaic: the first of the three it alternates in bands);
// near the quay low, the tallest half-way; 2.4 m clear between them along the rows, 5.8 m across (the way between)
const PR = 1.25;
export const PILLARS = [
  { u: 0, v: 0, h: 3.9, d: 0 }, { u: 4.9, v: 0, h: 8.1, d: 1 }, { u: 9.8, v: 0, h: 12.9, d: 2 }, { u: 14.7, v: 0, h: 9.3, d: 0 },
  { u: 0, v: 8.3, h: 1.05, d: 2 }, { u: 4.9, v: 8.3, h: 5.1, d: 0 }, { u: 9.8, v: 8.3, h: 10.2, d: 1 }, { u: 14.7, v: 8.3, h: 6.9, d: 2 },
];
// the one fallen, from its stump (the first on the east), north-east, towards the houses (FALL off north):
// in one piece, from a to b metres out from the stump along that line, its foot end on the
// rubble by the stump, its head end sunk in the sand
const FALL = 0.5;
const FALLEN = { a: 1.4, b: 6.0, d: 2 };
// the temple front: its face to the court at uF (its buttresses before it, its niches back in it), its back at uB;
// the door's middle at vc, on the way between the pillars. Its pieces along it: [v0, v1, kind, height]: the door's
// reveals stepping back to it (r2, r1), the towers either side of it, then niches and buttresses out to the width
// of the hall; the west side (to the river) stands higher
const FRONT = { uF: 19.0, uB: 20.4, vc: 4.15 };
// (the door narrow, the towers drawn in by it)
const PIECES = [
  [3.35, 3.55, 'r1', 9.0], [3.15, 3.35, 'r2', 9.5], [1.65, 3.15, 'tower', 10.2], [0.55, 1.65, 'niche', 6.8], [-0.25, 0.55, 'butt', 5.0], [-1.35, -0.25, 'niche', 2.8], [-2.15, -1.35, 'butt', 1.2],
  [4.75, 4.95, 'r1', 6.6], [4.95, 5.15, 'r2', 7.1], [5.15, 6.65, 'tower', 7.8], [6.65, 7.75, 'niche', 4.6], [7.75, 8.55, 'butt', 3.0], [8.55, 9.65, 'niche', 1.6], [9.65, 10.2, 'butt', 0.8],
];
const FACE = { r1: 0.6, r2: 0.3, tower: -0.45, niche: 0.25, butt: -0.25 };

// near anything of the ruin (for the scene's plants): the pillars, the fallen drums, the court and the front
const RECTS = [[-1.8, 16.5, -1.8, 10.1], [-6.0, -0.5, 7.0, 12.8], [16.5, 20.8, -2.3, 10.3]];
// in the view south through the temple's door (kept clear of the groves' palms: the hill and its temple beyond)
export function inDoorView(x, z) {
  const [u, v] = frameOf(x, z);
  return u > FRONT.uB && u < 160 && Math.abs(v - FRONT.vc) < 1.6 + (u - FRONT.uB) * 0.09;
}
export function inRuinsGround(x, z, pad = 0) {
  const [u, v] = frameOf(x, z);
  return RECTS.some(([u0, u1, v0, v1]) => u > u0 - pad && u < u1 + pad && v > v0 - pad && v < v1 + pad);
}

export function buildUrukRuins(scene) {
  const rng = makeRng(3300);
  const kit = makeKit({ rng, heightAt, openAt: () => false });
  const { get, box } = kit;
  const group = new THREE.Group(); group.name = 'Uruk • ruins south of the quay'; scene.add(group);
  const SINK = 0.6;   // (how far the walls and pillars go on down under the ground)
  // a box in the frame, from u0 to u1, v0 to v1, y0 to y1
  const fbox = (kind, u0, u1, v0, v1, y0, y1) => {
    const [x, z] = ruinAt((u0 + u1) / 2, (v0 + v1) / 2);
    box(kind, x, (y0 + y1) / 2, z, v1 - v0, y1 - y0, u1 - u0, YAW);
  };
  const at = (u, v, y) => { const [x, z] = ruinAt(u, v); return V(x, y, z); };
  const toHall = V(-U[0], 0, -U[1]);   // (facing north, back to the quay)

  const gAt = heightAt;

  // the mosaic's colours: zigzags, diamonds, stepped triangles (i round, j up), each pillar alternating them in
  // bands, a dark ring between
  const KINDS = ['madder', 'dark', 'lime'];
  const pattern = (d, i, j) => {
    if (d === 0) { const v = (j + Math.abs((i % 8) - 4)) % 8; return v < 2 ? 0 : v < 4 ? 1 : 2; }
    if (d === 1) { const d2 = Math.abs((i % 8) - 4) + Math.abs((j % 8) - 4); return d2 < 2 ? 0 : d2 < 3 ? 1 : d2 > 5 ? 0 : 2; }
    const v = (i + j) % 6, w2 = (i - j + 600) % 6; return v < 2 ? 1 : w2 < 2 ? 0 : 2;
  };
  const colour = (d, i, j) => {
    const band = Math.floor(j / 22), jj = j % 22;
    if (jj >= 20) return 'dark';
    return KINDS[pattern((d + band) % 3, i, jj)];
  };
  // has the mosaic come away here? As the Berlin pieces show, it comes away from the top
  // down, a row of cones at a time, the cones packed against each other: what is left stands up to an edge that
  // steps along the rows, up and down as the zigzags go (eight cones to one rise and fall), wandering slowly round
  // (the noise at nx, nz); below it, here and there, a single cone gone. i the cone's place round (or along), j its
  // row, rows how many rows there are to the break, keep the part of them the edge stands at, on the whole
  const gone = (i, j, rows, seed, nx, nz, keep = 0.62) => {
    const edge = rows * (keep + 0.3 * (vnoise(0.5, 0.5, seed + 11) - 0.5) + 0.3 * (vnoise(nx, nz, seed) - 0.5)) + Math.abs((i % 8) - 4);
    return j >= edge || rng() < 0.015;
  };

  // the core where it broke: mud brick laid in mud, the joints the bricks' own colour, so
  // what shows is not bricks but the mass of them, worn: rounded off by the rain, rough, in faint steps where the
  // courses (11 cm) part. In M's frame (axis local y), inside the round: from where the shaft's skin ends at the rim
  // (rimTop(a)) up to a mound `bulge` high in the middle (above the rim's highest: the rain rounds the edges off
  // first), `rough` its unevenness
  const BH = 0.11;
  const mudCore = (M, r, rimTop, { bulge = 0.48, rough = 0.22, seed = 0 } = {}) => {
    const NR = 12, NS = 48, rc = r * 0.86;
    let rimMean = 0;
    for (let j = 0; j < NS; j++) rimMean += rimTop((j / NS) * TAU) / NS;
    // (the rim's own ups and downs only near the rim, the middle its own)
    const H = (rho, a) => {
      const x = Math.cos(a) * rho, z = Math.sin(a) * rho, f = rho / rc;
      const h = rimMean + (rimTop(a) - rimMean) * f * f + bulge * (1 - f * f) + rough * (vnoise(x * 1.6 + 5, z * 1.6, seed) - 0.5) * (1 - f * f);
      // (the courses: the worn surface holding a little at each, and slipping down between)
      const t = h / BH, k = Math.floor(t), step = (k + THREE.MathUtils.smoothstep(t - k, 0.55, 1)) * BH;
      return h + (step - h) * 0.5 * Math.min(1, (1 - f) * 4);
    };
    let low = Infinity;
    for (let j = 0; j < NS; j++) low = Math.min(low, rimTop((j / NS) * TAU));
    const inside = V(0, low - 3, 0).applyMatrix4(M), b = get('earth'), R3 = new THREE.Matrix3().setFromMatrix4(M);
    // (smooth: each point's normal from the surface's slope there, so it reads as worn mud, not facets)
    const Hxz = (x, z) => { const rho = Math.hypot(x, z), a = Math.atan2(z, x); return rho >= rc ? rimTop(a) : H(rho, a); };
    const idx = [];
    for (let i = 0; i <= NR; i++) {
      idx.push([]);
      for (let j = 0; j < (i ? NS : 1); j++) {
        const a = (j / NS) * TAU, rho = rc * i / NR, x = Math.cos(a) * rho, z = Math.sin(a) * rho, e = 0.04;
        const y = i === NR ? rimTop(a) : H(rho, a);
        const n = V(-(Hxz(x + e, z) - Hxz(x - e, z)) / (2 * e), 1, -(Hxz(x, z + e) - Hxz(x, z - e)) / (2 * e)).applyMatrix3(R3).normalize();
        const p = V(x, y, z).applyMatrix4(M);
        idx[i].push([b.vert(p.x, p.y, p.z, n.x, n.y, n.z), p]);
      }
    }
    // (each triangle wound to face out, away from the shaft's inside)
    const tri = (A, B, C) => {
      const nrm = new THREE.Vector3().subVectors(B[1], A[1]).cross(new THREE.Vector3().subVectors(C[1], A[1]));
      if (nrm.dot(new THREE.Vector3().subVectors(A[1], inside)) < 0) b.tri(A[0], C[0], B[0]); else b.tri(A[0], B[0], C[0]);
    };
    for (let j = 0; j < NS; j++) {
      const j1 = (j + 1) % NS;
      tri(idx[0][0], idx[1][j], idx[1][j1]);
      for (let i = 1; i < NR; i++) { tri(idx[i][j], idx[i + 1][j], idx[i + 1][j1]); tri(idx[i][j], idx[i + 1][j1], idx[i][j1]); }
    }
    // (round it, out to the skin, the plaster the cones were set in, broken off level with the rim: the break in two
    // tones, the plaster and the core, and no cones drawn in it)
    const pl = get('plaster'), Q = (a, rho) => V(Math.cos(a) * rho, rimTop(a), Math.sin(a) * rho).applyMatrix4(M);
    for (let j = 0; j < NS; j++) {
      const a0 = (j / NS) * TAU, a1 = ((j + 1) / NS) * TAU;
      pl.face4(Q(a0, rc), Q(a0, r * 0.97), Q(a1, r * 0.97), Q(a1, rc), inside);
    }
  };

  // a shaft of mosaic round an axis: M places its frame (axis = local y, its foot at local 0); r radius; top(a)
  // the broken edge's height at angle a; arc the part of the round it has (a half-column has half); d the mosaic.
  // The clay plaster the cones were pressed into shows between them and where they are lost; at the break, the
  // brick core
  const shaft = (M, r, top, { arc = [0, TAU], d = 0, seed = 0, cap = true, foot = -SINK, under = 0.04, worn = {} } = {}) => {
    const R = new THREE.Matrix3().setFromMatrix4(M), w = (x, y, z) => V(x, y, z).applyMatrix4(M);
    const nw = (x, z) => V(x, 0, z).applyMatrix3(R).normalize();
    const side = get('plaster'), core = get('brick');
    const full = arc[1] - arc[0] > 6, S = Math.max(8, Math.round(36 * (arc[1] - arc[0]) / TAU));
    const rim = [];
    for (let k = 0; k <= S; k++) {
      const a = arc[0] + (arc[1] - arc[0]) * k / S, c = Math.cos(a), s = Math.sin(a), n = nw(c, s);
      const b = w(r * c, foot, r * s), t = w(r * 0.97 * c, top(a), r * 0.97 * s);
      const j = side.vert(b.x, b.y, b.z, n.x, n.y, n.z);
      side.vert(t.x, t.y, t.z, n.x, n.y, n.z);
      if (k) { side.tri(j - 2, j - 1, j); side.tri(j, j - 1, j + 1); }
      rim.push(t);
    }
    // (the cones: N round (a multiple of 24, so the patterns close), rows offset by half)
    const N = Math.max(24, Math.round(TAU * r / 0.1 / 24) * 24), cell = TAU * r / N, rowH = cell * 0.92;
    if (cap) {
      let mean = 0;
      for (let k = 0; k < S; k++) mean += top(arc[0] + (arc[1] - arc[0]) * k / S) / S;
      if (full && r > 0.8) {
        // (the break: the worn mud-brick core)
        mudCore(M, r, top, { seed: seed + 3, ...worn });
      } else {
        // (a half-column's break: slumped brick, a low dome)
        const c = w(0, mean + 0.06 + r * 0.05, 0), below = w(0, mean - 1, 0);
        for (let k = 0; k < S; k++) core.face3(c, rim[k], rim[k + 1], below);
        if (!full) core.face3(c, rim[S], rim[0], below);
      }
    }
    // the cones, row on row
    for (let j = 0; ; j++) {
      const y = 0.06 + j * rowH;
      if (y > Math.max(...[0, 0.25, 0.5, 0.75].map((f) => top(arc[0] + (arc[1] - arc[0]) * f)))) break;
      for (let i = 0; i < N; i++) {
        const a = (i + (j % 2) * 0.5) / N * TAU;
        let rel = a - arc[0]; rel -= Math.floor(rel / TAU) * TAU;
        if (rel > arc[1] - arc[0]) continue;
        const brk = top(a) - 0.1 - 0.35 * vnoise(a * 3, 0, seed + 7);
        if (y > brk) continue;
        if (gone(i, j, brk / rowH, seed, Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8)) continue;
        const c = Math.cos(a), s = Math.sin(a), p = w(c * (r + 0.012), y, s * (r + 0.012));
        if (p.y < gAt(p.x, p.z) + under) continue;
        coneHead(get(colour(d, i, j)), p, nw(c, s), cell * 0.48, 0.034);
      }
    }
  };
  // cones pressed into a flat face (a dado, a panel): from p0 along `along` for len, up from y0 to y1 (above the
  // ground at each), facing n
  const coneFace = (p0, along, len, y0, y1, n, seed, d = 0) => {
    const cell = 0.1;
    for (let i = 0; i * cell < len; i++) {
      const p = p0.clone().addScaledVector(along, (i + 0.5) * cell), g = gAt(p.x, p.z);
      for (let j = 0; ; j++) {
        const y = y0 + (j + (i % 2) * 0.5) * cell * 0.92;
        if (y > y1 - 0.06) break;
        if (gone(i, j, (y1 - y0) / (cell * 0.92), seed, i * cell * 0.8, 1.7, 0.8)) continue;
        coneHead(get(colour(d, i, j + 4)), V(p.x + n.x * 0.012, Math.max(g, p.y) + y, p.z + n.z * 0.012), n, cell * 0.48, 0.034);
      }
    }
  };
  // sand drifted round a foot: a low skirt sloping out from it
  const drift = (x, z, r, h = 0.3, y = heightAt(x, z)) => {
    const g = new THREE.CylinderGeometry(r + 0.05, r + 1.1, h * 2, 20, 1, true).deleteAttribute('uv');
    get('earth').add(g, new THREE.Matrix4().makeTranslation(x, y - h * 0.55, z));
    g.dispose();
  };
  // rubble: bits of brick and cones fallen out, half in the sand, round a point
  const rubble = (x, z, inner, spread, n) => {
    for (let k = 0; k < n; k++) {
      const a = rng() * TAU, rr = inner + (spread - inner) * Math.sqrt(rng()), px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr, g = gAt(px, pz);
      if (rng() < 0.45) {
        const sy = 0.07 + rng() * 0.1;
        box('brick', px, g + sy * 0.2, pz, 0.16 + rng() * 0.22, sy, 0.12 + rng() * 0.16, rng() * TAU);
      } else {
        const n2 = V(rng() - 0.5, 0.25 + rng() * 0.5, rng() - 0.5).normalize();
        coneHead(get(KINDS[Math.floor(rng() * 3)]), V(px, g + 0.01, pz), n2, 0.04, 0.05);
      }
    }
  };

  // ---- the pillars, up out of the ground ----
  PILLARS.forEach((p, idx) => {
    const [x, z] = ruinAt(p.u, p.v), g = heightAt(x, z), seed = 50 + idx * 11;
    const top = (a) => p.h + (p.h > 1.2 ? 0.22 : 0.05) * Math.sin(a * 2 + idx) + 0.1 * Math.cos(a * 5 + idx * 2);
    shaft(new THREE.Matrix4().makeTranslation(x, g, z), PR, top, { d: p.d, seed });
    drift(x, z, PR, p.h < 1.2 ? 0.22 : 0.32);
    rubble(x, z, PR + 0.15, PR + 1.6, Math.round(8 + p.h * 3));
  });
  // ---- the fallen one: in one piece, half in the sand, its brick core showing at both its broken ends ----
  {
    const st = PILLARS[4], dir = [-Math.cos(FALL), Math.sin(FALL)];
    const [xa, za] = ruinAt(st.u + dir[0] * FALLEN.a, st.v + dir[1] * FALLEN.a), [xb, zb] = ruinAt(st.u + dir[0] * FALLEN.b, st.v + dir[1] * FALLEN.b);
    const A = V(xa, gAt(xa, za) + PR * 0.95, za), B = V(xb, gAt(xb, zb) + PR * 0.72, zb);
    const len = A.distanceTo(B), axis = B.clone().sub(A).normalize();
    const M = new THREE.Matrix4().compose(A, new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), axis), V(1, 1, 1))
      .multiply(new THREE.Matrix4().makeRotationY(rng() * TAU));
    const top = (a) => len + 0.16 * Math.sin(a * 2 + 1) + 0.07 * Math.cos(a * 5);
    // (its breaks fresher than the tops that stand: hardly rounded, rougher)
    const fresh = { bulge: 0.05, rough: 0.34 };
    shaft(M, PR, top, { d: FALLEN.d, seed: 140, foot: 0, under: 0.05, worn: fresh });
    // (its foot end, where it broke from the stump: turned over, so the same core faces out of that end)
    const flip = M.clone().multiply(new THREE.Matrix4().makeRotationX(Math.PI));
    mudCore(flip, PR, () => 0, { seed: 151, ...fresh });
    for (const t of [0.05, 0.5, 0.95]) { const p = A.clone().lerp(B, t); rubble(p.x, p.z, PR + 0.1, PR + 1.9, 14); }
    rubble(xa, za, 0, 1.2, 10);
  }

  // ---- the temple front: its buttresses, niches, towers, worn down to steps at the top ----
  const { uF, uB, vc } = FRONT, [wx, wz] = ruinAt(uF, vc), gW = heightAt(wx, wz);
  // (a broken top: a block or two of brick left standing on it, smaller each)
  const crumble = (u0, u1, v0, v1, y) => {
    for (let k = 0; k < 2; k++) {
      const w = v1 - v0, du = u1 - u0;
      u0 += 0.08 + rng() * du * 0.25; u1 -= 0.08 + rng() * du * 0.25; v0 += rng() * w * 0.3; v1 -= rng() * w * 0.3;
      if (u1 - u0 < 0.3 || v1 - v0 < 0.25) return;
      const y1 = y + 0.18 + rng() * 0.4;
      fbox('brick', u0, u1, v0, v1, y - 0.02, y1);
      y = y1;
    }
  };
  for (const [v0, v1, kind, h] of PIECES) {
    const y1 = gW + h, back = kind === 'tower' ? uB + 0.2 : uB;
    // (its foot below the ground at both its ends: the bank falls away towards the river)
    const y0 = Math.min(heightAt(...ruinAt(uF, v0)), heightAt(...ruinAt(uF, v1)), heightAt(...ruinAt(uB, v0))) - SINK;
    if (kind === 'niche') {
      // (a niche stepped back twice: its sides, its middle further in)
      const m0 = (v0 + v1) / 2 - 0.22, m1 = (v0 + v1) / 2 + 0.22;
      fbox('brick', uF + 0.25, back, v0, m0, y0, y1);
      fbox('brick', uF + 0.25, back, m1, v1, y0, y1);
      fbox('brick', uF + 0.45, back, m0, m1, y0, y1);
      for (const [a, b, f] of [[v0, m0, 0.25], [m0, m1, 0.45], [m1, v1, 0.25]]) {
        coneFace(at(uF + f - 0.002, a, gW), V(W[0], 0, W[1]), b - a, 0.08, Math.min(h - 0.25, 1.6), toHall, 70 + Math.round(v0 * 13), 0);
      }
    } else fbox('brick', uF + FACE[kind], back, v0, v1, y0, y1);
    if (h > 1.2) crumble(uF + FACE[kind], back, v0, v1, y1);
  }
  // half-columns of mosaic: two on each tower's face, one on each buttress's
  const aN = Math.atan2(toHall.z, toHall.x), half = [aN - Math.PI / 2 - 0.1, aN + Math.PI / 2 + 0.1];
  PIECES.forEach(([v0, v1, kind, h], idx) => {
    const cols = kind === 'tower' ? [(v0 + v1) / 2 - 0.42, (v0 + v1) / 2 + 0.42] : kind === 'butt' && h > 1.5 ? [(v0 + v1) / 2] : [];
    cols.forEach((v, k) => {
      const r = kind === 'tower' ? 0.36 : 0.3, hc = kind === 'tower' ? h * 0.72 - k * 0.6 : Math.min(h - 0.3, 3.4);
      const [x, z] = ruinAt(uF + FACE[kind] - 0.002, v);
      shaft(new THREE.Matrix4().makeTranslation(x, gW, z), r, (a) => hc + 0.12 * Math.sin(a * 3 + idx + k), { arc: half, d: (idx + k) % 3, seed: 90 + idx * 5 + k });
      drift(x + toHall.x * 0.3, z + toHall.z * 0.3, r, 0.2);
    });
  });
  // the door: a threshold of stone, and in the corner behind its jamb the stone the door turned on
  fbox('stone', uF + 0.6, uB, vc - 0.6, vc + 0.6, gW - 0.12, gW + 0.07);
  { const p = at(uF + 1.0, vc - 0.45, gW + 0.08); get('stone').add(new THREE.CylinderGeometry(0.2, 0.24, 0.16, 12).deleteAttribute('uv'), new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)); }
  // sand along its foot; brick and cones fallen in the court
  for (let v = -1.9; v < 10.0; v += 1.15) { if (Math.abs(v - vc) < 1.0) continue; const p = at(uF - 0.35, v, 0); drift(p.x, p.z, 0.25, 0.22 + rng() * 0.15); }
  for (const [u, v, n] of [[17.8, 1.4, 14], [17.9, 7.0, 12], [16.9, 4.15, 6], [17.4, -0.9, 8], [17.2, 9.3, 7]]) { const p = at(u, v, 0); rubble(p.x, p.z, 0, 1.4, n); }

  const walkables = kit.meshes(group);
  group.updateMatrixWorld(true);
  return { group, walkables };
}
