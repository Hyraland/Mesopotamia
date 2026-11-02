// The plants' cut-outs, drawn on canvases: white on black (only the shape matters; the colour is the kind's).
// Read as alpha maps (their green channel). Thin parts are drawn a little broader and fewer than in life, so
// they hold together once mipmapped instead of breaking into hatching far off.

import * as THREE from 'three';
import { makeRng } from './rand.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#fff';
  g.strokeStyle = '#fff';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  return { c, g };
}

// The cut-out's smaller mip levels made by hand, each keeping as much of its area solid as the full-size one
// (its alpha scaled until the same share passes the 0.5 test). Plain averaging thins fine leaflets out level
// by level until a frond far off is nothing (a palm a hundred metres away showed a bare trunk); this way a
// distant crown stays as full as a near one, only less detailed.
function coverageMips(c) {
  const g0 = c.getContext('2d');
  let w = c.width, h = c.height;
  const px = g0.getImageData(0, 0, w, h).data;
  let src = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) src[i] = px[i * 4 + 1] / 255;
  const coverage = (a, k) => {
    let n = 0;
    for (let i = 0; i < a.length; i++) if (a[i] * k > 0.5) n++;
    return n / a.length;
  };
  const want = coverage(src, 1);
  const levels = [c];
  while (w > 1 || h > 1) {
    const w2 = Math.max(1, w >> 1), h2 = Math.max(1, h >> 1), dst = new Float32Array(w2 * h2);
    for (let y = 0; y < h2; y++) {
      for (let x = 0; x < w2; x++) {
        const x0 = Math.min(x * 2, w - 1), x1 = Math.min(x * 2 + 1, w - 1), y0 = Math.min(y * 2, h - 1), y1 = Math.min(y * 2 + 1, h - 1);
        dst[y * w2 + x] = (src[y0 * w + x0] + src[y0 * w + x1] + src[y1 * w + x0] + src[y1 * w + x1]) / 4;
      }
    }
    let lo = 1, hi = 8;
    for (let i = 0; i < 14; i++) {
      const mid = (lo + hi) / 2;
      if (coverage(dst, mid) < want) lo = mid; else hi = mid;
    }
    const k = (lo + hi) / 2;
    const lc = document.createElement('canvas');
    lc.width = w2;
    lc.height = h2;
    const lg = lc.getContext('2d'), img = lg.createImageData(w2, h2);
    for (let i = 0; i < w2 * h2; i++) {
      const v = Math.round(255 * Math.min(1, dst[i] * k));
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    lg.putImageData(img, 0, 0);
    levels.push(lc);
    src = dst;
    w = w2;
    h = h2;
  }
  return levels;
}

