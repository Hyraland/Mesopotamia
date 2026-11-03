// 公元前 2100 年的美索不达米亚 — a walk through a southern Mesopotamian river town (after Ur and Eridu): its
// ziggurat, courtyard houses and harbour (the Blender scene), on an alluvial plain of date palm groves, reed
// banks, tamarisks and fields (flora.js). Rendered as 环形废墟 is: everything keeps its own colour, but the
// light has only two states, lit and in shadow, and where they meet each surface gets a thin band of other hues
// climbing from its own shadow colour to its own lit colour (see shade.js for how, palette.js for the band's
// colours).

import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { loadTuning, TUNING_DEFAULTS } from './tuning.js';
import { withTime, timeFrom, TIME_NAMES, blendTuning } from './timeOfDay.js';
import { shared, makeShadeMaterial, groundTexture, DEBUG_VIEWS, SKY_DEPTH, KINDS } from './shade.js';
import { hexToRgb, hexToLin, hexToOklab, bandUniforms, shadeDirOf } from './palette.js';
import { buildHill } from './hillScene.js';
import { Walker } from './walker.js';
import { createMotes } from './motes.js';
import { createFires } from './fires.js';
import { createFlyover, loadEagle } from './flyover.js';
import { createMusic } from './music.js';
import { createMenu } from './menu.js';
import { createWater } from './water.js';
import { lodUpdate } from './lod.js';
import { CopyShader } from 'three/addons/shaders/CopyShader.js';

THREE.ColorManagement.enabled = false;   // every value is ours: light amounts in, sRGB colours out

const status = document.getElementById('status');
const say = (s) => { if (status) status.textContent = s; };
// a moment for the status line to show (a timeout, not a frame: frames wait while the tab is hidden)
const nextFrame = () => new Promise((r) => setTimeout(r, 30));

// the look for each time of day, each from its own file (tuning.js; timeOfDay.js: what dusk and night start from
// before they have one). The one showing is `tuning`; switching (T) puts it away and takes the next one's values
// out into it, in place, so everything holding `tuning` sees them
let timeName = timeFrom(new URLSearchParams(location.search).get('time') ?? 'day');
const stores = { day: await loadTuning() };
for (const n of TIME_NAMES) if (n !== 'day') stores[n] = await loadTuning({ name: n, fallback: withTime(stores.day, n) });
// (the picture's settings, its resolution and the like, and the walk's, are one for all the times: the day's)
for (const n of TIME_NAMES) if (n !== 'day') { stores[n].view = structuredClone(stores.day.view); stores[n].walk = structuredClone(stores.day.walk); }
const tuning = structuredClone(stores[timeName]);
// (the menu's own choice of the automatic resolution, kept in this browser, over the file's)
const AUTO_KEY = 'meso.view.auto';
try { const a = localStorage.getItem(AUTO_KEY); if (a !== null) tuning.view.auto = a === '1'; } catch { /* storage unavailable */ }

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;   // bilinear: smooth dapple edges, no texel stairs
renderer.shadowMap.autoUpdate = false;
renderer.autoClear = false;   // the buffers are cleared by hand (see frame)
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
// (as far as the plain's horizon: some 20 km from the ziggurat's top)
const camera = new THREE.PerspectiveCamera(tuning.view.fov, innerWidth / innerHeight, 0.1, 30000);

// the sun: white, at π so that a surface square to it comes out at exactly 1 in the light buffer
const sun = new THREE.DirectionalLight(0xffffff, Math.PI);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.normalBias = 0.04;
// the depth bias in metres (aim turns it into the shadow camera's depth units): with the camera's depth running
// 1..1500 m, a bias of -0.0004 was 0.6 m, and the shadow at the foot of a block peeled away from it (only what
// stood higher than that cast one, a thin line out on the floor)
sun.userData.biasMetres = 0.08;
sun.shadow.autoUpdate = false;
scene.add(sun, sun.target);
// a second, near shadow map: the same sun over a small square round the walker, fine enough that the leaves'
// shadows at one's feet have smooth edges (the far map's texels are 2-4 cm; these about 1). It carries no light
// of its own (intensity 0): shade.js reads its shadow where it reaches, the far map's beyond, fading across its
// rim. With it on, the far map is redrawn for the wind only every third time the near one is.
const sunNear = new THREE.DirectionalLight(0xffffff, 0);
sunNear.castShadow = true;
sunNear.shadow.mapSize.set(4096, 4096);
sunNear.shadow.normalBias = 0.02;
sunNear.userData.biasMetres = 0.05;
sunNear.shadow.autoUpdate = false;
scene.add(sunNear, sunNear.target);
// (layer 1: what only the near map draws, the reeds (flora.js): seen by the camera, cast into the near map, left
// out of the far one, whose 220 m held millions of their triangles for shadows hardly seen far off; with the near
// map off, the far one takes them: applyTuning)
camera.layers.enable(1);
sunNear.shadow.camera.layers.enable(1);

