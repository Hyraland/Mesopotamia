// The eagle's view: on the ziggurat's top terrace a word at the foot of the picture, E; with it the eye leaves the walker and goes with an eagle, just
// behind it and a little above, as it flies. From the ziggurat: down its great stair to below its first stage, right
// over the houses to above the lookout, then towards the river over the houses to the old hall's ruins and along
// between its two rows of pillars, a little over their tops; then left, over the en-priestess's house and Enki's
// temple, and up, back over the ziggurat where it set out (the one high place now). Then the
// eye comes down to where one stood, looking where one looked. Any key or a click cuts it short (down at once).
//
// The eagle: a golden eagle (the eagle of the Anzu's lion-headed bird, of the Etana story, carried up to heaven):
// dark brown, the nape and crown golden, the cere yellow and the beak's horn dark, hooked; the tail of twelve
// feathers fanned; the wings long and broad, the coverts paler in rows, the primaries spread at their tips in
// fingers; held mostly still, gliding, now and then beaten. Built feather by feather in Blender
// (tools/build_eagle.py), its wings jointed at the shoulder and the wrist.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { lightMat } from './shade.js';
import { plumageTextures } from './plumage.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
// the high places: where one stands (x, z, the floor's height), how near counts; the eagle's way from there (the
// points it passes, metres; from where one stands, the eye at e). Heights kept clear of the roofs below
export const VIEWPOINTS = [
  {
    name: 'ziggurat', x: 95, z: 54, y: 42.3, near: 4.5,
    route: (e) => [
      e.clone().add(V(-1.5, 0.3, 0)),
      V(88, 42.6, 54), V(78, 35, 54), V(68, 30.5, 53),        // down the great stair, below the first stage
      V(60, 30, 38), V(48, 30, 14), V(36, 28, -6),             // right, over the houses, to the lookout
      V(24, 27, -12), V(8, 25, -6), V(-14, 22, 2),             // towards the river, over the houses
      V(-30, 18, 8), V(-36.8, 16, 15),                         // down to the old hall's north end
      V(-36.2, 16, 23), V(-35.6, 16, 33), V(-35.2, 16.5, 41),  // between its two rows, a little over their tops
      V(-26, 20, 50), V(-4, 24, 66), V(16, 24, 86),            // left, over the houses
      V(32, 24, 99), V(46, 25, 92),                            // over the en-priestess's house
      V(52, 26, 78), V(64, 30, 70),                            // over Enki's temple
      V(80, 46, 62), V(94, 56, 55), V(104, 62, 50),            // up, back over the ziggurat
    ],
  },
];
// how fast the eagle flies (m/s); the eye's place behind it and over it (m); how long the eye takes to come back
const SPEED = 12.5, BEHIND = 4.2, OVER = 1.1, BACK = 2.8;
const ease = (t) => t * t * (3 - 2 * t);

// ---- the eagle (models/eagle/eagle.glb, built by tools/build_eagle.py: its nodes Body, ArmR / ArmL at the
// shoulders, HandR / HandL at the wrists; its materials named after the walk's kinds, lit as everything else; a
// kind_vane or kind_plume one shaded light and dark by its feathers' picture, plumage.js) ----
let EAGLE = null;
export async function loadEagle(url = 'models/eagle/eagle.glb') {
  EAGLE = (await new GLTFLoader().loadAsync(url)).scene;
}
function buildEagle(scene) {
  const root = new THREE.Group();
  root.rotation.order = 'YXZ';
  const bird = EAGLE.clone(true);
  const tex = plumageTextures();
  bird.traverse((o) => {
    if (!o.isMesh) return;
    const [kind, part] = o.material.name.split('_');
    o.material = lightMat({ kind, side: THREE.DoubleSide, detailMap: tex[part] ?? null });
    o.frustumCulled = false;
  });
  root.add(bird);
  root.visible = false;
  scene.add(root);
  const arms = [bird.getObjectByName('ArmR'), bird.getObjectByName('ArmL')];
  const hands = [bird.getObjectByName('HandR'), bird.getObjectByName('HandL')];
  // pose: beat 0..1 how much it is beating its wings (0 gliding); at the time t. The wings lifted a little as it
  // glides (their dihedral); beating, the whole wing swings up and down from the shoulder and the hand follows a
  // little after, bending further, as a bird's does; the downstroke a little forward
  const pose = (t, beat) => {
    const ph = t * 9.5, flap = Math.sin(ph) * beat, lag = Math.sin(ph - 0.7) * beat;
    const glide = 0.1 + 0.03 * Math.sin(t * 1.3);
    [1, -1].forEach((s, k) => {
      arms[k].rotation.set(0, 0.12 * Math.cos(ph) * beat * s, (glide + flap * 0.65) * s);
      hands[k].rotation.set(0, 0, (0.04 + lag * 0.5) * s);
    });
  };
  return { root, pose };
}

