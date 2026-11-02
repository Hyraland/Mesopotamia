// The plain far off: what stands on it beyond the walk, seen from the ziggurat's top
// and over the river. Palm groves along both rivers and along the canals (hillLand.js FAR_CANALS), each a row of
// palms drawn on a card turned to face the town (from the walk, some hundreds of metres off, they cannot be told
// from the real ones, and cost a few triangles each); villages on their low tells among the fields; and Ur, out
// in front of the ziggurat's stair over the river, its walls and its far greater ziggurat. The farther off, the more it goes into the sky (shade.js
// uFarFade), so nothing is placed past some ten kilometres.

import * as THREE from 'three';
import { Builder } from './geo.js';
import { makeRng, fbm } from './rand.js';
import { lightMat } from './shade.js';
import { tellMesh } from './land.js';
import { groveCards } from './plantTextures.js';
import { heightAt, eastEdge, westEdge, FAR_CANALS, OLD_TELL, UR, inUr } from './hillLand.js';
import { EAST_BRANCH as E } from './hillPlan.js';

const TOWN = { x: 45, z: 40 };   // (the cards face the walk's middle)
const NEAR = 300;               // (and none stands nearer it than this: from the walk it would show flat)
const REACH = 10000;            // (nor farther: there all is sky)

// a card 1 wide and 1 high, standing on the middle of its foot, facing +z; its normals bent round like a grove's
// mass (out to the sides at its ends, up at its top), the same on both faces
function cardGeometry() {
  const b = new Builder(true), NX = 4, NY = 2, n = new THREE.Vector3();
  for (let j = 0; j <= NY; j++) {
    for (let i = 0; i <= NX; i++) {
      const u = i / NX, v = j / NY;
      n.set((u - 0.5) * 1.4, 0.25 + 0.6 * v, 0.8).normalize();
      b.vert(u - 0.5, v, 0, n.x, n.y, n.z, u, v);
    }
  }
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      const a = j * (NX + 1) + i;
      b.tri(a, a + 1, a + NX + 2);
      b.tri(a, a + NX + 2, a + NX + 1);
    }
  }
  return b.build();
}

const isWet = (x, z) => (x < eastEdge(z) + 2 && x > westEdge(z) - 2) || Math.abs(x - E.x(z)) < E.half + 3;
const fromTown = (x, z) => Math.hypot(x - TOWN.x, z - TOWN.z);

