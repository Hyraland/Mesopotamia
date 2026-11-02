// A geometry builder: many pieces (primitives under a matrix, tubes, flat faces) gathered into one mesh.

import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _m3 = new THREE.Matrix3();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();

export class Builder {
  // withFlap: each vertex also carries how a cloth's point there moves in the wind (shade.js FLAP)
  constructor(withUV = false, withFlap = false) {
    this.p = [];
    this.n = [];
    this.uv = withUV ? [] : null;
    this.f = withFlap ? [] : null;
    this.idx = [];
  }

  get count() { return this.p.length / 3; }

  vert(x, y, z, nx, ny, nz, u = 0, v = 0, f = null) {
    this.p.push(x, y, z);
    this.n.push(nx, ny, nz);
    if (this.uv) this.uv.push(u, v);
    if (this.f) this.f.push(...(f ?? [0, 0, 0, 0]));
    return this.count - 1;
  }

  tri(a, b, c) { this.idx.push(a, b, c); }

  // a geometry under matrix m; flat: its faces flat-shaded (each face its own normal)
  // (flap: one flap for all its vertices)
  add(geom, m, { flat = false, uv = null, flap = null } = {}) {
    let g = geom;
    if (flat) {
      g = g.index ? g.toNonIndexed() : g.clone();
      g.deleteAttribute('normal');
      g.computeVertexNormals();
    }
    const pos = g.attributes.position, nor = g.attributes.normal, guv = g.attributes.uv;
    _m3.getNormalMatrix(m);
    const base = this.count;
    for (let k = 0; k < pos.count; k++) {
      _v.fromBufferAttribute(pos, k).applyMatrix4(m);
      _n.fromBufferAttribute(nor, k).applyMatrix3(_m3).normalize();
      const u = uv ? uv[0] : guv ? guv.getX(k) : 0, w = uv ? uv[1] : guv ? guv.getY(k) : 0;
      this.vert(_v.x, _v.y, _v.z, _n.x, _n.y, _n.z, u, w, flap);
    }
    if (g.index) {
      const a = g.index.array;
      for (let k = 0; k < a.length; k++) this.idx.push(base + a[k]);
    } else for (let k = 0; k < pos.count; k++) this.idx.push(base + k);
    if (g !== geom) g.dispose();
  }

  // a round tube through pts (Vector3s) with a radius at each; uv: one fixed uv for all its vertices
  tube(pts, radii, seg = 8, uv = null) {
    const S = seg + 1, base = this.count;
    const t = new THREE.Vector3(), nrm = new THREE.Vector3(), bin = new THREE.Vector3(), d = new THREE.Vector3();
    for (let i = 0; i < pts.length; i++) {
      t.subVectors(pts[Math.min(i + 1, pts.length - 1)], pts[Math.max(i - 1, 0)]).normalize();
      if (i === 0) nrm.set(Math.abs(t.y) < 0.9 ? 0 : 1, Math.abs(t.y) < 0.9 ? 1 : 0, 0);
      nrm.addScaledVector(t, -nrm.dot(t)).normalize();
      bin.crossVectors(t, nrm);
      const p = pts[i], r = radii[i];
      for (let j = 0; j < S; j++) {
        const ang = (j / seg) * Math.PI * 2, c = Math.cos(ang), s = Math.sin(ang);
        d.set(nrm.x * c + bin.x * s, nrm.y * c + bin.y * s, nrm.z * c + bin.z * s);
        this.vert(p.x + d.x * r, p.y + d.y * r, p.z + d.z * r, d.x, d.y, d.z,
          uv ? uv[0] : j / seg, uv ? uv[1] : i / (pts.length - 1));
      }
    }
    for (let i = 0; i < pts.length - 1; i++) {
      for (let j = 0; j < seg; j++) {
        const a = base + i * S + j;
        this.tri(a, a + 1, a + S);
        this.tri(a + 1, a + S + 1, a + S);
      }
    }
    // its ends closed, where it is thick enough to be seen into (a beam's end under a parapet seen from below was an
    // open trough, its far side gone); a cord's left open
    for (const end of [0, pts.length - 1]) {
      if (radii[end] < 0.02) continue;
      const other = pts[end === 0 ? 1 : end - 1], out = new THREE.Vector3().subVectors(pts[end], other).normalize();
      const ring = base + end * S, c = this.vert(pts[end].x, pts[end].y, pts[end].z, out.x, out.y, out.z);
      const rim = [];
      for (let j = 0; j < seg; j++) {
        const x = this.p[(ring + j) * 3], y = this.p[(ring + j) * 3 + 1], z = this.p[(ring + j) * 3 + 2];
        rim.push([this.vert(x, y, z, out.x, out.y, out.z), new THREE.Vector3(x, y, z)]);
      }
      for (let j = 0; j < seg; j++) {
        const [ia, pa] = rim[j], [ib, pb] = rim[(j + 1) % seg];
        const n = new THREE.Vector3().subVectors(pa, pts[end]).cross(new THREE.Vector3().subVectors(pb, pts[end]));
        if (n.dot(out) > 0) this.tri(c, ia, ib); else this.tri(c, ib, ia);
      }
    }
  }

