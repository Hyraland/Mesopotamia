// The colours. Every surface keeps its own colour; the light only decides whether it is seen lit (its colour
// under the sunlight's colour) or in shadow (under the shadow light's colour). The band between the two is
// worked out per surface from those two colours, in OKLab (a colour space whose lightness looks even to the
// eye): with "follow" on, its brightness climbs from the shadow colour's to the lit colour's (shaped by gamma),
// and its stops bring only hue and colourfulness. A stop's hue is turned from the shadow colour's hue, from the
// lit colour's, or is a fixed hue. The shader (shade.js) does this per pixel.

const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const DEG = Math.PI / 180;

export function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
export const hexToLin = (hex) => hexToRgb(hex).map(toLin);
export const hexToOklab = (hex) => linToOklab(hexToLin(hex));

function linToOklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToLin(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

// to sRGB 0..1; a colour the screen can't show loses colourfulness (not lightness) until it fits
export function oklabToRgb([L, a, b]) {
  const inside = (c) => c.every((v) => v >= -1e-3 && v <= 1.001);
  let c = oklabToLin(L, a, b);
  if (!inside(c) && L < 1) {
    let lo = 0, hi = 1;
    for (let i = 0; i < 12; i++) {
      const k = (lo + hi) / 2;
      if (inside(oklabToLin(L, a * k, b * k))) lo = k; else hi = k;
    }
    c = oklabToLin(L, a * lo, b * lo);
  }
  return c.map((v) => toSrgb(Math.min(Math.max(v, 0), 1)));
}

// The ready-made bands: stops as [position, base, hue (degrees), colourfulness]. base: 0 turned from the
// shadow colour's hue, 1 from the lit colour's, 2 this very hue.
export const SCHEMES = {
  暗处对比色: [[0.42, 0, 180, 0.12]],
  亮处对比色: [[0.58, 1, 180, 0.11]],
  双对比色: [[0.3, 0, 180, 0.11], [0.7, 1, 180, 0.1]],
  色相前移: [[0.45, 1, 40, 0.13]],
  色相后移: [[0.45, 1, -40, 0.13]],
  暖红交界: [[0.42, 2, 28, 0.16]],
  冷暖交界: [[0.36, 2, 232, 0.1], [0.66, 2, 48, 0.14]],
  光谱: [[0.22, 2, 300, 0.12], [0.5, 2, 25, 0.16], [0.76, 2, 95, 0.14]],
  自定义: null,
};
export const BASES = { '从暗部色相转': 0, '从亮部色相转': 1, '固定色相': 2 };

export function applyScheme(name, band) {
  const list = SCHEMES[name];
  if (!list) return false;
  for (const i of [1, 2, 3]) {
    const s = list[i - 1];
    band[`on${i}`] = !!s;
    if (!s) continue;
    [band[`at${i}`], band[`base${i}`], band[`hue${i}`], band[`c${i}`]] = s;
  }
  return true;
}

// the enabled stops, sorted by position (what the shader gets)
export function stopsOf(band) {
  const out = [];
  for (const i of [1, 2, 3]) {
    if (band[`on${i}`]) out.push({ at: band[`at${i}`], base: band[`base${i}`], hue: band[`hue${i}`], c: band[`c${i}`] });
  }
  return out.sort((x, y) => x.at - y.at);
}

// a surface's shadow and lit colours (OKLab), as the shader makes them
// the shadow light's hue, as a unit direction in OKLab's a, b
export function shadeDirOf(hex) {
  const [, a, b] = linToOklab(hexToLin(hex)), l = Math.hypot(a, b);
  return l > 1e-5 ? [a / l, b / l] : [0, -1];
}

export function surfaceColors(albedoLin, light) {
  const sun = hexToLin(light.sunColor).map((v) => v * light.sun);
  const shade = hexToLin(light.shadeColor).map((v) => v * light.shade);
  const S = linToOklab(albedoLin.map((v, i) => v * shade[i]));
  const Lt = linToOklab(albedoLin.map((v, i) => v * sun[i]));
  S[1] *= light.shadeSat; S[2] *= light.shadeSat;
  Lt[1] *= light.litSat; Lt[2] *= light.litSat;
  const [dx, dy] = shadeDirOf(light.shadeColor), C = Math.max(Math.hypot(S[1], S[2]), light.shadeMinC);
  S[1] += (dx * C - S[1]) * light.shadePull;
  S[2] += (dy * C - S[2]) * light.shadePull;
  return { S, Lt };
}

// the band of one surface, n colours (sRGB 0..1) from its shadow colour to its lit colour
export function surfaceRamp(albedoHex, light, band, n = 128) {
  const { S, Lt } = surfaceColors(hexToLin(albedoHex), light);
  if (band.model === 'anatomy') {
    const own = hexToOklab(albedoHex);
    return anatomyRamp(S, Lt, light, band, n, Math.hypot(own[1], own[2]));
  }
  return surfaceRampFrom(S, Lt, band, n);
}

// the band by colour stops, between a surface's shadow and lit colours (OKLab)
function surfaceRampFrom(S, Lt, band, n) {
  const lum = (s) => S[0] + (Lt[0] - S[0]) * Math.min(Math.max(s, 0), 1) ** band.gamma;
  const fb = band.fallback * DEG;
  const pts = [{ at: 0, lab: S }];
  for (const st of stopsOf(band)) {
    let h = st.hue * DEG;
    if (st.base < 2) {
      const ref = st.base === 0 ? S : Lt;
      h += Math.atan2(ref[2] + 0.012 * Math.sin(fb), ref[1] + 0.012 * Math.cos(fb));
    }
    const C = st.c * band.chroma;
    pts.push({ at: Math.min(Math.max(st.at, 0.001), 0.999), lab: [lum(st.at), C * Math.cos(h), C * Math.sin(h)] });
  }
  pts.push({ at: 1, lab: Lt });
  const out = [];
  for (let i = 0; i < n; i++) {
    const s = i / (n - 1);
    let k = 0;
    while (k < pts.length - 2 && s > pts[k + 1].at) k++;
    const p = pts[k], q = pts[k + 1];
    const f = q.at > p.at ? Math.min(Math.max((s - p.at) / (q.at - p.at), 0), 1) : 1;
    const lab = [0, 1, 2].map((j) => p.lab[j] + (q.lab[j] - p.lab[j]) * f);
    if (band.follow) lab[0] = lum(s);
    out.push(oklabToRgb(lab));
  }
  return out;
}

// the band as the form's anatomy, as the shader builds it (anatomy() in shade.js): a halftone at its most
// saturated on the lit side, a core shadow on the dark side, reflected light lifting the shadow
function anatomyRamp(S, Lt, light, band, n, ownChroma) {
  S = [S[0] * (1 + band.reflect), S[1], S[2]];
  const lerp = (p, q, f) => p.map((v, j) => v + (q[j] - v) * f);
  const fb = band.fallback * DEG, shadeDir = shadeDirOf(light.shadeColor);
  // the light's own colours (band.lightShare of them): the hues of band.lightWarm (the halftone) and
  // band.lightCool (the core)
  const k = band.lightShare ?? 0, wl = hexToOklab(band.lightWarm ?? '#ffb48c'), cl = hexToOklab(band.lightCool ?? '#8c74d8');
  const hL = Math.atan2(wl[2], wl[1]) + band.peakHue * DEG, hK = Math.atan2(cl[2], cl[1]);
  const out = [];
  for (let i = 0; i < n; i++) {
    const s = i / (n - 1);
    let lab;
    if (s >= 0.5) {
      const f = (1 - (s - 0.5) * 2) ** band.peakFocus, C = Math.hypot(Lt[1], Lt[2]);
      const dir = C > 1e-4 ? [Lt[1] / C, Lt[2] / C] : [Math.cos(fb), Math.sin(fb)];
      const h = Math.atan2(dir[1], dir[0]) + band.peakHue * DEG, Cp = Math.max(C * band.peakChroma, band.peakMin);
      const ab = [Cp * Math.cos(h), Cp * Math.sin(h)].map((v, j) => v + ((j ? Math.sin(hL) : Math.cos(hL)) * Cp - v) * k);
      lab = lerp(Lt, [Math.min(Lt[0] * (1 - band.peakDark), band.peakMaxL), ...ab], f);
    } else {
      // the core's hue: from the shadow's this far towards the halftone's, the shorter way round
      const CL = Math.hypot(Lt[1], Lt[2]), dl = CL > 1e-4 ? [Lt[1] / CL, Lt[2] / CL] : [Math.cos(fb), Math.sin(fb)];
      const hP = Math.atan2(dl[1], dl[0]) + band.peakHue * DEG;
      const f = (s * 2) ** band.coreFocus, C = Math.hypot(S[1], S[2]);
      const dir = C > 1e-4 ? [S[1] / C, S[2] / C] : shadeDir, hS = Math.atan2(dir[1], dir[0]);
      let dh = ((hP - hS + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
      if (ownChroma < band.sunsetBelow) {
        const toPink = ((-hS * Math.sign(dh)) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
        if (toPink > Math.abs(dh)) dh -= Math.sign(dh) * 2 * Math.PI;
      }
      const h = hS + dh * band.corePath, Ck = C * (1 + band.coreChroma), CkL = Math.max(Ck, light.shadeMinC * (1 + band.coreChroma));
      const ab = [Ck * Math.cos(h), Ck * Math.sin(h)].map((v, j) => v + ((j ? Math.sin(hK) : Math.cos(hK)) * CkL - v) * k);
      lab = lerp(S, [S[0] * (1 - band.coreDark), ...ab], f);
    }
    out.push(oklabToRgb(lab));
  }
  return out;
}

// the plants' greens drawn into one family, as the shader does it (harmonise() in shade.js); linear in and out
export function harmonise(lin, hm) {
  if (!hm?.on) return lin;
  const [L, a, b] = linToOklab(lin);
  let C = Math.hypot(a, b);
  if (C < 1e-4) return lin;
  let h = Math.atan2(b, a);
  const dh = ((h - hm.hue * DEG + 3 * Math.PI) % (2 * Math.PI)) - Math.PI, R = hm.range * DEG;
  const t = Math.min(Math.max((Math.abs(dh) - R * 0.75) / (R * 0.25), 0), 1), inside = 1 - t * t * (3 - 2 * t);
  h -= dh * hm.amount * inside;
  C *= 1 + (hm.saturation - 1) * inside;
  return oklabToLin(L, C * Math.cos(h), C * Math.sin(h)).map((v) => Math.max(v, 0));
}

// One surface's whole range, as the picture paints it: the shadow family (facing down .. facing the sky),
// the border, the lit family (turned from the sun .. facing it). Returns n sRGB colours and where the border
// begins and ends (fractions of n).
export function familyStrip(albedoLin, t, n = 160) {
  const { light, band, family } = t;
  const nS = Math.round(n * 0.22), nL = Math.round(n * 0.28), nB = n - nS - nL;
  const { S, Lt } = surfaceColors(albedoLin, light);
  const out = [];
  for (let i = 0; i < nS; i++) {
    const up = i / (nS - 1);
    out.push(oklabToRgb([S[0] * (1 + family.shadeRange * (up - 0.55) * 2 + (band.model === 'anatomy' ? band.reflect : 0)), S[1], S[2]]));
  }
  const own = linToOklab(albedoLin);
  const ramp = band.model === 'anatomy'
    ? anatomyRamp(S, Lt, light, band, nB, Math.hypot(own[1], own[2]))
    : surfaceRampFrom(S, Lt, band, nB);
  out.push(...ramp);
  for (let i = 0; i < nL; i++) {
    const tl = i / (nL - 1);
    out.push(oklabToRgb([Lt[0] * (1 - family.litRange * (1 - Math.sqrt(tl))), Lt[1], Lt[2]]));
  }
  return { colors: out, band: [nS / n, (nS + nB) / n] };
}

// the uniforms the shader's band takes
export function bandUniforms(band) {
  const st = stopsOf(band);
  const pad = (f, v) => [0, 1, 2].map((i) => (st[i] ? f(st[i]) : v));
  return {
    on: pad(() => 1, 0),
    at: pad((s) => s.at, 2),
    base: pad((s) => s.base, 0),
    hue: pad((s) => s.hue * DEG, 0),
    c: pad((s) => s.c, 0),
  };
}
