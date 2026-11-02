// The teacher's house: a courtyard house of the kind Woolley dug in Ur's town quarter,
// of the time of Isin and Larsa (some 1900 BC), and across the lane from its door the little square at the stair's
// foot, a wayside shrine in its corner.
//
// One walks in. From the curved lane a door opens into the vestibule; from there one turns (from the lane one never
// sees into the court) under the gallery into the court, four metres across, paved with fired brick, a drain in its
// middle. Round it on the ground floor: the storeroom (great jars), the tablet room (old tablets on benches, in jars
// and baskets) and the clay room (a basin where spent tablets are soaked back into clay, new ones drying), the
// kitchen by the vestibule (bread oven, hearth, quern), the long reception room across the back, here the schoolroom
// (its master teaches in his house: benches, round practice tablets, his seat), and behind it the family's chapel
// (an altar and a niche, the dead under its floor in a vault of fired brick, a small meal set out for them). A brick
// stair climbs the court's east side to a wooden gallery round its other three sides on palm posts; the upper rooms'
// doors open on it (shut: they are not entered). Two storeys round a court four metres across: a well of light. In
// the court a ground loom with a half-woven cloth, a rug over the gallery's rail, new tablets drying in the sun.
//
// The outline follows the lanes (hillPlan.js COURT_HOUSE): the way up's south side, the temple lane's west; all
// square (the lane side is kept as two stretches in one line, P0 to P1 to P2: the rooms along it are laid out from
// it, as when it was bent along a slanting lane). Built in layers, each one
// plan extruded so that no two faces lie in one plane: the podium filling the slope up to the floor; the ground
// floor's walls (blocks, their doorways gaps); a band over the doorways; the upper floor; the upper storey (solid);
// the parapets.

import * as THREE from 'three';
import { JAR } from './houseKit.js';
import { COURT_HOUSE, COURT_SQUARE, COURT_SQUARE_BACK, COURT_YARD, inCourtHouse } from './hillPlan.js';
import { groundLoom } from './workshop.js';
import { clayTablet } from './buildingDetails.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const ID = new THREE.Matrix4();

