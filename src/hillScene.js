// The hill town scene (山城): everything put together, and what the walk needs from it. Its
// viewpoints: the quay (the start), the street's long bend on the south flank, the belvedere looking west to the
// river, and the lookout on the top looking east over the plain to the Euphrates' east branch and its temple town.

import * as THREE from 'three';
import { Builder } from './geo.js';
import { makeRng, fbm, shuffle } from './rand.js';
import { lightMat, addBoatHull } from './shade.js';
import { polyDist, polySigned } from './land.js';
import { loadPieces } from './city.js';
import { buildHillLand, heightAt, waterDepth, ISLANDS, eastEdge, westEdge, BAY, QUAY } from './hillLand.js';
import { LANES, PLAZA, LOOKOUT, PRECINCT, ZIGGURAT as ZIG_AT, STAIR_X, stairY, inMound, inMoundWas, inPrecinct, inOuter, EAST_BRANCH, CANAL, inViewEast, TEMPLE_GATE, inWorkshop, ABZU, inAbzu, inTempleHouse, inTempleYard, workshopAt } from './hillPlan.js';
import { buildHillTown } from './hillTown.js';
import { buildRiverside, FIELD, BOATS, STAGE } from './riverside.js';
import { buildFestivalBoat } from './festivalBoat.js';
import { buildUrukRuins, inRuinsGround, inDoorView } from './urukRuins.js';
import { inMarket } from './market.js';
import { loadSheep } from './sheep.js';
import { buildFarLand } from './farLand.js';
import { loadStatues } from './temple.js';
import { GIPARU_DZ, COURT_DZ } from './outerCourt.js';
import { loadLoom } from './workshop.js';
import { newPlants, plantMeshes, useGround, datePalm, tamarisk, pomegranate, fig, poplar, Spacing } from './flora.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TAU = Math.PI * 2;
const mat = (x, y, z, rx, ry, rz, sx, sy = sx, sz = sx) => new THREE.Matrix4().compose(V(x, y, z),
  new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), V(sx, sy, sz));
const E = EAST_BRANCH;

// the viewpoints (yaw 0 looks north, π/2 west, -π/2 east)
export const HILL_VIEWS = {
  quay: { x: -34.4, z: 10, yaw: Math.PI / 2 + 0.1 },
  // (on the way up, at the foot of its second run, looking up it; on the stair's middle landing, looking along it;
  // in the courtyard)
  lane: { x: -23.2, z: 16.1, yaw: -Math.PI / 2 - 0.08 },
  stair: { x: STAIR_X, z: 20.5, yaw: 0.35 },
  courtyard: { x: PLAZA.x0 + 3, z: PLAZA.z1 - 3, yaw: -0.9 },
  lookout: { x: LOOKOUT.x + 1, z: LOOKOUT.z, yaw: -Math.PI / 2 - 0.15 },
  // (in the temple's gateway, looking up the ziggurat's great stair)
  temple: { x: TEMPLE_GATE.x + 1.5, z: TEMPLE_GATE.z, yaw: -Math.PI / 2 },
  // (from by the start, south up the old hall's stair, between its pillars to the temple front at the end)
  ruins: { x: -34.4, z: 9.5, yaw: Math.PI, pitch: 0.05 },
  // (in the weavers' court, as it was before it was moved and turned: hillPlan.js workshopAt)
  workshop: { x: workshopAt(31.8, 34.3)[0], z: workshopAt(31.8, 34.3)[1], yaw: -1.17 - Math.PI / 2, pitch: 0.08 },
};

// (without the model's return stair up its south flank, its landing and the landing's piers and parapet: so the
// ziggurat is symmetrical about its great stair, as one sees it from the front)
const ZIGGURAT = ['Temple foundation', 'First terrace', 'Second terrace', 'Upper terrace', 'Front buttress', 'Flank buttress',
  'Second tier buttress',
  'Sanctuary', 'Shadowed sanctuary floor', 'Main ceremonial stair', 'Second tier ceremonial stair',
  'Upper sanctuary stair'];
const ZIGGURAT_NOT = ['First terrace east landing'];