// the scene: the hill town (山城, hillScene.js)
say('正在堆起城丘、铺开山城…');
await nextFrame();
const world = await buildHill(scene);
shared.uTread.value = world.tread.texture;
shared.uTreadBox.value.set(...world.tread.box);
const start = world.start;

const walker = new Walker(camera, renderer.domElement, {
  groundAt: world.heightAt,
  walkables: world.walkables,
  bounds: { ...world.bounds, inside: world.inside },
});
walker.place(start.x, start.z, start.yaw);
if (start.pitch !== undefined) walker.pitch = start.pitch;
// the eagle's view from the ziggurat's top (flyover.js): E there, the eye goes with an eagle
await loadEagle();
let onTime = null;   // (the menu's: the time now shown)
// the music (music.js): sounding once one first presses something; M turns it off and on; the eagle's flight its own
const music = createMusic({ on: () => tuning.view.music, volume: () => tuning.view.musicVolume });
const flyover = createFlyover({
  scene, camera, walker, letterbox: () => tuning.view.letterbox,
  onFlight: (s) => music.flight(s), onLanded: (cut) => music.landed(cut),
});
music.setTime(timeName);

// dust in the sun (motes.js, drawn over the picture)
const motes = createMotes();
// small fires, torches and lit windows in the town at night (fires.js: the things, and the flames drawn over the
// picture)
const fires = createFires(scene, { heightAt: world.heightAt, doors: world.doors, windows: world.windows });
let lifeKey = '', lifeT = 0, pxPerMetre = 1000;

// ---- the passes ----

// two buffers drawn at once: [0] the light (light, depth, brush noise, coverage), [1] the surface's colour
const rtLight = new THREE.WebGLRenderTarget(1, 1, {
  type: THREE.HalfFloatType, samples: 4, depthBuffer: true, count: 3,
  minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
});
// the finished picture before glare and FXAA; half float, since highlights and glints are pushed above white
const rtColor = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
// the picture with the water's reflections painted in (water.js), when they are on
const rtWater = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
const water = createWater();
const shadeMat = makeShadeMaterial();
shadeMat.uniforms.tLight.value = rtLight.textures[0];
shadeMat.uniforms.tAlbedo.value = rtLight.textures[1];
// (the third, the sun's light here unshadowed, wants one channel, not four: with four samples a pixel, a third
// buffer of four half floats more than doubled the frame's time here (the GPU's tile memory overflowing, most
// likely), one channel costs next to nothing. (One of 8 bits came out empty after the resolve)
rtLight.textures[2].format = THREE.RedFormat;
shadeMat.uniforms.tSun.value = rtLight.textures[2];
// (the same objects as the camera's, so they follow it)
shadeMat.uniforms.uInvProj.value = camera.projectionMatrixInverse;
shadeMat.uniforms.uCamWorld.value = camera.matrixWorld;
// the fires' and torches' light, worked out with the rest (fires.js; shade.js fireLight)
fires.lights.slice(0, 24).forEach((l, i) => {
  shadeMat.uniforms.uFireP.value[i].set(l.p.x, l.p.y, l.p.z, l.r);
  shadeMat.uniforms.uFireK.value[i] = l.k;
  shadeMat.uniforms.uFireB.value[i] = l.b;
});
shadeMat.uniforms.uFireN.value = Math.min(fires.lights.length, 24);
// (how far each one's light gets in each of 32 directions before a wall stops it: rays at its own height, once)
{
  const DIRS = 32, reach = new Float32Array(DIRS * 24), rc = new THREE.Raycaster();
  rc.firstHitOnly = true;
  fires.lights.slice(0, 24).forEach((l, i) => {
    for (let k = 0; k < DIRS; k++) {
      const a = (k / DIRS) * Math.PI * 2;
      rc.set(l.p, new THREE.Vector3(Math.cos(a), 0, Math.sin(a)));
      // (as far as twice its reach: the tuning may lengthen it)
      rc.far = l.r * 2;
      const hit = rc.intersectObjects(world.walkables ?? [], false)[0];
      reach[i * DIRS + k] = hit ? hit.distance : l.r * 2;
    }
  });
  const tex = new THREE.DataTexture(reach, DIRS, 24, THREE.RedFormat, THREE.FloatType);
  tex.needsUpdate = true;
  shadeMat.uniforms.tFireReach.value = tex;
}
shadeMat.uniforms.uShadowMatrix.value = sun.shadow.matrix;
const shadeQuad = new FullScreenQuad(shadeMat);
// the air (light shafts and haze) at half size: it marches through the sun's shadow map for every pixel, the
// costliest part of the picture; the shade pass spreads it back to full size by distance (shade.js hazeUp)
const rtHaze = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
const hazeMat = new THREE.ShaderMaterial({
  uniforms: shadeMat.uniforms, vertexShader: shadeMat.vertexShader, fragmentShader: shadeMat.fragmentShader,
  defines: { HAZE_PASS: '' }, depthTest: false, depthWrite: false,
});
const hazeQuad = new FullScreenQuad(hazeMat);
shadeMat.uniforms.tHaze.value = rtHaze.texture;
const fxaaMat = new THREE.ShaderMaterial(FXAAShader);
fxaaMat.uniforms.tDiffuse.value = rtColor.texture;
const fxaaQuad = new FullScreenQuad(fxaaMat);
// the finished picture straight to the screen (when neither FXAA nor the glare does it)
const toScreen = new FullScreenQuad(new THREE.ShaderMaterial({
  uniforms: THREE.UniformsUtils.clone(CopyShader.uniforms), vertexShader: CopyShader.vertexShader, fragmentShader: CopyShader.fragmentShader,
}));
toScreen.material.uniforms.tDiffuse.value = rtColor.texture;
// glare: what is brighter than the threshold spills a soft halo of light around itself, added over the picture
const glare = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.6, 0.4, 1);
const gl = renderer.getContext();
const skyLight = new Float32Array([1, SKY_DEPTH, 0.5, 1]), skyAlbedo = new Float32Array([1, 1, 1, 1]);
const skySun = new Float32Array([1, 0, 0, 1]);

