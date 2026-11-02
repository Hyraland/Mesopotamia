// The look in two steps.
//
// 1. Every surface is drawn into two buffers at once:
//      light  r = how much sunlight it gets (cos of the angle to the sun, times its cast shadow), 0..1
//             g = its distance from the eye (metres; the sky is SKY_DEPTH)
//             b = a brush noise fixed to the surface (it wobbles the light/dark border like a painted edge)
//      colour    its own colour (albedo, linear): the material's, varied per plant and mottled on stone and
//                (alpha) how much it faces up, 0..0.49, plus 0.5 for a leaf seen from its face away from the sun
//                soil, moss on stone's upper faces
//    The only light is the sun; its amount decides nothing but which side of the border a pixel is on.
// 2. A full-screen pass paints each pixel in one of two states: lit (its colour × the sunlight's colour) or in
//    shadow (its colour × the shadow light's colour). Where they meet, a thin band runs from the surface's own
//    shadow colour to its own lit colour, its brightness climbing along that gradient while its hue comes from
//    the band's stops (the shadow colour's opposite, the lit colour's, a fixed hue...), all worked in OKLab.
//    The band is measured either in light (its width follows the form: wide over a gently turning surface, a
//    hairline at a hard shadow edge) or on the screen (an even width in pixels everywhere).

import * as THREE from 'three';
import { ARCHITECTURAL_SURFACE, SURFACE_KINDS, COATED_KINDS } from './architecturalSurface.js';

export const SKY_DEPTH = 60000;
export const MAX_CANALS = 48;   // (the plain runs on to its horizon, some 20 km off from the ziggurat's top)

// what each material is: its colour comes from shared.albedo[kind]
// the plants: palm (date palm fronds), deadfrond (the dry ones hanging under the crown), bark (palm trunks and
// tree bark), date / spadix (the fruit and its orange stalks), leaf (broad-leaved trees: pomegranate, fig,
// apple, willow), poplar (the Euphrates poplar's grey-green), tamarisk (its feathery sprays) and bloom (its pink
// plumes), reed (living reed and cattail) and plume (the reeds' tassels), crop (barley stubble, sesame), herb
// (garden beds), vine (grape), fruit (pomegranates), grass (dry tufts, camelthorn).
// The city (models/city.glb, tools/export_web.py): its mud brick, plaster, limewash, terrace caps, timber,
// reedwork, cloth, pottery, people; ground / mud / water: the plain and the river (land.js). The bay scene's: whitewash
// (its houses' lime-washed plaster), zig / zigcap (the ziggurat's dark red-brown brick, and its lighter caps)
export const KINDS = ['palm', 'deadfrond', 'bark', 'date', 'spadix', 'leaf', 'poplar', 'tamarisk', 'bloom', 'reed', 'plume',
  'crop', 'herb', 'vine', 'fruit', 'grass',
  'ground', 'mud', 'water', 'earth', 'path', 'brick', 'firedbrick', 'plaster', 'lime', 'trim', 'dark', 'wood', 'straw',
  'whitewash', 'redwash', 'zig', 'zigcap', 'grape', 'saffron',
  'linen', 'madder', 'indigo', 'clay', 'buff', 'grain', 'stone', 'skin', 'hair', 'bronze'];

// shared by every surface material. uLeafBias: how far out (in clump radii) a leaf looks up its shadow, so a
// clump of leaves is shaded as one mass by the others round it rather than speckled by its own cards
export const MAX_LENSES = 36;

export const shared = {
  uNoiseScale: { value: 0.7 },
  uLeafBias: { value: 0.5 },
  // where the sun only grazes a surface, the shadow map's test flips texel by texel (shadow acne: rows of
  // little rectangles along the true terminator). Two cures: the shadow lookup moved further out along the
  // normal the more the surface turns from the sun (uSlopeBias; uSunWorld the direction to the sun), and the
  // light faded to nothing below uGrazeCut (the sun's cosine there), where it was a few per cent anyway
  uSlopeBias: { value: 2 },
  uGrazeCut: { value: 0.05 },
  uNearOn: { value: 1 },         // the near shadow map (main.js sunNear) read where it reaches
  uTransFace: { value: 0.17 },   // leaves: below this sun's cosine on their face, light comes through (see TRANSLUCENT)
  uShadowLeafBlur: { value: 2.5 },   // leaves' cut-outs blurred by so many mip levels for their shadows
  uGapShare: { value: 0.25 }, uGapSize: { value: 0.35 },   // sun flecks through the crowns (see addSunGaps)
  uSunWorld: { value: new THREE.Vector3(0, 1, 0) },
  // the glass mosaic hung in the ring (lens.js): the sunlight through it onto what lies beyond (see lensLight).
  // Its centre, the normal of its plane, its radius, how much of the light its glass lets through, how strongly
  // that light takes the glass's colour; the mosaic (MOSAIC): its pieces across a radius, the lead's width, six
  // glass colours (linear) and their shares (cumulative)
  // (up to MAX_LENSES pieces of mosaic glass, the first uLensCount of them: each its centre, facing, radius, its
  // hole's radius (as a share of its radius; 0 = a disc) and where in the mosaic's pattern it is cut from)
  uLensOn: { value: 0 }, uLensCount: { value: 0 },
  uLensC: { value: Array.from({ length: MAX_LENSES }, () => new THREE.Vector3()) },
  uLensN: { value: Array.from({ length: MAX_LENSES }, () => new THREE.Vector3(0, 0, 1)) },
  uLensR: { value: new Array(MAX_LENSES).fill(1) }, uLensIn: { value: new Array(MAX_LENSES).fill(0) },
  uLensSeed: { value: Array.from({ length: MAX_LENSES }, () => new THREE.Vector2()) },
  uLensT: { value: 0.9 }, uLensCast: { value: 0.85 },
  // the mosaic room's floor inlay (INLAY): how strong, and its colour (linear)
  uInlay: { value: 0 }, uInlayColor: { value: new THREE.Color(0.2, 0.45, 0.55) },
  uMosCells: { value: 6 }, uMosLead: { value: 0.07 },
  uMosCol: { value: [0, 1, 2, 3, 4, 5].map(() => new THREE.Vector3(0.1, 0.2, 0.6)) },
  uMosW: { value: [0.3, 0.52, 0.68, 0.8, 0.92, 1] },
  uPrismLin: { value: [0, 1, 2, 3, 4].map(() => new THREE.Vector3(1, 1, 1)) },   // the prism palette, linear
  // the forest floor's picture (groundTexture): how far it moves the ground's lightness, and its hue (radians at 1)
  uGroundTex: { value: null }, uGroundVar: { value: 0.35 }, uGroundHue: { value: 0.35 },
  // hardened earth (EARTH: the ground, the lanes' trodden treads, garden earth): how strongly its crust shows (its
  // clods and hollows, shaded by the sun across them; grit) in place of the picture's dabs
  uEarth: { value: 1 },
  uVarL: { value: 0.25 },        // plants: how much lighter / darker one is than the next
  uVarH: { value: 0.25 },        // plants: how much yellower / bluer
  uMottle: { value: 0.18 },      // stone, bark, soil: blotches of lighter and darker
  uBrick: { value: 1 },          // mud brick: how strongly its joints and its bricks one from the next show
  // the river and canals (FLOW): their clock (s), and how strongly the drifting streaks, the silt bed in the
  // shallows and the wet line at the bank show
  uWaterTime: { value: 0 }, uStreak: { value: 1 }, uShallow: { value: 0.6 }, uFoam: { value: 0.5 },
  // the boats afloat (addHull): no water drawn inside their hulls. Each: its middle (x, z) and the direction of its
  // length (sin, cos of its yaw); its half length and half beam at the waterline; its beam (a share of the
  // greatest) at 0.6, 0.8, 0.9 and 0.97 of the way out to either end
  uHullN: { value: 0 }, uHull: { value: Array.from({ length: 12 }, () => new THREE.Vector4()) },
  uHullAB: { value: Array.from({ length: 12 }, () => new THREE.Vector4()) },
  uHullW: { value: Array.from({ length: 12 }, () => new THREE.Vector4()) },
  uMoss: { value: 0.6 },         // stone: moss on its ledges and tops (not where feet go)
  uMossJoint: { value: 0.7 },    // stone: moss in its joints, grooves and inside corners
  // the plants' greens drawn into one family: hues within uHarmRange (radians) of uHarmHue pulled towards it by
  // uHarmAmt, their colourfulness times uHarmSat; colours farther off left as they are
  uHarmAmt: { value: 0 },
  uHarmHue: { value: 2.4 },
  uHarmRange: { value: 1.05 },
  uHarmSat: { value: 1 },
  uMossColor: { value: new THREE.Color() },
  // where feet go (1 on the path, 0 away from it), over the level's ground grid: a texture and its box
  // (x0, z0 of the first texel's edge; 1 / width, 1 / depth); the moss keeps off it
  uTread: { value: null },
  uTreadBox: { value: new THREE.Vector4(0, 0, 0, 0) },
  uRockColor: { value: new THREE.Color() },   // ground: wet silt (on steep banks and just above water)
  uSaltColor: { value: new THREE.Color() },   // ground: the salt crust (land.js zoneAt)
  uSandColor: { value: new THREE.Color() },   // ground: the desert's sand
  // ground: the plain's fields far off (hillLand.js FAR_CANALS; a zone's sand below 0: how much is farmed). Each
  // canal up to four points, two per vec4 (uCanalP[2i], [2i+1]), and its box grown by its fields' reach
  // (uCanalBox[i]: x0, z0, x1, z1); uCropColor: the stubble's
  uCanalP: { value: Array.from({ length: 2 * MAX_CANALS }, () => new THREE.Vector4()) },
  uCanalBox: { value: Array.from({ length: MAX_CANALS }, () => new THREE.Vector4()) },
  uCanalN: { value: 0 },
  uCropColor: { value: new THREE.Color() },
  // the level's stone: dust gathered in its grooves, joints and inside corners (the Cavity baked in Blender,
  // carried as vertex colour), so carving still reads in shadow; it changes the colour only, never the light
  uDirt: { value: 0.75 },
  uDirtColor: { value: new THREE.Color() },
  // lichen in pink and pale patches on bark
  uLichen: { value: 0.18 },
  uLichenA: { value: new THREE.Color() },
  uLichenB: { value: new THREE.Color() },
  // wind: plants sway (a gust rolling through the forest, every plant bending downwind and back) and their
  // leaves flutter; the shadow pass moves them the same way, so the dapples move with them
  uTime: { value: 0 },
  uWind: { value: 1 },
  uWindDir: { value: new THREE.Vector2(1, 0) },
  uWindSpeed: { value: 1 },
  uFlutter: { value: 1 },
  // highlights: sunlight reflected by smooth surfaces (each kind's gloss), added to the light above 1, where
  // the picture paints a third family; uGlint roughens the most glossy (gloss > 0.6) finely, into sparse glints
  uSpec: { value: 1 },
  uSpecPow: { value: 60 },
  uGlint: { value: 0.35 },
  // the relic's thin film: how strongly its colour turns with the angle it is seen at (uFilmPow: the higher,
  // the more only at grazing angles) and how much an uneven film thickness (uFilmNoise) varies it
  uFilmPow: { value: 0.8 },
  uFilmNoise: { value: 0 },
  // subsurface scattering: how far (cm) light wanders inside each kind before coming out again; moss is the
  // stone's moss. Carried to the picture in the light buffer's blue (its whole part, in quarter centimetres)
  scatter: Object.fromEntries(KINDS.map((k) => [k, { value: 0 }])),
  uScatterMoss: { value: 2.5 },
  gloss: Object.fromEntries(KINDS
    .map((k) => [k, { value: 0 }])),
  albedo: Object.fromEntries(KINDS.map((k) => [k, { value: new THREE.Color() }])),
};

const NOISE = /* glsl */ `
varying vec3 vWorldP;
varying float vViewZ;
uniform float uNoiseScale;
float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vnoise3(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x), mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x), mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float brush(vec3 p) { return vnoise3(p) * 0.62 + vnoise3(p * 2.7 + 11.0) * 0.38; }
`;

// How each kind sways: 1 a clump of leaves (the whole mass rocks, as big as it is), 2 rooted (bending more
// the higher above its root), 3 a frond (more the farther from the crown), 4 only fluttering (vines hung as
// one mesh); 0 not at all.
const SWAY = { leaf: 1, poplar: 1, tamarisk: 1, bloom: 1, reed: 2, plume: 2, crop: 2, herb: 2, grass: 2, palm: 3, deadfrond: 3, vine: 4 };

const WIND = /* glsl */ `
uniform float uTime, uWind, uWindSpeed, uFlutter;
uniform vec2 uWindDir;
vec3 windOffset(vec3 wp, vec3 origin, float size) {
  float t = uTime * uWindSpeed;
  // a gust rolling downwind through the forest, and each plant's own sway within it
  float along = dot(origin.xz, uWindDir);
  float gust = 0.55 + 0.45 * sin(t * 0.45 - along * 0.035) * (0.7 + 0.3 * sin(t * 0.13 + origin.z * 0.01));
  float sway = 0.6 + 0.4 * sin(t * 1.4 + dot(origin.xz, vec2(0.37, 0.29)));
  float w = 0.0;
  #if SWAY_MODE == 1
    w = 0.045 * size;
  #elif SWAY_MODE == 2
    float h = max(wp.y - origin.y, 0.0);
    w = 0.06 * h * min(h, 1.5);   // (growing only linearly above 1.5 m, so a tall banana is not flung about)
  #elif SWAY_MODE == 3
    float r = length(wp - origin);
    w = 0.012 * r * r;
  #endif
  vec3 off = vec3(uWindDir.x, 0.0, uWindDir.y) * w * gust * sway;
  // leaves fluttering
  off += vec3(sin(t * 6.3 + dot(wp, vec3(3.1, 2.7, 1.9))), 0.6 * sin(t * 5.1 + dot(wp, vec3(1.3, 3.7, 2.3))),
              sin(t * 5.7 + dot(wp, vec3(2.3, 1.1, 3.3)))) * 0.035 * uFlutter * gust;
  return off * uWind;
}
`;
// added just after the local position is set up: the wind's world offset, brought back into the mesh's own
// space so everything after (projection, shadow lookups, the shadow pass) sees the moved leaf
const WIND_APPLY = /* glsl */ `
  {
    mat4 inst = mat4(1.0);
    #ifdef USE_INSTANCING
      inst = instanceMatrix;
    #endif
    mat4 toWorld = modelMatrix * inst;
    vec3 wpos = (toWorld * vec4(transformed, 1.0)).xyz;
    #if defined(USE_INSTANCING) || SWAY_MODE == 4
      vec3 org = toWorld[3].xyz;
    #else
      vec3 org = wpos;
    #endif
    float size = length(toWorld[0].xyz);
    transformed += inverse(mat3(toWorld)) * windOffset(wpos, org, size);
  }
`;
function addWind(sh, mode) {
  sh.uniforms.uTime = shared.uTime;
  sh.uniforms.uWind = shared.uWind;
  sh.uniforms.uWindDir = shared.uWindDir;
  sh.uniforms.uWindSpeed = shared.uWindSpeed;
  sh.uniforms.uFlutter = shared.uFlutter;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', `#include <common>\n#define SWAY_MODE ${mode}\n${WIND}`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>\n${WIND_APPLY}`);
}

// Cloth in the wind (houseKit's cloth): each point of a cloth carries its flap, how it may move: xyz the way
// it goes, as long as how far it hangs below what holds it (0 where it lies on a roof or a parapet's top), and w
// how it hangs: 0 against a wall (it lifts out from the wall and falls back, never into it), 1 free on a line
// (blown downwind and fluttering), 2 stretched (an awning: a small flutter either way). A ripple runs down and
// along it with the gusts; a point swung out rises as a pendulum does, so a cloth seems not to stretch. Worked
// out once per vertex, for the picture and the shadow pass alike.
const FLAP = /* glsl */ `
attribute vec4 flap;
uniform float uTime, uWind, uWindSpeed;
uniform vec2 uWindDir;
vec3 flapOffset(vec3 wp) {
  float L = length(flap.xyz);
  if (L < 1e-4) return vec3(0.0);
  float t = uTime * uWindSpeed;
  float along = dot(wp.xz, uWindDir);
  float gust = 0.55 + 0.45 * sin(t * 0.45 - along * 0.035) * (0.7 + 0.3 * sin(t * 0.13 + wp.z * 0.01));
  float r = sin(t * 2.3 - along * 0.9 + wp.y * 2.2 + dot(wp.xz, vec2(0.6, 0.4)));
  float r2 = sin(t * 3.9 - along * 1.7 + wp.y * 3.4);
  vec3 d = flap.xyz, off;
  if (flap.w < 0.5) {
    // against a wall: out and back, a little along it
    vec3 sideW = normalize(cross(vec3(0.0, 1.0, 0.0), d / L) + vec3(1e-4));
    off = d * gust * (0.1 * (0.5 + 0.5 * r) + 0.04 * (0.5 + 0.5 * r2)) + sideW * L * 0.04 * r2 * gust;
  } else if (flap.w < 1.5) {
    // free on its line: blown out downwind, fluttering
    d *= sign(dot(d.xz, uWindDir) + 1e-3);
    off = d * gust * (0.22 + 0.12 * r + 0.06 * r2);
  } else {
    off = d * gust * (0.6 * r + 0.4 * r2);
  }
  if (flap.w < 1.5) off.y += dot(off, off) / (2.0 * L);
  return off * uWind;
}
`;
const FLAP_APPLY = /* glsl */ `
  {
    vec3 wpos = (modelMatrix * vec4(transformed, 1.0)).xyz;
    transformed += inverse(mat3(modelMatrix)) * flapOffset(wpos);
  }
`;
function addFlap(sh) {
  sh.uniforms.uTime = shared.uTime;
  sh.uniforms.uWind = shared.uWind;
  sh.uniforms.uWindDir = shared.uWindDir;
  sh.uniforms.uWindSpeed = shared.uWindSpeed;
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', `#include <common>\n${FLAP}`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>\n${FLAP_APPLY}`);
}

