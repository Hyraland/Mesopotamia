// The weavers' house of the temple (é-uš-bar): a walled workshop on the temple's
// terrace, in its corner between the stair's wall and the ziggurat, its gate on the processional way. In the
// temples and palaces of Ur's kings (some 2100 to 2000 BC) such workshops kept hundreds, even thousands, of women
// weaving the temple's wool; the scribes counted out to them each month barley, oil and wool, and took in the
// cloth. Here the women have just stepped away.
//
// Round a court of trodden earth: along its north side a row of rooms under a flat roof (the wool store, its bales;
// the cloth store, folded cloth with clay tags on benches, sealed jars; the overseer's room, tablets, a balance and
// its stone weights), fleeces drying on the roof; along its west side ground looms, half-woven, each under a
// striped cloth on poles, along its east side a shed of reed matting on palm-log posts over two more and a
// corner for spinning (fleece in baskets, spindles, carded wool); by
// the gate, on one side the basin where the wool is washed, on the other the dye vats (madder red, yellow, dark)
// over a fire, and a rack of dyed skeins; across the court lines of finished cloth drying, moving in the wind.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { JAR } from './houseKit.js';
import { clayTablet } from './buildingDetails.js';
import { PRECINCT, WORKSHOP_FRAME as WORKSHOP } from './hillPlan.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

// The ground loom (models/ground_loom.glb: four stakes, the beams lashed to
// them, the warp, heddle rod on its forks, shed stick, sword beater, comb, the cloth woven so far at one end), its
// parts merged by kind, once, before the town is built (loadLoom). In the model the warp runs along z, 2.26 wide
// and 3.86 from stake to stake, the woven end at -z, the floor at y 0. Only the loom and its lashings: its basket,
// yarn and fleece lie two metres out, where the next loom would be. 'cloth' and 'stripe': the woven cloth and the
// stripes in it, coloured per loom
const LOOM_KIND = { reed: 'straw', straw: 'straw', wood: 'wood', linen: 'linen', madder: 'madder', wool: 'linen', clay: 'clay', earth: 'earth' };
const LOOM_SIZE = { width: 2.26, length: 3.86 };
let LOOM = null;
export async function loadLoom(url = 'models/ground_loom.glb') {
  const gltf = await new GLTFLoader().loadAsync(url);
  gltf.scene.updateMatrixWorld(true);
  const byKind = new Map();
  gltf.scene.traverse((o) => {
    // (three drops the slashes from the names: "Loom / heddle rod" is Loom__heddle_rod)
    if (!o.isMesh || !(o.name.startsWith('Loom') || o.name.startsWith('Fibre_rope'))) return;
    const kind = o.name.includes('unfinished') ? 'cloth' : o.name.includes('woven_stripe') ? 'stripe' : LOOM_KIND[o.material?.name] ?? 'wood';
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (!byKind.has(kind)) byKind.set(kind, []);
    byKind.get(kind).push(g.index ? g.toNonIndexed() : g);
  });
  LOOM = new Map([...byKind].map(([k, geos]) => [k, mergeGeometries(geos)]));
}

