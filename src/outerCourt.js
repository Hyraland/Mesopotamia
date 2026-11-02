// The temple's outer court, south of the precinct, open to it (no wall between
// them, so the white temple and the priestess's white house and shrine are seen together): seen mostly from
// outside and from above, from the ziggurat.
//
// West, the house of the en-priestess, the god's bride, of the king's family (the Giparu: at Ur, Enheduanna's, the
// daughter of Sargon, who wrote the hymns to the temples), on a low platform, open: a court with a palm, a well and
// garden beds; on its east side the shrine of Ningal, whitewashed and buttressed, its door to the court; on its
// west the house, two storeys, an upper room, on the roof a reed awning over a mat, a lyre and tablets of hymns.
//
// In the middle, the potters: two kilns, domed, their fire-mouths and ash; the tanks where the clay is soaked, a
// heap of it; under a reed shade the wheel, a seat, pots on a board; new pots drying in rows, fired ones stacked
// by the kilns, bundles of reeds for the fires, a heap of wasters.
//
// East, the temple's orchard (hillScene.js plants it).

import * as THREE from 'three';
import { JAR } from './houseKit.js';
import { OUTER } from './hillPlan.js';
import { clayTablet } from './buildingDetails.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const SPHERE = new THREE.SphereGeometry(1, 14, 10).deleteAttribute('uv');
const DOME = new THREE.SphereGeometry(1, 16, 7, 0, Math.PI * 2, 0, Math.PI / 2).deleteAttribute('uv');
const CYL = new THREE.CylinderGeometry(1, 1, 1, 16).deleteAttribute('uv');
const POT = new THREE.LatheGeometry([[0, 0], [0.13, 0], [0.2, 0.08], [0.24, 0.22], [0.2, 0.36], [0.12, 0.42], [0.13, 0.47], [0, 0.47]]
  .map(([r, h]) => new THREE.Vector2(r, h)), 12).deleteAttribute('uv');
POT.computeVertexNormals();

// The outer court and all in it moved north by COURT_DZ once the ziggurat's return stair up its south flank was gone
//, the court's south wall with them. The Giparu's house of the priestess: its platform,
// outside to outside. (Laid out where it first stood, against the outer court's south wall (FRAME), then moved north
// towards the temple, by GIPARU_DZ, once the wall between the courts was gone, and on with the court)
export const COURT_DZ = -7;
const FRAME = { x0: 15, x1: 60, z0: 106, z1: 124 };
export const GIPARU_DZ = -8 + COURT_DZ;
export const GIPARU = { x0: FRAME.x0, x1: FRAME.x1, z0: FRAME.z0 + GIPARU_DZ, z1: FRAME.z1 + GIPARU_DZ };

