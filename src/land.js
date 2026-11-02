// The alluvial plain round the city: the first, wide scene's (its plain's shapes are still used by the hill town).
// Nowhere more than a few metres up or down, but that is what the land is made of:
//   the river (the Blender scene's own, run on past the model's edges with a slow meander) between its natural
//   levees; the town on its mound, level with the levee by the river, its flanks falling some three metres to
//   the north, east and south; the back-slope east of it falling away to a lagoon in the levee's lee (a still
//   backswamp with reed islands); irrigation canals taken off the river and carried across the back-slope on
//   embankments of their own dredged silt, their water a little above the fields; a drain cut down into the
//   lagoon; on the west bank, behind its reeds and a strip of palms, a salt flat, then the desert's edge rising
//   to low dunes across the north-west wind; on the horizon two old tells, Eridu's with its ruined ziggurat.
// And the bounds one may walk in (the east bank, out of the deeper water; footbridges where the walk crosses it).
//
// Everything in three.js coordinates: x east, y up, z south. The Blender scene's (x, y) is (x, -z) here.

import * as THREE from 'three';
import { fbm, makeRng } from './rand.js';
import { lightMat } from './shade.js';
import { Builder } from './geo.js';

export const WORLD = 900;   // one walks and flies within -WORLD..WORLD on x and z
const REACH = 2400;         // the ground runs on to here, under the haze; beyond it a plain floor
const TAU = Math.PI * 2;

export const smooth = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

// the model's own ground (tools/build_mesopotamia.py: 140 x 156 m round (0, 3)), kept level at its height
export const MODEL = { x0: -70, x1: 70, z0: -81, z1: 75 };
const GROUND_Y = 0.02;
export const WATER_Y = -0.22;
export const LAGOON_Y = -4.4;
const modelDist = (x, z) => Math.hypot(Math.max(MODEL.x0 - x, x - MODEL.x1, 0), Math.max(MODEL.z0 - z, z - MODEL.z1, 0));

// the river's centre line: the Blender scene's river_x inside the model, a slow meander added beyond it
export function riverX(z) {
  const y = -z;
  const base = -47 + 3 * Math.sin(y * 0.047) + 1.1 * Math.sin(y * 0.1);
  const away = smooth(90, 260, Math.abs(y));
  return base + away * (22 * Math.sin(y * 0.0052 + 0.6) + 6 * Math.sin(y * 0.013 + 2));
}
export const RIVER_HALF = 9.5;   // water from the centre line to either bank

function segDist(x, z, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.min(Math.max(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1), 0), 1);
  return Math.hypot(x - ax - dx * t, z - az - dz * t);
}
export function polyDist(x, z, pts) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) best = Math.min(best, segDist(x, z, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
  return best;
}
function insidePoly(x, z, pts) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
// distance to a closed outline, + inside, - outside
export function polySigned(x, z, pts) {
  const d = polyDist(x, z, [...pts, pts[0]]);
  return insidePoly(x, z, pts) ? d : -d;
}

// the lagoon in the levee's lee: its shore, and its reed islands (x, z, radius)
export const LAGOON = [[132, -52], [170, -74], [222, -70], [262, -42], [276, 8], [268, 66], [236, 116], [190, 128], [150, 106], [128, 58], [122, 3]];
export const ISLANDS = [[180, 8, 9], [214, 52, 6], [160, 78, 5], [236, -22, 4]];

// irrigation canals taken off the river, each with its width; `raised`: carried on embankments, its water
// falling gently from the river's level as it goes (level(s): s metres along); otherwise a drain cut into the
// ground, its water a little below the land it runs through, down to the lagoon's
function canal(w, pts, raised = true) {
  const segs = [];
  let s0 = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], len = Math.hypot(bx - ax, bz - az);
    segs.push({ ax, az, bx, bz, len, s0 });
    s0 += len;
  }
  return { w, hw: w / 2, pts, segs, raised, length: s0 };
}
const canalFrom = (z0, pts) => [[riverX(z0) + RIVER_HALF - 2, z0], ...pts];
export const CANALS = [
  canal(4, canalFrom(-118, [[-10, -121], [60, -116], [150, -124], [260, -118], [420, -130], [640, -122], [880, -128]])),
  canal(4, canalFrom(132, [[-8, 134], [70, 140], [170, 136], [300, 139], [470, 128], [700, 136], [880, 131]])),
  canal(3, canalFrom(-380, [[0, -378], [120, -386], [300, -372], [520, -384], [880, -376]])),
  canal(3, canalFrom(400, [[0, 398], [140, 406], [330, 394], [560, 404], [880, 398]])),
  // the drain into the lagoon (fed by a culvert under the north canal's bank)
  canal(2.5, [[152, -108], [153, -90], [150, -58]], false),
  // on the west bank, watering its strip of palms, running out into the salt flat
  canal(3.5, [[riverX(-100) - RIVER_HALF + 2, -100], [-120, -104], [-190, -95], [-232, -100]]),
  canal(3.5, [[riverX(250) - RIVER_HALF + 2, 250], [-120, 254], [-200, 246], [-238, 250]]),
];
const raisedLevel = (s) => -0.4 - 0.8 * Math.min(s / 700, 1);