export async function buildHill(scene) {
  // (the reference ground loom, for the workshop's and the teacher's looms)
  await loadLoom();
  // (and the temple's statues: temple.js)
  await loadStatues();
  // (and the market's sheep: sheep.js)
  await loadSheep();
  const town = buildHillTown(scene);
  // (the ground after the town: its mesh kept under the floors of the yards before the houses)
  buildHillLand(scene, { floors: town.yards });
  const river = buildRiverside(scene);
  const ruins = buildUrukRuins(scene);
  const extra = [];
  const unit = new THREE.BoxGeometry(1, 1, 1).deleteAttribute('uv');

  const pieces = await loadPieces({
    ziggurat: { prefixes: ZIGGURAT, except: ZIGGURAT_NOT, remap: { brick: 'zig', plaster: 'zig', firedbrick: 'zig', trim: 'zigcap', lime: 'zigcap' } },
    cargo: { prefixes: ['Moored cargo boat', 'Boat cargo'] },
    skiff: { prefixes: ['Small reed-bank boat'] },
  });
  // ---- the ziggurat, close above the stair on its own terrace, its stairs to the west (towards the river, the
  // way up and the evening sun) ----
  {
    const z = pieces.ziggurat;
    for (const m of z.children) m.geometry.translate(0, 0, 22);
    // its parapets: round all three terraces' edges, unbroken but where a stair comes
    // up (the fronts of the first terrace, the second and the top); on the top one, stepped merlons. In the model's
    // own units (Blender's x, y, z up; here x, z up, -y + 22), so its placing and scale are the model's; about a
    // metre high once scaled. (The model's own were a few blocks with gaps)
    {
      const B = new Builder(), unit = new THREE.BoxGeometry(1, 1, 1).deleteAttribute('uv'), q = new THREE.Quaternion();
      const blk = (x0, y0, x1, y1, z0, h) => B.add(unit, new THREE.Matrix4().compose(V((x0 + x1) / 2, z0 + h / 2, 22 - (y0 + y1) / 2), q, V(x1 - x0, h, y1 - y0)));
      const T = 0.5, H = 0.78;
      // a terrace's rectangle (its edges), its floor, the front's opening (|x| < front) and the east side's (y0e..y1e)
      const ring = (x0, x1, y0, y1, fl, front, east = null, merlons = false) => {
        const runs = [
          ['y', y0, x0, -front], ['y', y0, front, x1],                   // front (y0), either side of its stair
          ['y', y1 - T, x0, x1],                                           // back
          ['x', x0, y0 + T, y1 - T],                                       // west
          ...(east ? [['x', x1 - T, y0 + T, east[0]], ['x', x1 - T, east[1], y1 - T]] : [['x', x1 - T, y0 + T, y1 - T]]),
        ];
        for (const [axis, at, lo, hi] of runs) {
          if (hi - lo < 0.05) continue;
          if (axis === 'y') blk(lo, at, hi, at + T, fl - 0.05, H + 0.05);
          else blk(at, lo, at + T, hi, fl - 0.05, H + 0.05);
          if (!merlons) continue;
          for (let s = lo + 0.45; s < hi - 0.3; s += 0.8) {
            let y = fl + H;
            for (const [w, hh] of [[0.46, 0.15], [0.31, 0.13], [0.16, 0.11]]) {
              if (axis === 'y') blk(s - w / 2, at, s + w / 2, at + T, y, hh);
              else blk(at, s - w / 2, at + T, s + w / 2, y, hh);
              y += hh;
            }
          }
        }
      };
      ring(-23.6, 23.6, 1.4, 42.6, 12.4, 5.0);                   // the first terrace
      ring(-16.25, 16.25, 11.75, 38.25, 19.36, 2.8);             // the second
      ring(-10.55, 10.55, 18.95, 35.05, 24.32, 2.0, null, true); // the top, round the sanctuary
      const m = new THREE.Mesh(B.build(), lightMat({ kind: 'zigcap' }));
      m.castShadow = m.receiveShadow = true;
      z.add(m);
    }
    z.scale.setScalar(ZIG_AT.scale);
    z.rotation.y = -Math.PI / 2;
    z.position.set(ZIG_AT.x, PRECINCT.y - 0.05, ZIG_AT.z);
    scene.add(z);
    z.updateMatrixWorld(true);   // (one walks up its stairs: its rays need it placed before the first frame)
  }
  // the plain far off: groves, villages, Ur on the horizon (farLand.js)
  const far = buildFarLand(scene, { ziggurat: pieces.ziggurat });

  // ---- the boats: the cargo boat and the skiff, drawn in alongside the town's bank and tied up (riverside.js
  // BOATS: there their ropes and stakes); no water drawn inside them ----
  const placeBoat = (g, { x, z, yaw }) => {
    const box = new THREE.Box3().setFromObject(g), c = box.getCenter(V());
    for (const m of g.children) m.geometry.translate(-c.x, 0.22, -c.z);
    g.rotation.order = 'YXZ';
    g.rotation.y = yaw;
    g.position.set(x, 0, z);
    scene.add(g);
    // (no water drawn inside it; it rocks with the others: riverside.js sway)
    river.floating.push({ g, x, z, yaw, hull: addBoatHull(g) });
  };
  placeBoat(pieces.cargo, BOATS.cargo);
  placeBoat(pieces.skiff, BOATS.skiff);
  // the god's boat, coming down the river past the quay every few minutes (festivalBoat.js)
  const festival = buildFestivalBoat(scene, { eastEdge });

  // ---- the plants ----
  useGround(heightAt);
  const rng = makeRng(318);
  const P = newPlants();
  const space = new Spacing(8);
  const lodAt = (x, z) => { const d = Math.hypot(x - 0, z - 8); return d < 150 ? 0 : d < 420 ? 1 : 2; };
  const palm = (x, z, H = 8 + rng() * 7, opts = {}) => {
    datePalm(P, rng, x, z, { H, lod: lodAt(x, z), fruit: lodAt(x, z) === 0, ...opts });
    space.add(x, z, 2.6);
  };
  const inField = (x, z, m = 0) => x > FIELD.x0 - m && x < FIELD.x1 + m && z > FIELD.z0 - m && z < FIELD.z1 + m;
  const dry = (x, z, m = 0.2) => waterDepth(x, z) < -m;
  // the east bank of the Euphrates, north and south of the quay: groves, where the riverside walk ends. Palms close
  // together, under them pomegranates and figs, grass; in among them, half seen, the riverside villages' houses
  // (riverside.js VILLAGE). They begin just past the quay and the bay's shores (the brown house at the quay's north
  // end, the old hall's ruins at its south) and run on out of the walk, thinning and simpler the farther off
  for (const v of river.village) space.add(v.x, v.z, Math.hypot(v.w, v.d) / 2 + 1.0);
  for (const [z0, z1, dir] of [[-15, -210, -1], [42, 230, 1]]) {
    for (let z = z0; dir * (z1 - z) > 0;) {
      const dq = Math.abs(z - 10), step = dq < 70 ? 4.2 : dq < 130 ? 5.5 : 7;
      for (let x = eastEdge(z) + 3; x < 2; x += step) {
        const px = x + (rng() - 0.5) * step * 0.7, pz = z + (rng() - 0.5) * step * 0.7, d = Math.hypot(px + 36, pz - 8);
        if (d > 200 || (pz > -15 && pz < 42) || px < eastEdge(pz) + 3 || town.cellAt(px, pz) !== 4 || town.cellAt(px + 1.5, pz) !== 4 || inMoundWas(px, pz, 4) || !dry(px, pz, 0.3) || inField(px, pz, 1.5) || inRuinsGround(px, pz, 2.2) || inDoorView(px, pz) || inMarket(px, pz, 3)) continue;
        if (rng() < 0.1 + d / 700) continue;
        if (space.ok(px, pz, 1.6)) palm(px, pz, 7 + rng() * 8, { lod: d < 75 ? 0 : d < 150 ? 1 : 2, fruit: d < 75 });
        if (d < 110) {
          const r = rng(), ux = px + (rng() - 0.5) * step, uz = pz + (rng() - 0.5) * step;
          if (r < 0.14 && space.ok(ux, uz, 1.8)) { pomegranate(P, rng, ux, uz, 0.75 + rng() * 0.3); space.add(ux, uz, 1.5); }
          else if (r < 0.22 && space.ok(ux, uz, 2)) { fig(P, rng, ux, uz, 0.6 + rng() * 0.2); space.add(ux, uz, 1.8); }
          for (let k = 0; k < 2; k++) {
            const gx = px + (rng() - 0.5) * step, gz = pz + (rng() - 0.5) * step, g = 0.3 + rng() * 0.35;
            if (dry(gx, gz, 0.2)) P.grass.push({ m: mat(gx, heightAt(gx, gz) - 0.02, gz, 0, rng() * TAU, 0, g * 1.5, g, g * 1.5), c: [rng(), rng()] });
          }
        }
      }
      z += dir * step;
    }
  }
  for (let x = FIELD.x0 + 1; x < FIELD.x1; x += 5 + rng() * 2) if (space.ok(x, FIELD.z0 - 3, 2.4)) palm(x, FIELD.z0 - 3 + (rng() - 0.5) * 2);
  // up and down the river beyond, the riverside palms
  for (let z = -1200; z < 1200; z += 6 + rng() * 4) {
    if (Math.abs(z) < 95) continue;
    for (let k = 0; k < 3; k++) {
      const x = eastEdge(z) + 8 + k * 7 + rng() * 6;
      if (rng() < 0.3 || !space.ok(x, z, 2.6)) continue;
      palm(x, z);
    }
  }
  // the far bank: a deep belt of reeds from the shallows up over the bank (as the Euphrates' banks
  // are today), a dense belt of palms behind, tamarisks
  const reedBelt = (edge, side, z0, z1, skip = () => false) => {
    for (let z = z0; z < z1;) {
      // (near the town the full stands; in view across the river (mid) the lighter ones, close; far off, sparse)
      const dist = Math.hypot(edge(z) + 40, z - 10), far = dist > 125, mid = far && dist < 380;
      z += !far ? 1.0 + rng() * 0.6 : mid ? 1.3 + rng() * 0.7 : 3.2 + rng() * 1.6;
      if (skip(z)) continue;
      // (its depth varies: here a narrow fringe, there ten metres of reed bed)
      const deep = 3 + 9 * fbm(z * 0.015, side, 2, 71);
      for (let o = -5; o < deep; o += !far ? 1.3 : mid ? 1.5 : 3.3) {
        const x = edge(z) + side * (o + (rng() - 0.5) * 0.9), zz = z + (rng() - 0.5) * 0.6, h = heightAt(x, zz);
        if (h < -0.95 || h > 1.6 || rng() < 0.08) continue;
        const s = (!far ? 0.9 : mid ? 1.3 : 1.7) + rng() * 0.45, y = Math.max(h, -0.15);
        if (!far && h < -0.1 && rng() < 0.25) P.cattails.push({ m: mat(x, y, zz, 0, rng() * TAU, 0, s, s * (0.8 + rng() * 0.3), s), c: [rng(), rng()] });
        else P.reeds[far ? 1 : 0].push({ m: mat(x, y, zz, (rng() - 0.5) * 0.12, rng() * TAU, (rng() - 0.5) * 0.12, s * (far ? 1.6 : 1), s * (0.75 + rng() * 0.3), s * (far ? 1.6 : 1)), c: [rng(), rng()] });
      }
    }
  };
  reedBelt(westEdge, -1, -1200, 1200);
  // grass over the banks behind the reeds, both sides, where nothing else is
  const grassBelt = (edge, side, z0, z1, ok = () => true) => {
    for (let z = z0; z < z1; z += 0.9 + rng() * 0.9) {
      const far = Math.hypot(edge(z) + 40, z - 10) > 200;
      if (far && rng() < 0.6) continue;
      for (let k = 0; k < 6; k++) {
        const x = edge(z) + side * (3 + rng() * (far ? 40 : 55)), zz = z + (rng() - 0.5) * 1.5, h = heightAt(x, zz);
        if (h < 0.05 || !ok(x, zz)) continue;
        const sc = 0.3 + rng() * 0.4;
        if (rng() < 0.15) P.camel.push({ m: mat(x, h - 0.02, zz, 0, rng() * TAU, 0, sc * 1.6, sc * 1.1, sc * 1.6), c: [rng(), rng()] });
        else P.grass.push({ m: mat(x, h - 0.02, zz, (rng() - 0.5) * 0.2, rng() * TAU, (rng() - 0.5) * 0.2, sc * 1.6, sc * 1.2, sc * 1.6), c: [rng(), rng()] });
      }
    }
  };
  grassBelt(westEdge, -1, -900, 900);
  for (let z = -1100; z < 1100; z += 7) {
    for (let d = 8; d < 64; d += 7) {
      const x = westEdge(z) - d + (rng() - 0.5) * 3, zz = z + (rng() - 0.5) * 3;
      if (rng() < 0.15 || d > 30 + 30 * fbm(zz * 0.01, 3, 2, 7)) continue;
      if (rng() < 0.12) tamarisk(P, rng, x, zz, 1.1 + rng() * 0.4);
      else palm(x, zz);
    }
  }
  // the east bank's reeds, along the river and round the bay's open shores
  const reed = (x, z, s) => {
    const h = heightAt(x, z), y = Math.max(h, -0.15);
    if (h < 0 && rng() < 0.3) P.cattails.push({ m: mat(x, y, z, 0, rng() * TAU, 0, s, s * (0.8 + rng() * 0.3), s), c: [rng(), rng()] });
    else P.reeds[0].push({ m: mat(x, y, z, (rng() - 0.5) * 0.1, rng() * TAU, (rng() - 0.5) * 0.1, s, s * (0.75 + rng() * 0.4), s), c: [rng(), rng()] });
  };
  // (this side: the belt broken for the bay and the quay, the shadoof's place at the water and the riverside path
  // north and south of the town, where it is only a fringe at the water)
  reedBelt(eastEdge, 1, -1200, -82);
  reedBelt(eastEdge, 1, 92, 1200);
  for (let z = -82; z < 92; z += 0.9 + rng() * 0.9) {
    if (z > -16 && z < 31) continue;    // (the bay's mouth)
    if (z > -22 && z < -16) continue;   // (the shadoof's place at the water)
    for (let r = 0; r < 3; r++) if (rng() < 0.8) reed(eastEdge(z) - 2.2 + r * 1.2 + (rng() - 0.5) * 0.8, z, 0.85 + rng() * 0.45);
  }
  grassBelt(eastEdge, 1, -900, 900, (x, z) => town.cellAt(x, z) === 4 && !inField(x, z, 2) && !inRuinsGround(x, z, 0.3) && !inMarket(x, z, 0.5) && polyDist(x, z, QUAY) > 7 && !(x > -36 && z > -20 && z < 40));
  // the islands: reeds round their shores and in the shallows off them, grass and camelthorn on their backs, a
  // tamarisk or two; on the biggest a few young palms
  for (const o of ISLANDS) {
    const n = Math.round(o.len * o.wid * 0.9);
    for (let k = 0; k < n; k++) {
      const x = o.x + (rng() - 0.5) * o.wid * 1.6, z = o.z + (rng() - 0.5) * o.len * 1.5, h = heightAt(x, z);
      if (h < -0.9) continue;
      const sc = 0.85 + rng() * 0.5;
      if (h < 0.3) {
        if (h < -0.1 && rng() < 0.2) P.cattails.push({ m: mat(x, Math.max(h, -0.15), z, 0, rng() * TAU, 0, sc, sc * 0.9, sc), c: [rng(), rng()] });
        else P.reeds[Math.abs(o.z - 10) < 200 ? 0 : 1].push({ m: mat(x, Math.max(h, -0.15), z, (rng() - 0.5) * 0.12, rng() * TAU, (rng() - 0.5) * 0.12, sc, sc * (0.8 + rng() * 0.3), sc), c: [rng(), rng()] });
      } else if (rng() < 0.5) {
        const g = 0.3 + rng() * 0.4;
        (rng() < 0.2 ? P.camel : P.grass).push({ m: mat(x, h - 0.02, z, 0, rng() * TAU, 0, g * 1.6, g * 1.2, g * 1.6), c: [rng(), rng()] });
      }
    }
    for (let k = 0; k < Math.round(o.len / 35); k++) tamarisk(P, rng, o.x + (rng() - 0.5) * o.wid * 0.4, o.z + (rng() - 0.5) * o.len * 0.5, 0.8 + rng() * 0.4);
    if (o.len > 100) for (let k = 0; k < 3; k++) palm(o.x + (rng() - 0.5) * o.wid * 0.3, o.z + (rng() - 0.5) * o.len * 0.4, 5 + rng() * 5);
  }
  // reeds along the bay's two arms, in the shallows and on the wet edge: walked along its outline, the river's
  // part and the town's bank under the quay left out (and gaps for the nets and the coracles drawn up on the south
  // shore); on the spit's inner side thickest
  for (let i = 0; i < BAY.length; i++) {
    const [ax, az] = BAY[i], [bx, bz] = BAY[(i + 1) % BAY.length], l = Math.hypot(bx - ax, bz - az);
    for (let t = 0; t < l; t += 0.8 + rng() * 0.6) {
      const x = ax + ((bx - ax) * t) / l, z = az + ((bz - az) * t) / l;
      if (x < eastEdge(z) - 1 || (x > -44 && z > -5 && z < 23)) continue;
      // (in towards the water: square to the shore, the way the outline's inside lies)
      let nx = (bz - az) / l, nz = -(bx - ax) / l;
      if (polySigned(x + nx, z + nz, BAY) < polySigned(x - nx, z - nz, BAY)) { nx = -nx; nz = -nz; }
      for (let o = -1.5; o < 4; o += 1.3) {
        const px = x + nx * o, pz = z + nz * o, h = heightAt(px, pz);
        if (h < -0.8 || h > 0.5 || rng() < (z < -5 ? 0.1 : 0.25)) continue;
        if (pz > 29 && px > -58) continue;
        reed(px + (rng() - 0.5) * 0.6, pz + (rng() - 0.5) * 0.6, 0.85 + rng() * 0.45);
      }
    }
  }
  // (on the quay, leaning out over the water: at the water's edge north of the old hall, framing it from the start
  // rather than standing in the way)
  datePalm(P, rng, -38.9, 14.6, { H: 11.5, lod: 0, fruit: true, dead: 1 });
  for (const [x, z] of [[-53, -15.5], [-40, 41], [-54, 40.5]]) tamarisk(P, rng, x, z, 0.9 + rng() * 0.3);
  // a few pomegranates on the bank between the old hall and the water: their own dice,
  // so nothing else moves
  {
    const r6 = makeRng(6060);
    for (const [x, z, s] of [[-44.6, 27.4, 0.9], [-46.2, 29.4, 0.75], [-43.7, 30.7, 0.85], [-45.4, 33.6, 0.7]]) { pomegranate(P, r6, x, z, s); space.add(x, z, 1.5); }
  }
  // the plots by the shadoof: leeks, herbs
  for (const p of river.plots) {
    if (p.crop === 'bare') continue;
    for (let k = 0; k < 7; k++) {
      const x = p.x + (rng() - 0.5) * 3, z = p.z + (rng() - 0.5) * 3, s = 0.35 + rng() * 0.2;
      if (p.crop === 'leeks') P.leeks.push({ m: mat(x, p.y - 0.03, z, 0, rng() * TAU, 0, s * 0.9, s * 1.3, s * 0.9), c: [rng(), rng()] });
      else P.herbs.push({ m: mat(x, p.y, z, 0, rng() * TAU, 0, s, s * 0.7, s), c: [rng(), rng()] });
    }
  }
  // round the foot of the mound outside the town: a few palms, a pomegranate or two
  for (let k = 0; k < 120; k++) {
    const x = -30 + rng() * 130, z = -75 + rng() * 170;
    if (town.cellAt(x, z) !== 4 || inMoundWas(x, z, 0.5) || !inMoundWas(x, z, -22) || (x < -20 && z > -15 && z < 40) || !space.ok(x, z, 3) || !dry(x, z)) continue;
    if (rng() < 0.75) palm(x, z, 6 + rng() * 8);
    else pomegranate(P, rng, x, z, 0.8);
  }
  // the plain to the east: palms along the canal and in groves, belts along the east branch's banks
  for (let i = 0; i < CANAL.length - 1; i++) {
    const [ax, az] = CANAL[i], [bx, bz] = CANAL[i + 1], len = Math.hypot(bx - ax, bz - az);
    for (let t = 0; t < len; t += 7 + rng() * 5) {
      for (const s of [-1, 1]) {
        if (rng() < 0.25) continue;
        const o = 6 + rng() * 3, x = ax + ((bx - ax) * t) / len - ((bz - az) / len) * o * s, z = az + ((bz - az) * t) / len + ((bx - ax) / len) * o * s;
        if (inViewEast(x, z) || !space.ok(x, z, 3)) continue;
        if (x < 230) palm(x, z);
        else if (rng() < 0.5) tamarisk(P, rng, x, z, 0.9 + rng() * 0.3);
      }
    }
  }
  for (let z = -1000; z < 1000; z += 8 + rng() * 4) {
    for (const side of [-1, 1]) {
      for (let d = 10; d < 70; d += 8 + rng() * 6) {
        const x = E.x(z) + side * (E.half + d) + (rng() - 0.5) * 4;
        if (rng() < 0.35 || !space.ok(x, z, 3)) continue;
        // (on the near bank, in the lookout's view, reeds only: the river shows over them)
        if (side < 0 && inViewEast(x, z)) {
          if (d < 20) for (let k = 0; k < 6; k++) { const s = 1 + rng() * 0.4; P.reeds[1].push({ m: mat(x + (rng() - 0.5) * 6, heightAt(x, z), z + (rng() - 0.5) * 6, 0, rng() * TAU, 0, s), c: [rng(), rng()] }); }
          continue;
        }
        palm(x, z);
      }
    }
  }
  for (let z = -700; z < 700; z += 14) {
    for (let x = 105; x < 300; x += 14) {
      const px = x + (rng() - 0.5) * 6, pz = z + (rng() - 0.5) * 6;
      if (fbm(px * 0.008, pz * 0.008, 3, 13) < 0.56 || rng() < 0.3 || inMoundWas(px, pz, -28) || inViewEast(px, pz)) continue;
      if (px > E.x(pz) - E.half - 10) continue;
      if (polyDist(px, pz, CANAL) < 9 || !space.ok(px, pz, 3)) continue;
      palm(px, pz);
    }
  }
  // in the town: two palms in the courtyard, trees in some courts; on the temple's terrace, palms either side of
  // its stair and along the foot of its wall
  {
    const spots = [[PLAZA.x0 + 1.6, PLAZA.z0 + 1.6], [PLAZA.x1 - 1.8, PLAZA.z0 + 1.8], [PLAZA.x0 + 1.6, PLAZA.z0 + 6], [PLAZA.x1 - 1.6, PLAZA.z0 + 6]]
      .filter(([x, z]) => town.clearOfStairs(x, z, 1.4));
    spots.slice(0, 2).forEach(([x, z], k) => palm(x, z, k ? 12 : 9, { dead: 1 }));
  }
  // (the two that stood west of the weavers' house before it moved: one in the corner north of the steps up from the
  // stair, one in front of its south wall)
  for (const [x, z, H] of [[19.5, 42.6, 11], [19, 64, 9], [15.4, 19.6, 13], [17, 76, 10], [15.2, TEMPLE_GATE.z - 5.7, 10], [15.2, TEMPLE_GATE.z + 5.7, 12]]) palm(x, z, H, { gy: PRECINCT.y });
  // (reeds and cattails in the Abzu's water at its west end, by the palm leaning over it: their own dice, so
  // nothing after them moves)
  {
    const r2 = makeRng(3101);
    for (let k = 0; k < 26; k++) {
      const x = ABZU.x0 + 0.7 + r2() * 2.2, z = ABZU.z0 + 0.8 + r2() * (ABZU.z1 - ABZU.z0 - 1.6), s = 0.8 + r2() * 0.4;
      if (z < ABZU.z0 + 3 && x > ABZU.x0 + 1.6) continue;
      (r2() < 0.35 ? P.cattails : P.reeds[0]).push({ m: mat(x, ABZU.floor, z, (r2() - 0.5) * 0.1, r2() * TAU, (r2() - 0.5) * 0.1, s, s * (0.9 + r2() * 0.3), s), c: [r2(), r2()] });
    }
  }
  // (the priestess's court in the outer court: a palm, a pomegranate, herbs and leeks in its beds; their own dice too)
  {
    // (where the house was first laid out, moved north with it: outerCourt.js GIPARU_DZ)
    const r3 = makeRng(3301), gy = PRECINCT.y + 0.3, D = GIPARU_DZ;
    datePalm(P, r3, 37.6, 117.4 + D, { H: 9.5, lod: 0, fruit: true, dead: 1, gy });
    pomegranate(P, r3, 43.2, 111.6 + D, 0.85, gy);
    for (const [bz0, bz1, list] of [[118.0, 120.0, P.herbs], [120.8, 122.8, P.leeks]]) {
      for (let x = 39.8; x < 44.8; x += 0.45) for (let z = bz0 + 0.3; z < bz1 - 0.2; z += 0.45) {
        const sc = 0.35 + r3() * 0.2;
        list.push({ m: mat(x + (r3() - 0.5) * 0.15, gy + 0.22, z + D + (r3() - 0.5) * 0.15, 0, r3() * TAU, 0, sc, sc * 1.1, sc), c: [r3(), r3()] });
      }
    }
  }
  // (the town's edited corners' trees: on two roofs, and the pomegranate over the little square's mat; their own dice)
  {
    // (each its own dice, from where it stands: one more added does not change the others)
    for (const t of town.extraTrees ?? []) {
      const r6 = makeRng(3601 + Math.round(t.x * 10) * 7919 + Math.round(t.z * 10) * 104729);
      if (t.kind === 'fig') fig(P, r6, t.x, t.z, 0.75 * (t.s ?? 1), t.y);
      else pomegranate(P, r6, t.x, t.z, 0.9 * (t.s ?? 1), t.y);
    }
  }
  // (more trees in the precinct and its outer court, not palms only: their own dice. East, where the folds were, the
  // temple's orchard as the gardens of the river country were planted, in three storeys: date palms over
  // pomegranates and figs, a tamarisk or two at its edges, a poplar; and round the temple, the pool and the
  // priestess's house a fig, a pomegranate, a tamarisk here and there, low, so the white walls show over them)
  {
    // (those in the outer court where they first stood, moved north with it: outerCourt.js COURT_DZ)
    const r4 = makeRng(3401), gy = PRECINCT.y, D = COURT_DZ;
    for (const x of [107, 113.5, 120, 126.5]) {
      for (const z of [108.2, 114.6, 121]) {
        datePalm(P, r4, x + (r4() - 0.5) * 1.2, z + D + (r4() - 0.5) * 1.2, { H: 7 + r4() * 6, lod: 0, fruit: true, gy });
        const ux = x + 3.2 + (r4() - 0.5) * 0.8, uz = z + 3.2 + (r4() - 0.5) * 0.8;
        if (ux < 131.5 && uz < 124) (r4() < 0.55 ? pomegranate : fig)(P, r4, ux, uz + D, 0.8 + r4() * 0.3, gy);
      }
    }
    tamarisk(P, r4, 104.2, 123.4 + D, 1.0);
    tamarisk(P, r4, 131.2, 106.4 + D, 0.9);
    poplar(P, r4, 131.0, 123.0 + D, 0.9);
    for (const [kind, x, z, s] of [['fig', 33.6, 88.6, 0.8], ['pom', 21.2, 88.4, 0.85], ['tam', 14.9, 88.6, 0.9], ['pom', 16.4, 82.6, 0.8],
      ['fig', 14.9, 69.6, 0.7], ['tam', 62.4, 123.6 + D, 0.9], ['tam', 101.4, 123.8 + D, 0.8], ['fig', 61.8, 103.2 + D, 0.8], ['pom', 61.6, 110.6 + D, 0.75]]) {
      if (kind === 'tam') tamarisk(P, r4, x, z, s);
      else (kind === 'fig' ? fig : pomegranate)(P, r4, x, z, s, gy);
    }
    // (between the priestess's house and the outer court's south wall: a garden of mixed trees, palms among them)
    const r5 = makeRng(3501);
    for (const [x, z, H] of [[18.5, 120.5, 9], [31.0, 122.8, 11], [47.0, 121.5, 8], [58.5, 123.4, 10]]) datePalm(P, r5, x, z + D, { H: H + r5() * 2, lod: 0, fruit: true, gy });
    for (const [kind, x, z, s] of [['pom', 24.5, 118.4, 0.85], ['pom', 40.2, 118.6, 0.8], ['pom', 53.4, 119.0, 0.9], ['fig', 21.8, 123.2, 0.8],
      ['fig', 36.8, 121.2, 0.85], ['fig', 60.8, 118.6, 0.75], ['tam', 14.9, 117.4, 0.9], ['tam', 44.2, 124.2, 0.85]]) {
      if (kind === 'tam') tamarisk(P, r5, x, z + D, s);
      else (kind === 'fig' ? fig : pomegranate)(P, r5, x, z + D, s, gy);
    }
  }
  const courts = shuffle(town.courts.filter((c) => c.rx > 1.4 && c.rz > 1.4), rng);
  courts.slice(0, 12).forEach((c, k) => {
    const x = c.x + (rng() - 0.5) * c.rx * 0.6, z = c.z + (rng() - 0.5) * c.rz * 0.6;
    if (k % 3 === 0) pomegranate(P, rng, x, z, 0.8, c.y);
    else if (k % 3 === 1) fig(P, rng, x, z, 0.7, c.y);
    else datePalm(P, rng, x, z, { H: 4 + rng() * 4, lod: 0, fruit: true, dead: 0, gy: c.y });
  });
  // by the small houses' doors (and on the quay): herbs and leeks in the pots, vines over the trellises,
  // pomegranates at the walls' feet
  for (const decor of [town.decor, river.decor]) {
    for (const p of decor.pots) {
      const s = 0.5 * p.s;
      if (rng() < 0.55) P.leeks.push({ m: mat(p.x, p.y - 0.04, p.z, 0, rng() * TAU, 0, s * 0.9, s * 1.3, s * 0.9), c: [rng(), rng()] });
      else P.herbs.push({ m: mat(p.x, p.y + s * 0.15, p.z, 0, rng() * TAU, 0, s * 0.9, s * 0.6, s * 0.9), c: [rng(), rng()] });
    }
    for (const v of decor.vines) {
      for (let k = 0; k <= 6; k++) {
        const p = v.a.clone().lerp(v.b, k / 6).addScaledVector(v.n, 0.3 + rng() * 1.2);
        const s = 0.75 + rng() * 0.35;
        P.vines.push({ m: mat(p.x, v.y + 0.15 + rng() * 0.15, p.z, (rng() - 0.5) * 0.3, rng() * TAU, (rng() - 0.5) * 0.3, s, s * 0.6, s), c: [rng(), rng()] });
      }
      for (const post of v.posts) {
        for (let y = v.gy + 0.6; y < v.y; y += 0.6) {
          const s = 0.42 + rng() * 0.15;
          P.vines.push({ m: mat(post.x + (rng() - 0.5) * 0.3, y, post.z + (rng() - 0.5) * 0.3, 0, rng() * TAU, 0, s), c: [rng(), rng()] });
        }
      }
    }
    for (const sh of decor.shrubs) pomegranate(P, rng, sh.x, sh.z, 0.6, sh.y);
    // (the trees of the little gardens along the lanes)
    for (const t of decor.trees ?? []) {
      if (t.kind === 'fig') fig(P, rng, t.x, t.z, 0.65, t.y);
      else if (t.kind === 'palm') datePalm(P, rng, t.x, t.z, { H: 3.5 + rng() * 2.5, lod: 0, fruit: true, dead: 0, gy: t.y });
      else pomegranate(P, rng, t.x, t.z, 0.8, t.y);
    }
  }
  // grass at the walls' feet along the lanes; on the mound's foot and the bank
  for (const l of LANES) {
    for (let i = 0; i < l.pts.length - 1; i++) {
      const a = l.pts[i], b = l.pts[i + 1], len = Math.hypot(b.x - a.x, b.z - a.z);
      for (let t = 0; t < len; t += 1.5 + rng() * 3) {
        if (rng() < 0.6) continue;
        const side = rng() < 0.5 ? 1 : -1, o = l.w / 2 - 0.2;
        const x = a.x + ((b.x - a.x) * t) / len - ((b.z - a.z) / len) * o * side, z = a.z + ((b.z - a.z) * t) / len + ((b.x - a.x) / len) * o * side;
        const s = 0.16 + rng() * 0.18;
        // (on the steps' treads, in the corner against the wall: not on the slope under them, where they came
        // up through the steps)
        P.grass.push({ m: mat(x, town.sillAt(x, z) - 0.02, z, 0, rng() * TAU, 0, s * 1.4, s, s * 1.4), c: [rng(), rng()] });
      }
    }
  }
  for (let k = 0; k < 2200; k++) {
    const x = -105 + rng() * 210, z = -85 + rng() * 175;
    const c = town.cellAt(x, z);
    if (c !== 4 || !dry(x, z, 0.15) || polyDist(x, z, QUAY) < 7 || inField(x, z) || inWorkshop(x, z, 0.6)) continue;
    const s = 0.25 + rng() * 0.35;
    // (none on the temple's floors or in the Abzu; their dice thrown all the same, so the rest stay where they were)
    const list = inTempleHouse(x, z, 0.4) || inAbzu(x, z, 0.4) || inTempleYard(x, z, 0.4) ? [] : null;
    if (rng() < 0.15) (list ?? P.camel).push({ m: mat(x, heightAt(x, z) - 0.02, z, 0, rng() * TAU, 0, s * 1.6, s * 1.1, s * 1.6), c: [rng(), rng()] });
    else (list ?? P.grass).push({ m: mat(x, heightAt(x, z) - 0.02, z, 0, rng() * TAU, 0, s * 1.4, s, s * 1.4), c: [rng(), rng()] });
  }
  plantMeshes(scene, P);

  // ---- the walk ----
  // where feet go (shade.js: the ground's dabs thinner there): the lanes, the square, the quay
  const T = { x0: -110, z0: -85, step: 1, nx: 210, nz: 180 };
  const tread = new Uint8Array(T.nx * T.nz);
  for (let j = 0; j < T.nz; j++) {
    for (let i = 0; i < T.nx; i++) {
      const x = T.x0 + i * T.step, z = T.z0 + j * T.step;
      tread[j * T.nx + i] = town.isOpen(x, z) || polyDist(x, z, QUAY) < 6 ? 255 : 0;
    }
  }
  const treadTex = new THREE.DataTexture(tread, T.nx, T.nz, THREE.RedFormat, THREE.UnsignedByteType);
  treadTex.magFilter = treadTex.minFilter = THREE.LinearFilter;
  treadTex.needsUpdate = true;

  // one walks in the town's lanes and on its square, and on the riverside under it: the quay, the bank north and
  // south to the palms, not into water deeper than a wade
  const walkables = [...town.walkables, ...river.walkables, ...ruins.walkables, ...extra, ...pieces.ziggurat.children];
  for (const m of walkables) m.geometry.computeBoundsTree();
  const inside = (x, z) => {
    const c = town.cellAt(x, z);
    if (c === 1 || town.upperAt(x, z) || town.inHouse(x, z) || inPrecinct(x, z)) return true;
    // (the landing stage out into the bay, and its steps down to the water)
    if (x > STAGE.x0 - STAGE.steps * STAGE.run && x < STAGE.x1 && z > STAGE.z0 + 0.15 && z < STAGE.z1 - 0.15) return true;
    if (c !== 4) return false;
    // (the riverside: the quay, the bay's shores and the bank by them, to the groves' edge north and south)
    return x < 4 && z > -21 && z < 45 && x > eastEdge(z) + 0.5 && waterDepth(x, z) < 0.35;
  };
  const v = HILL_VIEWS.quay;
  // (underfoot in the yards before the houses, their floors, not the slope under them)
  const yardAt = (x, z) => town.yards.find((f) => x > f.x0 && x < f.x1 && z > f.z0 && z < f.z1);
  return {
    heightAt: (x, z) => { const f = yardAt(x, z); return f ? f.y + 0.06 : heightAt(x, z); }, walkables, inside,
    // (every frame: the boats rocking on the water; the god's boat on its way)
    tick: (t) => { river.sway(t); festival.tick(t); },
    start: { x: v.x, z: v.z, yaw: v.yaw },
    tread: { texture: treadTex, box: [T.x0 - T.step / 2, T.z0 - T.step / 2, 1 / (T.step * T.nx), 1 / (T.step * T.nz)] },
    bounds: { walk: 400, fly: 1500 },
    plan: town.plan,
    counts: { houses: town.houses, heroes: town.heroes, uppers: town.uppers, raised: town.raised, courts: town.courts.length, fronds: P.fronds.reduce((a, l) => a + l.length, 0), reeds: P.reeds[0].length + P.reeds[1].length, farGroves: far.cards, farVillages: far.villages },
    views: HILL_VIEWS, lookout: { ...LOOKOUT, top: town.top }, doors: town.doors, windows: town.windows, plaza: PLAZA, stairY, ruins,
    festival,
  };
}
