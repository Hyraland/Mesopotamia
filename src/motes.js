// Dust and pollen in the air: specks a millimetre or two across hanging round the eye, slowly drifting (dust
// floating, pollen settling), seen only where the sun reaches them, and brightest looking towards the sun (they
// scatter its light forward) — so they show in the shafts and pools of sunlight and vanish in the shade.
//
// Drawn over the finished picture (draw, below) as glowing points: each looks up the sun's shadow map to see if
// it is in the sun, and the light buffer's depth to see if something stands in front of it. They fill a box
// round the eye, each wrapping to its far side as it leaves (faded out before it does), so the air is always
// full where one is.

import * as THREE from 'three';

const VS = /* glsl */ `
  #include <packing>
  attribute vec4 seed;
  uniform vec3 uEye, uSunDir;
  uniform float uTime, uReach, uSize, uPx, uPollen, uBright, uShadowBias;
  uniform sampler2D tShadow;
  uniform mat4 uShadowMatrix;
  varying float vA, vZ, vPollen;
  void main() {
    vPollen = step(1.0 - uPollen, seed.w);
    float s = seed.w * 61.0;
    // drifting: dust wanders and hangs, pollen sinks
    vec3 drift = vec3(0.3 * sin(uTime * 0.11 + s), 0.15 * sin(uTime * 0.07 + s * 1.3), 0.3 * cos(uTime * 0.09 + s * 0.7));
    drift.y += (vPollen > 0.5 ? -0.045 : 0.008) * uTime;
    vec3 w = seed.xyz * uReach + drift;
    w = uEye + mod(w - uEye + 0.5 * uReach, uReach) - 0.5 * uReach;
    vec4 mv = viewMatrix * vec4(w, 1.0);
    vZ = -mv.z;
    gl_Position = projectionMatrix * mv;
    // in the sun? (outside the shadow map: no)
    vec4 sp = uShadowMatrix * vec4(w, 1.0);
    float sun = 0.0;
    if (sp.x > 0.0 && sp.x < 1.0 && sp.y > 0.0 && sp.y < 1.0 && sp.z < 1.0)
      sun = step(sp.z - uShadowBias, unpackRGBAToDepth(texture2D(tShadow, sp.xy)));
    // brighter looking towards the sun; faded out towards the box's edge and very close
    vec3 toward = normalize(w - uEye);
    float forward = 0.25 + 2.2 * pow(max(dot(toward, uSunDir), 0.0), 6.0);
    float d = length(w - uEye);
    float fade = (1.0 - smoothstep(0.3 * uReach, 0.48 * uReach, d)) * smoothstep(0.25, 0.6, d);
    // its true size on the screen (pixels). A speck in a sunbeam shows as a round point of light far bigger than
    // itself (its glare): drawn as a soft round glow some pixels across, its middle never past white (a small
    // sprite lit past white filled its whole square: the specks flashed as little squares)
    float size = (vPollen > 0.5 ? 1.6 : 1.0) * uSize * 0.001 * uPx / max(vZ, 0.05) * (0.6 + 0.8 * fract(s));
    gl_PointSize = clamp(size * 4.0, 6.0, 26.0);
    vA = min(sun * forward * fade * uBright * 2.4 * min(1.0, sqrt(size / 2.0)), 1.1);
  }`;

const FS = /* glsl */ `
  uniform sampler2D tLight;
  uniform vec2 uTexel;
  uniform vec3 uDust, uPollenCol;
  varying float vA, vZ, vPollen;
  void main() {
    if (vA < 0.002) discard;
    // behind something?
    if (texture2D(tLight, gl_FragCoord.xy * uTexel).g < vZ) discard;
    // a round glow: bright at the middle, falling off softly, nothing left at the sprite's edge
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float a = vA * exp(-r * r * 7.0) * (1.0 - smoothstep(0.8, 1.0, r));
    gl_FragColor = vec4((vPollen > 0.5 ? uPollenCol : uDust) * a, 1.0);
  }`;

export function createMotes() {
  const scene = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uEye: { value: new THREE.Vector3() }, uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uTime: { value: 0 }, uReach: { value: 16 }, uSize: { value: 1.5 }, uPx: { value: 1000 }, uPollen: { value: 0.25 },
      uBright: { value: 1 }, uShadowBias: { value: 0.0003 },
      tShadow: { value: null }, uShadowMatrix: { value: new THREE.Matrix4() },
      tLight: { value: null }, uTexel: { value: new THREE.Vector2() },
      uDust: { value: new THREE.Vector3(1, 0.97, 0.9) }, uPollenCol: { value: new THREE.Vector3(1, 0.9, 0.55) },
    },
    vertexShader: VS, fragmentShader: FS,
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  let points = null;

  function make(count) {
    if (points) { scene.remove(points); points.geometry.dispose(); }
    const seed = new Float32Array(count * 4);
    for (let i = 0; i < seed.length; i++) seed[i] = Math.random();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 4));
    points = new THREE.Points(g, mat);
    points.frustumCulled = false;   // (where they are is worked out in the shader)
    scene.add(points);
  }

  const u = mat.uniforms;
  return {
    make,
    apply(m, sunColor) {
      u.uReach.value = m.reach;
      u.uSize.value = m.size;
      u.uBright.value = m.bright;
      u.uPollen.value = m.pollen;
      u.uDust.value.set(...sunColor);
    },
    // over the picture in the current render target. light: the light buffer; shadow: the sun's shadow (its map
    // and matrix, and its depth range in metres); px: pixels per metre at 1 m
    draw(renderer, camera, { time, sunDir, light, texel, shadow, px }) {
      if (!points || !shadow.map) return;
      u.uEye.value.copy(camera.position);
      u.uSunDir.value.copy(sunDir);
      u.uTime.value = time;
      u.uPx.value = px;
      u.tShadow.value = shadow.map;
      u.uShadowMatrix.value.copy(shadow.matrix);
      u.uShadowBias.value = 0.05 / shadow.range;
      u.tLight.value = light;
      u.uTexel.value.copy(texel);
      renderer.render(scene, camera);
    },
  };
}