// the nearest canal: how far from its middle, how far along it, its water's level there
export function canalDist(x, z) {
  let best = null;
  for (const c of CANALS) {
    for (const g of c.segs) {
      const dx = g.bx - g.ax, dz = g.bz - g.az;
      const t = Math.min(Math.max(((x - g.ax) * dx + (z - g.az) * dz) / (g.len * g.len || 1), 0), 1);
      const d = Math.hypot(x - g.ax - dx * t, z - g.az - dz * t);
      if (!best || d < best.d) best = { d, s: g.s0 + g.len * t, c };
    }
  }
  const { c } = best;
  const level = c.raised ? raisedLevel(best.s) : Math.max(plain(x, z) - 0.6, LAGOON_Y + 0.05);
  return { d: best.d, s: best.s, w: c.w, hw: c.hw, raised: c.raised, level };
}

// the land before the canals and the river's channel are cut into it
function plain(x, z) {
  const dm = modelDist(x, z);
  if (dm === 0) return GROUND_Y;
  const d = x - riverX(z);
  const rough = (fbm(x * 0.012, z * 0.012, 3, 4) - 0.5) * 0.5 * smooth(0, 30, dm);
  let h;
  if (d >= 0) {
    // the levee's crest along the bank, the back-slope falling away east; the town's mound above it
    h = -0.4 * smooth(8, 25, d) - 2.6 * smooth(25, 110, d) - 0.8 * smooth(110, 220, d);
    h = Math.max(h, GROUND_Y - 3.2 * smooth(2, 36, dm)) + rough;
  } else {
    // the west bank: its crest, down to the salt flat, then the desert's edge: gravel rising to a low plateau
    // with transverse dunes on it, their ridges across the north-west wind
    const w = -d;
    h = -1.5 * smooth(60, 140, w) + rough;
    const rise = smooth(215, 420, w);
    if (rise > 0) {
      const u = (x + z) * 0.7071 + (fbm(x * 0.004, z * 0.004, 2, 21) - 0.5) * 160;
      const ridge = (0.5 + 0.5 * Math.sin((u * TAU) / 85)) ** 2.2;
      h += rise * (3 + 3.4 * ridge * (0.55 + 0.45 * fbm(x * 0.01, z * 0.01, 2, 23)));
    }
  }
  // the lagoon's basin, its shore shelving gently, the islands just out of the water
  const sd = polySigned(x, z, LAGOON);
  if (sd > -22) {
    if (sd > 0) h = LAGOON_Y - 0.2 - 1.1 * smooth(0, 30, sd);
    else h = h + (LAGOON_Y + 0.08 - h) * smooth(-22, 0, sd);
    for (const [cx, cz, r] of ISLANDS) {
      const rr = Math.hypot(x - cx, z - cz);
      if (rr < r + 4) h = Math.max(h, LAGOON_Y + 0.28 - 0.75 * smooth(r * 0.5, r + 4, rr));
    }
  }
  return h;
}

