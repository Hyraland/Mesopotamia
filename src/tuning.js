// The adjustable look. tuning.json in the project holds the values everyone sees by day (without it, the
// defaults below); tuning_dusk.json and tuning_night.json the same for dusk and for night (timeOfDay.js), each
// tuned on its own.

// model 'anatomy': the band as the form's anatomy (see shade.js); 'stops': colour stops (scheme .. c3)
// (the values as tuned for 环形废墟)
const band = {
  // on: false leaves the border without its colours, a plain blend from shadow to light
  on: true,
  model: 'anatomy',
  peakChroma: 1.6, peakMin: 0.11, peakHue: 0, peakDark: 0.06, peakFocus: 0.3, peakMaxL: 0.8,
  coreDark: 0.3, coreChroma: 0.4, coreFocus: 2.54, corePath: 0.19, sunsetBelow: 0.07, reflect: 0.12,
  // blend: how wide the core's dark and the halftone's light fade into each other at the middle (0: one hard line)
  blend: 0.2,
  // how much of the border's colour is the light's own, the same on every surface (0: each its own)
  lightShare: 0.5,
  // ... its colours: on the lit side of the border (the halftone) and on the dark side (the core); only their hue
  // counts, each surface keeps its own colourfulness and lightness
  lightWarm: '#ffc2e9', lightCool: '#7f74d8',
  scheme: '自定义', follow: true, gamma: 1.11, chroma: 0.97, fallback: 204,
  on1: true, at1: 0.58, base1: 1, hue1: 180, c1: 0.086,
  on2: false, at2: 0.5, base2: 2, hue2: 25, c2: 0.17,
  on3: false, at3: 0.76, base3: 2, hue3: 95, c3: 0.14,
};