function texture(c) {
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8;
  t.mipmaps = coverageMips(c);
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

// a narrow pointed blade from (x, y) along angle a: len long, w wide at its widest (a third of the way up)
function blade(g, x, y, a, len, w, bend = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(a);
  g.beginPath();
  g.moveTo(0, -w * 0.35);
  g.quadraticCurveTo(len * 0.35, -w + bend * len * 0.2, len, bend * len * 0.3);
  g.quadraticCurveTo(len * 0.35, w + bend * len * 0.2, 0, w * 0.35);
  g.closePath();
  g.fill();
  g.restore();
}

// A date palm frond along u (the base at u = 0), its rachis along the middle (v = 0.5). The leaflets run from
// the rachis to the card's edges, slanting towards the tip: the frond's geometry (flora.js frondGeometry) sets
// how far out they reach along its length, so here every leaflet is drawn the full half-height. Near the base
// the leaflets turn into short, stiff spines; along the rest they come in loose groups of two or three, each
// at its own slant, a few shorter, one now and then missing (torn off by the wind or cut).
// dry: the same frond dead and hanging: leaflets fewer, many broken short, some folded back
function frond({ dry = false, seed = 3 } = {}) {
  const W = 1024, H = 256, M = H / 2;
  const { c, g } = canvas(W, H);
  const rng = makeRng(seed);
  // the rachis, broad at the base, tapering
  g.beginPath();
  g.moveTo(0, M - 7);
  g.lineTo(W, M - 1.5);
  g.lineTo(W, M + 1.5);
  g.lineTo(0, M + 7);
  g.fill();
  // spines on the petiole
  for (let x = 30; x < 150; x += 9 + rng() * 6) {
    for (const s of [-1, 1]) {
      if (rng() < 0.25) continue;
      const len = (0.25 + 0.45 * (x / 150)) * M * (0.7 + rng() * 0.3);
      blade(g, x, M, s * (0.75 + rng() * 0.25), len, 2.6 + rng(), 0);
    }
  }
  // leaflets: in groups of 2-3, slanting tipwards; the slant steepens a little towards the tip
  let x = 150;
  while (x < W - 14) {
    const group = 2 + Math.floor(rng() * 2);
    for (let k = 0; k < group && x < W - 14; k++) {
      const u = x / W;
      for (const s of [-1, 1]) {
        if (rng() < (dry ? 0.35 : 0.05)) continue;
        const slant = 0.62 + 0.18 * u + (rng() - 0.5) * 0.22;
        let len = (M - 4) / Math.sin(slant) * (0.86 + rng() * 0.14);
        let bend = (rng() - 0.5) * 0.12;
        if (dry) {
          if (rng() < 0.4) len *= 0.25 + rng() * 0.45;   // broken off
          bend += (rng() - 0.5) * 0.5;
        }
        blade(g, x, M + s * 3, s * slant, len, dry ? 4.2 : 5.2 + rng() * 1.2, bend * s);
      }
      x += 9 + rng() * 4;
    }
    x += 8 + rng() * 10;
  }
  return texture(c);
}

// Tamarisk: sprays of fine scale-leaved twigs, like a feather duster, arching out from a clump's middle and
// drooping at their tips. A clump of them, round the centre of the card
function tamarisk() {
  const N = 512, C = N / 2;
  const { c, g } = canvas(N, N);
  const rng = makeRng(17);
  for (let k = 0; k < 46; k++) {
    const a = rng() * Math.PI * 2, r0 = rng() * 40, L = 110 + rng() * 110;
    let x = C + Math.cos(a) * r0, y = C + Math.sin(a) * r0;
    // the spray's twig, curving downward (+y) as it goes
    let dx = Math.cos(a), dy = Math.sin(a) * 0.8 + 0.1;
    const steps = 22;
    g.lineWidth = 2.4;
    for (let i = 0; i < steps; i++) {
      const nx = x + (dx * L) / steps, ny = y + (dy * L) / steps;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(nx, ny);
      g.stroke();
      // fine side twiglets, both sides, short and soft
      if (i > 2) {
        const f = 1 - i / steps;
        for (const s of [-1, 1]) {
          const ang = Math.atan2(dy, dx) + s * (0.7 + rng() * 0.4), l = (10 + 16 * f) * (0.6 + rng() * 0.6);
          g.lineWidth = 2.6;
          g.beginPath();
          g.moveTo(nx, ny);
          g.quadraticCurveTo(nx + Math.cos(ang) * l * 0.6, ny + Math.sin(ang) * l * 0.6, nx + Math.cos(ang) * l, ny + Math.sin(ang) * l + l * 0.35);
          g.stroke();
        }
      }
      x = nx;
      y = ny;
      dy += 0.035;
      const l = Math.hypot(dx, dy);
      dx /= l;
      dy /= l;
    }
  }
  return texture(c);
}

// the tamarisk's flowers: slim racemes, a fuzz of tiny pink flowers round a stalk, gathered into a plume
function tamariskBloom() {
  const N = 256, C = N / 2;
  const { c, g } = canvas(N, N);
  const rng = makeRng(23);
  for (let k = 0; k < 18; k++) {
    const a = -Math.PI / 2 + (rng() - 0.5) * 2.2, L = 50 + rng() * 60;
    const x0 = C + (rng() - 0.5) * 30, y0 = C + 30 + rng() * 20;
    for (let i = 0; i < 40; i++) {
      const t = i / 40, w = 7 * Math.sin(Math.PI * Math.min(1, t * 1.2 + 0.1));
      const x = x0 + Math.cos(a) * L * t + (rng() - 0.5) * w, y = y0 + Math.sin(a) * L * t + (rng() - 0.5) * w;
      g.beginPath();
      g.arc(x, y, 2.2 + rng() * 1.6, 0, 6.2832);
      g.fill();
    }
  }
  return texture(c);
}

// a mass of small leaves round a centre, for a crown's clumps. shape: 'poplar' (the Euphrates poplar's: broad,
// rhombic, toothed at the tip, on long stalks), 'narrow' (pomegranate, willow: slender, pointed), 'fig'
// (broad, deeply three- to five-lobed)
function leafMass(shape, seed) {
  const N = 512, C = N / 2;
  const { c, g } = canvas(N, N);
  const rng = makeRng(seed);
  const count = shape === 'fig' ? 60 : shape === 'poplar' ? 110 : 190;
  for (let k = 0; k < count; k++) {
    const a = rng() * Math.PI * 2, r = 12 + rng() ** 0.75 * 205;
    const x = C + Math.cos(a) * r, y = C + Math.sin(a) * r;
    const ang = a + (rng() - 0.5) * 1.2;
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    if (shape === 'fig') {
      const s = 24 + rng() * 14;
      // five lobes fanned from the stalk, the middle one longest
      for (const [la, ll, lw] of [[0, 1, 0.34], [0.75, 0.78, 0.3], [-0.75, 0.78, 0.3], [1.45, 0.45, 0.24], [-1.45, 0.45, 0.24]]) {
        g.save();
        g.rotate(la);
        g.beginPath();
        g.ellipse(s * ll * 0.55, 0, s * ll * 0.55, s * lw, 0, 0, 6.2832);
        g.fill();
        g.restore();
      }
      g.beginPath();
      g.arc(s * 0.12, 0, s * 0.3, 0, 6.2832);
      g.fill();
    } else if (shape === 'poplar') {
      const s = 15 + rng() * 9;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(-s * 0.9, 0);
      g.lineTo(0, 0);
      g.stroke();
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(s * 0.55, -s * 0.62);
      for (let t = 0; t < 5; t++) g.lineTo(s * (0.7 + t * 0.07), (t % 2 ? -1 : 1) * s * 0.08 + (t - 2) * s * 0.14);
      g.lineTo(s * 0.55, s * 0.62);
      g.closePath();
      g.fill();
    } else {
      const s = 16 + rng() * 10;
      blade(g, 0, 0, 0, s * 1.6, s * 0.28, (rng() - 0.5) * 0.3);
    }
    g.restore();
  }
  return texture(c);
}

// a long narrow grass blade (reed, cattail, onion), its base at the bottom (v = 0), tapering to a point
function strap() {
  const { c, g } = canvas(64, 512);
  g.beginPath();
  for (let y = 512; y >= 0; y -= 4) {
    const t = 1 - y / 512, hw = 26 * Math.min(1, t * 10 + 0.5) * (1 - t ** 1.8);
    g.lineTo(32 - hw, y);
  }
  for (let y = 0; y <= 512; y += 4) {
    const t = 1 - y / 512, hw = 26 * Math.min(1, t * 10 + 0.5) * (1 - t ** 1.8);
    g.lineTo(32 + hw, y);
  }
  g.fill();
  return texture(c);
}

// the reed's tassel (Phragmites): a loose, silky panicle hanging to one side from the top of the stem; its
// stalk at the bottom middle of the card, the panicle nodding towards the right
function plume() {
  const W = 128, H = 256;
  const { c, g } = canvas(W, H);
  const rng = makeRng(31);
  const axis = (t) => [W * 0.42 + t * t * W * 0.38, H - t * H * 0.92];
  g.lineWidth = 3;
  g.beginPath();
  for (let i = 0; i <= 20; i++) {
    const [x, y] = axis(i / 20);
    if (i) g.lineTo(x, y); else g.moveTo(x, y);
  }
  g.stroke();
  for (let i = 0; i < 70; i++) {
    const t = 0.35 + rng() * 0.65, [x, y] = axis(t);
    const a = Math.PI * 0.5 + (rng() - 0.5) * 1.4 - t * 0.6, l = (18 + rng() * 30) * Math.sin(Math.PI * Math.min(1, (t - 0.3) * 1.5));
    g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 6, y + Math.sin(a) * l * 0.4, x + Math.cos(a) * l + 10, y + Math.sin(a) * l * 0.7 + 4);
    g.stroke();
  }
  return texture(c);
}

