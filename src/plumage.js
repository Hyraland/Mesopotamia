// The eagle's feathers, light and dark: two pictures, linear, 0.5 the kind's own
// colour (shade.js lightMat detailMap), laid on the eagle by the uvs tools/build_eagle.py gives it.
//
// vane: a feather's vane, four of them side by side (each feather of the bird takes one, so no two neighbours are
// alike), across it left to right, along it from the base (the picture's top) to the tip. Its shaft a little pale,
// off the middle (the outer web narrower); the barbs leaving it slantwise towards the tip, each catching the light a
// little; the web split here and there between barbs, as a feather's is; faint grey bars across the inner web (a
// golden eagle's flight feathers); its edges and its tip darker, so each feather reads against the one under it;
// its base paler (the down, mostly hidden).
//
// plume: the small feathers over the body, the arm's leading edge and the thighs, tiled: rows of rounded tips,
// each row half a feather along from the last, the tips pointing back (the picture's top), each tip a little
// darker at its edge where it lies over the next, its shaft a thin pale line, each feather a little lighter or
// darker than its neighbours.

import * as THREE from 'three';

let cache = null;

const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const smooth = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };

function texture(w, h, fill, repeat) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = Math.round(Math.min(Math.max(fill(x, y), 0), 1) * 255), i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  t.wrapS = t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.anisotropy = 8;
  return t;
}

// one feather's vane, across x (0..1) and along y (0 the base, 1 the tip); col: which of the four
function vane(x, y, col) {
  const tone = [1.0, 0.89, 1.11, 0.95][col];
  const R = 0.42, d = x - R, ad = Math.abs(d);
  let k = 0;
  // the barbs: slantwise towards the tip, about ninety down each side
  const NB = 90, phase = y * NB - ad * 14 + (d > 0 ? 0.5 : 0);
  k += 0.05 * Math.sin(phase * Math.PI * 2);
  // the web split between two barbs, here and there, from the edge part way in
  const barb = Math.floor(phase);
  if (hash(barb * 7.3 + col * 31 + (d > 0 ? 17 : 0)) < 0.03 && ad > 0.2) {
    const f = phase - barb;
    k -= 0.22 * smooth(0.0, 0.2, f) * (1 - smooth(0.35, 0.6, f)) * smooth(0.2, 0.36, ad);
  }
  // faint bars across the inner web
  if (d > 0.04) k -= 0.1 * (0.5 + 0.5 * Math.sin((y * 7.5 + 0.3 * Math.sin(ad * 9 + col)) * Math.PI * 2)) * smooth(0.18, 0.3, y) * (1 - smooth(0.8, 0.9, y));
  // the edges, the tip darker; the base paler
  k -= 0.26 * (1 - smooth(0.0, 0.1, Math.min(x, 1 - x)));
  k -= 0.16 * smooth(0.84, 0.97, y);
  k += 0.1 * (1 - smooth(0.06, 0.2, y));
  // the shaft
  const sw = 0.016 * (1 - 0.7 * y);
  k += 0.16 * (1 - smooth(sw * 0.5, sw, ad)) * (1 - smooth(0.75, 1.0, y));
  return 0.5 * tone * (1 + k);
}

// the plumage, a tile of 4 x 4 feathers (x, y 0..1 across the tile; the tips towards y 0)
function plume(x, y) {
  const N = 4, w = 1 / N, h = 1 / N;
  let best = null;
  for (let i = -2; i <= N; i++) {
    for (let j = -1; j <= N; j++) {
      const cx = (j + (i & 1) * 0.5) * w, cy = i * h;
      const dx = ((x - cx + 1.5) % 1) - 0.5, dy = ((y - cy + 2) % 1);
      if (dy > 1.7 * h) continue;
      // the feather's outline: a rounded tip, then straight sides
      const a = 0.62 * w, b = 0.75 * h;
      const e = dy < b ? (dx / a) ** 2 + ((dy - b) / b) ** 2 : (dx / a) ** 2;
      if (e > 1) continue;
      // the one on top: the nearest tip above
      if (!best || dy < best.dy) best = { dy, dx, e, id: (((i % N) + N) % N) * N + ((((j % N) + N) % N)) };
    }
  }
  if (!best) return 0.42;
  const { dx, dy, e, id } = best;
  let k = 0.1 * (hash(id + 3.1) - 0.5) * 2;
  k -= 0.24 * smooth(0.6, 1.0, e);                                       // its edge, over the next
  k += 0.1 * (1 - smooth(0.006, 0.014, Math.abs(dx))) * smooth(0.1 * h, 0.4 * h, dy);   // its shaft
  k += 0.035 * Math.sin((dy * 34 / h - Math.abs(dx) * 22 / w) * Math.PI);        // its barbs
  k -= 0.1 * smooth(0.6 * h, 1.0 * h, dy);                               // towards its base, under the next
  return 0.5 * (1 + k);
}

export function plumageTextures() {
  if (cache) return cache;
  const VW = 128, VH = 1024;
  cache = {
    vane: texture(VW * 4, VH, (px, py) => vane((px % VW + 0.5) / VW, (py + 0.5) / VH, Math.floor(px / VW)), false),
    plume: texture(256, 256, (px, py) => plume((px + 0.5) / 256, (py + 0.5) / 256), true),
  };
  return cache;
}
