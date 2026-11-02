// The temple of Enki at the ziggurat's foot (é-abzu, "house of the deep waters"), and the
// Abzu in front of it, the pool of sweet water. The daily rites were here, not up on the ziggurat: twice a day the
// god's meal set before him, hymns sung to the lyre and the harp "to calm his heart"; in bad times (a temple pulled
// down to be rebuilt, an eclipse of the moon) the lamentation priests' songs to the great bronze drum. At Eridu, in
// the oldest of its temples, the floors were found thick with fish bones and ash: fish offered to the god of the
// sweet waters.
//
// Laid out as the temples of the time are (Tell Harmal, Ishchali, Ur): a gateway between two towers, a court, then
// across the axis a broad antecella and the broad cella behind it, the god in a niche in its far wall, raised on a
// dais, seen straight through the doors from the gate. Its walls whitewashed mud brick, their faces stepped in
// buttresses and recesses; flat roofs on palm logs over the rooms round the court, the antecella and the cella.
// Here the gate is west, towards the precinct's gateway and the pool, and the cella east, towards the ziggurat.
//
// In front of the gate a pair of terracotta lions, snarling, as the pair that stood at the temple door at Tell
// Harmal (about 1800 BC): the author's model of one (loadStatues). In the court: an altar with the day's offering
// (fish, bread, dates), a basin for washing, a stele, the great drum (lilis) on its stand. In the cella: benches
// along its walls with the worshippers' small statues of gypsum, hands clasped, set there to pray for them; incense
// stands; the offering table; a lyre and a harp by the dais; the god seated in his niche, the streams of the sweet waters flowing from his shoulders, the
// curtain before him drawn back, the afternoon sun on him through a light well. The rooms off the court: the
// temple's vessels, its cloth.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { JAR } from './houseKit.js';
import { Builder } from './geo.js';
import { lightMat } from './shade.js';
import { PRECINCT, TEMPLE_HOUSE as TH, ABZU, STOREHOUSE as SH, KITCHEN as KI } from './hillPlan.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const SPHERE = new THREE.SphereGeometry(1, 14, 10).deleteAttribute('uv');
const CYL = new THREE.CylinderGeometry(1, 1, 1, 14).deleteAttribute('uv');
const HALF = new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).deleteAttribute('uv');
const TORUS = new THREE.TorusGeometry(1, 0.18, 6, 18).rotateX(Math.PI / 2).deleteAttribute('uv');
const CONE = new THREE.ConeGeometry(1, 1, 12).deleteAttribute('uv');
const BOX = new THREE.BoxGeometry(1, 1, 1).deleteAttribute('uv');
const DOME = new THREE.SphereGeometry(1, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2).deleteAttribute('uv');

// The statues made from models, loaded once before the town is built (hillScene.js), each as it stands, facing +z,
// its footprint's middle at the origin, at y 0 (tools/prepare_statue.py: decimated, its own colours dropped):
// - the gate's lion: the author's, made with Tripo AI after the Tell Harmal pair; 0.98 long (60k triangles)
// - Gudea of Lagash seated, hands clasped (some 2130 BC: a king's statue set before the god to pray for him, kept
//   in the temple for centuries after): "Gudea reconstruction" by Daniel Pett, a conjectured join of two parts of
//   statues in the British Museum, https://sketchfab.com/3d-models/gudea-reconstruction-56e13a61114f4a2dac76f87d5257e984,
//   CC BY 4.0 (40k triangles); 12.14 units high
const STATUES = { lion: null, gudea: null };
export async function loadStatues() {
  const loader = new GLTFLoader();
  await Promise.all(Object.keys(STATUES).map(async (name) => {
    const gltf = await loader.loadAsync(`models/${name}.glb?${Date.now()}`);
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      if (!o.isMesh || STATUES[name]) return;
      const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
      for (const a of Object.keys(g.attributes)) if (a !== 'position' && a !== 'normal') g.deleteAttribute(a);
      STATUES[name] = g;
    });
  }));
}