// A ground loom (as in the house of the teacher and here). (cx, cz) its middle, y the floor; width across the warp,
// length along it, stake to stake (the model is scaled evenly to fit both); yaw turns it (0: the warp runs along z,
// the woven end at +z); woven: the cloth's colours (the second the ground, the next that differs the stripes).
// Without the model loaded, a plain one: two beams pegged out with the warp between them, the cloth so far at the
// near end, a shed stick, balls of yarn
export function groundLoom(kit, { cx, cz, y, width: W, length: L, yaw = 0, woven }) {
  const { get, box } = kit;
  if (LOOM) {
    const s = Math.min(W / LOOM_SIZE.width, L / LOOM_SIZE.length);
    // (the model's woven end is at -z: turned half round, it is at +z like the plain one's)
    const m = new THREE.Matrix4().compose(V(cx, y, cz), new THREE.Quaternion().setFromAxisAngle(Y_AXIS, yaw + Math.PI), V(s, s, s));
    const ground = woven[1] ?? 'linen', stripe = woven.find((k) => k !== ground) ?? 'madder';
    for (const [k, g] of LOOM) get(k === 'cloth' ? ground : k === 'stripe' ? stripe : k).add(g, m);
    return;
  }
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const at = (u, v) => [cx + u * c + v * s, cz - u * s + v * c];
  const put = (k, u, v, yy, sx, sy, sz, turn = 0) => { const [x, z] = at(u, v); box(k, x, yy, z, sx, sy, sz, yaw + turn); };
  const beam = new THREE.CylinderGeometry(0.045, 0.045, W + 0.3, 7).rotateZ(Math.PI / 2).deleteAttribute('uv');
  for (const v of [-L / 2, L / 2]) {
    const [x, z] = at(0, v);
    get('wood').add(beam, new THREE.Matrix4().compose(V(x, y + 0.08, z), new THREE.Quaternion().setFromAxisAngle(Y_AXIS, yaw), V(1, 1, 1)));
    for (const u of [-(W / 2 + 0.12), W / 2 + 0.12]) put('wood', u, v + Math.sign(v) * 0.08, y + 0.07, 0.05, 0.16, 0.05);
  }
  beam.dispose();
  for (let u = -W / 2 + 0.03; u < W / 2 - 0.02; u += 0.055) put('linen', u, -0.25, y + 0.1, 0.012, 0.008, L - 0.5);
  for (let k = 0; k < woven.length; k++) put(woven[k], 0, L / 2 - 0.45 + k * 0.1, y + 0.097, W, 0.025, 0.1);
  put('wood', 0, L / 2 - 0.62, y + 0.14, W + 0.2, 0.025, 0.06);
  put('wood', W / 2 + 0.35, 0, y + 0.02, 0.07, 0.03, 0.62, 0.2);
  const ball = new THREE.SphereGeometry(0.07, 8, 6).deleteAttribute('uv');
  for (const [k, du, dv] of [[woven[0], -0.3, 0.4], [woven[2] ?? 'linen', -0.25, 0.65], ['linen', -0.42, 0.58]]) {
    const [x, z] = at(-W / 2 + du, L / 2 - 1.0 + dv);
    get(k).add(ball, new THREE.Matrix4().makeTranslation(x, y + 0.07, z));
  }
  ball.dispose();
}