// a tuft of grass: blades fanning up and out from the bottom middle, some bent over. dry: thinner, fewer,
// more of them broken over (the summer's dry tufts); camel: camelthorn, a stiff twiggy cushion of thorns
function tuft({ dry = true, camel = false, seed = 41 } = {}) {
  const N = 256;
  const { c, g } = canvas(N, N);
  const rng = makeRng(seed);
  if (camel) {
    // camelthorn: a low dome of branching twigs, each with thorns and a few tiny leaves
    const twig = (x, y, a, l, depth) => {
      const nx = x + Math.cos(a) * l, ny = y + Math.sin(a) * l;
      g.lineWidth = 1.8 + depth;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(nx, ny);
      g.stroke();
      if (depth > 0) for (let k = 0; k < 3; k++) twig(nx, ny, a + (rng() - 0.5) * 1.5, l * (0.55 + rng() * 0.2), depth - 1);
      else {
        g.beginPath();
        g.ellipse(nx, ny, 4, 2.2, a, 0, 6.2832);
        g.fill();
      }
    };
    for (let k = 0; k < 9; k++) twig(N / 2 + (rng() - 0.5) * 30, N - 4, -Math.PI / 2 + (rng() - 0.5) * 2.2, 40 + rng() * 25, 3);
    return texture(c);
  }
  const n = dry ? 46 : 60;
  for (let k = 0; k < n; k++) {
    const x0 = N / 2 + (rng() - 0.5) * 40, a = -Math.PI / 2 + (rng() - 0.5) * 1.9, len = (0.45 + rng() * 0.5) * N * 0.95;
    const bend = (rng() - 0.5) * (dry ? 1.4 : 0.8);
    g.save();
    g.translate(x0, N);
    g.rotate(a + Math.PI / 2);
    g.beginPath();
    const w = dry ? 2.6 : 3.4;
    g.moveTo(-w, 0);
    g.quadraticCurveTo(-w * 0.6 + bend * len * 0.25, -len * 0.55, bend * len * 0.5, -len);
    g.quadraticCurveTo(w * 0.6 + bend * len * 0.25, -len * 0.55, w, 0);
    g.fill();
    g.restore();
  }
  return texture(c);
}