export function buildTemple(kit, { rng, scene }) {
  const { get, box } = kit;
  const Y = PRECINCT.y, T = 1.2, H = 6.6, ROOF = 5.6, AX = TH.axis;
  const { x0: X0, x1: X1, z0: Z0, z1: Z1 } = TH;
  const bx = (kind, x0, x1, y0, y1, z0, z1) => box(kind, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0);
  // a piece of geometry under a transform: at p, turned yaw about the upright, scaled s (a vector)
  const put = (kind, geo, p, s, yaw = 0, q = null) => get(kind).add(geo, new THREE.Matrix4().compose(p,
    q ?? new THREE.Quaternion().setFromAxisAngle(UP, yaw), s));
  const tube = (kind, pts, r, seg = 7) => get(kind).tube(pts, Array.isArray(r) ? r : pts.map(() => r), seg);
  // the white walls' colours: at their foot a dado of bitumen, black, against the damp
  // and the splashing; round their top a band of red ochre. The dado wraps a wall, a pier, a tower at the ground, the
  // band its top: each a little proud of its faces
  const DADO = 0.6, BAND = 0.3, PR = 0.025;
  const colours = (x0, x1, z0, z1, top, { dado = true, band = true } = {}) => {
    if (dado) bx('dark', x0 - PR, x1 + PR, Y, Y + DADO, z0 - PR, z1 + PR);
    if (band) bx('redwash', x0 - PR, x1 + PR, top - BAND, top + 0.004, z0 - PR, z1 + PR);
  };
  // a wall along x (alongX) or along z, from a to b, c0..c1 thick, top high; doorways [d0, d1, head]: a lintel of
  // wall over each, up to the top. (Whitewashed ones with their dado, and their band if they rise to the parapet)
  const run = (kind, alongX, a, b, c0, c1, top, doors = []) => {
    const coloured = kind === 'whitewash', XZ = (u0, u1) => (alongX ? [u0, u1, c0, c1] : [c0, c1, u0, u1]);
    let s = a;
    for (const [d0, d1, head] of [...doors, [b, b, 0]]) {
      if (d0 - s > 0.02) {
        alongX ? bx(kind, s, d0, Y, Y + top, c0, c1) : bx(kind, c0, c1, Y, Y + top, s, d0);
        if (coloured) colours(...XZ(s, d0), 0, { band: false });
      }
      if (d1 > d0) alongX ? bx(kind, d0, d1, Y + head, Y + top, c0, c1) : bx(kind, c0, c1, Y + head, Y + top, d0, d1);
      s = d1;
    }
    if (coloured && top === H) colours(...XZ(a, b), Y + top, { dado: false });
  };

  // ---- the walls ----
  const CX1 = 51, AN0 = 52.2, AN1 = 55.6, CE0 = 56.8, CE1 = X1 - 2.4;   // court's east end; antecella; cella
  const NR = 68.8, SR = 79.2;                                         // the side ranges' walls on the court
  // (the gate in the west wall; the east wall double, its inner leaf opened for the god's niche)
  run('whitewash', true, X0, X1, Z0, Z0 + T, H);
  run('whitewash', true, X0, X1, Z1 - T, Z1, H);
  run('whitewash', false, Z0 + T, Z1 - T, X0, X0 + T, H, [[AX - 1.2, AX + 1.2, 3.8]]);
  run('whitewash', false, Z0 + T, Z1 - T, X1 - 1.2, X1, H);
  run('whitewash', false, Z0 + T, Z1 - T, CE1, X1 - 1.2, H, [[AX - 1.3, AX + 1.3, 4.2]]);
  // (the rooms either side of the court, two each, their doors on it)
  run('whitewash', true, X0 + T, CX1, NR, NR + 0.6, H, [[40.4, 41.5, 2.2], [46.6, 47.7, 2.2]]);
  run('whitewash', true, X0 + T, CX1, SR - 0.6, SR, H, [[40.4, 41.5, 2.2], [46.6, 47.7, 2.2]]);
  // (walls between two roofed rooms go only to the roof: no parapet on them, nor a shadow over the light well)
  run('whitewash', false, Z0 + T, NR, 43.75, 44.25, ROOF + 0.3);
  run('whitewash', false, SR, Z1 - T, 43.75, 44.25, ROOF + 0.3);
  // (the court's east wall, the antecella's door in it; the cella's wall and door)
  run('whitewash', false, Z0 + T, Z1 - T, CX1, AN0, H, [[AX - 1.0, AX + 1.0, 3.2]]);
  run('whitewash', false, Z0 + T, Z1 - T, AN1, CE0, ROOF + 0.3, [[AX - 1.0, AX + 1.0, 3.2]]);
  // the faces outside stepped in buttresses and recesses, the length of every wall, to the parapet's top
  const pier = (x0, x1, z0, z1) => { bx('whitewash', x0, x1, Y, Y + H - 0.04, z0, z1); colours(x0, x1, z0, z1, Y + H - 0.035); };
  for (let x = X0 + 1.1; x < X1 - 0.6; x += 2.2) {
    pier(x - 0.4, x + 0.4, Z0 - 0.3, Z0 + 0.05);
    pier(x - 0.4, x + 0.4, Z1 - 0.05, Z1 + 0.3);
  }
  for (let z = Z0 + 1.1; z < Z1 - 0.6; z += 2.2) {
    pier(X1 - 0.05, X1 + 0.3, z - 0.4, z + 0.4);
    if (Math.abs(z - AX) > 4.6) pier(X0 - 0.3, X0 + 0.05, z - 0.4, z + 0.4);
  }
  // the gate: two towers out from the west wall, their tops stepped; palm logs over the way through, a wall over them
  const TW = 3.0, TX0 = X0 - 1.4, TOP = Y + 8.2;
  for (const s of [-1, 1]) {
    const za = AX + s * 1.2, zb = AX + s * (1.2 + TW), z0 = Math.min(za, zb), z1 = Math.max(za, zb);
    bx('whitewash', TX0, X0 + T, Y, TOP, z0, z1);
    colours(TX0, X0 + T, z0, z1, TOP);
    let y = TOP, inset = 0;
    for (const hh of [0.32, 0.28, 0.26]) {
      inset += 0.28;
      bx('whitewash', TX0 + inset, X0 + T - inset, y, y + hh, z0 + inset, z1 - inset);
      y += hh;
    }
  }
  for (const x of [TX0 + 0.35, TX0 + 1.1, X0 + 0.2, X0 + 0.9]) tube('wood', [V(x, Y + 3.95, AX - 1.6), V(x, Y + 3.95, AX + 1.6)], 0.15);
  bx('whitewash', TX0, X0 + T, Y + 4.1, Y + H + 0.6, AX - 1.2, AX + 1.2);
  colours(TX0, X0 + T, AX - 1.2, AX + 1.2, Y + H + 0.6, { dado: false });
  bx('stone', TX0, X0 + T, Y, Y + 0.08, AX - 1.2, AX + 1.2);
  // (its doors, of wood, swung open against the way's sides)
  for (const s of [-1, 1]) bx('wood', X0 - 0.3, X0 + 0.95, Y + 0.05, Y + 3.6, AX + s * 1.15 - 0.05, AX + s * 1.15 + 0.05);

  // ---- floors and roofs ----
  bx('firedbrick', X0 + T, CX1, Y - 0.1, Y + 0.06, NR + 0.6, SR - 0.6);   // the court, paved
  bx('plaster', X0 + T, X1 - 1.2, Y - 0.1, Y + 0.04, Z0 + T, NR);
  bx('plaster', X0 + T, X1 - 1.2, Y - 0.1, Y + 0.04, SR, Z1 - T);
  bx('plaster', CX1, X1 - 1.2, Y - 0.1, Y + 0.04, NR, SR);
  // (the roofs, a slab on palm logs, the walls going on up round them as parapets; the court open)
  const roof = (x0, x1, z0, z1, logsAlongX) => {
    bx('plaster', x0, x1, Y + ROOF, Y + ROOF + 0.3, z0, z1);
    if (logsAlongX) for (let z = z0 + 0.3; z < z1 - 0.2; z += 0.62) tube('wood', [V(x0, Y + ROOF - 0.09, z), V(x1, Y + ROOF - 0.09, z)], 0.09, 6);
    else for (let x = x0 + 0.3; x < x1 - 0.2; x += 0.62) tube('wood', [V(x, Y + ROOF - 0.09, z0), V(x, Y + ROOF - 0.09, z1)], 0.09, 6);
  };
  roof(X0 + T, CX1, Z0 + T, NR, false);
  roof(X0 + T, CX1, SR, Z1 - T, false);
  roof(AN0, AN1, Z0 + T, Z1 - T, true);
  // (a light well left open in the cella's roof at its west end, placed so that the afternoon sun (from the
  // west-south-west, 34° up) comes down through it onto the god's crown and face in his niche, the rest of the room
  // in its shade)
  const LW = { x0: CE0, x1: 58.4, z0: AX - 0.4, z1: AX + 2.8 };
  roof(LW.x1, X1 - 1.2, Z0 + T, Z1 - T, true);
  roof(CE0, LW.x1, Z0 + T, LW.z0, false);
  roof(CE0, LW.x1, LW.z1, Z1 - T, false);

  // ---- before the gate: the lions, a paving to the way ----
  bx('firedbrick', 30.2, TX0, Y - 0.1, Y + 0.05, 66.0, 82.0);
  bx('firedbrick', 30.2, 33.2, Y - 0.1, Y + 0.05, 61.6, 66.0);
  // (each on a plinth of fired brick, facing out to whoever comes, twice the model's size: some 1.6 m high)
  for (const s of [-1, 1]) {
    const lx = TX0 - 1.15, lz = AX + s * 2.45, S = 2.1;
    bx('firedbrick', lx - 1.25, lx + 1.25, Y - 0.1, Y + 0.25, lz - 0.62, lz + 0.62);
    if (STATUES.lion) put('clay', STATUES.lion, V(lx, Y + 0.25, lz), V(S, S, S), -Math.PI / 2);
  }

  // ---- the court ----
  // the altar on the axis, before the antecella's door, plastered white on a stepped base of fired brick: the day's
  // offering on it
  bx('firedbrick', 47.2, 49.2, Y, Y + 0.14, AX - 1.2, AX + 1.2);
  bx('firedbrick', 47.45, 48.95, Y + 0.14, Y + 0.26, AX - 0.98, AX + 0.98);
  bx('whitewash', 47.7, 48.7, Y + 0.26, Y + 1.0, AX - 0.75, AX + 0.75);
  bx('whitewash', 47.6, 48.8, Y + 1.0, Y + 1.08, AX - 0.85, AX + 0.85);
  offering(put, bx, 48.2, Y + 1.08, AX, rng, Y + 0.26);
  // the basin for washing, by the gate
  bx('firedbrick', 38.2, 40.0, Y, Y + 0.55, 70.0, 71.4);
  bx('dark', 38.4, 39.8, Y + 0.3, Y + 0.56, 70.2, 71.2);
  // the stele: a slab of dark stone, its top rounded, its face to the court in registers (the god, the king before
  // him; the building of the temple)
  bx('stone', 49.5, 49.8, Y, Y + 1.9, 76.6, 77.6);
  put('stone', CYL, V(49.65, Y + 1.9, 77.1), V(0.5, 0.3, 0.5), 0, new THREE.Quaternion().setFromAxisAngle(V(0, 0, 1), Math.PI / 2));
  for (const y of [0.55, 1.0, 1.45]) bx('dark', 49.46, 49.5, Y + y, Y + y + 0.035, 76.7, 77.5);
  bx('firedbrick', 49.2, 50.1, Y, Y + 0.12, 76.4, 77.8);
  // Gudea's statue of dark polished stone, seated on its pedestal on the court's south side by the stele, facing
  // east to the god through the doors (1.1 m high, as his seated statues are)
  bx('firedbrick', 44.8, 46.2, Y, Y + 0.5, 76.7, 78.1);
  if (STATUES.gudea) put('dark', STATUES.gudea, V(45.5, Y + 0.5, 77.4), V(1.1 / 12.14, 1.1 / 12.14, 1.1 / 12.14), Math.PI / 2);
  // the great drum (lilis): a bronze kettle, its head of hide, on a stand of wood; its beater on it
  {
    const x = 49.3, z = 70.7, r = 0.58, top = Y + 0.95;
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + 0.4;
      tube('wood', [V(x + Math.cos(a) * 0.62, Y, z + Math.sin(a) * 0.62), V(x + Math.cos(a) * 0.42, top - 0.25, z + Math.sin(a) * 0.42)], 0.04, 5);
    }
    put('wood', TORUS, V(x, top - 0.25, z), V(0.48, 0.3, 0.48));
    put('bronze', HALF, V(x, top, z), V(r, r * 0.95, r));
    put('bronze', TORUS, V(x, top, z), V(r + 0.01, 0.3, r + 0.01));
    put('buff', CYL, V(x, top + 0.01, z), V(r, 0.025, r));
    tube('wood', [V(x - 0.3, top + 0.06, z - 0.15), V(x + 0.35, top + 0.06, z + 0.2)], 0.025, 5);
    put('buff', SPHERE, V(x + 0.37, top + 0.07, z + 0.21), V(0.06, 0.06, 0.06));
  }

  // the mural on the court's east wall, either side of the antecella's door, facing whoever comes in at the gate:
  // painted on the plaster as the murals of the palace at Mari, of this time (muralTexture)
  {
    const b = new Builder(true), x = CX1 - 0.012, y0 = Y + 0.85, y1 = Y + 4.5;
    for (const [z0, z1, u0, u1] of [[NR + 0.75, AX - 1.25, 0, 0.5], [AX + 1.25, SR - 0.75, 0.5, 1]]) {
      const i = b.count;
      b.vert(x, y0, z0, -1, 0, 0, u0, 0); b.vert(x, y0, z1, -1, 0, 0, u1, 0);
      b.vert(x, y1, z1, -1, 0, 0, u1, 1); b.vert(x, y1, z0, -1, 0, 0, u0, 1);
      b.tri(i, i + 1, i + 2); b.tri(i, i + 2, i + 3);   // (facing -x, the court)
      // (its frame: a red band round it)
      for (const [a0, a1, c0, c1] of [[y0 - 0.08, y0, z0 - 0.08, z1 + 0.08], [y1, y1 + 0.08, z0 - 0.08, z1 + 0.08], [y0, y1, z0 - 0.08, z0], [y0, y1, z1, z1 + 0.08]]) bx('redwash', x - 0.02, CX1, a0, a1, c0, c1);
    }
    const m = new THREE.Mesh(b.build(), lightMat({ kind: 'linen', colorMap: muralTexture() }));
    m.receiveShadow = true;
    scene.add(m);
  }

  // ---- the cella ----
  // benches along its side walls, the worshippers' statues on them, all facing the god
  for (const s of [-1, 1]) {
    const zb = s < 0 ? Z0 + T + 0.3 : Z1 - T - 0.3;
    // (knee high and more: one does not step up among them)
    bx('plaster', CE0 + 0.2, CE1 - 0.2, Y, Y + 0.85, zb - 0.3, zb + 0.3);
    for (let k = 0; k < 6; k++) votive(put, CE0 + 0.6 + k * 0.72, Y + 0.85, zb + (rng() - 0.5) * 0.12, 0.45 + rng() * 0.35, rng);
  }
  // the dais before the niche, its steps; the niche's floor at its height
  bx('firedbrick', CE1 - 2.0, CE1, Y, Y + 0.6, AX - 2.0, AX + 2.0);
  bx('firedbrick', CE1 - 2.35, CE1 - 2.0, Y, Y + 0.4, AX - 1.4, AX + 1.4);
  bx('firedbrick', CE1 - 2.7, CE1 - 2.35, Y, Y + 0.2, AX - 1.4, AX + 1.4);
  // (in the niche his pedestal, higher than the dais: his head in the light well's sun)
  bx('firedbrick', CE1, X1 - 1.2, Y, Y + 1.3, AX - 1.3, AX + 1.3);
  enki(put, tube, bx, X1 - 1.9, Y + 1.3, AX);
  // (the curtain before him on its rod, drawn back to either side for the day's rites)
  tube('wood', [V(CE1 - 0.15, Y + 3.7, AX - 1.55), V(CE1 - 0.15, Y + 3.7, AX + 1.55)], 0.04, 6);
  for (const s of [-1, 1]) bx('madder', CE1 - 0.3, CE1 - 0.05, Y + 0.7, Y + 3.66, s < 0 ? AX - 1.45 : AX + 1.12, s < 0 ? AX - 1.12 : AX + 1.45);
  // the offering table before the dais; incense stands either side
  bx('wood', 58.5, 59.5, Y + 0.74, Y + 0.8, AX - 0.65, AX + 0.65);
  for (const [dx, dz] of [[-0.42, -0.55], [0.42, -0.55], [-0.42, 0.55], [0.42, 0.55]]) bx('wood', 59 + dx - 0.04, 59 + dx + 0.04, Y, Y + 0.74, AX + dz - 0.04, AX + dz + 0.04);
  offering(put, bx, 59, Y + 0.8, AX, rng, Y);
  for (const s of [-1, 1]) {
    put('clay', CYL, V(CE1 - 2.9, Y + 0.55, AX + s * 2.5), V(0.17, 1.1, 0.17));
    put('clay', HALF, V(CE1 - 2.9, Y + 1.24, AX + s * 2.5), V(0.26, 0.14, 0.26));
    put('dark', CYL, V(CE1 - 2.9, Y + 1.2, AX + s * 2.5), V(0.24, 0.02, 0.24));
  }
  // the lyre and the harp, by the dais
  lyre(put, tube, bx, V(CE1 - 3.3, Y + 0.04, AX - 3.3), Math.PI / 2 + 0.35);
  harp(put, tube, bx, V(CE1 - 3.2, Y + 0.04, AX + 3.3), -Math.PI / 2 - 0.4);
  // the antecella: reed mats on its floor
  for (let z = Z0 + T + 0.6; z < Z1 - T - 1.5; z += 2.4) if (Math.abs(z + 0.9 - AX) > 1.6) kit.reedMat?.((AN0 + AN1) / 2, Y + 0.06, z + 0.9, 2.4, 1.9);

  // ---- the rooms off the court: the temple's vessels (north), its cloth (south) ----
  for (const [x0, x1] of [[X0 + T, 43.75], [44.25, CX1]]) {
    for (let x = x0 + 0.6; x < x1 - 0.5; x += 0.95) {
      put('clay', JAR, V(x, Y + 0.04, Z0 + T + 0.55), V(0.85, 0.85 + rng() * 0.2, 0.85), rng() * 6);
      if (rng() < 0.6) put('clay', JAR, V(x + 0.45, Y + 0.04, Z0 + T + 1.45), V(0.6, 0.6, 0.6), rng() * 6);
    }
    bx('plaster', x0 + 0.2, x1 - 0.2, Y, Y + 0.6, Z1 - T - 0.8, Z1 - T);
    for (let x = x0 + 0.5; x < x1 - 0.8; x += 0.9 + rng() * 0.3) {
      const k = ['linen', 'madder', 'linen', 'saffron', 'saffron'][Math.floor(rng() * 5)];
      let y = Y + 0.6;
      for (let n = 0; n < 2 + Math.floor(rng() * 3); n++) { const hh = 0.06 + rng() * 0.04; bx(n % 2 ? 'linen' : k, x, x + 0.7, y, y + hh, Z1 - T - 0.7, Z1 - T - 0.15); y += hh; }
    }
  }

  // ---- the Abzu: a basin of fired brick let into the terrace, its joints and its sides sealed with bitumen, steps
  // down into it on the north, a hand of sweet water over its floor; a few reeds at its west end (hillScene.js) ----
  {
    const { x0, x1, z0, z1, floor, water } = ABZU, R = 0.5, top = Y + 0.3;
    // (its rim down to the basin's floor; round it a band of paving at the terrace's level, over the ground's
    // slope down into the basin, which the 1 m ground grid begins a little outside the rim)
    bx('firedbrick', x0, x1, floor, top, z0, z0 + R);
    bx('firedbrick', x0, x1, floor, top, z1 - R, z1);
    bx('firedbrick', x0, x0 + R, floor, top, z0 + R, z1 - R);
    bx('firedbrick', x1 - R, x1, floor, top, z0 + R, z1 - R);
    const A = 0.9;
    bx('firedbrick', x0 - A, x1 + A, Y - 0.6, Y + 0.015, z0 - A, z0);
    bx('firedbrick', x0 - A, x1 + A, Y - 0.6, Y + 0.015, z1, z1 + A);
    bx('firedbrick', x0 - A, x0, Y - 0.6, Y + 0.015, z0, z1);
    bx('firedbrick', x1, x1 + A, Y - 0.6, Y + 0.015, z0, z1);
    bx('trim', x0 - 0.04, x1 + 0.04, top, top + 0.06, z0 - 0.04, z0 + R + 0.02);
    bx('trim', x0 - 0.04, x1 + 0.04, top, top + 0.06, z1 - R - 0.02, z1 + 0.04);
    bx('trim', x0 - 0.04, x0 + R + 0.02, top, top + 0.06, z0, z1);
    bx('trim', x1 - R - 0.02, x1 + 0.04, top, top + 0.06, z0, z1);
    // (its sides and floor: bitumen and brick under the water)
    bx('dark', x0 + R, x1 - R, floor - 0.1, floor, z0 + R, z1 - R);
    bx('dark', x0 + R, x0 + R + 0.04, floor, Y - 0.2, z0 + R, z1 - R);
    bx('dark', x1 - R - 0.04, x1 - R, floor, Y - 0.2, z0 + R, z1 - R);
    bx('dark', x0 + R, x1 - R, floor, Y - 0.2, z1 - R - 0.04, z1 - R);
    // (the steps down, on the north side, the middle of it)
    const sx0 = (x0 + x1) / 2 - 1.5, sx1 = (x0 + x1) / 2 + 1.5;
    [[Y + 0.05, 0.7], [Y - 0.25, 1.3], [floor + 0.25, 1.9]].forEach(([y, d]) => bx('firedbrick', sx0, sx1, floor, y, z0 + R, z0 + R + d));
    // the water: a still sheet (the river's material, its current all but nothing), the floor showing through
    const pos = [], flow = [], depth = [], idx = [], N = 8;
    for (let j = 0; j <= N; j++) {
      for (let i = 0; i <= N; i++) {
        const x = x0 + R + ((x1 - x0 - 2 * R) * i) / N, z = z0 + R + ((z1 - z0 - 2 * R) * j) / N;
        pos.push(x, water, z);
        flow.push(z, x, 0, 0.05);
        depth.push(water - floor);
      }
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i; idx.push(a, a + N + 1, a + 1, a + 1, a + N + 1, a + N + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    g.setAttribute('flow', new THREE.Float32BufferAttribute(flow, 4));
    g.setAttribute('wdepth', new THREE.Float32BufferAttribute(depth, 1));
    g.setIndex(idx);
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, lightMat({ kind: 'water', side: THREE.DoubleSide, flow: 0.05 }));
    m.receiveShadow = true;
    scene.add(m);
  }
}