// the ground's height anywhere
export function heightAt(x, z) {
  let h = plain(x, z);
  if (modelDist(x, z) > 0) {
    const c = canalDist(x, z), hw = c.hw;
    if (c.d < hw + 16) {
      const bed = c.level - 0.2 - 0.5 * Math.max(0, 1 - (c.d / hw) ** 2);
      if (c.raised) {
        // the channel, then the inner bank up to the embankment's crest, its flat top, its outer slope (1 : 2.5)
        const crest = c.level + 0.55;
        if (c.d < hw) h = bed;
        else {
          const bank = c.d < hw + 1.2 ? c.level - 0.2 + (crest - c.level + 0.2) * smooth(hw, hw + 1.2, c.d)
            : c.d < hw + 2.6 ? crest : crest - (c.d - hw - 2.6) / 2.5;
          h = Math.max(h, bank);
        }
      } else if (c.d < hw + 0.4) h = Math.min(h, bed + (c.level - 0.1 - bed) * smooth(hw - 0.5, hw + 0.4, c.d));
      else h += 0.3 * Math.exp(-(((c.d - hw - 1.6) / 0.9) ** 2));   // (the drain's little spoil heaps)
    }
  }
  // the river's channel: a steep bank of wet silt, the bed below the water
  const d = Math.abs(x - riverX(z));
  if (d < RIVER_HALF + 1.5) {
    const bed = WATER_Y - 0.4 - 1.4 * Math.max(0, 1 - (d / RIVER_HALF) ** 2);
    h = bed + (h - bed) * smooth(RIVER_HALF - 0.9, RIVER_HALF + 0.4, d);
  }
  return h;
}

// the water's level at (x, z), if there is water there (the river, the lagoon, a canal); null if none
export function waterAt(x, z) {
  if (Math.abs(x - riverX(z)) < RIVER_HALF + 0.6) return WATER_Y;
  if (polySigned(x, z, LAGOON) > -8) return LAGOON_Y;
  const c = canalDist(x, z);
  return c.d < c.hw + 0.6 ? c.level : null;
}

// how wet, salty or sandy the ground is (for its colour, shade.js ROCKY): wet just above any water, a salt crust
// on the flat west of the river and in a rim round the lagoon, sand on the desert's edge
function zoneAt(x, z, h) {
  const d = x - riverX(z), w = -d;
  // (by the river by distance from its edge: its levee's crest stands barely above the water; elsewhere by height)
  let wet = Math.abs(d) < RIVER_HALF + 10 ? smooth(2.4, 0.3, Math.abs(d) - RIVER_HALF) : 0;
  const sd = polySigned(x, z, LAGOON);
  let salt = 0.44 * smooth(120, 150, w) * (1 - smooth(215, 250, w));
  if (sd > -30) {
    wet = Math.max(wet, smooth(0.22, 0, h - LAGOON_Y));
    salt = Math.max(salt, 0.42 * smooth(0.3, 0.55, h - LAGOON_Y) * (1 - smooth(0.75, 1.3, h - LAGOON_Y)));
  }
  const c = canalDist(x, z);
  if (c.d < c.hw + 3) wet = Math.max(wet, smooth(0.25, 0, h - c.level));
  return [wet, salt, smooth(205, 265, w)];
}

// a grid whose spacing grows away from the middle: 1 m over the city and the river by it, some 25 m at the edge
// of the walk, 70 m far out under the haze
function axis(fine, edge) {
  const out = [];
  for (let v = -fine; v <= fine; v += 1) out.push(v);
  let v = fine, step = 1;
  const more = [];
  while (v < edge) {
    step = Math.min(step * 1.06, v < 1300 ? 25 : 70);
    v = Math.min(v + step, edge);
    more.push(v);
  }
  return [...more.map((m) => -m).reverse(), ...out, ...more];
}

