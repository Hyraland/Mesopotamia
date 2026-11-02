// The river's and canals' reflections, painted over the finished picture. The water's own surface (its colour,
// the current's streaks, the shallows, the wet line at the bank) is drawn with everything else (shade.js FLOW),
// which marks its pixels in the light buffer. Here each of them follows its mirrored ray across the picture
// (screen-space: the far bank's palms and reeds, the ziggurat, the boats are on the screen already) until it
// passes behind something, and takes that colour; a ray that leaves the picture takes the sky's.
//
// So that it stays painted rather than a sharp mirror: the water's surface is wobbled by slow ripples drawn out
// along the current (a reflection breaks up and stretches downward as on real water), it is only partly a mirror
// (more the more slantingly it is seen: Fresnel), and the mirror is broken into bands across the flow, stronger
// and weaker, as wind and current roughen it. Highlights and glints (brighter than white) stay on top.

import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const FS = /* glsl */ `
  uniform sampler2D tColor, tLight;
  uniform mat4 uProj, uInvProj, uView, uCamWorld;
  uniform vec3 uSkyTop, uSkyHorizon, uDiscDir, uDiscColor;
  uniform float uDisc, uDiscCos, uDiscGlow;
  uniform float uSkyCurve, uTime, uAmount, uBase, uWobble, uBands, uSoft, uRange;
  varying vec2 vUv;

  float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vn(vec2 x) {
    vec2 i = floor(x), f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
  }
  // the sky as the picture paints it, and in it the low sun or the moon (timeOfDay.js): its disc, and a wider halo,
  // so that the ripples, tilting the mirror this way and that, draw it out into a path of light across the water
  vec3 skyDir(vec3 d) {
    vec3 c = mix(uSkyHorizon, uSkyTop, pow(max(d.y, 0.0), uSkyCurve));
    if (uDisc > 0.0) {
      float m = max(dot(d, uDiscDir), 0.0);
      c += uDiscColor * uDisc * (smoothstep(uDiscCos - 0.0002, uDiscCos + 0.0002, m) * 1.6 + 0.35 * pow(m, 90.0) + uDiscGlow * pow(m, 12.0));
    }
    return c;
  }

  void main() {
    vec4 col = texture2D(tColor, vUv);
    vec4 L = texture2D(tLight, vUv);
    // (water is marked 64 and up; where only part of a pixel is water, its mark is averaged down: half or more)
    if (L.b < 48.0 || uAmount <= 0.0) { gl_FragColor = col; return; }

    // this pixel's point, in view space and in the world
    vec4 fv = uInvProj * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
    vec3 dir = fv.xyz / fv.w;
    vec3 P = dir * (L.g / -dir.z);
    vec3 Pw = (uCamWorld * vec4(P, 1.0)).xyz, eye = uCamWorld[3].xyz;

    // the surface: slow ripples, longer than they are wide, tilting the mirror a little
    vec2 q = Pw.xz;
    float t = uTime;
    vec2 wob = vec2(vn(q * vec2(0.9, 0.22) + vec2(0.0, t * 0.35)) - 0.5, vn(q * vec2(0.25, 1.1) + vec2(t * 0.3, 17.0)) - 0.5);
    wob += 0.5 * vec2(vn(q * 2.7 + t * 0.6 + 3.0) - 0.5, vn(q * 2.3 - t * 0.5 + 9.0) - 0.5);
    vec3 N = normalize(vec3(wob.x * uWobble, 1.0, wob.y * uWobble * 0.4));
    vec3 V = normalize(Pw - eye);
    vec3 R = reflect(V, N);
    R.y = max(R.y, 0.004);

    // follow the mirrored ray across the picture, in growing steps, until it passes behind what is drawn there
    vec3 Rv = (uView * vec4(R, 0.0)).xyz;
    vec3 refl = skyDir(R);
    float s = 0.4, prev = 0.0;
    for (int i = 0; i < 48; i++) {
      s = s * 1.12 + 0.15;
      if (s > uRange) break;
      vec3 Q = P + Rv * s;
      if (Q.z > -0.2) break;
      vec4 cq = uProj * vec4(Q, 1.0);
      vec2 uv = cq.xy / cq.w * 0.5 + 0.5;
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) break;
      vec4 Lq = texture2D(tLight, uv);
      float behind = -Q.z - Lq.g;
      if (behind > 0.0 && behind < max(s - prev, 0.6) * 1.5 && Lq.b < 48.0) {
        // back up half a step and look again, for a cleaner edge
        vec3 Q2 = P + Rv * (s - (s - prev) * 0.5);
        vec4 c2 = uProj * vec4(Q2, 1.0);
        vec2 uv2 = c2.xy / c2.w * 0.5 + 0.5;
        vec4 L2 = texture2D(tLight, uv2);
        refl = texture2D(tColor, (-Q2.z - L2.g > 0.0 && L2.b < 48.0) ? uv2 : uv).rgb;
        break;
      }
      prev = s;
    }

    // how much of a mirror it is here: more the more slantingly it is seen, broken into bands across the flow
    float cosv = clamp(-dot(V, N), 0.0, 1.0);
    float F = uBase + (1.0 - uBase) * pow(1.0 - cosv, 4.0);
    float band = vn(vec2(dot(q, vec2(0.06, 0.6)), t * 0.05)) * 0.7 + vn(q * vec2(0.13, 1.4) + 5.0) * 0.3;
    float k = uAmount * F * mix(1.0, smoothstep(0.38, 0.38 + uSoft, band) * 0.55 + 0.45, uBands);
    vec3 outc = mix(col.rgb, min(refl, vec3(1.0)), clamp(k, 0.0, 1.0));
    // the highlights and glints (pushed above white) stay
    if (max(col.r, max(col.g, col.b)) > 1.0) outc = max(outc, col.rgb);
    gl_FragColor = vec4(outc, col.a);
  }
`;