// the god's meal: fish (Enki's), loaves, dates in a bowl, a jar of beer
function offering(put, bx, x, y, z, rng, floor) {
  for (let k = 0; k < 3; k++) {
    // (a fish: its body, its tail fin)
    const fz = z - 0.35 + k * 0.3, yaw = (rng() - 0.5) * 0.3;
    put('stone', SPHERE, V(x - 0.15, y + 0.04, fz), V(0.2, 0.04, 0.055), yaw);
    put('stone', SPHERE, V(x - 0.15 - Math.cos(yaw) * 0.23, y + 0.04, fz + Math.sin(yaw) * 0.23), V(0.05, 0.012, 0.06), yaw);
  }
  for (const dz of [-0.3, 0.05]) put('grain', SPHERE, V(x + 0.2, y + 0.02, z + dz), V(0.13, 0.06, 0.13));
  put('clay', HALF, V(x + 0.2, y + 0.1, z + 0.38), V(0.13, 0.1, 0.13));
  for (let k = 0; k < 7; k++) put('date', SPHERE, V(x + 0.2 + (rng() - 0.5) * 0.12, y + 0.1, z + 0.38 + (rng() - 0.5) * 0.12), V(0.03, 0.025, 0.03));
  put('clay', JAR, V(x - 0.62, floor, z + 0.6), V(0.45, 0.6, 0.45));
}