// the field plots, between the canals and away from the river (where the groves are), each with what it bears
// now, early in the autumn: barley stubble left from the spring harvest, ploughed land waiting for the sowing,
// sesame being cut, or fallow
function makeFields() {
  const rng = makeRng(301), fields = [];
  // (between the canals' embankments: some 14 m either side of their middles)
  const bandsZ = [[-366, -140], [-104, 116], [152, 388]];
  for (const [za, zb] of bandsZ) {
    let x = 112;
    while (x < WORLD - 60) {
      const w = 45 + rng() * 55, x0 = x, x1 = x + w;
      // across the band, one to three plots
      const n = 1 + Math.floor(rng() * 3);
      for (let k = 0; k < n; k++) {
        const z0 = za + 4 + ((zb - za - 8) * k) / n, z1 = za + 4 + ((zb - za - 8) * (k + 1)) / n - 4;
        const r = rng();
        const crop = r < 0.42 ? 'stubble' : r < 0.7 ? 'ploughed' : r < 0.86 ? 'sesame' : 'fallow';
        // (none in the lagoon's margin, the drain's way, or on the town's flank)
        if (x0 < 290 && x1 > 108 && z1 > -112 && z0 < 142) continue;
        if (x0 < MODEL.x1 + 44 && z1 > MODEL.z0 - 40 && z0 < MODEL.z1 + 40) continue;
        fields.push({ x0: x0 + 2, x1: x1 - 2, z0, z1, crop, rows: rng() < 0.5 ? 'x' : 'z' });
      }
      x += w + 4;
    }
  }
  return fields;
}

// an old tell on the horizon: a broad, gullied mound of melted mud brick; Eridu's carrying the stump of its
// ziggurat. Its own mesh (finer than the far ground's grid), set on the ground
export function tellMesh(cx, cz, R, H, seed, stump, groundAt = heightAt) {
  const b = new Builder(), rings = 30, segs = 72, base = b.count;
  for (let i = 0; i <= rings; i++) {
    const f = i / rings, r = R * 1.25 * f;
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * TAU, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      const gully = 1 - 0.18 * smooth(0.45, 1, f) * (0.5 + 0.5 * Math.sin(a * 9 + fbm(Math.cos(a) * 3, Math.sin(a) * 3, 2, seed) * 6));
      const mound = H * Math.max(0, 1 - (r / R) ** 2) ** 1.3 * gully * (0.92 + 0.16 * fbm(x * 0.02, z * 0.02, 2, seed + 3));
      b.vert(x, groundAt(x, z) - 0.3 + mound, z, 0, 1, 0);
    }
  }
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segs; j++) {
      const a = base + i * segs + j, n = base + i * segs + ((j + 1) % segs);
      b.tri(a, n, a + segs);
      b.tri(n, n + segs, a + segs);
    }
  }
  const g = b.build();
  g.computeVertexNormals();
  const out = [new THREE.Mesh(g, lightMat({ kind: 'earth' }))];
  if (stump) {
    // the ziggurat's ruin: two slumped, square-ish stages, set a little askew
    const top = groundAt(cx, cz) - 0.3 + H * 0.97;
    const sg = new Builder();
    const frustum = (r0, r1, h, y) => {
      const geo = new THREE.CylinderGeometry(r1, r0, h, 4, 3).rotateY(Math.PI / 4 + 0.2).translate(cx, y + h / 2, cz);
      geo.deleteAttribute('uv');
      const p = geo.attributes.position;
      for (let k = 0; k < p.count; k++) {   // (its edges worn round and down)
        const yy = (p.getY(k) - y) / h, wob = 1 + 0.08 * Math.sin(p.getX(k) * 0.4 + p.getZ(k) * 0.3);
        p.setX(k, cx + (p.getX(k) - cx) * wob * (1 - 0.12 * yy * yy));
        p.setZ(k, cz + (p.getZ(k) - cz) * wob * (1 - 0.12 * yy * yy));
      }
      sg.add(geo, new THREE.Matrix4(), { flat: true });
    };
    frustum(26, 18, 9, top - 1);
    frustum(13, 8, 5.5, top + 7.5);
    const m = new THREE.Mesh(sg.build(), lightMat({ kind: 'brick' }));
    out.push(m);
  }
  for (const m of out) m.castShadow = m.receiveShadow = true;
  return out;
}

