// The bay scene's land and water (its river's banks and quay are still used by the hill town): the great river,
// some 80 m wide, flowing south past the town's west side; a small bay let into its east bank, with the town's
// quay; the town climbing its mound eastward from the quay, some five metres in 75, to the precinct's terrace; across
// the river a belt of reeds and palms, a salt flat and the desert's edge with Eridu's tell on the horizon.
//
// Heights are from the water (0). Three.js coordinates: x east, y up, z south.

import * as THREE from 'three';
import { fbm } from './rand.js';
import { lightMat } from './shade.js';
import { smooth, polySigned, polyDist, tellMesh } from './land.js';

export const REACH = 1600;   // the ground runs on to here; beyond, under the haze, a plain floor
export const WATER = 0;

// the river's banks (the east one the town's), a gentle curve; away from the town each wanders on its own, as a
// silt river's banks do (a bank eaten into here, built out into a bar there, the river wider and narrower), in
// long swings and short bites. By the town (within some 60 m of it, along the river) they are as they were
const wander = (z, seed) => ((fbm(z * 0.0045, seed, 3, seed) - 0.5) * 34 + (fbm(z * 0.035, seed + 0.5, 2, seed + 7) - 0.5) * 8)
  * smooth(60, 140, Math.abs(z - 10));
export const eastEdge = (z) => -100 + 10 * Math.sin(z * 0.01) + wander(z, 11);
export const westEdge = (z) => -181 + 10 * Math.sin(z * 0.01) + wander(z, 23);
// the bay, let into the east bank (its west side open to the river)
export const BAY = [[-112, -10], [-78, -16], [-50, -12], [-36, 0], [-37, 22], [-54, 32], [-80, 30], [-112, 26]];
// the quay along the bay's town side, its top level
export const QUAY = [[-44, -8], [-35, 1], [-36, 21], [-48, 30]];
export const QUAY_Y = 1.3;
// the town: its mound rising from the quay to the precinct; the precinct's terrace; the city wall (an ellipse)
export const PRECINCT = { x0: 46, x1: 150, z0: -62, z1: 62, y: 9 };
export const CITY = { cx: 50, cz: 0, rx: 230, rz: 190 };
export const inCity = (x, z) => ((x - CITY.cx) / CITY.rx) ** 2 + ((z - CITY.cz) / CITY.rz) ** 2 < 1;
const townY = (x) => QUAY_Y + 5.3 * Math.min(Math.max((x + 31) / 77, 0), 1) ** 1.1;
// Eridu's tell, on the south-western horizon (truly some 12 km off; here brought in to the horizon)
const ERIDU = { x: -980, z: 760 };

// the land before the water is cut into it
function land(x, z) {
  const e = eastEdge(z), w = westEdge(z);
  let h;
  if (x > e - 20) {
    // the east bank: a low levee, then (inside the walls) the town's mound
    h = 0.9 + 0.3 * smooth(0, 40, x - e);
    // (inside the walls the mound; outside them it falls away to the plain over some forty metres)
    const q = Math.hypot((x - CITY.cx) / CITY.rx, (z - CITY.cz) / CITY.rz);
    const cityK = smooth(1.16, 1.0, q);
    if (x > -40) h = Math.max(h, h + (townY(x) - h) * cityK);
    h += (fbm(x * 0.03, z * 0.03, 2, 4) - 0.5) * 0.25 * smooth(-40, -20, x);
    // the precinct's terrace
    if (x > PRECINCT.x0 && x < PRECINCT.x1 && z > PRECINCT.z0 && z < PRECINCT.z1) h = PRECINCT.y;
  } else if (x < w + 20) {
    // the far bank: a levee with its reeds and palms, a salt flat, then the desert's edge rising to low dunes
    const d = w - x;
    h = 0.8 - 0.6 * smooth(50, 110, d);
    const rise = smooth(150, 330, d);
    if (rise > 0) {
      const u = (x + z) * 0.7071 + (fbm(x * 0.004, z * 0.004, 2, 21) - 0.5) * 160;
      h += rise * (2 + 3.2 * (0.5 + 0.5 * Math.sin((u * Math.PI * 2) / 85)) ** 2.2);
    }
    const r = Math.hypot(x - ERIDU.x, z - ERIDU.z);
    if (r < 400) h += 3 * smooth(400, 0, r);   // (the tell stands on a low rise)
  } else h = -2;
  return h;
}

// the ground's height anywhere
export function heightAt(x, z) {
  let h = land(x, z);
  // the river's channel, either bank shelving steeply into it
  const e = eastEdge(z), w = westEdge(z);
  if (x < e + 2 && x > w - 2) {
    const k = Math.min(smooth(e + 1.5, e - 5, x), smooth(w - 1.5, w + 5, x));
    h = h + (-2.4 - h) * k;
  }
  // the bay: shelving gently on its open shores, a vertical quay on its town side (the quay's wall covers that step)
  const sd = polySigned(x, z, BAY);
  if (sd > -7) {
    // (a shallow margin where reeds stand in the water, deep along the quay where the boats come in)
    const bed = -0.3 - 1.5 * smooth(0, 16, sd) - 1.1 * smooth(9, 2, polyDist(x, z, QUAY));
    if (sd > 0) h = Math.min(h, bed);
    else {
      const q = polyDist(x, z, QUAY);
      // (the shore only ever lowered towards the water, never the river's bed raised: that left a ridge round the bay)
      h = q < 7 ? Math.max(h, QUAY_Y) : h > 0.15 ? h + (0.15 - h) * smooth(-7, 0, sd) : h;
    }
  }
  // the quay's top, a level strip behind it
  if (sd <= 0 && polyDist(x, z, QUAY) < 8) h = Math.max(h, QUAY_Y);
  return h;
}