// Sun flecks: the crowns' leaves, as the sun's shadow map sees them, have holes in them, laid out in the plane
// square to the sun so that the holes in every layer of a crown line up and the light gets right through (to the
// floor as a fleck of sun, through the air as a thin shaft). The holes drift a little with the wind. They come
// from a picture drawn once (gapTexture): reading it costs one texture fetch, where working the shapes out per
// pixel (as at first) cost about a quarter of the frame. uGapShare: how many; uGapSize: how big (a small hole
// is about 1/3 to 3/5 of uGapSize across)
const GAP_TILE = 40;   // metres of the picture's side, at uGapSize 0.35 (it repeats)
let gapTex = null;
function gapTexture() {
  if (gapTex) return gapTex;
  const N = 2048, W = GAP_TILE, px = N / W, rnd = mulberry(91);
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const g = cv.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, N, N);
  g.globalCompositeOperation = 'lighten';
  // thick where the crowns are thin, none where they close: a few sines that repeat with the picture
  const waves = Array.from({ length: 5 }, () => [1 + Math.floor(rnd() * 8), 1 + Math.floor(rnd() * 8), rnd() * 6.283, rnd() < 0.5 ? 1 : -1]);
  const cluster = (x, y) => {
    let v = 0;
    for (const [kx, ky, ph, sg] of waves) v += Math.sin(6.2832 * (kx * x + sg * ky * y) / W + ph);
    return Math.min(Math.max((v / 5) * 1.6 + 0.5, 0), 1);
  };
  // each hole drawn with its rank (white = shows first): a share of the holes show, those of rank under it
  const shape = (x, y, rank, draw) => {
    const v = Math.round(255 * Math.max(0, 1 - rank));
    if (v <= 0) return;
    g.fillStyle = `rgb(${v},${v},${v})`;
    // (and again a side over, where it reaches across one, so the picture repeats without a seam)
    for (const ox of [-W, 0, W]) for (const oy of [-W, 0, W]) {
      const X = x + ox, Y = y + oy;
      if (X < -2 || X > W + 2 || Y < -2 || Y > W + 2) continue;
      draw(X * px, Y * px);
    }
  };
  // the spots, scattered at random (not one to a cell: that read as a grid), kept mostly where the crowns are
  // thin (the cluster field, squared: most of the floor gets none); their sizes from many specks of a few
  // centimetres to the odd patch half a metre across; each one to three ellipses of their own shapes and turns,
  // run together (the sun's round image through the smallest gaps, leafy shapes through the larger)
  for (let n = 0; n < 7000; n++) {
    const x0 = rnd() * W, y0 = rnd() * W, c = cluster(x0, y0);
    if (rnd() > c * c) continue;
    const size = 0.025 + 0.24 * rnd() ** 2.6, rank = rnd(), k = 1 + Math.floor(rnd() * rnd() * 3.5);
    for (let m = 0; m < k; m++) {
      const a = rnd() * 3.1416, asp = 1 + rnd() * rnd() * 1.6;
      const x = x0 + (m ? (rnd() - 0.5) * size * 1.8 : 0), y = y0 + (m ? (rnd() - 0.5) * size * 1.8 : 0);
      const rx = size * (0.6 + 0.4 * rnd()) * asp * px, ry = size * (0.6 + 0.4 * rnd()) * px;
      shape(x, y, rank, (X, Y) => { g.beginPath(); g.ellipse(X, Y, rx, ry, a, 0, 6.2832); g.fill(); });
    }
  }
  // and here and there a larger gap between leaves, where the crowns open most: a ragged run of leafy ellipses
  for (let n = 0; n < 500; n++) {
    const x0 = rnd() * W, y0 = rnd() * W, c = cluster(x0, y0);
    if (c < 0.6 || rnd() > (c - 0.6) * 2.5) continue;
    const rank = 0.2 + rnd() * 0.8, parts = 3 + Math.floor(rnd() * 5);
    for (let m = 0; m < parts; m++) {
      const x = x0 + (rnd() - 0.5) * 0.9, y = y0 + (rnd() - 0.5) * 0.9, a = rnd() * 3.1416;
      const rx = (0.12 + rnd() * 0.3) * px, ry = (0.05 + rnd() * 0.12) * px;
      shape(x, y, rank, (X, Y) => { g.beginPath(); g.ellipse(X, Y, rx, ry, a, 0, 6.2832); g.fill(); });
    }
  }
  gapTex = new THREE.CanvasTexture(cv);
  gapTex.wrapS = gapTex.wrapT = THREE.RepeatWrapping;
  gapTex.colorSpace = THREE.NoColorSpace;
  return gapTex;
}
// The ground's picture (the ROCKY shader reads it): dabs the size and shape of fallen leaves and
// small plants, painted not in colours of their own but as small shifts of the ground's own colour — red: its
// lightness (mid grey = none), green: its hue — so whatever the ground's colour, the floor stays in its family.
// Two sizes of dab over soft patches a metre or two across (moss a little lighter and greener, bare earth darker
// and warmer). GROUND_TILE metres a side; it repeats.
const GROUND_TILE = 9;
let groundTex = null;
export function groundTexture() {
  if (groundTex) return groundTex;
  const N = 1024, W = GROUND_TILE, px = N / W, rnd = mulberry(57);
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const g = cv.getContext('2d');
  g.fillStyle = 'rgb(128,128,128)';
  g.fillRect(0, 0, N, N);
  const col = (dl, dh) => `rgb(${Math.round(128 + dl * 127)},${Math.round(128 + dh * 127)},128)`;
  const wrap = (x, y, draw) => {
    for (const ox of [-W, 0, W]) for (const oy of [-W, 0, W]) {
      const X = x + ox, Y = y + oy;
      if (X > -1 && X < W + 1 && Y > -1 && Y < W + 1) draw(X * px, Y * px);
    }
  };
  // patches: soft, a metre or two across
  g.filter = 'blur(18px)';
  for (let n = 0; n < 26; n++) {
    const x = rnd() * W, y = rnd() * W, r = (0.5 + rnd() * 1.2) * px, moss = rnd() < 0.5;
    g.fillStyle = moss ? col(0.25, -0.3) : col(-0.3, 0.35);
    wrap(x, y, (X, Y) => { g.beginPath(); g.ellipse(X, Y, r, r * (0.6 + rnd() * 0.4), rnd() * 3.14, 0, 6.2832); g.fill(); });
  }
  g.filter = 'none';
  // dabs: leaf-shaped, pointed at both ends, at every angle; larger ones first, small ones over them
  const leaf = (X, Y, len, wid, a) => {
    g.save();
    g.translate(X, Y);
    g.rotate(a);
    g.beginPath();
    g.moveTo(-len, 0);
    g.quadraticCurveTo(0, -wid * 2, len, 0);
    g.quadraticCurveTo(0, wid * 2, -len, 0);
    g.fill();
    g.restore();
  };
  for (const [count, size] of [[1400, 0.11], [2600, 0.06]]) {
    for (let n = 0; n < count; n++) {
      const x = rnd() * W, y = rnd() * W, len = size * (0.6 + rnd() * 0.8) * px, wid = len * (0.25 + rnd() * 0.2);
      const v = rnd();
      // lighter and yellower, darker and bluer, or a dull, darker warm: three steps of the one colour
      g.fillStyle = v < 0.4 ? col(0.16 + rnd() * 0.1, -0.25) : v < 0.75 ? col(-0.18 - rnd() * 0.1, 0.2) : col(-0.08, 0.45);
      const a = rnd() * 3.1416;
      wrap(x, y, (X, Y) => leaf(X, Y, len, wid, a));
    }
  }
  groundTex = new THREE.CanvasTexture(cv);
  groundTex.wrapS = groundTex.wrapT = THREE.RepeatWrapping;
  groundTex.colorSpace = THREE.NoColorSpace;
  groundTex.anisotropy = 8;
  return groundTex;
}
function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function addSunGaps(sh) {
  sh.uniforms.uSunWorld = shared.uSunWorld;
  sh.uniforms.uGapShare = shared.uGapShare;
  sh.uniforms.uGapSize = shared.uGapSize;
  sh.uniforms.uGapTex = { value: gapTexture() };
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vGapW;')
    .replace('#include <project_vertex>', `#include <project_vertex>
      {
        vec4 gw = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          gw = instanceMatrix * gw;
        #endif
        vGapW = (modelMatrix * gw).xyz;
      }`);
  sh.fragmentShader = sh.fragmentShader
    .replace('#include <common>', `#include <common>
      varying vec3 vGapW;
      uniform vec3 uSunWorld;
      uniform vec2 uWindDir;
      uniform float uTime, uGapShare, uGapSize;
      uniform sampler2D uGapTex;`)
    .replace('#include <alphatest_fragment>', `#include <alphatest_fragment>
      if (uGapShare > 0.0) {
        vec3 sd = normalize(uSunWorld);
        vec3 ga = normalize(cross(sd, abs(sd.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0))), gb = cross(sd, ga);
        vec2 q = vec2(dot(vGapW, ga), dot(vGapW, gb)) * (0.35 / uGapSize) + uWindDir * sin(uTime * 0.7) * 0.07;
        if (texture2D(uGapTex, q / ${GAP_TILE}.0).r > 1.0 - uGapShare) discard;
      }`);
}

// the plants whose greens the harmony draws together (moss too, in the stone's shader)
const HARMONY_KINDS = ['palm', 'leaf', 'poplar', 'tamarisk', 'reed', 'herb', 'vine', 'grass'];
// sun-dried mud brick in courses (as the Blender scene's brick texture): its joints and one brick lighter or
// darker than the next, in the colour only
const BRICK_KINDS = ['brick', 'firedbrick', 'zig'];
const MOTTLED_KINDS = ['bark', 'ground', 'mud', 'earth', 'path', 'brick', 'firedbrick', 'plaster', 'lime', 'trim', 'wood', 'straw', 'clay', 'buff', 'stone', 'whitewash', 'redwash', 'zig', 'zigcap'];

// The sun's shadow lookup with a wider filter than three's PCF soft (a bilinearly filtered box of 2R + 1 texels;
// R = the light's shadow.radius, 1 to 3; 1 = three's own). Where the sun grazes a surface a shadow-map texel stretches into a long
// rectangle, and its edge, softened over only a texel or two, came back as a staircase of them once the picture
// cut it into two states; filtered wider, the edge is smooth before it is cut.
const SOFT_PCF = /* glsl */ `
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			// narrower where the sun only grazes the surface: there each texel lies stretched along it, and a wide
			// filter smeared a shadow's edge into a long, many-coloured flame
			int R = clamp( int( shadowRadius * mix( 0.34, 1.0, smoothstep( 0.15, 0.6, gShadowNdl ) ) + 0.5 ), 1, 3 );
			float sum = 0.0;
			for ( int j = -3; j <= 4; j ++ ) {
				if ( j < - R || j > R + 1 ) continue;
				float wy = j == - R ? 1.0 - f.y : j == R + 1 ? f.y : 1.0;
				for ( int i = -3; i <= 4; i ++ ) {
					if ( i < - R || i > R + 1 ) continue;
					float wx = i == - R ? 1.0 - f.x : i == R + 1 ? f.x : 1.0;
					sum += wx * wy * texture2DCompare( shadowMap, uv + vec2( float( i ), float( j ) ) * texelSize, shadowCoord.z );
				}
			}
			float nb = float( 2 * R + 1 );
			shadow = sum / ( nb * nb );
`;
function softShadowChunk() {
  const s = THREE.ShaderChunk.shadowmap_pars_fragment;
  const a = s.indexOf('#elif defined( SHADOWMAP_TYPE_PCF_SOFT )');
  const b = s.indexOf('#elif defined( SHADOWMAP_TYPE_VSM )', a);
  if (a < 0 || b < 0) return 'float gShadowNdl = 1.0;\n' + s;
  return 'float gShadowNdl = 1.0;   // the sun\'s cosine on this surface (set in main, see lightMat)\n'
    + s.slice(0, a) + '#elif defined( SHADOWMAP_TYPE_PCF_SOFT )\n' + SOFT_PCF + s.slice(b);
}

// a boat afloat, placed (its group at the water's level, turned about the upright): no water drawn inside it. Its
// outline where its hull meets the water, from where its faces cross the water: its own middle and long axis there
// (a model's may be off its middle, a pole lying in it reaching past one end, or turned in its own frame), its half
// length and half beam, and its beam at the stations (a share of the greatest). (Many hulls are near straight-
// sided, then sharp at the ends: no one curve fits them all)
const STATIONS = [0.6, 0.8, 0.9, 0.97];
export function addBoatHull(group) {
  const pts = [], A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  for (const m of group.children) {
    const g = m.geometry, p = g.attributes.position, ix = g.index ? g.index.array : null;
    const n = ix ? ix.length : p.count;
    for (let t = 0; t < n; t += 3) {
      A.fromBufferAttribute(p, ix ? ix[t] : t); B.fromBufferAttribute(p, ix ? ix[t + 1] : t + 1); C.fromBufferAttribute(p, ix ? ix[t + 2] : t + 2);
      for (const [u, v] of [[A, B], [B, C], [C, A]]) if ((u.y > 0) !== (v.y > 0)) { const f = u.y / (u.y - v.y); pts.push([u.x + (v.x - u.x) * f, u.z + (v.z - u.z) * f]); }
    }
  }
  if (pts.length < 3) return null;
  // (the long axis: the points' principal direction)
  let mx = 0, mz = 0;
  for (const [x, z] of pts) { mx += x; mz += z; }
  mx /= pts.length; mz /= pts.length;
  let sxx = 0, szz = 0, sxz = 0;
  for (const [x, z] of pts) { sxx += (x - mx) ** 2; szz += (z - mz) ** 2; sxz += (x - mx) * (z - mz); }
  const phi = 0.5 * Math.atan2(2 * sxz, szz - sxx), ux = Math.sin(phi), uz = Math.cos(phi);
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  const uv = pts.map(([x, z]) => { const u = x * ux + z * uz, v = x * uz - z * ux; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); return [u, v]; });
  const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2, a = (u1 - u0) / 2, b = (v1 - v0) / 2;
  // (at each station the beam the hull has there: the narrowest of the widest found just either side of it)
  const at = (st, d) => { let w = 0; for (const [u, v] of uv) if (Math.abs(Math.abs(u - cu) / a - st) < d) w = Math.max(w, Math.abs(v - cv)); return w / b; };
  const W = STATIONS.map((st) => Math.min(at(st - 0.015, 0.015) || at(st, 0.05), at(st + 0.015, 0.015) || at(st, 0.05)));
  // (into the world: the middle in the model's frame, then the group's turn and place)
  const lx = cu * ux + cv * uz, lz = cu * uz - cv * ux, Y = group.rotation.y;
  const i = addHull(group.position.x + lx * Math.cos(Y) + lz * Math.sin(Y), group.position.z - lx * Math.sin(Y) + lz * Math.cos(Y), Y + phi, a * 0.97, b * 0.95, { W });
  // (where the cut-out sits in the boat's own frame, for setHull as it moves)
  return { i, lx, lz, yaw: Y + phi };
}
// a boat afloat: no water drawn inside its hull (the FLOW material's uHull). (x, z) its middle, yaw its turn (its
// length along its own z, as a three.js object's rotation.y turns it), a and b its half length and half beam at the
// waterline; W its beam at the stations (waterline), or k: a curve's (1: a lens; 0.5: an ellipse)
export function addHull(x, z, yaw, a, b, { W = null, k = 1 } = {}) {
  const i = shared.uHullN.value;
  if (i >= 12) return -1;
  const w = W ?? STATIONS.map((s) => (1 - s * s) ** k);
  shared.uHull.value[i].set(x, z, Math.sin(yaw), Math.cos(yaw));
  shared.uHullAB.value[i].set(a, b, 0, 0);
  shared.uHullW.value[i].set(...w);
  shared.uHullN.value = i + 1;
  return i;
}
// a boat's cut-out moved with it (addHull's index i), as it rocks
export function setHull(i, x, z, yaw) {
  shared.uHull.value[i].set(x, z, Math.sin(yaw), Math.cos(yaw));
}