// a plank footbridge from (ax, az) to (bx, bz), resting on the ground at either end
function footbridge(ax, az, bx, bz, width = 1.7) {
  const b = new Builder(), ya = heightAt(ax, az) + 0.06, yb = heightAt(bx, bz) + 0.06;
  const len = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bz - az, bx - ax);
  const at = (t, side, y) => new THREE.Vector3(ax + (bx - ax) * t - Math.sin(ang) * side, y, az + (bz - az) * t + Math.cos(ang) * side);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const put = (p, sx, sy, sz, yaw) => b.add(box, new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(sx, sy, sz)), { flat: true });
  // planks across, on two log beams, a post at each corner
  const n = Math.ceil(len / 0.32);
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n, y = ya + (yb - ya) * t;
    put(at(t, 0, y), 0.28, 0.07, width * (0.94 + 0.08 * Math.sin(k * 2.3)), -ang);
  }
  for (const side of [-0.55, 0.55]) {
    const p = at(0.5, side * width, (ya + yb) / 2 - 0.1);
    put(p, len + 0.6, 0.16, 0.18, -ang);
  }
  for (const t of [0.02, 0.98]) for (const side of [-0.5, 0.5]) put(at(t, side * width, ((t < 0.5 ? ya : yb)) + 0.25), 0.12, 0.9, 0.12, -ang);
  const m = new THREE.Mesh(b.build(), lightMat({ kind: 'wood' }));
  m.castShadow = m.receiveShadow = true;
  // where it may be walked over the water (a box along it, for the walk's bounds)
  const pass = (x, z) => {
    const ux = Math.cos(ang), uz = Math.sin(ang), px = x - ax, pz = z - az;
    const along = px * ux + pz * uz, across = -px * uz + pz * ux;
    return along > -0.5 && along < len + 0.5 && Math.abs(across) < width / 2;
  };
  return { mesh: m, pass };
}

// the three viewpoints of the plan; the first is where one starts
export const VIEWS = {
  reeds: { x: riverX(-150) + 12.5, z: -150 },
  // (on the upper terrace's north-east corner, 24 m up: the lagoon a broad sheet on the right golden line; from
  // the first terrace it was only a bright rim)
  terrace: { x: 9.6, y: 24.3, z: -33, look: [200, 2, 27], turn: 0.24 },
  lagoon: { x: 275.5, z: 36 },
};