// onFlight(seconds): the flight begins, so long; onLanded(cut): it is over (cut: cut short), the eye coming down
export function createFlyover({ scene, camera, walker, letterbox = () => true, onFlight = () => {}, onLanded = () => {} }) {
  const eagle = buildEagle(scene);
  // the word at the foot of the picture, and the bars of the picture going wide
  const hint = document.createElement('div');
  hint.style.cssText = 'position:fixed;left:50%;bottom:64px;transform:translateX(-50%);font:14px/1.6 system-ui,sans-serif;color:#fff;letter-spacing:0.12em;'
    + 'text-shadow:0 0 6px #000,0 0 2px #000;pointer-events:none;opacity:0;transition:opacity 0.6s;z-index:6';
  hint.textContent = '按 E 鸟瞰';
  document.body.appendChild(hint);
  const bars = [0, 1].map((k) => {
    const d = document.createElement('div');
    d.style.cssText = `position:fixed;left:0;right:0;${k ? 'bottom' : 'top'}:0;height:0;background:#000;transition:height 1.2s ease;pointer-events:none;z-index:6`;
    document.body.appendChild(d);
    return d;
  });

  let here = null, run = null;
  const near = () => VIEWPOINTS.find((v) => Math.hypot(walker.pos.x - v.x, walker.pos.z - v.z) < v.near && Math.abs(walker.pos.y - v.y) < 2.5) ?? null;
  const start = () => {
    const eye = camera.position.clone(), q0 = camera.quaternion.clone();
    const curve = new THREE.CatmullRomCurve3(here.route(eye), false, 'centripetal');
    const len = curve.getLength();
    run = { eye, q0, curve, len, t: 0, back: null, cam: eye.clone(), q: q0.clone() };
    eagle.root.visible = true;
    if (letterbox()) bars.forEach((b) => { b.style.height = '9vh'; });
    hint.style.opacity = 0;
    onFlight(len / SPEED);
  };
  const stop = () => {
    run = null;
    here = null;   // (so the word shows again, if one is still there)
    eagle.root.visible = false;
    bars.forEach((b) => { b.style.height = '0'; });
  };
  const cut = () => {
    if (!run || run.back) return;
    run.back = { t: run.t, p: camera.position.clone(), q: camera.quaternion.clone() };
    onLanded(true);
  };
  addEventListener('keydown', (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey) return;
    if (!run && e.code === 'KeyE' && here) { start(); return; }
    if (run && e.code !== 'KeyE') cut();
  });
  addEventListener('pointerdown', cut);

  const look = new THREE.Matrix4(), up = V(0, 1, 0);
  const lookAtQ = (from, to) => new THREE.Quaternion().setFromRotationMatrix(look.lookAt(from, to, up));
  // the eagle at distance d along its way (past the end, on along its last heading, climbing away)
  const at = (r, d) => {
    if (d <= r.len) { const u = d / r.len; return { p: r.curve.getPointAt(u), dir: r.curve.getTangentAt(u) }; }
    const end = r.curve.getPointAt(1), dir = r.curve.getTangentAt(1);
    return { p: end.addScaledVector(dir, d - r.len).add(V(0, (d - r.len) * 0.3, 0)), dir };
  };
  return {
    get on() { return !!run; },
    // each frame: true while it has the eye (the walker not moved then)
    update(dt) {
      if (!run) {
        const was = here;
        here = near();
        if (here !== was) hint.style.opacity = here ? 0.9 : 0;
        return false;
      }
      const r = run;
      r.t += dt;
      const t = r.t, d = t * SPEED;
      // the eagle: along its way; banked into its turns (how fast its heading swings), its wings beaten as it
      // climbs and at the start, now and then after, gliding the rest
      const a = at(r, d), b = at(r, d + 1.5);
      const turn = Math.atan2(a.dir.x * b.dir.z - a.dir.z * b.dir.x, a.dir.x * b.dir.x + a.dir.z * b.dir.z);
      eagle.root.position.copy(a.p);
      eagle.root.rotation.set(-Math.asin(THREE.MathUtils.clamp(a.dir.y, -1, 1)) * 0.8, Math.atan2(a.dir.x, a.dir.z), THREE.MathUtils.clamp(turn * 4, -0.7, 0.7));
      const beat = t < 1.6 || a.dir.y > 0.18 ? 1 : Math.max(0, Math.sin(t * 0.5) - 0.8) * 5;
      eagle.pose(t, Math.min(beat, 1));
      if (!r.back && d > r.len) {
        r.back = { t, p: camera.position.clone(), q: camera.quaternion.clone() };
        onLanded(false);
      }
      if (r.back) {
        // back down to where one stood, looking where one looked
        const k = ease(Math.min((t - r.back.t) / BACK, 1));
        camera.position.copy(r.back.p).lerp(r.eye, k);
        camera.quaternion.copy(r.back.q).slerp(r.q0, k);
        if (k >= 1) stop();
        return true;
      }
      // the eye: behind it and a little over it, looking a little past it along its way; following it softly (it
      // swings a little wide in the turns, as a camera following a bird would)
      const want = a.p.clone().addScaledVector(a.dir, -BEHIND).add(V(0, OVER, 0));
      const aim = at(r, d + 7).p.add(V(0, -0.4, 0));
      const f = 1 - Math.exp(-5 * dt);
      r.cam.lerp(want, f);
      r.q.slerp(lookAtQ(r.cam, aim), 1 - Math.exp(-4 * dt));
      // (from the eye where one stood, at first)
      const k0 = ease(Math.min(t / 1.4, 1));
      camera.position.copy(r.eye).lerp(r.cam, k0);
      camera.quaternion.copy(r.q0).slerp(r.q, k0);
      return true;
    },
  };
}