// auto resolution (view.auto): the share of view.scale drawn now. Every 1.5 s the frame time (averaged) is held
// against the target's; too slow, the picture is drawn smaller (by the square root of the ratio: the cost goes
// with the pixels), with much room to spare, a little larger again, up to the whole of it. (Each change sizes the
// buffers anew, a short hitch: so not oftener, and only by more than 2 %)
let dynScale = 1, ftAvg = 0, ftSince = 0;
// the frame rate, counted over half a second (the menu shows it)
let fpsN = 0, fpsMs = 0, fpsNow = 0;
function countFrame(ms) {
  fpsN++;
  if ((fpsMs += ms) < 500) return;
  fpsNow = (fpsN * 1000) / fpsMs;
  fpsN = fpsMs = 0;
}
function autoScale(ms) {
  const v = tuning.view;
  if (!v.auto) {
    if (dynScale !== 1) { dynScale = 1; resize(); }
    return;
  }
  if (ms > 250) return;   // (a hitch, or the tab was away)
  ftAvg = ftAvg ? ftAvg * 0.95 + ms * 0.05 : ms;
  if ((ftSince += ms) < 1500) return;
  ftSince = 0;
  const want = 1000 / v.target;
  let next = dynScale;
  if (ftAvg > want * 1.08) next = Math.max(v.minScale, dynScale * Math.max(0.85, Math.sqrt(want / ftAvg)));
  else if (ftAvg < want * 0.7) next = Math.min(1, dynScale * 1.06);
  if (Math.abs(next - dynScale) > 0.02) {
    dynScale = next;
    ftAvg = 0;
    resize();
  }
}
let sizeKey = '';
function resize() {
  const W = innerWidth, H = innerHeight;
  const pr = Math.min(devicePixelRatio, 2) * tuning.view.scale * dynScale;
  // (nothing changed: nothing done; the tuning is put to work each frame while the time of day changes)
  const key = `${W}x${H}@${pr}/${camera.fov}`;
  if (key === sizeKey) return;
  sizeKey = key;
  renderer.setPixelRatio(pr);
  renderer.setSize(W, H);
  const w = Math.max(1, Math.floor(W * pr)), h = Math.max(1, Math.floor(H * pr));
  rtLight.setSize(w, h);
  rtColor.setSize(w, h);
  rtWater.setSize(w, h);
  const hw = Math.max(1, Math.ceil(w / 2)), hh = Math.max(1, Math.ceil(h / 2));
  rtHaze.setSize(hw, hh);
  shadeMat.uniforms.uHazeLowSize.value.set(hw, hh);
  // the glare's blur starts from a quarter-size picture (it is soft anyway): a sixteenth of the work
  glare.setSize(Math.max(1, Math.ceil(w / 4)), Math.max(1, Math.ceil(h / 4)));
  shadeMat.uniforms.uTexel.value.set(1 / w, 1 / h);
  shadeMat.uniforms.uPixelAngle.value = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)) / h;
  fxaaMat.uniforms.resolution.value.set(1 / w, 1 / h);
  pxPerMetre = h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

// ---- the sun's shadow follows the walker (re-drawn only when it has moved far enough) ----