export function buildLand(scene) {
  const xs = axis(130, REACH), zs = axis(130, REACH);
  const nx = xs.length, nz = zs.length;
  const pos = new Float32Array(nx * nz * 3), zone = new Float32Array(nx * nz * 3);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const k = (j * nx + i) * 3, h = heightAt(xs[i], zs[j]);
      pos[k] = xs[i];
      pos[k + 1] = h;
      pos[k + 2] = zs[j];
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
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.setAttribute('zone', new THREE.BufferAttribute(zone, 3));
  g.computeVertexNormals();
  const group = new THREE.Group();
  const groundMat = lightMat({ kind: 'ground' });
  const ground = new THREE.Mesh(g, groundMat);
  ground.receiveShadow = ground.castShadow = true;
  // far beyond, a plain floor to the horizon
  const skirt = new THREE.Mesh(new THREE.PlaneGeometry(12000, 12000).rotateX(-Math.PI / 2), groundMat);
  skirt.position.y = -9;   // (below everything, the lagoon's bed included)
  skirt.receiveShadow = true;
  group.add(ground, skirt);

  // the water: the river, and the canals at their own level. Each a strip along its course, cut across into
  // several lanes, carrying for the water's shader (shade.js FLOW) where on the current each point is (flow: metres
  // across from the middle, metres along downstream) and how deep the water stands there (wdepth: from the bank's
  // own height under it; 0 at the waterline, negative where the bank rises out of it). speed: the current at the
  // middle (m/s)
  const strip = (pts, half, levelAt, lanes, speed) => {
    const pos = [], flow = [], depth = [], idx = [];
    let along = 0;
    pts.forEach(([x, z], i) => {
      if (i) along += Math.hypot(x - pts[i - 1][0], z - pts[i - 1][1]);
      const [px, pz] = pts[Math.max(i - 1, 0)], [qx, qz] = pts[Math.min(i + 1, pts.length - 1)];
      const tx = qx - px, tz = qz - pz, l = Math.hypot(tx, tz) || 1, nx = -tz / l, nz = tx / l;
      const y = levelAt(x, z, along);
      for (let k = 0; k <= lanes; k++) {
        const o = (k / lanes * 2 - 1) * half, wx = x + nx * o, wz = z + nz * o;
        pos.push(wx, y, wz);
        flow.push(o, along);
        depth.push(Math.max(y - heightAt(wx, wz), -0.5));
      }
    });
    const S = lanes + 1;
    for (let i = 0; i < pts.length - 1; i++) {
      for (let k = 0; k < lanes; k++) {
        const a0 = i * S + k;
        idx.push(a0, a0 + 1, a0 + S + 1, a0, a0 + S + 1, a0 + S);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    g.setAttribute('flow', new THREE.Float32BufferAttribute(flow, 2));
    g.setAttribute('wdepth', new THREE.Float32BufferAttribute(depth, 1));
    g.setIndex(idx);
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, lightMat({ kind: 'water', side: THREE.DoubleSide, flow: speed }));
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  const river = [];
  for (let z = -REACH; z <= REACH; z += Math.abs(z) < WORLD + 100 ? 2 : 10) river.push([riverX(z), z]);
  strip(river, RIVER_HALF + 1, () => WATER_Y, 14, 0.55);
  for (const c of CANALS) {
    // (each canal's points, filled in every few metres so its strip follows the bends)
    const pts = [];
    for (let i = 0; i < c.pts.length - 1; i++) {
      const [ax, az] = c.pts[i], [bx, bz] = c.pts[i + 1], m = Math.ceil(Math.hypot(bx - ax, bz - az) / 4);
      for (let k = 0; k < m; k++) pts.push([ax + ((bx - ax) * k) / m, az + ((bz - az) * k) / m]);
    }
    pts.push(c.pts[c.pts.length - 1]);
    strip(pts, c.hw + 0.5, c.raised ? (x, z, s) => raisedLevel(s) : (x, z) => canalDist(x, z).level, 4, 0.25);
  }
  // the lagoon: still water (a breath of current along the wind, so its streaks lie as wind lanes do), over a
  // grid that covers its shallows
  {
    const pos = [], flow = [], depth = [], idx = [], at = new Map();
    const xs0 = Math.min(...LAGOON.map((p) => p[0])) - 6, xs1 = Math.max(...LAGOON.map((p) => p[0])) + 6;
    const zs0 = Math.min(...LAGOON.map((p) => p[1])) - 6, zs1 = Math.max(...LAGOON.map((p) => p[1])) + 6;
    const step = 2, nxl = Math.ceil((xs1 - xs0) / step), nzl = Math.ceil((zs1 - zs0) / step);
    const vert = (i, j) => {
      const key = j * (nxl + 1) + i;
      if (!at.has(key)) {
        const x = xs0 + i * step, z = zs0 + j * step;
        at.set(key, pos.length / 3);
        pos.push(x, LAGOON_Y, z);
        flow.push((x - z) * 0.7071, (x + z) * 0.7071);
        depth.push(Math.max(LAGOON_Y - heightAt(x, z), -0.5));
      }
      return at.get(key);
    };
    for (let j = 0; j < nzl; j++) {
      for (let i = 0; i < nxl; i++) {
        const x = xs0 + (i + 0.5) * step, z = zs0 + (j + 0.5) * step;
        if (polySigned(x, z, LAGOON) < -7) continue;
        const a = vert(i, j), b = vert(i + 1, j), c = vert(i + 1, j + 1), d = vert(i, j + 1);
        idx.push(a, d, c, a, c, b);
      }
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    lg.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    lg.setAttribute('flow', new THREE.Float32BufferAttribute(flow, 2));
    lg.setAttribute('wdepth', new THREE.Float32BufferAttribute(depth, 1));
    lg.setIndex(idx);
    lg.computeBoundingSphere();
    const lm = new THREE.Mesh(lg, lightMat({ kind: 'water', side: THREE.DoubleSide, flow: 0.05 }));
    lm.receiveShadow = true;
    group.add(lm);
  }

  // the old tells on the horizon: Eridu to the south-west (the oldest holy city; truly some 12 km off, here
  // brought in to the horizon of the walk), and an abandoned small town's to the north-east
  for (const m of [...tellMesh(-800, 780, 135, 17, 31, true), ...tellMesh(905, -950, 105, 11, 37, false)]) group.add(m);

  // footbridges where the walk crosses water: over the north canal by the river (on the way from the reeds into
  // the town), and over the drain where it reaches the lagoon
  const bridges = [];
  {
    const bx = riverX(-150) + 12.5;
    let zc = -118, best = Infinity;
    for (let z = -126; z < -110; z += 0.1) { const d = canalDist(bx, z).d; if (d < best) { best = d; zc = z; } }
    const half = canalDist(bx, zc).hw + 2.2;
    bridges.push(footbridge(bx, zc - half, bx, zc + half));
    const dz = -80, dx = 152.4;
    bridges.push(footbridge(dx - 4.2, dz, dx + 4.2, dz));
  }
  for (const b of bridges) group.add(b.mesh);

  // the fields: their crops lie on the ground (kind crop: stubble and sesame; earth: ploughed and fallow), the
  // bunds round them low ridges of the ground's own silt
  const fields = makeFields();
  const cover = { crop: new Builder(), earth: new Builder() }, bunds = new Builder();
  const quad = (b, x0, z0, x1, z1, lift) => {
    const step = 6, base = b.count, nxq = Math.max(1, Math.ceil((x1 - x0) / step)), nzq = Math.max(1, Math.ceil((z1 - z0) / step));
    for (let j = 0; j <= nzq; j++) {
      for (let i = 0; i <= nxq; i++) {
        const x = x0 + ((x1 - x0) * i) / nxq, z = z0 + ((z1 - z0) * j) / nzq;
        b.vert(x, heightAt(x, z) + lift, z, 0, 1, 0);
      }
    }
    for (let j = 0; j < nzq; j++) {
      for (let i = 0; i < nxq; i++) {
        const a = base + j * (nxq + 1) + i;
        b.tri(a, a + nxq + 1, a + 1);
        b.tri(a + 1, a + nxq + 1, a + nxq + 2);
      }
    }
  };
  const ridge = (ax, az, bx, bz) => {
    const len = Math.hypot(bx - ax, bz - az), m = Math.max(1, Math.ceil(len / 6)), ux = (bx - ax) / len, uz = (bz - az) / len;
    const base = bunds.count;
    for (let k = 0; k <= m; k++) {
      const x = ax + ((bx - ax) * k) / m, z = az + ((bz - az) * k) / m, y = heightAt(x, z);
      for (const [o, up] of [[-0.7, 0], [0, 0.32], [0.7, 0]]) bunds.vert(x - uz * o, y + up - 0.02, z + ux * o, 0, 1, 0);
    }
    for (let k = 0; k < m; k++) {
      const a = base + k * 3;
      bunds.tri(a, a + 3, a + 1); bunds.tri(a + 1, a + 3, a + 4);
      bunds.tri(a + 1, a + 4, a + 2); bunds.tri(a + 2, a + 4, a + 5);
    }
  };
  for (const f of fields) {
    if (f.crop === 'stubble' || f.crop === 'sesame') quad(cover.crop, f.x0, f.z0, f.x1, f.z1, 0.03);
    else if (f.crop === 'ploughed') quad(cover.earth, f.x0, f.z0, f.x1, f.z1, 0.03);
    ridge(f.x0 - 1, f.z0 - 1, f.x1 + 1, f.z0 - 1);
    ridge(f.x1 + 1, f.z0 - 1, f.x1 + 1, f.z1 + 1);
    ridge(f.x1 + 1, f.z1 + 1, f.x0 - 1, f.z1 + 1);
    ridge(f.x0 - 1, f.z1 + 1, f.x0 - 1, f.z0 - 1);
  }
  for (const [kind, b] of Object.entries(cover)) {
    if (!b.count) continue;
    const m = new THREE.Mesh(b.build(), lightMat({ kind }));
    m.receiveShadow = true;
    group.add(m);
  }
  const bundGeo = bunds.build();
  bundGeo.computeVertexNormals();
  const bundMesh = new THREE.Mesh(bundGeo, groundMat);
  bundMesh.receiveShadow = bundMesh.castShadow = true;
  group.add(bundMesh);
  scene.add(group);

  // where feet go (the city's paths, tools/build_mesopotamia.py's ribbons and the visitor loop): 1 on them,
  // gone a few metres off; the ground's painted dabs thinner there
  const B = (pts) => pts.map(([x, y]) => [x, -y]);
  const PATHS = [
    B([[-34, -30], [-21, -36], [0, -39], [30, -36], [43, -24], [45, 0], [43, 36], [32, 52], [3, 56], [-9, 48], [-29, 48], [-33, 26], [-34, -3], [-34, -30]]),
    B([[-33, -22], [-22, -24], [-12, -27], [0, -30]]),
    B([[29, -17], [31, -24], [41, -27]]),
  ];
  const T = { x0: -90, z0: -100, step: 1, nx: 181, nz: 191 };
  const treadData = new Uint8Array(T.nx * T.nz);
  for (let j = 0; j < T.nz; j++) {
    for (let i = 0; i < T.nx; i++) {
      const x = T.x0 + i * T.step, z = T.z0 + j * T.step;
      const d = Math.min(...PATHS.map((p) => polyDist(x, z, p)));
      treadData[j * T.nx + i] = Math.round(255 * smooth(5, 2.5, d));
    }
  }
  const treadTex = new THREE.DataTexture(treadData, T.nx, T.nz, THREE.RedFormat, THREE.UnsignedByteType);
  treadTex.magFilter = treadTex.minFilter = THREE.LinearFilter;
  treadTex.needsUpdate = true;
  const tread = { texture: treadTex, box: [T.x0 - T.step / 2, T.z0 - T.step / 2, 1 / (T.step * T.nx), 1 / (T.step * T.nz)] };

  let city = null;
  // the start: viewpoint 1, coming out of the reeds by the river north of the town, looking down the river at the
  // town and its ziggurat (set a little left of the middle: on the picture's left golden line)
  const v = VIEWS.reeds;
  const start = { x: v.x, z: v.z, yaw: Math.atan2(-(0 - v.x), -(-22 - v.z)) - 0.17 };
  return {
    group, tread, fields, paths: PATHS, start,
    walkables: bridges.map((b) => b.mesh),
    useCity(c) { city = c; },
    // where something stands that a plant must keep clear of: a building (or any of the city's things), with a
    // margin; the water
    solidAt(x, z, margin = 0) {
      if (Math.abs(x - riverX(z)) < RIVER_HALF + 0.3 + margin * 0.5) return true;
      if (polySigned(x, z, LAGOON) > -0.4 - margin * 0.5) return true;
      const c = canalDist(x, z);
      if (c.d < c.hw + 0.6 + margin * 0.5) return true;
      return !!city?.occupied(x, z, margin);
    },
    pathDist: (x, z) => Math.min(...PATHS.map((p) => polyDist(x, z, p))),
    // the east bank, within the plain (one cannot cross the river), out of any water deeper than one would wade
    // into, except over a footbridge
    inside(x, z) {
      if (!(x > riverX(z) + RIVER_HALF + 0.4 && Math.abs(x) < WORLD - 30 && Math.abs(z) < WORLD - 30)) return false;
      const lv = waterAt(x, z);
      if (lv === null || lv - heightAt(x, z) < 0.35) return true;
      return bridges.some((b) => b.pass(x, z));
    },
  };
}
