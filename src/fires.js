// Fire and lamplight at night: there were no candles yet; a house was lit by an
// oil lamp inside, and out of doors by torches and fires. So at night (tuning_night.json, sky.fires):
//   - here and there in the town a small fire on the ground: a ring of stones, ash, a few palm-wood logs laid
//     crossways, the flames over them, the embers glowing (by day they are not there at all);
//   - torches on the walls beside some of the doors, and on the precinct gate's piers: a stick in a bronze ring on
//     an arm out from the wall, its head a bundle of reed soaked in bitumen (the torches are there by day, unlit);
//   - in some of the small high windows, the warm light of the oil lamp inside.
// The hearths and the torches are built as things; the flames, their glow in the air and the sparks are drawn over
// the finished picture, as the motes are (motes.js), each looking up the light buffer's depth to see whether
// something stands in front of it. Their light on the ground and the walls and the things round them is worked out
// with the rest of the light (shade.js fireLight: lights, below), so it falls only on what faces it and stops at
// a wall.

import * as THREE from 'three';
import { makeKit } from './houseKit.js';
import { makeRng } from './rand.js';

// where they burn (the ground there: its height): on the quay south of the landing, in the town, by the precinct
export const FIRES = [
  { x: -35.3, z: 16.6, y: 1.3 },
  { x: 3.35, z: 29.0, y: 7.78 },
  { x: 26.36, z: 82.96, y: 9.57 },
];

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
// the precinct gate's piers, their faces into the precinct (x, z, the floor's height there): a torch on each
const GATE_TORCHES = [{ x: 14.05, z: 51.3, y: 9.5 }, { x: 14.05, z: 56.7, y: 9.5 }];
// doors chosen by hand: one under a vine trellis, none; one by the lane's square, its
// torch on the left, past the cone mosaic beside the door (side: -1 left, 1 right as one faces the door; off: metres
// from the door's middle)
const TORCH_AT = [{ x: -19.17, z: 11.24, none: true }, { x: -13.67, z: 15.0, side: -1, off: 1.65 }];
// (the same every time: a door's or window's own place picks it)
const pick = (x, z) => Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;

const VS = /* glsl */ `
  attribute vec4 look;   // size (m), strength, kind (0: a soft glow; 1: a flame's core; 2: a lit window; 3: a spark), rise (m)
  attribute float seed;
  uniform float uTime, uPx, uStrength;
  varying float vA, vZ, vR, vFlame, vSize;
  void main() {
    float s = seed * 61.0;
    // the flames lick up and fall back, each its own way
    vec3 p = position + vec3(0.025 * sin(uTime * 3.1 + s), look.w * (0.5 + 0.5 * sin(uTime * (5.0 + 3.0 * seed) + s)), 0.025 * cos(uTime * 2.7 + s));
    // a spark: thrown up out of the fire over and over, drifting, going out as it rises
    float life = fract(uTime * (0.35 + 0.4 * seed) + seed * 7.0);
    if (look.z > 2.5) p = position + vec3(0.25 * sin(life * 5.0 + s) * life, look.w * life, 0.25 * cos(life * 4.0 + s * 1.3) * life);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vZ = -mv.z;
    gl_Position = projectionMatrix * mv;
    // (a point can be only so big: close by, the glow is fitted into the largest, rather than cut off at its edge)
    float px = look.x * uPx / max(vZ, 0.3);
    gl_PointSize = clamp(px, 2.0, 480.0);
    vR = 1.0;
    vFlame = look.z;
    vSize = look.x;
    // (a flame flickers; a lamp behind a window, still, hardly at all)
    float flicker = look.z > 1.5 ? 0.96 + 0.04 * sin(uTime * 2.3 + s) : 0.82 + 0.1 * sin(uTime * 8.3 + s) + 0.08 * sin(uTime * 14.7 + s * 1.7);
    vA = uStrength * look.y * flicker * (1.0 - smoothstep(300.0, 500.0, vZ)) * (look.z > 2.5 ? pow(1.0 - life, 1.5) * step(0.03, life) : 1.0);
  }`;