export function buildWorkshop(kit, { rng }) {
  const { get, box, cloth, paintedJar, pot, weave } = kit;
  const Y = PRECINCT.y;
  const { x0: X0, x1: X1, z0: Z0, z1: Z1 } = WORKSHOP, T = 0.5;   // the enclosure, outside to outside
  const ZR = 25.5, TR = 0.45;                             // the store row's front wall (its inner face)
  // (the enclosure's wall low, so that from the stair above one sees over it into the court)
  const H = 1.7, HR = 3.0;                                // the enclosure wall's height, the store row's
  const bx = (kind, x0, x1, y0, y1, z0, z1) => box(kind, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0);
  // a wall from a to b (along x or along z) of a height, with doorways [from, to] in it, a lintel over each
  const run = (kind, x0, x1, z0, z1, top, doors = [], head = 2.1) => {
    const alongX = x1 - x0 > z1 - z0, end = alongX ? x1 : z1;
    let s = alongX ? x0 : z0;
    for (const [d0, d1] of [...doors, [end, end]]) {
      if (d0 - s > 0.02) alongX ? bx(kind, s, d0, Y, top, z0, z1) : bx(kind, x0, x1, Y, top, s, d0);
      if (d1 > d0 && Y + head < top) alongX ? bx(kind, d0, d1, Y + head, top, z0, z1) : bx(kind, x0, x1, Y + head, top, d0, d1);
      s = d1;
    }
  };

  // ---- the walls ----
  // (the floor of the court and rooms: trodden earth, a hand over the terrace)
  bx('path', X0, X1, Y - 0.1, Y + 0.02, Z0, Z1);
  // (the enclosure: mud brick; the north side the store row's back wall, as high as the row)
  run('brick', X0, X1, Z0, Z0 + T, Y + HR);
  run('brick', X0, X0 + T, Z0 + T, ZR + TR, Y + HR);
  run('brick', X1 - T, X1, Z0 + T, ZR + TR, Y + HR);
  run('brick', X0, X0 + T, ZR + TR, Z1, Y + H);
  run('brick', X1 - T, X1, ZR + TR, Z1, Y + H);
  // (the gate on the processional way: a gap, two posts of palm log, a lintel; a threshold stone)
  const G0 = 27.6, G1 = 29.6;
  run('brick', X0 + T, X1 - T, Z1 - T, Z1, Y + H, [[G0, G1]], H);
  for (const x of [G0 + 0.12, G1 - 0.12]) get('wood').tube([V(x, Y, Z1 - T / 2), V(x, Y + 2.55, Z1 - T / 2)], [0.13, 0.12], 8);
  get('wood').tube([V(G0 - 0.4, Y + 2.62, Z1 - T / 2), V(G1 + 0.4, Y + 2.62, Z1 - T / 2)], [0.13, 0.13], 8);
  bx('stone', G0, G1, Y, Y + 0.06, Z1 - T - 0.05, Z1 + 0.05);
  // the store row: three rooms off the court, a flat roof; its front wall plastered, doors in it
  const R = [[X0 + T, 27.5], [27.95, 33.5], [33.95, X1 - T]];
  run('plaster', X0 + T, X1 - T, ZR, ZR + TR, Y + HR, [[24.0, 25.5], [30.0, 31.1], [35.6, 36.6]]);
  run('plaster', 27.5, 27.95, Z0 + T, ZR, Y + HR);
  run('plaster', 33.5, 33.95, Z0 + T, ZR, Y + HR);
  bx('plaster', X0, X1, Y + HR, Y + HR + 0.18, Z0, ZR + TR);
  bx('plaster', X0, X1, Y + HR + 0.18, Y + HR + 0.42, ZR + TR - 0.3, ZR + TR);   // (a low parapet along its front)
  // (palm logs under the roof, their ends out over the court)
  for (let x = X0 + 0.7; x < X1 - 0.5; x += 0.75) {
    get('wood').tube([V(x, Y + HR - 0.08, Z0 + 0.3), V(x, Y + HR - 0.08, ZR + TR + 0.3)], [0.075, 0.08], 6);
  }

  // ---- the store row's rooms ----
  // the wool store: bales of fleece stacked, loose fleeces, sacks
  {
    const bale = (x, y, z, k, s = 1) => {
      const g = new THREE.SphereGeometry(0.5, 12, 8).deleteAttribute('uv');
      get(k).add(g, new THREE.Matrix4().compose(V(x, y + 0.32 * s, z), new THREE.Quaternion().setFromAxisAngle(Y_AXIS, rng() * 0.6), V(1.5 * s, 0.68 * s, 1.0 * s)));
      g.dispose();
    };
    for (const [x, z, k] of [[22.2, 22.2, 'linen'], [23.7, 22.25, 'buff'], [25.2, 22.2, 'linen'], [26.7, 22.3, 'hair'], [22.2, 23.4, 'buff'], [26.6, 23.5, 'linen']]) bale(x, Y, z, k);
    for (const [x, z, k] of [[22.25, 22.2, 'linen'], [23.7, 22.25, 'linen'], [26.65, 22.3, 'buff']]) bale(x, Y + 0.62, z, k, 0.9);
    bale(22.4, Y, 24.75, 'linen', 0.7);
  }
  // the cloth store: benches along its walls, folded cloth on them in stacks, each with its clay tag; jars
  {
    bx('plaster', 28.0, 33.45, Y, Y + 0.55, Z0 + T, Z0 + T + 0.7);
    bx('plaster', 32.8, 33.45, Y, Y + 0.55, Z0 + T + 0.7, ZR - 0.3);
    const kinds = ['linen', 'linen', 'madder', 'saffron', 'buff', 'linen', 'hair', 'madder'];
    for (let x = 28.35; x < 33.1; x += 0.62) {
      let y = Y + 0.55;
      const n = 2 + Math.floor(rng() * 4);
      for (let k = 0; k < n; k++) {
        const h = 0.07 + rng() * 0.04;
        box(kinds[Math.floor(rng() * kinds.length)], x + (rng() - 0.5) * 0.04, y + h / 2, Z0 + T + 0.35, 0.5, h, 0.5, (rng() - 0.5) * 0.08);
        y += h;
      }
      box('mud', x + 0.2, y + 0.01, Z0 + T + 0.55, 0.06, 0.02, 0.04);
    }
    for (let z = Z0 + T + 1.0; z < ZR - 0.5; z += 0.62) {
      const h = 0.08 + rng() * 0.05;
      box(rng() < 0.5 ? 'linen' : 'madder', 33.12, Y + 0.55 + h / 2, z, 0.5, h, 0.5);
    }
    for (const [x, z, s] of [[28.6, 24.6, 0.9], [29.5, 24.7, 0.8]]) {
      get('buff').add(JAR, new THREE.Matrix4().compose(V(x, Y - 0.02, z), new THREE.Quaternion(), V(s, s, s)));
      box('mud', x, Y + 1.11 * s + 0.01, z, 0.34 * s, 0.07, 0.34 * s);
    }
  }
  // the overseer's room: a bench, tablets on it and in a basket (the month's wool, oil and barley for each woman),
  // a balance on its stand, stone weights in the shape of sleeping ducks
  {
    bx('plaster', 34.0, X1 - T, Y, Y + 0.5, Z0 + T, Z0 + T + 0.6);
    for (let x = 34.3; x < X1 - T - 0.15; x += 0.2) {
      const n = 1 + Math.floor(rng() * 3);
      for (let k = 0; k < n; k++) clayTablet(get, x, Y + 0.5 + k * 0.034, Z0 + T + 0.3 + (rng() - 0.5) * 0.1, 0.12, 0.17, (rng() - 0.5) * 0.1, { lines: k === n - 1 });
    }
    get('straw').add(new THREE.CylinderGeometry(0.25, 0.21, 0.32, 12).deleteAttribute('uv'), new THREE.Matrix4().makeTranslation(37.9, Y + 0.16, 24.7));
    const bx0 = 35.3, bz0 = 23.9;
    box('wood', bx0, Y + 0.55, bz0, 0.06, 1.1, 0.06);
    box('wood', bx0, Y + 0.08, bz0, 0.4, 0.16, 0.4);
    box('wood', bx0, Y + 1.08, bz0, 0.9, 0.04, 0.04);
    const pan = new THREE.CylinderGeometry(0.13, 0.09, 0.04, 12).deleteAttribute('uv');
    for (const s of [-0.42, 0.42]) {
      get('bronze').add(pan, new THREE.Matrix4().makeTranslation(bx0 + s, Y + 0.78, bz0));
      for (const d of [-0.08, 0.08]) get('straw').tube([V(bx0 + s, Y + 1.07, bz0), V(bx0 + s + d, Y + 0.8, bz0)], [0.004, 0.004], 3);
    }
    const duck = new THREE.SphereGeometry(0.06, 10, 6).deleteAttribute('uv');
    for (let k = 0; k < 5; k++) get('stone').add(duck, new THREE.Matrix4().compose(V(36.1 + k * 0.17, Y + 0.035, 23.7), new THREE.Quaternion(), V(1.5 - k * 0.15, 0.6 - k * 0.05, 1 - k * 0.1)));
  }
  // fleeces drying on the store row's roof
  {
    const g = new THREE.SphereGeometry(0.5, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).deleteAttribute('uv');
    for (let k = 0; k < 7; k++) {
      const x = 22.0 + k * 2.4 + rng() * 0.6, z = 22.4 + rng() * 2.0;
      get(['linen', 'buff', 'linen', 'hair'][k % 4]).add(g, new THREE.Matrix4().compose(V(x, Y + HR + 0.18, z), new THREE.Quaternion().setFromAxisAngle(Y_AXIS, rng() * 3), V(1.4, 0.12, 0.9)));
    }
    g.dispose();
  }

  // ---- the shed over the looms on the east side: reed matting on palm-log rafters, from the low
  // wall's top up to a beam on posts on the court's side ----
  const shed = (xw, xf, z0, z1) => {
    const dir = Math.sign(xf - xw), yw = Y + H + 0.05, yf = Y + 2.35;
    for (let z = z0 + 0.25; z <= z1 - 0.2; z += (z1 - z0 - 0.45) / 4) get('bark').tube([V(xf, Y, z), V(xf, yf - 0.1, z)], [0.12, 0.11], 7);
    get('wood').tube([V(xf, yf - 0.05, z0), V(xf, yf - 0.05, z1)], [0.1, 0.1], 7);
    for (let z = z0 + 0.2; z < z1; z += 0.7) get('wood').tube([V(xw - dir * 0.2, yw - 0.06, z), V(xf + dir * 0.25, yf + 0.02, z)], [0.05, 0.05], 5);
    kit.reedMat((xw + xf) / 2, (yw + yf) / 2 + 0.07, (z0 + z1) / 2,
      Math.abs(xf - xw) + 0.45, z1 - z0 + 0.2, 0, (yf - yw) / (xf - xw));
  };
  shed(X1 - T, 34.4, ZR + TR + 0.3, Z1 - T - 0.3);
  // (on the west side, the one the stair looks into, the looms have instead each a shade on four poles: a striped
  // cloth stretched over the middle one, sagging, lifting in the wind; over the other two reed mats)
  const shade = (x0, x1, z0, z1, stripes) => {
    const y = Y + 2.2;
    for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) box('wood', x, (Y + y) / 2, z, 0.06, y - Y, 0.06);
    cloth((i, j) => {
      const u = j / 5, v = i / 3;
      return V(x0 + (x1 - x0) * u, y - 0.18 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v) - 0.05 * Math.sin(Math.PI * u), z0 + (z1 - z0) * v);
    }, 3, 5, stripes, true, V(0, 1, 0), (i, j) => [0, 0.12 * Math.sin((Math.PI * i) / 3) * Math.sin((Math.PI * j) / 5), 0, 2]);
  };
  const reedShade = (x0, x1, z0, z1) => {
    const y = Y + 2.2;
    for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) get('wood').tube([V(x, Y, z), V(x, y - 0.06, z)], [0.055, 0.045], 6);
    // (a little fall towards the court, for the rain)
    kit.reedMat((x0 + x1) / 2, y, (z0 + z1) / 2, x1 - x0 + 0.3, z1 - z0 + 0.3, 0, -0.04);
  };
  reedShade(21.8, 25.4, 26.95, 29.45);
  shade(21.8, 25.4, 30.35, 32.85, ['saffron', 'linen', 'saffron', 'madder', 'saffron']);
  reedShade(21.8, 25.4, 33.75, 36.25);
  // under them the looms (the model's, warp from the wall out towards the court), a mat for each weaver at the
  // woven end
  const loomAt = (cx, cz, yaw, woven) => {
    const L = 2.9;
    groundLoom(kit, { cx, cz, y: Y + 0.02, width: 1.75, length: L, yaw, woven });
    const c = Math.cos(yaw), s = Math.sin(yaw);
    box('straw', cx + s * (L / 2 + 0.4), Y + 0.035, cz + c * (L / 2 + 0.4), 0.75, 0.02, 0.5, yaw);
  };
  loomAt(23.15, 28.2, Math.PI / 2, ['linen', 'linen', 'madder', 'linen', 'linen']);
  loomAt(23.15, 31.6, Math.PI / 2, ['saffron', 'madder', 'saffron', 'madder', 'saffron']);
  loomAt(23.15, 35.0, Math.PI / 2, ['buff', 'hair', 'buff', 'hair', 'buff']);
  loomAt(36.8, 28.2, -Math.PI / 2, ['madder', 'linen', 'madder', 'linen', 'madder']);
  loomAt(36.8, 31.6, -Math.PI / 2, ['linen', 'linen', 'linen', 'saffron', 'linen']);
  // (the spinning corner under the east shed: fleece in baskets, carded wool in a heap, spindles with their whorls
  // and thread, mats to sit on)
  {
    const basket = (x, z, r = 0.3, h = 0.4) => get('straw').add(new THREE.CylinderGeometry(r, r * 0.85, h, 12).deleteAttribute('uv'), new THREE.Matrix4().makeTranslation(x, Y + h / 2, z));
    basket(37.9, 34.2);
    basket(37.85, 35.0, 0.26, 0.34);
    basket(36.2, 38.9, 0.28, 0.36);
    const fluff = new THREE.SphereGeometry(0.25, 9, 6).deleteAttribute('uv');
    for (const [x, z, k] of [[37.9, 34.2, 'linen'], [37.85, 35.0, 'buff'], [36.2, 38.9, 'linen']]) get(k).add(fluff, new THREE.Matrix4().compose(V(x, Y + 0.42, z), new THREE.Quaternion(), V(1, 0.5, 1)));
    get('linen').add(fluff, new THREE.Matrix4().compose(V(36.9, Y + 0.12, 36.6), new THREE.Quaternion(), V(2.2, 0.55, 1.6)));
    for (const [x, z] of [[35.6, 35.2], [35.7, 37.6]]) box('straw', x, Y + 0.035, z, 0.7, 0.02, 0.6);
    const whorl = new THREE.CylinderGeometry(0.035, 0.035, 0.015, 10).deleteAttribute('uv');
    for (const [x, z, a] of [[35.9, 35.6, 0.4], [36.0, 37.9, 2.1], [37.3, 37.8, 1.2]]) {
      const d = V(Math.cos(a) * 0.15, 0, Math.sin(a) * 0.15);
      get('wood').tube([V(x - d.x, Y + 0.03, z - d.z), V(x + d.x, Y + 0.03, z + d.z)], [0.008, 0.008], 4);
      get('clay').add(whorl, new THREE.Matrix4().compose(V(x - d.x * 0.6, Y + 0.035, z - d.z * 0.6), new THREE.Quaternion().setFromAxisAngle(V(-d.z, 0, d.x).normalize(), Math.PI / 2), V(1, 1, 1)));
      get('linen').add(new THREE.SphereGeometry(0.03, 6, 4).deleteAttribute('uv'), new THREE.Matrix4().makeTranslation(x + d.x * 0.3, Y + 0.035, z + d.z * 0.3));
    }
  }

  // ---- by the gate: the washing basin (west), the dye vats over their fire and the rack of dyed skeins (east) ----
  {
    const x0 = 25.9, x1 = 27.3, z0 = 36.3, z1 = 38.9;
    for (const [a, b, c, d] of [[x0, x1, z0, z0 + 0.15], [x0, x1, z1 - 0.15, z1], [x0, x0 + 0.15, z0, z1], [x1 - 0.15, x1, z0, z1]]) bx('firedbrick', a, b, Y, Y + 0.45, c, d);
    bx('dark', x0 + 0.15, x1 - 0.15, Y, Y + 0.33, z0 + 0.15, z1 - 0.15);
    const fleece = new THREE.SphereGeometry(0.3, 9, 6).deleteAttribute('uv');
    for (const [x, z] of [[27.0, 35.7], [26.4, 35.6], [26.7, 36.0]]) get('linen').add(fleece, new THREE.Matrix4().compose(V(x, Y + 0.08, z), new THREE.Quaternion(), V(1.2, 0.45, 1)));
    for (const [x, z, s] of [[25.95, 39.6, 0.75], [26.7, 39.65, 0.65]]) get('clay').add(JAR, new THREE.Matrix4().compose(V(x, Y - 0.02, z), new THREE.Quaternion(), V(s, s, s)));
  }
  {
    // (three vats on a low brick bench, each its colour; a fire under the big pot beside them; madder roots in a
    // heap, firewood, the stirring stick)
    bx('firedbrick', 30.6, 34.1, Y, Y + 0.25, 38.1, 39.5);
    const vat = new THREE.CylinderGeometry(0.42, 0.36, 0.7, 16, 1, true).deleteAttribute('uv');
    const top = new THREE.CircleGeometry(0.37, 16).rotateX(-Math.PI / 2).deleteAttribute('uv');
    for (const [x, k] of [[31.2, 'madder'], [32.35, 'saffron'], [33.5, 'hair']]) {
      get('clay').add(vat, new THREE.Matrix4().makeTranslation(x, Y + 0.6, 38.8), { flat: true });
      get(k).add(top, new THREE.Matrix4().makeTranslation(x, Y + 0.85, 38.8));
    }
    get('wood').tube([V(32.0, Y + 0.95, 38.6), V(32.6, Y + 0.3, 39.1)], [0.02, 0.02], 4);
    for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; box('stone', 33.85 + Math.cos(a) * 0.3, Y + 0.1, 37.0 + Math.sin(a) * 0.3, 0.2, 0.2, 0.18, a); }
    bx('dark', 33.55, 34.15, Y + 0.02, Y + 0.03, 36.7, 37.3);
    get('clay').add(new THREE.SphereGeometry(0.38, 12, 8).deleteAttribute('uv'), new THREE.Matrix4().compose(V(33.85, Y + 0.48, 37.0), new THREE.Quaternion(), V(1, 0.75, 1)));
    for (let j = 0; j < 5; j++) get('wood').tube([V(35.4, Y + 0.06 + (j > 2 ? 0.11 : 0), 36.6 + (j % 3) * 0.12), V(36.3, Y + 0.06 + (j > 2 ? 0.11 : 0), 36.6 + (j % 3) * 0.12)], [0.05, 0.045], 5);
    const root = new THREE.CylinderGeometry(0.015, 0.012, 0.3, 4).rotateZ(Math.PI / 2).deleteAttribute('uv');
    for (let k = 0; k < 18; k++) get('madder').add(root, new THREE.Matrix4().compose(V(30.9 + rng() * 0.5, Y + 0.03 + rng() * 0.08, 37.3 + rng() * 0.4), new THREE.Quaternion().setFromAxisAngle(Y_AXIS, rng() * 3), V(1, 1, 1)));
    // (the rack: a pole on two posts, skeins of new-dyed wool hung over it; behind the vats against the enclosure
    // wall, high, so the skeins show over the wall to the steps outside)
    const rz = 39.72, ra = 30.4, rb = 33.6, ry = Y + 2.75;
    for (const x of [ra, rb]) box('wood', x, (Y + ry) / 2, rz, 0.07, ry - Y, 0.07);
    get('wood').tube([V(ra - 0.1, ry, rz), V(rb + 0.1, ry, rz)], [0.03, 0.03], 5);
    const colours = ['madder', 'madder', 'saffron', 'saffron', 'hair', 'madder', 'linen', 'saffron', 'buff', 'madder'];
    for (let k = 0; k < colours.length; k++) {
      const x = ra + 0.25 + k * ((rb - ra - 0.5) / (colours.length - 1)), L = 0.5 + rng() * 0.2;
      for (const side of [-1, 1]) {
        cloth((i, j) => V(x + (j - 0.5) * 0.11, ry - 0.02 - (i / 2) * L, rz + side * (0.035 + i * 0.01)), 2, 1, [colours[k]], true, V(0, 0, side),
          (i) => [0, 0, side * (i / 2) * L, 1]);
      }
    }
  }

  // ---- across the court: two lines of finished cloth drying, on poles ----
  for (const [lz, xa, xb] of [[29.6, 26.6, 33.4], [33.0, 26.6, 33.4]]) {
    const lh = Y + 2.15;
    for (const x of [xa, xb]) box('wood', x, (Y + lh) / 2, lz, 0.08, lh - Y, 0.08);
    get('wood').tube([V(xa, lh - 0.04, lz), V((xa + xb) / 2, lh - 0.14, lz), V(xb, lh - 0.04, lz)], [0.013, 0.013, 0.013], 4);
    let x = xa + 0.2;
    while (x < xb - 0.8) {
      const cw = 0.7 + rng() * 0.6, hang = 0.9 + rng() * 0.5, r = rng();
      const stripes = r < 0.3 ? ['linen'] : r < 0.5 ? ['madder'] : r < 0.6 ? ['saffron'] : weave(rng);
      const w = Math.min(cw, xb - 0.15 - x);
      cloth((i, j) => {
        const xx = x + (j / 3) * w, sag = 0.1 * (1 - (2 * (xx - (xa + xb) / 2) / (xb - xa)) ** 2);
        return V(xx, lh - 0.05 - sag - (i / 3) * hang, lz + 0.02 * Math.sin(i + j));
      }, 3, 3, stripes, true, V(0, 0, 1), (i) => [0, 0, (i / 3) * hang, 1]);
      x += w + 0.12;
    }
  }
  // (in the court's middle a mat where the fleece is sorted, white, fawn and dark in heaps; a jar of water)
  {
    box('straw', 30.0, Y + 0.035, 34.9, 1.8, 0.02, 1.2);
    const heap = new THREE.SphereGeometry(0.3, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2).deleteAttribute('uv');
    for (const [x, z, k] of [[29.5, 34.7, 'linen'], [30.15, 35.15, 'buff'], [30.6, 34.6, 'hair']]) get(k).add(heap, new THREE.Matrix4().compose(V(x, Y + 0.04, z), new THREE.Quaternion(), V(1.2, 0.7, 1)));
    paintedJar(26.2, Y - 0.03, 26.6, 1.0, 0.6, 1);
    pot(38.2, Y + 0.0, 26.6, 1.0);
  }

  // ---- the gate's face, the one seen from the steps ----
  // either side of the gate a panel of cone mosaic, lozenges, as on the temple's own walls
  for (const cx of [26.4, 30.8]) kit.conePanel(cx, Y + 0.95, Z1, V(0, 0, 1), V(1, 0, 0), 1.4, 1.2, 1);
  // before its posts two ring-posts of reed, Inanna's sign: as on the Uruk vase and the seals, where they stand at
  // the doors of her byres and folds, whose wool is woven here. A bundle of reeds, each its own, bound round with
  // red cord at intervals, its top bent over into a ring; past the ring the reeds' ends let go, their leaves hanging
  // down as a streamer that moves in the wind. The rings turned away from the gate
  for (const [px, s] of [[G0 - 0.25, -1], [G1 + 0.25, 1]]) {
    const pz = Z1 + 0.3, yT = Y + 3.2, r = 0.3, N = 16;
    // (the bundle's line: up the stem, then over and round the ring, in the face of the gate; its girth at each)
    const path = [], girth = [];
    for (let k = 0; k <= 6; k++) { path.push([px, Y - 0.5 + (k / 6) * (yT - Y + 0.5)]); girth.push(0.125 - 0.025 * (k / 6)); }
    for (let k = 1; k <= 26; k++) {
      const f = Math.PI - (k / 26) * Math.PI * 1.75;
      path.push([px + s * r * (1 + Math.cos(f)), yT + r * Math.sin(f)]);
      girth.push(0.1 - 0.035 * (k / 26));
    }
    // (along it, the way it runs and the way across it in the gate's face)
    const tan = path.map((_, i) => { const a = path[Math.max(i - 1, 0)], b = path[Math.min(i + 1, path.length - 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; });
    const at = (i, u, w) => V(path[i][0] - tan[i][1] * u, path[i][1] + tan[i][0] * u, pz + w);
    // the reeds, laid in the bundle as the seeds in a sunflower's head, each wandering a little
    for (let k = 0; k < N; k++) {
      const rr = Math.sqrt((k + 0.5) / N), a = k * 2.39996, pts = [], radii = [];
      for (let i = 0; i < path.length; i++) {
        const R = girth[i] * (1 + 0.07 * Math.sin(i * 0.9 + k * 1.7));
        pts.push(at(i, Math.cos(a) * rr * R, Math.sin(a) * rr * R));
        radii.push(0.023 - 0.006 * (i / path.length));
      }
      get('straw').tube(pts, radii, 5);
    }
    // the bindings: red cord wound three times round, at intervals up the stem, where the ring leaves it, and at
    // the ring's close
    for (const i of [1, 2, 4, 6, 8, path.length - 1]) {
      const R = girth[i] + 0.016, pts = [];
      for (let j = 0; j <= 36; j++) {
        const g = (j / 12) * Math.PI * 2, along = (j / 36 - 0.5) * 0.09;
        const c = at(i, Math.cos(g) * R, Math.sin(g) * R);
        pts.push(c.add(V(tan[i][0] * along, tan[i][1] * along, 0)));
      }
      get('madder').tube(pts, pts.map(() => 0.013), 4);
    }
    // the streamer: the reeds' leaves, let go past the ring's close, hanging down from it in long narrow blades,
    // curling out a little, each its own twist; free to move in the wind
    const [ex, ey] = path.at(-1);
    for (let m = 0; m < 6; m++) {
      const L = 1.1 + ((m * 37) % 5) * 0.12, w = 0.07 + (m % 3) * 0.015, tw = (m - 2.5) * 0.25, dz = (m - 2.5) * 0.04, out = 0.45 + m * 0.09;
      cloth((i, j) => {
        const v = i / 8, a2 = tw * v + 0.15;
        return V(ex + s * (0.06 + out * Math.sin((v * Math.PI) / 2)) + (j - 0.5) * w * Math.cos(a2), ey - 0.03 - v * L * (0.75 + 0.25 * v), pz + dz * (1 + 2 * v) + (j - 0.5) * w * Math.sin(a2));
      }, 8, 1, ['straw'], true, V(0, 0, 1), (i) => { const Li = (i / 8) * L; return [s * 0.35 * Li, 0, 0.5 * Li, 1]; });
    }
  }
  // cloth just off the looms thrown over the enclosure wall either side of the gate to air, woven in the
  // workshop's patterns, hanging down its face to the steps (clear of the jars by the basin; the skeins' rack
  // stands over the wall between)
  for (const [cx, rw] of [[22.6, 1.6], [24.5, 1.3], [35.2, 1.5], [37.3, 1.4]]) {
    kit.rugOver((u) => V(cx + u, Y, Z1), V(0, 0, 1), Y, { ph: H, p: T, rw, drop: 1.0 + rng() * 0.35 });
  }
}