// A surface. kind: its material (KINDS); alphaMap: a leaf cut-out (its green channel); bent: the normals are
// the foliage's own (bent round the clump), the same on both faces of a leaf card. Plants drawn as an
// InstancedMesh carry two random numbers per instance in instanceColor (r: lighter/darker, g: yellower/bluer).
// cavity: the mesh carries its baked Cavity as vertex colour (the level's stone).
// flow: a river's or canal's water (land.js strip), the current's speed at its middle (m/s); its geometry carries
// `flow` (metres across, metres downstream) and `wdepth` (the water's depth over its bed)
// flap: a cloth that moves in the wind (its geometry carries a flap attribute: FLAP above)
// colorMap: a painted surface (a mural: temple.js), its colour from the picture rather than the kind's (sRGB; the
// geometry needs uvs); lit like the rest
// detailMap: the kind's colour, light and dark by a picture (linear, 0.5 the kind's own: the eagle's feathers,
// flyover.js plumage.js); the kind's own surface pattern (wood's grain, clay's) left off; the geometry needs uvs
export function lightMat({ kind, alphaMap = null, side = THREE.FrontSide, bent = false, cavity = false, flow = null, flap = false, colorMap = null, detailMap = null } = {}) {
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff, side });
  if (colorMap) m.map = colorMap;
  if (detailMap) m.map = detailMap;
  if (alphaMap) {
    m.alphaMap = alphaMap;
    m.alphaTest = 0.5;
    m.alphaToCoverage = true;
  }
  // the stone's solid blocks cast their shadows from their faces turned to the sun (three draws the far faces by
  // default): a block's far faces include its underside, lying on the floor, so the floor under it read as lit
  // and the shadow's soft edge blended that light into the shadow at the block's foot, a bright seam there
  if (!SWAY[kind] && side !== THREE.DoubleSide && !alphaMap) m.shadowSide = THREE.FrontSide;
  const mottled = MOTTLED_KINDS.includes(kind);
  const sway = SWAY[kind] ?? 0;
  if (sway) {
    // its twin for the sun's shadow pass, moved by the same wind (meshes take it as customDepthMaterial)
    const dm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side });
    if (alphaMap) {
      dm.alphaMap = alphaMap;
      dm.alphaTest = 0.5;
    }
    dm.onBeforeCompile = (sh) => {
      addWind(sh, sway);
        if (kind === 'leaf' || kind === 'poplar' || kind === 'tamarisk') addSunGaps(sh);
      // the leaf's cut-out read blurred (a few mip levels down) for its shadow: the fine leaflets of a frond and
      // the tears in a banana leaf merge, so the shadow is the leaf's whole shape (a comb of thin stripes, each
      // a texel or two wide, read as noise once cut into light and dark, worst on walls the sun only grazes)
      if (alphaMap) {
        sh.uniforms.uShadowLeafBlur = shared.uShadowLeafBlur;
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nuniform float uShadowLeafBlur;')
          .replace('#include <alphamap_fragment>', 'diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv, uShadowLeafBlur ).g;');
      }
    };
    dm.customProgramCacheKey = () => `depth-wind-${sway}-${!!alphaMap}-${['leaf', 'poplar', 'tamarisk'].includes(kind)}`;
    m.userData.depthMat = dm;
  }
  if (flap) {
    const dm = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side });
    dm.onBeforeCompile = addFlap;
    dm.customProgramCacheKey = () => 'depth-flap';
    m.userData.depthMat = dm;
  }
  m.onBeforeCompile = (sh) => {
    if (sway) addWind(sh, sway);
    if (flap) addFlap(sh);
    sh.uniforms.uGloss = shared.gloss[kind];
    sh.uniforms.uSpec = shared.uSpec;
    sh.uniforms.uSpecPow = shared.uSpecPow;
    sh.uniforms.uGlint = shared.uGlint;
    sh.uniforms.uFilmPow = shared.uFilmPow;
    sh.uniforms.uFilmNoise = shared.uFilmNoise;
    sh.uniforms.uScatter = shared.scatter[kind];
    for (const k of ['uNoiseScale', 'uLeafBias', 'uSlopeBias', 'uGrazeCut', 'uSunWorld', 'uNearOn', 'uTransFace', 'uLensOn', 'uLensCount', 'uLensC', 'uLensN', 'uLensIn', 'uLensSeed', 'uLensCast', 'uInlay', 'uInlayColor', 'uMosCells', 'uMosLead', 'uMosCol', 'uMosW', 'uPrismLin', 'uGroundTex', 'uGroundVar', 'uGroundHue', 'uEarth', 'uLensR', 'uLensT', 'uVarL', 'uVarH', 'uMottle', 'uBrick', 'uWaterTime', 'uStreak', 'uShallow', 'uFoam', 'uHullN', 'uHull', 'uHullAB', 'uHullW', 'uMoss', 'uMossJoint', 'uHarmAmt', 'uHarmHue', 'uHarmRange', 'uHarmSat', 'uMossColor', 'uTread', 'uTreadBox', 'uScatterMoss', 'uRockColor', 'uSaltColor', 'uSandColor', 'uCanalP', 'uCanalBox', 'uCanalN', 'uCropColor', 'uDirt', 'uDirtColor', 'uLichen', 'uLichenA', 'uLichenB']) sh.uniforms[k] = shared[k];
    sh.uniforms.uAlbedo = shared.albedo[kind];
    sh.uniforms.uFlowSpeed = { value: flow ?? 0 };
    let vs = sh.vertexShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWorldP;
        varying float vViewZ;
        varying vec3 vInst;
        #ifdef FLOW
          // (flow.w: how fast the current runs here, a share of the water's: a mesh giving only two numbers has 1)
          attribute vec4 flow;
          attribute float wdepth;
          varying vec2 vFlow;
          varying float vWDepth, vWSpeed;
        #endif
        #ifdef ROCKY
          attribute vec3 zone;   // the ground's: wet, salt, sand (land.js zoneAt; 0 where a mesh has none)
          varying vec3 vZone;
        #endif
        uniform float uLeafBias, uSlopeBias;
        uniform vec3 uSunWorld;
        // the normal offset grown with the surface's slope to the sun (tan of the angle, held to 5 times)
        float slopeScale(vec3 n) {
          float c = clamp(dot(normalize(n), uSunWorld), 0.05, 1.0);
          return 1.0 + min(uSlopeBias * sqrt(1.0 - c * c) / c, 4.0);
        }`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        vViewZ = -mvPosition.z;
        #ifdef FLOW
          vFlow = flow.xy;
          vWSpeed = flow.w;
          vWDepth = wdepth;
        #endif
        #ifdef ROCKY
          vZone = zone;
        #endif
        // the instance's numbers, for the fragment (three defines USE_INSTANCING_COLOR in the vertex shader only)
        #ifdef USE_INSTANCING_COLOR
          vInst = instanceColor;
        #else
          vInst = vec3(-1.0);
        #endif
        {
          vec4 wp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            wp = instanceMatrix * wp;
          #endif
          vWorldP = (modelMatrix * wp).xyz;
        }`);
    if (bent) {
      vs = vs.replace('#include <shadowmap_vertex>', `
        float leafScale = 1.0;
        #ifdef USE_INSTANCING
          leafScale = length(instanceMatrix[0].xyz);
        #endif
        ` + THREE.ShaderChunk.shadowmap_vertex.replaceAll('directionalLightShadows[ i ].shadowNormalBias', '(directionalLightShadows[ i ].shadowNormalBias + uLeafBias * leafScale)'));
    } else {
      vs = vs.replace('#include <shadowmap_vertex>', THREE.ShaderChunk.shadowmap_vertex.replaceAll(
        'directionalLightShadows[ i ].shadowNormalBias', '(directionalLightShadows[ i ].shadowNormalBias * slopeScale(shadowWorldNormal))'));
    }
    sh.vertexShader = vs;
    let fs = sh.fragmentShader
      .replace('#include <shadowmap_pars_fragment>', softShadowChunk())
      .replace('#include <lights_fragment_begin>', `#if NUM_DIR_LIGHTS > 0
          gShadowNdl = dot(normal, directionalLights[ 0 ].direction);
        #endif
        #include <lights_fragment_begin>`)
      .replace('#include <common>', `#include <common>
        ${NOISE}
        ${ARCHITECTURAL_SURFACE}
        varying vec3 vInst;
        layout(location = 1) out highp vec4 gAlbedo;
        // the sun's light here as if nothing stood in its way (its cosine, cut where it grazes as the light is):
        // against the light, how much of it a shadow takes (the painting's soft shadow edges)
        layout(location = 2) out highp vec4 gSun;
        uniform vec3 uAlbedo, uMossColor, uRockColor, uDirtColor, uLichenA, uLichenB, uInlayColor;
        uniform float uInlay;
        uniform float uLichen;
        uniform float uGloss, uSpec, uSpecPow, uGlint, uFilmPow, uFilmNoise;
        uniform float uDirt;
        #ifdef ROCKY
          varying vec3 vZone;
          uniform vec3 uSaltColor, uSandColor, uCropColor;
          uniform vec4 uCanalP[${2 * MAX_CANALS}], uCanalBox[${MAX_CANALS}];
          uniform int uCanalN;
          // the plain's fields, out beyond the walk: as they were laid out, long strips running back from a canal's
          // bank (a few tens of metres wide, a few hundred deep, a second and third tier behind), each its own: in
          // the early autumn stubble, ploughed, flooded for the sowing, some green, some fallow and whitened with
          // salt; low bunds between them, the canal's water and its banks. alb: the plain's own colour; px: how many
          // metres a pixel spans here (edges finer than that fade, so far off they do not flicker)
          vec3 farFields(vec2 p, vec3 alb, float px) {
            float best = 1e9, along = 0.0, across = 0.0;
            int ci = -1;
            for (int i = 0; i < ${MAX_CANALS}; i++) {
              if (i >= uCanalN) break;
              vec4 bx = uCanalBox[i];
              if (p.x < bx.x || p.x > bx.z || p.y < bx.y || p.y > bx.w) continue;
              vec4 A = uCanalP[2 * i], B = uCanalP[2 * i + 1];
              vec2 q0 = A.xy, q1 = A.zw, q2 = B.xy, q3 = B.zw, a, b;
              float acc = 0.0;
              for (int k = 0; k < 3; k++) {
                a = k == 0 ? q0 : k == 1 ? q1 : q2;
                b = k == 0 ? q1 : k == 1 ? q2 : q3;
                vec2 ab = b - a;
                float L = length(ab);
                if (L < 1.0) continue;
                vec2 t = ab / L, ap = p - a;
                float u = clamp(dot(ap, t), 0.0, L), dd = length(ap - t * u);
                if (dd < best) { best = dd; along = acc + u; across = dot(ap, vec2(-t.y, t.x)); ci = i; }
                acc += L;
              }
            }
            if (ci < 0) return alb;
            float fc = float(ci), v = abs(across), side = across < 0.0 ? 0.0 : 1.0;
            float depth = 230.0 + 170.0 * hash13(vec3(fc, 1.7, 3.1)), w = 34.0 + 30.0 * hash13(vec3(fc, 5.3, 0.4));
            float tier = floor(v / depth), su = along + tier * w * 0.41 + side * w * 0.5, strip = floor(su / w);
            float h = hash13(vec3(fc * 7.0 + side, tier, strip)), h2 = hash13(vec3(strip, fc + 0.5, tier * 3.0 + side));
            vec3 col = alb * (0.94 + 0.12 * h2);
            if (h < 0.3) col = mix(alb, uCropColor, 0.7 + 0.3 * h2);                        // stubble
            else if (h < 0.47) col = mix(alb, uDirtColor, 0.45 + 0.2 * h2);                 // ploughed
            else if (h < 0.58) col = mix(alb, uRockColor, 0.55 + 0.2 * h2);                 // flooded for the sowing
            else if (h < 0.66 && tier < 2.0) col = mix(uMossColor, alb, 0.4 + 0.2 * h2);   // green
            else if (h < 0.74) col = mix(alb, uSaltColor, 0.25 + 0.25 * h2);                // fallow, salted
            // the bunds between them (only while a pixel is finer than a few metres)
            float fu = fract(su / w) * w, fv = mod(v, depth);
            float edge = min(min(fu, w - fu), min(fv, depth - fv));
            float bund = (1.0 - smoothstep(0.8, 0.8 + px, edge)) * clamp(3.0 / px - 0.5, 0.0, 1.0);
            col = mix(col, alb * 1.12, bund * 0.7);
            // along the canal: its palm gardens' shaded, damper ground; its banks; its water
            col = mix(col, mix(uMossColor, uRockColor, 0.5) * 0.9, (1.0 - smoothstep(25.0, 45.0, v)) * 0.6);
            col = mix(col, alb * 1.1, (1.0 - smoothstep(5.0, 5.0 + px, v)) * clamp(8.0 / px - 0.3, 0.0, 1.0));
            col = mix(col, uRockColor * 0.55, (1.0 - smoothstep(2.4, 2.4 + px, v)) * clamp(5.0 / px - 0.2, 0.0, 1.0));
            // (three tiers deep at most, thinning out into the plain's fallow before a canal's box ends)
            // (past a canal's ends too: by the distance to the canal itself)
            return mix(col, alb, smoothstep(depth * 2.2, depth * 2.2 + 150.0, max(v, best)));
          }
        #endif
        #ifdef EARTH
          uniform float uEarth;
          // the crust's height: clods and hollows (some 2 m, 40 cm and 12 cm across)
          float earthH(vec2 q) {
            return vnoise3(vec3(q * 0.55, 1.0)) * 0.45 + vnoise3(vec3(q * 2.6, 4.0)) * 0.35 + vnoise3(vec3(q * 8.0, 7.0)) * 0.2;
          }
          // pebbles and grit lying on it (a few centimetres; one in some of the 11 cm cells): its colour's change, the
          // stone lit on the sun's side, a little shadow beside it on the other. fw: the cells' size in pixels' terms
          float earthPebbles(vec2 p, vec2 sun, float fw) {
            vec2 c = p * 9.0, i = floor(c), f = fract(c);
            float m = 0.0;
            for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
              vec2 g = vec2(float(x), float(y));
              if (hash13(vec3(i + g, 31.0)) > 0.1 + 0.12 * step(0.6, vnoise3(vec3((i + g) * 0.05, 36.0)))) continue;
              vec2 o = g + 0.2 + 0.6 * vec2(hash13(vec3(i + g, 32.0)), hash13(vec3(i + g, 33.0)));
              float r = 0.07 + 0.2 * pow(hash13(vec3(i + g, 34.0)), 2.0), dl = length(f - o);
              float on = 1.0 - smoothstep(r, r + fw, dl);
              float sh = (1.0 - smoothstep(r * 1.05, r * 1.05 + fw, length(f - o + sun * r * 0.6))) * (1.0 - on);
              float tint = (hash13(vec3(i + g, 35.0)) - 0.5) * 0.3;
              m += on * (tint + 0.22 * dot((f - o) / r, sun)) - 0.22 * sh;
            }
            return m;
          }
        #endif
        #ifdef FLOW
          varying vec2 vFlow;
          varying float vWDepth, vWSpeed;
          uniform float uWaterTime, uFlowSpeed, uStreak, uShallow, uFoam;
          uniform int uHullN;
          uniform vec4 uHull[12], uHullAB[12], uHullW[12];
          // the current here (m/s): slowest in the shallows, still at the waterline
          float flowSpeed() { return uFlowSpeed * vWSpeed * smoothstep(0.0, 1.2, vWDepth); }
          // two readings of a pattern carried downstream, half a cycle apart, and how to blend them (a flow map's
          // two phases): carried on for ever, the faster middle never shears it apart
          vec3 flowPhases(float T) {
            float ph = fract(uWaterTime / T), ph2 = fract(uWaterTime / T + 0.5);
            float sp = flowSpeed();
            return vec3(sp * ph * T, sp * ph2 * T, abs(ph * 2.0 - 1.0));
          }
          // the current's streaks: long along the flow (some 16 m), narrow across it (a metre or two)
          float waterStreak(vec2 f) {
            vec3 q = vec3(f.x * 0.6, f.y * 0.06, 0.0);
            return vnoise3(q) * 0.65 + vnoise3(q * vec3(2.1, 3.3, 1.0) + 7.0) * 0.35;
          }
        #endif
        uniform float uVarL, uVarH, uMottle, uBrick, uMoss, uMossJoint, uScatter, uScatterMoss, uGrazeCut, uNearOn, uTransFace;
        uniform float uGroundVar, uGroundHue;
        uniform sampler2D uGroundTex;
        uniform vec3 uSunWorld, uPrismLin[5];
        ${LENS_LIGHT}
        uniform sampler2D uTread;
        uniform vec4 uTreadBox;
        uniform float uHarmAmt, uHarmHue, uHarmRange, uHarmSat;
        ${OKLAB}
        vec3 harmonise(vec3 c) {
          vec3 l = linToLab(max(c, vec3(0.0)));
          float C = length(l.yz);
          if (C < 1e-4) return c;
          float h = atan(l.z, l.y);
          float dh = mod(h - uHarmHue + 3.14159265, 6.2831853) - 3.14159265;
          float inside = 1.0 - smoothstep(uHarmRange * 0.75, uHarmRange, abs(dh));
          h -= dh * uHarmAmt * inside;
          C *= mix(1.0, uHarmSat, inside);
          return max(labToLin(vec3(l.x, C * cos(h), C * sin(h))), vec3(0.0));
        }`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        #ifdef ARCH_SURFACE
          vec4 architectural = architecturalSurface(vWorldP, inverseTransformDirection(normal, viewMatrix), uAlbedo);
          #ifdef ARCH_BRICK
            architectural.rgb = mix(uAlbedo, architectural.rgb, uBrick);
            architectural.a *= uBrick;
          #endif
          normal = architecturalNormal(-vViewPosition, normal, architectural.a);
        #endif`)
      // the instance colour carries random numbers, not a tint of the light
      .replace('#include <color_fragment>', '')
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        // blue: the brush noise (0..1) plus how far light scatters inside (whole quarter centimetres)
        // the sun's light here (its cosine times its shadow): from the near shadow map where it reaches (the
        // second light, which brings no light itself), fading to the far one's across its rim
        vec4 lensK = lensLight(vWorldP);
        float lightR = outgoingLight.r;
        #if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 1
          if (uNearOn > 0.5) {
            vec4 nsc = vDirectionalShadowCoord[ 1 ];
            vec3 np = nsc.xyz / nsc.w;
            vec2 ne = min(np.xy, 1.0 - np.xy);
            float wN = smoothstep(0.0, 0.12, min(ne.x, ne.y));
            if (wN > 0.0) {
              DirectionalLightShadow nls = directionalLightShadows[ 1 ];
              float sN = getShadow(directionalShadowMap[ 1 ], nls.shadowMapSize, nls.shadowIntensity, nls.shadowBias, nls.shadowRadius, nsc);
              lightR = mix(lightR, max(dot(normal, directionalLights[ 0 ].direction), 0.0) * sN, wN);
            }
          }
        #endif
        lightR *= lensK.a;
        float grazeK = 1.0;
        #if NUM_DIR_LIGHTS > 0
          grazeK = smoothstep(uGrazeCut * 0.4, uGrazeCut, dot(normal, directionalLights[0].direction));
        #endif
        gl_FragColor = vec4(lightR * grazeK, vViewZ, min(brush(vWorldP * uNoiseScale), 0.999) + floor(uScatter * 4.0 + 0.5), diffuseColor.a);
        gSun = vec4(0.0, 0.0, 0.0, 1.0);
        #if NUM_DIR_LIGHTS > 0
          gSun.r = max(dot(normal, directionalLights[0].direction), 0.0) * grazeK;
        #endif
        // the sun's highlight on a smooth surface, added above 1 (where the picture paints its highlights);
        // the glossiest finely roughened into sparse glints
        #if NUM_DIR_LIGHTS > 0
          if (uGloss > 0.0) {
            vec3 Ld = directionalLights[0].direction, Vd = normalize(vViewPosition), n = normal;
            float ndl = dot(normal, Ld);
            float reach = ndl > 0.02 ? clamp(lightR / ndl, 0.0, 1.0) : 0.0;   // the sun not shadowed
            vec3 Hv = normalize(Ld + Vd);
            #ifdef FLOW
              // water: its highlight broken by small ripples (narrow across the current, longer along it), so the
              // sun on it is a path of glitter rather than one disc
              // (carried downstream by the current, so the glitter drifts with it)
              {
                float tw = uWaterTime;
                vec3 fp = flowPhases(6.0);
                vec2 rip = vec2(0.0);
                for (int k = 0; k < 2; k++) {
                  vec2 q = vFlow - vec2(0.0, k == 0 ? fp.x : fp.y) + (k == 0 ? vec2(0.0) : vec2(17.3, 5.1));
                  vec2 r = vec2(vnoise3(vec3(q * vec2(3.2, 0.9), tw * 0.6)), vnoise3(vec3(q * vec2(1.0, 4.0) + 9.0, tw * 0.5))) - 0.5;
                  r += 0.7 * (vec2(vnoise3(vec3(q * 9.0, tw * 1.1 + 3.0)), vnoise3(vec3(q * 8.3 + 5.0, tw))) - 0.5);
                  rip += r * (k == 0 ? 1.0 - fp.z : fp.z);
                }
                n = normalize(normal + mat3(viewMatrix) * vec3(rip.x, 0.0, rip.y) * 0.5);
              }
            #endif
            // the highlight follows the leaf's (or stone's) own curve: a streak, not blotches
            gl_FragColor.r += uSpec * uGloss * reach * pow(max(dot(n, Hv), 0.0), uSpecPow);
            // glints: on the glossiest, tiny facets (a dot of about 3 cm in a cell, a share of the cells set by
            // uGlint), each tilted its own way (fixed on the leaf, not turning with the eye), flashing when it
            // happens to catch the sun; most catch it near the streak, as on a wet leaf. A flash is marked by
            // adding 8 to the light (the picture sees > 5 as a glint: white, a touch of prism, glare)
            if (uGloss > 0.6 && uGlint > 0.0) {
              vec3 q = vWorldP * 30.0, cell = floor(q);
              if (hash13(cell) > 1.0 - 0.35 * uGlint) {
                vec3 jit = vec3(hash13(cell + 1.7), hash13(cell + 3.1), hash13(cell + 5.3)) - 0.5;
                vec3 jn = normalize(normal + mat3(viewMatrix) * jit * 1.0);
                float dot2 = length(q - cell - 0.5 - jit * 0.3);
                if (dot2 < 0.5 && reach > 0.5 && pow(max(dot(jn, Hv), 0.0), 60.0) > 0.5) gl_FragColor.r += 8.0;
              }
            }
          }
        #endif
        #if defined(METAL) && NUM_DIR_LIGHTS > 0
          {
            // polished metal (the mosaic room's silver wires, upright rods): it shows what it mirrors, not its own
            // light. Across the rod: its edges dark (they mirror the room off to the sides, grazing), its body light
            // (the white room behind one), a darker band down it (the floor's horizon mirrored), and along the edge
            // turned to the sun the sun itself, a hard white line (the highlight family). So the light changes
            // across it in narrow bands, the way metal's does, wherever the sun is (a plain highlight needs the
            // mirror angle to come out right, and with the sun ahead an upright wire never gives one)
            vec3 Vd = normalize(vViewPosition), Ld = directionalLights[0].direction;
            vec3 Av = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);   // the rod's axis (upright)
            vec3 Xv = normalize(cross(Av, Vd));                                  // across it, as seen
            float s = dot(normal, Xv) * (dot(Ld, Xv) >= 0.0 ? 1.0 : -1.0);    // -1..1 across, + on the sun's side
            float facing = clamp(dot(normal, Vd), 0.0, 1.0);
            // (the picture paints light in families, not shades: so the bands are made to cross from one to the next —
            // the dark ones into the shadow's, the sun's line into the highlight's)
            float m = 0.6 * smoothstep(0.1, 0.4, facing);
            m *= 1.0 - 0.95 * exp(-pow((s + 0.2) * 6.0, 2.0));
            m += 1.8 * exp(-pow((s - 0.7) * 8.0, 2.0)) * smoothstep(0.0, 0.3, length(Ld - Av * dot(Ld, Av)));
            gl_FragColor.r = max(m, 0.0) * lensK.a;
          }
        #endif
        vec3 alb = uAlbedo;
        #ifdef ARCH_SURFACE
          alb = architectural.rgb;
        #endif
        #ifdef PAINTED
          alb = texture2D(map, vMapUv).rgb;
        #endif
        #ifdef DETAIL
          alb *= texture2D(map, vMapUv).rgb * 2.0;
        #endif
        if (vInst.x >= 0.0) {
          float kL = 1.0 + uVarL * (vInst.r - 0.5) * 2.0, kH = uVarH * (vInst.g - 0.5) * 2.0;
          alb *= vec3(kL * (1.0 + kH), kL * (1.0 + kH * 0.25), kL * (1.0 - kH));
        }
        #ifdef HARMONY
          alb = harmonise(alb);
        #endif
        #ifdef LICHEN
          // lichen: pale and pink patches on the bark
          float lichen = smoothstep(1.0 - uLichen, 1.0 - uLichen + 0.04, brush(vWorldP * vec3(1.3, 0.7, 1.3) + 19.0));
          alb = mix(alb, brush(vWorldP * 0.4 + 41.0) > 0.5 ? uLichenA : uLichenB, lichen);
        #endif
        #ifdef MOTTLED
          alb *= 1.0 + uMottle * (brush(vWorldP * 0.21 + 7.0) - 0.5) * 2.4;
        #endif
        #ifdef BRICK
          {
            // courses 24 cm high, bricks 72 cm long, every other course set over by half a brick (along x - z, so
            // the walls facing either way are coursed); each brick a little lighter or darker, the joints darker.
            // The joints fade out where they would be finer than a pixel or two, so they never shimmer
            // On level faces (a pavement, a stair's treads, a quay's or a wall's top) the coursing read as long
            // parallel lines, like planks: there the bricks are the square baked ones of a pavement, some 34 cm a
            // side, every other row set over by half, their joints filled with dust (lighter, not darker), each
            // brick's tone its own and, where feet go, worn paler and smoother
            vec3 bN = inverseTransformDirection(normal, viewMatrix);
            float lev = step(0.7, abs(bN.y));
            vec2 bs = mix(vec2(0.72, 0.24), vec2(0.34, 0.34), lev);
            vec2 bq = mix(vec2(vWorldP.x - vWorldP.z, vWorldP.y), vWorldP.xz, lev) / bs;
            float row = floor(bq.y);
            bq.x += mod(row, 2.0) * 0.5;
            vec2 cell = floor(bq), f = fract(bq);
            float trodB = lev > 0.5 && uTreadBox.z > 0.0 ? texture2D(uTread, (vWorldP.xz - uTreadBox.xy) * uTreadBox.zw).r : 0.0;
            alb *= 1.0 + uBrick * (1.0 + 0.5 * lev) * ((step(0.5, hash13(vec3(cell, 3.0))) - 0.5) * 0.16 + (hash13(vec3(cell, 7.0)) - 0.5) * 0.12);
            vec2 dj2 = min(f, 1.0 - f) * bs;
            float dj = min(dj2.x, dj2.y), fw = fwidth(dj);
            float joint = (1.0 - smoothstep(0.012, 0.012 + fw * 1.5, dj)) * smoothstep(0.03, 0.012, fw);
            alb *= 1.0 - mix(0.36, -0.1, lev) * uBrick * joint * (1.0 - 0.5 * trodB);
            alb *= 1.0 + 0.08 * trodB * lev;
          }
        #endif
        #ifdef INLAY
          // the mosaic room's floor: a Persian inlay of thin lines, eight-pointed stars (khatam: a square and the
          // square turned through 45°, together) in a square lattice, the crosses between them its own; fading
          // out far off (and smoothed by its own change across the pixel), so it never shimmers
          if (uInlay > 0.0) {
            vec2 f = fract(vWorldP.xz / 1.6) - 0.5, a = abs(f);
            float star = abs(min(max(a.x, a.y), (a.x + a.y) * 0.70710678) - 0.29);
            float grid = min(0.5 - a.x, 0.5 - a.y);
            float d = min(star, grid);
            float line = 1.0 - smoothstep(0.008, 0.008 + 1.5 * fwidth(d), d);
            alb = mix(alb, uInlayColor, uInlay * line * smoothstep(40.0, 12.0, vViewZ));
          }
        #endif
        // (the hardened earth's relief and tone, its cracks and grit: worked out here, laid on below, once it is
        // known how much of the ground is under grass, which hides the cracks)
        float eRel = 0.0, eCrack = 0.0, grassK = 0.0;
        #ifdef EARTH
          if (uEarth > 0.0) {
            // hardened earth: sun-baked mud, trodden flat where feet go. Its clods and hollows shaded by the sun's
            // slope across them (a relief painted into the colour, the light's families left as they are); cracked
            // into plates where nobody walks, the cracks filled with dust on the paths; grit; broad blotches of
            // damper and dustier ground. Fading out with distance, where it would only shimmer
            vec2 p = vWorldP.xz;
            float trodE = uTreadBox.z > 0.0 ? texture2D(uTread, (p - uTreadBox.xy) * uTreadBox.zw).r : 0.0;
            #ifndef ROCKY
              trodE = 1.0;
            #endif
            float near = smoothstep(60.0, 15.0, vViewZ), close = smoothstep(18.0, 5.0, vViewZ);
            vec2 sunXZ = uSunWorld.xz / max(length(uSunWorld.xz), 1e-3);
            // (the clods: a height field's slope to the sun, cut crisply into a lit side, a shaded side and the
            // flat between, as the picture paints light in families, not shades)
            float e = 0.03, h0 = earthH(p);
            vec2 grad = vec2(earthH(p + vec2(e, 0.0)) - h0, earthH(p + vec2(0.0, e)) - h0) / e;
            float lit = dot(grad, sunXZ), lw = fwidth(lit) * 1.5 + 0.08;
            float relief = (0.12 * (smoothstep(0.8, 0.8 + lw, lit) - smoothstep(0.8, 0.8 + lw, -lit)) + 0.025 * clamp(lit, -1.0, 1.0))
              * (1.0 - 0.6 * trodE) * near;
            // (broad patches of damper and dustier ground, with a clean edge; a slow swell under them)
            float tone = (smoothstep(0.47, 0.53, vnoise3(vec3(p * 0.16, 11.0))) - 0.5) * 0.09 + (vnoise3(vec3(p * 0.05, 13.0)) - 0.5) * 0.14;
            // (no dried-mud cracks)
            // (pebbles and grit, where one looks closely)
            float peb = earthPebbles(p, sunXZ, length(fwidth(p * 9.0)) * 1.2) * close * (1.0 - 0.5 * trodE);
            eRel = relief + tone;
            eCrack = peb;
          }
        #endif
        #ifdef ROCKY
          float rock = smoothstep(0.75, 0.55, inverseTransformDirection(normal, viewMatrix).y);
          // the forest floor's picture (groundTexture): its lightness and hue shifted dab by dab; thinner on the
          // trodden path
          if (uGroundVar > 0.0) {
            // (two readings of the picture, at different sizes and turned against each other, so its repeat
            // never shows as a lattice over a wide plain)
            vec2 gq = mat2(0.8, -0.6, 0.6, 0.8) * vWorldP.xz / (${GROUND_TILE}.0 * 2.7) + 0.37;
            vec4 gt = mix(texture2D(uGroundTex, vWorldP.xz / ${GROUND_TILE}.0), texture2D(uGroundTex, gq),
              smoothstep(0.35, 0.65, brush(vWorldP * 0.05 + 13.0)));
            float trodden = uTreadBox.z > 0.0 ? texture2D(uTread, (vWorldP.xz - uTreadBox.xy) * uTreadBox.zw).r : 0.0;
            float k = uGroundVar * (1.0 - 0.6 * trodden) * (1.0 - uEarth);
            vec3 gl = linToLab(max(alb, vec3(0.0)));
            float dl = (gt.r - 0.5) * 2.0 * k, dh = (gt.g - 0.5) * 2.0 * k * uGroundHue;
            float C = length(gl.yz), h = atan(gl.z, gl.y) + dh;
            alb = max(labToLin(vec3(gl.x * (1.0 + dl), C * (1.0 + abs(dl) * 0.5) * cos(h), C * (1.0 + abs(dl) * 0.5) * sin(h))), vec3(0.0));
          }
          // the desert's sand; a salt crust in white patches (on the flat west of the river, round the lagoon)
          // the plain's fields, far off (a zone's sand below 0: how much is farmed)
          if (vZone.z < -0.001 && uCanalN > 0) alb = mix(alb, farFields(vWorldP.xz, alb, max(length(fwidth(vWorldP.xz)), 0.05)), min(-vZone.z, 1.0));
          alb = mix(alb, uSandColor * (1.0 + uMottle * (brush(vWorldP * 0.2 + 9.0) - 0.5) * 1.2), max(vZone.z, 0.0));
          float salt = vZone.y * 1.3 + (brush(vWorldP * 0.11 + 3.0) - 0.5) * 1.1 + (brush(vWorldP * 0.9 + 1.0) - 0.5) * 0.3;
          alb = mix(alb, uSaltColor * (1.0 + uMottle * (brush(vWorldP * 0.5 + 4.0) - 0.5)), smoothstep(0.62, 0.7, salt) * min(vZone.y * 3.0, 1.0));
          // grass over a river's banks (a zone's salt below 0: how much): the moss's green, half the plain's dust in
          // it, in patches with a crisp edge, thicker the more there is
          float gz = clamp(-vZone.y, 0.0, 1.0);
          grassK = smoothstep(0.4, 0.46, brush(vWorldP * 0.09 + 21.0) * 0.6 + (brush(vWorldP * 0.7 + 2.0) - 0.5) * 0.3 + gz * 0.22) * min(gz * 2.0, 1.0);
          alb = mix(alb, mix(uMossColor, alb, 0.15) * (1.0 + uMottle * (brush(vWorldP * 0.8 + 8.0) - 0.5) * 2.0), grassK);
          // wet, darker silt just above any water and on steep banks, its upper edge ragged
          float wet = max(rock * (1.0 - vZone.z), smoothstep(0.32, 0.55, vZone.x + (brush(vWorldP * 1.7 + 2.0) - 0.5) * 0.3));
          alb = mix(alb, uRockColor * (1.0 + uMottle * (brush(vWorldP * 0.3 + 5.0) - 0.5) * 2.0), wet);
        #endif
        #ifdef EARTH
          alb *= 1.0 + uEarth * (eRel * (1.0 - 0.4 * grassK) + eCrack * (1.0 - grassK));
        #endif
        #ifdef FLOW
          {
            // the current: slowest in the shallows, still at the waterline. The streaks drift downstream, read
            // twice half a cycle apart and blended (a flow map's two phases), so they flow on for ever without
            // the faster middle shearing them apart
            // (no water inside a boat afloat: its hull's inside shows)
            for (int i = 0; i < 12; i++) {
              if (i >= uHullN) break;
              vec2 dd = vWorldP.xz - uHull[i].xy;
              float u = dot(dd, uHull[i].zw), v = dot(dd, vec2(uHull[i].w, -uHull[i].z));
              float t = abs(u) / uHullAB[i].x;
              if (t >= 1.0) continue;
              vec4 W = uHullW[i];
              float w = t < 0.6 ? mix(1.0, W.x, t / 0.6) : t < 0.8 ? mix(W.x, W.y, (t - 0.6) / 0.2)
                : t < 0.9 ? mix(W.y, W.z, (t - 0.8) / 0.1) : t < 0.97 ? mix(W.z, W.w, (t - 0.9) / 0.07) : mix(W.w, 0.0, (t - 0.97) / 0.03);
              if (abs(v) < uHullAB[i].y * w) discard;
            }
            vec3 fp = flowPhases(8.0);
            float n1 = waterStreak(vFlow - vec2(0.0, fp.x));
            float n2 = waterStreak(vFlow + vec2(13.7, 41.0) - vec2(0.0, fp.y));
            float n = mix(n1, n2, fp.z);
            // a step lighter (and greener) or darker (and browner), with crisp edges: painted, not graded
            float hi = smoothstep(0.6, 0.63, n), lo = smoothstep(0.37, 0.34, n);
            vec3 wl = linToLab(max(alb, vec3(0.0)));
            wl.x *= 1.0 + uStreak * (0.1 * hi - 0.08 * lo);
            wl.yz += uStreak * (vec2(-0.012, 0.004) * hi + vec2(0.006, 0.01) * lo);
            alb = max(labToLin(wl), vec3(0.0));
            // the shallows: the silt bed showing through in two steps, their edge broken by the streaks
            float sh = 1.0 - smoothstep(0.08, 0.7, vWDepth + (n - 0.5) * 0.25);
            alb = mix(alb, uRockColor * 1.15, uShallow * (sh > 0.66 ? 0.75 : sh > 0.25 ? 0.4 : 0.0));
            // the waterline: a thin pale line of wet sheen and scum where it laps the bank
            float wline = smoothstep(0.06, 0.0, abs(vWDepth - 0.02) - (n - 0.5) * 0.05);
            alb = mix(alb, uRockColor * 2.2, uFoam * wline);
            // flecks of foam and bits of chaff carried on the current, a little apart across it, drawn out along
            // it: where they drift one sees the river run (none on still water)
            {
              float fl = 0.0;
              for (int k = 0; k < 2; k++) {
                vec2 q = vFlow - vec2(0.0, k == 0 ? fp.x : fp.y) + (k == 0 ? vec2(0.0) : vec2(31.7, 11.3));
                float c = vnoise3(vec3(q * vec2(1.6, 0.55), 2.0)) * 0.6 + vnoise3(vec3(q * vec2(4.1, 1.3), 5.0)) * 0.4;
                fl += smoothstep(0.74, 0.77, c) * (k == 0 ? 1.0 - fp.z : fp.z);
              }
              alb = mix(alb, uRockColor * 2.0, uFoam * 0.8 * fl * smoothstep(0.05, 0.3, flowSpeed()) * smoothstep(0.3, 0.8, vWDepth));
            }
            gl_FragColor.b += 64.0;   // (marks the water for its reflections: water.js)
          }
        #endif
        float cav = 0.0;
        #if defined(CAVITY) && defined(USE_COLOR)
          cav = vColor.r;
          alb = mix(alb, uDirtColor, clamp(uDirt * cav, 0.0, 1.0));
        #endif
        #ifdef MOSSY
          // moss in patches with a hard, ragged edge, where it grows: in the joints, grooves and inside corners
          // (the baked Cavity), and on ledges and tops away from where feet go (the trodden path stays bare)
          vec3 wN = inverseTransformDirection(normal, viewMatrix);
          float grain = brush(vWorldP * 3.1 + 3.0);
          float inJoint = cav + (grain - 0.5) * 0.35 - (1.15 - 0.75 * uMossJoint);
          float trod = uTreadBox.z > 0.0 ? texture2D(uTread, (vWorldP.xz - uTreadBox.xy) * uTreadBox.zw).r : 0.0;
          float onTop = smoothstep(0.55, 0.85, wN.y) * (1.0 - trod)
            * (brush(vWorldP * 0.6 + 9.0) + (grain - 0.5) * 0.45) - (1.0 - 0.45 * uMoss);
          if (max(inJoint, onTop) > 0.0) {
            // two greens, a yellower and a deeper one, in small clumps
            alb = mix(uMossColor, uMossColor * vec3(1.3, 1.22, 0.7), step(0.5, brush(vWorldP * 7.0 + 1.0)));
            alb = harmonise(alb);   // moss belongs with the plants
            gl_FragColor.b = fract(gl_FragColor.b) + floor(uScatterMoss * 4.0 + 0.5);
          }
        #endif
        // alpha: how much it faces the sky (0 straight down, 1 straight up), for the shadow family's own range
        float upward = 0.5 + 0.5 * inverseTransformDirection(normal, viewMatrix).y;
        #ifdef TRANSLUCENT
          // a leaf, seen from the face turned away from the sun, or from the face the sun only grazes (below the
          // lit / shadow border, uTransFace: the sun's cosine there): light can come through it to us. So where a
          // leaf curls over, its grazed strip and its far side glow alike, not a dark band then a glow. Its own
          // face (its smooth normal; a clump's cards their flat face, not the bent normal). Stable as one walks:
          // it changes only on crossing the leaf's plane.
          float awayFromSun = 0.0;
          #if NUM_DIR_LIGHTS > 0
            #ifdef BENT
              vec3 faceN = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));   // towards us
            #else
              vec3 faceN = normal;                                                        // (turned towards us)
            #endif
            awayFromSun = step(dot(faceN, directionalLights[0].direction), uTransFace);
          #endif
          gAlbedo = vec4(max(alb, vec3(0.0)), upward * 0.49 + 0.5 * awayFromSun);
        #elif defined(FILM)
          // the relic: where on the prism palette its thin film is, seen from here (negative, to mark it)
          float grazing = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), uFilmPow);
          float film = clamp(0.03 + 0.94 * grazing + (brush(vWorldP * 0.45 + 3.0) - 0.5) * uFilmNoise, 0.0, 1.0);
          gAlbedo = vec4(max(alb, vec3(0.0)), -(0.02 + 0.96 * film));
        #else
          gAlbedo = vec4(max(alb, vec3(0.0)), upward * 0.49);
        #endif
        #ifdef HARMONY
          gAlbedo.a += 1.0;   // a plant (1..2), for the picture's prism border
        #endif`);
    if (bent) fs = fs.replace('#include <normal_fragment_begin>', THREE.ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''));
    sh.fragmentShader = fs;
  };
  m.defines = { ...(mottled ? { MOTTLED: '' } : {}), ...(BRICK_KINDS.includes(kind) ? { BRICK: '' } : {}), ...(kind === 'ground' ? { ROCKY: '' } : {}), ...(['ground', 'path', 'earth'].includes(kind) ? { EARTH: '' } : {}), ...(cavity ? { CAVITY: '' } : {}), ...(alphaMap ? { TRANSLUCENT: '' } : {}), ...(kind === 'relic' ? { FILM: '' } : {}), ...(kind === 'silver' ? { METAL: '' } : {}), ...(kind === 'white' ? { INLAY: '' } : {}), ...(HARMONY_KINDS.includes(kind) ? { HARMONY: '' } : {}), ...(bent ? { BENT: '' } : {}), ...(flow !== null ? { FLOW: '' } : {}), ...(colorMap ? { PAINTED: '' } : {}) };
  // These supersede the older colour-only brick grid, leaving the lighting and palette controls intact.
  if (SURFACE_KINDS.includes(kind)) {
    m.defines.ARCH_SURFACE = '';
    delete m.defines.BRICK;
    if (BRICK_KINDS.includes(kind)) m.defines.ARCH_BRICK = '';
    if (COATED_KINDS.includes(kind)) m.defines.ARCH_COAT = '';
    if (kind === 'wood') m.defines.ARCH_WOOD = '';
    if (['straw', 'linen'].includes(kind)) m.defines.ARCH_WEAVE = '';
    if (['clay', 'buff'].includes(kind)) m.defines.ARCH_CLAY = '';
  }
  if (detailMap) {
    for (const k of ['ARCH_SURFACE', 'ARCH_BRICK', 'ARCH_COAT', 'ARCH_WOOD', 'ARCH_WEAVE', 'ARCH_CLAY', 'BRICK', 'MOTTLED']) delete m.defines[k];
    m.defines.DETAIL = '';
  }
  if (cavity) m.vertexColors = true;
  m.customProgramCacheKey = () => `light-${kind}-${bent}-${cavity}-${sway}-${flow !== null}-${flap}-${!!colorMap}-${!!detailMap}`;
  return m;
}

