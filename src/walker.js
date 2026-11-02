// Walking (and flying) in first person. Drag to look round; WASD / arrows to walk, Shift to run; F to fly
// (Space up, C down). The walker stands on the ground and on the buildings, climbs steps up to STEP high and
// stops at anything taller. Its rays go through three-mesh-bvh (see level.js), so testing the buildings'
// hundreds of thousands of triangles costs next to nothing.

import * as THREE from 'three';

const EYE = 1.7, STEP = 0.65, GRAVITY = 22;
// the feet: the ground is felt at the centre and four points FOOT round it, the highest counting, so a joint
// between two blocks (a few centimetres) is not a hole to fall into
const FOOT = 0.2, FEET = [[0, 0], [FOOT, 0], [-FOOT, 0], [0, FOOT], [0, -FOOT]];
// the eye follows the feet up a step over a moment (EASE per second), not in one jump
const EASE = 14;

export class Walker {
  constructor(camera, dom, { groundAt, walkables, bounds }) {
    this.camera = camera;
    this.groundAt = groundAt;
    this.walkables = walkables;
    this.bounds = bounds;
    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0.04;
    this.vy = 0;
    this.fly = false;
    this.speed = 1;
    // only to the left and the right, the view held (the mosaic room): no turning, no flying
    this.sideways = false;
    this.keys = new Set();
    this.ray = new THREE.Raycaster();
    this.ray.firstHitOnly = true;

    let drag = null;
    dom.addEventListener('pointerdown', (e) => {
      drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
      dom.setPointerCapture(e.pointerId);
    });
    dom.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id || this.sideways) return;
      const k = 0.0042 * (this.camera.fov / 70);
      this.yaw -= (e.clientX - drag.x) * k;
      this.pitch = THREE.MathUtils.clamp(this.pitch - (e.clientY - drag.y) * k, -1.45, 1.45);
      drag.x = e.clientX;
      drag.y = e.clientY;
    });
    const end = () => { drag = null; };
    dom.addEventListener('pointerup', end);
    dom.addEventListener('pointercancel', end);
    addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey) return;
      this.keys.add(e.code);
      if (e.code === 'KeyF' && !e.repeat && !this.sideways) {
        this.fly = !this.fly;
        this.vy = 0;
        this.onMode?.(this.fly);
      }
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
  }

  place(x, z, yaw = 0) {
    this.pos.set(x, this.ground(x, z, 1e4), z);
    this.eyeY = this.pos.y;
    this.yaw = yaw;
  }

  // the highest surface under the feet at (x, z) no higher than `below`
  ground(x, z, below) {
    let g = this.groundAt(x, z);
    for (const [dx, dz] of FEET) {
      const lo = this.groundAt(x + dx, z + dz);
      this.ray.set(new THREE.Vector3(x + dx, below, z + dz), new THREE.Vector3(0, -1, 0));
      this.ray.far = below - lo + 0.01;
      const hit = this.ray.intersectObjects(this.walkables, false)[0];
      if (hit) g = Math.max(g, hit.point.y);
    }
    return g;
  }

  // is there something standing in the way between here and a step ahead, at knee and at chest height?
  blocked(from, dir, dist) {
    for (const h of [STEP + 0.15, 1.4]) {
      this.ray.set(new THREE.Vector3(from.x, from.y + h, from.z), dir);
      this.ray.far = dist + 0.35;
      if (this.ray.intersectObjects(this.walkables, false).length) return true;
    }
    return false;
  }

  update(dt) {
    const k = this.keys;
    const fwd = this.sideways ? 0 : (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const side = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const run = k.has('ShiftLeft') || k.has('ShiftRight');
    const sp = (this.fly ? (run ? 60 : 18) : run ? 9 : 3.6) * this.speed;
    const move = new THREE.Vector3(
      -Math.sin(this.yaw) * fwd + Math.cos(this.yaw) * side, 0, -Math.cos(this.yaw) * fwd - Math.sin(this.yaw) * side,
    );
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(sp * dt);
    const B = this.bounds;

    if (this.fly) {
      if (this.pitch !== 0 && fwd !== 0) move.y = Math.sin(this.pitch) * sp * dt * fwd;
      move.y += ((k.has('Space') ? 1 : 0) - (k.has('KeyC') ? 1 : 0)) * sp * dt;
      this.pos.add(move);
      this.pos.x = THREE.MathUtils.clamp(this.pos.x, -B.fly, B.fly);
      this.pos.z = THREE.MathUtils.clamp(this.pos.z, -B.fly, B.fly);
      this.pos.y = Math.min(Math.max(this.pos.y, this.groundAt(this.pos.x, this.pos.z)), 420);
    } else {
      const dist = move.length();
      // the whole step, or failing that its part along x or along z (so one slides along a wall or the bounds)
      const step = (mx, mz) => {
        const len = Math.hypot(mx, mz);
        if (len < 1e-6) return false;
        const nx = THREE.MathUtils.clamp(this.pos.x + mx, -B.walk, B.walk);
        const nz = THREE.MathUtils.clamp(this.pos.z + mz, -B.walk, B.walk);
        if (B.inside && !B.inside(nx, nz)) return false;
        if (this.blocked(this.pos, new THREE.Vector3(mx, 0, mz).normalize(), len)) return false;
        if (this.ground(nx, nz, this.pos.y + STEP) > this.pos.y + STEP) return false;
        this.pos.x = nx;
        this.pos.z = nz;
        return true;
      };
      if (dist > 0) step(move.x, move.z) || step(move.x, 0) || step(0, move.z);
      const g = this.ground(this.pos.x, this.pos.z, this.pos.y + STEP);
      if (this.pos.y > g + 0.02) {
        this.vy -= GRAVITY * dt;
        this.pos.y = Math.max(g, this.pos.y + this.vy * dt);
      } else {
        this.vy = 0;
        this.pos.y = g;
      }
    }

    if (this.fly || this.eyeY === undefined) this.eyeY = this.pos.y;
    else this.eyeY += (this.pos.y - this.eyeY) * (1 - Math.exp(-EASE * dt));
    this.camera.position.set(this.pos.x, this.eyeY + EYE, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}