export function buildOuterCourt(kit, { rng }) {
  const { get, box, reedMat, cloth, weave } = kit;
  const Y = OUTER.y;
  const bx = (kind, x0, x1, y0, y1, z0, z1) => box(kind, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0);
  const put = (kind, geo, p, s, yaw = 0) => get(kind).add(geo, new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromAxisAngle(UP, yaw), s));
  const tube = (kind, pts, r, seg = 6) => get(kind).tube(pts, Array.isArray(r) ? r : pts.map(() => r), seg);
  // (a shut or dark doorway on a face: a recess of shadow, a lintel log)
  const doorway = (x, y, z, w, h, alongX) => {
    if (alongX) bx('dark', x - w / 2, x + w / 2, y, y + h, z - 0.03, z + 0.03);
    else bx('dark', x - 0.03, x + 0.03, y, y + h, z - w / 2, z + w / 2);
    tube('wood', alongX ? [V(x - w / 2 - 0.3, y + h + 0.1, z), V(x + w / 2 + 0.3, y + h + 0.1, z)] : [V(x, y + h + 0.1, z - w / 2 - 0.3), V(x, y + h + 0.1, z + w / 2 + 0.3)], 0.1, 6);
  };
  // (the white walls' bitumen dado and red band, as the temple's: temple.js)
  const colours = (x0, x1, z0, z1, y0, top, { dado = true, band = true } = {}) => {
    if (dado) bx('dark', x0 - 0.025, x1 + 0.025, y0, y0 + 0.6, z0 - 0.025, z1 + 0.025);
    if (band) bx('redwash', x0 - 0.025, x1 + 0.025, top - 0.3, top + 0.004, z0 - 0.025, z1 + 0.025);
  };
  const windowAt = (x, y, z, alongX) => alongX ? bx('dark', x - 0.25, x + 0.25, y, y + 0.35, z - 0.03, z + 0.03) : bx('dark', x - 0.03, x + 0.03, y, y + 0.35, z - 0.25, z + 0.25);

  // ---- the Giparu (laid out in its FRAME, moved after: below) ----
  const before = Object.fromEntries(Object.entries(kit.B).map(([k, b]) => [k, b.count]));
  {
    const { x0, x1, z0, z1 } = FRAME, P = Y + 0.3, T = 0.8;
    // the platform, open all round
    bx('firedbrick', x0, x1, Y - 0.4, P - 0.06, z0, z1);
    bx('plaster', x0 + 0.1, x1 - 0.1, P - 0.06, P, z0 + 0.1, z1 - 0.1);
    // the shrine of Ningal, on the court's east side: whitewashed, buttressed, its parapet stepped over its front;
    // its door to the court
    {
      const sx0 = 46.5, sx1 = x1 - T, sz0 = 109, sz1 = 121, HS = 6.0, cz = (sz0 + sz1) / 2;
      bx('whitewash', sx0, sx1, P, P + HS, sz0, sz1);
      colours(sx0, sx1, sz0, sz1, P, P + HS);
      for (let z = sz0 + 0.8; z < sz1 - 0.5; z += 1.6) {
        if (Math.abs(z - cz) <= 1.4) continue;
        bx('whitewash', sx0 - 0.3, sx0 + 0.05, P, P + HS - 0.02, z - 0.35, z + 0.35);
        colours(sx0 - 0.3, sx0 + 0.05, z - 0.35, z + 0.35, P, P + HS - 0.015);
      }
      for (const s of [-1, 1]) {
        const j0 = cz + s * 1.3 - (s < 0 ? 0.9 : 0), j1 = cz + s * 1.3 + (s > 0 ? 0.9 : 0);
        bx('whitewash', sx0 - 0.6, sx0 + 0.05, P, P + HS + 0.8, j0, j1);
        colours(sx0 - 0.6, sx0 + 0.05, j0, j1, P, P + HS + 0.8);
      }
      doorway(sx0 - 0.62, P, cz, 1.7, 3.0, false);
      for (let z = sz0 + 0.3; z < sz1 - 0.2; z += 0.75) {
        let y = P + HS;
        for (const [w, hh] of [[0.5, 0.16], [0.34, 0.14], [0.18, 0.12]]) { bx('whitewash', sx0, sx0 + 0.5, y, y + hh, z - w / 2, z + w / 2); y += hh; }
      }
      bx('firedbrick', sx0 - 2.2, sx0 - 0.6, P, P + 0.15, cz - 1.6, cz + 1.6);
    }
    // the house: two storeys, an upper room over its west end, the rest of its roof a terrace with a parapet; doors
    // and small windows on the court
    {
      const hx0 = x0 + T, hx1 = 29.5, hz0 = 113, hz1 = z1 - T, HH = 6.4, ux1 = 21.5;
      bx('whitewash', hx0, hx1, P, P + HH, hz0, hz1);
      colours(hx0, hx1, hz0, hz1, P, 0, { band: false });
      bx('whitewash', hx0, ux1, P + HH, P + HH + 2.8, hz0 + 2.5, hz1);
      colours(hx0, ux1, hz0 + 2.5, hz1, 0, P + HH + 2.8, { dado: false });
      for (const [a0, a1, b0, b1] of [[ux1, hx1, hz0, hz0 + 0.3], [hx1 - 0.3, hx1, hz0, hz1], [ux1, hx1, hz1 - 0.3, hz1], [hx0, ux1, hz0, hz0 + 0.3]]) {
        bx('whitewash', a0, a1, P + HH, P + HH + 0.7, b0, b1);
        colours(a0, a1, b0, b1, 0, P + HH + 0.7, { dado: false });
      }
      for (let x = hx0 + 0.4; x < hx1 - 0.3; x += 0.7) tube('wood', [V(x, P + HH - 0.3, hz0 - 0.25), V(x, P + HH - 0.3, hz0 + 0.4)], 0.08, 6);
      doorway(20.0, P, hz0 - 0.03, 1.1, 2.2, true);
      doorway(26.4, P, hz0 - 0.03, 1.1, 2.2, true);
      for (const x of [17.4, 23.2, 28.3]) windowAt(x, P + 4.1, hz0 - 0.03, true);
      windowAt(18.5, P + HH + 1.4, hz0 + 2.47, true);
      doorway(ux1 + 0.03, P + HH, (hz0 + 2.5 + hz1) / 2, 0.9, 1.9, false);
      // on the terrace: a reed awning on its poles over a mat; on the mat the lyre, a low table with tablets of
      // hymns, a jar of water
      const ty = P + HH, ax0 = 22.6, ax1 = 28.6, az0 = 115.5, az1 = 121.5;
      for (const [x, z] of [[ax0, az0], [ax1, az0], [ax0, az1], [ax1, az1]]) tube('wood', [V(x, ty, z), V(x, ty + 2.2, z)], [0.06, 0.05], 6);
      reedMat((ax0 + ax1) / 2, ty + 2.25, (az0 + az1) / 2, ax1 - ax0 + 0.4, az1 - az0 + 0.4, 0, -0.03);
      bx('madder', 23.6, 27.6, ty, ty + 0.03, 116.6, 120.2);
      bx('wood', 24.4, 25.4, ty + 0.03, ty + 0.4, 117.6, 118.4);
      for (let k = 0; k < 5; k++) clayTablet(get, 24.56 + k * 0.17, ty + 0.4, 117.9 + (k % 2) * 0.025, 0.12, 0.2 + (k % 2) * 0.05, 0);
      lyre(put, tube, V(26.6, ty + 0.03, 119.6), Math.PI * 0.85);
      put('clay', JAR, V(23.2, ty, 120.6), V(0.6, 0.6, 0.6));
      // cloth, seen from the court: three lengths of woven cloth thrown over the terrace's parapet, the same length,
      // each its own pattern in red, white and yellow (weaves.js), hanging down the front; a line of new-dyed cloth
      // drying behind them; over the two doors below, a shed of reed matting on poles
      const PZ = hz0, PT = ty + 0.7, SW = 1.15, DROP = 1.6;
      for (const [xa, k] of [[27.3, { weave: 2 }], [25.3, { weave: 1 }], [23.3, { weave: 0 }]]) {
        // (over the top and out clear of the roof's beam ends under it)
        const path = [[PZ + 0.75, ty + 0.03], [PZ + 0.34, PT + 0.03], [PZ - 0.08, PT + 0.04], [PZ - 0.32, PT - 0.35], [PZ - 0.34, PT - DROP]];
        cloth((i, j) => V(xa + (SW * j) / 3, path[i][1], path[i][0]), 4, 3, k, true, V(0, 0.3, -1));
      }
      {
        const la = 22.1, lb = 29.1, lz = PZ + 1.35, lh = ty + 2.0;
        for (const x of [la, lb]) tube('wood', [V(x, ty, lz), V(x, lh, lz)], 0.05, 5);
        tube('wood', [V(la, lh - 0.04, lz), V((la + lb) / 2, lh - 0.14, lz), V(lb, lh - 0.04, lz)], 0.013, 4);
        for (let x = la + 0.2; x < lb - 0.6;) {
          const w = Math.min(0.6 + rng() * 0.5, lb - 0.15 - x), hang = 0.8 + rng() * 0.5, r = rng();
          const st = r < 0.35 ? ['madder'] : r < 0.55 ? ['saffron'] : r < 0.7 ? ['linen'] : weave(rng);
          cloth((i, j) => {
            const xx = x + (j / 3) * w, sag = 0.1 * (1 - (2 * (xx - (la + lb) / 2) / (lb - la)) ** 2);
            return V(xx, lh - 0.05 - sag - (i / 3) * hang, lz + 0.02 * Math.sin(i + j));
          }, 3, 3, st, true, V(0, 0, -1), (i) => [0, 0, (i / 3) * hang, 1]);
          x += w + 0.1;
        }
      }
      {
        const a0 = 18.6, a1 = 27.8, zw = hz0 - 0.08, zp = hz0 - 1.8, yw = P + 2.8, yp = P + 2.35;
        for (const x of [a0 + 0.2, (a0 + a1) / 2, a1 - 0.2]) tube('wood', [V(x, P, zp), V(x, yp, zp)], [0.06, 0.05], 6);
        tube('wood', [V(a0, yp, zp), V(a1, yp, zp)], 0.05, 6);
        // (rafters of palm wood from the wall to the beam, the mat laid over them)
        for (let x = a0 + 0.3; x < a1; x += 0.9) tube('wood', [V(x, yw - 0.05, zw + 0.05), V(x, yp + 0.03, zp - 0.2)], 0.045, 5);
        reedMat((a0 + a1) / 2, (yw + yp) / 2 + 0.06, (zw + zp) / 2 - 0.05, a1 - a0 + 0.4, zw - zp + 0.4, 0, 0, (yp - yw) / (zp - zw));
      }
    }
    // the court: the well, garden beds of herbs and leeks (hillScene.js plants them), a bench, jars; in the sun
    // before the house a line of new-dyed cloth
    {
      const la = 30.6, lb = 38.2, lz = 111.4, lh = P + 2.2;
      for (const x of [la, lb]) tube('wood', [V(x, P, lz), V(x, lh, lz)], [0.06, 0.05], 6);
      tube('wood', [V(la, lh - 0.04, lz), V((la + lb) / 2, lh - 0.16, lz), V(lb, lh - 0.04, lz)], 0.013, 4);
      for (let x = la + 0.2; x < lb - 0.6;) {
        const w = Math.min(0.6 + rng() * 0.6, lb - 0.15 - x), hang = 0.9 + rng() * 0.5, r = rng();
        const st = r < 0.3 ? ['madder'] : r < 0.5 ? ['saffron'] : r < 0.65 ? ['linen'] : weave(rng);
        cloth((i, j) => {
          const xx = x + (j / 3) * w, sag = 0.12 * (1 - (2 * (xx - (la + lb) / 2) / (lb - la)) ** 2);
          return V(xx, lh - 0.05 - sag - (i / 3) * hang, lz + 0.02 * Math.sin(i + j));
        }, 3, 3, st, true, V(0, 0, -1), (i) => [0, 0, (i / 3) * hang, 1]);
        x += w + 0.1;
      }
    }
    {
      const head = new THREE.LatheGeometry([[0.45, 0], [0.75, 0], [0.75, 0.7], [0.45, 0.7], [0.45, 0]].map(([r, h]) => new THREE.Vector2(r, h)), 18).deleteAttribute('uv');
      head.computeVertexNormals();
      get('firedbrick').add(head, new THREE.Matrix4().makeTranslation(33.2, P, 109.6), { flat: true });
      put('dark', CYL, V(33.2, P + 0.35, 109.6), V(0.46, 0.02, 0.46));
      for (const [bz0, bz1] of [[118.0, 120.0], [120.8, 122.8]]) bx('earth', 39.5, 45.0, P, P + 0.25, bz0, bz1);
      bx('plaster', 30.4, 33.6, P, P + 0.45, 122.4, 123.1);
      for (const [x, z, s] of [[44.6, 107.6, 1.0], [45.4, 108.2, 0.8], [30.6, 116.0, 0.9]]) put('clay', JAR, V(x, P, z), V(s, s, s), rng() * 6);
    }
  }

  for (const [k, b] of Object.entries(kit.B)) for (let i = before[k] ?? 0; i < b.count; i++) b.p[i * 3 + 2] += GIPARU_DZ;

  // ---- the potters (laid out where they first stood, moved north with the court: below) ----
  const beforePotters = Object.fromEntries(Object.entries(kit.B).map(([k, b]) => [k, b.count]));
  {
    // two kilns: a round chamber of brick under a clay dome, open at its top; the fire-mouth north, its ash
    for (const [kx, kz, r] of [[71, 121, 1.4], [78.4, 121.6, 1.2]]) {
      put('firedbrick', CYL, V(kx, Y + 0.8, kz), V(r, 1.6, r));
      put('clay', DOME, V(kx, Y + 1.6, kz), V(r, r * 0.65, r));
      put('dark', CYL, V(kx, Y + 1.6 + r * 0.65 - 0.02, kz), V(0.32, 0.06, 0.32));
      bx('dark', kx - 0.4, kx + 0.4, Y, Y + 0.6, kz - r - 0.03, kz - r + 0.2);
      put('dark', CYL, V(kx, Y + 0.01, kz - r - 0.8), V(0.7, 0.02, 0.5));
    }
    // the clay tanks; the heap of clay
    for (const [tx0, tx1] of [[85, 88.4], [89.2, 92.6]]) {
      bx('firedbrick', tx0, tx1, Y - 0.2, Y + 0.4, 107.4, 107.8);
      bx('firedbrick', tx0, tx1, Y - 0.2, Y + 0.4, 110.4, 110.8);
      bx('firedbrick', tx0, tx0 + 0.4, Y - 0.2, Y + 0.4, 107.8, 110.4);
      bx('firedbrick', tx1 - 0.4, tx1, Y - 0.2, Y + 0.4, 107.8, 110.4);
      bx('mud', tx0 + 0.4, tx1 - 0.4, Y - 0.2, Y + 0.25, 107.8, 110.4);
    }
    put('earth', DOME, V(96, Y - 0.05, 109), V(1.6, 0.9, 1.4));
    // the wheel under its reed shade: a stone disc on its pivot, a seat, a pot on it; a board of pots
    {
      const sx0 = 87.5, sx1 = 95.5, sz0 = 116, sz1 = 122.5;
      for (const [x, z] of [[sx0, sz0], [sx1, sz0], [sx0, sz1], [sx1, sz1]]) tube('wood', [V(x, Y, z), V(x, Y + 2.4, z)], [0.06, 0.05], 6);
      reedMat((sx0 + sx1) / 2, Y + 2.45, (sz0 + sz1) / 2, sx1 - sx0 + 0.4, sz1 - sz0 + 0.4, 0, 0, -0.04);
      put('stone', CYL, V(90.5, Y + 0.12, 119.2), V(0.16, 0.24, 0.16));
      put('stone', CYL, V(90.5, Y + 0.28, 119.2), V(0.45, 0.08, 0.45));
      put('buff', POT, V(90.5, Y + 0.32, 119.2), V(1, 0.8, 1));
      bx('wood', 89.4, 89.9, Y, Y + 0.3, 118.95, 119.45);
      bx('wood', 92.0, 95.0, Y + 0.45, Y + 0.5, 120.8, 121.4);
      for (const x of [92.2, 94.8]) bx('firedbrick', x - 0.15, x + 0.15, Y, Y + 0.45, 120.8, 121.4);
      for (let k = 0; k < 6; k++) put('buff', POT, V(92.4 + k * 0.45, Y + 0.5, 121.1), V(0.8, 0.8, 0.8), rng() * 6);
    }
    // the new pots drying in rows, the fired ones stacked by the kilns
    for (let i = 0; i < 14; i++) for (let j = 0; j < 5; j++) {
      if (rng() < 0.12) continue;
      // (bowls and pots, and here and there a jar, smaller)
      const jarIs = rng() < 0.3, s = (0.8 + rng() * 0.5) * (jarIs ? 0.5 : 1);
      put('buff', jarIs ? JAR : POT, V(66.5 + i * 1.05 + (rng() - 0.5) * 0.2, Y, 107.4 + j * 1.05 + (rng() - 0.5) * 0.2), V(s, s, s), rng() * 6);
    }
    for (let k = 0; k < 9; k++) put('clay', JAR, V(73.6 + (k % 3) * 0.75, Y, 116.4 + Math.floor(k / 3) * 0.75), V(0.55, 0.55, 0.55), rng() * 6);
    // the reeds for the fires, in bundles; the heap of wasters
    const bundle = new THREE.CylinderGeometry(0.2, 0.2, 2.6, 8).rotateZ(Math.PI / 2).deleteAttribute('uv');
    for (let k = 0; k < 10; k++) put('straw', bundle, V(83.5, Y + 0.2 + Math.floor(k / 4) * 0.36, 123.2 - (k % 4) * 0.42 - Math.floor(k / 4) * 0.21), V(1, 1, 1), Math.PI / 2 + (rng() - 0.5) * 0.1);
    const sherd = new THREE.BoxGeometry(0.22, 0.03, 0.16).deleteAttribute('uv');
    for (let k = 0; k < 40; k++) put('clay', sherd, V(98.5 + (rng() - 0.5) * 2.2, Y + 0.02 + rng() * 0.25, 123.4 + (rng() - 0.5) * 1.6), V(1, 1, 1), rng() * 6);
  }
  for (const [k, b] of Object.entries(kit.B)) for (let i = beforePotters[k] ?? 0; i < b.count; i++) b.p[i * 3 + 2] += COURT_DZ;
}

// a lyre standing on the floor (as the temple's: temple.js), at p, facing yaw
function lyre(put, tube, p, yaw) {
  const q = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
  const at = (x, y, z) => V(x, y, z).applyQuaternion(q).add(p);
  put('wood', new THREE.BoxGeometry(0.9, 0.6, 0.2).deleteAttribute('uv'), at(0, 0.3, 0), V(1, 1, 1), yaw);
  tube('wood', [at(-0.34, 0.55, 0), at(-0.38, 1.0, 0), at(-0.44, 1.42, 0)], 0.035, 6);
  tube('wood', [at(0.34, 0.55, 0), at(0.38, 1.0, 0), at(0.44, 1.42, 0)], 0.035, 6);
  tube('wood', [at(-0.55, 1.43, 0), at(0.55, 1.39, 0)], 0.03, 6);
  for (let k = 0; k < 8; k++) {
    const u = -0.26 + k * 0.075;
    tube('linen', [at(u, 0.5, 0.06), at(u * 1.1, 1.41, 0.03)], 0.004, 3);
  }
}