export const DEBUG_VIEWS = { final: 0, binary: 1, light: 2, band: 3, depth: 4, albedo: 5 };

// The glass mosaic's pattern, shared by the glass (lens.js) and the light through it (lensLight): broken pieces
// of coloured glass set in lead, of no figure — irregular (Voronoi) shards of their own sizes, laid at random,
// as in the mosaic glass of Turkish and Arab lamps. Mostly blues (cobalt, turquoise, deep blue, sky), with
// amber and ruby here and there.
export const MOSAIC = /* glsl */ `
uniform float uMosCells, uMosLead;
uniform vec3 uMosCol[6];
uniform float uMosW[6];
vec2 mosHash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
// p: a point on the disc, in radii; seed: where in the pattern this disc is cut from; inner: its hole's radius
// (a ring; 0 = a disc). The glass's colour there (linear) and how much lead (1 = lead, or the rims of lead round
// its edge and its hole); piece: which piece it is
vec4 mosaic(vec2 p, vec2 seed, float inner, out vec2 piece) {
  piece = vec2(0.0);
  float r = length(p);
  if (r > 0.95 || (inner > 0.0 && r < inner + 0.05)) return vec4(0.0, 0.0, 0.0, 1.0);
  vec2 q = p * uMosCells + seed;
  vec2 g = floor(q), f = q - g, id = g;
  float d1 = 9.0, d2 = 9.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 o = vec2(float(i), float(j)), pt = o + 0.05 + 0.9 * mosHash2(g + o);
    float d = length(pt - f);
    if (d < d1) { d2 = d1; d1 = d; id = g + o; } else if (d < d2) d2 = d;
  }
  piece = id;
  float lead = 1.0 - smoothstep(uMosLead * 0.6, uMosLead, d2 - d1);
  float h = mosHash2(id + 7.7).x;
  vec3 c = uMosCol[5];
  for (int k = 0; k < 6; k++) { if (h < uMosW[k]) { c = uMosCol[k]; break; } }
  return vec4(c, lead);
}
`;