  // a flat triangle facing away from `inside` (a point behind it)
  face3(a, b, c, inside) {
    _a.subVectors(b, a);
    _b.subVectors(c, a);
    _n.crossVectors(_a, _b).normalize();
    _c.subVectors(a, inside);
    if (_n.dot(_c) < 0) { [b, c] = [c, b]; _n.negate(); }
    const i = this.vert(a.x, a.y, a.z, _n.x, _n.y, _n.z);
    this.vert(b.x, b.y, b.z, _n.x, _n.y, _n.z);
    this.vert(c.x, c.y, c.z, _n.x, _n.y, _n.z);
    this.tri(i, i + 1, i + 2);
  }

  face4(a, b, c, d, inside) {
    this.face3(a, b, c, inside);
    this.face3(a, c, d, inside);
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    if (this.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (this.f) g.setAttribute('flap', new THREE.Float32BufferAttribute(this.f, 4));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
// a matrix: position, rotation (Euler, order YXZ) and scale
export function mat(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  return new THREE.Matrix4().compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ')), _s.set(sx, sy, sz));
}

// a rounded box: a sphere pushed out towards its bounding box (e < 1 squarer, e = 1 a plain ellipsoid)
export function blob(sx, sy, sz, e = 0.5, ws = 40, hs = 28) {
  const sphere = new THREE.SphereGeometry(1, ws, hs);
  sphere.deleteAttribute('uv');
  sphere.deleteAttribute('normal');
  const g = mergeVertices(sphere);   // one vertex at the seam and the poles, so the normals are smooth there
  sphere.dispose();
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const f = (v) => Math.sign(v) * Math.abs(v) ** e;
    pos.setXYZ(i, f(pos.getX(i)) * sx, f(pos.getY(i)) * sy, f(pos.getZ(i)) * sz);
  }
  g.computeVertexNormals();
  return g;
}

// A geometry cut into square tiles `size` metres across on the ground (each triangle goes with its middle), so that
// the view and the sun's shadow maps, which leave out what they do not reach a mesh at a time, leave out the tiles
// they do not reach: one mesh over the whole town was drawn whole into a shadow map 44 m across. Outside `box`
// ([x0, z0, x1, z1]) the triangles stay together, one more piece (the far ground's big cells would make thousands).
export function splitTiles(g, size, box = null) {
  const pos = g.attributes.position, idx = g.index ? g.index.array : null, n = idx ? idx.length : pos.count;
  const groups = new Map();
  for (let t = 0; t < n; t += 3) {
    const a = idx ? idx[t] : t, b = idx ? idx[t + 1] : t + 1, c = idx ? idx[t + 2] : t + 2;
    const x = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3, z = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3;
    const out = box && (x < box[0] || z < box[1] || x > box[2] || z > box[3]);
    const key = out ? 'out' : `${Math.floor(x / size)},${Math.floor(z / size)}`;
    let l = groups.get(key);
    if (!l) groups.set(key, (l = []));
    l.push(a, b, c);
  }
  if (groups.size <= 1) return [g];
  const parts = [];
  for (const tri of groups.values()) {
    const remap = new Map(), keep = [];
    const ix = tri.map((v) => {
      let r = remap.get(v);
      if (r === undefined) { r = keep.length; remap.set(v, r); keep.push(v); }
      return r;
    });
    const sg = new THREE.BufferGeometry();
    for (const [name, attr] of Object.entries(g.attributes)) {
      const s = attr.itemSize, arr = new attr.array.constructor(keep.length * s);
      keep.forEach((v, i) => { for (let k = 0; k < s; k++) arr[i * s + k] = attr.array[v * s + k]; });
      sg.setAttribute(name, new THREE.BufferAttribute(arr, s, attr.normalized));
    }
    sg.setIndex(keep.length > 65535 ? new THREE.Uint32BufferAttribute(ix, 1) : new THREE.Uint16BufferAttribute(ix, 1));
    sg.computeBoundingSphere();
    sg.computeBoundingBox();
    parts.push(sg);
  }
  g.dispose();
  return parts;
}