// ripe sesame, as it is cut: a few upright stems from the foot, branching once or twice, the last lance-shaped
// leaves on their lower part, the four-sided capsules standing close up the upper part, in pairs
function sesame() {
  const N = 256;
  const { c, g } = canvas(N, N);
  const rng = makeRng(61);
  const stem = (x, y, a, len, depth) => {
    const steps = 12;
    let px = x, py = y;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, nx = x + Math.sin(a) * len * t + Math.sin(t * 3) * 2, ny = y - Math.cos(a) * len * t;
      g.lineWidth = 3.2 - t * 1.4;
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(nx, ny);
      g.stroke();
      if (t < 0.45 && i % 2 === 0) {
        for (const s of [-1, 1]) blade(g, nx, ny, -Math.PI / 2 + a + s * (0.9 + rng() * 0.3), 22 + rng() * 10, 4.6, s * 0.4);
      } else if (t >= 0.45 && i % 1 === 0) {
        for (const s of [-1, 1]) {
          g.save();
          g.translate(nx + s * 3.2, ny);
          g.rotate(a + s * 0.18);
          g.beginPath();
          g.ellipse(0, -6, 2.6, 7, 0, 0, 6.2832);
          g.fill();
          g.restore();
        }
      }
      if (depth > 0 && i === 5 && rng() < 0.8) stem(nx, ny, a + (rng() < 0.5 ? -1 : 1) * (0.3 + rng() * 0.2), len * 0.55, depth - 1);
      px = nx;
      py = ny;
    }
  };
  for (let k = 0; k < 4; k++) stem(N / 2 + (rng() - 0.5) * 40, N, (rng() - 0.5) * 0.25, N * (0.78 + rng() * 0.18), 1);
  return texture(c);
}

// a grape leaf: palmately five-lobed, toothed, its stalk at the bottom middle (for the pergola's vine)
function vineLeaf() {
  const { c, g } = canvas(256, 256);
  g.translate(128, 200);
  for (const [a, l] of [[0, 150], [0.95, 118], [-0.95, 118], [1.8, 70], [-1.8, 70]]) {
    g.save();
    g.rotate(a - Math.PI / 2);
    g.beginPath();
    g.moveTo(0, -22);
    for (let t = 0; t <= 8; t++) g.lineTo(l * (t / 8), (t % 2 ? 1 : 0.7) * l * 0.32 * Math.sin((Math.PI * t) / 8) - 22 * (1 - t / 8));
    for (let t = 8; t >= 0; t--) g.lineTo(l * (t / 8), -(t % 2 ? 1 : 0.7) * l * 0.32 * Math.sin((Math.PI * t) / 8) + 22 * (1 - t / 8));
    g.fill();
    g.restore();
  }
  return texture(c);
}