// how deep the water stands here (negative: dry)
export function waterDepth(x, z) {
  const e = eastEdge(z), w = westEdge(z);
  const wet = (x < e + 1 && x > w - 1) || polySigned(x, z, BAY) > -1;
  return wet ? WATER - heightAt(x, z) : -1;
}

// a grid whose spacing grows away from the town: 1 m over the quarter and the bay
function axis(lo, hi, edge) {
  const out = [];
  for (let v = lo; v <= hi; v += 1) out.push(v);
  const grow = (from, sign) => {
    const more = [];
    let v = from, step = 1;
    while (Math.abs(v) < edge) {
      step = Math.min(step * 1.07, Math.abs(v) < 900 ? 22 : 60);
      v += sign * step;
      more.push(Math.max(-edge, Math.min(edge, v)));
    }
    return more;
  };
  return [...grow(lo, -1).reverse(), ...out, ...grow(hi, 1)];
}

// how wet, salty or sandy the ground is (shade.js ROCKY's zone): wet just above the water, salt on the far bank's
// flat, sand on the desert's edge
function zoneAt(x, z, h) {
  const e = eastEdge(z), w = westEdge(z);
  const nearWater = Math.min(Math.abs(x - e), Math.abs(x - w), Math.max(-polySigned(x, z, BAY), 0));
  const wet = smooth(2.2, 0.2, nearWater) * smooth(0.8, 0.2, h - WATER);
  const d = w - x;
  return [wet, 0.44 * smooth(60, 85, d) * (1 - smooth(140, 175, d)), smooth(130, 190, d)];
}

// water, as the FLOW material wants it (shade.js): its points, where on the current each is (metres across,
// metres downstream) and how deep it stands
export function waterMesh(pts, idx, flowOf, speed, groundAt = heightAt) {
  const pos = [], flow = [], depth = [];
  for (const [x, z] of pts) {
    pos.push(x, WATER, z);
    // (across, downstream; and how fast the current runs here, a share of speed: 1 unless flowOf says)
    const [fa, fb, fk = 1] = flowOf(x, z);
    flow.push(fa, fb, 0, fk);
    depth.push(Math.max(WATER - groundAt(x, z), -0.5));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setAttribute('flow', new THREE.Float32BufferAttribute(flow, 4));
  g.setAttribute('wdepth', new THREE.Float32BufferAttribute(depth, 1));
  g.setIndex(idx);
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, lightMat({ kind: 'water', side: THREE.DoubleSide, flow: speed }));
  m.receiveShadow = true;
  return m;
}

export function buildBayLand(scene) {
  const group = new THREE.Group();
  // the ground
  const xs = axis(-130, 105, REACH), zs = axis(-95, 100, REACH);
  const nx = xs.length, nz = zs.length;
  const pos = new Float32Array(nx * nz * 3), zone = new Float32Array(nx * nz * 3);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const k = (j * nx + i) * 3, h = heightAt(xs[i], zs[j]);
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
  const ground = new THREE.Mesh(g, groundMat);
  ground.receiveShadow = ground.castShadow = true;
  const skirt = new THREE.Mesh(new THREE.PlaneGeometry(12000, 12000).rotateX(-Math.PI / 2), groundMat);
  skirt.position.y = -4;
  group.add(ground, skirt);

  // the river and its bay, one sheet of water: a strip along the river's whole length, cut across into lanes; where
  // the bay opens off it, each row runs on east over the bay (so no seam between them, nothing like a frame)
  {
    const bayEast = (z) => {
      let m = -Infinity;
      for (let i = 0; i < BAY.length; i++) {
        const [xa, za] = BAY[i], [xb, zb] = BAY[(i + 1) % BAY.length];
        if ((za <= z) !== (zb <= z)) m = Math.max(m, xa + ((z - za) / (zb - za)) * (xb - xa));
      }
      return m;
    };
    const pts = [], ix = [], L = 40, E = 48, S = L + E + 1;
    let rows = 0;
    for (let z = -REACH; z <= REACH; z += Math.abs(z) < 45 ? 1 : Math.abs(z) < 400 ? 3 : 12) {
      const w0 = westEdge(z) - 2, e0 = eastEdge(z) + 2, e1 = Math.max(e0, bayEast(z) + 3);
      for (let k = 0; k <= L; k++) pts.push([w0 + ((e0 - w0) * k) / L, z]);
      for (let k = 1; k <= E; k++) pts.push([e0 + ((e1 - e0) * k) / E, z]);
      rows++;
    }
    for (let r = 0; r < rows - 1; r++) {
      for (let k = 0; k < S - 1; k++) {
        const a = r * S + k;
        ix.push(a, a + S, a + S + 1, a, a + S + 1, a + 1);   // (wound to face up)
      }
    }
    // (across: metres from the river's middle; along: metres downstream, south)
    group.add(waterMesh(pts, ix, (x, z) => [x - (eastEdge(z) + westEdge(z)) / 2, z + REACH], 0.5));
  }
  // Eridu's tell, its ziggurat's stump
  for (const m of tellMesh(ERIDU.x, ERIDU.z, 140, 17, 31, true, heightAt)) group.add(m);
  scene.add(group);
  return { group };
}
