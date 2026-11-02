// Woven patterns for the town's cloth: red and white, white and yellow, or the three
// together, in the geometric figures a loom makes thread by thread and the cone mosaics on the walls repeat (zigzags,
// lozenges, stepped teeth, chequers), on a grid of small cells; no blue mixed in, no bands of colour side by side
// down the cloth. Each a tile 0.5 m square that repeats over the cloth (its uvs in half-metres: houseKit cloth).

import * as THREE from 'three';

// (the plain cloths' own colours: tuning.js albedo linen, madder, saffron; a darker red for outlines)
const C = { w: '#e5d7b8', r: '#a25b45', y: '#c99a3a', d: '#7b3a2a' };
const N = 16;   // cells across a tile (some 3 cm each)
const m8 = (v) => ((v % 8) + 8) % 8;
// each: the colour of cell (i across, j down)
const PATTERNS = [
  // red chevrons on white, as the zigzag cone panels
  (i, j) => ((j + Math.abs(m8(i) - 4)) % 8 < 3 ? 'r' : 'w'),
  // yellow lozenges outlined on white
  (i, j) => { const d = Math.abs(m8(i) - 4) + Math.abs(m8(j) - 4); return d < 2 ? 'y' : d === 3 ? 'y' : 'w'; },
  // red lozenges with yellow hearts on white
  (i, j) => { const d = Math.abs(m8(i) - 4) + Math.abs(m8(j) - 4); return d < 1 ? 'y' : d < 3 ? 'r' : d === 4 ? 'd' : 'w'; },
  // white body, across it a red band edged with yellow stepped teeth
  (i, j) => {
    const b = j % 16;
    if (b < 3) return 'r';
    if (b < 6) return b - 3 >= Math.abs((i % 4) - 1.5) + 0.5 ? 'y' : 'w';
    return 'w';
  },
  // yellow ground, red zigzag rows, white between
  (i, j) => { const v = (j + Math.abs(m8(i) - 4)) % 8; return v < 2 ? 'r' : v < 3 ? 'w' : 'y'; },
  // red and white chequer, a yellow cell in each white
  (i, j) => { const a = (Math.floor(i / 2) + Math.floor(j / 2)) % 2; return a ? 'r' : i % 2 && j % 2 ? 'y' : 'w'; },
];
export const WEAVE_N = PATTERNS.length;

const cache = [];
export function weaveTexture(k) {
  if (cache[k]) return cache[k];
  const px = 8, c = document.createElement('canvas');
  c.width = c.height = N * px;
  const g = c.getContext('2d');
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      g.fillStyle = C[PATTERNS[k](i, j)];
      g.fillRect(i * px, j * px, px, px);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  t.anisotropy = 4;
  cache[k] = t;
  return t;
}