const sunDir = new THREE.Vector3();
shadeMat.uniforms.uSunDir.value = sunDir;
const shadowAt = new THREE.Vector3(1e9, 0, 0), nearAt = new THREE.Vector3(1e9, 0, 0);
let shadowDirty = true;
function updateShadow() {
  const half = tuning.sun.range;
  const fwd = new THREE.Vector3(-Math.sin(walker.yaw), 0, -Math.cos(walker.yaw));
  const want = camera.position.clone().addScaledVector(fwd, half * 0.35);
  const dirty = shadowDirty;
  shadowDirty = false;
  if (dirty || want.distanceTo(shadowAt) >= half * 0.2) {
    shadowAt.copy(want);
    aim(sun, half, want);
  }
  if (tuning.sun.near) {
    const hn = tuning.sun.nearRange, wn = camera.position.clone().addScaledVector(fwd, hn * 0.3);
    if (dirty || wn.distanceTo(nearAt) >= hn * 0.15) {
      nearAt.copy(wn);
      aim(sunNear, hn, wn);
    }
  }
}
// a sun's shadow camera over a square `half` either side of `want`, and its map to be drawn again
const SHADOW_DEPTH = 200;   // metres either side of the walker, along the sun
function aim(light, half, want) {
  // snapped to the shadow map's texels, so the dapples don't crawl as it moves
  const texel = (2 * half) / light.shadow.mapSize.x;
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), sunDir).normalize();
  const up = new THREE.Vector3().crossVectors(sunDir, right);
  const c = new THREE.Vector3()
    .addScaledVector(right, Math.round(want.dot(right) / texel) * texel)
    .addScaledVector(up, Math.round(want.dot(up) / texel) * texel)
    .addScaledVector(sunDir, want.dot(sunDir));
  light.target.position.copy(c);
  light.position.copy(c).addScaledVector(sunDir, 700);
  const cam = light.shadow.camera;
  cam.left = cam.bottom = -half;
  cam.right = cam.top = half;
  // the depth only as deep as anything round the walker can cast (the valley, the rims, the tallest crowns)
  cam.near = 700 - SHADOW_DEPTH;
  cam.far = 700 + SHADOW_DEPTH;
  cam.updateProjectionMatrix();
  light.shadow.bias = -light.userData.biasMetres / (cam.far - cam.near);
  light.shadow.needsUpdate = true;
  renderer.shadowMap.needsUpdate = true;
}

// ---- the tuning put to work ----