// a worshipper's statue of gypsum: on its base, in a fleeced skirt, hands clasped at the chest, facing +x (kind:
// another stone or clay)
export function votive(put, x, y, z, h, rng, kind = 'lime') {
  const k = h / 0.7;
  put(kind, CYL, V(x, y + 0.02 * k, z), V(0.1 * k, 0.04 * k, 0.1 * k));
  put(kind, new THREE.CylinderGeometry(0.075, 0.11, 0.32, 10).deleteAttribute('uv'), V(x, y + 0.2 * k, z), V(k, k, k));
  put(kind, CYL, V(x, y + 0.44 * k, z), V(0.065 * k, 0.17 * k, 0.07 * k));
  put(kind, SPHERE, V(x + 0.05 * k, y + 0.47 * k, z), V(0.03 * k, 0.03 * k, 0.04 * k));
  put(kind, SPHERE, V(x, y + 0.6 * k, z), V(0.055 * k, 0.065 * k, 0.055 * k));
  if (rng() < 0.5) put('hair', SPHERE, V(x - 0.01 * k, y + 0.63 * k, z), V(0.057 * k, 0.05 * k, 0.057 * k));
  put('dark', SPHERE, V(x + 0.045 * k, y + 0.61 * k, z), V(0.012 * k, 0.012 * k, 0.04 * k));   // (the inlaid eyes)
}