export const TUNING_DEFAULTS = {
  // the two lights every colour is seen under: the sun (lit side) and the shadow (the sky's light, in shade);
  // each a colour and a strength, and how colourful each side is kept
  // shadePull / shadeMinC: shadows turned towards the shadow light's hue, with at least that much colour
  // (a late afternoon over the alluvial plain: a warm sun, a clear sky paling to dust at the horizon)
  light: {
    sunColor: '#fff1dc', sun: 1.8, shadeColor: '#7895d8', shade: 0.45, litSat: 0.62, shadeSat: 0.8,
    shadePull: 0.45, shadeMinC: 0.05, skyTop: '#5b9ce6', skyHorizon: '#e9dfcf', skyCurve: 1.1, knee: 0.82,
    // realism: 0 the painting's two states of light, 1 the light as much as truly falls (the colour relations
    // kept); realSky: how much sky light the realistic light adds everywhere
    real: 0, realSky: 2,
  },
  // the things' own colours. rock: wet silt (just above any water, and on steep banks); salt: the crust on the
  // salt flat and round the lagoon; sand: the desert's edge; dirt: dust gathered in grooves (no baked cavity yet)
  albedo: {
    palm: '#6a8750', deadfrond: '#ad8b5c', bark: '#7d6a52', date: '#c4602c', spadix: '#e0a344',
    leaf: '#4f7d34', poplar: '#7f9566', tamarisk: '#6f8f74', bloom: '#e2a0b4', reed: '#8fa34e', plume: '#a3958a',
    crop: '#c9ad74', herb: '#5b9640', vine: '#6a9a3a', fruit: '#b0302a', grass: '#a9a368',
    ground: '#b39a77', rock: '#7a6c55', salt: '#e2dccc', sand: '#dcc29a', mud: '#736c55', water: '#5f8a7c', dirt: '#6a5642', moss: '#58783a',
    earth: '#af916e', path: '#c7ac8b', brick: '#c59b73', firedbrick: '#977355', plaster: '#d1b28d', lime: '#eaddbd',
    trim: '#d4b693', dark: '#4d3d2d', wood: '#795b3c', straw: '#bfa56f', linen: '#e5d7b8', madder: '#a25b45',
    indigo: '#618489', clay: '#c2895f', buff: '#d6b389', grain: '#ddbf81', stone: '#8e897e', skin: '#af8867',
    hair: '#3c2d23', bronze: '#957e50', whitewash: '#ece7de', redwash: '#a35f45', grape: '#4a3150', saffron: '#c99a3a', zig: '#8a4c34', zigcap: '#a5644a', lichenA: '#e8a7b8', lichenB: '#d9e2c4',
  },
  // the plants' greens drawn into one family (see shade.js): hue (OKLab degrees) they are pulled towards by
  // amount, their colourfulness times saturation; only hues within range degrees of it (the dates, the
  // tamarisk's pink plumes, the reed tassels kept)
  harmony: { on: true, hue: 128, amount: 0.45, saturation: 0.85, range: 60 },
  // how much they vary: plants one from the next, brick / plaster / soil in blotches, the bricks' courses;
  // earth: the hardened earth's crust (shade.js EARTH: relief, cracks, grit), in place of the dabs below.
  // groundVar, groundHue: the ground's painted dabs (shade.js groundTexture): how far they move its lightness
  // and hue. (moss, lichen: none on the plain)
  vary: { leafL: 0.25, leafH: 0.3, mottle: 0.14, brick: 1, moss: 0, mossJoint: 0, groundVar: 0.3, groundHue: 0.25, earth: 1, dirt: 0, lichen: 0 },
  // the border between light and shadow: where it falls (in sunlight 0..1), and how wide its band is, either
  // in light on each side ('light') or in pixels on each side ('screen')
  edge: {
    threshold: 0.34, mode: 'light', wDark: 0.226, wLight: 0.204, pxDark: 2.5, pxLight: 3.5,
    depthTol: 0.04, silhouette: 0.8, jitter: 0.128, noiseScale: 0.7, bandMax: 0.18, jitMax: 0.12,
    // the sun's angle seen through a curve before the decision (< 1: light that only grazes a surface still
    // counts as lit, at its halftone; matters most with a high sun, which only grazes walls; 1: the true angle)
    formGamma: 0.6,
  },
  band,
  // within each family (lit, shadow) a compressed range of its own
  family: { litRange: 0.12, shadeRange: 0.25 },
  // the dry air: golden dust where the sun passes through it, cool in shade; with distance it veils everything
  // (aerial perspective) — the plain is open, so it starts later and thinner than the rainforest's
  haze: {
    on: true, sunColor: '#ffd8a0', sun: 0.6, shadeColor: '#9aaccc', shade: 1.0, density: 0.0022, start: 30,
    height: 30, forward: 0.6, max: 0.6, bands: 0, outside: 0.35, steps: 24,
    // far off, the land fades into the horizon's colour: from farFrom metres, wholly by farTo (shade.js uFarFade)
    farFrom: 1500, farTo: 12000,
  },
  // leaves lit from behind: the light come through them (see shade.js)
  trans: { on: true, amount: 0.98, view: 0.37, depth: 1.5, hue: -20, chroma: 1.25, light: 0.75 },
  // wind: how hard, from where (degrees), how fast, how much the leaves flutter; the sun's shadows are drawn
  // again every `shadowEvery` frames while it blows. (the shamal: from the north-west)
  wind: { on: true, strength: 0.86, direction: 135, speed: 0.56, flutter: 1.05, shadowEvery: 2 },
  // highlights: the sun reflected by smooth surfaces, painted as a third family above the lit one
  highlight: {
    on: true, strength: 1.5, sharpness: 90, threshold: 0.3, glint: 0.35,
    gloss: { palm: 0.35, leaf: 0.3, poplar: 0.15, reed: 0.25, vine: 0.3, fruit: 0.5, date: 0.45, water: 1, bronze: 0.7, lime: 0.05 },
  },
  // the colours light makes by itself, from one harmonised palette (c1 .. c5): the plants' and other surfaces'
  // borders, a touch on glints (see shade.js)
  prism: {
    on: true, c1: '#ffd27a', c2: '#f7a98a', c3: '#e98ab0', c4: '#b49ae0', c5: '#7cc8d8',
    filmLit: 0.55, filmShade: 0.25, filmEdge: 0.8, filmChroma: 1, filmPow: 0.8, filmNoise: 0, hiPrism: 0.4, plantEdge: 0.32, otherEdge: 0.5,
    // the plants' and other surfaces' prism border: across how much of the border band (0..1), and how much it
    // takes the palette's own lightness (0 the surface's)
    edgeWidth: 0.59, edgeLight: 0.5,
  },
  // subsurface scattering: light come out just past the border into the shadow, a glowing band as wide as
  // each kind lets light wander inside (cm), lighter than the shadow, deeper and warmer in colour (hue turned
  // from the lit colour's, degrees). scale: on every width; minPx: at least so many pixels wide
  sss: {
    on: true, amount: 1, scale: 2.52, light: 0.45, chroma: 1.8, minC: 0.07, hue: -25, minPx: 1,
    cm: { palm: 1, deadfrond: 0.5, leaf: 1.5, poplar: 1, tamarisk: 1, bloom: 1.5, reed: 1, plume: 1.5, crop: 0.5, herb: 1.5,
      vine: 1, fruit: 1, date: 1, grass: 0.5, plaster: 0.3, lime: 0.5, linen: 1, skin: 1.5 },
  },
  // glare: the brightest places spill a halo of light around themselves
  glare: { on: true, strength: 0.6, radius: 0.4, threshold: 1, highlight: 0.6, glint: 4 },
  // the sun low in the west, late afternoon (the main stair faces south: lit, the buttresses and its side walls
  // throwing their shadows across the front; the palms' shadows long)
  // slopeBias, grazeCut: against shadow acne where the sun only grazes; soft: the shadow filter's radius in texels
  sun: { elevation: 27, azimuth: -72, range: 110, leafBias: 0.32, mapSize: 0, slopeBias: 2, grazeCut: 0.05, soft: 2,
    // near: a fine second shadow map over nearRange metres either side of the walker (main.js sunNear)
    near: true, nearRange: 22, nearSize: 2048, nearSoft: 3,
    // leafBlur: the leaves' shapes in their shadows blurred by so many mip levels (leaflets merge)
    leafBlur: 2.5,
    // flecks: holes in the crowns' shadow, lined up with the sun (0 none); fleckSize: how big (metres)
    flecks: 0.3, fleckSize: 0.35,
    // shadowSoft: a cast shadow's edge fading over its soft edge (the filter's) instead of cut at the threshold
    // (0: cut, as before; the turn of a form stays crisp either way); shadowBand: how much of the band's colours
    // stays in that fade (0: a plain blend from shadow to light)
    shadowSoft: 1, shadowBand: 0.35 },
  // the river and canals: streak (the current's drifting streaks), shallow (the silt bed showing through near the
  // banks), foam (the wet line where it laps the bank), speed (the current, a multiple); their reflections
  // (water.js): reflect (how much of a mirror at most), facing (how much of one seen from straight above),
  // wobble (ripples tilting it: the reflection broken and drawn out), bands (broken into bands across the flow)
  water: { on: true, streak: 1, shallow: 0.6, foam: 0.5, speed: 1, reflect: 0.8, facing: 0.25, wobble: 0.05, bands: 0.6 },
  // dust in the sun (motes.js)
  motes: { on: true, count: 2500, reach: 16, size: 1.5, bright: 1, pollen: 0.15 },
  // hazeHalf: the air (haze, light shafts) worked out at half size and spread back (much cheaper)
  // auto: the picture drawn at a lower resolution while the frames come slower than target a second (no lower
  // than minScale of scale), back up when there is room again
  // letterbox: the black bars at the top and the foot of the picture while the eagle flies (flyover.js)
  // music: the music playing (music.js), and how loud (0..1)
  view: { fov: 70, scale: 1, msaa: 4, fxaa: true, hazeHalf: true, debug: 'final', auto: true, target: 30, minScale: 0.6, letterbox: true, music: true, musicVolume: 0.6 },
  walk: { speed: 1 },
  // the sky by time of day (timeOfDay.js): stars (0 none, 1 a clear night); the disc where the light comes from (the
  // sun low at dusk, the moon at night): how strong, its colour, its radius in degrees, the glow round it; the
  // fires lit at night (fires.js: 0 out, 1 burning); fireLight, fireReach: how bright their light is on what is
  // round them, and how far it reaches (times its own); exposure: how much light falls on things, over all (the
  // painting's lit side keeps its lightness whatever the sun's strength, so a night is darkened by this)
  sky: { stars: 0, disc: 0, discColor: '#ffffff', discSize: 0.6, discGlow: 0, fires: 0, fireLight: 1, fireReach: 1, exposure: 1 },
};
// the file for each time of day
const FILE = (name) => (name === 'day' ? 'tuning.json' : `tuning_${name}.json`);

// name: the time of day; fallback: its values if it has no file yet (timeOfDay.js: the day's with the time's laid
// over them)
export async function loadTuning({ name = 'day', fallback = null } = {}) {
  const t = structuredClone(TUNING_DEFAULTS);
  const mergeIn = (src) => {
    for (const group of Object.keys(t)) if (src?.[group]) Object.assign(t[group], src[group]);
  };
  let fromFile = null;
  try {
    const r = await fetch(FILE(name), { cache: 'no-store' });
    if (r.ok) fromFile = await r.json();
  } catch { /* no file: the defaults */ }
  mergeIn(fromFile ?? fallback);
  // what the file holds for things no longer here is dropped
  const prune = (obj, def) => {
    for (const k of Object.keys(obj)) {
      if (!(k in def)) delete obj[k];
      else if (def[k] && typeof def[k] === 'object' && !Array.isArray(def[k]) && obj[k] && typeof obj[k] === 'object') prune(obj[k], def[k]);
    }
  };
  prune(t, TUNING_DEFAULTS);
  return t;
}