// The sunlight through the glass mosaic at a point P (world): followed back towards the sun, does it pass through
// one of the pieces of mosaic glass (the disc in the ring, lens.js; the rings of the mosaic room, mosaicRoom.js)?
// Through a piece of glass: its colour (rgb, as a tint, its brightest channel 1) and uLensT of the light (a);
// through the lead and the rims, its shadow; through two, both. Elsewhere (1, 1, 1, 1). Every surface's shader
// uses it for the light (lightMat), the picture's for the colour (makeShadeMaterial). Needs uSunWorld.
export const LENS_LIGHT = /* glsl */ `
#define MAX_LENSES ${MAX_LENSES}
uniform float uLensOn, uLensT, uLensCast;
uniform int uLensCount;
uniform vec3 uLensC[MAX_LENSES], uLensN[MAX_LENSES];
uniform float uLensR[MAX_LENSES], uLensIn[MAX_LENSES];
uniform vec2 uLensSeed[MAX_LENSES];
${MOSAIC}
vec4 lensLight(vec3 P) {
  vec4 k = vec4(1.0);
  if (uLensOn < 0.5) return k;
  for (int i = 0; i < MAX_LENSES; i++) {
    if (i >= uLensCount) break;
    vec3 N = uLensN[i];
    float dn = dot(uSunWorld, N);
    if (abs(dn) < 1e-3) continue;
    float t = dot(uLensC[i] - P, N) / dn;
    if (t <= 0.05) continue;
    vec3 H = P + uSunWorld * t - uLensC[i];
    vec3 ax = normalize(cross(vec3(0.0, 1.0, 0.0), N)), ay = cross(N, ax);
    vec2 p = vec2(dot(H, ax), dot(H, ay)) / uLensR[i], piece;
    float r = length(p);
    if (r > 1.0 || r < uLensIn[i]) continue;
    vec4 m = mosaic(p, uLensSeed[i], uLensIn[i], piece);
    // (through two pieces, one after the other: both colours, both losses)
    if (m.a > 0.5) k.a *= 0.06;
    else { k.rgb *= m.rgb / max(max(m.r, m.g), max(m.b, 1e-4)); k.a *= uLensT; }
  }
  return k;
}
`;

export const OKLAB = /* glsl */ `
vec3 linToLab(vec3 c) {
  vec3 lms = vec3(
    0.4122214708 * c.r + 0.5363325363 * c.g + 0.0514459929 * c.b,
    0.2119034982 * c.r + 0.6806995451 * c.g + 0.1073969566 * c.b,
    0.0883024619 * c.r + 0.2817188376 * c.g + 0.6299787005 * c.b);
  lms = pow(max(lms, vec3(0.0)), vec3(1.0 / 3.0));
  return vec3(
    0.2104542553 * lms.x + 0.7936177850 * lms.y - 0.0040720468 * lms.z,
    1.9779984951 * lms.x - 2.4285922050 * lms.y + 0.4505937099 * lms.z,
    0.0259040371 * lms.x + 0.7827717662 * lms.y - 0.8086757660 * lms.z);
}
vec3 labToLin(vec3 L) {
  vec3 lms = vec3(
    L.x + 0.3963377774 * L.y + 0.2158037573 * L.z,
    L.x - 0.1055613458 * L.y - 0.0638541728 * L.z,
    L.x - 0.0894841775 * L.y - 1.2914855480 * L.z);
  lms = lms * lms * lms;
  return vec3(
     4.0767416621 * lms.x - 3.3077115913 * lms.y + 0.2309699292 * lms.z,
    -1.2684380046 * lms.x + 2.6097574011 * lms.y - 0.3413193965 * lms.z,
    -0.0041960863 * lms.x - 0.7034186147 * lms.y + 1.7076147010 * lms.z);
}
bool inGamut(vec3 c) { return all(greaterThanEqual(c, vec3(-1e-3))) && all(lessThanEqual(c, vec3(1.001))); }
// to linear sRGB the screen can show: a colour out of reach loses colourfulness, not lightness, until it fits
vec3 labToLinFit(vec3 L) {
  vec3 c = labToLin(L);
  if (!inGamut(c) && L.x < 1.0) {
    float lo = 0.0, hi = 1.0;
    for (int i = 0; i < 7; i++) {
      float k = 0.5 * (lo + hi);
      if (inGamut(labToLin(vec3(L.x, L.yz * k)))) lo = k; else hi = k;
    }
    c = labToLin(vec3(L.x, L.yz * lo));
  }
  return clamp(c, 0.0, 1.0);
}
vec3 linToScreen(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(12.92 * c, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
vec3 screenToLin(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 labToScreen(vec3 L) { return linToScreen(labToLinFit(L)); }
`;