export function buildFarLand(scene, { ziggurat = null } = {}) {
  const rng = makeRng(2901);
  const cards = groveCards();
  const lists = cards.map(() => []);
  // a grove's card at (x, z): w metres wide, h high (the palms on it reach some 13/16 of h)
  const grove = (x, z, w = 45 + rng() * 30, h = 14 + rng() * 4) => {
    const d = fromTown(x, z);
    if (d < NEAR || d > REACH || isWet(x, z) || Math.hypot(x - UR.x, z - UR.z) < UR.r * 0.6) return false;
    lists[Math.floor(rng() * lists.length)].push({ x, z, y: heightAt(x, z) - 0.4, w, h, c: [rng(), rng()] });
    return true;
  };
  // (now thick, now thin: groves come in stretches along a bank)
  const dense = (x, z, seed) => 0.25 + 0.9 * fbm(x * 0.0015, z * 0.0015, 2, seed);

  // along both rivers, several rows deep, beyond the real palms (hillScene.js: within some 1100 m up and down
  // of the town and 70 m of the banks)
  for (let z = -REACH; z < REACH; z += 45 + rng() * 25) {
    for (let k = 0; k < 9; k++) {
      const d = 15 + k * 50 + rng() * 25, p = dense(0, z, 41 + k) - k * 0.06;
      if (rng() < p && (Math.abs(z) > 1150 || d > 75)) grove(westEdge(z) - d, z + (rng() - 0.5) * 30);
      if (rng() < p && (Math.abs(z) > 1250 || d > 75)) grove(eastEdge(z) + d, z + (rng() - 0.5) * 30);
      for (const side of [-1, 1]) {
        if (rng() < p * 0.9 && (Math.abs(z) > 1050 || d > 80)) grove(E.x(z) + side * (E.half + d), z + (rng() - 0.5) * 30);
      }
    }
  }
  // along the canals, both banks, broken
  FAR_CANALS.forEach((pts, ci) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az), tx = (bx - ax) / L, tz = (bz - az) / L;
      for (let t = 30; t < L; t += 55 + rng() * 25) {
        const cx = ax + tx * t, cz = az + tz * t, p = dense(cx, cz, 60 + ci) + 0.05;
        for (const side of [-1, 1]) {
          const o = 9 + rng() * 14;
          if (rng() < p) grove(cx - tz * side * o, cz + tx * side * o);
        }
      }
    }
  });

  // villages: on low tells by the canals, each a knot of flat-roofed houses, its palms round it; and the old
  // tell across the river, its houses on its crown
  const houses = { whitewash: new Builder(), plaster: new Builder(), buff: new Builder() };
  const box = new THREE.BoxGeometry(1, 1, 1).deleteAttribute('uv');
  const house = (x, y, z, w, d, h, yaw) => {
    const r = rng(), b = r < 0.55 ? houses.whitewash : r < 0.85 ? houses.plaster : houses.buff;
    b.add(box, new THREE.Matrix4().compose(new THREE.Vector3(x, y + (h - 1) / 2, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(w, h + 1, d)));
    // (an upper room on some)
    if (rng() < 0.25) b.add(box, new THREE.Matrix4().compose(new THREE.Vector3(x + (rng() - 0.5) * w * 0.3, y + h + 1.2, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(w * 0.45, 2.6, d * 0.5)));
  };
  const tells = [];
  const village = (cx, cz, R, H, n, { tell = true, top = null } = {}) => {
    if (tell) tells.push([cx, cz, R, H]);
    const yaw = rng() * Math.PI;
    for (let k = 0; k < n; k++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * R * 0.62, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      const y = (top ?? heightAt(x, z)) + H * Math.max(0, 1 - (r / R) ** 2) ** 1.3 - 0.6;
      house(x, y, z, 5 + rng() * 6, 5 + rng() * 6, 2.8 + rng() * 1.4, yaw + (rng() - 0.5) * 0.15);
    }
    for (let k = 0; k < 6 + n / 3; k++) {
      const a = rng() * Math.PI * 2, r = R * (0.75 + rng() * 0.7);
      grove(cx + Math.cos(a) * r, cz + Math.sin(a) * r);
    }
  };
  let made = 0;
  for (const pts of FAR_CANALS) {
    if (rng() < 0.45) continue;
    const i = Math.floor(rng() * (pts.length - 1)), f = 0.2 + rng() * 0.6;
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az);
    const side = rng() < 0.5 ? -1 : 1, o = 70 + rng() * 90;
    const x = ax + (bx - ax) * f - ((bz - az) / L) * side * o, z = az + (bz - az) * f + ((bx - ax) / L) * side * o;
    if (fromTown(x, z) < 900 || fromTown(x, z) > 8000 || isWet(x, z) || Math.hypot(x - UR.x, z - UR.z) < UR.r * 1.5) continue;
    village(x, z, 55 + rng() * 60, 2.5 + rng() * 3, 8 + Math.floor(rng() * 22));
    if (++made >= 16) break;
  }
  village(OLD_TELL.x, OLD_TELL.z, OLD_TELL.r, OLD_TELL.h, 26, { tell: false, top: heightAt(OLD_TELL.x, OLD_TELL.z) - 0.3 });

  // Ur: a long, high mound (centuries of the city), the city packed on it inside its wall, an oval some 1.3 km
  // by 0.8 lying north-west to south-east; at its middle the temple's walled terrace with its great courts, and on
  // it the ziggurat of Ur-Nammu, half as big again as ours (the same model, scaled: its stair turned towards us)
  {
    const H = 13, ax = Math.cos(0.5), az = Math.sin(0.5);
    // (in the oval's own frame: u along it, v across)
    const toW = (u, v) => [UR.x + u * ax - v * az, UR.z + u * az + v * ax];
    const rIn = inUr;
    tells.push([UR.x, UR.z, UR.r * 1.05, H]);
    const g0 = heightAt(UR.x, UR.z) - 0.3, yAt = (x, z) => g0 + H * Math.max(0, 1 - Math.min(rIn(x, z) * 0.95, 1) ** 2) ** 1.3;
    // the temple's terrace: 260 by 200 m, raised 4 m, walled
    const TU = 130, TV = 100, ty = yAt(UR.x, UR.z) + 4, rot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -0.5);
    const blk = (b, u, v, y, w, h, d) => { const [x, z] = toW(u, v); b.add(box, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), rot, new THREE.Vector3(w, h, d))); };
    blk(houses.plaster, 0, 0, ty - 4, 2 * TU, 9, 2 * TV);
    for (const [u, v, w, d] of [[0, -TV, 2 * TU, 6], [0, TV, 2 * TU, 6], [-TU, 0, 6, 2 * TV], [TU, 0, 6, 2 * TV]]) blk(houses.buff, u, v, ty + 3, w, 7, d);
    // (the temples and storehouses in its courts, round the ziggurat)
    for (const [u, v, w, d, h] of [[-80, 55, 70, 50, 11], [85, -50, 60, 45, 9], [80, 60, 45, 40, 8], [-85, -55, 50, 35, 8]]) blk(houses.whitewash, u, v, ty + h / 2, w, h, d);
    // the houses, packed (a few larger: the great families', the palace)
    for (let k = 0; k < 900; k++) {
      const u = (rng() * 2 - 1) * UR.r * 1.0, v = (rng() * 2 - 1) * UR.r * 0.62, [x, z] = toW(u, v);
      if (rIn(x, z) > 0.9 || (Math.abs(u) < TU + 12 && Math.abs(v) < TV + 12)) continue;
      const big = rng() < 0.04;
      house(x, yAt(x, z) - 0.6, z, (big ? 20 : 6) + rng() * 8, (big ? 18 : 6) + rng() * 8, (big ? 6 : 3) + rng() * 2, -0.5 + (rng() - 0.5) * 0.1);
    }
    // the city wall, 11 m high, its towers
    const N = 96;
    for (let k = 0; k < N; k++) {
      const a = (k / N) * Math.PI * 2, [x, z] = toW(Math.cos(a) * UR.r * 0.98, Math.sin(a) * UR.r * 0.63);
      const [x2, z2] = toW(Math.cos(a + 0.07) * UR.r * 0.98, Math.sin(a + 0.07) * UR.r * 0.63), len = Math.hypot(x2 - x, z2 - z) + 1.5;
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(-(z2 - z), x2 - x));
      houses.buff.add(box, new THREE.Matrix4().compose(new THREE.Vector3(x, yAt(x, z) + 3, z), q, new THREE.Vector3(len, 12, 8)));
      if (k % 3 === 0) houses.buff.add(box, new THREE.Matrix4().compose(new THREE.Vector3(x, yAt(x, z) + 4.5, z), q, new THREE.Vector3(11, 15, 12)));
    }
    // palms round it, thick along the canal coming to it and on the river side
    for (let k = 0; k < 70; k++) {
      const a = rng() * Math.PI * 2, [x, z] = toW(Math.cos(a) * UR.r * (1.08 + rng() * 0.6), Math.sin(a) * UR.r * (0.72 + rng() * 0.5));
      grove(x, z);
    }
    if (ziggurat) {
      const z = ziggurat.clone();
      z.scale.setScalar(2.2);
      z.position.set(UR.x, ty + 0.5, UR.z);
      z.rotation.y = Math.PI / 2 + 0.6;
      z.traverse((m) => { if (m.isMesh) m.castShadow = false; });
      scene.add(z);
    }
  }

  // ---- into the scene ----
  for (const [x, z, R, H] of tells) for (const m of tellMesh(x, z, R, H, 37 + tells.length, false, heightAt)) { m.castShadow = false; scene.add(m); }
  for (const [kind, b] of Object.entries(houses)) {
    if (!b.count) continue;
    const m = new THREE.Mesh(b.build(), lightMat({ kind }));
    m.receiveShadow = true;
    scene.add(m);
  }
  // the cards, in tiles 1.5 km across (so the view leaves out those behind it); the trunks just behind the crowns
  const geo = cardGeometry(), TILE = 1500, q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), c = new THREE.Color();
  const crownMats = cards.map((t) => lightMat({ kind: 'palm', alphaMap: t.crowns, side: THREE.DoubleSide, bent: true }));
  const trunkMats = cards.map((t) => lightMat({ kind: 'bark', alphaMap: t.trunks, side: THREE.DoubleSide, bent: true }));
  let count = 0;
  lists.forEach((list, v) => {
    const tiles = new Map();
    for (const it of list) {
      const key = `${Math.floor(it.x / TILE)},${Math.floor(it.z / TILE)}`;
      if (!tiles.has(key)) tiles.set(key, []);
      tiles.get(key).push(it);
    }
    for (const items of tiles.values()) {
      for (const [mat, back] of [[crownMats[v], 0], [trunkMats[v], 0.4]]) {
        const m = new THREE.InstancedMesh(geo, mat, items.length);
        items.forEach((it, j) => {
          const dx = TOWN.x - it.x, dz = TOWN.z - it.z, l = Math.hypot(dx, dz);
          q.setFromAxisAngle(up, Math.atan2(dx, dz));
          m.setMatrixAt(j, new THREE.Matrix4().compose(new THREE.Vector3(it.x - (dx / l) * back, it.y, it.z - (dz / l) * back), q, new THREE.Vector3(it.w, it.h, 1)));
          m.setColorAt(j, c.setRGB(it.c[0], it.c[1], 0));
        });
        m.castShadow = false;
        m.receiveShadow = true;
        m.computeBoundingSphere();
        scene.add(m);
      }
      count += items.length;
    }
  });
  return { cards: count, villages: made };
}
