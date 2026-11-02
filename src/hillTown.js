// The hill town: houses packed over the mound round its one way up, stepping down the slope;
// the curved lane's stepped ramps and the long stair's flights; below the stair, on its river side, the houses
// kept down to its level, a parapet along it; the courtyard on the top with the lookout; the temple's terrace and
// its wall above the stair. The houses are the bay
// quarter's (houseKit.js): along the lane and round the courtyard the detailed small ones, their doors shut and
// dressed, all opening onto the way; the rest plain, without doors.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { makeRng, shuffle } from './rand.js';
import { makeKit } from './houseKit.js';
import { heightAt } from './hillLand.js';
import {
  LANES, laneAt, openAt as planOpen, RAMP, STAIR, PLAZA, LOOKOUT, PRECINCT, STAIR_X, stairY, CARVE, inCarve, roofCap, inTown,
  TEMPLE_GATE, TEMPLE_STEPS, inCourtHouse, inCourtSquare, inSquareFill, COURT_YARD, workshopAt, OUTER, TOWN_EDITS,
} from './hillPlan.js';
import { buildCourtHouse } from './courtHouse.js';
import { buildWorkshop } from './workshop.js';
import { buildTemple, buildTempleYard } from './temple.js';
import { buildOuterCourt } from './outerCourt.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
// a drift of dust or sand: a low dome
const DUNE = new THREE.SphereGeometry(1, 9, 4, 0, Math.PI * 2, 0, Math.PI / 2).deleteAttribute('uv');