// A grove far off, drawn on one card (farLand.js): a row of date palms, tall and short, their crowns of broad
// fronds fanned up and drooping, a few young palms and the bushes under them; their trunks on a card of their
// own (the bark's colour), drawn the same. 16 px to the metre, the card 64 m by 16 m; its foot at the bottom
function grove(seed) {
  const W = 1024, H = 256, PX = 16;
  const crowns = canvas(W, H), trunks = canvas(W, H);
  const rng = makeRng(seed);
  for (let x = 40 + rng() * 40; x < W - 50; x += 45 + rng() * 75) {
    const young = rng() < 0.15, h = young ? 0.5 + rng() * 1.5 : 6.5 + rng() * 6, lean = (rng() - 0.5) * 0.12 * h * PX;
    const tx = x + lean, ty = H - h * PX;
    if (!young) {
      const g = trunks.g;
      g.lineWidth = 6 + rng() * 2;
      g.beginPath();
      g.moveTo(x, H + 2);
      g.quadraticCurveTo(x + lean * 0.3, H - h * PX * 0.5, tx, ty + 6);
      g.stroke();
    }
    // the crown: fronds fanned from upright to drooping below the horizontal
    const n = 13 + Math.floor(rng() * 5), L = (young ? 2.6 : 3.6 + rng()) * PX;
    for (let k = 0; k < n; k++) {
      const f = k / (n - 1), side = k % 2 ? 1 : -1;
      const a = -Math.PI / 2 + side * (0.2 + 1.9 * f ** 0.9) + (rng() - 0.5) * 0.25;
      blade(crowns.g, tx, ty, a, L * (0.75 + rng() * 0.3), 8 + rng() * 3, side * 0.35 * f);
    }
    // (bushes under them now and then: pomegranates, the young growth)
    if (rng() < 0.35) {
      crowns.g.beginPath();
      crowns.g.ellipse(x + (rng() - 0.5) * 60, H - 12, 18 + rng() * 22, 14 + rng() * 16, 0, 0, Math.PI * 2);
      crowns.g.fill();
    }
  }
  return { crowns: texture(crowns.c), trunks: texture(trunks.c) };
}
export const groveCards = () => [grove(201), grove(202), grove(203)];

export const VINE_ATTACH = 1 - 200 / 256;   // the vine leaf's stalk, in v

export function makePlantTextures() {
  return {
    frond: frond(), frondB: frond({ seed: 9 }), dryFrond: frond({ dry: true, seed: 5 }),
    tamarisk: tamarisk(), bloom: tamariskBloom(),
    poplar: leafMass('poplar', 51), narrow: leafMass('narrow', 53), fig: leafMass('fig', 57),
    strap: strap(), plume: plume(), grass: tuft(), greenTuft: tuft({ dry: false, seed: 43 }), camel: tuft({ camel: true, seed: 47 }), sesame: sesame(),
    vine: vineLeaf(),
  };
}

// the date palm trunk's leaf bases ("boots"), as a height map for its bump: a lattice of diamond-shaped bases,
// every row set over by half, each rising from the trunk towards its cut upper edge and dropping into the
// groove behind it, fibrous along its length. Repeats: 4 bases round, 4 rows up
export function bootsBump() {
  const N = 256, cols = 4, rows = 4;
  const data = new Uint8Array(N * N * 4);
  const rng = makeRng(71);
  const fib = Array.from({ length: N }, () => rng());
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const fy = (y / N) * rows, row = Math.floor(fy);
      const fx = (x / N) * cols + (row % 2) * 0.5;
      const cx = fx - Math.floor(fx) - 0.5, cy = fy - row;                      // -0.5..0.5 across, 0..1 up
      // the base's outline: narrow at its foot, widest near its top; outside it, the groove
      const halfW = 0.18 + 0.3 * Math.min(1, cy * 1.4);
      const inside = Math.max(0, 1 - Math.abs(cx) / halfW);
      let h = inside > 0 ? (0.25 + 0.75 * cy ** 0.7) * Math.min(1, inside * 3) : 0.05;
      h *= 0.85 + 0.15 * fib[x];                                                // fibres along the base
      if (cy > 0.92) h *= 0.35;                                                 // the cut edge's drop
      const v = Math.round(255 * Math.min(1, h)), k = (y * N + x) * 4;
      data[k] = data[k + 1] = data[k + 2] = v;
      data[k + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}
