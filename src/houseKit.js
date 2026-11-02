// The makings of a house of the river country (shared by the bay's quarter, quarter.js, and the hill town,
// hillTown.js): a plain courtyard house of plastered mud brick grown from a rectangle of the plan (build), and the
// small houses one sees close, built out in detail with their doors shut and dressed (heroBuild); jars, pots,
// cone mosaic, striped cloth. Everything is gathered by kind and made into meshes at the end (meshes).
//
// The plan is the caller's: openAt(x, z) says where a lane or a square is open, doorAt(x, z) where a door may
// open onto one. On a slope (sloped) a house's masses each stand on their own ground, so its roofs step down the
// hill with it, and a house across a steep stretch is built as two or three blocks stepping down it; capAt(h)
// (optional) holds a house's roofs down to a height, maxStoreys(h) its storeys; outAt(x, z) says where a face looks
// out of the town (a few small windows there too); roofBusy(h) how many things are out on its roofs (roofLife).
// A detailed house may have an upper room over the back of its roof, a terrace in front of it and an outside
// stair up to it (heroBuild's upper); its roof is in uppers, for the walk.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Builder, splitTiles } from './geo.js';
import { lodAdd } from './lod.js';
import { lightMat } from './shade.js';
import { WEAVE_N, weaveTexture } from './weaves.js';
import { coneHead, wovenReedMat, clayTablet } from './buildingDetails.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// a jar's profile (as the Blender scene's), turned
export const JAR = new THREE.LatheGeometry([[0.2, 0], [0.35, 0.06], [0.49, 0.4], [0.46, 0.7], [0.3, 0.92], [0.27, 1.02], [0.3, 1.06], [0.3, 1.11], [0, 1.11]]
  .map(([r, h]) => new THREE.Vector2(r, h)), 14).deleteAttribute('uv');
JAR.computeVertexNormals();

// the rain spout: its outside, its inside (faces turned in) and the ring of its lip, the pipe tilted out and down a
// little along +z, so the water runs out of it
const SPOUT = (() => {
  const T = Math.PI / 2 + 0.2, out = new THREE.CylinderGeometry(0.09, 0.11, 0.9, 8, 1, true).rotateX(T).deleteAttribute('uv');
  const inn = new THREE.CylinderGeometry(0.065, 0.085, 0.9, 8, 1, true).rotateX(T).deleteAttribute('uv');
  const ix = inn.index.array;
  for (let i = 0; i < ix.length; i += 3) { const t = ix[i]; ix[i] = ix[i + 2]; ix[i + 2] = t; }
  const nr = inn.attributes.normal;
  for (let i = 0; i < nr.count; i++) nr.setXYZ(i, -nr.getX(i), -nr.getY(i), -nr.getZ(i));
  const lip = new THREE.RingGeometry(0.065, 0.09, 8).rotateX(0.2).translate(0, 0.45 * Math.cos(T), 0.45 * Math.sin(T)).deleteAttribute('uv');
  return [out, inn, lip];
})();

// kinds one walks on and against, and kinds seen from both sides (cloth, reed mats)
export const WALKED = ['whitewash', 'redwash', 'plaster', 'brick', 'trim', 'firedbrick', 'dark', 'stone', 'path', 'wood'];
const THIN = ['straw', 'linen', 'madder', 'indigo', 'saffron'];
// the small things, left out far off: cloth, pots and jars, fruit, bronze
const SMALL = ['linen', 'madder', 'indigo', 'saffron', 'clay', 'buff', 'grape', 'bronze', 'date', 'fruit'];

export function makeKit({ rng, heightAt, openAt, doorAt = openAt, outAt = null, sloped = false, capAt = null, maxStoreys = null, roofBusy = null, sillAt = heightAt }) {
  const B = {}, get = (k, uv = false) => (B[k] ??= new Builder(uv));
  // (cloth that moves in the wind, gathered apart: its vertices carry their flaps)
  const getFlap = (k) => (B[`${k}~flap`] ??= new Builder(false, true));
  const reedMat = (...args) => wovenReedMat(get, ...args);
  // a clay spout throwing the rain off a roof: a pipe, its inside and its lip too (an open tube's far wall was not
  // drawn: one saw through it)
  const spout = (m) => { for (const g of SPOUT) get('clay').add(g, m); };
  const unit = new THREE.BoxGeometry(1, 1, 1).deleteAttribute('uv');
  const box = (kind, cx, cy, cz, sx, sy, sz, yaw = 0) => get(kind).add(unit,
    new THREE.Matrix4().compose(V(cx, cy, cz), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(sx, sy, sz)), { flat: true });
  // a block with rounded edges (hand-plastered walls), sx x sy x sz centred at (cx, cy, cz)
  const wall = (kind, cx, cy, cz, sx, sy, sz, yaw = 0) => {
    const g = new RoundedBoxGeometry(sx, sy, sz, 2, Math.min(0.3, sx / 3, sz / 3)).deleteAttribute('uv');
    get(kind).add(g, new THREE.Matrix4().compose(V(cx, cy, cz), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(1, 1, 1)));
    g.dispose();
  };
  // a house's walls and the parapet round its roof in one piece, as the plaster made them: the outer faces (leaning
  // in by lean, leanX on the sides across x, over the height base..top) carried on up past the roof to the
  // parapet's top (ph over it, p thick), rounded over and down its inner face to the roof, which closes it. Built
  // apart, a parapet set on the walls showed its rounded foot as a line round the house, like a beam.
  // gaps: openings in the parapet down to the roof (a way onto it from beside), each
  // { side: 'x0' | 'x1' | 'z0' | 'z1', a, b }, a..b along that side in the house's own frame (x for a z side)
  // leans: a side's own lean, where it is not the others' (a side standing against another piece of the same house
  // upright, so the two meet in one plane); sharp: corners left square, named by a side ('z1': both its corners) or
  // by the two ('x1z0'), where another piece or a stair's wall runs on from them
  const shell = (kind, cx, cz, yaw, sx, sz, base, top, ph, { p = 0.34, lean = 0, leanX = lean, rim = 0.1, gaps = [], leans = {}, sharp = [] } = {}) => {
    const R = Math.min(0.3, sx / 3, sz / 3), H = top - base, PT = top + ph, K = 3, M = 3;
    const LS = { x0: leanX, x1: leanX, z0: lean, z1: lean, ...leans };
    const CK = ['x1z1', 'x0z1', 'x0z0', 'x1z0'], isSharp = CK.map((k) => sharp.some((s) => s === k || k.includes(s)));
    // its section: [in from the outer face, height, its normal out, its normal up]
    const sec = [[0, base, 1, 0], [0, PT - rim, 1, 0]];
    for (let i = 1; i <= K; i++) { const a = (i / K) * Math.PI / 2; sec.push([rim - rim * Math.cos(a), PT - rim + rim * Math.sin(a), Math.cos(a), Math.sin(a)]); }
    for (let i = 0; i <= K; i++) { const a = Math.PI / 2 + (i / K) * Math.PI / 2; sec.push([p - rim - rim * Math.cos(a), PT - rim + rim * Math.sin(a), Math.cos(a), Math.sin(a)]); }
    sec.push([p, top, -1, 0]);
    const b = new Builder();
    // each step of the section a ring round the plan: a rectangle with rounded corners; along a side with a gap in
    // it, four more points (the parapet's end each side of the opening, and there down to the roof), on every ring
    const SIDES = ['z1', 'x0', 'z0', 'x1'];   // (the side after each corner, as a ring goes round)
    // (each side's face, out from the middle, at a height; dd in from it)
    const frame = (yy, dd) => { const k = Math.max(0, (yy - base) / H), e = (s, h) => h - LS[s] * k - dd; return { x1: e('x1', sx / 2), x0: e('x0', sx / 2), z1: e('z1', sz / 2), z0: e('z0', sz / 2) }; };
    const QS = [[1, 1, 0], [-1, 1, 1], [-1, -1, 2], [1, -1, 3]];
    const rcOf = (ci, d) => (isSharp[ci] ? 0 : Math.max(R - d, 0.03));
    const ring = ([d, y, no, nu]) => {
      const out = [], l = Math.hypot(no, nu);
      const F = frame(y, d);
      QS.forEach(([qx, qz, a0], ci) => {
        const rc = rcOf(ci, d), ex = qx > 0 ? F.x1 : F.x0, ez = qz > 0 ? F.z1 : F.z0;
        for (let j = 0; j <= M; j++) {
          const a = ((a0 + j / M) * Math.PI) / 2, c = Math.cos(a), s = Math.sin(a);
          out.push(b.vert(qx * (ex - rc) + c * rc, y, qz * (ez - rc) + s * rc, (c * no) / l, nu / l, (s * no) / l));
        }
        const side = SIDES[ci], zSide = side[0] === 'z', down = side === 'z1' || side === 'x0';
        // (the side runs between this corner and the next: its ends, low and high along it)
        const cn = (ci + 1) % 4, rP = rcOf(down ? ci : cn, d), rN = rcOf(down ? cn : ci, d);
        const E = 0.012, lo = -((zSide ? F.x0 : F.z0) - rN - 0.02), hi = (zSide ? F.x1 : F.z1) - rP - 0.02;
        const pts = [];
        for (const g of gaps.filter((g) => g.side === side)) {
          const ga = Math.max(g.a, lo + E), gb = Math.min(g.b, hi - E);
          if (gb - ga < 0.05) continue;
          pts.push([ga - E, 1], [ga, 0], [gb, 0], [gb + E, 1]);
        }
        pts.sort((u, v) => (down ? v[0] - u[0] : u[0] - v[0]));
        for (const [u, f] of pts) {
          // (in the opening the section is pressed down to the roof's height: the outer face stops there, the rest
          // lies flat, facing up)
          const flat = !f && y > top, yy = flat ? top : y, G = frame(yy, d);
          const [nx, ny, nz] = flat && d > 0 ? [0, 1, 0] : side === 'z1' ? [0, nu / l, no / l] : side === 'z0' ? [0, nu / l, -no / l] : side === 'x1' ? [no / l, nu / l, 0] : [-no / l, nu / l, 0];
          const [px, pz] = side === 'z1' ? [u, G.z1] : side === 'z0' ? [u, -G.z0] : side === 'x1' ? [G.x1, u] : [-G.x0, u];
          out.push(b.vert(px, yy, pz, nx, ny, nz));
        }
      });
      return out;
    };
    const rings = sec.map(ring), N = rings[0].length;
    for (let i = 0; i < rings.length - 1; i++) {
      for (let j = 0; j < N; j++) {
        const a = rings[i][j], bb = rings[i][(j + 1) % N], c = rings[i + 1][j], e = rings[i + 1][(j + 1) % N];
        b.tri(a, c, bb);
        b.tri(bb, c, e);
      }
    }
    // the roof: the inner face's foot closed, flat
    const last = sec.at(-1), F = frame(top, p);
    const mid = b.vert((F.x1 - F.x0) / 2, top, (F.z1 - F.z0) / 2, 0, 1, 0), roof = [];
    QS.forEach(([qx, qz, a0], ci) => {
      const rc = rcOf(ci, p), ex = qx > 0 ? F.x1 : F.x0, ez = qz > 0 ? F.z1 : F.z0;
      for (let j = 0; j <= M; j++) {
        const a = ((a0 + j / M) * Math.PI) / 2;
        roof.push(b.vert(qx * (ex - rc) + Math.cos(a) * rc, last[1], qz * (ez - rc) + Math.sin(a) * rc, 0, 1, 0));
      }
    });
    for (let j = 0; j < roof.length; j++) b.tri(mid, roof[(j + 1) % roof.length], roof[j]);
    const g = b.build();
    get(kind).add(g, new THREE.Matrix4().compose(V(cx, 0, cz), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(1, 1, 1)));
    g.dispose();
  };
  // a stair's wall and its landing's, run on into a roof's parapet as one: a wall p thick along a line of points
  // [x, z, its top there, its foot from there to the next], the line its outer face (out: which way that faces, for
  // the first stretch), its top rounded over as a shell's parapet's is. Above y0 it leans in by slope a metre, as the
  // house's walls it runs on from (so where it meets a shell's parapet, a corner of it left sharp, the two are one)
  const rail = (kind, pts, { p = 0.36, rim = 0.1, y0 = Infinity, slope = 0, out }) => {
    const K = 3, B2 = get(kind);
    const dirs = pts.slice(1).map((q, i) => { const dx = q[0] - pts[i][0], dz = q[1] - pts[i][1], l = Math.hypot(dx, dz); return [dx / l, dz / l]; });
    // (in: across a stretch, from its outer face into the wall)
    const sg = -dirs[0][1] * out.x + dirs[0][0] * out.z > 0 ? -1 : 1;
    const ins = dirs.map(([dx, dz]) => [-dz * sg, dx * sg]);
    const mitre = ins.map((n, i) => n).concat([ins.at(-1)]).map((n, i) => {
      if (i === 0 || i === ins.length) return n;
      const [a, c] = [ins[i - 1], ins[i]], k = 1 + a[0] * c[0] + a[1] * c[1];
      return [(a[0] + c[0]) / k, (a[1] + c[1]) / k];
    });
    // its section: [in from the outer face, height, normal out, normal up]
    // (each face creased at y0, upright below it; where y0 is not on a face, the crease at its end)
    const sec = (yb, yt) => {
      const yc = Math.min(Math.max(y0, yb), yt - rim);
      const s = [[0, yb, 0, -1], [0, yb, 1, 0], [0, yc, 1, 0], [0, yt - rim, 1, 0]];
      for (let i = 1; i <= K; i++) { const a = (i / K) * Math.PI / 2; s.push([rim - rim * Math.cos(a), yt - rim + rim * Math.sin(a), Math.cos(a), Math.sin(a)]); }
      for (let i = 0; i <= K; i++) { const a = Math.PI / 2 + (i / K) * Math.PI / 2; s.push([p - rim - rim * Math.cos(a), yt - rim + rim * Math.sin(a), Math.cos(a), Math.sin(a)]); }
      s.push([p, yc, -1, 0], [p, yb, -1, 0], [p, yb, 0, -1]);
      return s;
    };
    const at = (i, d, y) => { const m = mitre[i], o = d + slope * Math.max(0, y - y0); return [pts[i][0] + m[0] * o, y, pts[i][1] + m[1] * o]; };
    const face = (vs, n) => {
      // (each triangle turned to face the way its normal says)
      const [a, b2, c] = vs.map((v) => v.p), e1 = a.map((x, k) => b2[k] - x), e2 = a.map((x, k) => c[k] - x);
      const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const dot = cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2];
      if (Math.abs(dot) < 1e-9) return;
      const ids = vs.map((v) => B2.vert(...v.p, ...v.n));
      if (dot > 0) B2.tri(ids[0], ids[1], ids[2]); else B2.tri(ids[0], ids[2], ids[1]);
    };
    for (let i = 0; i < dirs.length; i++) {
      const [ix, iz] = ins[i], yb = pts[i][3];
      const ends = [i, i + 1].map((j) => sec(yb, pts[j][2]).map(([d, y, no, nu]) => {
        const l = Math.hypot(no, nu), n = [(-ix * no) / l, nu / l, (-iz * no) / l];
        return { p: at(j, d, y), n };
      }));
      const S = ends[0].length;
      for (let j = 0; j < S; j++) {
        const a = ends[0][j], b2 = ends[0][(j + 1) % S], c = ends[1][j], e = ends[1][(j + 1) % S];
        const n = a.n.map((x, k) => x + b2.n[k]);
        face([a, c, b2], n);
        face([b2, c, e], n);
      }
      // (its ends closed: the stretch's own, where it meets the next lower or higher, hidden in it where not)
      for (const [k, sgn] of [[0, -1], [1, 1]]) {
        const ring = ends[k], n = [dirs[i][0] * sgn, 0, dirs[i][1] * sgn];
        const c = ring.reduce((s, v) => s.map((x, q) => x + v.p[q] / ring.length), [0, 0, 0]);
        for (let j = 0; j < S; j++) face([{ p: c, n }, { p: ring[j].p, n }, { p: ring[(j + 1) % S].p, n }], n);
      }
    }
  };

  // ---- each house ----
  const courts = [], doors = [];
  // the windows (their middles, a hand out from the wall, and which way they face): where a lamp's light shows
  // at night (fires.js)
  const windows = [];
  const corners = (h, o = 0) => [[h.x0 - o, h.z0 - o], [h.x1 + o, h.z0 - o], [h.x0 - o, h.z1 + o], [h.x1 + o, h.z1 + o], [(h.x0 + h.x1) / 2, (h.z0 + h.z1) / 2]];
  // the ground under a house: its lowest and highest. On a slope its foot also reaches down to the ground just
  // round it (a lane cut lower into the hill beside it), so no gap shows under the wall
  const groundOf = (h) => {
    const ys = corners(h).map(([x, z]) => heightAt(x, z));
    const lo = sloped ? Math.min(...ys, ...corners(h, 1.6).map(([x, z]) => heightAt(x, z))) : Math.min(...ys);
    return { lo, hi: Math.max(...ys) };
  };
  const props = (x, z, y, out) => {
    // a jar or two, a basket, a sack by a door
    const r = rng(), s = 0.55 + rng() * 0.35;
    if (r < 0.5) get(rng() < 0.6 ? 'clay' : 'buff').add(JAR, new THREE.Matrix4().compose(V(x, y - 0.02, z), new THREE.Quaternion(), V(s, s, s)));
    else if (r < 0.75) { const g = new THREE.CylinderGeometry(0.33, 0.27, 0.45, 12).deleteAttribute('uv'); get('straw').add(g, new THREE.Matrix4().makeTranslation(x, y + 0.22, z)); }
    else { const g = new THREE.SphereGeometry(0.3, 10, 7).deleteAttribute('uv'); get('linen').add(g, new THREE.Matrix4().compose(V(x, y + 0.32, z), new THREE.Quaternion(), V(1, 1.3, 0.9))); }
    if (out && rng() < 0.4) get('clay').add(JAR, new THREE.Matrix4().compose(V(x + out.x * 0.7, y - 0.02, z + out.z * 0.7), new THREE.Quaternion(), V(0.45, 0.45, 0.45)));
  };
  // (a house's parapet openings, h.gaps: { side, from, to } along the side in the world, as the shell of a mass
  // (its box) whose side lies on the house's takes them)
  const gapsOf = (h, m) => (h.gaps ?? []).filter((g) => Math.abs(m[g.side] - h[g.side]) < 0.1).map((g) => {
    const c = g.side[0] === 'z' ? (m.x0 + m.x1) / 2 : (m.z0 + m.z1) / 2;
    return { side: g.side, a: g.from - c, b: g.to - c };
  });
  // h.whole: built as one block over its slope, not stepping down it (two narrow blocks read as two narrow houses)
  const build = (h, { storeys = null, court = null } = {}) => {
    const w = h.x1 - h.x0, d = h.z1 - h.z0, { lo, hi } = groundOf(h);
    const kind = rng() < 0.82 ? 'whitewash' : 'plaster';
    if (maxStoreys?.(h) === 1) storeys = 1;
    const cap = capAt?.(h) ?? Infinity;
    const x0 = h.x0 + 0.03, x1 = h.x1 - 0.03, z0 = h.z0 + 0.03, z1 = h.z1 - 0.03, base = lo - 0.7;
    const oneH = () => 3.5 + rng() * 1.0, twoH = () => 6.1 + rng() * 1.3;
    const pick = (p2) => (storeys ? (storeys === 2 ? twoH() : oneH()) : rng() < p2 ? twoH() : oneH());
    // the house's masses, each its own height, so the street's skyline steps up and down: a courtyard house's
    // four wings (an upper floor over one of them), or a long house in two parts, one higher, or a single block
    const masses = [];
    const hasCourt = court ?? (w >= 9 && d >= 9);
    if (hasCourt) {
      const t = 3 + rng() * 0.8, hw = pick(0.2);
      masses.push({ x0, x1, z0, z1: z0 + t, h: hw }, { x0, x1, z0: z1 - t, z1, h: hw },
        { x0, x1: x0 + t, z0: z0 + t - 0.3, z1: z1 - t + 0.3, h: hw }, { x0: x1 - t, x1, z0: z0 + t - 0.3, z1: z1 - t + 0.3, h: hw });
      if (!storeys && rng() < 0.55) masses[Math.floor(rng() * 4)].h += 2.4 + rng() * 0.5;
      courts.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, rx: (x1 - x0) / 2 - t, rz: (z1 - z0) / 2 - t, y: heightAt((x0 + x1) / 2, (z0 + z1) / 2) });
    } else if (sloped && !h.whole && Math.max(w, d) >= 4.5 && (() => { const ys = corners(h).map(([x, z]) => heightAt(x, z)); return Math.max(...ys) - Math.min(...ys); })() > 1.4) {
      // across the slope: blocks stepping down it, each on its own ground, each its own height
      const cxm = (x0 + x1) / 2, czm = (z0 + z1) / 2;
      const gx = Math.abs(heightAt(x1, czm) - heightAt(x0, czm)), gz = Math.abs(heightAt(cxm, z1) - heightAt(cxm, z0));
      const alongX = gx >= gz, len = alongX ? x1 - x0 : z1 - z0, n = len >= 7.5 && Math.max(gx, gz) > 2.6 ? 3 : 2;
      const cuts = [0, ...Array.from({ length: n - 1 }, (_, k) => (k + 1) / n + (rng() - 0.5) * 0.12), 1];
      for (let k = 0; k < n; k++) {
        const a = cuts[k], b = cuts[k + 1], hh = storeys === 2 || (!storeys && rng() < 0.22) ? twoH() : oneH() - rng() * 0.5;
        if (alongX) masses.push({ x0: x0 + (x1 - x0) * a, x1: x0 + (x1 - x0) * b, z0, z1, h: hh });
        else masses.push({ x0, x1, z0: z0 + (z1 - z0) * a, z1: z0 + (z1 - z0) * b, h: hh });
      }
    } else if (!storeys && Math.max(w, d) >= 7.5 && rng() < 0.6) {
      const f = 0.35 + rng() * 0.3, hs = rng() < 0.5 ? [oneH(), twoH()] : [twoH(), oneH()];
      if (w >= d) masses.push({ x0, x1: x0 + (x1 - x0) * f, z0, z1, h: hs[0] }, { x0: x0 + (x1 - x0) * f, x1, z0, z1, h: hs[1] });
      else masses.push({ x0, x1, z0, z1: z0 + (z1 - z0) * f, h: hs[0] }, { x0, x1, z0: z0 + (z1 - z0) * f, z1, h: hs[1] });
    } else masses.push({ x0, x1, z0, z1, h: pick(0.38) });
    const ph = 0.3 + rng() * 0.4;
    for (const m of masses) {
      // (on a slope each mass on its own ground, so the roofs step down the hill)
      const mhi = sloped ? Math.max(...corners(m).map(([x, z]) => heightAt(x, z))) : hi;
      m.top = Math.min(mhi + m.h, cap);
    }
    // (two masses side by side: the corners between them square, so their walls run on in one; the lower's parapet
    // left out along the other, its roof running flat to that one's wall)
    const near = (a, b) => Math.abs(a - b) < 1e-6, over = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0) > 0.1;
    masses.forEach((m, i) => {
      const sharp = [], gaps = gapsOf(h, m);
      masses.forEach((o, j) => {
        if (j === i) return;
        const side = over(m.z0, m.z1, o.z0, o.z1) ? (near(o.x0, m.x1) ? 'x1' : near(o.x1, m.x0) ? 'x0' : null)
          : over(m.x0, m.x1, o.x0, o.x1) ? (near(o.z0, m.z1) ? 'z1' : near(o.z1, m.z0) ? 'z0' : null) : null;
        if (!side) return;
        sharp.push(side);
        if (m.top < o.top || (m.top === o.top && i < j)) { gaps.push({ side, a: -99, b: 99 }); (m.open ??= []).push(side); }
      });
      // its walls and the parapet round its roof, one piece
      shell(kind, (m.x0 + m.x1) / 2, (m.z0 + m.z1) / 2, 0, m.x1 - m.x0, m.z1 - m.z0, base, m.top, ph, { gaps, sharp });
    });
    h.roofY = Math.max(...masses.map((m) => m.top));
    h.masses = masses; h.ph = ph;
    const top = Math.max(...masses.map((m) => m.top)), low = Math.min(...masses.map((m) => m.top));
    const two = top - hi > 5.5;
    // now and then a small room on a low roof
    const lowM = masses.find((m) => m.top === low);
    if (!storeys && !two && cap === Infinity && rng() < 0.14 && lowM.x1 - lowM.x0 > 4 && lowM.z1 - lowM.z0 > 4) {
      const rx = rng() < 0.5 ? lowM.x0 + 1.5 : lowM.x1 - 1.5, rz = rng() < 0.5 ? lowM.z0 + 1.5 : lowM.z1 - 1.5;
      wall(kind, rx, low + 1.2, rz, 2.8, 2.6, 2.8);
      // Give the small rooftop store a purpose and a readable entrance.
      box('dark', rx, low + 0.95, rz - 1.405, 0.94, 1.9, 0.03);
      for (let j = 0; j < 5; j++) box('wood', rx - 0.35 + j * 0.175, low + 0.92, rz - 1.43, 0.16, 1.82, 0.04);
      box('wood', rx, low + 1.96, rz - 1.44, 1.15, 0.12, 0.15);
      box('trim', rx, low + 2.55, rz, 2.93, 0.16, 2.93);
    }
    // the faces on a lane: a door (one), a few small high windows; by some doors jars, a basket, a sack
    const faces = [
      { n: V(0, 0, -1), at: (t) => [x0 + t, z0], len: x1 - x0 }, { n: V(0, 0, 1), at: (t) => [x0 + t, z1], len: x1 - x0 },
      { n: V(-1, 0, 0), at: (t) => [x0, z0 + t], len: z1 - z0 }, { n: V(1, 0, 0), at: (t) => [x1, z0 + t], len: z1 - z0 },
    ];
    const onLane = [];
    for (const f of faces) {
      for (let t = 1.2; t < f.len - 1.2; t += 0.8) {
        const [x, z] = f.at(t);
        if (doorAt(x + f.n.x * 0.8, z + f.n.z * 0.8)) onLane.push({ f, t });
      }
    }
    // (only where the wall stands a storey over the lane: a house kept down below the stair shows the lane a low
    // wall, and a door there stood up over it)
    const wallOver = ({ f, t }) => {
      const [x, z] = f.at(t), m = masses.find((mm) => x >= mm.x0 - 0.1 && x <= mm.x1 + 0.1 && z >= mm.z0 - 0.1 && z <= mm.z1 + 0.1);
      return (m ? m.top : low) - heightAt(x + f.n.x * 0.6, z + f.n.z * 0.6);
    };
    const doorable = onLane.filter((o) => wallOver(o) > 2.7);
    if (doorable.length) {
      const { f, t } = doorable[Math.floor(rng() * doorable.length)];
      const [x, z] = f.at(t), gy = sillAt(x + f.n.x * 0.6, z + f.n.z * 0.6);
      // (the same door as the detailed houses': framed, planked, its ring and threshold)
      doorIn(f, t, gy, kind);
      if (rng() < 0.35) props(x + f.n.x * 0.5 + f.n.z * 1.0, z + f.n.z * 0.5 - f.n.x * 1.0, gy, f.n);
      for (let k = 0, nw = Math.floor(rng() * 3); k < nw; k++) {
        const o = doorable[Math.floor(rng() * doorable.length)];
        if (o.f !== f || Math.abs(o.t - t) > 1.5) {
          const [wx, wz] = o.f.at(o.t), wy = heightAt(wx, wz) + (two && rng() < 0.6 ? 5 : 2.7) + rng() * 0.4;
          box('dark', wx + o.f.n.x * 0.03, wy, wz + o.f.n.z * 0.03, 0.34, 0.4, 0.1, Math.atan2(o.f.n.x, o.f.n.z));
          windows.push({ x: wx + o.f.n.x * 0.1, y: wy, z: wz + o.f.n.z * 0.1, n: o.f.n, w: 0.34 });
        }
      }
      // a ladder up to the roof from the lane
      if (rng() < 0.16 && f.len > 4) {
        const t2 = Math.min(Math.max(t + (rng() < 0.5 ? -1.8 : 1.8), 0.6), f.len - 0.6), [lx, lz] = f.at(t2);
        const side = V(f.n.z, 0, -f.n.x), gy2 = heightAt(lx + f.n.x, lz + f.n.z);
        for (const s of [-0.28, 0.28]) {
          get('wood').tube([V(lx + f.n.x * 1.0 + side.x * s, gy2, lz + f.n.z * 1.0 + side.z * s), V(lx + f.n.x * 0.15 + side.x * s, low + 0.8, lz + f.n.z * 0.15 + side.z * s)], [0.045, 0.04], 5);
        }
        for (let y = gy2 + 0.35; y < low + 0.6; y += 0.36) {
          const k = (y - gy2) / (low + 0.8 - gy2), ox = f.n.x * (1.0 - 0.85 * k), oz = f.n.z * (1.0 - 0.85 * k);
          get('wood').tube([V(lx + ox - side.x * 0.28, y, lz + oz - side.z * 0.28), V(lx + ox + side.x * 0.28, y, lz + oz + side.z * 0.28)], [0.03, 0.03], 4);
        }
      }
    }
    // the faces looking out of the town: a few small windows, high, in the blank wall
    if (outAt) {
      for (const f of faces) {
        const [mx, mz] = f.at(f.len / 2);
        if (!outAt(mx + f.n.x * 1.2, mz + f.n.z * 1.2)) continue;
        for (let k = 0, nw = Math.floor(rng() * 3); k < nw; k++) {
          const t = 0.8 + rng() * (f.len - 1.6), [wx, wz] = f.at(t);
          const mtop = Math.min(...masses.filter((m) => wx >= m.x0 - 0.1 && wx <= m.x1 + 0.1 && wz >= m.z0 - 0.1 && wz <= m.z1 + 0.1).map((m) => m.top), top);
          const wy = mtop - 0.9 - rng() * 1.2;
          if (wy < heightAt(wx + f.n.x, wz + f.n.z) + 1.6) continue;
          const ww = 0.3 + rng() * 0.15;
          box('dark', wx + f.n.x * 0.03, wy, wz + f.n.z * 0.03, ww, 0.36 + rng() * 0.1, 0.1, Math.atan2(f.n.x, f.n.z));
          windows.push({ x: wx + f.n.x * 0.1, y: wy, z: wz + f.n.z * 0.1, n: f.n, w: ww });
        }
      }
    }
    // on the roof: a reed shelter for sleeping out in the summer, jars
    const lw = lowM.x1 - lowM.x0, ld = lowM.z1 - lowM.z0;
    // (on about half the roofs, of different sizes; on a house capped under the stair, only where its top stays
    // under the eyes of one on the stair (the cap is a quarter metre under the stair's floor), so the river shows)
    if ((cap === Infinity || cap - low > 1.0) && rng() < 0.5 && lw > 4.2 && ld > 4.2) {
      const w = Math.min(2.6 + rng() * 1.4, lw - 0.8), d = Math.min(2.2 + rng() * 1.0, ld - 0.8);
      const sx = rng() < 0.5 ? lowM.x0 + w / 2 + 0.3 : lowM.x1 - w / 2 - 0.3, sz = rng() < 0.5 ? lowM.z0 + d / 2 + 0.3 : lowM.z1 - d / 2 - 0.3;
      for (const ox of [-w / 2 + 0.2, w / 2 - 0.2]) for (const oz of [-d / 2 + 0.2, d / 2 - 0.2]) box('wood', sx + ox, low + 0.95, sz + oz, 0.1, 1.9, 0.1);
      reedMat(sx, low + 1.92, sz, w, d);
    }
    // and what is put out on the roofs (more where they are looked down on: roofBusy)
    const busy = roofBusy?.(h) ?? 0;
    for (const m of masses) {
      if (m.x1 - m.x0 < 2.4 || m.z1 - m.z0 < 2.4) continue;
      const nThings = Math.floor(busy * (m === lowM ? 1.3 : 0.8) + rng());
      if (nThings && !h.noLife) roofLife({ x0: m.x0 + 0.4, x1: m.x1 - 0.4, z0: m.z0 + 0.4, z1: m.z1 - 0.4 }, m.top, nThings, { ph, outer: m, shade: cap === Infinity, noRug: [...(h.noRug ?? []), ...(m.open ?? [])], avoid: h.avoid });
    }
    if (!busy && rng() < 0.3 && lw > 2.5 && ld > 2.5) get('clay').add(JAR, new THREE.Matrix4().compose(V(lowM.x0 + 1 + rng() * (lw - 2), low, lowM.z0 + 1 + rng() * (ld - 2)), new THREE.Quaternion(), V(0.6, 0.6, 0.6)));
    return { top };
  };

  // ---- life on the flat roofs, where half a household's work was done and the summer nights slept: clay tablets
  // set out to dry on a mat, barley spread on one, jars and pots of herbs, washing on a line, a rug thrown over the
  // parapet to air, a rope bed, firewood and reed bundles, a little bread oven; now and then a reed shade.
  // r: the roof inside its parapet; y: its surface; n: how many things; outer: the roof's mass (its parapet's
  // outer faces), ph the parapet's height ----
  const DOME = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).deleteAttribute('uv');
  // (noRug: sides ('z0', 'z1', 'x0', 'x1') over whose parapet no rug is hung)
  const roofLife = (r, y, n, { ph = 0.5, outer = null, shade = false, avoid = [], noRug = [] } = {}) => {
    const W = r.x1 - r.x0, D = r.z1 - r.z0, used = [...avoid];
    const spot = (sw, sd) => {
      if (sw > W || sd > D) return null;
      for (let k = 0; k < 10; k++) {
        const x = r.x0 + sw / 2 + rng() * (W - sw), z = r.z0 + sd / 2 + rng() * (D - sd);
        if (used.every((u) => Math.abs(u.x - x) > (u.w + sw) / 2 + 0.15 || Math.abs(u.z - z) > (u.d + sd) / 2 + 0.15)) {
          used.push({ x, z, w: sw, d: sd });
          return { x, z };
        }
      }
      return null;
    };
    const THINGS = ['tablets', 'tablets', 'jars', 'jars', 'pots', 'washing', 'washing', 'rug', 'rug', 'rug', 'grain', 'bed', 'wood', 'oven'];
    if (shade) THINGS.push('shade');
    for (let k = 0; k < n; k++) {
      // (on a busy roof the first thing something colourful: a rug, washing)
      const what = k === 0 && n >= 2 ? (rng() < 0.6 ? 'rug' : 'washing') : THINGS[Math.floor(rng() * THINGS.length)], turn = rng() < 0.5;
      const dims = (a, b) => (turn ? [b, a] : [a, b]);
      if (what === 'tablets') {
        // a reed mat, rows of new tablets on it, a few askew
        const [mw, md] = dims(1.9, 1.25), p = spot(mw, md);
        if (!p) continue;
        box('straw', p.x, y + 0.012, p.z, mw, 0.025, md);
        const nx = Math.floor((mw - 0.15) / 0.19), nz = Math.floor((md - 0.15) / 0.16);
        for (let i = 0; i < nx; i++) {
          for (let j = 0; j < nz; j++) {
            if (rng() < 0.12) continue;
            const tx = p.x + (i - (nx - 1) / 2) * 0.19, tz = p.z + (j - (nz - 1) / 2) * 0.16;
            clayTablet(get, tx, y + 0.025, tz, 0.11, 0.075, (turn ? Math.PI / 2 : 0) + (rng() - 0.5) * 0.25, { lines: (i + 2 * j) % 3 !== 0 });
          }
        }
      } else if (what === 'jars') {
        const p = spot(1.6, 1.0);
        if (!p) continue;
        for (let j = 0, nj = 2 + Math.floor(rng() * 2); j < nj; j++) {
          const s = 0.5 + rng() * 0.25, jx = p.x + (j - (nj - 1) / 2) * 0.55 * (turn ? 0 : 1), jz = p.z + (j - (nj - 1) / 2) * 0.55 * (turn ? 1 : 0);
          get(rng() < 0.6 ? 'clay' : 'buff').add(JAR, new THREE.Matrix4().compose(V(jx, y - 0.02, jz), new THREE.Quaternion(), V(s, s, s)));
          if (rng() < 0.5) box('mud', jx, y + 1.11 * s + 0.03, jz, 0.34 * s, 0.07, 0.34 * s);   // (sealed with a clay stopper)
        }
      } else if (what === 'pots') {
        const [pw, pd] = dims(1.9, 0.5), p = spot(pw, pd);
        if (!p) continue;
        for (let j = 0; j < 3; j++) pot(p.x + (turn ? 0 : (j - 1) * 0.62), y - 0.01, p.z + (turn ? (j - 1) * 0.62 : 0), 0.8 + rng() * 0.35);
      } else if (what === 'washing') {
        // a line on two poles, washing hung on it: plain linen and a woven cloth or two
        const [lw2, ld2] = dims(2.6, 0.5), p = spot(lw2, ld2);
        if (!p) continue;
        const ax = turn ? 0 : 1, az = turn ? 1 : 0, L = 2.4, H = 1.45;
        for (const s of [-1, 1]) box('wood', p.x + ax * s * L / 2, y + H / 2, p.z + az * s * L / 2, 0.06, H, 0.06);
        get('wood').tube([V(p.x - ax * L / 2, y + H - 0.04, p.z - az * L / 2), V(p.x, y + H - 0.12, p.z), V(p.x + ax * L / 2, y + H - 0.04, p.z + az * L / 2)], [0.012, 0.012, 0.012], 4);
        for (let c = 0, u0 = -L / 2 + 0.15; c < 3 && u0 < L / 2 - 0.4; c++) {
          // (none past the line's far pole)
          const cw = Math.min(0.45 + rng() * 0.45, L / 2 - 0.1 - u0), hang = 0.55 + rng() * 0.45, plain = rng() < 0.6;
          const stripes = plain ? [rng() < 0.5 ? 'linen' : 'saffron'] : weave(rng);
          cloth((i, j) => {
            const u = u0 + (j / 3) * cw, sag = 0.12 * (1 - (2 * u / L) ** 2);
            return V(p.x + ax * u + az * 0.02 * Math.sin(i + j), y + H - 0.04 - sag - (i / 3) * hang, p.z + az * u + ax * 0.02 * Math.sin(i + j));
          }, 3, 3, stripes, true, V(az, 0, ax), (i) => [az * (i / 3) * hang, 0, ax * (i / 3) * hang, 1]);
          u0 += cw + 0.12;
        }
      } else if (what === 'rug' && outer) {
        // a rug thrown over the parapet to air, hanging down the outside of the wall
        const side = Math.floor(rng() * 4), rw = 1.1 + rng() * 0.5, drop = 1.2 + rng() * 0.6;
        const along = side < 2 ? outer.x1 - outer.x0 : outer.z1 - outer.z0;
        if (along < rw + 1 || noRug.includes(['z0', 'z1', 'x0', 'x1'][side])) continue;
        const c = (side < 2 ? outer.x0 : outer.z0) + 0.5 + rw / 2 + rng() * (along - rw - 1);
        const pt = (u, o, yy) => side === 0 ? V(c + u, yy, outer.z0 - o) : side === 1 ? V(c + u, yy, outer.z1 + o) : side === 2 ? V(outer.x0 - o, yy, c + u) : V(outer.x1 + o, yy, c + u);
        const out = [V(0, 0, -1), V(0, 0, 1), V(-1, 0, 0), V(1, 0, 0)][side];
        rugOver((u) => pt(u, 0, y), out, y, { ph, p: 0.34, rw, drop });
      } else if (what === 'grain') {
        // barley spread on a mat to dry, raked into a low heap
        const [gw, gd] = dims(1.7, 1.2), p = spot(gw, gd);
        if (!p) continue;
        box('straw', p.x, y + 0.012, p.z, gw, 0.025, gd);
        get('grain').add(DOME, new THREE.Matrix4().compose(V(p.x, y + 0.02, p.z), new THREE.Quaternion(), V(gw * 0.42, 0.09, gd * 0.4)));
      } else if (what === 'bed') {
        // a rope bed for the summer nights: a wooden frame on four legs, a mat, a rolled blanket
        const [bw, bd] = dims(1.9, 0.85), p = spot(bw, bd);
        if (!p) continue;
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) box('wood', p.x + sx * (bw / 2 - 0.06), y + 0.2, p.z + sz * (bd / 2 - 0.06), 0.07, 0.4, 0.07);
        box('wood', p.x, y + 0.4, p.z, bw, 0.06, bd);
        box('linen', p.x, y + 0.45, p.z, bw - 0.12, 0.04, bd - 0.1);
        // (the roll across the bed at its head)
        const longX = bw >= bd, g = new THREE.CylinderGeometry(0.12, 0.12, Math.min(bw, bd) - 0.15, 8).deleteAttribute('uv');
        if (longX) g.rotateX(Math.PI / 2); else g.rotateZ(Math.PI / 2);
        get(rng() < 0.5 ? 'madder' : 'saffron').add(g, new THREE.Matrix4().makeTranslation(p.x + (longX ? bw / 2 - 0.25 : 0), y + 0.58, p.z + (longX ? 0 : bd / 2 - 0.25)));
        g.dispose();
      } else if (what === 'wood') {
        // firewood and reed bundles
        const p = spot(1.6, 0.9);
        if (!p) continue;
        for (let j = 0; j < 5; j++) {
          const o = (j % 3 - 1) * 0.16, hy = j < 3 ? 0.07 : 0.2;
          const a = V(p.x - (turn ? o : 0.7), y + hy, p.z - (turn ? 0.7 : o)), b = V(p.x + (turn ? o : 0.7), y + hy, p.z + (turn ? 0.7 : o));
          if (rng() < 0.5) get('wood').tube([a, b], [0.06, 0.05], 5);
          else get('straw').tube([a, b], [0.09, 0.09], 6);
        }
      } else if (what === 'oven') {
        // a little bread oven of clay, its mouth dark
        const p = spot(1.1, 1.1);
        if (!p) continue;
        get('clay').add(DOME, new THREE.Matrix4().compose(V(p.x, y, p.z), new THREE.Quaternion(), V(0.48, 0.62, 0.48)));
        const a = rng() * Math.PI * 2;
        box('dark', p.x + Math.cos(a) * 0.4, y + 0.17, p.z + Math.sin(a) * 0.4, 0.26, 0.26, 0.26, -a);
      } else if (what === 'shade') {
        const p = spot(2.6, 2.2);
        if (!p) continue;
        for (const [ox, oz] of [[-1.1, -0.9], [1.1, -0.9], [-1.1, 0.9], [1.1, 0.9]]) box('wood', p.x + ox, y + 0.95, p.z + oz, 0.1, 1.9, 0.1);
        reedMat(p.x, y + 1.92, p.z, 2.6, 2.2);
        box('madder', p.x, y + 0.03, p.z, 1.8, 0.02, 1.3);
      }
    }
  };
  // ---- what dresses the fronts of the small houses (and the square, and the precinct's gate) ----
  // the plants are drawn by bayScene.js (with the rest of the plants): here only where they go
  const decor = { pots: [], vines: [], shrubs: [], trees: [] };
  // a vertex-built surface: each face given to one kind (so a pattern is painted face by face)
  const face4 = (kind, a, b, c, d, n) => {
    const B2 = get(kind), i = B2.count;
    for (const [p, nn] of [[a, n[0]], [b, n[1]], [c, n[2]], [d, n[3]]]) B2.vert(p.x, p.y, p.z, nn.x, nn.y, nn.z);
    B2.tri(i, i + 1, i + 2);
    B2.tri(i, i + 2, i + 3);
  };
  // a tall storage jar (some 1.1 m), its body buff, a painted band round the shoulder between dark lines, as the
  // Jemdet Nasr potters painted theirs: a chequer, a zigzag or a row of triangles in red and black
  const JAR_P = [[0.15, 0], [0.3, 0.05], [0.42, 0.2], [0.47, 0.42], [0.45, 0.62], [0.38, 0.8], [0.26, 0.95], [0.2, 1.02], [0.22, 1.07], [0.25, 1.1], [0.2, 1.1]];
  const profAt = (u) => {
    const f = u * (JAR_P.length - 1), i = Math.min(Math.floor(f), JAR_P.length - 2), t = f - i;
    return [JAR_P[i][0] + (JAR_P[i + 1][0] - JAR_P[i][0]) * t, JAR_P[i][1] + (JAR_P[i + 1][1] - JAR_P[i][1]) * t];
  };
  const paintedJar = (x, y, z, s, yaw, design) => {
    const rows = 30, segs = 40, P2 = [], N2 = [];
    for (let i = 0; i <= rows; i++) {
      const [r, h] = profAt(i / rows), [r1, h1] = profAt(Math.min(i + 1, rows) / rows), [r0, h0] = profAt(Math.max(i - 1, 0) / rows);
      const dr = r1 - r0, dh = h1 - h0, l = Math.hypot(dr, dh) || 1;
      for (let j = 0; j <= segs; j++) {
        const a = yaw + (j / segs) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
        P2.push(V(x + r * c * s, y + h * s, z + r * sn * s));
        N2.push(V((dh / l) * c, -dr / l, (dh / l) * sn));
      }
    }
    const kindAt = (i, j) => {
      const h = profAt((i + 0.5) / rows)[1];
      if ((h > 0.5 && h < 0.535) || (h > 0.8 && h < 0.835)) return 'dark';
      if (h >= 0.535 && h <= 0.8) {
        const row = Math.floor((h - 0.535) / 0.053);
        if (design === 0) return ((Math.floor(j / 2) + row) % 2) ? 'madder' : 'buff';
        if (design === 1) { const v = (j + Math.abs((row % 4) - 2) * 2) % 8; return v < 2 ? 'dark' : v < 4 ? 'madder' : 'buff'; }
        return (j % 5) < 5 - row ? (row % 2 ? 'dark' : 'madder') : 'buff';
      }
      if (h > 1.0) return 'madder';   // (a red lip)
      return 'buff';
    };
    const W = segs + 1;
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < segs; j++) {
        const a = i * W + j, b = a + 1, c = a + W + 1, d = a + W;
        face4(kindAt(i, j), P2[a], P2[d], P2[c], P2[b], [N2[a], N2[d], N2[c], N2[b]]);
      }
    }
  };
  // a panel of cone mosaic: thousands of baked clay cones pushed into the wall, their heads painted red, black or
  // left white, making zigzags or diamonds (as on the temple walls of Uruk); the wall's own plaster between them,
  // no panel behind. At (x, y, z) on a wall facing n, w wide and h high along side and up; tilt: how far the wall's
  // face draws back per metre up (a battered wall), so each row of heads sits in it
  const conePanel = (x, y, z, n, side, w, h, design, loss = 0, tilt = 0) => {
    const cell = 0.09, nx = Math.max(2, Math.floor(w / cell)), ny = Math.max(2, Math.floor(h / cell));
    const up = V(0, 1, 0);
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        if (loss && (Math.sin(i * 127.1 + j * 311.7) * 43758.5453 % 1 + 1) % 1 < loss) continue;
        let k;
        if (design === 0) { const v = (j + Math.abs((i % 8) - 4)) % 8; k = v < 2 ? 'madder' : v < 4 ? 'dark' : 'lime'; }
        else if (design === 1) { const d2 = Math.abs((i % 8) - 4) + Math.abs((j % 8) - 4); k = d2 < 2 ? 'madder' : d2 < 3 ? 'dark' : d2 > 5 ? 'madder' : 'lime'; }
        else { const v = (i + j) % 6, w2 = (i - j + 600) % 6; k = v < 2 ? 'dark' : w2 < 2 ? 'madder' : 'lime'; }
        const dy = (j - ny / 2 + 0.5) * cell;
        const c = V(x, y, z).addScaledVector(side, (i - nx / 2 + 0.5) * cell).addScaledVector(up, dy).addScaledVector(n, 0.012 - tilt * dy);
        coneHead(get(k), c, n, cell * 0.43, 0.036);
      }
    }
  };
  // cloth: a sheet over a grid of points (rows x cols), plain (stripes: one kind) or woven in a pattern
  // (weaves.js: { weave: k }); weave(rng): one of the patterns, at the throw of one die
  // hint: the way its lit face looks (out from the wall it hangs on, up for an awning). Its faces are turned to
  // it: a cloth whose normals looked into the wall behind it was shaded as if in that wall's shadow, dark even in
  // the sun. flapAt(i, j) (optional): how its point there moves in the wind ([x, y, z, how it hangs], shade.js
  // FLAP); one point, one flap, so the quads meeting there move together
  const weave = (r) => ({ weave: Math.floor(r() * WEAVE_N) });
  const cloth = (pointAt, rows, cols, stripes, across = true, hint = null, flapAt = null) => {
    // (a woven one: its uvs the distances along its edges, in tiles of half a metre)
    const wv = stripes.weave, us = [0], vs = [0];
    if (wv !== undefined) {
      for (let j = 0; j < cols; j++) us.push(us[j] + pointAt(0, j).distanceTo(pointAt(0, j + 1)) / 0.5);
      for (let i = 0; i < rows; i++) vs.push(vs[i] + pointAt(i, 0).distanceTo(pointAt(i + 1, 0)) / 0.5);
    }
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const a = pointAt(i, j), b = pointAt(i, j + 1), c = pointAt(i + 1, j + 1), d = pointAt(i + 1, j);
        const nrm = V().subVectors(b, a).cross(V().subVectors(d, a)).normalize(), k = wv === undefined && stripes[(across ? j : i) % stripes.length];
        let q = [[a, i, j], [b, i, j + 1], [c, i + 1, j + 1], [d, i + 1, j]];
        if (hint && nrm.dot(hint) < 0) { nrm.negate(); q = [q[0], q[3], q[2], q[1]]; }
        if (wv !== undefined) {
          const B2 = (B[`weave${wv}~flap`] ??= new Builder(true, true)), i0 = B2.count;
          for (const [p, ii, jj] of q) B2.vert(p.x, p.y, p.z, nrm.x, nrm.y, nrm.z, us[jj], vs[ii], flapAt?.(ii, jj));
          B2.tri(i0, i0 + 1, i0 + 2);
          B2.tri(i0, i0 + 2, i0 + 3);
          continue;
        }
        if (!flapAt) { face4(k, ...q.map((e) => e[0]), [nrm, nrm, nrm, nrm]); continue; }
        const B2 = getFlap(k), i0 = B2.count;
        for (const [p, ii, jj] of q) B2.vert(p.x, p.y, p.z, nrm.x, nrm.y, nrm.z, 0, 0, flapAt(ii, jj));
        B2.tri(i0, i0 + 1, i0 + 2);
        B2.tri(i0, i0 + 2, i0 + 3);
      }
    }
  };
  // a rug thrown over a parapet to air: in on the roof, up its inner face and over its top (ph high over the roof,
  // p thick), down the outer face; where the wall has its roof beams' ends showing under the parapet (overBeams),
  // out over them and down clear of them, as a cloth would fall. faceAt(u): the wall's outer face at the roof's
  // height, u metres along it from the rug's middle; n: out from it; y: the roof's height
  // (one already hung over that stretch of the wall, another not thrown over it: two lay through each other)
  const rugs = [];
  const rugOver = (faceAt, n, y, { ph, p, rw, drop, overBeams = false }) => {
    const wv = weave(rng), c = faceAt(0), u = V().subVectors(faceAt(1), c).normalize();
    if (rugs.some((r) => Math.abs(r.n.dot(n)) > 0.9 && Math.abs(V().subVectors(c, r.c).dot(n)) < 0.5 && Math.abs(V().subVectors(c, r.c).dot(u)) < (rw + r.rw) / 2 + 0.1 && Math.abs(y - r.y) < 1.5)) return;
    rugs.push({ c, n: n.clone(), rw, y });
    const prof = [[-(p + 0.45), 0.03], [-(p + 0.05), ph + 0.02], [-p / 2, ph + 0.06], [0.04, ph + 0.02]];
    if (overBeams) prof.push([0.3, 0.05], [0.58, -0.27], [0.6, -0.6], [0.57, -0.3 - drop * 0.6], [0.54, -drop]);
    else prof.push([0.06, ph - 0.3], [0.07, ph - drop * 0.6], [0.08, ph - drop]);
    // (in the wind it swings out from the wall from where it leaves the parapet's top, or the beams' ends)
    const holdY = (i) => (overBeams ? (i < 5 ? Infinity : -0.27) : i < 4 ? Infinity : ph + 0.02);
    const flapOf = (i) => { const L = Math.max(holdY(i) - prof[i][1], 0); return L === Infinity ? [0, 0, 0, 0] : [n.x * L, 0, n.z * L, 0]; };
    cloth((i, j) => faceAt((j / 4 - 0.5) * rw).addScaledVector(n, prof[i][0]).setY(y + prof[i][1]), prof.length - 1, 4,
      wv, false, V(0, 0.5, 0).add(n), flapOf);
    // (its fringe)
    const [q, yy] = prof.at(-1), yaw = Math.atan2(n.x, n.z);
    const fl = flapOf(prof.length - 1);
    for (let k = 0; k <= 12; k++) {
      const f = faceAt((k / 12 - 0.5) * rw).addScaledVector(n, q + 0.01);
      getFlap('linen').add(unit, new THREE.Matrix4().compose(V(f.x, y + yy - 0.09, f.z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(0.03, 0.18, 0.01)), { flat: true, flap: fl });
    }
  };
  // a small clay pot of herbs
  const POT = new THREE.LatheGeometry([[0, 0], [0.16, 0], [0.2, 0.06], [0.24, 0.3], [0.27, 0.36], [0.24, 0.36], [0.22, 0.34], [0, 0.34]]
    .map(([r, h]) => new THREE.Vector2(r, h)), 12).deleteAttribute('uv');
  POT.computeVertexNormals();
  const pot = (x, y, z, s = 1) => {
    get('clay').add(POT, new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion(), V(s, s, s)));
    decor.pots.push({ x, y: y + 0.34 * s, z, s });
  };

  // a door's dressing, one of a few recipes: cone mosaic panels either side of it or a frieze over it; painted jars;
  // pots of herbs; a vine on a trellis over it, or a striped awning; a rug hung over the parapet; a pomegranate
  const RECIPES = [
    { panels: 0, jars: 2, pots: 3, rug: 0 },
    { frieze: 1, awning: 1, jars: 1, pots: 2 },
    { vine: true, jars: 2, shrub: true },
    { panels: 1, rug: 1, pots: 3 },
    { frieze: 2, jars: 2, vine: true },
    { panels: 2, awning: 0, pots: 2, shrub: true },
  ];
  let recipeN = 0;
  // (a recipe that stands out in front of the door: a trellis, an awning, a tree)
  const reaches = (R2) => !!(R2.vine || R2.awning !== undefined || R2.shrub);
  const nextRecipe = () => RECIPES[recipeN++ % RECIPES.length];
  const dressDoor = (f, t, gy, top, inset, lowTop, [lim0, lim1] = [0.5, f.len - 0.5], R2 = nextRecipe(), floor = sillAt) => {
    const n = f.n, side = V(n.z, 0, -n.x), yaw = Math.atan2(n.x, n.z);
    const at = (s2, y) => { const [x, z] = f.at(t + s2, y); return V(x, y, z); };
    const room = (s2) => t + s2 > lim0 && t + s2 < lim1, tilt = inset(gy + 1) - inset(gy);
    if (R2.panels !== undefined) {
      for (const s2 of [-1.05, 1.05]) if (room(s2)) { const p = at(s2, gy + 1.25); conePanel(p.x, p.y, p.z, n, side, 0.5, 2.2, R2.panels, 0, tilt); }
    }
    if (R2.frieze !== undefined) { const p = at(0, gy + 2.85); conePanel(p.x, p.y, p.z, n, side, 2.6, 0.55, R2.frieze, 0, tilt); }
    // jars and pots along the wall either side of the door, each side filled outward in turn (past the panels)
    const next = { 1: R2.panels !== undefined ? 1.45 : 1.15, [-1]: R2.panels !== undefined ? 1.45 : 1.15 };
    const place = (w2) => {
      const sgn = next[1] <= next[-1] ? 1 : -1, s2 = sgn * (next[sgn] + w2 / 2);
      next[sgn] += w2 + 0.12;
      return room(s2) ? s2 : null;
    };
    // (none where the ground under it is not level: half on a tread and half off, it stood in the step)
    const level = (x, z, r) => {
      const ys = [0, 1, 2, 3, 4, 5, 6, 7].map((a) => floor(x + Math.cos((a * Math.PI) / 4) * r, z + Math.sin((a * Math.PI) / 4) * r));
      return Math.max(...ys) - Math.min(...ys) < 0.05;
    };
    for (let k = 0; k < (R2.jars ?? 0); k++) {
      const sc = 0.95 + rng() * 0.25, s2 = place(1.0 * sc);
      if (s2 === null) continue;
      const p = at(s2, gy), o = 0.6, yw = rng() * 6, design = Math.floor(rng() * 3), jx = p.x + n.x * o, jz = p.z + n.z * o;
      if (level(jx, jz, 0.5 * sc)) paintedJar(jx, floor(jx, jz) - 0.03, jz, sc, yw, design);
    }
    for (let k = 0; k < (R2.pots ?? 0); k++) {
      const sc = 0.85 + rng() * 0.4, s2 = place(0.55 * sc);
      if (s2 === null) continue;
      const p = at(s2, gy), o = 0.38, px = p.x + n.x * o, pz = p.z + n.z * o;
      if (level(px, pz, 0.3 * sc)) pot(px, floor(px, pz) - 0.02, pz, sc);
    }
    if (R2.shrub) { const s2 = rng() < 0.5 ? -2.6 : 2.6; if (room(s2)) { const p = at(s2, gy); decor.shrubs.push({ x: p.x + n.x * 0.8, z: p.z + n.z * 0.8, y: floor(p.x + n.x * 0.8, p.z + n.z * 0.8) }); } }
    // a vine on a trellis over the door: two posts out in the lane, beams back to the wall, the leaves on top
    if (R2.vine && room(-1.3) && room(1.3)) {
      const H2 = gy + 2.75;
      const posts = [-1.15, 1.15].map((s2) => at(s2, gy).addScaledVector(n, 1.5));
      for (const p of posts) box('wood', p.x, (H2 + gy) / 2, p.z, 0.12, H2 - gy, 0.12, yaw);
      for (const [s2, p] of [[-1.15, posts[0]], [1.15, posts[1]]]) {
        const wpt = at(s2, H2);
        get('wood').tube([V(wpt.x, H2, wpt.z), V(p.x, H2, p.z)], [0.06, 0.06], 5);
      }
      get('wood').tube([V(posts[0].x, H2, posts[0].z), V(posts[1].x, H2, posts[1].z)], [0.06, 0.06], 5);
      decor.vines.push({ a: at(-1.2, H2), b: at(1.2, H2), n: n.clone(), posts, y: H2, gy });
      // the grapes: dark clusters hanging under the trellis
      const berry = new THREE.IcosahedronGeometry(0.035, 0).deleteAttribute('uv');
      for (let k = 0; k < 5; k++) {
        const c = at(-1 + rng() * 2, H2 - 0.15).addScaledVector(n, 0.4 + rng() * 0.9);
        for (let b2 = 0; b2 < 14; b2++) {
          const dy = -rng() * 0.28, r = 0.07 * (1 + dy * 2.5);
          get('grape').add(berry, new THREE.Matrix4().makeTranslation(c.x + (rng() - 0.5) * r * 2, c.y + dy, c.z + (rng() - 0.5) * r * 2));
        }
      }
    }
    // a striped awning over the door, out on two poles
    if (R2.awning !== undefined && room(-1.3) && room(1.3)) {
      const W2 = 2.5, D = 1.7, y0 = gy + 2.75, y1 = gy + 2.25;
      const base0 = at(0, y0);
      const pts = (i, j) => {
        const u = j / 6 - 0.5, v = i / 4;
        return V(base0.x, y0 + (y1 - y0) * v - 0.12 * Math.sin(Math.PI * v), base0.z).addScaledVector(side, u * W2).addScaledVector(n, 0.05 + v * D);
      };
      // (held along the wall and at the poles' heads; between, it lifts and falls a little)
      cloth(pts, 4, 6, { weave: R2.awning ? 3 : 0 }, true, V(0, 1, 0).addScaledVector(n, 0.3),
        (i, j) => [0, 0.09 * Math.sin((Math.PI * i) / 4) + 0.06 * (i / 4) * Math.sin((Math.PI * j) / 6), 0, 2]);
      // (down to the ground where it falls away below the sill)
      for (const u of [-0.5, 0.5]) { const p = pts(4, (u + 0.5) * 6), g = Math.min(gy, floor(p.x, p.z) - 0.05); box('wood', p.x, (p.y + g) / 2, p.z, 0.08, p.y - g, 0.08, yaw); }
    }
    // a rug hung over the parapet down the front, beside the door, its fringe at the foot
    // (a rug over the parapet beside the door, on the side away from the rain spout)
    if (R2.rug !== undefined && room(-2.2)) {
      rugOver((u) => at(-2.2 + u, lowTop), n, lowTop, { ph: 0.45, p: 0.36, rw: 1.3, drop: 2.1, overBeams: true });
    }
  };

  // ---- the small houses one sees close: built out in detail, their doors shut ----
  // whitewashed or plastered red-brown, one or two storeys; their walls leaning in a little as mud brick does, a
  // darker plinth at the foot, a planked door with battens and a bronze ring in a wooden frame under a beam
  // lintel, a threshold stone, small high windows with wooden grilles, the palm-log beams of the roof showing
  // under the parapet, a clay spout to throw the rain off it
  // (leanX: the lean of its sides, if not the same: a house in a row stands with its sides upright against its
  // neighbours')
  const battered = (kind, cx, y0, cz, sx, H, sz, lean, yaw = 0, leanX = lean) => {
    const g = new RoundedBoxGeometry(sx, H, sz, 2, Math.min(0.3, sx / 3, sz / 3)).deleteAttribute('uv');
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = (p.getY(i) + H / 2) / H;
      p.setX(i, p.getX(i) * (1 - (2 * leanX * t) / sx));
      p.setZ(i, p.getZ(i) * (1 - (2 * lean * t) / sz));
    }
    g.computeVertexNormals();
    get(kind).add(g, new THREE.Matrix4().compose(V(cx, y0 + H / 2, cz), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(1, 1, 1)));
    g.dispose();
  };
  const ring = new THREE.TorusGeometry(0.07, 0.014, 6, 14).deleteAttribute('uv');
  // a door in face f at t, its sill at gy: the frame (jambs, a beam lintel whose ends run into the wall, a threshold
  // stone), the leaf (five planks with a little gap, two battens across, a bronze ring)
  const doorIn = (f, t, gy, kind) => {
    const yaw = Math.atan2(f.n.x, f.n.z), side = V(f.n.z, 0, -f.n.x);
    const [dx, dz] = f.at(t, gy + 1);
    const out = (o, s, y) => [dx + f.n.x * o + side.x * s, y, dz + f.n.z * o + side.z * s];
    const put = (k, o, s, y, sx, sy, sz) => { const [px, py2, pz] = out(o, s, y); box(k, px, py2, pz, sx, sy, sz, yaw); };
    put('wood', 0.1, -0.62, gy + 1.1, 0.2, 2.25, 0.22);
    put('wood', 0.1, 0.62, gy + 1.1, 0.2, 2.25, 0.22);
    put('wood', 0.12, 0, gy + 2.33, 1.9, 0.24, 0.3);
    put('stone', 0.32, 0, gy + 0.05, 1.5, 0.14, 0.6);
    for (let k = 0; k < 5; k++) put('wood', 0.03, -0.42 + k * 0.21, gy + 1.08, 0.2, 2.1, 0.07);
    for (const y of [gy + 0.45, gy + 1.75]) put('wood', 0.08, 0, y, 0.98, 0.1, 0.04);
    { const [px, py2, pz] = out(0.11, 0.3, gy + 1.15); get('bronze').add(ring, new THREE.Matrix4().compose(V(px, py2, pz), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(1, 1, 1))); }
    doors.push({ x: dx + f.n.x * 0.6, z: dz + f.n.z * 0.6, n: f.n, hero: true, kind, y: gy });
  };
  // windows: small, high, a wooden frame round a grille of three bars on the dark behind
  const grille = (f, t, wy) => {
    const yaw = Math.atan2(f.n.x, f.n.z), side = V(f.n.z, 0, -f.n.x);
    const [wx, wz] = f.at(t, wy), o = (x, z, oo) => [x + f.n.x * oo, z + f.n.z * oo];
    const [ax, az] = o(wx, wz, 0.02);
    box('dark', ax, wy, az, 0.5, 0.55, 0.05, yaw);
    windows.push({ x: wx + f.n.x * 0.1, y: wy, z: wz + f.n.z * 0.1, n: f.n, w: 0.5 });
    const [bx, bz] = o(wx, wz, 0.06);
    box('wood', bx, wy + 0.32, bz, 0.66, 0.08, 0.1, yaw);
    box('wood', bx, wy - 0.32, bz, 0.66, 0.08, 0.1, yaw);
    for (const sb of [-0.14, 0, 0.14]) box('wood', bx + side.x * sb, wy, bz + side.z * sb, 0.04, 0.56, 0.04, yaw);
  };
  const beamsAt = (f, y, from, to) => {
    for (let t = from; t < to; t += 1.0) {
      const [x, z] = f.at(t, y), yaw = Math.atan2(f.n.x, f.n.z);
      const g = new THREE.CylinderGeometry(0.085, 0.095, 0.55, 7).rotateX(Math.PI / 2).deleteAttribute('uv');
      get('wood').add(g, new THREE.Matrix4().compose(V(x + f.n.x * 0.2, y, z + f.n.z * 0.2), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(1, 1, 1)));
    }
  };
  // the roofs one may walk on (a house's terrace up its outside stair): their rectangles and heights
  const uppers = [];
  // (the yards before houses set back from their lane, their floors: the ground's mesh kept under them, hillLand.js)
  const yards = [];
  // upper: a two-storey house of another kind: its upper room set back on the roof of the lower storey, the
  // front of that roof a terrace with a parapet, a stair up to it along the front from the lane or the square;
  // a second door, into the upper room, opens on the terrace (and on it pots, a jar, a rug over the parapet)
  // side: the upper room beside its terrace (the stair's head on the terrace's side), its front in line with the
  // house's below, rather than behind the terrace
  const heroBuild = (h, { kind, storeys, upper = false, side = false }) => {
    const { lo, hi } = groundOf(h);
    const x0 = h.x0 + 0.03, x1 = h.x1 - 0.03, z0 = h.z0 + 0.03, z1 = h.z1 - 0.03, w = x1 - x0, d = z1 - z0;
    const cap = capAt?.(h) ?? Infinity, base = lo - 0.6;
    const height = upper ? 3.3 + rng() * 0.25 : storeys === 2 ? 6.2 + rng() * 0.7 : 3.7 + rng() * 0.5;
    const top = Math.min(hi + height, cap), H = top - base;
    const lean = 0.14, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const plinth = kind === 'whitewash' ? 'plaster' : 'firedbrick';
    // (the face's inset at a height above the base, as the wall leans in)
    const inset = (y) => (lean * (y - base)) / H;
    // the faces on a lane; the door on the longest stretch of one
    const faces = [
      { n: V(0, 0, -1), at: (t, y) => [x0 + t, z0 + inset(y)], len: w }, { n: V(0, 0, 1), at: (t, y) => [x0 + t, z1 - inset(y)], len: w },
      { n: V(-1, 0, 0), at: (t, y) => [x0 + inset(y), z0 + t], len: d }, { n: V(1, 0, 0), at: (t, y) => [x1 - inset(y), z0 + t], len: d },
    ];
    const lane = faces.map((f) => {
      const ts = [];
      for (let t = 1.3; t < f.len - 1.3; t += 0.5) { const [x, z] = f.at(t, hi); if (doorAt(x + f.n.x * 0.9, z + f.n.z * 0.9)) ts.push(t); }
      return { f, ts };
    }).filter((o) => o.ts.length).sort((a, b) => b.ts.length - a.ts.length);
    let door = lane.length ? { f: lane[0].f, t: lane[0].ts[Math.floor(lane[0].ts.length / 2)] } : null;

    // ---- the upper room's plan: the terrace T deep along the front, the stair (n steps) along the front to the
    // face's far end (end 1) or its near (end -1), up to a landing at its head; the door below in a porch under the
    // landing; what is left of the front beside the stair's foot (room) for jars and pots ----
    let up = null;
    if (upper && door) {
      const f = door.f, L = f.len, D = f.n.x ? w : d;
      const [fx, fz] = f.at(L / 2, hi), gy0 = heightAt(fx + f.n.x * 0.8, fz + f.n.z * 0.8);
      // (n rises: the last onto a landing LL long at the stair's head, beside the opening into the terrace)
      const n = Math.ceil((top - gy0) / 0.26), run = 0.25, LL = 1.6, SL = (n - 1) * run + LL;
      const T = Math.min(3.2, Math.max(2.2, D * 0.45)), pi = inset(top);
      if (L >= SL + 0.4 + pi && D - T >= 2.6 && lane[0].ts.length >= 4) {
        const end = rng() < 0.5 ? 1 : -1;
        // (the stair's end, e0, in line with the house's side where it meets the roof: its landing's wall runs on
        // into the side's parapet)
        const e0 = end > 0 ? L - pi : pi;
        const room = end > 0 ? [0.3, e0 - SL - 0.05] : [e0 + SL + 0.05, L - 0.3];
        up = { f, L, D, T, n, rise: (top - gy0) / n, run, LL, SL, end, e0, gy0, room, side: side && L >= 6 };
        door = { f, t: e0 - end * (LL / 2 + 0.1) };
      }
    }
    // its walls, and the parapet round its roof with them in one piece (a house with an upper room: below, with
    // the room's)
    const pi = inset(top), p = 0.36;
    if (!up) shell(kind, cx, cz, 0, w, d, base, top, 0.45, { p, lean, gaps: gapsOf(h, { x0, x1, z0, z1 }) });
    h.roofY = top;
    // the plinth along each face: a band of darker plaster (or bare brick) at the foot, where the splash wears it;
    // broken for the door
    for (const f of faces) {
      const spans = door && door.f === f ? [[0, door.t - 0.75], [door.t + 0.75, f.len]] : [[0, f.len]];
      for (const [a, b] of spans) {
        if (b - a < 0.2) continue;
        const [mx, mz] = f.at((a + b) / 2, lo), yaw = Math.atan2(f.n.x, f.n.z);
        box(plinth, mx + f.n.x * 0.06, (lo - 0.3 + hi + 0.5) / 2, mz + f.n.z * 0.06, b - a + (a === 0 || b === f.len ? 0.1 : 0), hi + 0.5 - (lo - 0.3), 0.16, yaw);
      }
    }
    if (door) {
      const { f, t } = door, yaw = Math.atan2(f.n.x, f.n.z);
      const [dx, dz] = f.at(t, hi + 1), gy = sillAt(dx + f.n.x * 0.6, dz + f.n.z * 0.6);
      doorIn(f, t, gy, kind);
      const free = up ? up.room : [0.7, f.len - 0.7];
      const wins = storeys === 2 && !up ? [[-1.6, gy + 2.9], [1.6, gy + 2.9], [-1.0, gy + 5.0], [1.2, gy + 5.0]] : [[rng() < 0.5 ? -1.7 : 1.7, gy + 2.85]];
      for (const [s2, wy] of wins) if (t + s2 > free[0] + 0.2 && t + s2 < free[1] - 0.2) grille(f, t + s2, wy);
      // the roof's beams showing under the parapet, a row of them; on a two-storey house the upper floor's too
      beamsAt(f, top - 0.3, Math.max(0.5, free[0] - 0.2), Math.min(f.len - 0.4, free[1] + 0.2));
      if (storeys === 2 && !up) beamsAt(f, hi + 3.3, 0.5, f.len - 0.4);
      // a clay spout throwing the rain off the roof
      if (!up) {
        const [sx2, sz2] = f.at(Math.min(f.len - 0.6, t + 2.4), top);
        spout(new THREE.Matrix4().compose(V(sx2 + f.n.x * 0.35, top + 0.05, sz2 + f.n.z * 0.35), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(1, 1, 1)));
      }
      if (!up) dressDoor(f, t, gy, top, inset, top, free);
      else {
        // (along the wall beside the stair's foot, a metre and more clear of it: one walks along the wall to it)
        let s2 = up.end > 0 ? free[1] - 1.5 : free[0] + 1.5;
        for (let k = 0; k < 4 && s2 > free[0] + 0.3 && s2 < free[1] - 0.3; k++) {
          const [px, pz] = f.at(s2, gy), big = k === 0 && rng() < 0.7;
          if (big) paintedJar(px + f.n.x * 0.55, heightAt(px + f.n.x * 0.55, pz + f.n.z * 0.55) - 0.03, pz + f.n.z * 0.55, 0.95, rng() * 6, Math.floor(rng() * 3));
          else pot(px + f.n.x * 0.4, heightAt(px + f.n.x * 0.4, pz + f.n.z * 0.4) - 0.02, pz + f.n.z * 0.4, 0.85 + rng() * 0.4);
          s2 -= up.end * (big ? 1.1 : 0.62);
        }
      }
    }

    // ---- the upper room, its terrace and the stair ----
    if (up) {
      const { f, L, D, T, n, rise, run, LL, SL, end, e0, gy0 } = up;
      // (in the front's terms, as it stands at the roof: t along it, q in from it)
      const P = (t, q) => { const [ax, az] = f.at(t, top); return [ax - f.n.x * q, az - f.n.z * q]; };
      const tw = (t, q, y) => { const [x, z] = P(t, q); return V(x, y, z); };
      const slab = (k, t0, t1, q0, q1, yb, yt, round = true) => {
        const [ax, az] = P(t0, q0), [bx, bz] = P(t1, q1);
        const sx = Math.abs(bx - ax), sz = Math.abs(bz - az);
        if (round) wall(k, (ax + bx) / 2, (yb + yt) / 2, (az + bz) / 2, sx, yt - yb, sz);
        else box(k, (ax + bx) / 2, (yb + yt) / 2, (az + bz) / 2, sx, yt - yb, sz);
      };
      // the upper room: over the back of the house, its own walls leaning in a little, its parapet, its beams. Or
      // (side) at the end away from the stair's head, the whole depth of the house, its walls leaning on as the
      // house's do below; the terrace the other end, by the stair's head
      const H2 = 2.8 + rng() * 0.3, top2 = top + H2, q1 = D - 2 * pi;
      const TW = Math.min(3.4, Math.max(2.6, L * 0.42)), tS = end > 0 ? L - TW : TW;
      // the house in two parts, their walls and parapets each one piece and the two built as one: the terrace's,
      // its parapet waist high, open at the stair's head (to the corner, sharp, where the landing's wall runs on
      // into it) and along its side against the room's, flat to that wall; and the upper room's, a storey higher,
      // over the back of the house (or, side, at the end away from the stair's head, the whole depth of it). Their
      // outer walls leaning alike; the face between them upright, its corners square
      {
        const zF = !!f.n.z, sF = zF ? (f.n.z < 0 ? 'z0' : 'z1') : f.n.x < 0 ? 'x0' : 'x1';
        const opp = { x0: 'x1', x1: 'x0', z0: 'z1', z1: 'z0' }, tLo = zF ? 'x0' : 'z0', tHi = opp[tLo];
        // (a part's rectangle, t0..t1 along the front, q0..q1 in from it at the foot)
        const rect = (t0, t1, q0, q1) => {
          const [a0, a1] = zF ? [x0 + t0, x0 + t1] : [z0 + t0, z0 + t1];
          const into = sF.endsWith('0') ? [(zF ? z0 : x0) + q0, (zF ? z0 : x0) + q1] : [(zF ? z1 : x1) - q1, (zF ? z1 : x1) - q0];
          const [xs, zs] = zF ? [[a0, a1], into] : [into, [a0, a1]];
          return { cx: (xs[0] + xs[1]) / 2, cz: (zs[0] + zs[1]) / 2, sx: xs[1] - xs[0], sz: zs[1] - zs[0] };
        };
        let lower, upper, jL, jU;
        if (!up.side) { lower = rect(0, L, 0, pi + T); upper = rect(0, L, pi + T, D); jL = opp[sF]; jU = sF; }
        else if (end > 0) { upper = rect(0, tS, 0, D); lower = rect(tS, L, 0, D); jL = tLo; jU = tHi; }
        else { lower = rect(0, tS, 0, D); upper = rect(tS, L, 0, D); jL = tHi; jU = tLo; }
        const corner = [end > 0 ? tHi : tLo, sF].sort().join('');
        const along = (t) => (zF ? x0 - lower.cx : z0 - lower.cz) + t;
        const [ga, gb] = [along(e0 - end * (LL - 0.05)), along(end > 0 ? L + 1 : -1)].sort((u, v) => u - v);
        shell(kind, lower.cx, lower.cz, 0, lower.sx, lower.sz, base, top, 0.95, { p, lean, leans: { [jL]: 0 }, sharp: [jL, corner], gaps: [{ side: jL, a: -99, b: 99 }, { side: sF, a: ga, b: gb }] });
        shell(kind, upper.cx, upper.cz, 0, upper.sx, upper.sz, base, top2, 0.42, { p, lean: (lean * (top2 - base)) / H, leans: { [jU]: 0 }, sharp: [jU] });
      }
      // the stair: a solid flight of mud brick against the front, fired-brick treads, a wall up its open side
      // (the landing carried over a porch at the door below: its slab on a palm log, a pier at its outer corner;
      // the wall round it, and on into the parapet of the house's side)
      for (let k = 0; k < n; k++) {
        const land = k === n - 1, len = land ? LL : run, ta = end > 0 ? e0 - SL + k * run : e0 + SL - k * run - len, tb = ta + len;
        const yk = gy0 + (k + 1) * rise, yb = land ? top - 0.38 : gy0 - 0.4;
        slab(kind, ta - 0.005, tb + 0.005, -1.05, 0.15, yb, yk, false);
        slab('firedbrick', ta, tb, -1.07, 0.05, yk - 0.03, yk + 0.03, false);
        // (no pots up the flight: they stood in the way; their dice thrown all the same)
        if (!land && k > 1 && k < n - 3 && k % 3 === 0) rng();
      }
      {
        const qo = -1.05 - p, tLand = e0 - end * LL;
        slab(kind, Math.min(e0, e0 - end * 0.36), Math.max(e0, e0 - end * 0.36), qo, -1.05, gy0 - 0.4, top - 0.34);
        get('wood').tube([tw(tLand, qo + p / 2, top - 0.45), tw(e0, qo + p / 2, top - 0.45)], [0.13, 0.13], 7);
        rail(kind, [[...P(e0 - end * SL, qo), gy0 + rise + 0.55, gy0 - 0.4], [...P(tLand, qo), top + 0.95, top - 0.38],
          [...P(e0, qo), top + 0.95, top - 0.38], [...P(e0, 0.05), top + 0.95]], { p, y0: top, slope: lean / H, out: f.n });
      }
      // the upper door, near the stair's head; a window or two. (Side: the door in its end facing the terrace; its
      // windows and beams on its front, over the house's)
      if (up.side) {
        const u = V().subVectors(tw(1, 0, top), tw(0, 0, top)).normalize(), lean2 = lean / H;
        const fS = { n: u.clone().multiplyScalar(end), len: q1, at: (q) => P(tS, q) };
        doorIn(fS, q1 / 2, top, kind);
        const fF = { n: f.n, len: L, at: (t, y) => P(t, lean2 * (y - top)) };
        const span = end > 0 ? [0.7, tS - 0.7] : [tS + 0.7, L - 0.7];
        for (const s2 of [0.3, 0.7]) { const t = span[0] + (span[1] - span[0]) * s2; if (span[1] - span[0] > 1.2 && rng() < 0.75) grille(fF, t, top + 1.75); }
        beamsAt(fF, top2 - 0.3, span[0] - 0.2, span[1] + 0.2);
      }
      const fU = { n: f.n, at: (t) => P(t, T), len: L };
      const tU = up.side ? (end > 0 ? L - TW / 2 : TW / 2) : end > 0 ? L - pi - 2.1 : pi + 2.1;
      if (!up.side) {
        doorIn(fU, tU, top, kind);
        for (const s2 of [-1.7, 1.9]) if (tU + s2 > pi + 0.7 && tU + s2 < L - pi - 0.7 && rng() < 0.75) grille(fU, tU + s2, top + 1.75);
        beamsAt(fU, top2 - 0.3, pi + 0.5, L - pi - 0.4);
      }
      // on the terrace: pots by the upper door, a painted jar, a rug over the parapet; more, beyond the door
      for (const s2 of [-0.95, 0.95]) {
        if (up.side) {   // (by the door in the room's end, either side of it)
          const c = tw(tS + end * 0.35, q1 / 2 + s2, top);
          pot(c.x, top - 0.01, c.z, 0.9 + rng() * 0.3);
          continue;
        }
        if (tU + s2 < pi + 0.5 || tU + s2 > L - pi - 0.5) continue;
        const c = tw(tU + s2, T - 0.35, top);
        pot(c.x, top - 0.01, c.z, 0.9 + rng() * 0.3);
      }
      const far = up.side ? [-1, -1] : end > 0 ? [pi + 0.45, tU - 1.25] : [tU + 1.25, L - pi - 0.45];
      if (far[1] - far[0] > 0.8) {
        const j = tw(far[0] + 0.45 + rng() * (far[1] - far[0] - 0.9), T - 0.5, top);
        paintedJar(j.x, top - 0.03, j.z, 0.75, rng() * 6, Math.floor(rng() * 3));
      }
      // (a rug over the terrace's parapet, where no stair runs below it: over the front beside the stair's foot)
      {
        const rw = 1.2, [r0, r1] = up.room;
        if (r1 - r0 > rw + 0.5 && !up.side) rugOver((u) => tw((r0 + r1) / 2 + u, 0, top), f.n, top, { ph: 0.95, p: 0.36, rw, drop: 1.7, overBeams: true });
      }
      if (far[1] - far[0] > 2) {
        const [ax, az] = P(far[0], 0.5), [bx, bz] = P(far[1], T - 0.2);
        roofLife({ x0: Math.min(ax, bx), x1: Math.max(ax, bx), z0: Math.min(az, bz), z1: Math.max(az, bz) }, top, 1 + Math.floor(rng() * 2), { shade: false });
      }
      uppers.push({ x0, x1, z0, z1, y: top });
      // (and the stair's own ground: trees on the square kept off it)
      {
        const [ax, az] = P(end > 0 ? L - SL : 0, -1.3), [bx, bz] = P(end > 0 ? L : SL, 0);
        uppers.push({ x0: Math.min(ax, bx), x1: Math.max(ax, bx), z0: Math.min(az, bz), z1: Math.max(az, bz), y: top });
      }
    }
    return { top, up: !!up };
  };

  // ---- a small house turned square to a lane that runs at a slant to the plan (frontHouse): W along the lane,
  // D deep, centred at (cx, cz), its front facing n (towards the lane); its door at tDoor along the front with its
  // sill at gy (the lane there); built out as the detailed ones are (heroBuild), its door dressed. lo: the lowest
  // ground under it (on a slope its lower storey goes down to it) ----
  // A door dressed with something standing out in front of it (a trellis, an awning, a tree) has the house set
  // back behind a small yard (YARD deep) so nothing stands in the lane: the yard level at the door's sill, trodden
  // earth, a waist-high wall along the lane (laneHi: the lane's height at the higher end) with a gate at the door,
  // two metres wide (a cart's or a laden donkey's). lim: where along its front its jars and pots may stand
  const YARD = 2.5;
  const lowWall = (kind, x, z, yaw, len, y0, y1) => wall(kind, x, (y0 + y1) / 2, z, len, y1 - y0, 0.34, yaw);
  // split: { q, high }: in two, q back from its front; the part on high's side ('front' or 'back') a storey higher,
  // its sides in line with the other's, the other's roof its terrace (hillTown.js TOWN_EDITS.upperRoom)
  const frontHouse = ({ cx, cz, n, W, D, lo, top, kind, tDoor, gy, laneHi = gy, dress = true, lim, split = null }) => {
    const u = V(-n.z, 0, n.x), yaw = Math.atan2(n.x, n.z);
    let R2 = dress ? nextRecipe() : null, yard = 0;
    if (R2 && reaches(R2)) { if (D >= 6.4) yard = YARD; else R2 = RECIPES[rng() < 0.5 ? 0 : 3]; }
    if (yard) {
      const fr = (t, q) => [cx + u.x * (t - W / 2) + n.x * (D / 2 - q), cz + u.z * (t - W / 2) + n.z * (D / 2 - q)];
      // (its floor a few centimetres back from the wall's face along the lane: in one plane they flickered)
      const [yx, yz] = fr(W / 2, yard / 2 + 0.02);
      box('path', yx, (gy - 0.02 + lo - 0.6) / 2, yz, W - 0.2, gy - 0.02 - (lo - 0.6), yard - 0.04, yaw);
      const cs = [fr(0, 0), fr(W, 0), fr(0, yard), fr(W, yard)];
      yards.push({ x0: Math.min(...cs.map((c) => c[0])), x1: Math.max(...cs.map((c) => c[0])), z0: Math.min(...cs.map((c) => c[1])), z1: Math.max(...cs.map((c) => c[1])), y: gy - 0.06, n });
      const wt = Math.max(gy, laneHi) + 0.95;
      for (const [a, b] of [[0, tDoor - 1.05], [tDoor + 1.05, W]]) {
        if (b - a < 0.3) continue;
        const [wx, wz] = fr((a + b) / 2, 0.17);
        lowWall(kind, wx, wz, yaw, b - a, lo - 0.6, wt);
      }
      for (const t of [0.17, W - 0.17]) { const [wx, wz] = fr(t, yard / 2); lowWall(kind, wx, wz, yaw + Math.PI / 2, yard, lo - 0.6, wt); }
      cx -= n.x * yard / 2; cz -= n.z * yard / 2; D -= yard;
    }
    const base = lo - 0.6, H = top - base, lean = 0.12;
    // its walls and the parapet round its roof, one piece (its sides upright: it stands in a row); split, two pieces,
    // their fronts and backs leaning alike
    const T2 = top + 2.9;
    if (!split) shell(kind, cx, cz, yaw, W, D, base, top, 0.45, { p: 0.36, lean, leanX: 0 });
    else {
      // (the lower's parapet left out along the side against the higher: the terrace runs flat to its wall, its door)
      // (the face between the two upright, its corners square: the two parts' sides run on in one plane)
      const part = (a, b, tp, j, gaps = []) => shell(kind, cx + n.x * (D / 2 - (a + b) / 2), cz + n.z * (D / 2 - (a + b) / 2), yaw, W, b - a, base, tp, 0.45, { p: 0.36, lean: (lean * (tp - base)) / H, leanX: 0, leans: { [j]: 0 }, sharp: [j], gaps });
      const hiFront = split.high === 'front', qa = hiFront ? split.q : 0, qb = hiFront ? D : split.q;
      const gaps = [{ side: hiFront ? 'z1' : 'z0', a: -W, b: W }];
      // (and where the stair comes up, split.open: a stretch of a side given in the world's terms, turned into the
      // shell's own (its x along (n.z, -n.x), its z along n))
      if (split.open) {
        const o = split.open, lx = V(n.z, 0, -n.x), nrm = V(o.side[0] === 'x' ? (o.side[1] === '1' ? 1 : -1) : 0, 0, o.side[0] === 'z' ? (o.side[1] === '1' ? 1 : -1) : 0);
        const side = nrm.dot(lx) > 0.5 ? 'x1' : nrm.dot(lx) < -0.5 ? 'x0' : nrm.dot(n) > 0.5 ? 'z1' : 'z0';
        const pc = V(cx + n.x * (D / 2 - (qa + qb) / 2), 0, cz + n.z * (D / 2 - (qa + qb) / 2)), along = side[0] === 'x' ? n : lx;
        const at = (v) => V(o.side[0] === 'x' ? 0 : v, 0, o.side[0] === 'x' ? v : 0).sub(V(o.side[0] === 'x' ? 0 : pc.x, 0, o.side[0] === 'x' ? pc.z : 0)).dot(along);
        const [a, b] = [at(o.from), at(o.to)].sort((u, v) => u - v);
        gaps.push({ side, a, b });
      }
      part(qa, qb, top, hiFront ? 'z1' : 'z0', gaps);
      part(hiFront ? 0 : split.q, hiFront ? split.q : D, T2, hiFront ? 'z0' : 'z1');
    }
    const inset = (y) => (lean * (y - base)) / H;
    const at = (t, q, y) => [cx + u.x * (t - W / 2) + n.x * (D / 2 - inset(y) - q), cz + u.z * (t - W / 2) + n.z * (D / 2 - inset(y) - q)];
    const f = { n, len: W, at: (t, y) => at(t, 0, y) };
    // the plinth along the front, broken for the door (down to the wall's foot: where the lane falls along the
    // front, it shows to the steps there)
    const plinth = kind === 'whitewash' ? 'plaster' : 'firedbrick';
    for (const [a, b] of [[0, tDoor - 0.75], [tDoor + 0.75, W]]) {
      if (b - a < 0.2) continue;
      const [mx, mz] = at((a + b) / 2, 0, gy);
      box(plinth, mx + n.x * 0.06, (gy + 0.8 + base) / 2, mz + n.z * 0.06, b - a, gy + 0.8 - base, 0.16, yaw);
    }
    doorIn(f, tDoor, gy, kind);
    for (const s2 of [-1.7, 1.7]) if (tDoor + s2 > 0.7 && tDoor + s2 < W - 0.7 && rng() < 0.6) grille(f, tDoor + s2, gy + 2.85);
    // (split: the upper storey's windows, two in each of its walls to the outside, under a row of its own beams)
    if (split) {
      const hiFront = split.high === 'front', q0 = hiFront ? 0 : split.q, q1 = hiFront ? split.q : D, wy = top + 1.5;
      for (const s2 of [-1, 1]) {
        const fs = { n: u.clone().multiplyScalar(s2), len: q1 - q0, at: (t, y) => [cx + u.x * s2 * W / 2 + n.x * (D / 2 - q0 - t), cz + u.z * s2 * W / 2 + n.z * (D / 2 - q0 - t)] };
        for (const k of [0.3, 0.7]) grille(fs, (q1 - q0) * k, wy);
      }
      const fo = hiFront ? f : { n: n.clone().negate(), len: W, at: (t, y) => at(W - t, D - 2 * inset(y), y) };
      for (const k of [0.3, 0.7]) grille(fo, W * k, wy);
    }
    beamsAt(f, top - 0.3, 0.5, W - 0.4);
    if (split?.high === 'front') beamsAt(f, T2 - 0.3, 0.5, W - 0.4);
    // (the back, looking out over the roofs below: a small window or two, high)
    const back = { n: n.clone().negate(), len: W, at: (t, y) => at(W - t, D - 2 * inset(y), y) };
    for (let k = 0, nw = Math.floor(rng() * 3); k < nw; k++) {
      const t = 0.8 + rng() * (W - 1.6), wy = top - 1.0 - rng() * 0.8;
      const [wx, wz] = back.at(t, wy);
      box('dark', wx + back.n.x * 0.03, wy, wz + back.n.z * 0.03, 0.34, 0.42, 0.1, yaw);
    }
    if (rng() < 0.5) {
      const [sx2, sz2] = at(Math.min(W - 0.6, tDoor + 2.2), 0, top);
      spout(new THREE.Matrix4().compose(V(sx2 + n.x * 0.35, top + 0.05, sz2 + n.z * 0.35), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(1, 1, 1)));
    }
    if (R2) dressDoor(f, tDoor, gy, top, inset, top, lim, R2, yard ? () => gy : sillAt);
    if (rng() < 0.5) { const [jx, jz] = at(W * (0.25 + rng() * 0.5), D * 0.5, top); if (!split) get('clay').add(JAR, new THREE.Matrix4().compose(V(jx, top, jz), new THREE.Quaternion(), V(0.6, 0.6, 0.6))); }
    // a reed shade on about half the roofs: under the stair only where its top stays under the eyes of one on
    // the stair (as on the others: build)
    const sCap = capAt?.({ x0: cx - 0.1, x1: cx + 0.1, z0: cz - 0.1, z1: cz + 0.1 }) ?? Infinity;
    // (none on a split one's terrace: its stair comes up there)
    if (rng() < 0.5 && W > 4.4 && D > 4 && (sCap === Infinity || sCap - top > 1.0) && !split) {
      const sw = Math.min(2.6 + rng() * 1.2, W - 1.2), sd = Math.min(2.2 + rng() * 0.8, D - 1.4);
      const tc = W / 2 + (rng() - 0.5) * (W - sw - 1.2), qc = D / 2;
      for (const dt of [-sw / 2 + 0.2, sw / 2 - 0.2]) {
        for (const dq of [-sd / 2 + 0.2, sd / 2 - 0.2]) { const [px, pz] = at(tc + dt, qc + dq, top); box('wood', px, top + 0.95, pz, 0.1, 1.9, 0.1, yaw); }
      }
      const [mx, mz] = at(tc, qc, top);
      reedMat(mx, top + 1.92, mz, sw, sd, yaw);
    }
    return { top, T2: split ? T2 : top, inset, yard };
  };

  // ---- a little walled garden on a lane, where a house would stand over the view: level at the lane, a
  // waist-high wall round it with a gate (at gate along it, or anywhere), a tree in it (decor.trees, for the scene to
  // grow), pots, a bench ----
  const garden = ({ cx, cz, n, W, D, lo, gy, laneHi = gy, kind = 'whitewash', gate }) => {
    const u = V(-n.z, 0, n.x), yaw = Math.atan2(n.x, n.z);
    const fr = (t, q) => [cx + u.x * (t - W / 2) + n.x * (D / 2 - q), cz + u.z * (t - W / 2) + n.z * (D / 2 - q)];
    box('earth', cx, (gy - 0.03 + lo - 0.6) / 2, cz, W - 0.1, gy - 0.03 - (lo - 0.6), D - 0.1, yaw);
    const wt = Math.max(gy, laneHi) + 1.0, g0 = gate ?? W / 2 + (rng() - 0.5) * (W - 2.8), gh = 0.975;
    for (const [a, b] of [[0, g0 - gh], [g0 + gh, W]]) {
      if (b - a < 0.3) continue;
      const [wx, wz] = fr((a + b) / 2, 0.17);
      lowWall(kind, wx, wz, yaw, b - a, lo - 0.6, wt);
    }
    { const [wx, wz] = fr(W / 2, D - 0.17); lowWall(kind, wx, wz, yaw, W, lo - 0.6, gy + 1.0); }
    for (const t of [0.17, W - 0.17]) { const [wx, wz] = fr(t, D / 2); lowWall(kind, wx, wz, yaw + Math.PI / 2, D, lo - 0.6, wt); }
    // (the gate: two posts and a beam)
    for (const s of [-gh, gh]) { const [px, pz] = fr(g0 + s, 0.17); box('wood', px, (gy + wt + 1.0) / 2, pz, 0.14, wt + 1.0 - gy, 0.14, yaw); }
    { const [px, pz] = fr(g0, 0.17); box('wood', px, wt + 1.0, pz, 2 * gh + 0.3, 0.14, 0.2, yaw); }
    const [tx, tz] = fr(W * (0.3 + rng() * 0.4), D * 0.55);
    decor.trees.push({ x: tx, z: tz, y: gy, kind: ['pomegranate', 'fig', 'palm'][Math.floor(rng() * 3)] });
    for (let k = 0; k < 3; k++) { const [px, pz] = fr(0.6 + rng() * (W - 1.2), D - 0.6); pot(px, gy - 0.02, pz, 0.8 + rng() * 0.4); }
    if (rng() < 0.6) { const [bx, bz] = fr(W * 0.5, D - 0.65); box(kind, bx, gy + 0.22, bz, Math.min(2.2, W - 1), 0.45, 0.45, yaw); }
    // (its walls' tops: along the lane and the sides, and at the back)
    return { front: wt, back: gy + 1.0 };
  };

  // ---- the meshes: one per kind; returns those one walks on and against ----
  // (a kind with many triangles in tiles 60 m across, so the view and the shadow maps leave out those they do not
  // reach; the small things (cloth, pots and jars, fruit) left out from 120 m off, where they are a pixel or two)
  const meshes = (scene, walked = WALKED) => {
    const walkables = [];
    for (const [key, b] of Object.entries(B)) {
      if (!b.count) continue;
      const [kind, flap] = key.split('~'), wv = kind.startsWith('weave') ? +kind.slice(5) : null;
      const material = wv !== null ? lightMat({ kind: 'linen', side: THREE.DoubleSide, flap: true, colorMap: weaveTexture(wv) })
        : lightMat({ kind, side: THIN.includes(kind) ? THREE.DoubleSide : THREE.FrontSide, flap: !!flap });
      const g = b.build();
      const small = SMALL.includes(kind) || wv !== null;
      const parts = g.index.count / 3 > 20000 || small ? splitTiles(g, 60) : [g];
      for (const part of parts) {
        const m = new THREE.Mesh(part, material);
        if (material.userData.depthMat) m.customDepthMaterial = material.userData.depthMat;
        m.castShadow = m.receiveShadow = true;
        m.name = key;
        scene.add(m);
        if (small) lodAdd(m, { max: 120 });
        if (walked.includes(kind) && !flap) walkables.push(m);
      }
    }
    return walkables;
  };

  return { B, get, box, wall, unit, courts, doors, windows, decor, uppers, yards, groundOf, props, build, heroBuild, frontHouse, garden, roofLife, battered, shell, rail, face4, paintedJar, conePanel, reedMat, cloth, weave, rugOver, pot, meshes };
}