function applyTuning(t) {
  const u = shadeMat.uniforms;
  u.uTh.value = t.edge.threshold;
  u.uBandMax.value = t.edge.bandMax;
  u.uJitMax.value = t.edge.jitMax;
  u.uWD.value = t.edge.wDark;
  u.uWL.value = t.edge.wLight;
  u.uMode.value = t.edge.mode === 'screen' ? 1 : 0;
  // the pixel widths are meant on a normal screen; at a higher resolution they scale along
  const pr = Math.min(devicePixelRatio, 2) * t.view.scale;
  u.uPxD.value = t.edge.pxDark * pr;
  u.uPxL.value = t.edge.pxLight * pr;
  u.uTol.value = t.edge.depthTol;
  u.uSil.value = t.edge.silhouette;
  u.uJit.value = t.edge.jitter;
  u.uDebug.value = DEBUG_VIEWS[t.view.debug] ?? 0;
  shared.uNoiseScale.value = t.edge.noiseScale;
  shared.uLeafBias.value = t.sun.leafBias;

  // the lights, the things' colours and how they vary
  const L = t.light;
  u.uSun.value.fromArray(hexToLin(L.sunColor)).multiplyScalar(L.sun);
  u.uShade.value.fromArray(hexToLin(L.shadeColor)).multiplyScalar(L.shade);
  u.uLitSat.value = L.litSat;
  u.uShadeSat.value = L.shadeSat;
  u.uShadeDir.value.fromArray(shadeDirOf(L.shadeColor));
  u.uShadePull.value = L.shadePull;
  u.uShadeMinC.value = L.shadeMinC;
  u.uSkyTop.value.fromArray(hexToRgb(L.skyTop));
  u.uSkyHorizon.value.fromArray(hexToRgb(L.skyHorizon));
  u.uSkyCurve.value = L.skyCurve;
  for (const k of KINDS) shared.albedo[k].value.fromArray(hexToLin(t.albedo[k]));
  shared.uMossColor.value.fromArray(hexToLin(t.albedo.moss));
  shared.uMossJoint.value = t.vary.mossJoint;
  shared.uGroundTex.value ??= groundTexture();
  shared.uGroundVar.value = t.vary.groundVar;
  shared.uGroundHue.value = t.vary.groundHue;
  shared.uEarth.value = t.vary.earth ?? 1;
  const Hm = t.harmony;
  shared.uHarmAmt.value = Hm.on ? Hm.amount : 0;
  shared.uHarmSat.value = Hm.on ? Hm.saturation : 1;
  shared.uHarmHue.value = THREE.MathUtils.degToRad(Hm.hue);
  shared.uHarmRange.value = THREE.MathUtils.degToRad(Hm.range);
  shared.uRockColor.value.fromArray(hexToLin(t.albedo.rock));
  shared.uSaltColor.value.fromArray(hexToLin(t.albedo.salt));
  shared.uSandColor.value.fromArray(hexToLin(t.albedo.sand));
  shared.uVarL.value = t.vary.leafL;
  shared.uVarH.value = t.vary.leafH;
  shared.uMottle.value = t.vary.mottle;
  shared.uBrick.value = t.vary.brick;
  shared.uDirt.value = t.vary.dirt;
  shared.uDirtColor.value.fromArray(hexToLin(t.albedo.dirt));
  shared.uCropColor.value.fromArray(hexToLin(t.albedo.crop));
  shared.uLichen.value = t.vary.lichen;

  // wind
  const Wd = t.wind, wa = THREE.MathUtils.degToRad(Wd.direction);
  shared.uWind.value = Wd.on ? Wd.strength : 0;
  shared.uWindDir.value.set(Math.sin(wa), Math.cos(wa));
  shared.uWindSpeed.value = Wd.speed;
  shared.uFlutter.value = Wd.flutter;
  shadowDirty = true;

  // highlights
  const Hi = t.highlight;
  shared.uSpec.value = Hi.on ? Hi.strength : 0;
  shared.uSpecPow.value = Hi.sharpness;
  shared.uGlint.value = Hi.glint;
  for (const k of Object.keys(shared.gloss)) shared.gloss[k].value = Hi.gloss[k] ?? TUNING_DEFAULTS.highlight.gloss[k] ?? 0;
  u.uHiOn.value = Hi.on ? 1 : 0;
  u.uHiTh.value = Hi.threshold;
  u.uSunLab.value.fromArray(hexToOklab(L.sunColor));
  u.uKnee.value = L.knee;

  // the prism palette and what light paints with it
  const Pr = t.prism;
  ['c1', 'c2', 'c3', 'c4', 'c5'].forEach((k, i) => u.uPrism.value[i].fromArray(hexToOklab(Pr[k])));
  ['c1', 'c2', 'c3', 'c4', 'c5'].forEach((k, i) => shared.uPrismLin.value[i].fromArray(hexToLin(Pr[k])));
  u.uFilmLit.value = Pr.on ? Pr.filmLit : 0;
  u.uFilmShade.value = Pr.on ? Pr.filmShade : 0;
  u.uFilmEdge.value = Pr.on ? Pr.filmEdge : 0;
  u.uFilmChroma.value = Pr.filmChroma;
  u.uHiPrism.value = Pr.on ? Pr.hiPrism : 0;
  u.uPlantPrism.value = Pr.on ? Pr.plantEdge : 0;
  u.uOtherPrism.value = Pr.on ? Pr.otherEdge : 0;
  u.uPrismWidth.value = Pr.edgeWidth;
  u.uPrismOwnL.value = Pr.edgeLight;
  shared.uSlopeBias.value = t.sun.slopeBias;
  shared.uGrazeCut.value = t.sun.grazeCut;
  sun.shadow.radius = t.sun.soft;          // the shadow filter's radius in texels (shade.js SOFT_PCF)
  sunNear.shadow.radius = t.sun.nearSoft;
  if (t.sun.near) sun.shadow.camera.layers.disable(1);
  else sun.shadow.camera.layers.enable(1);
  u.uReal.value = t.light.real;
  u.uShadowSoft.value = t.sun.shadowSoft;
  u.uShadowBand.value = t.sun.shadowBand;
  u.uFormGamma.value = t.edge.formGamma;
  u.uRealSky.value = t.light.realSky;
  const Ss = t.sss;
  for (const k of KINDS) shared.scatter[k].value = Ss.cm[k] ?? 0;
  shared.uScatterMoss.value = Ss.cm.moss ?? 0;
  u.uSssOn.value = Ss.on ? 1 : 0;
  u.uSssAmt.value = Ss.amount;
  u.uSssScale.value = Ss.scale;
  u.uSssLight.value = Ss.light;
  u.uSssChroma.value = Ss.chroma;
  u.uSssMinC.value = Ss.minC;
  u.uSssHue.value = THREE.MathUtils.degToRad(Ss.hue);
  u.uSssMinPx.value = Ss.minPx;
  const G = t.glare;
  glare.strength = G.strength; glare.radius = G.radius; glare.threshold = G.threshold;
  u.uGlareHi.value = G.on ? G.highlight : 0;
  u.uGlareGlint.value = G.on ? G.glint : 0;
  shared.uFilmPow.value = Pr.filmPow;
  shared.uFilmNoise.value = Pr.filmNoise;
  shared.uLichenA.value.fromArray(hexToLin(t.albedo.lichenA));
  shared.uLichenB.value.fromArray(hexToLin(t.albedo.lichenB));
  shared.uMoss.value = t.vary.moss;
  // the sky's own colour in the colour buffer, so the edges of leaves against it blend towards it
  skyAlbedo.set(hexToLin(L.skyHorizon).map((v, i) => v / Math.max(u.uSun.value.getComponent(i), 1e-3)));

  // the band
  const B = t.band, bu = bandUniforms(B);
  u.uFollow.value = B.follow ? 1 : 0;
  u.uGamma.value = B.gamma;
  u.uChroma.value = B.chroma;
  u.uFallback.value = THREE.MathUtils.degToRad(B.fallback);
  u.uStopOn.value = bu.on;
  u.uStopAt.value = bu.at;
  u.uStopBase.value = bu.base;
  u.uStopHue.value = bu.hue;
  u.uStopC.value = bu.c;
  u.uModel.value = B.model === 'anatomy' ? 1 : 0;
  u.uBandOn.value = B.on === false ? 0 : 1;
  u.uPeakChroma.value = B.peakChroma;
  u.uPeakMin.value = B.peakMin;
  u.uPeakHue.value = THREE.MathUtils.degToRad(B.peakHue);
  u.uPeakDark.value = B.peakDark;
  u.uPeakFocus.value = B.peakFocus;
  u.uPeakMaxL.value = B.peakMaxL;
  u.uCoreDark.value = B.coreDark;
  u.uCoreChroma.value = B.coreChroma;
  u.uCoreFocus.value = B.coreFocus;
  u.uBandBlend.value = B.blend;
  u.uCorePath.value = B.corePath;
  u.uSunsetBelow.value = B.sunsetBelow;
  u.uBandLight.value = B.lightShare;
  u.uBorderWarm.value.fromArray(hexToOklab(B.lightWarm));
  u.uBorderCool.value.fromArray(hexToOklab(B.lightCool));
  const Tr = t.trans;
  u.uTrans.value = Tr.on ? Tr.amount : 0;
  u.uTransView.value = Tr.view;
  u.uTransDepth.value = Tr.depth;
  u.uTransHue.value = THREE.MathUtils.degToRad(Tr.hue);
  u.uTransChroma.value = Tr.chroma;
  u.uTransLight.value = Tr.light;
  u.uReflect.value = B.reflect;

  // each family's own range, and the air
  u.uLitRange.value = t.family.litRange;
  u.uShadeRange.value = t.family.shadeRange;
  const Hz = t.haze;
  u.uHazeOn.value = Hz.on ? 1 : 0;
  u.uHazeSun.value.fromArray(hexToLin(Hz.sunColor)).multiplyScalar(Hz.sun);
  u.uHazeShade.value.fromArray(hexToLin(Hz.shadeColor)).multiplyScalar(Hz.shade);
  u.uHazeDensity.value = Hz.density;
  u.uHazeStart.value = Hz.start;
  u.uHazeHeight.value = Hz.height;
  u.uHazeForward.value = Hz.forward;
  u.uHazeMax.value = Hz.max;
  u.uHazeBands.value = Hz.bands;
  u.uHazeOutside.value = Hz.outside;
  u.uHazeSteps.value = Math.round(Hz.steps);
  u.uHazeFar.value = t.sun.range;
  u.uFarFade.value.set(Hz.farFrom, Math.max(Hz.farTo, Hz.farFrom + 1));

  // the shadow map's resolution (finer steps where a shadow falls along a surface, e.g. into a crevice);
  // 0 = by the wind: fine while still (it is drawn only now and then), coarser while the wind redraws it often
  const want = t.sun.mapSize || (t.wind.on ? 4096 : 8192);
  const size = Math.min(want, renderer.capabilities.maxTextureSize);
  if (sun.shadow.mapSize.x !== size) {
    sun.shadow.mapSize.set(size, size);
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
  }
  shared.uNearOn.value = t.sun.near ? 1 : 0;
  // the sun's cosine at the lit / shadow border (the threshold through the light curve): below it a leaf's face
  // lets light through rather than taking it
  shared.uTransFace.value = Math.pow(t.edge.threshold, 1 / t.edge.formGamma);
  shared.uShadowLeafBlur.value = t.sun.leafBlur;
  shared.uGapShare.value = t.sun.flecks;
  shared.uGapSize.value = t.sun.fleckSize;
  const nsize = Math.min(t.sun.nearSize, renderer.capabilities.maxTextureSize);
  if (sunNear.shadow.mapSize.x !== nsize) {
    sunNear.shadow.mapSize.set(nsize, nsize);
    sunNear.shadow.map?.dispose();
    sunNear.shadow.map = null;
  }
  const el = THREE.MathUtils.degToRad(t.sun.elevation);
  const az = THREE.MathUtils.degToRad(t.sun.azimuth);
  sunDir.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
  shared.uSunWorld.value.copy(sunDir);
  shadowDirty = true;
  // the stars, and the sun's (at night the moon's) disc where the light comes from (timeOfDay.js)
  const Sk = t.sky, disc = Sk.disc ? {
    strength: Sk.disc, dir: sunDir, color: new THREE.Vector3().fromArray(hexToRgb(Sk.discColor)),
    cos: Math.cos(THREE.MathUtils.degToRad(Sk.discSize)), glow: Sk.discGlow,
  } : null;
  u.uStars.value = Sk.stars;
  u.uExposure.value = Sk.exposure;
  fires.apply(Sk.fires);
  u.uFireOn.value = Sk.fires * Sk.fireLight;
  u.uFireRange.value = Sk.fireReach;
  u.uDisc.value = disc ? disc.strength : 0;
  if (disc) { u.uDiscColor.value.copy(disc.color); u.uDiscCos.value = disc.cos; u.uDiscGlow.value = disc.glow; }

  // the light / colour buffers' multisampling (4 = smooth leaf edges; fewer is cheaper)
  if (rtLight.samples !== t.view.msaa) {
    rtLight.samples = t.view.msaa;
    rtLight.dispose();
  }
  if (String(t.motes.count) !== lifeKey) {
    lifeKey = String(t.motes.count);
    motes.make(t.motes.count);
  }
  motes.apply(t.motes, hexToRgb(L.sunColor));
  // the river: its streaks, shallows and wet line (shade.js FLOW), its reflections (water.js)
  const Wt = t.water;
  shared.uStreak.value = Wt.on ? Wt.streak : 0;
  shared.uShallow.value = Wt.on ? Wt.shallow : 0;
  shared.uFoam.value = Wt.on ? Wt.foam : 0;
  water.apply(Wt, { top: u.uSkyTop.value, horizon: u.uSkyHorizon.value, curve: L.skyCurve, disc });
  camera.fov = t.view.fov;
  walker.speed = t.walk.speed;
  resize();
}
// the time of day (timeOfDay.js): the address's ?time=, and T to go on to the next
const applyNow = () => { applyTuning(tuning); music.apply(); };
applyNow();
const TIME_TITLE = { day: '白天', dusk: '黄昏', night: '夜晚' };
// (in place: the groups and the objects in them kept, only their values changed)
const assignIn = (to, from) => {
  for (const [k, v] of Object.entries(from)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && to[k] && typeof to[k] === 'object') assignIn(to[k], v);
    else to[k] = structuredClone(v);
  }
};
// going to another time over secs seconds: the look carried across from the one to the
// other, frame by frame (timeOfDay.js blendTuning); 0, at once
let change = null;
const finishChange = () => {
  if (!change) return;
  assignIn(tuning, change.to);
  change = null;
  applyNow();
};
const setTime = (n, secs = 3) => {
  finishChange();
  const was = timeName;
  stores[timeName] = structuredClone(tuning);
  timeName = timeFrom(n);
  // (all but the picture's and the walk's settings, which go on as they are)
  const { view, walk, ...rest } = stores[timeName];
  music.setTime(timeName);
  onTime?.(timeName);
  if (!secs || was === timeName) {
    assignIn(tuning, rest);
      applyNow();
    return;
  }
  const { view: v0, walk: w0, ...from } = structuredClone(tuning);
  change = { from, to: rest, t: 0, secs, swap: (was === 'night') !== (timeName === 'night') };
};
// (each frame while it changes)
const stepTime = (dt) => {
  if (!change) return;
  change.t += dt;
  const k = Math.min(change.t / change.secs, 1);
  if (k >= 1) { finishChange(); return; }
  assignIn(tuning, blendTuning(change.from, change.to, k * k * (3 - 2 * k), change.swap));
  applyTuning(tuning);
};
addEventListener('keydown', (e) => {
  if (e.code !== 'KeyT' || e.repeat || e.metaKey || e.ctrlKey) return;
  setTime(TIME_NAMES[(TIME_NAMES.indexOf(timeName) + 1) % TIME_NAMES.length]);
});
addEventListener('keydown', (e) => {
  if (e.code !== 'KeyM' || e.repeat || e.metaKey || e.ctrlKey) return;
  tuning.view.music = !tuning.view.music;
  music.apply();
  menu.refresh();
});
// the menu at the top right (menu.js): how to walk, the picture, the time, the music, who made what
const menu = createMenu({
  times: TIME_NAMES, titles: TIME_TITLE, timeNow: () => timeName, setTime: (n) => setTime(n),
  musicOn: () => tuning.view.music, setMusic: (v) => { tuning.view.music = v; music.apply(); },
  volume: () => tuning.view.musicVolume, setVolume: (v) => { tuning.view.musicVolume = v; music.apply(); },
  autoOn: () => tuning.view.auto,
  setAuto: (v) => {
    tuning.view.auto = v;
    try { localStorage.setItem(AUTO_KEY, v ? '1' : '0'); } catch { /* storage unavailable */ }
  },
  stats: () => ({ fps: fpsNow, res: tuning.view.scale * dynScale }),
});
onTime = () => menu.refresh();