const FS = /* glsl */ `
  uniform sampler2D tLight;
  uniform vec2 uTexel;
  uniform vec3 uCore, uFlame, uGlow, uLamp;
  varying float vA, vZ, vR, vFlame, vSize;
  void main() {
    if (vA < 0.002) discard;
    // behind something? (the light on the ground and the walls is worked out with the rest of the light, shade.js
    // fireLight: these are only the glow in the air, so they stop at whatever stands in front)
    if (texture2D(tLight, gl_FragCoord.xy * uTexel).g < vZ - 0.12 - vSize * 0.08) discard;
    float r = length(gl_PointCoord - 0.5) * 2.0 / max(vR, 0.05), r2 = r * r;
    vec3 c = vFlame > 2.5 ? uCore * exp(-r2 * 5.0) * 1.6
      : vFlame > 1.5 ? uLamp * (exp(-r2 * 9.0) * 0.9 + exp(-r2 * 2.5) * 0.25)
      : vFlame > 0.5 ? uCore * exp(-r2 * 14.0) * 1.4 + uFlame * exp(-r2 * 4.5) * 0.8
      : uGlow * exp(-r2 * 3.2);
    gl_FragColor = vec4(c * vA * (1.0 - smoothstep(0.85, 1.0, r * vR)), 1.0);
  }`;

