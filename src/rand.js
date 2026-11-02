// Seeded randomness and value noise, so the forest grows the same way on every visit.

export function makeRng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// shuffled in place by the dice, always throwing the same number of times (a sort by a random comparator does
// not: how often it asks depends on the engine, and the town's layout came out different on every load)
export function shuffle(a, rng) {
  for (let k = a.length - 1; k > 0; k--) {
    const t = Math.floor(rng() * (k + 1));
    [a[k], a[t]] = [a[t], a[k]];
  }
  return a;
}

function hash2(ix, iz, seed) {
  let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// smooth value noise in 0..1
export function vnoise(x, z, seed = 0) {
  const ix = Math.floor(x), iz = Math.floor(z);
  let fx = x - ix, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx);
  fz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz, seed), b = hash2(ix + 1, iz, seed), c = hash2(ix, iz + 1, seed), d = hash2(ix + 1, iz + 1, seed);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

export function fbm(x, z, octaves = 4, seed = 0) {
  let sum = 0, amp = 0.5, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += vnoise(x, z, seed + i * 17) * amp;
    norm += amp;
    x = x * 2.03 + 5.1;
    z = z * 2.03 - 3.7;
    amp *= 0.5;
  }
  return sum / norm;
}