export function makeShadeMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      tLight: { value: null },
      tAlbedo: { value: null },
      tSun: { value: null },
      // the cast shadows' edges: how much they follow the shadow's own soft edge (0: cut at the threshold, as the
      // turn of a form is), and how much of the band's colours stays in them (0: a plain blend)
      uShadowSoft: { value: 0 }, uShadowBand: { value: 0.35 },
      uTexel: { value: new THREE.Vector2(1, 1) },
      // the glass mosaic's coloured light (LENS_LIGHT), shared with every surface's shader
      ...Object.fromEntries(['uSunWorld', 'uLensOn', 'uLensCount', 'uLensC', 'uLensN', 'uLensIn', 'uLensSeed', 'uLensR', 'uLensT', 'uLensCast', 'uMosCells', 'uMosLead', 'uMosCol', 'uMosW'].map((k) => [k, shared[k]])),
      uTh: { value: 0.16 },
      // the band is never wider on the surface than uBandMax metres (on a wide curve it narrows to a crisp
      // edge; on a plane, where the light does not change, it vanishes and the plane takes one family whole), and
      // the brush never moves the border more than uJitMax metres (a wobble, never blotches on a plane)
      uBandMax: { value: 0.18 },
      uJitMax: { value: 0.12 },
      uPixelAngle: { value: 0.001 },   // the view's angle per pixel (radians), for metres per pixel
      uWD: { value: 0.06 },
      uWL: { value: 0.1 },
      uMode: { value: 0 },
      uPxD: { value: 3 },
      uPxL: { value: 4 },
      uTol: { value: 0.04 },
      uSil: { value: 0.7 },
      uJit: { value: 0.08 },
      uDebug: { value: 0 },
      // the sky: from its horizon colour to its zenith colour (sRGB), along the view ray's height
      uSkyTop: { value: new THREE.Vector3(0.25, 0.5, 0.85) },
      uSkyHorizon: { value: new THREE.Vector3(0.75, 0.88, 0.96) },
      uSkyCurve: { value: 0.6 },
      uInvProj: { value: new THREE.Matrix4() },
      uCamWorld: { value: new THREE.Matrix4() },
      // the two lights a colour is seen under (linear, intensity included), and each side's colourfulness
      uSun: { value: new THREE.Vector3(1, 1, 1) },
      uShade: { value: new THREE.Vector3(0.3, 0.3, 0.3) },
      uLitSat: { value: 1 },
      uShadeSat: { value: 1 },
      // shadows pulled towards the shadow light's hue (uShadeDir, its OKLab hue), with at least uShadeMinC
      // colourfulness, so a grey or brown thing in shade turns blue rather than grey
      uShadeDir: { value: new THREE.Vector2(0, -1) },
      uShadePull: { value: 0 },
      uShadeMinC: { value: 0 },
      // the band's model: 1 = the form's anatomy (a halftone on the lit side where the surface's own colour is
      // at its most saturated, a core shadow darker and cooler on the dark side, reflected light lifting the
      // rest of the shadow), 0 = colour stops (below)
      uModel: { value: 1 }, uBandOn: { value: 1 },
      uPeakChroma: { value: 1.6 },   // the halftone's colourfulness, times the lit colour's
      uPeakMin: { value: 0.09 },     // ... and at least this (so white stone under warm light turns orange there)
      uPeakHue: { value: 0 },        // its hue turned from the lit colour's (radians)
      uPeakDark: { value: 0.06 },    // and a little darker than the lit colour
      uPeakFocus: { value: 1.4 },    // > 1: the peak held tighter to the border
      uPeakMaxL: { value: 0.8 },     // never lighter than this (a sunlit white would leave no room for colour)
      uCoreDark: { value: 0.3 },     // the core shadow: darker than the shadow by this
      uCoreChroma: { value: 0.5 },   // more colourful by this
      uCoreFocus: { value: 1.5 },
      // how wide (in s) the core's dark and the halftone's light are blended at the middle of the border, rather
      // than meeting at one hard line (0: the hard line, as it was)
      uBandBlend: { value: 0.2 },
      // the core shadow's hue: from the shadow's hue this far (0..1) towards the halftone's, the shorter way
      // round the wheel (greens by way of cyan, white stone and warm colours by way of pink and violet)
      uCorePath: { value: 0.4 },
      // ... except for a surface of little colour of its own (its albedo's chroma below uSunsetBelow: white and
      // grey stone, bark, soil), which goes the warm way, through pink and violet (OKLab hue 0), like a sunset
      uSunsetBelow: { value: 0.07 },
      // translucent leaves: a leaf seen from its face turned away from the sun, with the sun behind it and
      // little leaf between (in the shadow map, at most about uTransDepth metres behind the first sunlit leaf),
      // glows with the light come through: its own colour, turned uTransHue, more colourful, lightness between
      // shadow and lit (uTransLight), a little lighter looking towards the sun (uTransView: brightness only,
      // never whether it glows). uTrans: how readily (0 off).
      uTrans: { value: 1 },
      uTransView: { value: 0.35 },
      uTransDepth: { value: 1.5 },
      uTransHue: { value: -0.35 },
      uTransChroma: { value: 1.8 },
      uTransLight: { value: 0.75 },
      uShadowRange: { value: 1499 },
      uShadowReady: { value: 0 },   // the sun's shadow map has been made
      uShadowSize: { value: 4096 },
      // the highlight family: where the light (with its highlight) passes 1 + uHiTh, near white, tinted by the sun
      uHiTh: { value: 0.3 },
      // the shoulder: colours lighter than uKnee (OKLab lightness) are eased towards white instead of clipped,
      // losing colour as they go, so a strong sun keeps its hues (only its brightest turns white)
      uKnee: { value: 0.82 },
      uHiOn: { value: 1 },
      uSunLab: { value: new THREE.Vector3(1, 0, 0) },
      // the prism palette (OKLab): the one set of colours light makes by itself, kept in harmony — the relic's thin
      // film (uFilmLit / uFilmShade on its two families, uFilmEdge on its border, which turns prismatic), and
      // a touch on highlights (uHiPrism)
      uPrism: { value: [0, 1, 2, 3, 4].map(() => new THREE.Vector3(0.8, 0, 0)) },
      uFilmLit: { value: 0.4 },
      uFilmShade: { value: 0.2 },
      uFilmEdge: { value: 0.8 },
      uFilmChroma: { value: 1 },
      uHiPrism: { value: 0.4 },
      // how far above white highlights (per unit of light over the threshold) and glints are pushed, for the glare
      uGlareHi: { value: 0.6 }, uGlareGlint: { value: 4 },
      // subsurface scattering (see main()): on, how strong, a scale on each kind's distance, the glow's
      // lightness (0 shadow .. 1 lit), its colourfulness (times the lit colour's, at least uSssMinC), its hue
      // turned from the lit colour's (radians), and a least width in pixels
      // realism: 0 two states of light (the painting), 1 the light as much as falls (see main()); uRealSky:
      // how much of the sky's light is in the realistic light
      uReal: { value: 0 }, uRealSky: { value: 1 }, uFormGamma: { value: 1 },
      // the border's colours: how much they are the light's own (0 each surface's, from its colour; 1 the
      // light's, the same on every surface), and the plants' prism border (0..1)
      uBandLight: { value: 0 }, uBorderWarm: { value: new THREE.Vector3(1, 0.03, 0.06) }, uBorderCool: { value: new THREE.Vector3(0.5, 0.03, -0.1) },
      uPlantPrism: { value: 0 }, uPrismWidth: { value: 1 }, uPrismOwnL: { value: 0 }, uOtherPrism: { value: 0 },
      uSssOn: { value: 1 }, uSssAmt: { value: 1 }, uSssScale: { value: 1 }, uSssLight: { value: 0.45 },
      uSssChroma: { value: 1.8 }, uSssMinC: { value: 0.07 }, uSssHue: { value: -0.44 }, uSssMinPx: { value: 0 },
      uReflect: { value: 0.12 },     // reflected light: the shadow (away from the border) lifted by this
      // within each family a range of its own: the lit side a little darker where it turns from the sun, the
      // shadow lighter facing the sky and darker facing down
      uLitRange: { value: 0.12 },
      uShadeRange: { value: 0.25 },
      // the humid air between the eye and what it sees, marched through the sun's shadow map: where the sun
      // reaches it, it glows (uHazeSun: light shafts under gaps in the canopy, brightest looking towards the
      // sun); everywhere it carries the sky's cool light (uHazeShade). Denser low down (uHazeHeight); beyond the
      // shadow map's reach (uHazeFar) taken as lit by uHazeOutside. It hides at most uHazeMax of what lies behind;
      // uHazeBands > 0 steps the shafts into that many tones, like the rest of the picture.
      tShadow: { value: null },
      uShadowMatrix: { value: new THREE.Matrix4() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uHazeOn: { value: 1 },
      uHazeSteps: { value: 24 },
      uHazeDensity: { value: 0.008 },
      uHazeStart: { value: 4 },
      uHazeBase: { value: 0 },
      uHazeHeight: { value: 35 },
      uHazeFar: { value: 120 },
      uHazeOutside: { value: 0.35 },
      uHazeForward: { value: 0.6 },
      uHazeMax: { value: 0.6 },
      uHazeBands: { value: 0 },
      // (the sky's air: as far as the plain's horizon, so just over it the sky is as veiled as the land just under)
      uHazeSkyDist: { value: 30000 },
      // far off the land goes into the sky: from uFarFade.x metres it fades towards the horizon's own colour, all of
      // it gone by uFarFade.y (before the air is laid over it, so it meets the sky at the horizon without a seam)
      uFarFade: { value: new THREE.Vector2(1500, 12000) },
      // the mosaic room's night: stars and moon in the sky, the floor a lake mirroring them; uClock: seconds
      uStars: { value: 0 }, uLake: { value: 0 }, uClock: { value: 0 }, uSkyRound: { value: 0 },
      // the sun's (or at night the moon's) disc in the sky, where the light comes from (timeOfDay.js): how strong,
      // its colour, the cosine of its angular radius, and the glow round it (low over the horizon, a wide one)
      // how much light falls on the things, over all (timeOfDay.js: at night far less; the painting's lit side
      // keeps its lightness whatever the sun's strength, so the night is darkened here, before the air)
      uExposure: { value: 1 },
      // the fires' and torches' own light (fires.js): each a point (xyz) and how far its
      // light reaches (w, metres), how strong; uFireOn how much they burn (0 by day); its colour
      // (uFireB: the ground it stands on: below that, nothing is lit, the terrace's or the lane's edge between)
      uFireP: { value: Array.from({ length: 24 }, () => new THREE.Vector4()) }, uFireK: { value: new Array(24).fill(0) },
      uFireB: { value: new Array(24).fill(0) },
      // (how far each one's light gets in each of 32 directions round it, at its own height, before a wall stops
      // it: a row for each, worked out once by rays at the start, main.js)
      tFireReach: { value: null },
      uFireN: { value: 0 }, uFireOn: { value: 0 }, uFireRange: { value: 1 }, uFireColor: { value: new THREE.Vector3(1.0, 0.5, 0.18) },
      uDisc: { value: 0 }, uDiscColor: { value: new THREE.Vector3(1, 1, 1) }, uDiscCos: { value: 0.9998 }, uDiscGlow: { value: 0 },
      // the air drawn at half size first (tHaze, uHazeLowSize texels; uHazeLow 1) and spread back to full size
      tHaze: { value: null }, uHazeLowSize: { value: new THREE.Vector2(1, 1) }, uHazeLow: { value: 0 },
      uHazeSun: { value: new THREE.Vector3(1, 0.6, 0.2) },
      uHazeShade: { value: new THREE.Vector3(0.2, 0.3, 0.5) },
      // the band: brightness along the gradient (follow, gamma), its stops (sorted by position; base 0 = turn
      // from the shadow colour's hue, 1 = from the lit colour's, 2 = this hue), and a hue for grey surfaces
      uFollow: { value: 1 },
      uGamma: { value: 1 },
      uChroma: { value: 1 },
      uFallback: { value: 0 },
      uStopOn: { value: [1, 0, 0] },
      uStopAt: { value: [0.42, 0.6, 0.8] },
      uStopBase: { value: [0, 0, 0] },
      uStopHue: { value: [Math.PI, 0, 0] },
      uStopC: { value: [0.12, 0.1, 0.1] },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform sampler2D tLight, tAlbedo, tSun;
      uniform float uShadowSoft, uShadowBand;
      uniform vec3 uSunWorld;
      ${LENS_LIGHT}
      uniform vec2 uTexel;
      uniform float uTh, uWD, uWL, uMode, uPxD, uPxL, uTol, uSil, uJit, uDebug, uBandMax, uJitMax, uPixelAngle;
      uniform vec3 uSkyTop, uSkyHorizon, uSun, uShade;
      uniform vec2 uShadeDir;
      uniform mat4 uInvProj, uCamWorld;
      uniform float uSkyCurve, uLitSat, uShadeSat, uShadePull, uShadeMinC, uFollow, uGamma, uChroma, uFallback;
      uniform float uBandOn;
      uniform float uModel, uPeakChroma, uPeakMin, uPeakHue, uPeakDark, uPeakFocus, uPeakMaxL, uCoreDark, uCoreChroma, uCoreFocus, uBandBlend;
      uniform float uReflect, uLitRange, uShadeRange, uCorePath, uSunsetBelow;
      uniform float uTrans, uTransView, uTransDepth, uTransHue, uTransChroma, uTransLight, uShadowRange, uShadowReady, uShadowSize;
      uniform float uKnee;
      vec3 shoulder(vec3 L) {
        if (L.x <= uKnee) return L;
        float x = (L.x - uKnee) / max(1.0 - uKnee, 1e-3), y = 1.0 - exp(-x);
        return vec3(uKnee + (0.985 - uKnee) * y, L.yz * mix(1.0, 0.3, y));
      }
      uniform float uReal, uRealSky, uBandLight, uPlantPrism, uOtherPrism, uFormGamma, uPrismWidth, uPrismOwnL;
      uniform vec3 uBorderWarm, uBorderCool;
      uniform float uSssOn, uSssAmt, uSssScale, uSssLight, uSssChroma, uSssMinC, uSssHue, uSssMinPx;
      uniform float uHiTh, uHiOn, uFilmLit, uFilmShade, uFilmEdge, uFilmChroma, uHiPrism, uGlareHi, uGlareGlint;
      uniform vec3 uPrism[5];
      // the prism palette at t (0..1), in OKLab
      vec3 prism(float t) {
        t = clamp(t, 0.0, 1.0) * 4.0;
        int i = int(min(floor(t), 3.0));
        return mix(uPrism[i], uPrism[i + 1], t - float(i));
      }
      uniform vec3 uSunLab;
      uniform sampler2D tShadow;
      uniform mat4 uShadowMatrix;
      uniform vec3 uSunDir, uHazeSun, uHazeShade;
      uniform int uHazeSteps;
      uniform float uHazeOn, uHazeDensity, uHazeStart, uHazeBase, uHazeHeight, uHazeFar, uHazeOutside, uHazeForward;
      uniform float uHazeMax, uHazeBands, uHazeSkyDist, uHazeLow;
      uniform vec2 uFarFade;
      uniform float uStars, uLake, uClock, uSkyRound;
      uniform float uDisc, uDiscCos, uDiscGlow, uExposure;
      uniform vec4 uFireP[24];
      uniform float uFireK[24], uFireB[24];
      uniform float uFireN, uFireOn, uFireRange;
      uniform sampler2D tFireReach;
      uniform vec3 uFireColor;
      uniform vec3 uDiscColor;
      uniform sampler2D tHaze;
      uniform vec2 uHazeLowSize;
      #include <packing>
      uniform float uStopOn[3], uStopAt[3], uStopBase[3], uStopHue[3], uStopC[3];
      varying vec2 vUv;
      #define STEPS 8
      ${OKLAB}

      // the light as the border sees it: the sunlight, wobbled by the brush noise
      // the light as the lit / shadow decision sees it: the sun's angle on a curve (uFormGamma < 1 lifts the
      // light that only grazes a surface, so a wall raked by a high sun is still in the light family, at its
      // halftone, not counted as shadow; 1: the true angle). Cast shadows are unchanged (0 stays 0).
      float formL(float r) { return pow(clamp(r, 0.0, 1.0), uFormGamma); }
      float lightOf(vec4 s) { return formL(s.r) + uJit * (fract(s.b) - 0.5); }

      float lumAt(float s, vec3 S, vec3 Lt) { return mix(S.x, Lt.x, pow(clamp(s, 0.0, 1.0), uGamma)); }

      vec3 stopColor(int i, vec3 S, vec3 Lt) {
        float base = uStopBase[i], h = uStopHue[i];
        if (base < 1.5) {
          vec2 ref = (base < 0.5 ? S.yz : Lt.yz) + 0.012 * vec2(cos(uFallback), sin(uFallback));
          h += atan(ref.y, ref.x);
        }
        float C = uStopC[i] * uChroma;
        return vec3(lumAt(uStopAt[i], S, Lt), C * cos(h), C * sin(h));
      }

      // the band as a painter builds the form (s: 0 deep in shadow, 0.5 the border, 1 fully lit), in OKLab.
      // On the lit side the halftone: the surface's own colour at its most saturated (its hue the lit colour's,
      // turned by uPeakHue), a little darker, fading into the lit colour. On the dark side the core shadow:
      // darker and more colourful than the shadow, fading into it.
      // A prism border on a coloured surface (a leaf, the forest floor): the palette swept once across the middle
      // uPrismWidth of the border band, cool side to warm. Its hue reached round the colour wheel the shorter way and
      // its colourfulness between the two, rather than the two colours averaged (green and pink averaged are
      // grey: the muddy border it had); its lightness the surface's, or the palette's own by uPrismOwnL (the
      // palette is light: on a dark leaf it then glows as it does on white stone)
      vec3 prismEdge(vec3 lab, float s, float amt) {
        float u = (s - 0.5) / max(0.5 * uPrismWidth, 1e-3);
        float w = amt * (1.0 - smoothstep(0.7, 1.0, abs(u)));
        if (w <= 0.0) return lab;
        vec3 P = prism(clamp(0.5 - 0.5 * u, 0.0, 1.0));
        P.yz *= uFilmChroma;
        float c0 = length(lab.yz), c1 = length(P.yz);
        float h0 = atan(lab.z, lab.y), h1 = atan(P.z, P.y);
        float dh = mod(h1 - h0 + 3.14159265, 6.2831853) - 3.14159265;
        float h = c0 > 1e-4 ? h0 + dh * w : h1, C = mix(c0, c1, w);
        return vec3(mix(lab.x, P.x, w * uPrismOwnL), C * cos(h), C * sin(h));
      }
      vec3 anatomy(float s, vec3 S, vec3 Lt, float ownChroma) {
        float CL = length(Lt.yz);
        vec2 dl = CL > 1e-4 ? Lt.yz / CL : vec2(cos(uFallback), sin(uFallback));
        float hP = atan(dl.y, dl.x) + uPeakHue;     // the halftone's hue
        // the light's own colours (uBandLight of them, for every surface alike): the halftone's hue that of
        // uBorderWarm, the core's that of uBorderCool (both chosen in the tuning); with them the border on a leaf
        // and on white stone share one key
        float hL = atan(uBorderWarm.z, uBorderWarm.y) + uPeakHue;
        // the lit side: the halftone, strongest at the middle, easing into the lit colour
        float fp = pow(clamp(1.0 - (s - 0.5) * 2.0, 0.0, 1.0), uPeakFocus), Cp = max(CL * uPeakChroma, uPeakMin);
        vec2 own = Cp * vec2(cos(hP), sin(hP)), light = Cp * vec2(cos(hL), sin(hL));
        vec3 P = vec3(min(Lt.x * (1.0 - uPeakDark), uPeakMaxL), mix(own, light, uBandLight));
        vec3 lit = mix(Lt, P, fp);
        // (where the border is all lit side, the core is not worked out)
        float blend = smoothstep(0.5 - uBandBlend, 0.5 + uBandBlend, s);
        if (blend >= 1.0) return lit;
        // the dark side: the core, strongest at the middle, easing into the shadow colour
        float f = pow(clamp(s * 2.0, 0.0, 1.0), uCoreFocus);
        float C = length(S.yz);
        vec2 ds = C > 1e-4 ? S.yz / C : uShadeDir;
        float hS = atan(ds.y, ds.x), dh = mod(hP - hS + 3.14159265, 6.2831853) - 3.14159265;
        if (ownChroma < uSunsetBelow) {
          // the way that passes hue 0 (pink): is it within the shorter way? if not, go the longer way
          float toPink = mod(-hS * sign(dh) + 6.2831853, 6.2831853);
          if (toPink > abs(dh)) dh -= sign(dh) * 6.2831853;
        }
        float h = hS + dh * uCorePath, Ck = C * (1.0 + uCoreChroma);
        float hK = atan(uBorderCool.z, uBorderCool.y);
        vec2 coreAb = mix(Ck * vec2(cos(h), sin(h)), max(Ck, uShadeMinC * (1.0 + uCoreChroma)) * vec2(cos(hK), sin(hK)), uBandLight);
        vec3 K = vec3(S.x * (1.0 - uCoreDark), coreAb);
        // the two met at the middle in one hard line (the core's dark against the halftone's light: a line darker and
        // heavier than the border itself); now the one fades into the other across uBandBlend either side of it
        //
        return mix(mix(S, K, f), lit, blend);
      }

      // the band at s (0 = this surface's shadow colour, 1 = its lit colour), in OKLab
      vec3 band(float s, vec3 S, vec3 Lt) {
        vec3 prev = S, res = Lt;
        float pa = 0.0;
        bool found = false;
        for (int i = 0; i < 3; i++) {
          if (uStopOn[i] < 0.5) continue;
          float a = uStopAt[i];
          vec3 c = stopColor(i, S, Lt);
          if (!found && s <= a) { res = mix(prev, c, clamp((s - pa) / max(a - pa, 1e-4), 0.0, 1.0)); found = true; }
          prev = c;
          pa = a;
        }
        if (!found) res = mix(prev, Lt, clamp((s - pa) / max(1.0 - pa, 1e-4), 0.0, 1.0));
        if (uFollow > 0.5) res.x = lumAt(s, S, Lt);
        return res;
      }

      // this pixel's ray in the world; and how far along it a depth (along the camera's axis) lies
      vec3 viewRay(out float perDepth) {
        vec4 v = uInvProj * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
        vec3 vd = normalize(v.xyz / v.w);
        perDepth = 1.0 / max(-vd.z, 1e-3);
        return normalize((uCamWorld * vec4(vd, 0.0)).xyz);
      }

      // the night sky (the mosaic room's 星空湖面, uStars > 0): stars, one at most in each small patch of the sky
      // (by direction), each its own place, size and brightness, twinkling; and the moon, where the sun would be,
      // a small bright disc in a soft halo. uSkyRound 1 (the room without a floor): the sky all round, below as
      // above, stars everywhere, darkening the same way up and down from the horizon
      float skyHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      vec3 starsAt(vec3 dir) {
        if (uStars <= 0.0 || dir.y < -0.02 - 2.0 * uSkyRound) return vec3(0.0);
        vec2 sph = vec2(atan(dir.z, dir.x) * cos(asin(clamp(dir.y, -1.0, 1.0))), asin(clamp(dir.y, -1.0, 1.0))) * 120.0;
        vec2 cell = floor(sph), f = fract(sph) - 0.5;
        float h = skyHash(cell);
        vec3 col = vec3(0.0);
        if (h < 0.35 * uStars) {
          vec2 at = (vec2(skyHash(cell + 1.3), skyHash(cell + 2.9)) - 0.5) * 0.6;
          float size = 0.1 + 0.18 * skyHash(cell + 4.1), bright = 0.35 + 2.2 * pow(skyHash(cell + 6.7), 5.0);
          float tw = 0.7 + 0.3 * sin(uClock * (1.5 + 3.0 * skyHash(cell + 8.3)) + h * 40.0);
          col = mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.92, 0.8), skyHash(cell + 9.9)) * bright * tw
            * smoothstep(size, 0.0, length(f - at)) * mix(smoothstep(-0.02, 0.12, dir.y), 1.0, uSkyRound);
        }
        return col * uStars;
      }
      // the sun's or the moon's disc, a halo close round it and a wide glow (none below the horizon's line)
      vec3 discAt(vec3 dir) {
        if (uDisc <= 0.0) return vec3(0.0);
        float m = dot(dir, uSunDir), w = (1.0 - uDiscCos) * 0.25;
        float disc = smoothstep(uDiscCos - w, uDiscCos + w, m);
        float halo = 0.12 * pow(max(m, 0.0), 300.0) + uDiscGlow * pow(max(m, 0.0), 12.0);
        return uDiscColor * (disc * 1.6 + halo) * uDisc * smoothstep(-0.01, 0.01, dir.y);
      }
      vec3 skyColorDir(vec3 dir) {
        return mix(uSkyHorizon, uSkyTop, pow(max(mix(dir.y, abs(dir.y), uSkyRound), 0.0), uSkyCurve)) + starsAt(dir) + discAt(dir);
      }
      vec3 skyColor() {
        float k;
        return skyColorDir(viewRay(k));
      }

      // is the sun on this point of the air? (outside the shadow map: uHazeOutside)
      // how much sun comes through to a point behind sunlit leaves: by how deep behind the first sunlit
      // surface it lies, towards the sun (0 outside the shadow map)
      // (blended between the four nearest texels of the shadow map, so its edge is as smooth as the shadows')
      float throughTexel(vec2 uv, float z) {
        float behind = (z - unpackRGBAToDepth(texture2D(tShadow, uv))) * uShadowRange - 0.05;
        return exp(-max(behind, 0.0) / uTransDepth);
      }
      float throughAt(vec3 wp) {
        vec4 p = uShadowMatrix * vec4(wp, 1.0);
        if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 0.0;
        vec2 tc = p.xy * uShadowSize - 0.5, f = fract(tc), t = 1.0 / vec2(uShadowSize);
        vec2 uv = (floor(tc) + 0.5) * t;
        return mix(mix(throughTexel(uv, p.z), throughTexel(uv + vec2(t.x, 0.0), p.z), f.x),
                   mix(throughTexel(uv + vec2(0.0, t.y), p.z), throughTexel(uv + t, p.z), f.x), f.y);
      }

      float sunAt(vec3 wp) {
        vec4 p = uShadowMatrix * vec4(wp, 1.0);
        if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return uHazeOutside;
        return step(p.z, unpackRGBAToDepth(texture2D(tShadow, p.xy)));
      }

      // the air in front of whatever lies at distance t along this pixel's ray: how much of it the air hides (a)
      // and the air's own light over it (rgb, already times a); the colour seen is then col * (1 - a) + rgb
      vec4 hazeAir(float t) {
        if (uHazeOn < 0.5 || t <= uHazeStart) return vec4(0.0);
        float k;
        vec3 rd = viewRay(k), ro = uCamWorld[3].xyz;
        float tm = min(t, uHazeFar), ds = (tm - uHazeStart) / float(uHazeSteps);
        float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        float T = 1.0, lit = 0.0;
        for (int i = 0; i < 64; i++) {
          if (i >= uHazeSteps) break;
          vec3 wp = ro + rd * (uHazeStart + (float(i) + jitter) * ds);
          float a = uHazeDensity * exp(-max(wp.y - uHazeBase, 0.0) / uHazeHeight) * ds;
          float w = T * (1.0 - exp(-a)), sun = sunAt(wp);
          lit += w * sun;
          T *= exp(-a);
        }
        if (t > tm) {
          // (beyond the shadow map, the air's depth along the rest of the ray worked out whole: thinning upwards
          // as exp(-height / uHazeHeight), so a ray kilometres long, rising or level, is right)
          float y0 = ro.y + rd.y * tm - uHazeBase, y1 = ro.y + rd.y * t - uHazeBase, a;
          if (abs(rd.y) > 1e-4) a = uHazeDensity * uHazeHeight / rd.y * (exp(-max(y0, 0.0) / uHazeHeight) - exp(-max(y1, 0.0) / uHazeHeight));
          else a = uHazeDensity * exp(-max(y0, 0.0) / uHazeHeight) * (t - tm);
          a = max(a, 0.0);
          lit += T * (1.0 - exp(-a)) * uHazeOutside;
          T *= exp(-a);
        }
        float total = 1.0 - T;
        float frac = total > 1e-5 ? lit / total : 0.0;
        if (uHazeBands > 0.5) frac = floor(frac * uHazeBands + 0.5) / uHazeBands;
        float phase = 1.0 + uHazeForward * 4.0 * pow(max(dot(rd, uSunDir), 0.0), 6.0);
        float keep = min(1.0, uHazeMax / max(total, 1e-4));    // it hides at most uHazeMax
        return vec4(total * keep * (uHazeShade + uHazeSun * frac * phase), total * keep);
      }
      vec3 haze(vec3 col, float t) { vec4 a = hazeAir(t); return col * (1.0 - a.a) + a.rgb; }
      // the same, from the half-size picture of the air (main.js draws it first, HAZE_PASS below): the four
      // texels round this pixel, each counted by how near (bilinear) and how alike in distance it is, so the
      // air does not bleed across an edge between something near and something far
      vec3 hazeUp(vec3 col, float d, float t) {
        if (uHazeLow < 0.5) return haze(col, t);
        vec2 p = vUv * uHazeLowSize - 0.5, i0 = floor(p), f = p - i0;
        vec4 sum = vec4(0.0);
        float wsum = 0.0;
        for (int j = 0; j <= 1; j++) for (int i = 0; i <= 1; i++) {
          vec2 o = vec2(float(i), float(j)), uvk = (i0 + o + 0.5) / uHazeLowSize;
          float dk = texture2D(tLight, uvk).g;
          float w = (i == 0 ? 1.0 - f.x : f.x) * (j == 0 ? 1.0 - f.y : f.y) / (0.02 + abs(dk - d) / max(d, 1e-3));
          sum += w * texture2D(tHaze, uvk);
          wsum += w;
        }
        vec4 a = sum / max(wsum, 1e-6);
        return col * (1.0 - a.a) + a.rgb;
      }

      // a point of the picture in the world, from where it is on the screen and its depth (along the camera's axis)
      vec3 worldAt(vec2 uv, float dep) {
        vec4 v = uInvProj * vec4(uv * 2.0 - 1.0, 1.0, 1.0);
        vec3 dir = normalize(v.xyz / v.w);
        return (uCamWorld * vec4(dir * (dep / max(-dir.z, 1e-3)), 1.0)).xyz;
      }
      // the light of the fires and torches falling on this point (wp, facing n): each as far as it reaches, fading
      // to nothing there, more on what faces it, flickering; none past the walls round it
      vec3 fireLight(vec3 wp, vec3 n) {
        vec3 sum = vec3(0.0);
        for (int i = 0; i < 24; i++) {
          if (float(i) >= uFireN) break;
          vec3 L = uFireP[i].xyz - wp;
          float dist = length(L), R = uFireP[i].w * uFireRange;
          if (dist >= R) continue;
          vec3 l = L / max(dist, 1e-3);
          // (nothing lit much below the ground it stands on: a fire on a roof does not light the lane under it)
          float below = smoothstep(-0.9, -0.25, wp.y - uFireB[i]);
          if (below <= 0.0) continue;
          // (how much it faces the fire counts only a little: the facing comes from the depths, each flat face its own,
          // and a wall's rounded corner showed in the firelight as stripes; the walls round it stop the light anyway.
          // Only what is clearly turned away from it is left dark)
          float dn = dot(n, l), facing = smoothstep(-0.45, 0.05, dn) * (0.82 + 0.18 * dn);
          if (facing <= 0.0) continue;
          float fall = 1.0 - dist / R;
          fall = fall * fall * (1.0 + 2.0 / (1.0 + dist * dist));
          float fl = 0.85 + 0.1 * sin(uClock * 9.0 + float(i) * 3.7) + 0.05 * sin(uClock * 17.0 + float(i));
          // (a wall between? how far its light gets this way round it, at its own height, from the rays cast at the
          // start; beyond that, none, fading over a little way)
          vec2 hz = -L.xz;
          float fk = (atan(hz.y, hz.x) / 6.2831853 + 1.0) * 32.0;
          int k0 = int(floor(fk)) % 32;
          float reach = mix(texelFetch(tFireReach, ivec2(k0, i), 0).r, texelFetch(tFireReach, ivec2((k0 + 1) % 32, i), 0).r, fract(fk));
          float lit = 1.0 - smoothstep(reach - 0.05, reach + 0.3, length(hz));
          if (lit <= 0.0) continue;
          sum += uFireColor * uFireK[i] * fall * facing * fl * lit * below;
        }
        return sum * uFireOn;
      }

      #ifdef HAZE_PASS
      // the air alone, at half size
      void main() {
        float d = texture2D(tLight, vUv).g, pd;
        viewRay(pd);
        gl_FragColor = hazeAir(d > ${SKY_DEPTH * 0.8}.0 ? uHazeSkyDist : d * pd);
      }
      #else
      void main() {
        vec4 c = texture2D(tLight, vUv);
        vec4 a4 = texture2D(tAlbedo, vUv);
        vec3 alb = a4.rgb;
        bool relic = a4.a < 0.0, plant = a4.a >= 1.0;
        float film = relic ? (-a4.a - 0.02) / 0.96 : 0.0, aa = plant ? a4.a - 1.0 : a4.a;
        bool leaf = aa >= 0.5;
        float up = relic ? 0.55 : (aa - (leaf ? 0.5 : 0.0)) / 0.49;
        float d = c.g;
        bool sky = d > ${SKY_DEPTH * 0.8}.0;
        if (uDebug == 2.0) { gl_FragColor = vec4(vec3(sky ? 1.0 : c.r), 1.0); return; }
        if (uDebug == 4.0) { gl_FragColor = vec4(vec3(1.0 - log2(1.0 + d) / 11.0), 1.0); return; }
        if (sky) {
          gl_FragColor = vec4(linToScreen(hazeUp(screenToLin(skyColor()), d, uHazeSkyDist)), 1.0);
          return;
        }
        if (uDebug == 5.0) { gl_FragColor = vec4(labToScreen(linToLab(alb)), 1.0); return; }
        // how fast the light changes across this surface, per metre (from the neighbouring pixels on it)
        float pdg;
        viewRay(pdg);
        float mpp = max(d * pdg * uPixelAngle, 1e-4), tol = d * uTol;
        vec4 nl = texture2D(tLight, vUv - vec2(uTexel.x, 0.0)), nr = texture2D(tLight, vUv + vec2(uTexel.x, 0.0));
        vec4 nd = texture2D(tLight, vUv - vec2(0.0, uTexel.y)), nu = texture2D(tLight, vUv + vec2(0.0, uTexel.y));
        float lc = formL(c.r);
        float gx = (abs(nr.g - d) < tol ? formL(nr.r) : lc) - (abs(nl.g - d) < tol ? formL(nl.r) : lc);
        float gy = (abs(nu.g - d) < tol ? formL(nu.r) : lc) - (abs(nd.g - d) < tol ? formL(nd.r) : lc);
        float perMetre = length(vec2(gx, gy)) * 0.5 / mpp;
        // the band's widths and the brush's wobble, held to their sizes on the surface
        float wD = min(uWD, perMetre * uBandMax), wL = min(uWL, perMetre * uBandMax);

        // the brush noise; how far light scatters inside (m) (the water's mark, 64 and up, is not: water.js)
        float nb = fract(c.b), scat = c.b >= 42.0 ? 0.0 : floor(c.b) * 0.0025;
        float e = lc + min(uJit, perMetre * uJitMax) * (nb - 0.5);
        bool lit = e >= uTh;
        float s;   // where on the band: 0 deep in shadow, 0.5 the border itself, 1 fully in the light

        if (uMode < 0.5) {
          // in light: how far the light is from the threshold, against the band's width on each side
          s = lit ? 0.5 + 0.5 * clamp((e - uTh) / max(wL, 1e-5), 0.0, 1.0)
                  : 0.5 - 0.5 * clamp((uTh - e) / max(wD, 1e-5), 0.0, 1.0);
          // a band only where the light truly crosses: looked for where, carried on at the rate it changes here,
          // it would reach the threshold (downhill on the lit side, uphill on the dark), a little beyond; if the
          // same surface there is still on this side, the change was a rounded edge between two faces both in the
          // sun (or both in shade), not a terminator, and gets no band (it drew a halftone line, orange on white,
          // along every rounded edge of a wall the sun only grazes)
          // (where that look leaves the surface, past its edge onto the sky or something else, it looks again
          // nearer, short of the crossing: if the light there has not gone on towards the threshold (a rim, a
          // level), or that too is off the surface (the crossing is not on what one sees), no band either, as an
          // outline gets none: looking past a wall's top edge, it drew a dashed line)
          float gl = length(vec2(gx, gy));
          if (s > 0.002 && s < 0.998 && gl > 1e-5) {
            vec2 dir = vec2(gx, gy) / gl * (lit ? -1.0 : 1.0);
            float dpx = abs(e - uTh) / max(perMetre, 1e-5) / mpp;
            float px = min(dpx * 1.25 + 1.5, 64.0), px0 = clamp(dpx * 0.9, 1.0, 64.0);
            vec4 far = texture2D(tLight, vUv + dir * px * uTexel);
            bool none;
            if (abs(far.g - d) < d * uTol * (1.0 + px * 0.5)) none = (formL(far.r) >= uTh) == lit;
            else {
              vec4 closer = texture2D(tLight, vUv + dir * px0 * uTexel);
              float en = formL(closer.r), toward = lit ? e - en : en - e;
              none = abs(closer.g - d) >= d * uTol * (1.0 + px0 * 0.5) || toward < 0.25 * abs(e - uTh);
            }
            if (none) s = lit ? 1.0 : 0.0;
          }
          // where one thing passes in front of another the light jumps; that edge is an outline, not a
          // terminator, so it gets no band
          if (uSil > 0.0) {
            float dl = texture2D(tLight, vUv - vec2(uTexel.x, 0.0)).g, dr = texture2D(tLight, vUv + vec2(uTexel.x, 0.0)).g;
            float dd = texture2D(tLight, vUv - vec2(0.0, uTexel.y)).g, du = texture2D(tLight, vUv + vec2(0.0, uTexel.y)).g;
            float jump = max(max(abs(dl - d), abs(dr - d)), max(abs(dd - d), abs(du - d))) / d;
            s = mix(s, lit ? 1.0 : 0.0, uSil * smoothstep(uTol, uTol * 2.0, jump));
          }
        } else {
          // on the screen: the nearest pixel on the other side, along eight directions, on the same surface
          float R = lit ? uPxL : uPxD;
          float best = R;
          for (int k = 0; k < 8; k++) {
            float a = float(k) * 0.78539816;
            vec2 dir = vec2(cos(a), sin(a));
            float prevE = e, prevR = 0.0;
            for (int i = 1; i <= STEPS; i++) {
              float r = R * float(i) / float(STEPS);
              vec4 sm = texture2D(tLight, vUv + dir * r * uTexel);
              if (abs(sm.g - d) > d * uTol * (1.0 + r * 0.5)) break;
              float es = lightOf(sm);
              if ((es >= uTh) != lit) {
                float f = clamp((prevE - uTh) / (prevE - es), 0.0, 1.0);
                best = min(best, mix(prevR, r, f));
                break;
              }
              prevE = es;
              prevR = r;
            }
          }
          float t = clamp(best / max(R, 1e-3), 0.0, 1.0);
          s = lit ? 0.5 + 0.5 * t : 0.5 - 0.5 * t;
        }

        // realism (uReal 0..1): the light not two states but as much as truly falls there (the sun's angle to
        // the surface times its shadow, which is soft at the edges). The colours keep the painted relations
        // along the way: the same walk from the shadow colour through the core and the halftone to the lit
        // colour, only spread over the whole turn of the form instead of a thin band
        float x = clamp(c.r, 0.0, 1.0);
        // (its border where the sun truly stops reaching, not at the painting's threshold: a face the sun only
        // grazes is in the lit family, at its most saturated halftone)
        float sC = x >= 0.03 ? 0.5 + 0.5 * sqrt((x - 0.03) / 0.97) : 0.5 * x / 0.03;   // (the halftone kept to the grazing part)
        if (uDebug != 1.0) s = mix(s, sC, uReal);

        // a cast shadow's edge, soft (uShadowSoft): where the form itself turns to the sun (its light with no
        // shadow over the threshold), the shadow's own share of it (its soft edge, from the shadow map's filter)
        // carries it from the shadow family to the lit one, fading over the penumbra instead of cut at the
        // threshold; the turn of the form keeps its crisp border. castK: how much this pixel is in such an edge
        float castK = 0.0;
        if (uShadowSoft > 0.0 && uDebug != 1.0) {
          float un = texture2D(tSun, vUv).r, lu = formL(un);
          if (lu >= uTh && un > 0.02 && c.r <= 1.0) {
            float f = clamp(c.r / un, 0.0, 1.0);
            // (where it would be on the band with no shadow over it, worked out as the painting works it out
            // above, only from the unshadowed light: its band as narrow as that light changes across the surface,
            // so a flat wall in the sun is fully lit, not all halftone; the brush's wobble; realism)
            float ul = texture2D(tSun, vUv - vec2(uTexel.x, 0.0)).r, ur = texture2D(tSun, vUv + vec2(uTexel.x, 0.0)).r;
            float ud = texture2D(tSun, vUv - vec2(0.0, uTexel.y)).r, uu = texture2D(tSun, vUv + vec2(0.0, uTexel.y)).r;
            float ugx = (abs(nr.g - d) < tol ? formL(ur) : lu) - (abs(nl.g - d) < tol ? formL(ul) : lu);
            float ugy = (abs(nu.g - d) < tol ? formL(uu) : lu) - (abs(nd.g - d) < tol ? formL(ud) : lu);
            float uPer = length(vec2(ugx, ugy)) * 0.5 / mpp;
            float eu = lu + min(uJit, uPer * uJitMax) * (nb - 0.5);
            float s1 = 0.5 + 0.5 * clamp((eu - uTh) / max(min(uWL, uPer * uBandMax), 1e-5), 0.0, 1.0);
            float xu = clamp(un, 0.0, 1.0);
            s1 = mix(s1, xu >= 0.03 ? 0.5 + 0.5 * sqrt((xu - 0.03) / 0.97) : 0.5 * xu / 0.03, uReal);
            float sf = s1 * smoothstep(0.0, 1.0, f);
            castK = uShadowSoft * (1.0 - smoothstep(0.92, 0.995, f));
            // (only as much as a shadow is over it: in the full sun the painting's own place on the band stands,
            // with its outlines and edges as it draws them; replaced there, a lit wall's edges were drawn as band)
            s = mix(s, sf, castK);
            lit = s >= 0.5;
          }
        }

        // this surface's two colours: its own colour under the shadow light and under the sun
        vec3 S = linToLab(alb * uShade), Lt = linToLab(alb * uSun);
        S.yz *= uShadeSat;
        Lt.yz *= uLitSat;
        S.yz = mix(S.yz, uShadeDir * max(length(S.yz), uShadeMinC), uShadePull);

        // each family's own compressed range: the lit side a little darker as it turns from the sun; the shadow
        // lighter facing the sky, darker facing down, and lifted by reflected light (the core keeps dark)
        float tl = clamp((lc - uTh) / max(1.0 - uTh, 1e-3), 0.0, 1.0);
        Lt.x *= 1.0 - uLitRange * (1.0 - sqrt(tl));
        S.x *= 1.0 + uShadeRange * (up - 0.55) * 2.0 + uModel * uReflect;

        // chamfers and edges get no band: there the light steps from one flat face's to the next within a pixel,
        // where a shadow's soft edge or a form turning is a ramp over many. Its change over 1 pixel against over
        // 3: 1 for a ramp, 3 for a step. (A band drawn on every bevel read as an outline round every block)
        float stepK;
        {
          vec2 t3 = uTexel * 3.0;
          float l3 = formL(texture2D(tLight, vUv + vec2(t3.x, 0.0)).r) - formL(texture2D(tLight, vUv - vec2(t3.x, 0.0)).r);
          float d3 = formL(texture2D(tLight, vUv + vec2(0.0, t3.y)).r) - formL(texture2D(tLight, vUv - vec2(0.0, t3.y)).r);
          float stepness = length(vec2(gx, gy)) * 3.0 / max(length(vec2(l3, d3)), 1e-4);
          stepK = smoothstep(1.6, 2.4, stepness);
        }
        s = mix(s, lit ? 1.0 : 0.0, stepK);

        if (uDebug == 1.0) s = lit ? 1.0 : 0.0;
        bool inBand = s > 0.002 && s < 0.998;
        // (the band's colours off: from shadow to light a plain blend, so one sees what they add)
        vec3 lab = s <= 0.002 ? S : s >= 0.998 ? Lt : uBandOn < 0.5 ? mix(S, Lt, s)
          : (uModel > 0.5 ? anatomy(s, S, Lt, length(linToLab(alb).yz)) : band(s, S, Lt));
        // (in a soft shadow edge, the band's colours only as much as uShadowBand keeps: else a plain blend)
        if (castK > 0.0 && inBand) lab = mix(lab, mix(S, Lt, s), castK * (1.0 - uShadowBand));
        // ...and with realism, the lightness of the light truly there: the sky's everywhere (a little more
        // facing up), the sun's as much as reaches; the colour keeps its colourfulness for its lightness
        if (uReal > 0.0 && uDebug != 1.0) {
          float skyK = uRealSky * (1.0 + uShadeRange * (up - 0.55) * 2.0);
          float Lr = linToLab(alb * (uShade * skyK + uSun * x)).x;
          float Ln = mix(lab.x, Lr, uReal);
          lab = vec3(Ln, lab.yz * clamp(Ln / max(lab.x, 1e-3), 0.0, 1.2));
        }
        // subsurface scattering: light that went into the lit side wanders a little way inside and comes out
        // just past the border, in the shadow. So, on the dark side, a band as wide as that (in metres on the
        // surface) glows: lighter than the shadow, its colour deeper and warmer, as the light inside lost
        // its other colours (red at the edge of a shadow on skin, a yellow-green glow at a leaf's). Like the
        // band, it needs the light to change across the surface: where a shadow's edge is sharp, it is narrow.
        // (before the prism borders, so on leaves and the floor the glow takes the prism's colours, keeping its light)
        if (uSssOn > 0.5 && !lit && scat > 0.0) {
          float dm = (uTh - e) / max(perMetre, 1e-4);             // metres from the border into the shadow
          float w = max(scat * uSssScale, uSssMinPx * mpp);
          if (dm < w) {
            float CL = length(Lt.yz);
            vec2 dl = CL > 1e-4 ? Lt.yz / CL : vec2(cos(uFallback), sin(uFallback));
            float h = atan(dl.y, dl.x) + uSssHue, Cg = max(CL * uSssChroma, uSssMinC);
            vec3 G = vec3(mix(S.x, Lt.x, uSssLight), Cg * cos(h), Cg * sin(h));
            lab = mix(lab, G, uSssAmt * (1.0 - smoothstep(w * 0.75, w, dm)));
          }
        }
        // the relic's thin film: its colour turned through the prism palette as the angle it is seen at changes
        // (its lightness kept, so the two families stay as they are), and its border a prismatic edge
        // (with realism the band spans the whole form: the prism border kept to near the border itself)
        float edgeW = mix(1.0, pow(max(1.0 - abs(s - 0.5) * 2.0, 0.0), 2.0), uReal);
        // ... and off chamfers and edges (stepK, above), and soft shadow edges as their band is
        edgeW *= (1.0 - stepK) * (1.0 - castK * (1.0 - uShadowBand));
        if (relic) {
          vec3 P = prism(film);
          float amt = s >= 0.998 ? uFilmLit : s <= 0.002 ? uFilmShade : uFilmEdge * edgeW;
          vec2 ab = inBand ? prism(1.0 - s).yz : P.yz;   // the border: the palette once, cool side to warm
          lab = vec3(lab.x, mix(lab.yz, ab * uFilmChroma, amt));
        }
        // the plants' border a prism edge too (uPlantPrism), and every other surface's (the forest floor, bark,
        // stone that is not the ring's: uOtherPrism); see prismEdge
        if (plant && inBand && uPlantPrism > 0.0) lab = prismEdge(lab, s, uPlantPrism * edgeW);
        if (!plant && !relic && inBand && uOtherPrism > 0.0) lab = prismEdge(lab, s, uOtherPrism * edgeW);
        // a leaf seen from its face away from the sun, with the sun behind it: the light come through
        if (leaf && !lit && uTrans > 0.0 && uShadowReady > 0.5) {
          float pd;
          vec3 rd = viewRay(pd);
          float toward = pow(max(dot(rd, uSunDir), 0.0), 3.0);
          float g = uTrans * throughAt(uCamWorld[3].xyz + rd * d * pd + uSunDir * 0.05);
          if (g > 0.0) {
            float CL = length(Lt.yz);
            vec2 dl = CL > 1e-4 ? Lt.yz / CL : vec2(cos(uFallback), sin(uFallback));
            float h = atan(dl.y, dl.x) + uTransHue, Ct = max(CL * uTransChroma, 0.1);
            vec3 Tc = vec3(mix(S.x, min(Lt.x, 0.95), clamp(uTransLight + uTransView * toward, 0.0, 1.0)), Ct * cos(h), Ct * sin(h));
            lab = mix(lab, Tc, smoothstep(0.42, 0.58, g));     // near-binary, like the rest
          }
        }
        // the highlight family
        if (uHiOn > 0.5 && c.r > 1.0 + uHiTh - 0.015) {
          vec3 H = vec3(max(0.96, Lt.x), uSunLab.yz * 0.5 + Lt.yz * 0.15);
          // a glint: pure white with a touch of the prism, like light split in dew (the broad streak stays white)
          if (c.r > 5.0) H = vec3(0.97, mix(uSunLab.yz * 0.3, prism(fract(nb * 6.0)).yz, uHiPrism));
          lab = mix(lab, H, smoothstep(1.0 + uHiTh - 0.015, 1.0 + uHiTh + 0.015, c.r));   // a hard edge
        }
        lab = shoulder(lab);
        // the sunlight come through a piece of the glass mosaic: the lit side takes the glass's colour, darker as
        // the glass is darker (here, after the lit side's saturation, the relic's film, the highlight and the
        // shoulder, so none washes it out; and it is not pushed above white for the glare, which would bleach it)
        float glassK = 0.0;
        if (uLensOn > 0.5 && s > 0.5) {
          float pdl;
          vec3 rdl = viewRay(pdl);
          vec4 g = lensLight(uCamWorld[3].xyz + rdl * d * pdl);
          if (g.a > 0.07 && g.a < 0.999) {
            vec3 G = linToLab(g.rgb);
            float k = uLensCast * smoothstep(0.5, 0.6, s);
            glassK = k;
            lab = vec3(lab.x * mix(1.0, 0.25 + 0.75 * G.x, k), mix(lab.yz, G.yz, k));   // (as dark as the glass is)
          }
        }
        // the air in front of it
        float perDepth;
        viewRay(perDepth);
        vec3 lin = labToLinFit(lab) * uExposure;
        // the fires' light on it: its own colour, lit warm (its facing from the depths round it)
        if (uFireOn > 0.0 && uFireN > 0.0) {
          // (from the depths two pixels off, not one: one pixel's step is near the depth's own precision, and the
          // facing came out in fine stripes)
          vec3 wp = worldAt(vUv, d);
          vec2 ox = vec2(uTexel.x * 2.0, 0.0), oy = vec2(0.0, uTexel.y * 2.0);
          float dr = texture2D(tLight, vUv + ox).g, dl = texture2D(tLight, vUv - ox).g;
          float du = texture2D(tLight, vUv + oy).g, dd = texture2D(tLight, vUv - oy).g;
          vec3 px = abs(dr - d) < tol * 2.0 ? worldAt(vUv + ox, dr) - wp : wp - worldAt(vUv - ox, dl);
          vec3 py = abs(du - d) < tol * 2.0 ? worldAt(vUv + oy, du) - wp : wp - worldAt(vUv - oy, dd);
          vec3 fn = normalize(cross(px, py));
          if (dot(fn, uCamWorld[3].xyz - wp) < 0.0) fn = -fn;
          // (the depths give each flat triangle's own facing, and on a slope of the ground its triangles showed in
          // the firelight: how much it faces up taken instead from the surface's own smooth normal (the albedo
          // buffer keeps it), only its way round from the depths)
          if (!relic) {
            float ny = clamp(up * 2.0 - 1.0, -1.0, 1.0);
            vec2 h = fn.xz;
            // (and on what mostly faces up, the ground, its way round from the triangles left out too: it was still
            // each triangle's own)
            float side = sqrt(max(1.0 - ny * ny, 0.0)) * (1.0 - smoothstep(0.55, 0.9, ny));
            fn = length(h) > 1e-3 ? normalize(vec3(normalize(h) * side, ny).xzy) : vec3(0.0, sign(ny + 1e-4), 0.0);
          }
          lin += alb * fireLight(wp, fn);
        }
        // far off, into the horizon's colour (uFarFade)
        float farK = smoothstep(uFarFade.x, uFarFade.y, d * perDepth);
        if (farK > 0.0) {
          float pf;
          vec3 rf = viewRay(pf);
          lin = mix(lin, screenToLin(skyColorDir(normalize(vec3(rf.x, max(rf.y, 0.0), rf.z)))), farK);
        }
        vec3 col = linToScreen(hazeUp(lin, d, d * perDepth));
        // the lake (the mosaic room's 星空湖面): the floor a still sheet of water, mirroring the night sky and its
        // stars, a little broken by slow ripples; more mirror the more it is seen at a slant (Fresnel), so far off it
        // is all sky, and the water has no edge
        if (uLake > 0.0) {
          float pdl;
          vec3 rdl = viewRay(pdl), wp = uCamWorld[3].xyz + rdl * d * pdl;
          if (abs(wp.y) < 0.03) {
            vec2 q = wp.xz * 1.7 + vec2(uClock * 0.25, uClock * 0.17);
            vec2 wob = vec2(sin(q.x + 1.3 * sin(q.y * 0.7)) , sin(q.y * 1.3 + 1.1 * sin(q.x * 0.6))) * 0.012;
            vec3 rn = normalize(vec3(wob.x, 1.0, wob.y));
            vec3 rr = reflect(rdl, rn);
            float cosv = clamp(-rdl.y, 0.0, 1.0), F = 0.02 + 0.98 * pow(1.0 - cosv, 5.0);
            vec3 mirrored = linToScreen(hazeUp(screenToLin(skyColorDir(rr)), d, d * pdl));
            col = mix(col, mirrored, uLake * (0.3 + 0.7 * F));
          }
        }
        // glare: highlights and glints pushed above white, so the glare pass (main.js) spills light around them
        if (uHiOn > 0.5 && c.r > 1.0 + uHiTh && glassK == 0.0) col *= 1.0 + (c.r > 5.0 ? uGlareGlint : uGlareHi * min(c.r - 1.0 - uHiTh, 1.0));
        if (uDebug == 3.0 && !inBand) col = vec3(lit ? 0.42 : 0.16);
        gl_FragColor = vec4(col, 1.0);
      }
      #endif`,
    depthTest: false,
    depthWrite: false,
  });
}