export function createWater() {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: null }, tLight: { value: null },
      uProj: { value: new THREE.Matrix4() }, uInvProj: { value: new THREE.Matrix4() },
      uView: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() },
      uSkyTop: { value: new THREE.Vector3() }, uSkyHorizon: { value: new THREE.Vector3() }, uSkyCurve: { value: 1 },
      uTime: { value: 0 }, uAmount: { value: 0.8 }, uBase: { value: 0.25 }, uWobble: { value: 0.05 },
      uBands: { value: 0.6 }, uSoft: { value: 0.04 }, uRange: { value: 600 },
      uDisc: { value: 0 }, uDiscDir: { value: new THREE.Vector3(0, 1, 0) }, uDiscColor: { value: new THREE.Vector3(1, 1, 1) },
      uDiscCos: { value: 0.9998 }, uDiscGlow: { value: 0 },
    },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: FS,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new FullScreenQuad(mat);
  const u = mat.uniforms;
  return {
    // the look (tuning.water) and the sky (as the picture paints it)
    apply(W, sky) {
      u.uAmount.value = W.on ? W.reflect : 0;
      u.uBase.value = W.facing;
      u.uWobble.value = W.wobble;
      u.uBands.value = W.bands;
      u.uSkyTop.value.copy(sky.top);
      u.uSkyHorizon.value.copy(sky.horizon);
      u.uSkyCurve.value = sky.curve;
      const D = sky.disc;
      u.uDisc.value = D ? D.strength : 0;
      if (D) { u.uDiscDir.value.copy(D.dir); u.uDiscColor.value.copy(D.color); u.uDiscCos.value = D.cos; u.uDiscGlow.value = D.glow; }
    },
    // from the finished picture (source) and the light buffer into target
    draw(renderer, camera, source, light, target, time) {
      u.tColor.value = source.texture;
      u.tLight.value = light;
      u.uProj.value.copy(camera.projectionMatrix);
      u.uInvProj.value.copy(camera.projectionMatrixInverse);
      u.uView.value.copy(camera.matrixWorldInverse);
      u.uCamWorld.value.copy(camera.matrixWorld);
      u.uTime.value = time;
      renderer.setRenderTarget(target);
      quad.render(renderer);
    },
  };
}