export function buildCourtHouse(kit, { heightAt, sillAt, rng }) {
  const trees = [];   // (planted by hillScene.js with their own dice: town.extraTrees)
  const { get, box, cloth, rugOver, pot, paintedJar, roofLife, decor } = kit;
  const F = COURT_HOUSE.floor, OUT = COURT_HOUSE.outline;
  const T = 0.6, t = 0.45;   // the outer walls, the inner
  const G = F + 3.15;        // the upper floor (the gallery's boards)
  const ROOF = F + 6.15;
  // a box by its extents
  const bx = (kind, x0, x1, y0, y1, z0, z1) => box(kind, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0);
  // a plan (outer outline, holes) extruded from y0 to y1
  const extrude = (kind, outer, holes, y0, y1) => {
    const sh = new THREE.Shape(outer.map(([x, z]) => new THREE.Vector2(x, z)));
    for (const h of holes) sh.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, z))));
    const g = new THREE.ExtrudeGeometry(sh, { depth: y1 - y0, bevelEnabled: false, curveSegments: 1 });
    g.rotateX(Math.PI / 2).translate(0, y1, 0).deleteAttribute('uv');
    get(kind).add(g, ID);
    g.dispose();
  };
  const rect = (x0, x1, z0, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];

  // ---- the plan ----
  const [P0, P1, P2, P3] = OUT;
  const XW = P2[0] + T, XE = P0[0] - T, ZS = P3[1] - T;
  // the lane side: two stretches (P2 to P1 to P0); its outer face and its inner, as z at x
  const kA = (P0[1] - P1[1]) / (P0[0] - P1[0]), kB = (P1[1] - P2[1]) / (P1[0] - P2[0]);
  const northIn = (x) => Math.min(P1[1] + (x - P1[0]) * kA + T * Math.hypot(1, kA), P1[1] + (x - P1[0]) * kB + T * Math.hypot(1, kB));
  const bendIn = kA === kB ? NaN : P1[0] + (T * Math.hypot(1, kB) - T * Math.hypot(1, kA)) / (kA - kB);
  // a room along the lane side: x0..x1, from the lane wall's inner face back to z1
  const northRoom = (x0, x1, z1) => [[x0, northIn(x0)], ...(bendIn > x0 && bendIn < x1 ? [[bendIn, northIn(bendIn)]] : []), [x1, northIn(x1)], [x1, z1], [x0, z1]];
  const C = { x0: 1.4, x1: 5.6, z0: 39.6, z1: 43.8 };   // the court
  const zN = C.z0 - t, zSo = C.z1 + t, xWw = C.x0 - t, xEw = C.x1 + t;
  const ROOMS = {
    archive: northRoom(XW, xWw, zN), store: northRoom(C.x0, 4.15, zN), vest: northRoom(4.6, XE, zN),
    clay: rect(XW, xWw, C.z0, C.z1), kitchen: rect(xEw, XE, C.z0, C.z1),
    school: rect(C.x0, XE, zSo, ZS), chapel: rect(XW, xWw, zSo, ZS),
  };
  const court = rect(C.x0, C.x1, C.z0, C.z1);

  // the ground round it, for the podium's foot
  let low = Infinity;
  for (let i = 0; i < OUT.length; i++) {
    const a = OUT[i], b = OUT[(i + 1) % OUT.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const dx = (b[0] - a[0]) / len, dz = (b[1] - a[1]) / len;
    for (let s = 0; s <= len; s += 0.5) low = Math.min(low, heightAt(a[0] + dx * s - dz * 0.9, a[1] + dz * s + dx * 0.9));
  }
  const base = Math.min(low, F) - 0.6;

  // ---- the shell ----
  extrude('plaster', OUT, [], base, F - 0.02);                 // the podium
  extrude('path', OUT, [court], F - 0.02, F);                  // the rooms' floor of trodden earth
  extrude('firedbrick', court, [], F - 0.02, F + 0.02);        // the court's paving
  extrude('whitewash', OUT, [...Object.values(ROOMS), court], F + 2.2, F + 2.95);   // over the doorways
  extrude('whitewash', OUT, [court], F + 2.95, G);             // the upper floor
  extrude('whitewash', OUT, [court], G, ROOF);                 // the upper storey
  // the parapets: round the roof, and round the court's mouth
  const inset = (pts, d) => pts.map((p, i) => {
    const a = pts[(i + pts.length - 1) % pts.length], b = pts[(i + 1) % pts.length];
    const n1 = norm2(p[0] - a[0], p[1] - a[1]), n2 = norm2(b[0] - p[0], b[1] - p[1]);
    // (each side moved in by d: the inward normal of a side running (dx, dz) is (dz, -dx))
    const o1 = [p[0] + n1[1] * d, p[1] - n1[0] * d], o2 = [p[0] + n2[1] * d, p[1] - n2[0] * d];
    const den = n1[0] * n2[1] - n1[1] * n2[0];
    if (Math.abs(den) < 1e-6) return o1;
    const s = ((o2[0] - o1[0]) * n2[1] - (o2[1] - o1[1]) * n2[0]) / den;
    return [o1[0] + n1[0] * s, o1[1] + n1[1] * s];
  });
  extrude('whitewash', OUT, [inset(OUT, 0.35)], ROOF, ROOF + 0.55);
  extrude('whitewash', rect(C.x0 - 0.3, C.x1 + 0.3, C.z0 - 0.3, C.z1 + 0.3), [court], ROOF, ROOF + 0.4);

  // the ground floor's walls, up to the doorways' heads: the outer ones (the lane side in its two stretches, a
  // door in the nearer), the inner ones; doorways [from, to] along each
  const run = (kind, x0, x1, z0, z1, doors, alongX) => {
    let s = alongX ? x0 : z0;
    const end = alongX ? x1 : z1;
    for (const [d0, d1] of [...doors, [end, end]]) {
      if (d0 - s > 0.02) alongX ? bx(kind, s, d0, F, F + 2.2, z0, z1) : bx(kind, x0, x1, F, F + 2.2, s, d0);
      s = d1;
    }
  };
  const W1 = 'whitewash';
  // (the lane door: across x 6.75..8.05 on the nearer stretch, some 1.4 m wide: a double door)
  const edge = (a, b) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), d = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
    return { a, b, len, d, n: [-d[1], d[0]], at: (s, o = 0) => [a[0] + d[0] * s - d[1] * o, a[1] + d[1] * s + d[0] * o] };
  };
  const EDGES = OUT.map((a, i) => edge(a, OUT[(i + 1) % OUT.length]));
  const lane = EDGES[0], lane2 = EDGES[1];   // (P0 to P1, P1 to P2: running west; their n looks out onto the lane)
  const doorS = [(P0[0] - 8.05) / -lane.d[0], (P0[0] - 6.75) / -lane.d[0]];
  for (const [e, gaps] of [[lane, [doorS]], [lane2, []]]) {
    let s = 0;
    for (const [d0, d1] of [...gaps, [e.len, e.len]]) {
      if (d0 - s > 0.02) {
        const [mx, mz] = e.at((s + d0) / 2, -T / 2);
        box(W1, mx, F + 1.1, mz, d0 - s, 2.2, T, Math.atan2(-e.d[1], e.d[0]));
      }
      s = d1;
    }
  }
  bx(W1, XE, P0[0], F, F + 2.2, P0[1], P3[1]);                                  // east
  bx(W1, P2[0], XW, F, F + 2.2, P2[1] + (XW - P2[0]) * kB, P3[1]);             // west
  bx(W1, P2[0], P0[0], F, F + 2.2, ZS, P3[1]);                                  // back
  run(W1, XW, XE, zN, C.z0, [[-0.75, 0.1], [2.35, 3.2], [4.7, 5.55], [6.8, 7.65]], true);
  run(W1, XW, XE, C.z1, zSo, [[2.4, 3.8]], true);
  run(W1, xWw, C.x0, northIn(xWw) - 0.3, zN, [], false);
  run(W1, xWw, C.x0, C.z0, C.z1, [[41.3, 42.15]], false);
  run(W1, xWw, C.x0, zSo, ZS, [[45.6, 46.45]], false);
  run(W1, 4.15, 4.6, northIn(4.6) - 0.3, zN, [], false);
  run(W1, C.x1, xEw, C.z0, C.z1, [], false);
  // the rooms' ceilings: palm logs under them, across the short way
  const logs = (x0, x1, z0At, z1) => {
    for (let x = x0 + 0.35; x < x1 - 0.2; x += 0.62) {
      const g = new THREE.CylinderGeometry(0.075, 0.085, z1 - z0At(x) + 0.2, 6).rotateX(Math.PI / 2).deleteAttribute('uv');
      get('wood').add(g, new THREE.Matrix4().makeTranslation(x, F + 2.87, (z0At(x) + z1) / 2));
      g.dispose();
    }
  };
  logs(XW, xWw, northIn, zN);
  logs(C.x0, 4.15, northIn, zN);
  logs(4.6, XE, northIn, zN);
  logs(XW, xWw, () => C.z0, C.z1);
  logs(xEw, XE, () => C.z0, C.z1);
  logs(C.x0, XE, () => zSo, ZS);
  logs(XW, xWw, () => zSo, ZS);

  // ---- doors, windows, beams ----
  const ring = new THREE.TorusGeometry(0.07, 0.014, 6, 14).deleteAttribute('uv');
  // a feature on a face: p its point on the face at height y, n out from it; o out, s along, at y
  const onFace = (p, n) => {
    const side = [n[1], -n[0]], yaw = Math.atan2(n[0], n[1]);
    return { yaw, at: (o, s) => [p[0] + n[0] * o + side[0] * s, p[1] + n[1] * o + side[1] * s] };
  };
  const put = (k, f, o, s, y, sx, sy, sz) => { const [x, z] = f.at(o, s); box(k, x, y, z, sx, sy, sz, f.yaw); };
  // a shut door (the upper rooms', on the gallery)
  const shutDoor = (p, n, y) => {
    const f = onFace(p, n);
    put('wood', f, 0.08, -0.6, y + 1.08, 0.18, 2.15, 0.18);
    put('wood', f, 0.08, 0.6, y + 1.08, 0.18, 2.15, 0.18);
    put('wood', f, 0.1, 0, y + 2.25, 1.6, 0.2, 0.26);
    for (let k = 0; k < 5; k++) put('wood', f, 0.03, -0.42 + k * 0.21, y + 1.04, 0.2, 2.05, 0.06);
    for (const yy of [y + 0.45, y + 1.7]) put('wood', f, 0.07, 0, yy, 0.98, 0.1, 0.04);
    const [rx, rz] = f.at(0.08, 0.3);
    get('bronze').add(ring, new THREE.Matrix4().compose(V(rx, y + 1.1, rz), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), f.yaw), V(1, 1, 1)));
  };
  // a small high window: a wooden frame round a grille of three bars on the dark behind
  const grille = (p, n, y) => {
    const f = onFace(p, n);
    put('dark', f, 0.02, 0, y, 0.5, 0.55, 0.05);
    put('wood', f, 0.06, 0, y + 0.32, 0.66, 0.08, 0.1);
    put('wood', f, 0.06, 0, y - 0.32, 0.66, 0.08, 0.1);
    for (const s of [-0.14, 0, 0.14]) put('wood', f, 0.06, s, y, 0.04, 0.56, 0.04);
  };
  // outside: the roof beams' ends under the parapet, the windows of the upper rooms (and the kitchen's vent on the
  // temple lane), a rain spout
  const beam = new THREE.CylinderGeometry(0.085, 0.095, 0.55, 7).rotateX(Math.PI / 2).deleteAttribute('uv');
  for (const e of EDGES) {
    const yaw = Math.atan2(e.n[0], e.n[1]);
    for (let s = 0.6; s < e.len - 0.4; s += 1.0) {
      const [x, z] = e.at(s, 0.2);
      get('wood').add(beam, new THREE.Matrix4().compose(V(x, ROOF - 0.2, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(1, 1, 1)));
    }
  }
  for (const [e, ss] of [[EDGES[0], [2.2]], [EDGES[1], [1.6, 4.2]], [EDGES[2], [4.5, 9, 13.5]], [EDGES[3], [2.5, 7.5]], [EDGES[4], [2.5, 6.5, 9.6]]]) {
    for (const s of ss) grille(e.at(s), e.n, G + 1.55);
  }
  grille(EDGES[4].at(6.5), EDGES[4].n, F + 1.75);
  {
    const e = EDGES[1], [x, z] = e.at(e.len * 0.55, 0.3), yaw = Math.atan2(e.n[0], e.n[1]);
    const g = new THREE.CylinderGeometry(0.07, 0.09, 0.7, 8, 1, true).rotateX(Math.PI / 2 - 0.2).deleteAttribute('uv');
    get('clay').add(g, new THREE.Matrix4().compose(V(x, ROOF + 0.15, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(1, 1, 1)));
    g.dispose();
  }
  // rugs thrown over the roof's parapet to air, hanging down the walls over the beams' ends: on the lane (clear of
  // the windows, the spout and the door's awning), over the yard and on the temple lane
  for (const [e, s0, rw, drop] of [[EDGES[0], 4.0, 1.1, 1.6], [EDGES[1], 5.4, 1.2, 1.9], [EDGES[2], 2.1, 1.4, 2.4], [EDGES[4], 4.5, 1.3, 1.7]]) {
    rugOver((u) => { const [x, z] = e.at(s0 + u); return V(x, ROOF, z); }, V(e.n[0], 0, e.n[1]), ROOF, { ph: 0.55, p: 0.35, rw, drop, overBeams: true });
  }
  // the lane door: its frame, the threshold, its two leaves swung back inside (the west one against the lane
  // wall, the east one against the vestibule's end wall); a step up from the lane; a striped awning over it on two
  // wooden brackets
  {
    const f = onFace(lane.at((doorS[0] + doorS[1]) / 2), lane.n), w = doorS[1] - doorS[0];
    put('wood', f, 0.06, -(w / 2 + 0.09), F + 1.12, 0.18, 2.25, 0.22);
    put('wood', f, 0.06, w / 2 + 0.09, F + 1.12, 0.18, 2.25, 0.22);
    put('wood', f, 0.08, 0, F + 2.33, w + 0.75, 0.24, 0.3);
    put('stone', f, -T / 2, 0, F, w, 0.06, T + 0.04);
    const [ox, oz] = f.at(0.6, 0), sill = sillAt(ox, oz);
    if (F - sill > 0.08) put('stone', f, 0.24, 0, (F + sill) / 2 - 0.25, w + 0.5, 0.5, 0.46);
    const lw = w / 2;
    const lf = onFace(lane.at(doorS[1] + lw / 2 + 0.02, -T - 0.05), lane.n);
    put('wood', lf, 0, 0, F + 1.08, lw, 2.1, 0.07);
    for (const yy of [F + 0.45, F + 1.7]) put('wood', lf, -0.05, 0, yy, lw - 0.04, 0.1, 0.04);
    const rf = onFace(lane.at(doorS[0] + 0.06, -T), lane.d);
    put('wood', rf, 0, lw / 2 + 0.02, F + 1.08, lw, 2.1, 0.07);
    for (const yy of [F + 0.45, F + 1.7]) put('wood', rf, -0.05, lw / 2 + 0.02, yy, lw - 0.04, 0.1, 0.04);
    // (the awning: from the wall over the lintel out over the lane, sagging a little, its outer edge lifting in
    // the wind; brackets from the wall under its corners)
    const sm = (doorS[0] + doorS[1]) / 2, AW = w + 0.9, AD = 1.15, ya = F + 2.85, yb = F + 2.45;
    const ap = (i, j) => {
      const v = i / 4, [x, z] = lane.at(sm + (j / 6 - 0.5) * AW, 0.05 + v * AD);
      return V(x, ya + (yb - ya) * v - 0.1 * Math.sin(Math.PI * v), z);
    };
    cloth(ap, 4, 6, { weave: 3 }, true, V(lane.n[0] * 0.3, 1, lane.n[1] * 0.3),
      (i, j) => [0, 0.08 * Math.sin((Math.PI * i) / 4) + 0.07 * (i / 4) * Math.sin((Math.PI * j) / 6), 0, 2]);
    for (const j of [0, 6]) {
      const o = ap(4, j), [wx, wz] = lane.at(sm + (j / 6 - 0.5) * AW, 0.02);
      get('wood').tube([V(wx, F + 1.75, wz), V(o.x, o.y - 0.03, o.z)], [0.04, 0.04], 5);
      get('wood').tube([V(wx, ya - 0.02, wz), V(o.x, o.y - 0.03, o.z)], [0.035, 0.035], 5);
    }
  }

  // ---- the court: the gallery on its posts, the stair, the upper rooms' doors ----
  // (the gallery's boards, joists of palm log into the walls, an edge beam on the posts)
  const GN = { x0: C.x0, x1: C.x1, z0: C.z0, z1: C.z0 + 0.9 }, GW = { x0: C.x0, x1: C.x0 + 0.9, z0: GN.z1, z1: C.z1 - 0.9 };
  const GS = { x0: C.x0, x1: C.x1, z0: C.z1 - 0.9, z1: C.z1 };
  for (const g of [GN, GW, GS]) bx('wood', g.x0, g.x1, G - 0.06, G + 0.02, g.z0, g.z1);
  const joist = (a, b) => get('wood').tube([a, b], [0.07, 0.07], 6);
  for (let x = C.x0 + 0.3; x < C.x1; x += 0.55) {
    joist(V(x, G - 0.14, C.z0 - 0.1), V(x, G - 0.14, GN.z1));
    joist(V(x, G - 0.14, C.z1 + 0.1), V(x, G - 0.14, GS.z0));
  }
  for (let z = GW.z0 + 0.3; z < GW.z1; z += 0.55) joist(V(C.x0 - 0.1, G - 0.14, z), V(GW.x1, G - 0.14, z));
  bx('wood', C.x0, C.x1, G - 0.3, G - 0.06, GN.z1 - 0.18, GN.z1);
  bx('wood', C.x0, C.x1, G - 0.3, G - 0.06, GS.z0, GS.z0 + 0.18);
  bx('wood', GW.x1 - 0.18, GW.x1, G - 0.3, G - 0.06, GN.z1, GS.z0);
  // (palm-trunk posts at its inner corners)
  const SX = 4.7;   // the stair's west side
  for (const [x, z] of [[GW.x1 - 0.09, GN.z1 - 0.09], [GW.x1 - 0.09, GS.z0 + 0.09], [SX - 0.1, GN.z1 - 0.09], [SX - 0.1, GS.z0 + 0.09]]) {
    get('bark').tube([V(x, F, z), V(x, G - 0.3, z)], [0.13, 0.12], 8);
  }
  // (its rail: balusters, a rail at knee height and one on top; none lower than a step, so one can neither walk
  // through it nor climb it)
  const rail = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0), ux = (x1 - x0) / len, uz = (z1 - z0) / len, yaw = Math.atan2(-uz, ux);
    for (const [y, h] of [[G + 0.8, 0.1], [G + 1.0, 0.08]]) box('wood', (x0 + x1) / 2, y, (z0 + z1) / 2, len, h, 0.07, yaw);
    for (let s = 0; s <= len + 0.01; s += 0.25) box('wood', x0 + ux * s, G + 0.5, z0 + uz * s, 0.045, 1.0, 0.045, yaw);
  };
  rail(GW.x1 - 0.05, GN.z1 - 0.05, SX - 0.1, GN.z1 - 0.05);
  rail(GW.x1 - 0.05, GN.z1 - 0.05, GW.x1 - 0.05, GS.z0 + 0.05);
  rail(GW.x1 - 0.05, GS.z0 + 0.05, C.x1, GS.z0 + 0.05);
  // the stair up the court's east side, north to the gallery: fired brick, a parapet on its open side
  {
    const n = 12, r = (G + 0.02 - F) / n, run2 = 0.25, zb = C.z1 - 0.2;
    for (let k = 1; k <= n; k++) {
      const z0 = k === n ? GN.z1 : zb - k * run2, z1 = zb - (k - 1) * run2, y = F + k * r;
      bx('firedbrick', SX, C.x1, F, y, z0, z1);
      if (k > 1) bx('plaster', SX - 0.18, SX + 0.02, F, y + 0.85, z0, z1);
    }
  }
  // the upper rooms' doors on the gallery, a window or two; on the stair's side, a window over it
  shutDoor([3.0, C.z0], [0, 1], G);
  shutDoor([C.x0, 41.75], [1, 0], G);
  shutDoor([3.2, C.z1], [0, -1], G);
  grille([4.85, C.z0], [0, 1], G + 1.6);
  grille([C.x0, 40.25], [1, 0], G + 1.6);
  grille([C.x1, 42.2], [-1, 0], G + 1.6);
  grille([4.95, C.z1], [0, -1], G + 1.6);

  // ---- the court's things ----
  // (the drain)
  get('dark').add(new THREE.CircleGeometry(0.13, 12).rotateX(-Math.PI / 2).deleteAttribute('uv'), new THREE.Matrix4().makeTranslation(3.45, F + 0.025, 41.7));
  const jar = (kind, x, z, s, y = F) => get(kind).add(JAR, new THREE.Matrix4().compose(V(x, y - 0.02, z), new THREE.Quaternion(), V(s, s, s)));
  const sealed = (x, z, s, y = F) => box('mud', x, y + 1.11 * s + 0.03, z, 0.34 * s, 0.07, 0.34 * s);
  const bowl = new THREE.SphereGeometry(0.12, 10, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).deleteAttribute('uv');
  // (the water jar in the corner, a bowl on its mouth)
  jar('buff', 1.85, 40.05, 0.95);
  get('clay').add(bowl, new THREE.Matrix4().compose(V(1.85, F + 1.18, 40.05), new THREE.Quaternion(), V(1, 0.7, 1)));
  // (a narrow ground loom for the house's own cloth, half woven: the model's, workshop.js)
  groundLoom(kit, { cx: 3.45, cz: 41.9, y: F, width: 1.0, length: 1.7, yaw: 0, woven: ['madder', 'linen', 'saffron', 'linen', 'madder'] });
  // (new tablets drying on a reed mat in the sun)
  {
    const mx = 3.45, mz = 40.8;
    box('straw', mx, F + 0.03, mz, 1.3, 0.025, 0.5);
    for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) clayTablet(get, mx - 0.5 + i * 0.2, F + 0.0425, mz - 0.1 + j * 0.2, 0.11, 0.075, (rng() - 0.5) * 0.3, { lines: (i + j) % 3 !== 0 });
  }
  // (herbs in pots at the posts' feet)
  pot(GW.x1 + 0.25, F + 0.01, GS.z0 + 0.3, 0.9);
  pot(GW.x1 + 0.2, F + 0.01, GN.z1 + 0.25, 0.8);
  pot(C.x0 + 0.3, F + 0.01, 43.4, 1.0);
  // (a rug thrown over the south gallery's rail, hanging into the court; it moves in the wind below the rail)
  {
    const zr = GS.z0 + 0.05, y = G + 1.04, prof = [[0.07, y - 0.4], [0.06, y - 0.02], [0, y + 0.03], [-0.06, y - 0.02], [-0.09, y - 0.5], [-0.11, y - 1.05], [-0.12, y - 1.55]];
    cloth((i, j) => V(2.75 + j * 0.3, prof[i][1], zr + prof[i][0]), prof.length - 1, 4, ['madder', 'linen', 'saffron', 'linen', 'madder'], true, V(0, 0.3, -1),
      (i) => (i < 3 ? [0, 0, 0, 0] : [0, 0, -Math.max(0, y - prof[i][1] - 0.05), 0]));
  }

  // ---- the rooms' things ----
  // the vestibule: a jar of water and a bowl to wash the feet, a bench
  jar('clay', 7.7, 38.65, 0.6);
  get('clay').add(bowl, new THREE.Matrix4().compose(V(7.25, F, 38.85), new THREE.Quaternion(), V(1.1, 0.6, 1.1)));
  bx('plaster', 5.75, 6.6, F, F + 0.42, 38.72, zN);
  // the storeroom: great jars in rows, some sealed; sacks; a basket
  for (const [x, z, s] of [[1.95, 36.0, 1.0], [2.85, 36.2, 1.1], [3.7, 36.6, 0.95], [1.95, 37.0, 1.05], [1.95, 38.1, 0.95], [3.7, 37.7, 1.0], [3.75, 38.6, 0.8]]) {
    jar(rng() < 0.6 ? 'clay' : 'buff', x, z, s);
    if (rng() < 0.6) sealed(x, z, s);
  }
  for (const [x, z] of [[2.9, 37.3], [3.1, 37.75]]) get('linen').add(new THREE.SphereGeometry(0.3, 10, 7).deleteAttribute('uv'), new THREE.Matrix4().compose(V(x, F + 0.3, z), new THREE.Quaternion(), V(1, 1.25, 0.9)));
  // the tablet room: benches along its walls, the old tablets on them in stacks, more in jars and baskets
  const basket = (x, z, r = 0.3, h = 0.4) => get('straw').add(new THREE.CylinderGeometry(r, r * 0.85, h, 12).deleteAttribute('uv'), new THREE.Matrix4().makeTranslation(x, F + h / 2, z));
  const stacks = (x0, x1, z0, z1, y) => {
    for (let x = x0 + 0.1; x < x1 - 0.08; x += 0.17) {
      for (let z = z0 + 0.1; z < z1 - 0.08; z += 0.2) {
        const n = 1 + Math.floor(rng() * 4);
        for (let k = 0; k < n; k++) clayTablet(get, x + (rng() - 0.5) * 0.02, y + k * 0.034, z + (rng() - 0.5) * 0.02, 0.12, 0.16, (rng() - 0.5) * 0.12, { lines: k === n - 1 });
      }
    }
  };
  bx('plaster', XW, XW + 0.45, F, F + 0.55, northIn(XW) + 0.1, zN - 0.05);
  stacks(XW, XW + 0.45, northIn(XW) + 0.2, zN - 0.15, F + 0.55);
  bx('plaster', xWw - 0.45, xWw, F, F + 0.55, northIn(xWw) + 0.1, 38.0);
  stacks(xWw - 0.45, xWw, northIn(xWw) + 0.2, 37.9, F + 0.55);
  jar('buff', -0.15, 35.4, 0.75);
  basket(0.0, 37.6);
  basket(-0.35, 38.2, 0.25, 0.3);
  // the clay room: the basin where spent tablets are soaked back to clay, lumps of clay, new tablets drying on a
  // bench, round practice tablets among them, a jar of water, a few broken ones on the floor
  {
    const x0 = XW + 0.05, x1 = XW + 1.15, z0 = 42.55, z1 = C.z1 - 0.05;
    for (const [a, b, c, d] of [[x0, x1, z0, z0 + 0.12], [x0, x1, z1 - 0.12, z1], [x0, x0 + 0.12, z0, z1], [x1 - 0.12, x1, z0, z1]]) bx('plaster', a, b, F, F + 0.42, c, d);
    bx('mud', x0 + 0.12, x1 - 0.12, F, F + 0.3, z0 + 0.12, z1 - 0.12);
    const blob = new THREE.SphereGeometry(0.16, 8, 6).deleteAttribute('uv');
    for (const [x, z, s] of [[0.3, 43.2, 1], [0.55, 43.45, 0.7], [0.4, 42.65, 0.8]]) get('mud').add(blob, new THREE.Matrix4().compose(V(x, F + 0.06 * s, z), new THREE.Quaternion(), V(s * 1.2, s * 0.6, s)));
    bx('plaster', XW, XW + 0.45, F, F + 0.5, C.z0 + 0.25, 42.3);
    const lentil = new THREE.CylinderGeometry(0.055, 0.055, 0.025, 12).deleteAttribute('uv');
    for (let z = C.z0 + 0.35; z < 42.2; z += 0.17) {
      for (const x of [XW + 0.12, XW + 0.3]) {
        if (rng() < 0.35) get('mud').add(lentil, new THREE.Matrix4().makeTranslation(x, F + 0.515, z));
        else clayTablet(get, x, F + 0.5, z, 0.1, 0.13, (rng() - 0.5) * 0.15, { kind: 'mud', lines: x > XW + 0.2 });
      }
    }
    jar('clay', 0.55, 40.0, 0.6);
    for (let k = 0; k < 4; k++) box('mud', 0.1 + rng() * 0.5, F + 0.02, 41.0 + rng() * 0.8, 0.06 + rng() * 0.05, 0.03, 0.05 + rng() * 0.05, rng() * 3);
  }
  // the kitchen: the bread oven in its corner, the hearth, a quern on a low bench, jars, pots, firewood, a basket
  {
    const ox = XE - 0.5, oz = C.z1 - 0.5;
    get('clay').add(new THREE.CylinderGeometry(0.3, 0.42, 0.8, 14).deleteAttribute('uv'), new THREE.Matrix4().makeTranslation(ox, F + 0.4, oz));
    get('dark').add(new THREE.CircleGeometry(0.2, 12).rotateX(-Math.PI / 2).deleteAttribute('uv'), new THREE.Matrix4().makeTranslation(ox, F + 0.805, oz));
    bx('dark', ox - 0.6, ox - 0.1, F, F + 0.012, oz - 0.3, oz + 0.25);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      box('stone', 7.25 + Math.cos(a) * 0.22, F + 0.07, 41.7 + Math.sin(a) * 0.22, 0.16, 0.14, 0.14, a);
    }
    bx('dark', 7.05, 7.45, F, F + 0.01, 41.5, 41.9);
    bx('plaster', xEw, xEw + 0.75, F, F + 0.38, C.z0 + 0.3, C.z0 + 0.95);
    box('stone', xEw + 0.38, F + 0.43, C.z0 + 0.62, 0.55, 0.1, 0.3, 0.1);
    box('stone', xEw + 0.4, F + 0.52, C.z0 + 0.6, 0.24, 0.07, 0.12, 0.3);
    get('grain').add(new THREE.SphereGeometry(0.12, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2).deleteAttribute('uv'), new THREE.Matrix4().compose(V(xEw + 0.2, F + 0.48, C.z0 + 0.5), new THREE.Quaternion(), V(1, 0.4, 1)));
    jar('clay', XE - 0.33, C.z0 + 1.15, 0.7);
    jar('buff', XE - 0.35, C.z0 + 2.85, 0.65);
    const cpot = new THREE.SphereGeometry(0.17, 10, 7).deleteAttribute('uv');
    for (const [x, z, y] of [[6.35, 42.6, 0.13], [6.4, 42.95, 0.13], [6.38, 42.78, 0.36]]) get('clay').add(cpot, new THREE.Matrix4().compose(V(x, F + y, z), new THREE.Quaternion(), V(1, 0.75, 1)));
    for (let j = 0; j < 5; j++) get('wood').tube([V(6.25 + (j % 3) * 0.12, F + 0.06 + (j > 2 ? 0.12 : 0), 41.35), V(6.25 + (j % 3) * 0.12, F + 0.06 + (j > 2 ? 0.12 : 0), 42.25)], [0.05, 0.045], 5);
    basket(6.35, 40.9, 0.2, 0.3);
  }
  // the schoolroom: benches in rows looking east to the master's seat on a low dais, round practice tablets and
  // reed styluses on the benches, mats on the floor for the youngest, a basket of tablets, a jar of water
  {
    const lentil = new THREE.CylinderGeometry(0.06, 0.06, 0.028, 12).deleteAttribute('uv');
    for (const x of [3.95, 5.05, 6.15]) {
      bx('plaster', x - 0.19, x + 0.19, F, F + 0.42, zSo + 0.5, ZS - 0.45);
      for (let z = zSo + 0.75; z < ZS - 0.6; z += 0.55 + rng() * 0.25) {
        get('mud').add(lentil, new THREE.Matrix4().makeTranslation(x + (rng() - 0.5) * 0.1, F + 0.435, z));
        if (rng() < 0.6) get('straw').add(new THREE.CylinderGeometry(0.006, 0.006, 0.22, 4).rotateZ(Math.PI / 2).deleteAttribute('uv'),
          new THREE.Matrix4().compose(V(x + 0.05, F + 0.43, z + 0.12), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), rng() * 3), V(1, 1, 1)));
      }
    }
    bx('plaster', 7.15, XE, F, F + 0.25, 45.25, 46.85);
    box('straw', 7.65, F + 0.26, 46.05, 0.85, 0.015, 1.4);
    bx('wood', 7.4, 7.9, F + 0.62, F + 0.67, 45.8, 46.3);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box('wood', 7.65 + dx * 0.21, F + 0.44, 46.05 + dz * 0.21, 0.05, 0.37, 0.05);
    clayTablet(get, 8.13, F + 0.7, 46.05, 0.24, 0.32, Math.PI / 2, { face: new THREE.Vector3(-1, 0, 0) });   // (the master's model tablet, propped against the wall)
    box('straw', 2.2, F + 0.012, 45.4, 1.1, 0.02, 0.7);
    box('straw', 2.3, F + 0.012, 46.6, 1.1, 0.02, 0.7);
    basket(7.7, 44.75, 0.22, 0.3);
    for (let k = 0; k < 4; k++) clayTablet(get, 7.62 + (rng() - 0.5) * 0.18, F + 0.305, 44.72 + (rng() - 0.5) * 0.18, 0.11, 0.08, rng() * 3, { lines: false });
    jar('clay', 1.85, 44.65, 0.6);
  }
  // the chapel: the altar against the far wall, a niche over it, a small figure, the meal for the dead (bread,
  // dates, two cups of beer, a lamp); in the floor the vault where they lie, its fired-brick cover
  {
    const zc = (zSo + ZS) / 2;
    bx('plaster', XW, XW + 0.5, F, F + 0.85, zc - 0.55, zc + 0.55);
    bx('dark', XW, XW + 0.02, F + 1.15, F + 1.95, zc - 0.3, zc + 0.3);
    for (const [a, b, c, d] of [[F + 1.07, F + 1.15, zc - 0.38, zc + 0.38], [F + 1.95, F + 2.03, zc - 0.38, zc + 0.38]]) bx('plaster', XW, XW + 0.08, a, b, c, d);
    for (const s of [-1, 1]) bx('plaster', XW, XW + 0.08, F + 1.15, F + 1.95, zc + s * 0.3 - (s > 0 ? 0 : 0.08), zc + s * 0.3 + (s > 0 ? 0.08 : 0));
    get('buff').add(new THREE.CylinderGeometry(0.05, 0.08, 0.3, 8).deleteAttribute('uv'), new THREE.Matrix4().makeTranslation(XW + 0.1, F + 1.3, zc));
    get('buff').add(new THREE.SphereGeometry(0.05, 8, 6).deleteAttribute('uv'), new THREE.Matrix4().makeTranslation(XW + 0.1, F + 1.49, zc));
    const cup = new THREE.CylinderGeometry(0.045, 0.035, 0.09, 10).deleteAttribute('uv');
    for (const dz of [-0.3, 0.32]) get('clay').add(cup, new THREE.Matrix4().makeTranslation(XW + 0.25, F + 0.9, zc + dz));
    get('grain').add(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 12).deleteAttribute('uv'), new THREE.Matrix4().makeTranslation(XW + 0.27, F + 0.865, zc - 0.05));
    const date = new THREE.SphereGeometry(0.018, 6, 4).deleteAttribute('uv');
    for (let k = 0; k < 7; k++) get('date').add(date, new THREE.Matrix4().compose(V(XW + 0.27 + (rng() - 0.5) * 0.08, F + 0.865, zc + 0.12 + (rng() - 0.5) * 0.1), new THREE.Quaternion(), V(1, 1.5, 1)));
    get('clay').add(new THREE.SphereGeometry(0.06, 8, 5).deleteAttribute('uv'), new THREE.Matrix4().compose(V(XW + 0.2, F + 0.88, zc + 0.45), new THREE.Quaternion(), V(1.6, 0.5, 1)));
    bx('firedbrick', XW + 0.75, xWw - 0.1, F, F + 0.012, zSo + 0.35, zc - 0.65);
    jar('buff', xWw - 0.3, ZS - 0.35, 0.55);
  }

  // ---- the roofs: things out on them, seen from the stair and the gallery ----
  roofLife({ x0: XW - 0.25, x1: XE + 0.25, z0: zSo + 0.15, z1: ZS + 0.25 }, ROOF, 3);
  roofLife({ x0: XW - 0.25, x1: xWw - 0.1, z0: C.z0 - 0.1, z1: C.z1 + 0.1 }, ROOF, 1);

  // ---- the little square across the lane, at the stair's foot, reaching back at its west end over the plot where
  // the pomegranate grows (a broad L: COURT_SQUARE_BACK), level; no parapet: the houses round it close it in, the
  // lane is open on its south. The wayside shrine in its corner by the stair ----
  {
    const sq = COURT_SQUARE, x1 = sq[1][0], z0 = sq[0][1];
    const yAt = (x, z) => heightAt(x, z);
    const bk = COURT_SQUARE_BACK, bx0 = bk[0][0], bx1 = bk[1][0], bz0 = bk[0][1], bz1 = bk[2][1];
    // the shrine: a small block of whitewashed brick, stepped at its top, a niche in its face with the god's
    // little figure; before it an offering table (cups, bread, a lamp), a jar, a pot of herbs
    const sx0 = 7.1, sx1 = x1, sz0 = z0 + 0.35, sz1 = sz0 + 1.0, y0 = yAt((sx0 + sx1) / 2, sz1 - 0.1);
    bx('whitewash', sx0, sx1, y0 - 0.5, y0 + 2.1, sz0, sz1);
    bx('whitewash', sx0 + 0.15, sx1 - 0.15, y0 + 2.1, y0 + 2.35, sz0 + 0.1, sz1 - 0.1);
    bx('whitewash', sx0 + 0.4, sx1 - 0.4, y0 + 2.35, y0 + 2.55, sz0 + 0.2, sz1 - 0.2);
    const mx = (sx0 + sx1) / 2;
    bx('dark', mx - 0.32, mx + 0.32, y0 + 0.6, y0 + 1.6, sz1, sz1 + 0.01);
    for (const [a, b, c, d] of [[mx - 0.42, mx + 0.42, y0 + 0.5, y0 + 0.6], [mx - 0.42, mx + 0.42, y0 + 1.6, y0 + 1.7], [mx - 0.42, mx - 0.32, y0 + 0.6, y0 + 1.6], [mx + 0.32, mx + 0.42, y0 + 0.6, y0 + 1.6]]) {
      bx('whitewash', a, b, c, d, sz1, sz1 + 0.07);
    }
    bx('plaster', mx - 0.5, mx + 0.5, y0 + 0.5, y0 + 0.58, sz1, sz1 + 0.22);
    get('buff').add(new THREE.CylinderGeometry(0.06, 0.09, 0.34, 8).deleteAttribute('uv'), new THREE.Matrix4().makeTranslation(mx, y0 + 0.75, sz1 + 0.06));
    get('buff').add(new THREE.SphereGeometry(0.055, 8, 6).deleteAttribute('uv'), new THREE.Matrix4().makeTranslation(mx, y0 + 0.97, sz1 + 0.06));
    const ty = yAt(mx, sz1 + 0.6);
    bx('plaster', mx - 0.35, mx + 0.35, ty - 0.2, ty + 0.5, sz1 + 0.3, sz1 + 0.85);
    const cup = new THREE.CylinderGeometry(0.045, 0.035, 0.09, 10).deleteAttribute('uv');
    for (const dx of [-0.2, 0.18]) get('clay').add(cup, new THREE.Matrix4().makeTranslation(mx + dx, ty + 0.545, sz1 + 0.5));
    get('grain').add(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 12).deleteAttribute('uv'), new THREE.Matrix4().makeTranslation(mx, ty + 0.515, sz1 + 0.62));
    get('clay').add(new THREE.SphereGeometry(0.06, 8, 5).deleteAttribute('uv'), new THREE.Matrix4().compose(V(mx + 0.05, ty + 0.53, sz1 + 0.45), new THREE.Quaternion(), V(1.6, 0.5, 1)));
    paintedJar(sx0 - 0.4, yAt(sx0 - 0.4, sz1 - 0.2) - 0.03, sz1 - 0.2, 0.7, 0.4, 2);
    pot(sx0 - 0.35, yAt(sx0 - 0.35, sz1 + 0.45) - 0.02, sz1 + 0.45, 0.9);
    // under the pomegranate (hillScene.js plants it: trees), a reed mat, a red rug on it, a lyre standing there, a
    // frame drum by it, two cups: music of an evening, for whoever comes up the way. (The mat out from under the tree,
    // towards the square: it lay round its trunk)
    const mx2 = (bx0 + bx1) / 2 + 0.5, mz2 = (bz0 + bz1) / 2 + 0.9, my = yAt(mx2, mz2);
    kit.reedMat(mx2, my + 0.03, mz2, 2.2, 1.6);
    bx('madder', mx2 - 0.75, mx2 + 0.55, my + 0.04, my + 0.06, mz2 - 0.5, mz2 + 0.5);
    {
      // (the lyre standing, as the lyres from Ur's royal graves were played: its sound box on the ground, the two
      // arms up from it, the yoke across their tops, the strings from the box's foot over a bridge to the yoke)
      const lx = mx2 - 0.15, lz = mz2 - 0.45, ly = my + 0.06;
      bx('wood', lx - 0.4, lx + 0.4, ly, ly + 0.36, lz - 0.08, lz + 0.08);
      for (const s2 of [-1, 1]) get('wood').tube([V(lx + s2 * 0.28, ly + 0.32, lz), V(lx + s2 * 0.34, ly + 0.8, lz), V(lx + s2 * 0.38, ly + 1.08, lz)], [0.03, 0.03, 0.03], 5);
      get('wood').tube([V(lx - 0.48, ly + 1.09, lz), V(lx + 0.48, ly + 1.06, lz)], [0.026, 0.026], 5);
      bx('wood', lx - 0.24, lx + 0.24, ly + 0.2, ly + 0.24, lz + 0.08, lz + 0.12);
      for (let k = 0; k < 7; k++) get('linen').tube([V(lx - 0.2 + k * 0.066, ly + 0.08, lz + 0.09), V(lx - 0.21 + k * 0.07, ly + 0.24, lz + 0.125), V(lx - 0.23 + k * 0.077, ly + 1.06, lz + 0.03)], [0.004, 0.004, 0.004], 3);
    }
    get('wood').add(new THREE.CylinderGeometry(0.27, 0.27, 0.07, 18, 1, true).deleteAttribute('uv'), new THREE.Matrix4().makeTranslation(mx2 + 0.6, my + 0.1, mz2 + 0.15));
    get('buff').add(new THREE.CylinderGeometry(0.265, 0.265, 0.01, 18).deleteAttribute('uv'), new THREE.Matrix4().makeTranslation(mx2 + 0.6, my + 0.135, mz2 + 0.15));
    const cup2 = new THREE.CylinderGeometry(0.045, 0.035, 0.09, 10).deleteAttribute('uv');
    for (const [dx, dz] of [[0.35, -0.35], [0.5, -0.25]]) get('clay').add(cup2, new THREE.Matrix4().makeTranslation(mx2 + dx, my + 0.11, mz2 + dz));
    trees.push({ x: bx0 + 1.1, z: bz0 + 1.0, y: yAt(bx0 + 1.1, bz0 + 1.0), kind: 'pomegranate', s: 1.0 });
  }

  // ---- the house's yard against its west wall, open to the lane on its north (hillPlan.js COURT_YARD): a level
  // floor of trodden earth, filled up over the slope; a wall on its far side and its back; a pomegranate in a curb
  // of brick, herbs in pots along the wall; new tablets drying on two reed mats; jars in its back corners (some
  // sealed, one painted), a basket of tablets ----
  {
    const Y = COURT_YARD.y, yd = COURT_YARD.outline;
    const xw = Math.min(...yd.map((p) => p[0])), xe = Math.max(...yd.map((p) => p[0])), zb = Math.max(...yd.map((p) => p[1]));
    let lowY = Y;
    for (const [x, z] of yd) lowY = Math.min(lowY, heightAt(x - 0.6, z + 0.6), heightAt(x, z + 0.8));
    extrude('path', yd, [], lowY - 0.6, Y);
    // (the wall across its back; its outer face a little proud of the floor's side, which was in one plane with it
    // and flickered. On its far side none of its own: the next house's wall and parapet stand there, a hand off, and
    // close it; the floor carried over to that wall)
    bx('path', xw - 0.11, xw - 0.005, lowY - 0.6, Y, 34.05, zb - 0.35);
    for (let x = xw; x < xe - 0.01; x += 1) {
      const x2 = Math.min(x + 1, xe);
      bx('whitewash', x - (x === xw ? 0.03 : 0), x2, Math.min(heightAt((x + x2) / 2, zb + 0.8), Y) - 0.5, Y + 1.1, zb - 0.35, zb + 0.03);
    }
    // (the tree, in the open half of the yard, a low ring of brick round its foot; herbs in pots by the walls)
    const tx = -2.95, tz = 36.75;
    get('firedbrick').add(new THREE.CylinderGeometry(0.5, 0.52, 0.18, 16, 1, true).deleteAttribute('uv'), new THREE.Matrix4().makeTranslation(tx, Y + 0.09, tz), { flat: true });
    get('firedbrick').add(new THREE.RingGeometry(0.4, 0.5, 16).rotateX(-Math.PI / 2).deleteAttribute('uv'), new THREE.Matrix4().makeTranslation(tx, Y + 0.18, tz));
    get('earth').add(new THREE.CircleGeometry(0.4, 16).rotateX(-Math.PI / 2).deleteAttribute('uv'), new THREE.Matrix4().makeTranslation(tx, Y + 0.12, tz));
    decor.trees.push({ x: tx, z: tz, y: Y + 0.12, kind: 'pomegranate' });
    for (const [x, z, sc] of [[-4.3, 34.1, 0.9], [-4.3, 34.9, 1.1], [-2.15, 34.0, 1.0]]) pot(x, Y - 0.01, z, sc);
    // (new tablets drying in the sun on two reed mats)
    for (const mz of [34.4, 35.55]) {
      const mx = -3.15, mw = 1.55, md = 0.9;
      box('straw', mx, Y + 0.012, mz, mw, 0.025, md);
      for (let i = 0; i < 7; i++) {
        for (let j = 0; j < 5; j++) clayTablet(get, mx - mw / 2 + 0.2 + i * 0.19, Y + 0.025, mz - md / 2 + 0.13 + j * 0.16, 0.11, 0.075, (rng() - 0.5) * 0.25, { lines: (i + j) % 3 !== 0 });
      }
    }
    // (jars in the back corners, a painted one by the house's wall, a basket of tablets)
    for (const [x, z, sc, k] of [[-2.3, 37.65, 0.85, 'buff'], [-4.25, 37.65, 0.75, 'clay'], [-4.3, 36.85, 0.6, 'buff']]) {
      get(k).add(JAR, new THREE.Matrix4().compose(V(x, Y - 0.02, z), new THREE.Quaternion(), V(sc, sc, sc)));
      if (k === 'buff') box('mud', x, Y + 1.11 * sc + 0.01, z, 0.34 * sc, 0.07, 0.34 * sc);
    }
    paintedJar(-2.15, Y - 0.03, 36.35, 0.9, 1.2, 0);
    get('straw').add(new THREE.CylinderGeometry(0.26, 0.22, 0.34, 12).deleteAttribute('uv'), new THREE.Matrix4().makeTranslation(-4.25, Y + 0.17, 35.55));
    for (let k = 0; k < 5; k++) clayTablet(get, -4.25 + (rng() - 0.5) * 0.22, Y + 0.34, 35.55 + (rng() - 0.5) * 0.22, 0.11, 0.08, rng() * 3, { lines: false });
  }

  return { inHouse: (x, z) => inCourtHouse(x, z), trees };
}

function norm2(x, z) { const l = Math.hypot(x, z); return [x / l, z / l]; }
