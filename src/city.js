// The city made in Blender (tools/build_mesopotamia.py; exported by tools/export_web.py as models/city.glb):
// the ziggurat, its stairs, the courtyard houses, the harbour, the stores, the everyday things and the people,
// each material named after its kind (shade.js KINDS). Drawn as one mesh per kind (the file holds some 1400
// pieces: as many draw calls, in the camera's pass and both shadow passes), and walked on through those same
// meshes (three-mesh-bvh). A grid of what stands where, for the plants to keep clear of.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { computeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { lightMat, KINDS } from './shade.js';
import { MODEL } from './land.js';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

// not stood on (the water, cloth, the people)
const NOT_WALKED = new Set(['water', 'linen', 'madder', 'indigo', 'skin', 'hair']);
// thin, single surfaces (the woven shades, cloth, potsherds, the tablet's marks): seen from either side
const THIN = new Set(['straw', 'linen', 'madder', 'indigo', 'clay', 'firedbrick', 'water']);
// lying on the ground without standing up from it: the plants may grow right to them
const FLAT = new Set(['path', 'water', 'mud', 'earth']);

export async function loadCity(url = 'models/city.glb') {
  const gltf = await new GLTFLoader().loadAsync(`${url}?${Date.now()}`);
  const src = gltf.scene;
  src.updateMatrixWorld(true);
  const byKind = new Map();
  src.traverse((o) => {
    if (!o.isMesh) return;
    const kind = KINDS.includes(o.material?.name) ? o.material.name : 'plaster';
    if (!byKind.has(kind)) byKind.set(kind, []);
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    for (const a of Object.keys(g.attributes)) if (a !== 'position' && a !== 'normal') g.deleteAttribute(a);
    byKind.set(kind, [...byKind.get(kind), g.index ? g.toNonIndexed() : g]);
  });
  const group = new THREE.Group();
  const walkables = [], meshes = {};
  for (const [kind, geos] of byKind) {
    const geo = mergeGeometries(geos);
    for (const g of geos) g.dispose();
    const m = new THREE.Mesh(geo, lightMat({ kind, side: THIN.has(kind) ? THREE.DoubleSide : THREE.FrontSide }));
    m.name = kind;
    m.castShadow = kind !== 'water';
    m.receiveShadow = true;
    geo.computeBoundsTree();
    group.add(m);
    meshes[kind] = m;
    if (!NOT_WALKED.has(kind)) walkables.push(m);
  }
  group.updateMatrixWorld(true);

  // what stands where: the top of the city's things on a half-metre grid over the model, cast down from above
  const G = { x0: MODEL.x0 - 2, z0: MODEL.z0 - 2, step: 0.5 };
  G.nx = Math.ceil((MODEL.x1 - MODEL.x0 + 4) / G.step) + 1;
  G.nz = Math.ceil((MODEL.z1 - MODEL.z0 + 4) / G.step) + 1;
  const solid = new Uint8Array(G.nx * G.nz);
  const tops = new Float32Array(G.nx * G.nz).fill(-Infinity);
  const ray = new THREE.Raycaster();
  ray.firstHitOnly = true;
  const down = new THREE.Vector3(0, -1, 0), from = new THREE.Vector3();
  const standing = group.children.filter((m) => !FLAT.has(m.name));
  for (let j = 0; j < G.nz; j++) {
    for (let i = 0; i < G.nx; i++) {
      from.set(G.x0 + i * G.step, 60, G.z0 + j * G.step);
      ray.set(from, down);
      const hit = ray.intersectObjects(standing, false)[0];
      if (hit && hit.point.y > 0.1) {
        solid[j * G.nx + i] = 1;
        tops[j * G.nx + i] = hit.point.y;
      }
    }
  }
  const cell = (x, z) => {
    const i = Math.round((x - G.x0) / G.step), j = Math.round((z - G.z0) / G.step);
    return i < 0 || j < 0 || i >= G.nx || j >= G.nz ? -1 : j * G.nx + i;
  };
  // anything standing within `margin` of (x, z)
  function occupied(x, z, margin = 0) {
    const r = Math.ceil(margin / G.step);
    const i0 = Math.round((x - G.x0) / G.step), j0 = Math.round((z - G.z0) / G.step);
    if (i0 < -r || j0 < -r || i0 >= G.nx + r || j0 >= G.nz + r) return false;
    for (let j = j0 - r; j <= j0 + r; j++) {
      if (j < 0 || j >= G.nz) continue;
      for (let i = i0 - r; i <= i0 + r; i++) {
        if (i < 0 || i >= G.nx || (i - i0) ** 2 + (j - j0) ** 2 > r * r + 0.5) continue;
        if (solid[j * G.nx + i]) return true;
      }
    }
    return false;
  }

  return {
    group, walkables, meshes, occupied,
    topAt: (x, z) => { const c = cell(x, z); return c < 0 ? -Infinity : tops[c]; },
  };
}

// Chosen pieces of the same Blender scene, for the bay scene (bayScene.js): for each set, the objects whose names
// begin with one of its prefixes, merged by kind (remap: kind -> another kind), as a group in the Blender
// scene's own placing (three.js coordinates) for the caller to move
export async function loadPieces(sets, url = 'models/city.glb') {
  const gltf = await new GLTFLoader().loadAsync(`${url}?${Date.now()}`);
  const src = gltf.scene;
  src.updateMatrixWorld(true);
  const out = {};
  // (except: names among those that are left out all the same)
  for (const [name, { prefixes, except = [], remap = {} }] of Object.entries(sets)) {
    const byKind = new Map();
    // (three rewrites names as it loads them: spaces to underscores, slashes and dots dropped; the prefixes too)
    const pre = prefixes.map((p) => THREE.PropertyBinding.sanitizeNodeName(p)), exc = except.map((p) => THREE.PropertyBinding.sanitizeNodeName(p));
    src.traverse((o) => {
      if (!o.isMesh || !pre.some((p) => o.name.startsWith(p)) || exc.some((p) => o.name.startsWith(p))) return;
      let kind = KINDS.includes(o.material?.name) ? o.material.name : 'plaster';
      kind = remap[kind] ?? kind;
      const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
      for (const a of Object.keys(g.attributes)) if (a !== 'position' && a !== 'normal') g.deleteAttribute(a);
      if (!byKind.has(kind)) byKind.set(kind, []);
      byKind.get(kind).push(g.index ? g.toNonIndexed() : g);
    });
    const group = new THREE.Group();
    for (const [kind, geos] of byKind) {
      const m = new THREE.Mesh(mergeGeometries(geos), lightMat({ kind, side: THIN.has(kind) ? THREE.DoubleSide : THREE.FrontSide }));
      m.name = kind;
      m.castShadow = kind !== 'water';
      m.receiveShadow = true;
      group.add(m);
    }
    out[name] = group;
  }
  return out;
}
