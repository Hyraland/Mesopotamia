// The times of day: the day (tuning.json: a late afternoon, the sun in the west over
// the river); dusk (tuning_dusk.json), the sun on the far bank's palms, the sky burning down to orange at the
// horizon and the river taking a path of its light; and night (tuning_night.json), the moon over the river (in the
// west, as one looks out from the quay), moonlight cold and faint, the stars out, a path of the moon's light on the
// water, small fires burning here and there in the town. At night the 'sun' of the lighting is the moon.
//
// Each time is tuned on its own, in its own file (tuning.js). Below, what dusk and night start from before they
// have files: the day's values with these laid over them (only those named; sky: see tuning.js). Chosen by the
// address (?time=dusk / night; sunset for dusk) or with the T key, round the three in turn.

export const TIMES = {
  day: {
    sky: { stars: 0, disc: 0 },
  },
  dusk: {
    sun: { elevation: 6.5, azimuth: -100 },
    light: {
      sunColor: '#ffb070', sun: 2.4, shadeColor: '#6c66b4', shade: 0.44, litSat: 0.66, shadeSat: 0.85,
      skyTop: '#41609f', skyHorizon: '#f2a46c', skyCurve: 0.5,
    },
    haze: { sunColor: '#ff9658', sun: 1.25, shadeColor: '#8e83b4', shade: 0.9, density: 0.0028, forward: 0.8 },
    band: { lightWarm: '#ffae94', lightCool: '#6b62d2' },
    sky: { stars: 0, disc: 1, discColor: '#ffd49a', discSize: 0.6, discGlow: 0.6, fires: 0 },
  },
  night: {
    sun: { elevation: 17, azimuth: -82 },
    light: {
      sunColor: '#a9c1ff', sun: 0.6, shadeColor: '#2a3966', shade: 0.28, litSat: 0.45, shadeSat: 0.7,
      skyTop: '#040919', skyHorizon: '#18243f', skyCurve: 0.7,
    },
    haze: { sunColor: '#6276a8', sun: 0.35, shadeColor: '#1f2b4a', shade: 0.55, density: 0.0018 },
    band: { lightWarm: '#9fb2ff', lightCool: '#3c3c9a' },
    glare: { strength: 0.35 },
    sky: { stars: 1, disc: 1, discColor: '#f3f1e6', discSize: 1.0, discGlow: 0.18, fires: 1, exposure: 0.25 },
  },
};
export const TIME_NAMES = ['day', 'dusk', 'night'];
const ALIAS = { sunset: 'dusk', evening: 'dusk' };
export const timeFrom = (name) => (TIMES[ALIAS[name] ?? name] ? ALIAS[name] ?? name : 'day');

// the tuning as it is at that time: a copy, the day's values with the time's laid over them
export function withTime(tuning, name) {
  const over = TIMES[timeFrom(name)], out = {};
  for (const [k, v] of Object.entries(tuning)) out[k] = v && typeof v === 'object' && !Array.isArray(v) ? { ...v } : v;
  for (const [k, v] of Object.entries(over)) out[k] = { ...(out[k] ?? {}), ...v };
  return out;
}

// ---- from one time to another ----
// The tuning part way (k, 0..1) from a to b: numbers and colours run across (the colours in linear light), the
// rest (switches, choices) turns over at half way; these whole numbers too, their changing costly (a count of motes
// remade, a shadow map's size) or meaningless half way
const STEPPED = new Set(['motes.count', 'sun.mapSize', 'sun.nearSize', 'sun.soft', 'sun.nearSoft', 'haze.steps', 'wind.shadowEvery']);
const HEX = /^#[0-9a-f]{6}$/i;
const toLin = (h) => [1, 3, 5].map((i) => { const c = parseInt(h.slice(i, i + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
const toHex = (l) => '#' + l.map((c) => {
  const s = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.round(Math.min(Math.max(s, 0), 1) * 255).toString(16).padStart(2, '0');
}).join('');
function mix(a, b, k, path) {
  if (typeof a === 'number' && typeof b === 'number') {
    if (STEPPED.has(path)) return k < 0.5 ? a : b;
    if (path === 'sun.azimuth') return a + ((((b - a) % 360) + 540) % 360 - 180) * k;   // (the short way round)
    return a + (b - a) * k;
  }
  if (typeof a === 'string' && typeof b === 'string' && HEX.test(a) && HEX.test(b)) {
    const la = toLin(a), lb = toLin(b);
    return toHex(la.map((v, i) => v + (lb[i] - v) * k));
  }
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) return a.map((v, i) => mix(v, b[i], k, `${path}.${i}`));
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const out = {};
    for (const key of Object.keys(b)) out[key] = key in a ? mix(a[key], b[key], k, path ? `${path}.${key}` : key) : structuredClone(b[key]);
    return out;
  }
  return structuredClone(k < 0.5 ? a ?? b : b);
}
// swap: the light changing from the sun to the moon or back (to or from night): then the one sets as the other
// rises, rather than the one sliding across the sky into the other: half way the light below the horizon and
// dimmed, its disc gone
export function blendTuning(a, b, k, swap = false) {
  const out = mix(a, b, k, '');
  if (swap && out.sun && out.light) {
    const s = Math.sin(Math.PI * k);
    out.sun.elevation -= (out.sun.elevation + 3) * s;
    out.light.sun *= 1 - 0.8 * s;
    if (out.sky) out.sky.disc *= Math.abs(1 - 2 * k);
  }
  return out;
}