// Enki on his throne in the niche, facing -x: the horned crown of a god, the long beard, the flounced robe, the
// streams flowing from his shoulders down to the ground
function enki(put, tube, bx, x, y, z) {
  bx('wood', x - 0.35, x + 0.35, y, y + 0.5, z - 0.4, z + 0.4);
  bx('wood', x + 0.3, x + 0.42, y, y + 1.6, z - 0.42, z + 0.42);
  for (let k = 0; k < 4; k++) {   // (the robe, in tiers of flounces)
    const r = 0.36 - k * 0.04;
    put('bronze', CYL, V(x - 0.05, y + 0.12 + k * 0.2, z), V(r * 0.85, 0.2, r));
  }
  put('bronze', CYL, V(x, y + 0.95, z), V(0.2, 0.42, 0.24));
  put('bronze', SPHERE, V(x, y + 1.3, z), V(0.13, 0.15, 0.13));
  put('hair', SPHERE, V(x - 0.1, y + 1.13, z), V(0.07, 0.17, 0.1));   // the beard
  for (let k = 0; k < 3; k++) put('bronze', TORUS, V(x, y + 1.42 + k * 0.08, z), V(0.13 - k * 0.012, 0.4, 0.13 - k * 0.012));   // the crown's horns
  put('bronze', CONE, V(x, y + 1.72, z), V(0.07, 0.12, 0.07));
  // the streams of the sweet waters, from his shoulders to the floor of the dais
  for (const s of [-1, 1]) tube('indigo', [V(x, y + 1.08, z + s * 0.22), V(x - 0.3, y + 0.9, z + s * 0.4), V(x - 0.55, y + 0.4, z + s * 0.55), V(x - 0.75, y + 0.02, z + s * 0.6)], [0.05, 0.06, 0.07, 0.09], 6);
}

// a lyre standing on the floor: its sound box, two arms, the yoke across them, the strings; at p, facing yaw
export function lyre(put, tube, bx, p, yaw) {
  const q = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
  const at = (x, y, z) => V(x, y, z).applyQuaternion(q).add(p);
  put('wood', BOX, at(0, 0.3, 0), V(0.9, 0.6, 0.2), 0, q);
  put('bronze', SPHERE, at(0, 0.32, 0.11), V(0.1, 0.1, 0.02), 0, q);   // (the inlay on its front)
  tube('wood', [at(-0.34, 0.55, 0), at(-0.38, 1.0, 0), at(-0.44, 1.42, 0)], 0.035, 6);
  tube('wood', [at(0.34, 0.55, 0), at(0.38, 1.0, 0), at(0.44, 1.42, 0)], 0.035, 6);
  tube('wood', [at(-0.55, 1.43, 0), at(0.55, 1.39, 0)], 0.03, 6);
  for (let k = 0; k < 8; k++) {
    const u = -0.26 + k * 0.075;
    tube('linen', [at(u, 0.5, 0.06), at(u * 1.1, 1.41, 0.03)], 0.004, 3);
  }
}

// an arched harp on its low stand: the boat-shaped sound box, the neck rising from its end in an arc over the
// strings; at p, facing yaw
function harp(put, tube, bx, p, yaw) {
  const q = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
  const at = (x, y, z) => V(x, y, z).applyQuaternion(q).add(p);
  bx('wood', p.x - 0.15, p.x + 0.15, p.y, p.y + 0.3, p.z - 0.15, p.z + 0.15);
  put('wood', SPHERE, at(0, 0.38, 0), V(0.5, 0.11, 0.14), 0, q);
  const neck = [];
  for (let k = 0; k <= 8; k++) { const a = (k / 8) * Math.PI * 0.62; neck.push(at(0.42 - Math.sin(a) * 0.5, 0.42 + (1 - Math.cos(a)) * 0.5 + Math.sin(a) * 0.55, 0)); }
  tube('wood', neck, 0.035, 6);
  for (let k = 1; k < 7; k++) {
    const n = neck[k + 1];
    tube('linen', [at(0.4 - k * 0.11, 0.47, 0), n], 0.004, 3);
  }
}