// (carve: false leaves the teacher's house and its grounds out of the plan: for comparing the layout without them)
export function buildHillTown(scene, { carve = true } = {}) {
  // the dice: each stage of the layout, and each house, throws its own, seeded by what it is or where it stands
  // (one stream for everything shifted the whole town whenever any one thing came to throw once more or less)
  let dice = makeRng(1911);
  const rng = () => dice();
  const seed = (...v) => {
    let h = 1911;
    for (const x of v) h = Math.imul(h ^ Math.round(x * 64), 2654435761) >>> 0;
    dice = makeRng(h);
  };

  // ---- the plan, on a half-metre grid: the way and the courtyard open, houses grown into the rest ----
  const G = 0.5, Q = { x0: -36, x1: 72, z0: -54, z1: 66 };
  const NX = Math.round((Q.x1 - Q.x0) / G), NZ = Math.round((Q.z1 - Q.z0) / G);
  const cell = new Uint8Array(NX * NZ);   // 0 free, 1 open, 2 house, 3 left open (a gap), 4 outside the town, 5 the teacher's house
  const cx = (i) => Q.x0 + (i + 0.5) * G, cz = (j) => Q.z0 + (j + 0.5) * G;
  for (let j = 0; j < NZ; j++) {
    for (let i = 0; i < NX; i++) {
      const x = cx(i), z = cz(j), l = laneAt(x, z);
      // (a lane's cells to a quarter metre past its edge, so no house's wall stands on it)
      cell[j * NX + i] = planOpen(x, z) || (!l.lane.stair && l.d < l.lane.w / 2 + 0.25) ? 1 : inTown(x, z) ? 0 : 4;
    }
  }
  const free = (i, j) => i >= 0 && j >= 0 && i < NX && j < NZ && cell[j * NX + i] === 0;
  // (the open cells in front of a house set back from a lane: the steps reach out over them)
  const fore = new Uint8Array(NX * NZ);

  // ---- first the houses along the lanes (not the stair, not the square): laid out on their own, shoulder to
  // shoulder in a row down each side, each a few metres of it, stepping up as the lane climbs; every one's door on
  // the lane. Square to the plan as the lanes are, each set back from the lane's edge by its own few metres or
  // less (SETBACK), never as far as its neighbour's; what is in front of it kept open, the lane's (its zone: the
  // steps reach out over it, below). The town is packed round them ----
  const SETBACK = [0.4, 0.85, 1.3, 1.75];
  const fronts = [];
  let frontCells, openZone;
  seed(1);
  {
    const inRect = (x, z, r) => {
      const dx = x - r.cx, dz = z - r.cz, a = dx * -r.n.z + dz * r.n.x, b = dx * r.n.x + dz * r.n.z;
      return Math.abs(a) <= r.W / 2 && Math.abs(b) <= r.D / 2;
    };
    const cellsOf = (r, fn) => {
      const R = Math.hypot(r.W, r.D) / 2;
      for (let j = Math.max(0, Math.floor((r.cz - R - Q.z0) / G)); j < Math.min(NZ, Math.ceil((r.cz + R - Q.z0) / G)); j++) {
        for (let i = Math.max(0, Math.floor((r.cx - R - Q.x0) / G)); i < Math.min(NX, Math.ceil((r.cx + R - Q.x0) / G)); i++) {
          if (inRect(cx(i), cz(j), r)) fn(i, j);
        }
      }
    };
    frontCells = cellsOf;
    const fits = (r) => {
      let ok = true;
      cellsOf(r, (i, j) => { if (cell[j * NX + i] !== 0) ok = false; });
      return ok;
    };
    // (what is in front of a house: open, the lane's, from a little inside the lane's edge to its face)
    openZone = (f) => {
      const q = (f.s + 0.28) / 2 + f.D / 2 - 0.02;
      cellsOf({ cx: f.cx + f.n.x * q, cz: f.cz + f.n.z * q, n: f.n, W: f.W - 0.1, D: f.s + 0.28 }, (i, j) => {
        if (cell[j * NX + i] === 0) cell[j * NX + i] = 1;
        if (cell[j * NX + i] === 1) fore[j * NX + i] = 1;
      });
    };
    for (const l of LANES) {
      if (l.stair) continue;
      for (let i = 0; i < l.pts.length - 1; i++) {
        const a = l.pts[i], b = l.pts[i + 1];
        // (the run's axis, and how far along it; the lane's middle across it)
        const alongX = Math.abs(b.x - a.x) >= Math.abs(b.z - a.z), len = Math.abs(alongX ? b.x - a.x : b.z - a.z);
        if (len < 3) continue;   // (a landing's half)
        const ux = alongX ? Math.sign(b.x - a.x) : 0, uz = alongX ? 0 : Math.sign(b.z - a.z);
        const axis = alongX ? (a.z + b.z) / 2 : (a.x + b.x) / 2;
        const nC = Math.max(1, Math.round(len / 6.3));
        const cuts = [0, ...Array.from({ length: nC - 1 }, (_, k) => ((k + 1) * len) / nC + (rng() - 0.5) * 1.6), len];
        for (const sd of [-1, 1]) {
          const sx = -uz * sd, sz = ux * sd, out = alongX ? sz : sx;   // (from the lane out to this side; across, + or -)
          let prev = -1;
          for (let k = 0; k < nC; k++) {
            // (neighbours on a stretch butt exactly; one that will not fit is cut back from its ends, half a metre at
            // a time: at a turn, the inner corner's house stops short of the other run)
            const sets = SETBACK.filter((v) => Math.abs(v - prev) > 0.3), s = sets[Math.floor(rng() * sets.length)];
            const depths = [8 + rng() * 1.5, 6.5, 5, 4];
            let r = null, t0, t1;
            for (const [c0, c1] of [[0, 0], [0.5, 0], [0, 0.5], [1, 0], [0, 1], [1.5, 0], [0, 1.5], [1, 1], [2, 0], [0, 2], [2, 2]]) {
              t0 = cuts[k] + c0; t1 = cuts[k + 1] - c1;
              if (t1 - t0 < 3.2) continue;
              const W = t1 - t0, along = (alongX ? a.x : a.z) + (alongX ? ux : uz) * (t0 + t1) / 2;
              for (const D of depths) {
                const across = axis + out * (l.w / 2 + s + D / 2);
                const c = { cx: alongX ? along : across, cz: alongX ? across : along, n: V(-sx, 0, -sz), W, D };
                if (fits(c)) { r = c; break; }
              }
              if (r) break;
            }
            if (!r) continue;
            prev = s;
            cellsOf(r, (ii, jj) => { cell[jj * NX + ii] = 2; });
            // (the lane's height along its front: lowest and highest)
            const ya = a.y + ((b.y - a.y) * t0) / len, yb = a.y + ((b.y - a.y) * t1) / len;
            const f = { ...r, ux, uz, ya, yb, lane: l, alongX, axis, out, s };
            openZone(f);
            fronts.push(f);
          }
        }
      }
    }
  }
  const houses = [], small = [];
  // ---- round the courtyard, likewise a ring of houses square to it, each its own width and depth, built as the
  // detailed ones with their doors on it (packed at random, its sides had come out the long blank sides of big
  // houses). The rows north and south run on past its corners; east and west between them ----
  seed(2);
  {
    const P = PLAZA, snap = (v) => Math.round(v / G) * G;
    const cellsIn = (x0, x1, z0, z1, fn) => {
      for (let j = Math.round((z0 - Q.z0) / G); j < Math.round((z1 - Q.z0) / G); j++) {
        for (let i = Math.round((x0 - Q.x0) / G); i < Math.round((x1 - Q.x0) / G); i++) if (fn(i, j) === false) return false;
      }
      return true;
    };
    const row = (a0, a1, make) => {
      for (let a = a0; a < a1 - 3;) {
        const b = Math.min(a + snap(5.5 + rng() * 2.5), a1);
        let r = null;
        for (const D of [snap(7 + rng() * 1.5), 6, 5]) {
          const c = make(a, b, D);
          if (cellsIn(...c, (i, j) => free(i, j))) { r = c; break; }
        }
        if (r) {
          cellsIn(...r, (i, j) => { cell[j * NX + i] = 2; });
          houses.push({ x0: r[0], x1: r[1], z0: r[2], z1: r[3] });
          a = b;
        } else a += 0.5;
      }
    };
    row(P.x0 - 6, P.x1 + 6, (a, b, D) => [a, b, P.z0 - D, P.z0]);
    row(P.x0 - 6, P.x1 + 6, (a, b, D) => [a, b, P.z1, P.z1 + D]);
    row(P.z0, P.z1, (a, b, D) => [P.x0 - D, P.x0, a, b]);
    row(P.z0, P.z1, (a, b, D) => [P.x1, P.x1 + D, a, b]);
  }
  seed(3);
  const order = [];
  for (let j = 0; j < NZ; j += 2) for (let i = 0; i < NX; i += 2) order.push([i, j]);
  for (let k = order.length - 1; k > 0; k--) { const t = Math.floor(rng() * (k + 1)); [order[k], order[t]] = [order[t], order[k]]; }
  // (first the houses along the way, grown from just beside it every few metres, so a house and not a leftover
  // shed lines it; then the rest, anywhere)
  const edge = [];
  for (const l of LANES) {
    if (l.stair) continue;
    for (let i = 0; i < l.pts.length - 1; i++) {
      const a = l.pts[i], b = l.pts[i + 1], len = Math.hypot(b.x - a.x, b.z - a.z), ux = (b.x - a.x) / len, uz = (b.z - a.z) / len;
      for (let t = 1; t < len; t += 3.5) {
        for (const sd of [-1, 1]) {
          const x = a.x + ux * t - uz * sd * (l.w / 2 + 0.6), z = a.z + uz * t + ux * sd * (l.w / 2 + 0.6);
          edge.push([Math.floor((x - Q.x0) / G), Math.floor((z - Q.z0) / G)]);
        }
      }
    }
  }
  // (a house grown from a free cell, as big as it may be up to a size thrown for it; its dice its own, thrown where it
  // starts, so a change in one part of the town leaves the houses in the others as they were. First only the
  // houses: what is too small for one is left free, for the houses beside it to take up, below)
  const grow = (i, j, firstPass) => {
    seed(3, i, j);
    // (smaller than the bay's: a hill town's houses crowd)
    const tw = (4.5 + rng() * 6.5) / G, td = (4.5 + rng() * 6) / G;
    let i0 = i, i1 = i, j0 = j, j1 = j;
    for (let grew = true; grew;) {
      grew = false;
      for (const d of shuffle([0, 1, 2, 3], rng)) {
        if ((d < 2 && i1 - i0 + 1 >= tw) || (d >= 2 && j1 - j0 + 1 >= td)) continue;
        let ok = true;
        if (d === 0) { for (let jj = j0; jj <= j1 && ok; jj++) ok = free(i1 + 1, jj); if (ok) i1++; }
        if (d === 1) { for (let jj = j0; jj <= j1 && ok; jj++) ok = free(i0 - 1, jj); if (ok) i0--; }
        if (d === 2) { for (let ii = i0; ii <= i1 && ok; ii++) ok = free(ii, j1 + 1); if (ok) j1++; }
        if (d === 3) { for (let ii = i0; ii <= i1 && ok; ii++) ok = free(ii, j0 - 1); if (ok) j0--; }
        grew ||= ok;
      }
    }
    const w = (i1 - i0 + 1) * G, d = (j1 - j0 + 1) * G;
    const r = { x0: Q.x0 + i0 * G, x1: Q.x0 + (i1 + 1) * G, z0: Q.z0 + j0 * G, z1: Q.z0 + (j1 + 1) * G };
    const big = w >= 3.5 && d >= 3.5;
    if (firstPass && !big) return;
    for (let jj = j0; jj <= j1; jj++) for (let ii = i0; ii <= i1; ii++) cell[jj * NX + ii] = big || (w >= 1.5 && d >= 1.5) ? 2 : 3;
    if (big) houses.push(r);
    else if (w >= 1.5 && d >= 1.5) small.push(r);
  };
  const grown = houses.length;
  for (const [i, j] of [...edge, ...order]) if (free(i, j)) grow(i, j, true);
  // (then each house takes up the free strips beside it, a row of cells at a time where the whole row along its
  // side is free, up to two metres: the slivers between houses that did not quite meet become rooms, not sheds. The
  // houses along the lanes too, at their backs and sides, their fronts kept on the lane)
  const absorb = (h, sides) => {
    // (the cells just outside each side, by their centres: the lanes' houses are not on the grid's lines)
    const iIn0 = () => Math.ceil((h.x0 - Q.x0) / G - 0.5), iIn1 = () => Math.floor((h.x1 - Q.x0) / G - 0.5);
    const jIn0 = () => Math.ceil((h.z0 - Q.z0) / G - 0.5), jIn1 = () => Math.floor((h.z1 - Q.z0) / G - 0.5);
    const rowFree = (i0, i1, j0, j1) => { for (let jj = j0; jj <= j1; jj++) for (let ii = i0; ii <= i1; ii++) if (!free(ii, jj)) return false; return true; };
    for (const side of sides) {
      for (let k = 0; k < 4; k++) {
        const i0 = iIn0(), i1 = iIn1(), j0 = jIn0(), j1 = jIn1();
        const at = (o) => [[i1 + o, i1 + o, j0, j1], [i0 - o, i0 - o, j0, j1], [i0, i1, j1 + o, j1 + o], [i0, i1, j0 - o, j0 - o]][side];
        if (!rowFree(...at(1))) break;
        // (only a strip, not open country to grow into: something within two and a half metres beyond)
        if (k === 0 && [2, 3, 4, 5].every((o) => rowFree(...at(o)))) break;
        const [a0, a1, b0, b1] = at(1);
        for (let jj = b0; jj <= b1; jj++) for (let ii = a0; ii <= a1; ii++) cell[jj * NX + ii] = 2;
        if (side === 0) h.x1 = Q.x0 + (a1 + 1) * G; else if (side === 1) h.x0 = Q.x0 + a0 * G;
        else if (side === 2) h.z1 = Q.z0 + (b1 + 1) * G; else h.z0 = Q.z0 + b0 * G;
      }
    }
  };
  for (const h of houses.slice(grown)) absorb(h, [0, 1, 2, 3]);
  for (const f of fronts) {
    // (as a box on the plan; not the side its front is on, towards the lane: n)
    const alongX = Math.abs(f.n.z) > 0.5, hw = (alongX ? f.W : f.D) / 2, hd = (alongX ? f.D : f.W) / 2;
    const h = { x0: f.cx - hw, x1: f.cx + hw, z0: f.cz - hd, z1: f.cz + hd };
    absorb(h, [0, 1, 2, 3].filter((sd) => !(sd === 0 && f.n.x > 0.5) && !(sd === 1 && f.n.x < -0.5) && !(sd === 2 && f.n.z > 0.5) && !(sd === 3 && f.n.z < -0.5)));
    f.cx = (h.x0 + h.x1) / 2; f.cz = (h.z0 + h.z1) / 2;
    if (alongX) { f.W = h.x1 - h.x0; f.D = h.z1 - h.z0; } else { f.W = h.z1 - h.z0; f.D = h.x1 - h.x0; }
    openZone(f);
  }
  for (const [i, j] of [...edge, ...order]) if (free(i, j)) grow(i, j, false);

  // ---- the teacher's house, the little square before it and its yard (hillPlan.js COURT_HOUSE, COURT_SQUARE, COURT_YARD; courtHouse.js):
  // carved out of the plan once it is packed, so nothing else in the town moves. The houses on their ground go
  // (a lane's row cut back to a shallower house where that clears it); what they leave beside it is packed again,
  // each new house from dice of its own. The house's cells are 5 (walked in, its walls stopping one), the
  // square's open ----
  if (carve) {
    const onHouse = (x, z) => inCourtHouse(x, z, 0.35), onSquare = (x, z) => inCourtSquare(x, z, 0.05);
    const hit = (x, z) => onHouse(x, z) || onSquare(x, z);
    const freed = [];
    const rectCells = (r, fn) => {
      for (let j = Math.round((r.z0 - Q.z0) / G); j < Math.round((r.z1 - Q.z0) / G); j++) {
        for (let i = Math.round((r.x0 - Q.x0) / G); i < Math.round((r.x1 - Q.x0) / G); i++) fn(i, j);
      }
    };
    const clear = (i, j) => { cell[j * NX + i] = 0; freed.push(j * NX + i); };
    for (const list of [houses, small]) {
      for (let k = list.length - 1; k >= 0; k--) {
        let on = false;
        rectCells(list[k], (i, j) => { on ||= hit(cx(i), cz(j)); });
        if (!on) continue;
        rectCells(list[k], clear);
        list.splice(k, 1);
      }
    }
    for (let k = fronts.length - 1; k >= 0; k--) {
      const r = fronts[k];
      let on = false;
      frontCells(r, (i, j) => { on ||= hit(cx(i), cz(j)); });
      if (!on) continue;
      frontCells(r, clear);
      fronts.splice(k, 1);
      // (the same house, its front on the lane where it was, less deep)
      for (const D of [6.5, 5, 4]) {
        if (D >= r.D) continue;
        const c = { ...r, cx: r.cx + r.n.x * (r.D - D) / 2, cz: r.cz + r.n.z * (r.D - D) / 2, D };
        let ok = true;
        frontCells(c, (i, j) => { ok &&= cell[j * NX + i] === 0 && !hit(cx(i), cz(j)); });
        if (!ok) continue;
        frontCells(c, (i, j) => { cell[j * NX + i] = 2; });
        fronts.splice(k, 0, c);
        break;
      }
    }
    for (let j = 0; j < NZ; j++) {
      for (let i = 0; i < NX; i++) {
        const c = cell[j * NX + i];
        if (c === 4 || (c === 1 && !fore[j * NX + i])) continue;
        if (inCourtHouse(cx(i), cz(j))) { cell[j * NX + i] = 5; fore[j * NX + i] = 0; }
        else if (onSquare(cx(i), cz(j))) { cell[j * NX + i] = 1; fore[j * NX + i] = 0; }
      }
    }
    for (const k of freed) {
      const i = k % NX, j = Math.floor(k / NX);
      if (i % 2 || j % 2 || !free(i, j)) continue;
      seed(9, i, j);
      grow(i, j);
    }
  }
  const cellAt = (x, z) => {
    const i = Math.floor((x - Q.x0) / G), j = Math.floor((z - Q.z0) / G);
    return i < 0 || j < 0 || i >= NX || j >= NZ ? 4 : cell[j * NX + i];
  };
  const openAt = (x, z) => cellAt(x, z) === 1;

  // ---- the houses packed along the lanes stand back from them too, each by its own half metres or none (the lane's
  // own houses, above, by theirs): what they give up open, in front of them ----
  for (const h of houses) {
    seed(14, h.x0, h.z0);
    // (each side: its cells just outside, and which way it gives back)
    for (const [side, along, at] of [[0, true, (t) => [t, h.z0 - 0.25]], [1, true, (t) => [t, h.z1 + 0.25]], [2, false, (t) => [h.x0 - 0.25, t]], [3, false, (t) => [h.x1 + 0.25, t]]]) {
      const [a0, a1] = along ? [h.x0, h.x1] : [h.z0, h.z1];
      let on = 0, all = 0;
      for (let t = a0 + 0.25; t < a1; t += 0.5) {
        all++;
        const [x, z] = at(t), l = laneAt(x, z);
        if (l.lane.stair || l.d > l.lane.w / 2 + 0.3 || cellAt(x, z) !== 1) continue;
        const p = l.lane.pts[l.i], q = l.lane.pts[l.i + 1];
        if ((Math.abs(q.x - p.x) > Math.abs(q.z - p.z)) === along) on++;
      }
      if (on < all * 0.6) continue;
      const deep = along ? h.z1 - h.z0 : h.x1 - h.x0;
      const m = Math.min([0, 0.5, 1, 1.5][Math.floor(rng() * 4)], Math.floor((deep - 4) / G) * G);
      if (m <= 0) continue;
      const r = side === 0 ? { ...h, z1: h.z0 + m } : side === 1 ? { ...h, z0: h.z1 - m } : side === 2 ? { ...h, x1: h.x0 + m } : { ...h, x0: h.x1 - m };
      for (let j = Math.round((r.z0 - Q.z0) / G); j < Math.round((r.z1 - Q.z0) / G); j++) {
        for (let i = Math.round((r.x0 - Q.x0) / G); i < Math.round((r.x1 - Q.x0) / G); i++) { cell[j * NX + i] = 1; fore[j * NX + i] = 1; }
      }
      if (side === 0) h.z0 += m; else if (side === 1) h.z1 -= m; else if (side === 2) h.x0 += m; else h.x1 -= m;
    }
  }

  // ---- each lane house's height, and its door (a garden's gate), thrown now with its own dice as it will be built
  // (below). In front of some of those set well back, a bed along their front, away from the door ----
  for (const r of fronts) {
    seed(5, r.cx, r.cz);
    const hiLane = Math.max(r.ya, r.yb), under = r.cx > CARVE.x0 - 4 && r.cx < STAIR_X && r.cz > CARVE.z0 - 2 && r.cz < CARVE.z1 + 2;
    r.top = hiLane + 3.7 + rng() * 0.6;
    if (under) r.top = Math.min(r.top, stairY(r.cz) - 0.4);
    r.garden = r.top - hiLane < 3.0;
    const v = rng();
    r.tDoor = r.garden ? r.W / 2 + (v - 0.5) * Math.max(0, r.W - 2.8) : r.W / 2 + (v - 0.5) * Math.max(0, r.W - 3.2);
    // (along the lane: where it begins and ends)
    const alongOf = (t) => (r.alongX ? r.cx - r.n.z * (t - r.W / 2) : r.cz + r.n.x * (t - r.W / 2));
    [r.p0, r.p1] = [alongOf(0), alongOf(r.W)].sort((p, q) => p - q);
    seed(13, r.cx, r.cz);
    if (r.garden || r.s < 1.25 || rng() > 0.6) continue;
    const lo = r.tDoor - 2, hi = r.W - r.tDoor - 2;
    if (Math.max(lo, hi) < 1.2) continue;
    r.bedT = lo > hi ? [0, lo] : [r.tDoor + 2, r.W];
    r.bed = [...[alongOf(r.bedT[0]), alongOf(r.bedT[1])].sort((p, q) => p - q), Math.min(0.55 + rng() * 0.4, r.s - 0.37)];
  }
  // ---- the flights of steps, on each stretch steeper than a ramp (drawn below): each tread square to the lane, its
  // line straight, the lane's width, and either side reaching out over what is open in front of the houses, to a
  // hand's breadth from a house's face (its plinth): so where the houses stand back or forward, tread by tread its
  // ends do. Where a bed is laid along a house's front, they stop at its kerb ----
  const flightOf = (l, i) => {
    let a = l.pts[i], b = l.pts[i + 1];
    const len = Math.hypot(b.x - a.x, b.z - a.z), slope = Math.abs(b.y - a.y) / len;
    if (slope < RAMP) return null;
    if (a.y > b.y) [a, b] = [b, a];
    const steep = slope > STAIR, n = Math.max(1, Math.round((b.y - a.y) / (steep ? 0.16 : 0.13)));
    const alongX = Math.abs(b.x - a.x) >= Math.abs(b.z - a.z), dir = Math.sign(alongX ? b.x - a.x : b.z - a.z);
    const run = Math.abs(alongX ? b.x - a.x : b.z - a.z) / n, axis = alongX ? (a.z + b.z) / 2 : (a.x + b.x) / 2;
    // (q along, c across from its middle)
    const xz = (q, c) => (alongX ? [q, axis + c] : [axis + c, q]);
    // (k0: the lowest treads left out, where the lane has them bare)
    return { l, a, b, n, k0: l.bare?.[i] ?? 0, rise: (b.y - a.y) / n, run, steep, alongX, dir, A: alongX ? a.x : a.z, axis, xz, yaw: Math.atan2(alongX ? dir : 0, alongX ? 0 : dir), e: {}, face: {} };
  };
  const foreAt = (x, z) => { const i = Math.floor((x - Q.x0) / G), j = Math.floor((z - Q.z0) / G); return i >= 0 && j >= 0 && i < NX && j < NZ && fore[j * NX + i] === 1; };
  // (what stands: the houses, as they are, not as the plan's cells round them; and what lies before a lane's house)
  const rectOf = (f) => (f.alongX ? { x0: f.cx - f.W / 2, x1: f.cx + f.W / 2, z0: f.cz - f.D / 2, z1: f.cz + f.D / 2 } : { x0: f.cx - f.D / 2, x1: f.cx + f.D / 2, z0: f.cz - f.W / 2, z1: f.cz + f.W / 2 });
  // (the local changes to the packed plan: hillPlan.js TOWN_EDITS)
  const holds = ([x, z]) => (r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
  for (const c of TOWN_EDITS.smallClip) { const r = small.find(holds(c.at)); if (r) Object.assign(r, c, { at: undefined }); }
  // (houses on the top's square widened over the corners, where one squeezed in showed only a narrow end; the one
  // there drawn back out of sight behind its neighbour: TOWN_EDITS.resize. Each keeps the dice of where it stood)
  for (const [h, e] of TOWN_EDITS.resize.map((e) => [houses.find(holds(e.at)), e]).filter(([h]) => h)) {
    h.seedAt ??= [h.x0, h.z0];
    for (const k of ['x0', 'x1', 'z0', 'z1']) if (e[k] !== undefined) h[k] = e[k];
  }
  for (const at of TOWN_EDITS.whole) { const h = houses.find(holds(at)); if (h) h.whole = true; }
  // (and no rug hung over a parapet on a side opened, nor on the side one sees from the stair)
  for (const g of TOWN_EDITS.parapetGap) { const h = houses.find(holds(g.at)); if (h) { (h.gaps ??= []).push(g); (h.noRug ??= []).push(g.side); } }
  // (and nothing on a roof where the steps come down onto it from the stair: TOWN_EDITS.stairGap; with an arbour
  // there, nothing else at all)
  for (const sg of TOWN_EDITS.stairGap) {
    const h = houses.find(holds(sg.roof)), xr = STAIR_X - LANES[1].w / 2 - 0.22;
    if (h) (h.avoid ??= []).push({ x: xr - 1.1, z: (sg.z0 + sg.z1) / 2, w: 2.2, d: sg.z1 - sg.z0 + 0.4 });
    if (h && sg.arbour) h.noLife = true;
  }
  const standing = [...fronts.map(rectOf), ...houses, ...small];
  const zones = fronts.map((f) => {
    const r = rectOf(f), m = f.s + 0.3;
    return f.alongX ? { ...r, z0: f.out > 0 ? r.z0 - m : r.z1, z1: f.out > 0 ? r.z0 : r.z1 + m } : { ...r, x0: f.out > 0 ? r.x0 - m : r.x1, x1: f.out > 0 ? r.x0 : r.x1 + m };
  });
  const inR = (x, z) => (r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
  const solid = (x, z) => standing.some(inR(x, z)) || inCourtHouse(x, z, 0.05);
  const zoneAt = (x, z) => zones.some(inR(x, z));
  const flights = [], beds = [];
  seed(12);
  for (const l of LANES) {
    for (let i = 0; i < l.pts.length - 1; i++) {
      const F = flightOf(l, i);
      if (!F) continue;
      F.i = i;
      const span = (k) => [Math.min(F.A + F.dir * k * F.run, F.A + F.dir * (k + 1) * F.run), Math.max(F.A + F.dir * k * F.run, F.A + F.dir * (k + 1) * F.run)];
      for (const out of [-1, 1]) {
        const e = [], face = [];
        const mine = fronts.filter((f) => f.lane === l && f.alongX === F.alongX && f.out === out && Math.abs(f.axis - F.axis) < 0.3);
        for (let k = 0; k < F.n; k++) {
          const [q0, q1] = span(k);
          if (l.stair) { e.push(0.25); face.push(null); continue; }
          if (k < F.k0) { e.push(0); face.push(null); continue; }
          const cov = mine.filter((f) => f.p1 > q0 && f.p0 < q1).sort((f, g) => f.p0 - g.p0);
          let to = q0 + 0.05;
          for (const f of cov) if (f.p0 <= to) to = Math.max(to, f.p1);
          // (out over what is open in front of a house set back, to its face; else just past the lane's edge, as far
          // as its ground goes)
          const at = (c) => [q0 + 0.03, (q0 + q1) / 2, q1 - 0.03].map((q) => F.xz(q, out * (l.w / 2 + c)));
          let c = 0, wall = false;
          while (c < 2.2) {
            const pts = at(c + 0.05);
            if (pts.some(([x, z]) => solid(x, z))) { wall = true; break; }
            if (!pts.every(([x, z]) => cellAt(x, z) === 1 && (c + 0.05 <= 0.2 || foreAt(x, z) || zoneAt(x, z)))) break;
            c += 0.05;
          }
          e.push(wall ? Math.max(0, c - 0.15) : Math.min(c, c > 0.2 ? c - 0.12 : 0.18));
          if (cov.length && to >= q1 - 0.05) {
            const s = Math.min(...cov.map((f) => f.s)), bed = Math.max(0, ...cov.map((f) => (f.bed && f.bed[1] > q0 && f.bed[0] < q1 ? f.bed[2] : 0)));
            e[k] = Math.min(e[k], s - 0.17 - bed); face.push(s - 0.14);
          } else face.push(null);
          // (a few centimetres short of it, now and then)
          if (e[k] > 0.4) e[k] -= rng() * 0.06;
        }
        // (a run's steps moved across it (l.shift): the edge it moves from comes in, the other goes out, and on
        // the side it leaves no bed is laid)
        const sh = l.shift?.[i] ?? 0;
        if (sh) for (let k = F.k0; k < F.n; k++) { e[k] += out * sh; if (out * sh < 0) face[k] = null; }
        F.e[out] = e; F.face[out] = face;
        for (let k = 0; k < F.n; k++) {
          if (face[k] === null || face[k] - e[k] < 0.3) continue;
          const [q0, q1] = span(k), [x0, z0] = F.xz(q0, out * (l.w / 2 + e[k])), [x1, z1] = F.xz(q1, out * (l.w / 2 + face[k]));
          beds.push({ F, k, out, x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), top: F.a.y + (k + 1) * F.rise + 0.24 });
        }
      }
      flights.push(F);
    }
  }
  // a door opens onto the curved lane (not half way up a flight), the climb or the courtyard; never onto the
  // stair (the houses below it have their roofs at its level)
  const inPlaza = (x, z) => x > PLAZA.x0 && x < PLAZA.x1 && z > PLAZA.z0 && z < PLAZA.z1;
  const doorAt = (x, z) => {
    if (!openAt(x, z)) return false;
    if (Math.hypot(x - STAIR_X, z - TEMPLE_GATE.z) < 3.8) return false;   // (not facing the temple's gateway, in its way)
    if (inPlaza(x, z)) return true;
    const l = laneAt(x, z);
    return !l.lane.noDoors && l.slope < STAIR;
  };
  const centre = (h) => [(h.x0 + h.x1) / 2, (h.z0 + h.z1) / 2];
  // the top of the tread underfoot, where a lane is stepped (as the steps are laid, below): a door's sill sits on
  // it, not on the slope under the steps (a door there was half sunk in them); and on a bed beside the steps, its
  // earth
  const sillAt = (x, z) => {
    let y = heightAt(x, z);
    for (const b of beds) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return Math.max(y, b.top);
    const l = laneAt(x, z);
    if (l.d > l.lane.w / 2 + 2.2 || l.slope < RAMP) return y;
    const a = l.lane.pts[l.i], b = l.lane.pts[l.i + 1], n = Math.max(1, Math.round(Math.abs(b.y - a.y) / (l.slope > STAIR ? 0.16 : 0.13)));
    const up = a.y <= b.y, u = up ? l.t : 1 - l.t, y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y), k = Math.min(n - 1, Math.floor(u * n));
    if (k < (l.lane.bare?.[l.i] ?? 0)) return y;
    return Math.max(y, y0 + ((k + 1) * (y1 - y0)) / n);
  };
  // round the lookout the houses stay low (it sees over them); below the stair they are kept to its level
  const maxStoreys = (h) => {
    const [x, z] = centre(h);
    return Math.hypot(x - LOOKOUT.x, z - LOOKOUT.z) < 24 || (x > CARVE.x0 - 4 && x < STAIR_X && z > CARVE.z0 - 4 && z < CARVE.z1 + 8) ? 1 : 2;
  };
  const underStair = (h) => { const [x, z] = centre(h); return x > CARVE.x0 - 4 && x < STAIR_X && z > CARVE.z0 - 2 && z < CARVE.z1 + 2; };
  // below the stair, the houses along the curved lane let up a storey over it (raised: their caps): a door on
  // the lane, on its lower side the lower storey below it down the slope. Those nearer the stair's foot, where a
  // storey would stand over the stair, and the rest behind them stay down under the stair's view
  const raised = new Map();
  {
    const curve = LANES[0];
    for (const h of houses) {
      if (!underStair(h)) continue;
      let n = 0, y = -Infinity;
      for (let t = 0.5; t < Math.max(h.x1 - h.x0, h.z1 - h.z0) - 0.5; t += 0.5) {
        for (const [x, z] of [[h.x0 + t, h.z0 - 0.9], [h.x0 + t, h.z1 + 0.9], [h.x0 - 0.9, h.z0 + t], [h.x1 + 0.9, h.z0 + t]]) {
          if (x > h.x1 + 1 || z > h.z1 + 1) continue;
          const l = laneAt(x, z);
          if (l.lane === curve && l.d < curve.w / 2) { n++; y = Math.max(y, l.y); }
        }
      }
      if (n < 2) continue;
      // (a storey over the lane; its roof at the stair's level at most)
      const cap = Math.min(y + 4.0, stairY(centre(h)[1]) + 0.2);
      if (cap - y < 3.2) continue;
      raised.set(h, cap);
    }
  }
  // (the house against the teacher's yard on its west, and what stands behind its back wall, kept down to the yard
  // wall's height, parapet and all: so the sun falls into the yard all afternoon, on the new tablets drying there)
  const YD = COURT_YARD.outline, ydX0 = Math.min(...YD.map((p) => p[0])), ydX1 = Math.max(...YD.map((p) => p[0]));
  const ydZ0 = Math.min(...YD.map((p) => p[1])), ydZ1 = Math.max(...YD.map((p) => p[1]));
  const byYard = (h) => h.x0 < ydX1 + 0.5 && h.x1 > ydX0 - 0.7 && h.z0 < ydZ1 + 0.7 && h.z1 > ydZ0;
  const capAt = (h) => (byYard(h) ? COURT_YARD.y + 0.6 : raised.has(h) ? raised.get(h) : underStair(h) ? roofCap(Math.max(h.x0, CARVE.x0), centre(h)[1]) : Infinity);
  // what is out on the roofs: most where one looks down on them, from the stair and from the lookout
  const roofBusy = (h) => {
    const [x, z] = centre(h);
    if (x > CARVE.x0 - 14 && x < STAIR_X && z > CARVE.z0 - 6 && z < CARVE.z1 + 6) return 3;
    return Math.hypot(x - LOOKOUT.x, z - LOOKOUT.z) < 34 ? 1.2 : 0.5;
  };
  const kit = makeKit({ rng, heightAt, openAt, doorAt, outAt: (x, z) => cellAt(x, z) === 4, sloped: true, capAt, maxStoreys, roofBusy, sillAt });
  const { get, box, wall, shell, rail, build, heroBuild, paintedJar, pot, conePanel, decor, courts, doors, uppers } = kit;

  // ---- the houses: along the main street and round the square the detailed ones, the rest plain ----
  const onMain = (h) => {
    let n = 0;
    for (let t = 1.3; t < Math.max(h.x1 - h.x0, h.z1 - h.z0) - 1.3; t += 0.5) {
      for (const [x, z] of [[h.x0 + t, h.z0 - 0.9], [h.x0 + t, h.z1 + 0.9], [h.x0 - 0.9, h.z0 + t], [h.x1 + 0.9, h.z0 + t]]) {
        if (x > h.x1 + 1 || z > h.z1 + 1 || !doorAt(x, z)) continue;
        const l = laneAt(x, z);
        if (inPlaza(x, z) || (l.lane.main && l.d < l.lane.w / 2)) n++;
      }
    }
    return n >= 2;
  };
  // round the courtyard, some of them with an upper room, a terrace and an outside stair (not where they would
  // stand in the lookout's views: east to the Euphrates' east branch, west to the river, south-east to the ziggurat)
  const onPlaza = (h) => {
    const [x, z] = centre(h);
    if (Math.max(PLAZA.x0 - h.x1, h.x0 - PLAZA.x1, PLAZA.z0 - h.z1, h.z0 - PLAZA.z1) > 1.2) return false;
    const a = Math.atan2(z - LOOKOUT.z, x - LOOKOUT.x);
    return (a < -0.7 && a > -2.4) || (a > 1.4 && a < 2.4);
  };
  let heroN = 0, upperN = 0;
  for (const h of houses) {
    const w = h.x1 - h.x0, d = h.z1 - h.z0;
    seed(4, ...(h.seedAt ?? [h.x0, h.z0]));
    if (w < 12 && d < 12 && w > 4 && d > 4 && (capAt(h) === Infinity || raised.has(h)) && onMain(h)) {
      // (TOWN_EDITS.squareUpper: an upper room given or taken away, or set beside its terrace)
      const ov = TOWN_EDITS.squareUpper.find((e) => holds(e.at)(h));
      const two = maxStoreys(h) === 2 && rng() < 0.45;
      const r = heroBuild(h, { kind: rng() < 0.33 ? 'redwash' : 'whitewash', storeys: two ? 2 : 1, upper: ov?.upper ?? onPlaza(h), side: !!ov?.side });
      heroN++;
      if (r.up) upperN++;
    } else build(h, { storeys: centre(h)[1] > 50 && centre(h)[0] > -10 ? 2 : null });   // (closing the view south past the gateway)
  }
  // (trees in planters on roofs: TOWN_EDITS.roofTrees; hillScene.js plants them, town.extraTrees. On the houses
  // here; on those along the lanes once they are built, below)
  const extraTrees = [];
  const roofTree = (t, y) => {
    const [x, z] = t.at;
    box('whitewash', x, y + 0.22, z, 1.3, 0.48, 1.3);
    box('earth', x, y + 0.44, z, 1.1, 0.06, 1.1);
    extraTrees.push({ x, z, y: y + 0.46, kind: t.kind, s: t.s });
  };
  for (const t of TOWN_EDITS.roofTrees) {
    const hh = houses.find(holds(t.at));
    if (hh?.roofY !== undefined) roofTree(t, hh.roofY);
  }
  // (and in the ground, TOWN_EDITS.groundTrees: a ring of whitewashed brick round each, its earth a hand up)
  const groundTrees = TOWN_EDITS.groundTrees.map(({ at: [x, z], kind, s }) => {
    const y = heightAt(x, z), lo = Math.min(...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([u, v]) => heightAt(x + u * 0.5, z + v * 0.5))) - 0.3;
    for (const [u, v, a, b] of [[0, -0.42, 1.0, 0.16], [0, 0.42, 1.0, 0.16], [-0.42, 0, 0.16, 0.68], [0.42, 0, 0.16, 0.68]]) wall('whitewash', x + u, (y + 0.22 + lo) / 2, z + v, a, y + 0.22 - lo, b);
    box('earth', x, (y + 0.12 + lo) / 2, z, 0.7, y + 0.12 - lo, 0.7);
    return { x, z, y: y + 0.12, kind, s };
  });
  // the houses along the lanes: a storey over the lane at the higher end of their front (below the stair a little
  // under the stair, so one sees over them to the river); where that leaves too little for a storey, a little
  // walled garden with a tree. (The gateway that stood where the lane leaves the quay went: the rows of houses
  // begin there now, and its piers stood out in front of them)
  let frontN = 0;
  for (const r of fronts) {
    seed(5, r.cx, r.cz);
    rng(); rng();   // (its height and its door's place, thrown above)
    const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]].map(([p2, q2]) => [r.cx + -r.n.z * p2 * r.W / 2 + r.n.x * q2 * r.D / 2, r.cz + r.n.x * p2 * r.W / 2 + r.n.z * q2 * r.D / 2]);
    const lo = Math.min(...corners.map(([x, z]) => heightAt(x, z)), r.ya, r.yb);
    const hiLane = Math.max(r.ya, r.yb), top = r.top, tDoor = r.tDoor;
    if (!r.garden) {
      const [dx, dz] = [r.cx + -r.n.z * (tDoor - r.W / 2) + r.n.x * (r.D / 2 + 0.6), r.cz + r.n.x * (tDoor - r.W / 2) + r.n.z * (r.D / 2 + 0.6)];
      // (by the temple's gateway the doors are left plain: an awning there stood in its way)
      const dress = Math.hypot(dx - STAIR_X, dz - TEMPLE_GATE.z) > 7;
      // (its jars and pots clear of its bed)
      const lim = !r.bedT ? undefined : r.bedT[0] === 0 ? [r.bedT[1] + 0.2, r.W - 0.5] : [0.5, r.bedT[0] - 0.2];
      // (made two storeys at one end, TOWN_EDITS.upperRoom)
      // (it splits across its depth: split.z with its front to z)
      const up = TOWN_EDITS.upperRoom.find((e) => holds(e.at)(rectOf(r)));
      const split = up && {
        q: r.D / 2 - (up.split.z - r.cz) * r.n.z, high: r.n.z * (up.split.high.endsWith('1') ? 1 : -1) > 0 ? 'front' : 'back',
        // (the opening in the terrace's parapet at the stair's head, by the landing there, along its side: from..to
        // along z)
        open: (() => { const S = up.stair, d = Math.sign(S.top - S.foot), a = S.top + d * 0.85, b = S.top - d * 0.2; return { side: S.side, from: Math.min(a, b), to: Math.max(a, b) }; })(),
      };
      const fh = kit.frontHouse({ cx: r.cx, cz: r.cz, n: r.n, W: r.W, D: r.D, lo, top, kind: rng() < 0.25 ? 'redwash' : 'whitewash', tDoor, gy: sillAt(dx, dz), laneHi: hiLane, dress, lim, split });
      if (up) r.upper = { ...fh, e: up };
      r.inset = fh.inset; r.yard = fh.yard;   // (how far its front and back lean in at a height; its yard's depth)
      r.tops = { front: top + 0.45, back: top + 0.45 };   // (its parapet's top: frontHouse's shell)
      // (its stair: solid steps of whitewashed brick along its side from the square, up to the terrace's floor
      // through an opening in its parapet; a door from the terrace into the upper room; one may walk the terrace:
      // uppers)
      if (r.upper) {
        const S = up.stair, R0 = rectOf(r), out = S.side.endsWith('1') ? 1 : -1, face = R0[S.side], sx = face + out * (S.w / 2 - 0.08);
        const T = top, g = heightAt(face + out * S.w, S.foot), n = Math.max(1, Math.round((T - g) / 0.2)), rise = (T - g) / n, run = Math.abs(S.top - S.foot) / n, dir = Math.sign(S.top - S.foot);
        for (let k = 1; k <= n; k++) box('whitewash', sx, (g + k * rise + g - 0.4) / 2, S.foot + dir * (k - 0.5) * run, S.w + 0.16, k * rise + 0.4, run + 0.01);
        box('whitewash', sx, (T + g - 0.4) / 2, S.top + dir * 0.45, S.w + 0.16, T - (g - 0.4), 0.92);
        const lowZ = up.split.high.endsWith('1') ? [R0.z0, up.split.z] : [up.split.z, R0.z1];
        uppers.push({ x0: R0.x0, x1: R0.x1, z0: lowZ[0], z1: lowZ[1], y: top }, { x0: Math.min(face, sx) - S.w / 2 - 0.1, x1: Math.max(face, sx) + S.w / 2 + 0.1, z0: Math.min(S.foot, S.top) - 1.0, z1: Math.max(S.foot, S.top) + 1.0, y: T });
        const dz = up.split.z, sg = up.split.high.endsWith('1') ? -1 : 1, cxm = (R0.x0 + R0.x1) / 2;
        box('dark', cxm, top + 0.95, dz + sg * 0.012, 0.85, 1.9, 0.03);
        box('wood', cxm, top + 1.97, dz + sg * 0.07, 1.15, 0.14, 0.14);
        for (const s2 of [-1, 1]) box('wood', cxm + s2 * 0.5, top + 0.95, dz + sg * 0.05, 0.12, 1.9, 0.1);
      }
      frontN++;
    } else {
      r.tops = kit.garden({ cx: r.cx, cz: r.cz, n: r.n, W: r.W, D: r.D, lo, gy: Math.min(r.ya, r.yb) + 0.02, laneHi: hiLane, gate: tDoor });
    }
  }
  for (const t of TOWN_EDITS.roofTrees) {
    const f = !houses.some(holds(t.at)) && fronts.find((g) => g.tops && !g.garden && !g.upper && holds(t.at)(rectOf(g)));
    if (f) roofTree(t, f.tops.back - 0.45);
  }
  // (bands of cone mosaic along blank walls: TOWN_EDITS.mosaic. On a house the face of its mass there, to its
  // parapet's top; on a house along a lane or a walled garden its wall, to the wall's top)
  for (const e of TOWN_EDITS.mosaic) {
    const alongX = e.side[0] === 'z', sgn = e.side[1] === '1' ? 1 : -1, n = V(alongX ? 0 : sgn, 0, alongX ? sgn : 0);
    const h = houses.find(holds(e.at)), m = h?.masses?.find(holds(e.at)), g = fronts.find((f) => f.tops && holds(e.at)(rectOf(f)));
    // (a lane house with a yard before it: its walls only behind the yard)
    const r = m ?? (g && { ...rectOf(g) });
    if (!r) continue;
    if (g?.yard && !m) { const yd = g.yard; if (g.n.x > 0.5) r.x1 -= yd; else if (g.n.x < -0.5) r.x0 += yd; else if (g.n.z > 0.5) r.z1 -= yd; else r.z0 += yd; }
    const top = m ? m.top + h.ph : g.n.x * n.x + g.n.z * n.z < -0.5 ? g.tops.back : g.tops.front;
    const len = alongX ? r.x1 - r.x0 : r.z1 - r.z0, y = top - e.h;
    // (on a lane house's front or back, which lean in, set back with the wall and leaning with it)
    const lean = g?.inset && !m && Math.abs(g.n.x * n.x + g.n.z * n.z) > 0.5 ? g.inset : null, off = lean ? lean(y) : 0;
    const x = (alongX ? (r.x0 + r.x1) / 2 : r[e.side]) - n.x * off, z = (alongX ? r[e.side] : (r.z0 + r.z1) / 2) - n.z * off;
    kit.conePanel(x, y, z, n, V(n.z, 0, -n.x), len - 1.1, e.h, e.design, 0, lean ? lean(y + 1) - off : 0);
  }

  // ---- the leftover plots, too small for a house: the narrow ones a bed of herbs and leeks, kerbed with a low
  // whitewashed wall (a garden bed, the Sumerians' mú-sar), level in steps down the slope, a pomegranate or a fig in
  // a long one; the wider ones a reed-mat awning on four poles (05_reed_mat_awning), its ends lashed, a brace at each
  // corner, a reed screen hung down one side, a painted jar in its shade. On level ground no floor under it, the
  // poles in the ground; on a slope a level floor of trodden earth, flush with the ground at its upper side (the
  // lane's, where that runs along it), held up by a whitewashed wall, a low parapet where it drops to open ground ----
  for (const s of small) {
    seed(6, s.x0, s.z0);
    const lo = Math.min(heightAt(s.x0 - 1, s.z0 - 1), heightAt(s.x1 + 1, s.z1 + 1), heightAt(s.x0 - 1, s.z1 + 1), heightAt(s.x1 + 1, s.z0 - 1)) - 0.6;
    const hi = Math.max(heightAt(s.x0, s.z0), heightAt(s.x1, s.z1), heightAt(s.x0, s.z1), heightAt(s.x1, s.z0));
    const kind = rng() < 0.7 ? 'whitewash' : 'plaster';
    const mx = (s.x0 + s.x1) / 2, mz = (s.z0 + s.z1) / 2;
    const w = s.x1 - s.x0 - 0.08, d = s.z1 - s.z0 - 0.08;
    const faces = [[0, -1, w, d], [0, 1, w, d], [-1, 0, d, w], [1, 0, d, w]];
    faces.sort((a, b) => laneAt(mx + a[0] * w / 2, mz + a[1] * d / 2).d - laneAt(mx + b[0] * w / 2, mz + b[1] * d / 2).d);
    // (u along its front, the lane's side; v back from it)
    const [nx, nz, W, D] = faces[0], yaw = Math.atan2(nx, nz);
    const p = (u, v) => [mx + nz * u + nx * v, mz - nx * u + nz * v];
    // (an edited one: its mat higher, its floor open to the roof it backs onto: TOWN_EDITS.awning)
    const ed = TOWN_EDITS.awning.find((a) => holds(a.at)(s));
    const roof = ed ? hi + ed.rise : Math.min(hi + 2.3, capAt(s));
    if (Math.min(W, D) < 2.2 || roof < hi + 1.95) {
      // the bed: along its longer side in level lengths of two or three metres, each a hand over its own ground's
      // highest, the kerb stepping down with them
      const alongU = W >= D, L = alongU ? W : D, B = alongU ? D : W, t = 0.2;
      const P2 = (a, b) => (alongU ? p(a - W / 2, D / 2 - b) : p(W / 2 - b, a - D / 2));
      const n = Math.max(1, Math.round(L / 2.5)), seg = L / n, tops = [];
      for (let k = 0; k < n; k++) {
        let g = -Infinity;
        for (const a of [k * seg, (k + 0.5) * seg, (k + 1) * seg]) for (const b of [0, B / 2, B]) g = Math.max(g, heightAt(...P2(a, b)));
        tops.push(g + 0.3);
      }
      const kerb = (a, b, la, lb, y) => { const [x, z] = P2(a, b); wall(kind, x, (y + lo) / 2, z, alongU ? la : lb, y - lo, alongU ? lb : la, yaw); };
      for (let k = 0; k < n; k++) {
        // (the earth's ends inside the kerbs at the bed's ends: not in the plane of their faces)
        const y = tops[k], a0 = k * seg, a1 = (k + 1) * seg, e0 = a0 + (k ? 0 : t / 2), e1 = a1 - (k === n - 1 ? t / 2 : 0);
        const [ex, ez] = P2((e0 + e1) / 2, B / 2);
        box('earth', ex, (y + lo) / 2, ez, alongU ? e1 - e0 : B - 2 * t, y - lo, alongU ? B - 2 * t : e1 - e0, yaw);
        for (const b of [t / 2, B - t / 2]) kerb((a0 + a1) / 2, b, seg, t, y + 0.12);
        // (across: at its ends, and between two lengths the higher's)
        kerb(a0 + t / 2, B / 2, t, B, Math.max(y, k ? tops[k - 1] : -Infinity) + 0.12);
        if (k === n - 1) kerb(a1 - t / 2, B / 2, t, B, y + 0.12);
        // (in it: a tree in a long one, now and then; herbs and leeks in rows, a gap or two)
        let tree = null;
        if (L >= 3 && k === Math.floor(n / 2) && rng() < 0.6) {
          tree = (a0 + a1) / 2 + (rng() - 0.5) * seg * 0.4;
          const [tx, tz] = P2(tree, B / 2);
          decor.trees.push({ x: tx, z: tz, y, kind: rng() < 0.6 ? 'pomegranate' : 'fig' });
        }
        const rows = B - 2 * t > 0.8 ? 2 : 1;
        for (let a = a0 + t + 0.22; a < a1 - 0.2; a += 0.36 + rng() * 0.12) {
          if (tree !== null && Math.abs(a - tree) < 0.55) continue;
          for (let r = 0; r < rows; r++) {
            if (rng() < 0.15) continue;
            const [hx, hz] = P2(a + (rng() - 0.5) * 0.08, t + (B - 2 * t) * (rows === 1 ? 0.5 : 0.28 + r * 0.44) + (rng() - 0.5) * 0.08);
            decor.pots.push({ x: hx, y: y - 0.02, z: hz, s: 0.75 + rng() * 0.6 });
          }
        }
      }
      continue;
    }
    const low = Math.min(heightAt(s.x0, s.z0), heightAt(s.x1, s.z1), heightAt(s.x0, s.z1), heightAt(s.x1, s.z0));
    const floor = hi - low > 0.35 ? hi : null, ground = (x, z) => floor ?? heightAt(x, z);
    if (floor !== null) {
      // (its walls carried a little into a house beside it, so no slit of light shows between them)
      const ext = (fx, fz) => (solid(mx + fx * (w / 2 + 0.35), mz + fz * (d / 2 + 0.35)) ? 0.3 : 0);
      const [ex0, ex1, ez0, ez1] = [ext(-1, 0), ext(1, 0), ext(0, -1), ext(0, 1)];
      box(kind, mx + (ex1 - ex0) / 2, (floor - 0.03 + lo) / 2, mz + (ez1 - ez0) / 2, w + ex0 + ex1, floor - 0.03 - lo, d + ez0 + ez1);
      box('path', mx, floor - 0.015, mz, w, 0.03, d);
      for (const [fx, fz, len, along] of [[0, -1, w, true], [0, 1, w, true], [-1, 0, d, false], [1, 0, d, false]]) {
        const ex = mx + fx * (w / 2 + 0.6), ez = mz + fz * (d / 2 + 0.6);
        if (heightAt(ex, ez) > floor - 0.9 || [2, 5].includes(cellAt(ex, ez)) || openAt(ex, ez)) continue;
        if (ed && houses.some(holds([ex, ez]))) continue;   // (none where it opens onto the roof behind)
        wall(kind, mx + fx * (w / 2 - 0.14), floor + 0.25, mz + fz * (d / 2 - 0.14), along ? len : 0.28, 0.5, along ? 0.28 : len);
      }
    }
    // the awning: four poles a hand in from the corners, standing in the ground; the mat a little over them
    // (under the crossing of the mat's edge poles: reedMat lays them 0.13 and 0.12 in from its edges)
    const pu = W / 2 - 0.13, pv = D / 2 - 0.12, mat = roof - 0.12;
    for (const su of [-1, 1]) {
      for (const sv of [-1, 1]) {
        const [x, z] = p(su * pu, sv * pv), g = ground(x, z) - 0.1;
        get('wood').tube([V(x, g, z), V(x + (rng() - 0.5) * 0.03, mat, z + (rng() - 0.5) * 0.03)], [0.075, 0.062], 7);
        // (lashed at the top, a few turns of rope; a brace from the pole out to the beam along the front and back)
        get('straw').tube([V(x, mat - 0.16, z), V(x, mat - 0.04, z)], [0.088, 0.088], 7);
        const [bx, bz] = p(su * (pu - 0.42), sv * pv);
        get('wood').tube([V(x, mat - 0.5, z), V(bx, mat, bz)], [0.032, 0.03], 5);
      }
    }
    kit.reedMat(mx, roof, mz, W - 0.1, D - 0.1, yaw);
    // the screen: reeds hung side by side from the beam down one side, to a little above the ground, some shorter
    {
      const su = rng() < 0.5 ? -1 : 1, bottom = Math.max(ground(...p(su * pu, 0)) + 0.55, mat - 1.7);
      for (let v = -pv + 0.08; v < pv - 0.06; v += 0.05) {
        const [x, z] = p(su * (pu + 0.06), v), y1 = bottom + (rng() < 0.2 ? rng() * 0.25 : 0);
        get('straw').tube([V(x, mat, z), V(x + (rng() - 0.5) * 0.01, y1, z + (rng() - 0.5) * 0.01)], [0.013, 0.012], 3);
      }
      for (const y of [mat - 0.45, bottom + 0.3]) {
        const [ax, az] = p(su * (pu + 0.075), -pv + 0.05), [bx, bz] = p(su * (pu + 0.075), pv - 0.05);
        get('linen').tube([V(ax, y, az), V(bx, y, bz)], [0.008, 0.008], 3);
      }
    }
    // (the edited one: two steps up from its floor to the roof behind, through the opening in its parapet; one may
    // walk under it and on over that roof)
    if (ed) {
      const hh = houses.find(holds([mx, s.z1 + 1])), fl = floor ?? hi;
      if (hh?.roofY !== undefined) {
        const { x0: sx0, x1: sx1 } = ed.steps;
        box('firedbrick', (sx0 + sx1) / 2, (fl + (fl + hh.roofY) / 2) / 2, s.z1 - 0.35, sx1 - sx0, (hh.roofY - fl) / 2, 0.66);
        uppers.push({ x0: s.x0, x1: s.x1, z0: s.z0, z1: s.z1, y: fl }, { x0: hh.x0, x1: hh.x1, z0: hh.z0, z1: hh.z1, y: hh.roofY });
      }
    }
    // the jar, in a back corner on the ground (its foot level with the ground under its middle); under the edited
    // one in a front corner, the steps up to the roof along its back
    const [jx, jz] = p((rng() < 0.5 ? -1 : 1) * (pu - 0.45), ed ? pv - 0.45 : -pv + 0.45);
    kit.paintedJar(jx, ground(jx, jz) - 0.02, jz, 0.62 + rng() * 0.08, rng() * 6, Math.floor(rng() * 3));
  }

  // ---- where a lane is cut into the slope and no house wall lines it (a gap, a yard, the bank below the town),
  // a retaining wall of plastered mud brick holds the earth back ----
  for (const l of LANES) {
    if (l.stair) continue;   // (the stair has its parapet and the temple terrace's wall)
    for (let i = 0; i < l.pts.length - 1; i++) {
      const a = l.pts[i], b = l.pts[i + 1], len = Math.hypot(b.x - a.x, b.z - a.z), ux = (b.x - a.x) / len, uz = (b.z - a.z) / len;
      for (const side of [-1, 1]) {
        const nx = -uz * side, nz = ux * side;
        for (let t = 0.5; t < len; t += 1) {
          const y = a.y + ((b.y - a.y) * t) / len, ex = a.x + ux * t + nx * (l.w / 2 + 0.25), ez = a.z + uz * t + nz * (l.w / 2 + 0.25);
          const c = cellAt(ex + nx * 0.5, ez + nz * 0.5);
          if (c === 1 || c === 2 || c === 5 || openAt(ex, ez) || inSquareFill(ex + nx * 0.6, ez + nz * 0.6)) continue;   // (the square's strip: open to the lane)
          const g = Math.max(heightAt(ex + nx * 0.6, ez + nz * 0.6), heightAt(ex + nx * 1.4, ez + nz * 1.4));
          if (g < y + 0.45) continue;
          const top = g + 0.35, bot = y - 0.4;
          // (square to the plan, as the lane's runs are: along a drifting run each block set a little aside)
          const yaw = Math.round(Math.atan2(ux, uz) / (Math.PI / 2)) * (Math.PI / 2);
          box('plaster', ex + nx * 0.2, (top + bot) / 2, ez + nz * 0.2, 0.5, top - bot, 1.04, yaw);
        }
      }
    }
  }

  // ---- the steps (their flights laid out above): a stepped ramp (low risers of fired brick, long treads of trodden
  // earth) or, steeper, a stair of fired brick. Never quite regular: each step a centimetre higher or lower than its
  // line, turned a hair, its nosing rounded by wear; the ramps' nosings a course of separate bricks, a few sunk or
  // proud; dust and sand drifted into the corners against the walls. Beside them the beds, kerbed with a brick,
  // herbs and leeks in them, a pomegranate in a wide one; pots on a tread against a house set well back ----
  seed(7);
  const stairs = [];
  const worn = (kind, x, y, z, sx, sy, sz, yaw, r) => {
    const g = new RoundedBoxGeometry(sx, sy, sz, 2, Math.min(r, sy / 2.2, sz / 2.2)).deleteAttribute('uv');
    get(kind).add(g, new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(1, 1, 1)));
    g.dispose();
  };
  // (none out over the little square, filled level beside the steps: it hung over its floor; its die thrown all the
  // same)
  const drift = (x, y, z, yaw, s) => {
    const sx = s * (0.6 + rng() * 0.8);
    if (inCourtSquare(x, z, 0.8)) return;
    get('earth').add(DUNE, new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(sx, s * 0.12, s * 0.35)));
  };
  // (at the heads of moved runs: the next run's first steps, square to them, reach no further out over them than
  // the lane's own edge, and its first two, there, are left out: a level platform over them, at the turn's height)
  for (const F of flights) {
    if (!F.l.shift?.[F.i]) continue;
    const zs = [F.a.z, F.b.z, F.axis + F.l.w / 2 + Math.max(...F.e[1]), F.axis - F.l.w / 2 - Math.max(...F.e[-1])], fz0 = Math.min(...zs), fz1 = Math.max(...zs);
    for (const G of flights) {
      if (G === F || G.l !== F.l || G.alongX === F.alongX) continue;
      const out = Math.sign(F.b.x - G.axis);
      for (let k = 0; k < G.n; k++) {
        const q0 = G.A + G.dir * k * G.run, q1 = q0 + G.dir * G.run;
        if (Math.max(q0, q1) > fz0 && Math.min(q0, q1) < fz1) G.e[out][k] = Math.min(G.e[out][k], 0);
        if (k >= G.k0 && k < G.k0 + 2 && Math.max(q0, q1) > fz0 && Math.min(q0, q1) < fz1) {
          (G.skip ??= new Set()).add(k);
          const eN = G.e[-1][k], eP = G.e[1][k], W = G.l.w + eN + eP, [x, z] = G.xz((q0 + q1) / 2, (eP - eN) / 2);
          box('path', x, F.b.y - 0.3, z, W, 0.6, G.run + 0.02, G.yaw);
        }
      }
    }
  }
  // (at the stair's foot the curved lane's last steps ran on under the stair's lowest, the two crossing: both left
  // out there, the ground between level with the way)
  for (const d of TOWN_EDITS.dropTreads) {
    const F = flights.find((G) => G.l === LANES[d.lane] && G.i === d.seg);
    if (F) for (const k of d.k) (F.ghost ??= new Set()).add(F.k0 + k);
  }
  const footZ = [Infinity, -Infinity];   // (the stair's treads left out there: its foot's paving carried over them)
  {
    const L0 = LANES[0], end = L0.pts.at(-1), xs = STAIR_X - LANES[1].w / 2 - 0.3;
    for (const F of flights) {
      const last = F.l === L0 && F.i === L0.pts.length - 2;
      if (!last && !F.l.stair) continue;
      for (let k = F.k0; k < F.n; k++) {
        const q0 = F.A + F.dir * k * F.run, q1 = q0 + F.dir * F.run;
        if (last ? Math.max(q0, q1) > xs : Math.max(q0, q1) > end.z - L0.w / 2 && Math.min(q0, q1) < end.z + L0.w / 2) {
          (F.ghost ??= new Set()).add(k);
          if (!last) { footZ[0] = Math.min(footZ[0], q0, q1); footZ[1] = Math.max(footZ[1], q0, q1); }
        }
      }
    }
  }
  for (const F of flights) {
    const { l, a, b, n, rise, run, steep, dir, A, xz, yaw } = F;
    // (a run whose steps were moved across it: one may walk all its moved width: uppers)
    if (l.shift?.[F.i]) {
      const k = n - 1, eN = F.e[-1][k], eP = F.e[1][k], W = l.w + eN + eP, c = (eP - eN) / 2;
      const [x0, z0] = xz(A + dir * F.k0 * run, c - W / 2), [x1, z1] = xz(A + dir * n * run, c + W / 2);
      uppers.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), y: b.y });
    }
    for (let k = F.k0; k < n; k++) {
      if (F.skip?.has(k)) continue;
      // (a tread left out where two flights crossed (F.ghost, above): its dice thrown all the same, so the steps after
      // it keep their own)
      const ghost = F.ghost?.has(k), worn_ = ghost ? () => {} : worn, box_ = ghost ? () => {} : box, drift_ = ghost ? () => rng() : drift, pot_ = ghost ? () => {} : pot;
      // (its reach either side of the lane; its middle across, and along)
      const eN = F.e[-1][k], eP = F.e[1][k], W = l.w + eN + eP, c = (eP - eN) / 2, q0 = A + dir * k * run;
      const [x, z] = xz(q0 + dir * run / 2, c);
      const top = a.y + (k + 1) * rise + (k < n - 1 ? (rng() - 0.5) * 0.025 : 0), bot = a.y + k * rise - 0.5, yw = yaw + (rng() - 0.5) * 0.02;
      if (steep) worn_('firedbrick', x, (top + bot) / 2, z, W, top - bot, run + 0.03, yw, 0.045);
      else {
        box_('path', x, (top + bot) / 2 - 0.01, z, W, top - bot - 0.02, run + 0.02, yaw);
        // (the riser's edge: a course of fired bricks at the tread's front, laid end on)
        const d = 0.17 * (run > 0.5 ? 1 : 0.6), nb = Math.round(W / 0.36);
        for (let j = 0; j < nb; j++) {
          if (rng() < 0.02) continue;   // (one gone)
          const [fx, fz] = xz(q0 + dir * 0.08 * run, c + (j + 0.5) * (W / nb) - W / 2), dy = (rng() - 0.5) * 0.016;
          worn_('firedbrick', fx, top - 0.1 + dy, fz, W / nb - 0.012, 0.2, d, yaw + (rng() - 0.5) * 0.03, 0.015);
        }
      }
      // the drifts: at the back of a tread, against the side walls (where no foot goes)
      for (const s of [-1, 1]) {
        if (rng() < 0.7) continue;
        // (on the stair inside its parapet: the treads run on under it, and one set at their ends, lying across the
        // stair, showed through its outer face)
        const [px, pz] = xz(q0 + dir * 0.88 * run, c + s * (l.stair ? l.w / 2 - 0.45 : W / 2 - 0.1));
        drift_(px, top - 0.03, pz, yaw + (rng() - 0.5) * 0.6, 0.25 + rng() * 0.3);
      }
      for (const out of [-1, 1]) {
        const e = F.e[out][k], f = F.face[out][k] ?? (e > 0.7 ? e + 0.12 : null);
        if (f === null || f - e >= 0.3 || f < 0.75 || rng() > 0.15) continue;
        const [px, pz] = xz(q0 + dir * (0.3 + rng() * 0.4) * run, out * (l.w / 2 + f - 0.26));
        if (doors.some((d) => Math.hypot(d.x - px, d.z - pz) < 1.3)) continue;
        pot_(px, top - 0.01, pz, 0.8 + rng() * 0.4);
      }
    }
    stairs.push({ a, b, n, steep });
  }
  // (the stair's landings paved with its bricks: bare, between its brick flights, the earth there looked a pit)
  {
    const S = LANES[1];
    for (let i = 0; i < S.pts.length - 1; i++) {
      const a = S.pts[i], b = S.pts[i + 1];
      if (Math.abs(b.y - a.y) > 0.01 || Math.abs(b.z - a.z) < 0.3) continue;
      let z0 = Math.min(a.z, b.z), z1 = Math.max(a.z, b.z);
      if (footZ[1] >= z0 - 0.01 && footZ[0] <= z1 + 0.01) { z0 = Math.min(z0, footZ[0]); z1 = Math.max(z1, footZ[1]); }
      worn('firedbrick', STAIR_X, a.y - 0.23, (z0 + z1) / 2, S.w + 0.5, 0.5, z1 - z0 + 0.03, 0, 0.045);
    }
  }
  for (const { F, k, out, top } of beds) {
    const { l, run, xz, yaw } = F, e = F.e[out][k], wB = F.face[out][k] - e, bot = F.a.y + k * F.rise - 0.5, qm = F.A + F.dir * (k + 0.5) * run;
    // (none beside a tread left out: its dice thrown all the same)
    if (F.ghost?.has(k)) { rng(); rng(); rng(); if (wB > 0.75) rng(); continue; }
    // (its earth from inside the kerb: their faces to the lane in one plane flickered)
    const [bx, bz] = xz(qm, out * (l.w / 2 + e + 0.08 + (wB - 0.08) / 2)), [kx, kz] = xz(qm, out * (l.w / 2 + e + 0.06));
    box('earth', bx, (top + bot) / 2, bz, wB - 0.08, top - bot, run + 0.01, yaw);
    box('firedbrick', kx, (top + 0.05 + bot) / 2, kz, 0.12, top + 0.05 - bot, run + 0.02, yaw);
    const [px, pz] = xz(qm + (rng() - 0.5) * run * 0.5, out * (l.w / 2 + e + 0.17 + rng() * Math.max(0, wB - 0.35)));
    decor.pots.push({ x: px, y: top, z: pz, s: 0.8 + rng() * 0.6 });
    if (wB > 0.75 && rng() < 0.3) { const [sx, sz] = xz(qm, out * (l.w / 2 + e + wB / 2)); decor.shrubs.push({ x: sx, z: sz, y: top }); }
  }

  seed(8);
  // ---- the square on the top: the lookout, a platform of mud brick some 5.6 m high, battered, a parapet with
  // stepped merlons round it, a stair up along its south face climbing east (so the view opens as one climbs) ----
  const L = LOOKOUT, top = PLAZA.y + L.h;
  {
    const lean = 0.3, base = PLAZA.y - 0.6, H = L.h + 0.6;
    const x0 = L.x - L.half + lean, x1 = L.x + L.half - lean, z0 = L.z - L.half + lean, z1 = L.z + L.half - lean;
    // its walls and the parapet round its top in one piece, the parapet's merlons stepped three times (as on the
    // walls in the seals' and the reliefs' pictures); open at the stair's head, along the south face to the
    // south-east corner (left sharp: the wall of the stair's landing runs on from it)
    const t = 0.38, ph = 0.72, e = (lean * ph) / H;
    shell('brick', L.x, L.z, 0, 2 * L.half, 2 * L.half, base, top, ph, { p: t, lean, sharp: ['x1z1'], gaps: [{ side: 'z1', a: x1 - 1.9 - L.x, b: 99 }] });
    // (the merlons along a stretch of the parapet's top, its middle: leaning in with the walls, e at the top)
    const run = (ax, az, bx, bz) => {
      const len = Math.hypot(bx - ax, bz - az), yaw = Math.atan2(bx - ax, bz - az);
      for (let s = 0.5; s < len - 0.3; s += 1.05) {
        const mx = ax + ((bx - ax) * s) / len, mz = az + ((bz - az) * s) / len;
        let y = top + ph;
        for (const [w, hh] of [[0.62, 0.2], [0.42, 0.17], [0.22, 0.15]]) { box('brick', mx, y + hh / 2, mz, t, hh, w, yaw); y += hh; }
      }
    };
    const m = e + t / 2;
    box('trim', L.x, top + 0.02, L.z, x1 - x0 - 0.2, 0.06, z1 - z0 - 0.2);   // (its floor, a lime screed: its edge in the parapet, clear of its outer face)
    // the stair: from the square at the south-west corner up east along the south face, to the landing in the
    // parapet's opening (the steps end where it begins: the landing on them was a metre's wall)
    const n = Math.ceil(L.h / 0.2), rise = L.h / n, sx0 = L.x - L.half - 0.4, sx1 = x1 - 1.9, sz = L.z + L.half + 0.55;
    const step = (sx1 - sx0) / n;
    for (let k = 0; k < n; k++) {
      const y1 = PLAZA.y + (k + 1) * rise;
      box('firedbrick', sx0 + step * (k + 0.5), (y1 + PLAZA.y - 0.5) / 2, sz, step + 0.02, y1 - PLAZA.y + 0.5, 1.5);
    }
    // its head: a landing reaching onto the platform, solid down to the square as the steps are
    box('firedbrick', x1 - 0.96, (top + PLAZA.y - 0.5) / 2, sz - 0.525, 1.88, top - PLAZA.y + 0.5, 2.55);
    // the stair's outer side: a wall up along it, round the landing and on into the platform's parapet, as thick
    // and as high; merlons along it at the top
    const zo = sz + 0.74 + t;
    rail('brick', [[sx0, zo, PLAZA.y + 0.75, PLAZA.y - 0.5], [sx1, zo, top + ph, PLAZA.y - 0.5], [x1, zo, top + ph, PLAZA.y - 0.5], [x1, z1 - 0.05, top + ph]],
      { p: t, y0: top, slope: lean / H, out: V(0, 0, 1) });
    run(x0 + m, z0 + m, x1 - m, z0 + m);
    run(x1 - m, z0 + m, x1 - m, zo - m);
    run(x1 - m, zo - m, sx1, zo - m);
    run(x0 + m, z1 - m, x1 - 1.9, z1 - m);
    run(x0 + m, z1 - m, x0 + m, z0 + m);
    // on the top: a reed shade over most of it (twice as wide, three times as deep as the first one, 5.4 by 7.5),
    // clear of the stair's head in the south-east corner; on poles at its corners and halfway; mats, two jars
    const SW = 5.4, SD = 7.5, shx = x0 + 0.35 + SW / 2, shz = z0 + 0.35 + SD / 2;
    for (const ox of [-SW / 2 + 0.1, 0, SW / 2 - 0.1]) {
      for (const oz of [-SD / 2 + 0.1, -SD / 6, SD / 6, SD / 2 - 0.1]) {
        if (ox === 0 && Math.abs(oz) < SD / 3) continue;   // (none in the middle: the space under it open)
        get('wood').tube([V(shx + ox, top, shz + oz), V(shx + ox, top + 2.3, shz + oz)], [0.07, 0.055], 6);
      }
    }
    for (const ox of [-SW / 2 + 0.1, SW / 2 - 0.1]) get('wood').tube([V(shx + ox, top + 2.26, shz - SD / 2), V(shx + ox, top + 2.26, shz + SD / 2)], [0.06, 0.06], 6);
    kit.reedMat(shx, top + 2.4, shz, SW + 0.3, SD + 0.3);
    box('madder', shx - 0.8, top + 0.07, shz - 1.6, 1.6, 0.02, 1.1);
    box('straw', shx + 0.9, top + 0.06, shz + 0.9, 1.4, 0.02, 1.0, 0.3);
    paintedJar(x0 + 0.75, top, z1 - 1.7, 0.9, 1, 2);
    pot(x0 + 1.6, top, z1 - 1.5, 1.1);
  }
  // the square: a well, a bench along a wall, jars (clear of the outside stairs)
  const clearOfStairs = (x, z, m) => uppers.every((u) => x < u.x0 - m || x > u.x1 + m || z < u.z0 - m || z > u.z1 + m);
  {
    const [wx, wz] = [[PLAZA.x0 + 4.2, PLAZA.z0 + 3.4], [PLAZA.x0 + 4, PLAZA.z0 + 5.2], [PLAZA.x1 - 4, PLAZA.z0 + 3.4]].find(([x, z]) => clearOfStairs(x, z, 2.6)) ?? [PLAZA.x0 + 4, PLAZA.z0 + 5.2];
    const gy = PLAZA.y;
    // (its curb a ring of fired brick with a thickness: its outside, its inside (turned to face in, so the far side
    // shows over the near), a lip on top; the water dark, down in it)
    const outer = new THREE.CylinderGeometry(0.95, 1.0, 0.8, 22, 1, true).deleteAttribute('uv');
    const inner = new THREE.CylinderGeometry(0.72, 0.72, 0.9, 22, 1, true).deleteAttribute('uv');
    const lip = new THREE.RingGeometry(0.72, 0.95, 22).rotateX(-Math.PI / 2).deleteAttribute('uv');
    get('firedbrick').add(outer, new THREE.Matrix4().makeTranslation(wx, gy + 0.4, wz), { flat: true });
    {
      const g = inner.toNonIndexed(), pa = g.attributes.position;
      for (let i = 0; i < pa.count; i += 3) {
        const x = pa.getX(i + 1), y = pa.getY(i + 1), z = pa.getZ(i + 1);
        pa.setXYZ(i + 1, pa.getX(i + 2), pa.getY(i + 2), pa.getZ(i + 2));
        pa.setXYZ(i + 2, x, y, z);
      }
      get('firedbrick').add(g, new THREE.Matrix4().makeTranslation(wx, gy + 0.35, wz), { flat: true });
    }
    get('firedbrick').add(lip, new THREE.Matrix4().makeTranslation(wx, gy + 0.8, wz), { flat: true });
    get('dark').add(new THREE.CircleGeometry(0.72, 22).rotateX(-Math.PI / 2).deleteAttribute('uv'), new THREE.Matrix4().makeTranslation(wx, gy - 0.05, wz));
    paintedJar(wx + 1.7, gy - 0.03, wz + 0.9, 1.1, 0.3, 0);
    paintedJar(wx + 2.6, gy - 0.03, wz - 0.3, 0.95, 2.4, 1);
    pot(wx - 1.5, gy - 0.02, wz + 1.0, 1.0);
  }

  // ---- the stair's sides: on its river side, over the houses let down below it, a parapet (the retaining wall of
  // the shelf it runs along, carried up to waist height); on its hill side the temple terrace's wall ----
  {
    const xr = STAIR_X - LANES[1].w / 2 - 0.22, xh = STAIR_X + LANES[1].w / 2 + 0.3;
    for (let z = 4.5; z < 36; z += 0.5) {
      const y = stairY(z + 0.25), g = Math.min(heightAt(xr - 0.8, z + 0.25), heightAt(xr - 2, z + 0.25));
      if (planOpen(xr - 0.6, z + 0.25) || planOpen(xr - 1.5, z + 0.25)) continue;   // (where the curved lane comes in; along the square it stands)
      if (z + 0.25 > 33.3) continue;   // (at its foot, beside the teacher's house: its wall there, the parapet a stub against it)
      // (over a roof one steps down onto from the stair (TOWN_EDITS.stairGap): the wall only to the stair's level)
      if (TOWN_EDITS.stairGap.some((sg) => z + 0.25 > sg.z0 && z + 0.25 < sg.z1)) { box('whitewash', xr, (y + 0.03 + g - 0.5) / 2, z + 0.25, 0.36, y + 0.03 - g + 0.5, 0.52); continue; }   // (its top a little over the ground there: level with it, they flickered)
      if (cellAt(xr - 0.6, z + 0.25) !== 2 || inCarve(xr - 1, z + 0.25)) box('whitewash', xr, (y + 0.9 + g - 0.5) / 2, z + 0.25, 0.36, y + 0.9 - g + 0.5, 0.52);
    }
    // (and from there steps down onto the roof, through the opening in its parapet, whitewashed as the house is; the
    // low wall at the stair's level carried on north beside them, past where the stair's parapet begins)
    for (const sg of TOWN_EDITS.stairGap) {
      const hh = houses.find(holds(sg.roof));
      if (hh?.roofY === undefined) continue;
      const y = stairY((sg.z0 + sg.z1) / 2), n = Math.max(1, Math.round((y - hh.roofY) / 0.19)), rise = (y - hh.roofY) / n, x0 = xr - 0.18;
      for (let z = sg.z0; z < 4.5 - 0.01; z += 0.5) {
        const z1 = Math.min(z + 0.5, 4.5), yy = stairY((z + z1) / 2), g = Math.min(heightAt(xr - 0.8, (z + z1) / 2), heightAt(xr - 2, (z + z1) / 2));
        box('whitewash', xr, (yy + 0.03 + g - 0.5) / 2, (z + z1) / 2, 0.36, yy + 0.03 - g + 0.5, z1 - z + 0.02);
      }
      // (the lowest left out: one steps down off the last onto the roof)
      for (let k = 1; k < n - 1; k++) box('whitewash', x0 - (k - 0.5) * 0.3, (y - k * rise + hh.roofY) / 2, (sg.z0 + sg.z1) / 2, 0.31, y - k * rise - hh.roofY, sg.z1 - sg.z0 - 0.3);
      uppers.push({ x0: hh.x0, x1: hh.x1, z0: hh.z0, z1: hh.z1, y: hh.roofY });
      // (the arbour: four palm-trunk posts, beams across, a reed mat laid over them; under it a mat on the roof, a
      // painted jar and a cup by it, in the shade)
      if (sg.arbour) {
        const [ax0, ax1, az0, az1] = sg.arbour, R = hh.roofY, H = R + 2.3;
        for (const x of [ax0 + 0.12, ax1 - 0.12]) for (const z of [az0 + 0.12, az1 - 0.12]) get('wood').tube([V(x, R, z), V(x, H, z)], [0.075, 0.065], 7);
        for (const z of [az0 + 0.12, az1 - 0.12]) get('wood').tube([V(ax0 - 0.1, H, z), V(ax1 + 0.1, H, z)], [0.055, 0.055], 6);
        for (let x = ax0 + 0.3; x < ax1 - 0.1; x += 0.55) get('wood').tube([V(x, H + 0.07, az0 - 0.05), V(x, H + 0.07, az1 + 0.05)], [0.035, 0.035], 5);
        kit.reedMat((ax0 + ax1) / 2, H + 0.13, (az0 + az1) / 2, ax1 - ax0 + 0.3, az1 - az0 + 0.3);
        kit.reedMat((ax0 + ax1) / 2, R + 0.02, (az0 + az1) / 2 + 0.2, 1.8, 1.3);
        kit.paintedJar(ax1 - 0.45, R, az0 + 0.45, 0.7, 0.5, 1);
        get('clay').add(new THREE.CylinderGeometry(0.045, 0.035, 0.09, 10).deleteAttribute('uv'), new THREE.Matrix4().makeTranslation((ax0 + ax1) / 2 + 0.4, R + 0.08, (az0 + az1) / 2));
      }
    }
    // (on its hill side, between the houses of the top and the terrace's north wall, where the ground drops three
    // metres from their level to the stair's: a retaining wall of brick, its face at the stair's edge, thick enough
    // to hold within it the slope the ground's mesh drew across the drop)
    // (on to the terrace's north wall: where the ground falls to the terrace, the mesh's slope down to it too)
    // (its face on the ground mesh's row of points at x 12, its end at the next row south, z 18: past them the mesh
    // drew a lip of earth at its foot and a spike of it past its end)
    for (let z = 14.0, g = 0; z < 17.95; z += 0.5) {
      const y = stairY(z + 0.25), z1 = Math.min(z + 0.5, 18.0);
      g = Math.max(g, heightAt(13.2, z + 0.25), heightAt(13.8, z + 0.25));
      if (g < y + 1) continue;
      box('brick', 12.525, (g + 0.3 + y - 0.5) / 2, (z + z1) / 2, 1.05, g + 0.3 - (y - 0.5), z1 - z + 0.02);
    }
    // the temple terrace: its retaining wall along the stair (and its other sides), a low enclosure wall on top
    // (along the stair its top is waist high over the stair or the terrace, whichever is higher)
    const P = PRECINCT, topAt = (z, byStair) => (byStair ? Math.max(P.y + 1.0, stairY(z) + 0.9) : P.y + 1.8);
    const seg = (x0, z0, x1, z1, buttress = true) => {
      const len = Math.hypot(x1 - x0, z1 - z0), yaw = Math.atan2(x1 - x0, z1 - z0);
      for (let s2 = 0; s2 < len; s2 += 2) {
        const l = Math.min(2, len - s2), mx = x0 + ((x1 - x0) * (s2 + l / 2)) / len, mz = z0 + ((z1 - z0) * (s2 + l / 2)) / len;
        const top = topAt(mz, !buttress);
        const lo = Math.min(heightAt(mx - Math.cos(yaw) * 1.5, mz + Math.sin(yaw) * 1.5), heightAt(mx + Math.cos(yaw) * 1.5, mz - Math.sin(yaw) * 1.5)) - 0.5;
        box('brick', mx, (top + lo) / 2, mz, 1.2, top - lo, l + 0.05, yaw);
      }
      // (buttresses on its outer face, every six metres)
      for (let s2 = 3; buttress && s2 < len - 1; s2 += 6) {
        const mx = x0 + ((x1 - x0) * s2) / len, mz = z0 + ((z1 - z0) * s2) / len, ox = -Math.cos(yaw) * 0.85, oz = Math.sin(yaw) * 0.85;
        const lo = heightAt(mx + ox * 2, mz + oz * 2) - 0.5, top = topAt(mz, false);
        box('brick', mx + ox, (top - 0.3 + lo) / 2, mz + oz, 0.6, top - 0.3 - lo, 1.3, yaw);
      }
    };
    // (its north side, under the houses of the top: a retaining wall up to their level)
    for (let x = xh + 0.6; x < 70; x += 2) {
      const lo = P.y - 0.5, hi = Math.max(heightAt(x + 1, P.z0 - 1.2), P.y + 1.8) + 0.3;
      box('brick', x + 1, (lo + hi) / 2, P.z0 + 0.1, 2.05, hi - lo, 1.0);
    }
    // (along the stair and the way to the temple: plain, so nothing stands out into them; the gateway in it)
    const G = TEMPLE_GATE;
    // (where the stair runs above the terrace, a parapet; from where it comes down to it, to the gateway, no wall but
    // broad steps up onto the terrace, so the ziggurat shows whole from the way: their treads at fixed levels under
    // the terrace's, each slice of them only those above the way beside it)
    const TS = TEMPLE_STEPS;
    seg(xh + 0.6, P.z0 + 0.6, xh + 0.6, TS.z0, false);
    // (the top tread a little proud of the terrace's ground and carried a metre onto it, over the ground's rise
    // from under the steps: hillPlan.js townGround)
    const top = P.y + 0.1, rise = (top - stairY(36)) / TS.n;
    for (let z = TS.z0; z < TS.z1 - 0.01; z += 0.5) {
      const l = Math.min(0.5, TS.z1 - z), mz = z + l / 2;
      const L = Math.max(laneAt(STAIR_X, z).y, laneAt(STAIR_X, z + l).y), lo = L - 0.6;
      let first = true;
      for (let i = 1; i <= TS.n; i++) {
        const y = top - (TS.n - i) * rise;
        if (y < L + 0.06) continue;
        const x0 = first ? TS.x0 : TS.x0 + (i - 1) * TS.tread, x1 = TS.x1 + (i === TS.n ? 1.0 : 0);
        box('brick', (x0 + x1) / 2, (y + lo) / 2, mz, x1 - x0, y - lo, l);
        first = false;
      }
    }
    seg(xh + 0.6, G.z + G.half, xh + 0.6, P.z1 - 0.6, false);
    // (on south past the precinct, round the outer court: retaining walls, buttressed)
    seg(xh + 0.6, P.z1 - 0.6, xh + 0.6, OUTER.z1 - 0.6);
    // the gateway: two towers of brick, their tops stepped like the lookout's merlons, a palm-log lintel between,
    // cone mosaic on their outer faces (as on the temple walls of Uruk), a threshold of stone
    for (const s of [-1, 1]) {
      const tz = G.z + s * (G.half + 0.9), lo = heightAt(G.x - 2.5, tz) - 0.6, hi = P.y + 4.6;
      const tx = G.x + 0.3;   // (set back a little, clear of the way along the wall)
      box('brick', tx, (lo + hi) / 2, tz, 2.1, hi - lo, 1.8);
      let y = hi;
      for (const [w2, hh] of [[2.1, 0.3], [1.5, 0.28], [0.9, 0.26]]) { box('brick', tx, y + hh / 2, tz, w2, hh, 1.8 - (2.1 - w2) * 0.6); y += hh; }
      conePanel(tx - 1.05, P.y + 2.0, tz, V(-1, 0, 0), V(0, 0, 1), 1.2, 3.0, s > 0 ? 0 : 1);
    }
    const lg = new THREE.CylinderGeometry(0.19, 0.19, 2 * G.half + 1.6, 9).rotateX(Math.PI / 2).deleteAttribute('uv');
    for (const o of [-0.5, 0, 0.5]) get('wood').add(lg, new THREE.Matrix4().makeTranslation(G.x + o, P.y + 3.6, G.z));
    box('brick', G.x, P.y + 4.05, G.z, 2.0, 0.55, 2 * G.half + 0.4);
    box('stone', G.x, P.y + 0.04, G.z, 1.5, 0.12, 2 * G.half);
    seg(P.x1 - 0.6, OUTER.z1 - 0.6, P.x1 - 0.6, P.z0 + 0.6);
    seg(xh + 0.6, OUTER.z1 - 0.6, P.x1 - 0.6, OUTER.z1 - 0.6);
    // (no wall between the precinct and its outer court: one ground, the white temple and the priestess's house
    // seen together)
  }

  // the teacher's house and its square (courtHouse.js)
  seed(10);
  const court = carve ? buildCourtHouse(kit, { heightAt, sillAt, rng }) : { inHouse: () => false };
  // the temple's weavers' house, on its terrace by the stair (workshop.js)
  // (built where it first stood, then moved west and turned so its gate faces the river: every vertex it added,
  // its normals and its cloth's flaps, carried over by hillPlan.js workshopAt)
  seed(11);
  {
    const before = Object.fromEntries(Object.entries(kit.B).map(([k, b]) => [k, b.count]));
    buildWorkshop(kit, { rng });
    for (const [k, b] of Object.entries(kit.B)) {
      for (let i = before[k] ?? 0; i < b.count; i++) {
        const [x, z] = workshopAt(b.p[i * 3], b.p[i * 3 + 2]), nx = b.n[i * 3];
        b.p[i * 3] = x; b.p[i * 3 + 2] = z;
        b.n[i * 3] = -b.n[i * 3 + 2]; b.n[i * 3 + 2] = nx;
        if (b.f) { const fx = b.f[i * 4]; b.f[i * 4] = -b.f[i * 4 + 2]; b.f[i * 4 + 2] = fx; }
      }
    }
  }
  // the temple of Enki and the Abzu before it, south of the ziggurat's great stair (temple.js)
  seed(12);
  buildTemple(kit, { rng, scene });
  // its storehouse and kitchen, north of the great stair (temple.js)
  seed(13);
  buildTempleYard(kit, { rng });
  // its outer court: the priestess's house, the potters, the folds (outerCourt.js)
  seed(15);
  buildOuterCourt(kit, { rng });

  const walkables = kit.meshes(scene);
  // (a house's terrace one has climbed to)
  const upperAt = (x, z) => uppers.some((u) => x > u.x0 - 0.3 && x < u.x1 + 0.3 && z > u.z0 - 0.3 && z < u.z1 + 0.3);
  return {
    walkables, courts, doors, windows: kit.windows, decor, yards: kit.yards, extraTrees: [...extraTrees, ...(court.trees ?? []), ...groundTrees], houses: houses.length + fronts.length, heroes: heroN + frontN, uppers: upperN, raised: raised.size, stairs,
    isOpen: openAt, cellAt, top, upperAt, clearOfStairs, sillAt,
    inHouse: (x, z) => court.inHouse(x, z) || small.some((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1),
    plan: { fronts, houses, small, flights, beds },
  };
}