// a flame: an upright quad turned to face the eye (about the vertical only), and on it
// the flame drawn: a teardrop, widest a third of the way up, its sides torn by noise rising through it faster and
// faster towards the tip, so tongues lick up and break off; hottest (pale yellow, near white) low in the middle,
// orange round it, red and fading at the tips. Brighter than white at the core, so it reads as burning
const FLAME_VS = /* glsl */ `
  attribute vec3 base;
  attribute vec3 shape;   // width, height (m), seed
  uniform float uTime;
  varying vec2 vUv;
  varying float vZ, vSeed;
  void main() {
    vUv = uv;
    vSeed = shape.z;
    // a little sway, the whole flame, as the air moves
    vec3 b = base + vec3(0.03 * sin(uTime * 1.7 + shape.z * 40.0), 0.0, 0.03 * cos(uTime * 1.3 + shape.z * 31.0)) * shape.y;
    vec4 mv = viewMatrix * vec4(b, 1.0);
    vec3 up = (viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz;
    mv.xyz += vec3((uv.x - 0.5) * shape.x, 0.0, 0.0) + up * uv.y * shape.y;
    vZ = -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const FLAME_FS = /* glsl */ `
  uniform sampler2D tLight;
  uniform vec2 uTexel;
  uniform float uTime, uStrength;
  varying vec2 vUv;
  varying float vZ, vSeed;
  float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vn(vec2 x) {
    vec2 i = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) { return vn(p) * 0.55 + vn(p * 2.1 + 3.7) * 0.3 + vn(p * 4.3 + 9.1) * 0.15; }
  void main() {
    if (uStrength <= 0.0) discard;
    if (texture2D(tLight, gl_FragCoord.xy * uTexel).g < vZ - 0.15) discard;
    vec2 p = vec2(vUv.x - 0.5, vUv.y);
    float t = uTime + vSeed * 17.0;
    // the noise rising through it, quicker higher up; it pushes the flame sideways, more the higher
    float n = fbm(vec2(p.x * 3.2 + vSeed * 9.0, p.y * 2.4 - t * 2.6));
    float m = fbm(vec2(p.x * 7.0 - vSeed * 5.0, p.y * 5.5 - t * 4.2));
    p.x += ((n - 0.5) * 0.42 + (m - 0.5) * 0.16) * p.y;
    // its outline: a teardrop, widest a third of the way up
    float w = 0.47 * pow(clamp(p.y * 2.6, 0.0, 1.0), 0.5) * pow(clamp(1.0 - p.y, 0.0, 1.0), 1.1);
    float d = abs(p.x) / max(w, 1e-3);
    float body = 1.0 - smoothstep(0.55, 1.0, d);
    // the top torn into tongues: where the noise is low near the tip there is no flame
    body *= smoothstep(0.0, 0.25, n + m * 0.5 + (1.0 - p.y) * 1.1 - 0.75);
    if (body <= 0.001) discard;
    float heat = (1.0 - d) * (1.0 - p.y) * (0.75 + 0.5 * n);
    vec3 c = mix(vec3(0.75, 0.16, 0.03), vec3(1.0, 0.52, 0.12), smoothstep(0.05, 0.35, heat));
    c = mix(c, vec3(1.25, 1.05, 0.7), smoothstep(0.35, 0.75, heat));
    gl_FragColor = vec4(c * body * uStrength * (0.9 + 0.1 * sin(t * 11.0)), 1.0);
  }`;

// heightAt: the ground; doors, windows: the town's (houseKit.js), each with its place and which way it faces
export function createFires(scene, { heightAt, doors = [], windows = [] }) {
  // ---- the hearths: stones, ash, logs ----
  const group = new THREE.Group();
  group.name = 'night fires';
  scene.add(group);
  const rng = makeRng(6200);
  const kit = makeKit({ rng, heightAt, openAt: () => false });
  const { get } = kit;
  const SPHERE = new THREE.SphereGeometry(1, 9, 6).deleteAttribute('uv');
  const at = (p, q, s) => new THREE.Matrix4().compose(p, q, s);
  const Y = V(0, 1, 0);
  const glows = [];   // [position, size, strength, kind, rise]
  const flames = [];  // [its foot, width, height]
  // the light each throws on what is round it (shade.js fireLight): where it comes from, how far it reaches, how
  // strong, the ground it stands on
  const lights = [];
  for (const f of FIRES) {
    const c = V(f.x, f.y, f.z);
    // the ring of stones, the ash in it
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 + rng() * 0.2, r = 0.5 + rng() * 0.05;
      get('stone').add(SPHERE, at(V(c.x + Math.cos(a) * r, c.y + 0.04, c.z + Math.sin(a) * r), new THREE.Quaternion().setFromAxisAngle(Y, rng() * 6), V(0.13 + rng() * 0.05, 0.1 + rng() * 0.03, 0.1 + rng() * 0.04)));
    }
    get('dark').add(SPHERE, at(V(c.x, c.y - 0.01, c.z), new THREE.Quaternion(), V(0.44, 0.04, 0.44)));
    // the logs, laid crossways over it, their ends burnt
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI + rng() * 0.3, d = V(Math.cos(a), 0, Math.sin(a)), h = 0.07 + k * 0.045;
      const p0 = c.clone().addScaledVector(d, -0.42).setY(c.y + h), p1 = c.clone().addScaledVector(d, 0.42).setY(c.y + h + 0.02);
      get('wood').tube([p0, p0.clone().lerp(p1, 0.3)], [0.045, 0.045], 6);
      get('dark').tube([p0.clone().lerp(p1, 0.3), p1], [0.045, 0.04], 6);
    }
    // the flames: three, side by side and one behind the other, so it has some body from any side; the glow of it
    // in the air; the embers under it; sparks thrown up; and the light round it on the ground and the walls
    for (const [dx, dz, w, h] of [[0, 0, 0.62, 0.95], [0.12, 0.07, 0.42, 0.7], [-0.1, -0.06, 0.45, 0.62]]) flames.push([V(c.x + dx, c.y + 0.08, c.z + dz), w, h]);
    glows.push([c.clone().setY(c.y + 0.35), 1.4, 0.45, 0, 0]);
    glows.push([c.clone().setY(c.y + 0.06), 1.2, 0.8, 0, 0]);
    for (let k = 0; k < 8; k++) glows.push([c.clone().setY(c.y + 0.4), 0.05, 1.0, 3, 1.6 + 0.8 * rng()]);
    lights.push({ p: c.clone().setY(c.y + 0.45), r: 7.5, k: 0.9, b: c.y });
  }
  kit.meshes(group);

  // ---- the torches: by day unlit, there all the same ----
  const torches = new THREE.Group();
  torches.name = 'torches';
  scene.add(torches);
  const tkit = makeKit({ rng, heightAt, openAt: () => false });
  const RING = new THREE.TorusGeometry(0.045, 0.012, 6, 12).rotateX(Math.PI / 2).deleteAttribute('uv');
  // on a wall at w (its face, the bracket's height), facing n
  const torch = (w, n) => {
    const out = (d, dy = 0) => w.clone().addScaledVector(n, d).add(V(0, dy, 0));
    tkit.get('bronze').tube([out(0), out(0.15)], [0.016, 0.014], 5);
    tkit.get('bronze').add(RING, at(out(0.17), new THREE.Quaternion(), V(1, 1, 1)));
    // the stick through the ring, leaning out from the wall; its head, wrapped and black with bitumen
    const foot = out(0.1, -0.32), top = out(0.25, 0.42), dir = top.clone().sub(foot).normalize();
    tkit.get('wood').tube([foot, top], [0.022, 0.026], 6);
    const head = top.clone().addScaledVector(dir, 0.2);
    tkit.get('dark').tube([top.clone().addScaledVector(dir, -0.02), head], [0.05, 0.056], 7);
    for (const t of [0.05, 0.13]) tkit.get('straw').tube([top.clone().addScaledVector(dir, t - 0.008), top.clone().addScaledVector(dir, t + 0.008)], [0.058, 0.058], 7);
    // its flame, up off the head; its glow in the air, a spark or two; and its light on the wall and the ground
    const f = head.clone().addScaledVector(dir, -0.04);
    flames.push([f, 0.26, 0.48]);
    flames.push([f.clone().add(V(0.02, 0, 0.02)), 0.18, 0.34]);
    glows.push([f.clone().add(V(0, 0.15, 0)), 0.7, 0.4, 0, 0]);
    for (let k = 0; k < 2; k++) glows.push([f.clone().add(V(0, 0.2, 0)), 0.035, 0.9, 3, 0.9]);
    lights.push({ p: f.clone().add(V(0, 0.15, 0)).addScaledVector(n, 0.1), r: 4.5, k: 0.6, b: w.y - 1.8 });
  };
  // beside some of the doors (four in ten), on one side or the other, a hand above the head
  for (const d of doors) {
    const h = pick(d.x, d.z), hand = TORCH_AT.find((o) => Math.hypot(o.x - d.x, o.z - d.z) < 0.5);
    if (hand?.none || (!hand && h > 0.4)) continue;
    const n = V(d.n.x, 0, d.n.z), side = hand?.side ?? (h < 0.2 ? 1 : -1), perp = V(n.z, 0, -n.x);
    const face = V(d.x, 0, d.z).addScaledVector(n, -0.6).addScaledVector(perp, (hand?.off ?? 0.95) * side);
    torch(face.setY((d.y ?? heightAt(d.x, d.z)) + 1.75), n);
  }
  for (const g of GATE_TORCHES) torch(V(g.x, g.y + 2.1, g.z), V(1, 0, 0));
  tkit.meshes(torches);

  // ---- lamplight in some of the windows ----
  for (const w of windows) {
    if (pick(w.x, w.z) > 0.3) continue;
    glows.push([V(w.x, w.y, w.z), w.w * 2.4, 0.85, 2, 0]);
  }

  // ---- the flames and their light ----
  const over = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uPx: { value: 1000 }, uStrength: { value: 0 },
      tLight: { value: null }, uTexel: { value: new THREE.Vector2() },
      uCore: { value: new THREE.Vector3(1.0, 0.88, 0.62) }, uFlame: { value: new THREE.Vector3(1.0, 0.5, 0.16) },
      uGlow: { value: new THREE.Vector3(1.0, 0.48, 0.18) }, uLamp: { value: new THREE.Vector3(1.0, 0.62, 0.26) },
    },
    vertexShader: VS, fragmentShader: FS,
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(glows.flatMap(([p]) => [p.x, p.y, p.z])), 3));
  g.setAttribute('look', new THREE.BufferAttribute(new Float32Array(glows.flatMap(([, s, a, f, r]) => [s, a, f, r])), 4));
  g.setAttribute('seed', new THREE.BufferAttribute(new Float32Array(glows.map((_, i) => (i * 0.618034) % 1)), 1));
  const points = new THREE.Points(g, mat);
  points.frustumCulled = false;
  over.add(points);
  const u = mat.uniforms;
  // the flames themselves: a quad each, instanced
  const fg = new THREE.InstancedBufferGeometry();
  fg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12), 3));
  fg.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
  fg.setIndex([0, 1, 2, 0, 2, 3]);
  fg.setAttribute('base', new THREE.InstancedBufferAttribute(new Float32Array(flames.flatMap(([p]) => [p.x, p.y, p.z])), 3));
  fg.setAttribute('shape', new THREE.InstancedBufferAttribute(new Float32Array(flames.flatMap(([, w, h], i) => [w, h, (i * 0.618034) % 1])), 3));
  fg.instanceCount = flames.length;
  const fmat = new THREE.ShaderMaterial({
    uniforms: { uTime: u.uTime, uStrength: u.uStrength, tLight: u.tLight, uTexel: u.uTexel },
    vertexShader: FLAME_VS, fragmentShader: FLAME_FS,
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const flameMesh = new THREE.Mesh(fg, fmat);
  flameMesh.frustumCulled = false;
  over.add(flameMesh);
  return {
    // strength: 0 out (and the hearths not there), 1 burning
    apply(strength) {
      u.uStrength.value = strength;
      group.visible = strength > 0;
    },
    get on() { return u.uStrength.value > 0; },
    lights,
    draw(renderer, camera, { time, light, texel, px }) {
      u.uTime.value = time;
      u.uPx.value = px;
      u.tLight.value = light;
      u.uTexel.value.copy(texel);
      renderer.render(over, camera);
    },
  };
}