// ---- the loop ----

const mode = document.getElementById('mode');
walker.onMode = (fly) => { if (mode) mode.textContent = fly ? '飞行' : ''; };

let lastT = performance.now(), frameNo = 0;
function frame(now) {
  const dt = Math.min((now - lastT) / 1000, 0.05);
  autoScale(now - lastT);
  countFrame(now - lastT);
  lastT = now;
  draw(dt);
  requestAnimationFrame(frame);
}
function draw(dt) {
  // (the eagle's view, on a high place, has the eye while it lasts: flyover.js)
  stepTime(dt);
  if (!flyover.update(dt)) walker.update(dt);
  lifeT += dt;
  shadeMat.uniforms.uClock.value = lifeT;
  shared.uWaterTime.value = lifeT * tuning.water.speed;
  world.tick?.(lifeT);
  lodUpdate(camera.position);
  updateShadow();
  // wind: the plants move, so the sun's shadows are drawn again every few frames
  if (tuning.wind.on) {
    shared.uTime.value += dt;
    const every = Math.max(1, Math.round(tuning.wind.shadowEvery));
    if (++frameNo % every === 0) {
      if (tuning.sun.near) sunNear.shadow.needsUpdate = true;
      if (!tuning.sun.near || frameNo % (every * 3) === 0) sun.shadow.needsUpdate = true;
      renderer.shadowMap.needsUpdate = true;
    }
  }

  // each buffer cleared to the sky's own values (three's clear would give both the same colour)
  renderer.setRenderTarget(rtLight);
  gl.clearBufferfv(gl.COLOR, 0, skyLight);
  gl.clearBufferfv(gl.COLOR, 1, skyAlbedo);
  gl.clearBufferfv(gl.COLOR, 2, skySun);
  renderer.state.buffers.depth.setMask(true);
  renderer.clearDepth();
  renderer.render(scene, camera);
  const glareOn = tuning.glare.on && tuning.view.debug === 'final';
  const waterOn = tuning.water.on && tuning.water.reflect > 0 && tuning.view.debug === 'final';
  const viaColor = tuning.view.fxaa || glareOn || waterOn;
  // the finished picture: rtColor, or with the water's reflections painted in, rtWater
  const out = waterOn ? rtWater : rtColor;
  fxaaMat.uniforms.tDiffuse.value = out.texture;
  toScreen.material.uniforms.tDiffuse.value = out.texture;
  renderer.setRenderTarget(viaColor ? rtColor : null);
  // the sun's shadow map, for the light shafts (made on the first frame)
  shadeMat.uniforms.tShadow.value = sun.shadow.map?.texture ?? null;
  shadeMat.uniforms.uHazeOn.value = tuning.haze.on && sun.shadow.map ? 1 : 0;
  shadeMat.uniforms.uShadowReady.value = sun.shadow.map ? 1 : 0;
  shadeMat.uniforms.uShadowRange.value = sun.shadow.camera.far - sun.shadow.camera.near;
  shadeMat.uniforms.uShadowSize.value = sun.shadow.mapSize.x;
  const hazeLow = shadeMat.uniforms.uHazeOn.value > 0.5 && tuning.view.hazeHalf;
  if (hazeLow) {
    renderer.setRenderTarget(rtHaze);
    hazeQuad.render(renderer);
    renderer.setRenderTarget(viaColor ? rtColor : null);
  }
  shadeMat.uniforms.uHazeLow.value = hazeLow ? 1 : 0;
  shadeQuad.render(renderer);
  if (waterOn) water.draw(renderer, camera, rtColor, rtLight.textures[0], rtWater, lifeT * tuning.water.speed);
  if (tuning.motes.on && tuning.view.debug === 'final') {
    const sh = tuning.sun.near && sunNear.shadow.map ? sunNear.shadow : sun.shadow;
    motes.draw(renderer, camera, {
      time: lifeT, sunDir, light: rtLight.textures[0], texel: shadeMat.uniforms.uTexel.value, px: pxPerMetre,
      shadow: { map: sh.map?.texture, matrix: sh.matrix, range: sh.camera.far - sh.camera.near },
    });
  }
  if (fires.on && tuning.view.debug === 'final') {
    fires.draw(renderer, camera, { time: lifeT, light: rtLight.textures[0], texel: shadeMat.uniforms.uTexel.value, px: pxPerMetre });
  }
  if (glareOn) {
    glare.renderToScreen = !tuning.view.fxaa;   // without FXAA it copies the picture to the screen itself
    glare.render(renderer, null, out, dt, false);
  }
  if (tuning.view.fxaa) {
    renderer.setRenderTarget(null);
    fxaaQuad.render(renderer);
  } else if (viaColor && !glareOn) {
    renderer.setRenderTarget(null);
    toScreen.render(renderer);
  }
}
// a first frame behind the intro, so the shaders are compiled before the walk starts
console.time('first frame');
renderer.compile(scene, camera);
frame(performance.now());
console.timeEnd('first frame');

const intro = document.getElementById('intro');
intro.classList.add('ready');
const enter = () => {
  intro.classList.add('gone');
  document.getElementById('hint').classList.add('show');
  setTimeout(() => document.getElementById('hint').classList.remove('show'), 9000);
};
intro.addEventListener('click', enter, { once: true });