// The temple's storehouse and its kitchen, north of the great stair, seen mostly from
// outside: from the stair, the steps up from the town and the ziggurat.
//
// The storehouse: a long block of mud brick under its mud plaster, five store rooms side by side, their doors on
// the lane to the south shut and sealed (a cord round the peg, a lump of clay over it pressed with the
// storekeeper's seal: broken only before witnesses, and the broken sealings kept); palm-log beam ends under the
// roof's edge; along its front, jars and sacks of the offerings come in; on its roof, reached by a ladder, the
// date harvest drying on mats.
//
// The kitchen: a yard behind a low wall, where the god's two meals a day were made (at Ur, the temple kitchens had
// their ovens, a well and boiling pits). A roofed room on its north side; along the same side, under a reed
// shade, the bread ovens (tannur: clay domes open at the top, the dough slapped to their inside walls); two hearths
// with their bronze cauldrons; the well, its frame and bucket, a trough; querns on a bench along the south wall,
// flour beside them; the butcher's table and a basket of fish (for Enki); big water jars; firewood stacked.
export function buildTempleYard(kit, { rng }) {
  const { get, box, battered } = kit;
  const Y = PRECINCT.y;
  const bx = (kind, x0, x1, y0, y1, z0, z1) => box(kind, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0);
  const put = (kind, geo, p, s, yaw = 0) => get(kind).add(geo, new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromAxisAngle(UP, yaw), s));
  const tube = (kind, pts, r, seg = 6) => get(kind).tube(pts, Array.isArray(r) ? r : pts.map(() => r), seg);
  const jar = (x, z, s = 1, kind = 'clay') => put(kind, JAR, V(x, Y - 0.02, z), V(s, s * (0.9 + rng() * 0.2), s), rng() * 6);
  const sack = (x, y, z, s = 1) => put(rng() < 0.6 ? 'buff' : 'linen', SPHERE, V(x, y + 0.22 * s, z), V(0.32 * s, 0.24 * s, 0.42 * s), rng() * 3);

  // ---- the storehouse ----
  {
    const { x0, x1, z0, z1 } = SH, HS = 4.2, cx = (x0 + x1) / 2;
    battered('plaster', cx, Y - 0.3, (z0 + z1) / 2, x1 - x0, HS + 0.3, z1 - z0, 0.12);
    // (the roof's edge: a lip of plaster, beam ends under it along the front)
    for (let x = x0 + 0.5; x < x1 - 0.4; x += 0.7) tube('wood', [V(x, Y + HS - 0.35, z1 - 0.5), V(x, Y + HS - 0.35, z1 + 0.22)], 0.09, 6);
    // the five doors, shut and sealed
    for (let k = 0; k < 5; k++) {
      const dx = x0 + ((x1 - x0) * (k + 0.5)) / 5, fz = z1 - 0.04;
      bx('dark', dx - 0.7, dx + 0.7, Y, Y + 2.35, fz - 0.02, fz + 0.02);
      bx('wood', dx - 0.58, dx + 0.58, Y + 0.02, Y + 2.2, fz, fz + 0.08);
      tube('wood', [V(dx - 0.95, Y + 2.42, fz + 0.06), V(dx + 0.95, Y + 2.42, fz + 0.06)], 0.11, 7);
      bx('stone', dx - 0.75, dx + 0.75, Y, Y + 0.08, fz, fz + 0.45);
      // (the peg in the wall beside it, the cord round it and the door's knob, the clay over the cord)
      tube('wood', [V(dx + 0.68, Y + 1.15, fz + 0.04), V(dx + 0.68, Y + 1.15, fz + 0.2)], 0.025, 5);
      tube('straw', [V(dx + 0.45, Y + 1.15, fz + 0.12), V(dx + 0.68, Y + 1.15, fz + 0.18)], 0.008, 3);
      put('mud', SPHERE, V(dx + 0.6, Y + 1.15, fz + 0.17), V(0.08, 0.07, 0.04));
      // (before it what has come in: jars, sacks)
      const r = rng();
      if (r < 0.4) { jar(dx - 1.15, z1 + 0.5, 0.9); jar(dx - 1.6, z1 + 0.6, 0.75); }
      else if (r < 0.75) { sack(dx + 1.2, Y, z1 + 0.55); sack(dx + 1.35, Y, z1 + 1.2, 0.9); sack(dx + 1.25, Y + 0.42, z1 + 0.85, 0.85); }
      else jar(dx + 1.2, z1 + 0.5, 1.0, 'buff');
    }
    // the ladder up to the roof, at its east end
    {
      const lx = x1 - 1.4, foot = z1 + 1.5, top = Y + HS + 0.6;
      for (const s of [-0.25, 0.25]) tube('wood', [V(lx + s, Y, foot), V(lx + s, top, z1 - 0.05)], 0.04, 5);
      for (let k = 1; k < 13; k++) {
        const t = k / 13;
        tube('wood', [V(lx - 0.25, Y + (top - Y) * t, foot + (z1 - 0.05 - foot) * t), V(lx + 0.25, Y + (top - Y) * t, foot + (z1 - 0.05 - foot) * t)], 0.022, 4);
      }
    }
    // on the roof: the dates drying on mats, a heap of barley, a hatch down into a store room
    const DATE = new THREE.SphereGeometry(1, 6, 4).deleteAttribute('uv');
    for (let k = 0; k < 4; k++) {
      const mx = x0 + 3 + k * 5.4, mz = z0 + 2.5 + (k % 2) * 3;
      bx('straw', mx - 1.4, mx + 1.4, Y + HS, Y + HS + 0.03, mz - 1.0, mz + 1.0);
      for (let n = 0; n < 160; n++) put('date', DATE, V(mx + (rng() - 0.5) * 2.6, Y + HS + 0.05, mz + (rng() - 0.5) * 1.8), V(0.035, 0.025, 0.035), rng() * 3);
    }
    put('grain', DOME, V(x1 - 4, Y + HS, z0 + 4), V(1.1, 0.45, 1.1));
    bx('dark', x0 + 13, x0 + 13.8, Y + HS - 0.02, Y + HS + 0.01, z0 + 6, z0 + 6.8);
  }

  // ---- the kitchen ----
  {
    const { x0, x1, z0, z1 } = KI, T = 0.5, HW = 2.0;
    // (its wall, low: one sees over it from the stair; the gate west on the lane past the weavers' house, a way
    // through north to the storehouse's lane)
    const G = [36.4, 38.4], N = [52.0, 53.4];
    bx('plaster', x0, N[0], Y, Y + HW, z0, z0 + T);
    bx('plaster', N[1], x1, Y, Y + HW, z0, z0 + T);
    bx('plaster', x0, x1, Y, Y + HW, z1 - T, z1);
    bx('plaster', x0, x0 + T, Y, Y + HW, z0 + T, G[0]);
    bx('plaster', x0, x0 + T, Y, Y + HW, G[1], z1 - T);
    bx('plaster', x1 - T, x1, Y, Y + HW, z0 + T, z1 - T);
    for (const z of G) tube('wood', [V(x0 + T / 2, Y, z), V(x0 + T / 2, Y + 2.4, z)], 0.12, 7);
    tube('wood', [V(x0 + T / 2, Y + 2.45, G[0] - 0.3), V(x0 + T / 2, Y + 2.45, G[1] + 0.3)], 0.12, 7);
    // the roofed room on the north side, open to the yard through a wide doorway; beam ends, two smoke holes
    {
      const r0 = x0 + T, r1 = 49.5, rz0 = z0 + T, rz1 = 36.0, HR = 3.2, t = 0.45;
      bx('plaster', r0, r1, Y, Y + HR, rz0, rz0 + t);
      bx('plaster', r0, r0 + t, Y, Y + HR, rz0, rz1);
      bx('plaster', r1 - t, r1, Y, Y + HR, rz0, rz1);
      bx('plaster', r0, 41.5, Y, Y + HR, rz1 - t, rz1);
      bx('plaster', 44.5, r1, Y, Y + HR, rz1 - t, rz1);
      bx('plaster', 41.5, 44.5, Y + 2.3, Y + HR, rz1 - t, rz1);
      bx('plaster', r0 - 0.05, r1 + 0.05, Y + HR, Y + HR + 0.25, rz0 - 0.05, rz1 + 0.05);
      for (let x = r0 + 0.4; x < r1 - 0.3; x += 0.7) tube('wood', [V(x, Y + HR - 0.12, rz0 + 0.2), V(x, Y + HR - 0.12, rz1 + 0.25)], 0.08, 6);
      for (const x of [43, 47]) bx('dark', x - 0.3, x + 0.3, Y + HR + 0.24, Y + HR + 0.26, rz0 + 1.2, rz0 + 1.8);
      // (inside, by the door: a hearth, its pot)
      hearth(46.8, 34.6);
    }
    // the bread ovens under their reed shade
    {
      const oven = new THREE.LatheGeometry([[0, 0], [0.56, 0], [0.58, 0.25], [0.52, 0.6], [0.36, 0.88], [0.24, 0.95], [0.2, 0.9], [0.32, 0.6], [0.3, 0.1]]
        .map(([r, h]) => new THREE.Vector2(r, h)), 16).deleteAttribute('uv');
      oven.computeVertexNormals();
      for (let k = 0; k < 4; k++) {
        const ox = 51.2 + k * 1.75, oz = z0 + T + 1.1;
        put('clay', oven, V(ox, Y, oz), V(1, 0.95 + rng() * 0.1, 1), rng() * 6);
        put('dark', CYL, V(ox, Y + 0.84, oz), V(0.22, 0.02, 0.22));
        put('dark', CYL, V(ox + 0.2, Y + 0.01, oz + 0.75), V(0.35, 0.02, 0.28));
      }
      for (const [x, z] of [[50.4, z0 + T + 0.2], [58.4, z0 + T + 0.2], [50.4, 35.4], [58.4, 35.4]]) tube('wood', [V(x, Y, z), V(x, Y + 2.35, z)], [0.06, 0.05], 6);
      kit.reedMat(54.4, Y + 2.4, (z0 + T + 35.4) / 2 + 0.1, 8.6, 35.4 - z0 - T + 0.6, 0, 0, -0.05);
      // (loaves on a mat, a basket of dough, firewood: palm logs and fronds' stems, stacked)
      bx('straw', 51.2, 53.4, Y, Y + 0.02, 34.6, 35.6);
      for (let k = 0; k < 9; k++) put('grain', SPHERE, V(51.45 + (k % 5) * 0.42, Y + 0.05, 34.85 + Math.floor(k / 5) * 0.45), V(0.18, 0.05, 0.18));
      get('straw').add(new THREE.CylinderGeometry(0.32, 0.26, 0.36, 12).deleteAttribute('uv'), new THREE.Matrix4().makeTranslation(54.2, Y + 0.18, 35.2));
      put('linen', SPHERE, V(54.2, Y + 0.36, 35.2), V(0.27, 0.08, 0.27));
      for (let j = 0; j < 3; j++) for (let i = 0; i < 6 - j; i++) tube('wood', [V(59.2 + i * 0.27 + j * 0.13, Y + 0.12 + j * 0.22, z0 + T + 0.2), V(59.2 + i * 0.27 + j * 0.13, Y + 0.12 + j * 0.22, z0 + T + 2.0)], 0.12, 6);
    }
    // the two hearths in the yard, their cauldrons
    hearth(42.6, 41.6, true);
    hearth(45.6, 41.6, true);
    // the well: its brick head, the frame over it, the rope and the leather bucket; the trough beside it
    {
      const wx = 59.6, wz = 41.0;
      const head = new THREE.LatheGeometry([[0.55, 0], [0.88, 0], [0.88, 0.78], [0.55, 0.78], [0.55, 0]].map(([r, h]) => new THREE.Vector2(r, h)), 20).deleteAttribute('uv');
      head.computeVertexNormals();
      get('firedbrick').add(head, new THREE.Matrix4().makeTranslation(wx, Y, wz), { flat: true });
      put('dark', CYL, V(wx, Y + 0.3, wz), V(0.56, 0.02, 0.56));
      for (const s of [-1, 1]) tube('wood', [V(wx + s * 1.05, Y, wz), V(wx + s * 1.0, Y + 2.3, wz)], 0.07, 6);
      tube('wood', [V(wx - 1.2, Y + 2.3, wz), V(wx + 1.2, Y + 2.3, wz)], 0.07, 6);
      tube('straw', [V(wx, Y + 2.25, wz), V(wx, Y + 1.15, wz)], 0.012, 3);
      put('buff', HALF, V(wx, Y + 1.15, wz), V(0.2, 0.3, 0.2));
      put('dark', CYL, V(wx, Y + 1.14, wz), V(0.19, 0.01, 0.19));
      bx('firedbrick', wx - 2.6, wx - 1.3, Y, Y + 0.45, wz - 0.4, wz + 0.4);
      bx('dark', wx - 2.5, wx - 1.4, Y + 0.3, Y + 0.46, wz - 0.3, wz + 0.3);
    }
    // the querns on their bench along the south wall, flour by each; the butcher's table, the basket of fish
    bx('plaster', 50.5, 57.5, Y, Y + 0.45, z1 - T - 0.7, z1 - T);
    for (let k = 0; k < 3; k++) {
      const qx = 51.6 + k * 2.2, qz = z1 - T - 0.35;
      bx('stone', qx - 0.35, qx + 0.35, Y + 0.45, Y + 0.57, qz - 0.2, qz + 0.2);
      put('stone', SPHERE, V(qx + 0.1, Y + 0.62, qz), V(0.08, 0.05, 0.18));
      put('grain', DOME, V(qx + 0.6, Y + 0.45, qz), V(0.18, 0.08, 0.18));
    }
    bx('wood', 46.2, 47.9, Y + 0.78, Y + 0.85, 38.0, 38.8);
    for (const [dx, dz] of [[46.35, 38.1], [47.75, 38.1], [46.35, 38.7], [47.75, 38.7]]) bx('wood', dx - 0.05, dx + 0.05, Y, Y + 0.78, dz - 0.05, dz + 0.05);
    bx('bronze', 47.0, 47.35, Y + 0.85, Y + 0.87, 38.3, 38.36);
    get('straw').add(new THREE.CylinderGeometry(0.36, 0.3, 0.35, 12).deleteAttribute('uv'), new THREE.Matrix4().makeTranslation(48.6, Y + 0.18, 38.9));
    for (let k = 0; k < 4; k++) put('stone', SPHERE, V(48.6 + (rng() - 0.5) * 0.3, Y + 0.38, 38.9 + (rng() - 0.5) * 0.3), V(0.2, 0.04, 0.055), rng() * 3);
    // the water jars along the east wall
    for (let z = z0 + 3.4; z < z1 - 1.6; z += 1.1) if (Math.abs(z - 41) > 1.3) jar(x1 - T - 0.6, z, 1.15);
  }

  // a hearth: three sides of brick round the fire, a bronze cauldron on it (or a clay pot, indoors)
  function hearth(x, z, cauldron = false) {
    bx('firedbrick', x - 0.55, x + 0.55, Y, Y + 0.5, z - 0.45, z - 0.25);
    bx('firedbrick', x - 0.55, x - 0.35, Y, Y + 0.5, z - 0.25, z + 0.45);
    bx('firedbrick', x + 0.35, x + 0.55, Y, Y + 0.5, z - 0.25, z + 0.45);
    put('dark', CYL, V(x, Y + 0.01, z + 0.05), V(0.32, 0.02, 0.32));
    put(cauldron ? 'bronze' : 'clay', HALF, V(x, Y + 0.82, z), V(0.42, 0.36, 0.42));
    put('dark', CYL, V(x, Y + 0.81, z), V(0.4, 0.015, 0.4));
  }
}

