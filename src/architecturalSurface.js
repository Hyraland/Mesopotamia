// The reference assets' material language, expressed in the town's existing
// two-buffer renderer. Metre-scale patterns; no external texture downloads.
export const SURFACE_KINDS = ['brick', 'firedbrick', 'zig', 'whitewash', 'redwash', 'plaster', 'lime', 'trim', 'zigcap', 'wood', 'straw', 'linen', 'clay', 'buff'];
export const COATED_KINDS = ['whitewash', 'redwash', 'plaster'];

export const ARCHITECTURAL_SURFACE = /* glsl */ `
#ifdef ARCH_SURFACE
vec2 masonryUV(vec3 p, vec3 n) {
  if (abs(n.y) > 0.7) return p.xz;
  return vec2(abs(n.x) > abs(n.z) ? p.z : p.x, p.y);
}
// Colour multiplier and shallow relief. Course edges soften at a distance.
vec2 masonry(vec3 p, vec3 n) {
  float level = step(0.7, abs(n.y));
  vec2 size = mix(vec2(0.43, 0.165), vec2(0.34), level);
  vec2 uv = masonryUV(p, n);
  uv += vec2(sin(uv.y * 7.1), sin(uv.x * 5.3)) * 0.002;
  vec2 q = uv / size;
  q.x += mod(floor(q.y), 2.0) * 0.5;
  vec2 cell = floor(q), f = fract(q), edge = min(f, 1.0 - f) * size;
  float d = min(edge.x, edge.y), fw = max(fwidth(d), 0.0007);
  float detail = 1.0 - smoothstep(0.014, 0.065, max(fwidth(uv.x), fwidth(uv.y)));
  float joint = (1.0 - smoothstep(0.006, 0.011 + fw, d)) * detail;
  float tone = (hash13(vec3(cell, 12.0)) - 0.5) * 0.16;
  float grit = (vnoise3(p * 24.0) - 0.5) * detail;
  return vec2(1.0 + tone - joint * mix(0.27, 0.08, level) + grit * 0.07,
              -joint * 0.007);
}
vec4 architecturalSurface(vec3 p, vec3 n, vec3 colour) {
  float metres = max(length(dFdx(p)), length(dFdy(p)));
  float fine = 1.0 - smoothstep(0.012, 0.065, metres);
  float grain = (vnoise3(p * 28.0 + 5.0) - 0.5) * fine;
  vec3 c = colour;
  // (relief only in the brick joints: anything finer in the normal, grit, grain, weave, flickers between the light
  // and the shade, binary here, wherever the sun grazes a surface, and stripes it with the terminator's colours;
  // the finer things are in the colour only)
  float h = 0.0;
  #ifdef ARCH_BRICK
    vec2 b = masonry(p, n);
    c *= b.x; h += b.y;
  #endif
  #ifdef ARCH_COAT
    // A fresh coat, as the town saw it in its own day: whole, with only the
    // soft sweeps of the trowel, no brick showing. (No grit: a few centimetres
    // across, it reads as noise on the screen, most of all on a wall in shade.)
    float trowel = vnoise3(p * vec3(3.5, 12.0, 3.5)) - 0.5;
    c *= 1.0 + trowel * 0.03;
  #endif
  #ifdef ARCH_WOOD
    float fibre = sin((p.x + p.z) * 115.0 + vnoise3(p * vec3(5.0, 0.6, 5.0)) * 12.0) * fine;
    c *= 1.0 + fibre * 0.045 + grain * 0.16;
  #endif
  #ifdef ARCH_WEAVE
    vec2 uv = masonryUV(p, n);
    float visible = 1.0 - smoothstep(0.003, 0.018, metres);
    vec2 waves = sin(uv * 760.0);
    float weave = waves.x * waves.y * visible;
    c *= 1.0 + weave * 0.07 + grain * 0.09;
  #endif
  #ifdef ARCH_CLAY
    float rings = sin(p.y * 160.0 + vnoise3(p * 4.0) * 2.0) * fine;
    c *= 1.0 + grain * 0.09 + rings * 0.025;
  #endif
  #ifndef ARCH_COAT
    c *= 1.0 + grain * 0.045;
  #endif
  return vec4(c, h);
}
// Screen derivatives give a shallow surface normal without subdividing walls.
vec3 architecturalNormal(vec3 position, vec3 n, float height) {
  vec3 dx = dFdx(position), dy = dFdy(position);
  vec3 r1 = cross(dy, n), r2 = cross(n, dx);
  float det = dot(dx, r1);
  vec3 gradient = sign(det) * (dFdx(height) * r1 + dFdy(height) * r2);
  return normalize(abs(det) * n - gradient);
}
#endif
`;