// The mural, after the court paintings of Zimri-Lim's palace at Mari (some 1775 BC): on a pale ground, in red and
// yellow ochre, blue, black and white, framed by a band of spirals; above, a date palm heavy with dates, a dove in
// its crown; a frieze of rosettes; below, the vase of flowing water, Enki's, its two streams arching out full of
// fish; at the foot, coloured stripes. Two panels (the left half of the picture and the right), one either side of
// the door, the second the first's mirror
function muralTexture() {
  const W = 512, H = 592, c = document.createElement('canvas');
  c.width = 2 * W;
  c.height = H;
  const g = c.getContext('2d');
  const C = { ground: '#eadcbc', red: '#a5412a', dark: '#6e2618', blue: '#2f5f8f', sky: '#6f9cc4', black: '#211c18', white: '#f3ecdc', ochre: '#c99434', green: '#4e7d64' };
  const panel = (ox, flip) => {
    g.save();
    g.translate(ox + (flip ? W : 0), 0);
    g.scale(flip ? -1 : 1, 1);
    g.fillStyle = C.ground; g.fillRect(0, 0, W, H);
    // the frame: red, and a band of running spirals at the top and the foot
    g.fillStyle = C.red; g.fillRect(0, 0, W, 14); g.fillRect(0, H - 14, W, 14); g.fillRect(0, 0, 14, H); g.fillRect(W - 14, 0, 14, H);
    const spirals = (x0, y0, x1, y1) => {
      const n = Math.round(Math.hypot(x1 - x0, y1 - y0) / 30);
      for (let k = 0; k <= n; k++) {
        const x = x0 + ((x1 - x0) * k) / n, y = y0 + ((y1 - y0) * k) / n;
        g.beginPath(); g.arc(x, y, 12, 0, Math.PI * 2); g.fillStyle = k % 2 ? C.blue : C.white; g.fill();
        g.lineWidth = 2.5; g.strokeStyle = C.black; g.stroke();
        g.beginPath(); g.arc(x, y, 4.5, 0, Math.PI * 2); g.fillStyle = C.red; g.fill();
      }
    };
    spirals(32, 32, W - 32, 32); spirals(32, H - 86, W - 32, H - 86);
    // the palm: its trunk in scales, its crown of fronds, dates hanging in red-orange bunches, a dove
    const tx = 230, tb = 330, tt = 105;
    for (let y = tb; y > tt; y -= 12) {
      g.fillStyle = (y / 12) % 2 < 1 ? C.ochre : '#8a5a2e';
      g.beginPath(); g.moveTo(tx - 11, y); g.lineTo(tx, y - 12); g.lineTo(tx + 11, y); g.lineTo(tx, y - 4); g.closePath(); g.fill();
    }
    g.lineCap = 'round';
    for (let k = 0; k < 9; k++) {
      const a = -Math.PI / 2 + (k - 4) * 0.36, L = 95 - Math.abs(k - 4) * 6, droop = Math.abs(k - 4) * 9;
      const ex = tx + Math.cos(a) * L, ey = tt + Math.sin(a) * L * 0.75 + droop;
      g.strokeStyle = C.green; g.lineWidth = 7;
      g.beginPath(); g.moveTo(tx, tt); g.quadraticCurveTo(tx + Math.cos(a) * L * 0.5, tt + Math.sin(a) * L * 0.6 - 10, ex, ey); g.stroke();
      g.lineWidth = 2.5;
      for (let t = 0.25; t < 1; t += 0.12) {
        const px = tx + (ex - tx) * t, py = tt + (ey - tt) * t - Math.sin(t * Math.PI) * 8;
        g.beginPath(); g.moveTo(px, py); g.lineTo(px - Math.sin(a) * 12, py + 12); g.stroke();
      }
    }
    for (const s of [-1, 1]) for (let k = 0; k < 9; k++) {
      g.beginPath(); g.arc(tx + s * (16 + (k % 3) * 7), tt + 18 + Math.floor(k / 3) * 8, 4.5, 0, Math.PI * 2); g.fillStyle = k % 2 ? C.red : '#d9772f'; g.fill();
    }
    g.fillStyle = C.white; g.strokeStyle = C.black; g.lineWidth = 2.5;
    g.beginPath(); g.ellipse(tx + 70, tt + 2, 20, 11, -0.2, 0, Math.PI * 2); g.fill(); g.stroke();
    g.beginPath(); g.arc(tx + 88, tt - 9, 8, 0, Math.PI * 2); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(tx + 52, tt + 4); g.lineTo(tx + 38, tt + 10); g.lineTo(tx + 50, tt - 2); g.fill(); g.stroke();
    g.fillStyle = C.red; g.beginPath(); g.moveTo(tx + 95, tt - 10); g.lineTo(tx + 103, tt - 8); g.lineTo(tx + 95, tt - 6); g.fill();
    // (a second, smaller palm behind, to the side)
    g.globalAlpha = 0.85;
    for (let y = tb; y > 190; y -= 12) { g.fillStyle = C.ochre; g.fillRect(380 - 6, y - 10, 12, 9); }
    g.strokeStyle = C.green; g.lineWidth = 5;
    for (let k = 0; k < 7; k++) { const a = -Math.PI / 2 + (k - 3) * 0.42; g.beginPath(); g.moveTo(380, 190); g.lineTo(380 + Math.cos(a) * 62, 190 + Math.sin(a) * 44 + Math.abs(k - 3) * 9); g.stroke(); }
    g.globalAlpha = 1;
    // the frieze of rosettes on a red band
    g.fillStyle = C.red; g.fillRect(14, 342, W - 28, 44);
    for (let x = 46; x < W - 30; x += 52) {
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        g.beginPath(); g.ellipse(x + Math.cos(a) * 9, 364 + Math.sin(a) * 9, 7, 3.6, a, 0, Math.PI * 2); g.fillStyle = C.white; g.fill();
      }
      g.beginPath(); g.arc(x, 364, 5, 0, Math.PI * 2); g.fillStyle = C.blue; g.fill();
    }
    // the vase of flowing water, its streams arching out to either side, fish swimming up them
    const vx = 256, vy = 448;
    for (const s of [-1, 1]) {
      g.strokeStyle = C.blue; g.lineWidth = 22;
      g.beginPath(); g.moveTo(vx + s * 8, vy - 44); g.bezierCurveTo(vx + s * 40, vy - 70, vx + s * 140, vy - 70, vx + s * 190, vy + 18); g.stroke();
      g.strokeStyle = C.sky; g.lineWidth = 3;
      for (const o of [-6, 6]) { g.beginPath(); g.moveTo(vx + s * 8, vy - 44 + o); g.bezierCurveTo(vx + s * 40, vy - 70 + o, vx + s * 140, vy - 70 + o, vx + s * 190, vy + 18 + o); g.stroke(); }
      for (const t of [0.3, 0.62, 0.9]) {
        const bx = (1 - t) ** 3 * (vx + s * 8) + 3 * (1 - t) ** 2 * t * (vx + s * 40) + 3 * (1 - t) * t * t * (vx + s * 140) + t ** 3 * (vx + s * 190);
        const by = (1 - t) ** 3 * (vy - 44) + 3 * (1 - t) ** 2 * t * (vy - 70) + 3 * (1 - t) * t * t * (vy - 70) + t ** 3 * (vy + 18);
        g.fillStyle = C.white; g.strokeStyle = C.black; g.lineWidth = 1.5;
        g.beginPath(); g.ellipse(bx, by, 9, 4, s * (t - 0.5) * 1.6, 0, Math.PI * 2); g.fill(); g.stroke();
      }
    }
    g.fillStyle = C.ochre; g.strokeStyle = C.black; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(vx - 14, vy - 46); g.lineTo(vx + 14, vy - 46); g.quadraticCurveTo(vx + 46, vy - 10, vx + 30, vy + 30);
    g.lineTo(vx + 16, vy + 42); g.lineTo(vx - 16, vy + 42); g.lineTo(vx - 30, vy + 30); g.quadraticCurveTo(vx - 46, vy - 10, vx - 14, vy - 46); g.fill(); g.stroke();
    g.fillStyle = C.red; g.fillRect(vx - 34, vy - 6, 68, 8);
    // the foot: stripes
    for (const [y, col] of [[H - 70, C.dark], [H - 56, C.blue], [H - 44, C.ground], [H - 38, C.black], [H - 28, C.red]]) { g.fillStyle = col; g.fillRect(14, y, W - 28, 14); }
    g.restore();
  };
  panel(0, false);
  panel(W, true);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
