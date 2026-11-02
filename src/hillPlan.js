// The hill town's plan, as numbers only, after the author's sketch: one way up and nothing else.
// From the quay a lane curves up the slope between houses whose doors all open onto it; at the top of the slope a
// long stair runs across the hill's face (north), climbing in three flights with landings between, open on its
// river side (the houses below it are kept down, their roofs at its level or under it); a short climb from its
// head into the courtyard on the top, with the lookout in it. Close above the stair, on its own terrace, the
// ziggurat. Houses fill everything one sees. hillLand.js turns this into ground, hillTown.js into houses and steps.
//
// (The sketch drawn with the river along its foot; here the river is to the west, so the sketch's up is east and
// its right is south.) Heights are from the water (0); x east, z south, metres.

import { fbm } from './rand.js';

const clamp = (v, a = 0, b = 1) => Math.min(Math.max(v, a), b);
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

export const QUAY_Y = 1.3;
const FOOT_X = -34;   // where the slope rises from the quay

// ---- outlines ----
function segDist(x, z, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1));
  return Math.hypot(x - ax - dx * t, z - az - dz * t);
}
function polySigned(x, z, pts) {
  let d = Infinity, c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    d = Math.min(d, segDist(x, z, xi, zi, xj, zj));
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c ? d : -d;
}
// the mound the town and the temple stand on: the slope up from the quay, the top, the temple's terrace
// (south of the temple's gateway the town goes on a little, so the way to it ends in houses, not the plain)
// (south of the temple's terrace, its outer court)
export const MOUND = [[FOOT_X, -50], [70, -50], [70, 17], [134, 17], [134, 119], [12, 119], [12, 90], [-2, 68], [FOOT_X, 52]];
export const inMound = (x, z, pad = 0) => polySigned(x, z, MOUND) > pad;
// the mound as it was before the outer court: where the plants and fields were placed by it, their dice thrown as
// they were (hillScene.js, hillLand.js FIELDS), so nothing else in the scene moves
const MOUND_WAS = [[FOOT_X, -50], [70, -50], [70, 17], [134, 17], [134, 104], [12, 104], [12, 90], [-2, 68], [FOOT_X, 52]];
export const inMoundWas = (x, z, pad = 0) => polySigned(x, z, MOUND_WAS) > pad;

// ---- the way up ----
// the stair along the hill's face: its line, and its three flights (landings between them)
export const STAIR_X = 10.5;
const STAIR_PTS = [[36, 8.5], [31.5, 8.5], [26.5, 10.0], [23, 10.0], [17.5, 11.6], [14, 11.6], [8.5, 13.0], [4.5, 13.0]];
// the stair's height at z (north of it the top's, south of it its foot's)
export function stairY(z) {
  if (z >= STAIR_PTS[0][0]) return STAIR_PTS[0][1];
  for (let i = 0; i < STAIR_PTS.length - 1; i++) {
    const [za, ya] = STAIR_PTS[i], [zb, yb] = STAIR_PTS[i + 1];
    if (z <= za && z >= zb) return lerp(ya, yb, (za - z) / (za - zb));
  }
  return STAIR_PTS.at(-1)[1];
}

// the top: the courtyard (with the lookout in it), and the temple's terrace south of it, a little lower
export const TOP_Y = 14.5;
// (its houses some 6 to 8 m from the lookout's foot: two thirds of what they were)
export const PLAZA = { x0: 22, x1: 42, z0: -25.5, z1: -1.5, y: TOP_Y };
export const LOOKOUT = { x: 32, z: -13.5, half: 4.5, h: 5.6 };
// (the temple's terrace lies a little below the stair, so from the stair one looks over its low wall onto it)
export const PRECINCT = { x0: 12.5, x1: 134, z0: 17, z1: 104, y: 9.5 };
// the outer court beyond its south wall, at its level: the en-priestess's house (Giparu), the potters, the folds
export const OUTER = { x0: 12.5, x1: 134, z0: 104, z1: 119, y: 9.5 };
export const inOuter = (x, z, pad = 0) => x > OUTER.x0 + 1.4 - pad && x < OUTER.x1 - 1.3 + pad && z > OUTER.z0 - 2.0 - pad && z < OUTER.z1 - 1.3 + pad;
// (its great stair reaches some 36 m out from its body: its foot some 13 m in from the gateway, so one sees the whole
// of it from there; x puts the foot at 25.3, the model's foot being 53 m of it west of its origin)
export const ZIGGURAT = { x: 25.3 + 53.0 * 1.35, z: 54, scale: 1.35 };

// the mound's surface before the way is cut into it: the slope from the quay rising slowly, then steeply under
// the top (so the houses near the top stand well below it and one sees over them), the top flat
function slopeTop(z) {
  // (north of the stair the slope runs up to the top's edge; along the stair to the stair; south of it, the foot)
  const k = smooth(1, 6, z);
  const S = lerp(TOP_Y, z <= 36 ? stairY(z) : STAIR_PTS[0][1] - 0.1 * (z - 36), k);
  return { S, xt: lerp(14, STAIR_X - 1.3, k) };
}
function moundTop(x, z) {
  if (x >= (z < 4 ? 14 : PRECINCT.x0)) return z > PRECINCT.z0 ? PRECINCT.y : TOP_Y;
  const { S, xt } = slopeTop(z);
  if (x >= xt) return z >= 4 && z <= 36 ? stairY(z) : S;
  const t = clamp((x - FOOT_X) / (xt - FOOT_X));
  return QUAY_Y + (S - QUAY_Y) * t ** 2.6;
}
// the mound's height (the plain's `base` round it): its edges away from the river fall to the plain in banks
export function moundY(x, z, base) {
  const sd = polySigned(x, z, MOUND);
  if (sd < -26) return base;
  const top = moundTop(Math.max(x, FOOT_X), clamp(z, -50, OUTER.z1)) + (fbm(x * 0.05, z * 0.05, 2, 9) - 0.5) * 0.3 * smooth(-30, 0, x);
  return sd >= 0 ? top : lerp(base, top, smooth(-24 - (fbm(x * 0.04, z * 0.04, 2, 3) - 0.5) * 10, 0, sd));
}

// ---- the lanes: the way up from the quay, the stair, the climb into the courtyard ([x, z] or [x, z, y]: a point's
// height is the ground's there unless given) ----
// The way up and the climb run square to the plan, as the houses do (a lane at a slant to them left slivers and
// wedges between the houses lining it and the rest): straight runs, turning at right angles, a level landing the
// lane's width square at each turn. The runs keep their line; the houses along them stand each a little forward or
// back of the next, and the steps' ends follow them (hillTown.js). ortho: from start [x, z, y], each run [dx, dz,
// y] (dx east, dz south; one of them 0) to height y
const ortho = (start, runs, hw) => {
  const pts = [start];
  let [x, z] = start;
  runs.forEach(([dx, dz, y], k) => {
    const len = Math.hypot(dx, dz), ux = dx / len, uz = dz / len, y0 = pts.at(-1)[2];
    // (its first half-width the landing at the turn before it, level; its last the one at the turn after)
    if (k > 0) pts.push([x + ux * hw, z + uz * hw, y0]);
    x += dx; z += dz;
    if (k < runs.length - 1) pts.push([x - ux * hw, z - uz * hw, y], [x, z, y]);
    else pts.push([x, z, y]);
  });
  return pts;
};
// (its heights given, so it climbs evenly, some 15 %: stepped ramps all the way; east in four runs, south in three
// short ones between them; it ends on the stair's level foot, beside the teacher's door)
const CURVE = ortho([-34.5, 10, QUAY_Y], [
  [9.5, 0, 2.53], [0, 6.0, 2.9], [10.5, 0, 4.05], [0, 6.8, 4.51], [8.0, 0, 5.28], [0, 9.4, 6.11], [17.0, 0, 8.5],
], 1.5);
// (from the stair's head east, north up a short flight, east into the courtyard)
const LEG = ortho([STAIR_X, 4.5, 13.0], [[6.0, 0, 13.4], [0, -7.4, 14.3], [7.5, 0, TOP_Y]], 1.4);
// from the stair's foot the other way, south along the temple terrace's wall, a stepped ramp up a metre to the
// terrace's level, then east through a gateway in the wall to the foot of the ziggurat's great stair
const TEMPLE = [[STAIR_X, 36, 8.5], [STAIR_X, ZIGGURAT.z, PRECINCT.y], [16.4, ZIGGURAT.z, PRECINCT.y]];
export const TEMPLE_GATE = { x: STAIR_X + 1.3 + 0.3 + 0.6, z: ZIGGURAT.z, half: 1.9 };
const lane = (w, pts, opts = {}) => ({ w, ...opts, pts: pts.map(([x, z, y]) => ({ x, z, y: y ?? moundY(x, z, 1) })) });
export const LANES = [
  // (bare: on its first run, up from the quay, the lowest seven treads left out, a slope of trodden earth to the
  // two at its head)
  // (shift: a run's steps moved across it, metres to its right going up: the quay's first run's south, clear of the
  // awning over the door of the house beside its head; the bed beside it cut back for them, TOWN_EDITS)
  lane(3.0, CURVE, { main: true, bare: { 0: 7 }, shift: { 0: 2.0 } }),
  lane(2.6, STAIR_PTS.map(([z, y]) => [STAIR_X, z, y]), { stair: true, noDoors: true }),
  lane(2.8, LEG, { main: true }),
  lane(3.0, TEMPLE, { main: true, temple: true }),
];

// ---- where a point is on the lanes ----
export function laneAt(x, z) {
  let best = { d: Infinity };
  for (const l of LANES) {
    for (let i = 0; i < l.pts.length - 1; i++) {
      const a = l.pts[i], b = l.pts[i + 1], dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz;
      const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / L2);
      const d = Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
      if (d < best.d) best = { d, y: a.y + (b.y - a.y) * t, lane: l, i, t, slope: Math.abs(b.y - a.y) / Math.sqrt(L2) };
    }
  }
  return best;
}
// a stretch steeper than this has steps: up to STAIR a stepped ramp (long low treads, for donkeys), above it a stair
export const RAMP = 0.07, STAIR = 0.2;

const inPlaza = (x, z) => x > PLAZA.x0 && x < PLAZA.x1 && z > PLAZA.z0 && z < PLAZA.z1;
export function openAt(x, z) {
  if (inPlaza(x, z)) return true;
  const l = laneAt(x, z);
  return l.d < l.lane.w / 2;
}

// below the stair, on its river side: the ground let down a storey, so the roofs there are at the stair's level
// or under it, and fall away from it (a roof x metres out stands at most `roofCap` high): the stair is open to
// the river
export const CARVE = { x0: -20, x1: STAIR_X - 1.5, z0: 7, z1: 33 };
export const inCarve = (x, z) => x > CARVE.x0 && x < CARVE.x1 && z > CARVE.z0 && z < CARVE.z1;
export const roofCap = (x, z) => stairY(z) - 0.25 - 0.13 * Math.max(0, CARVE.x1 - x);

// ---- the teacher's house (courtHouse.js): a courtyard house of Ur's kind, two storeys round a deep court, its
// door on the way up just before the stair's foot; its outline follows the lanes (the way up's south side, the
// temple lane's west), square. Its floor level; under it the ground is filled up to it (a podium,
// high on the downhill side). Across the lane from its door, at the stair's foot, the little square (COURT_SQUARE):
// the leftover hollow there and the low houses beside it filled up to the lane's level, a parapet round its open
// sides, a wayside shrine in its corner ----
// (its lane side straight now, as the lane is: the three points on its north side in one line)
export const COURT_HOUSE = { floor: 8.5, outline: [[8.75, 34.0], [3.79, 34.0], [-1.85, 34.0], [-1.85, 48.4], [8.75, 48.4]] };
export const COURT_SQUARE = [[2.9, 27.4], [8.8, 27.4], [8.8, 30.6], [2.9, 30.6]];
// (and behind it, at its west end, the plot where a pomegranate grew in a bed: one with the square now, a broad L,
// the tree's shade over a mat)
export const COURT_SQUARE_BACK = [[2.0, 24.5], [5.5, 24.5], [5.5, 27.45], [2.0, 27.45]];
// (and the house's yard against its west wall, open to the lane on its north: a level floor of trodden earth at
// the lane's height where it opens on it, a tree, pots, jars, tablets drying)
export const COURT_YARD = { y: 6.4, outline: [[-1.85, 33.6], [-1.85, 38.4], [-4.95, 38.4], [-4.95, 33.6]] };
export const inCourtYard = (x, z, pad = 0) => polySigned(x, z, COURT_YARD.outline) > -pad;
export const inCourtHouse = (x, z, pad = 0) => polySigned(x, z, COURT_HOUSE.outline) > -pad;
// (the square, and for the town's plan the yard with it: both open ground)
export const inCourtSquare = (x, z, pad = 0) => polySigned(x, z, COURT_SQUARE) > -pad || polySigned(x, z, COURT_SQUARE_BACK) > -pad || polySigned(x, z, COURT_YARD.outline) > -pad;
// (and its floor out to the houses' walls round it: on its west the strip between the house there and its edge,
// open ground, was left on the slope, a pit)
const inRects = (rs, x, z) => rs.some((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1);
const SQUARE_FILL = [{ x0: 1.7, x1: 2.95, z0: 24.4, z1: 30.65 }];
export const inSquareFill = (x, z) => inRects(SQUARE_FILL, x, z);
// (and in the ground's mesh only, its points a metre apart, on under the walls to the next row of them: the mesh
// drawn between a point on the floor and one on the slope below or the bank above sloped across the edge, a pit
// along the houses' walls, a bank of earth against the stair's parapet; under the walls one does not see it. Not in
// the ground itself: the houses' heights are taken from it)
const SQUARE_MESH_FILL = [{ x0: 0.9, x1: 6.1, z0: 23.9, z1: 27.45 }, { x0: 0.9, x1: 9.1, z0: 26.9, z1: 30.65 }];
// (and at the stair's foot, where its two lowest treads went (hillTown.js), the mesh kept under the paving carried
// over them)
const MESH_UNDER = [{ x0: 8.9, x1: 12.1, z0: 29.9, z1: 31.1, y: 8.45 }];
export const meshGround = (x, z, h) => {
  for (const r of MESH_UNDER) if (inRects([r], x, z)) h = Math.min(h, r.y);
  if (!inRects(SQUARE_MESH_FILL, x, z)) return h;
  // (not on the curved lane; under the stair's parapet, though, by the stair)
  const l = laneAt(x, z);
  return l.lane === LANES[0] && l.d <= LANES[0].w / 2 ? h : (squareY ??= curveY(5.85, 29.0));
};
// the curved lane's height across from (x, z) (where it runs past the square)
let squareY = null;
function curveY(x, z) {
  const l = LANES[0];
  let best = { d: Infinity, y: 0 };
  for (let i = 0; i < l.pts.length - 1; i++) {
    const a = l.pts[i], b = l.pts[i + 1], dx = b.x - a.x, dz = b.z - a.z;
    const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz));
    const d = Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
    if (d < best.d) best = { d, y: a.y + (b.y - a.y) * t };
  }
  return best.y;
}

// ---- the temple's weavers' house (workshop.js), on its terrace in the corner by the stair: its enclosure, outside
// to outside. It is laid out (workshop.js) where it first stood, its gate south on the processional way (FRAME),
// then moved west against the steps up from the stair and turned a quarter round, its gate facing west towards
// them and the river: workshopAt maps a point of the one onto the other ----
export const WORKSHOP_FRAME = { x0: 21, x1: 39, z0: 21, z1: 40.5 };
export const WORKSHOP = { x0: 16.8, x1: 36.3, z0: 21.5, z1: 39.5 };
const WS_F = [(WORKSHOP_FRAME.x0 + WORKSHOP_FRAME.x1) / 2, (WORKSHOP_FRAME.z0 + WORKSHOP_FRAME.z1) / 2];
const WS_C = [(WORKSHOP.x0 + WORKSHOP.x1) / 2, (WORKSHOP.z0 + WORKSHOP.z1) / 2];
// (south becomes west: a point dx east, dz south of the frame's middle comes dz west and dx south of the new one;
// a direction the same, a heading a quarter less)
export const workshopAt = (x, z) => [WS_C[0] - (z - WS_F[1]), WS_C[1] + (x - WS_F[0])];
export const inWorkshop = (x, z, pad = 0) => x > WORKSHOP.x0 - pad && x < WORKSHOP.x1 + pad && z > WORKSHOP.z0 - pad && z < WORKSHOP.z1 + pad;

// ---- the temple of Enki (temple.js), south of the great stair, its gate west towards the precinct's gateway, its
// cella east towards the ziggurat; and in front of it the Abzu, the pool of sweet water: outside to outside ----
export const TEMPLE_HOUSE = { x0: 36, x1: 64, z0: 64, z1: 84, axis: 74 };
export const inTempleHouse = (x, z, pad = 0) => x > TEMPLE_HOUSE.x0 - 6 - pad && x < TEMPLE_HOUSE.x1 + pad && z > TEMPLE_HOUSE.z0 - 2.6 - pad && z < TEMPLE_HOUSE.z1 + pad;
// ---- local changes to the packed town, each found by a point inside what it changes (hillTown.js)
// ----
export const TOWN_EDITS = {
  // leftover plots cut back: the bed beside the quay's first steps, so the steps can move over (LANES' shift), to
  // their edge
  smallClip: [{ at: [-27.2, 15], z0: 13.5 }],
  // a plot's awning raised (its mat so high over its floor), and the roof behind it reached by two steps
  awning: [{ at: [-14.5, 25.7], rise: 2.75, steps: { x0: -15.75, x1: -13.35, side: 'z1' } }],
  // houses built as one block over their slope, not stepping down it in narrow blocks
  whole: [[7.2, 18], [7.2, 24.7], [6, 7]],
  // openings in houses' parapets: on the roof beside the awning, and on the roof under the stair, from the stair
  parapetGap: [{ at: [-15.5, 31], side: 'z0', from: -15.9, to: -13.2 }, { at: [6, 7], side: 'x1', from: 3.6, to: 7.2 }],
  // the stair's parapet left out over z from..to, steps down from it onto that roof, across all of it from its
  // north parapet (the slope of earth beside them went); on that roof an arbour (x0, x1, z0, z1), not its washing
  stairGap: [{ z0: 3.6, z1: 7.2, roof: [6, 7], arbour: [4.0, 7.0, 7.6, 10.1] }],
  // trees on roofs: on the one behind the awning, on the white roof seen from the way up past the yard, and three
  // seen from the stair's head up the climb
  roofTrees: [{ at: [-16.4, 30.6], kind: 'pomegranate', s: 0.8 }, { at: [-8.0, 37.0], kind: 'fig', s: 0.75 },
    { at: [12.5, -3.2], kind: 'fig', s: 0.8 }, { at: [23.4, 0.9], kind: 'pomegranate', s: 0.8 }, { at: [23.0, 5.2], kind: 'fig', s: 0.7 }],
  // a house by the top's square made two storeys at one end (split: across it at z, high: which end), the other end
  // its terrace, reached by a stair along its back (side) from the square, climbing from foot to top (z)
  upperRoom: [{ at: [20, -9], split: { z: -9.5, high: 'z1' }, stair: { side: 'x1', foot: -5.6, top: -11.6, w: 0.95 } }],
  // houses by the top's square resized: in its north-west and north-east corners the end of a house showed between
  // its neighbours, two or three metres of it, a door squeezed in; drawn back behind them, the next house along
  // widened over it to the corner
  resize: [{ at: [20, -29], x1: 22 }, { at: [28, -29], x0: 22 }, { at: [41, -29], x0: 42 }, { at: [35, -29], x1: 42 }],
  // houses on the top's square: an upper room over part of the roof up an outside stair given (upper: true) or taken
  // away (false); side: that room beside its terrace, its front in line with the house's, not behind the terrace
  squareUpper: [{ at: [44, -21.6], upper: true, side: true }, { at: [26.3, -27.5], upper: false }, { at: [33.0, -27.5], side: true }],
  // single treads left out (lane: its index in LANES, seg: the run's index along it, k: the treads from its foot):
  // at the climb's turn north, the long first tread of the run north, reaching far out over the open ground west
  dropTreads: [{ lane: 2, seg: 3, k: [0] }],
  // trees in the ground, in a low kerbed ring: a small one against the house wall beside the quay's first steps, in
  // front of the awning over its door; another on the square by the door under the south house's stair landing
  groundTrees: [{ at: [-28.4, 9.35], kind: 'pomegranate', s: 0.7 }, { at: [26.5, -2.15], kind: 'pomegranate', s: 0.6 }],
  // a band of cone mosaic the length of a blank wall (side: which of its faces), high on it, half its own height
  // left plain over it to the parapet's top: on the house north of the lane's last run, facing it; on the back of the
  // house south of the top's square, facing the square
  mosaic: [{ at: [-1, 30], side: 'z1', h: 0.9, design: 0 }, { at: [25, -1.0], side: 'z0', h: 0.9, design: 1 }],
};

// the temple's storehouse and its kitchen yard, north of the great stair, east of the weavers' house (temple.js)
export const STOREHOUSE = { x0: 38.5, x1: 64, z0: 18.2, z1: 28 };
export const KITCHEN = { x0: 38.5, x1: 63, z0: 31, z1: 45.4 };
const inRect = (r, x, z, pad) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
export const inTempleYard = (x, z, pad = 0) => inRect(STOREHOUSE, x, z, pad) || inRect(KITCHEN, x, z, pad);
export const ABZU = { x0: 18.5, x1: 29.5, z0: 69, z1: 79, floor: PRECINCT.y - 0.8, water: PRECINCT.y - 0.2 };
export const inAbzu = (x, z, pad = 0) => x > ABZU.x0 - pad && x < ABZU.x1 + pad && z > ABZU.z0 - pad && z < ABZU.z1 + pad;

// where houses stand: on the mound, back from the quay, not on the temple's terrace, round the way up
export function inTown(x, z) {
  const n = (fbm(x * 0.06, z * 0.06, 2, 77) - 0.5) * 6;
  if (x < -28 + n * 0.5 || z < -46 + n || z > (x > -14 ? 66 : 46) + n) return false;
  if (x > 66 + n) return false;
  if (x > PRECINCT.x0 - 0.2 && z > PRECINCT.z0) return false;
  return inMound(x, z, 1);
}

// the ground with the way on it: the lanes cut level across, the courtyard flat, the ground below the stair let
// down
export function townGround(x, z, h) {
  // (under the temple and the paving before it, the terrace's ground kept below their floors)
  if (inTempleHouse(x, z, 0.6) || inAbzu(x, z, 1.4)) h = Math.min(h, PRECINCT.y - 0.06);
  if (x < -40 || x > 90 || z < -60 || z > 80) return h;
  // (below the stair)
  const kc = smooth(CARVE.x0 - 4, CARVE.x0, x) * smooth(CARVE.x1 + 0.6, CARVE.x1, x) * smooth(CARVE.z0 - 3, CARVE.z0, z) * smooth(CARVE.z1 + 3, CARVE.z1, z);
  if (kc > 0) h -= kc * Math.max(0, h - (roofCap(x, z) - 3.2));
  const l = laneAt(x, z);
  if (l.d < l.lane.w / 2 + 3) h += (l.y - h) * smooth(l.lane.w / 2 + (l.lane.stair ? 0.6 : 3), l.lane.w / 2 + 0.3, l.d);
  // (under the steps up onto the temple's terrace, the ground no higher than the way beside them)
  const TS = TEMPLE_STEPS;
  if (x > TS.x0 - 0.5 && x < TS.x1 + 0.6 && z > TS.z0 && z < TS.z1) h = Math.min(h, laneAt(STAIR_X, z).y - 0.05);
  const dp = Math.max(PLAZA.x0 - x, x - PLAZA.x1, PLAZA.z0 - z, z - PLAZA.z1);
  if (dp < 2.5) h += (PLAZA.y - h) * smooth(2.5, 0, dp);
  // (the teacher's house: the ground inside its walls kept under its floor; the square filled to the lane)
  if (inCourtHouse(x, z, -0.2)) h = Math.min(h, COURT_HOUSE.floor - 0.05);
  if (inCourtYard(x, z) && laneAt(x, z).d > LANES[0].w / 2) h = COURT_YARD.y - 0.06;
  // (the little square and the plot behind it level, at the lane's height across from the square's middle: one
  // floor for the mat under the tree, the shrine and the way past)
  else if ((inCourtSquare(x, z) || inRects(SQUARE_FILL, x, z)) && laneAt(x, z).d > LANES[0].w / 2) h = (squareY ??= curveY(5.85, 29.0));
  // (the Abzu's basin let into the terrace, under its brick floor)
  if (inAbzu(x, z, -0.3)) h = ABZU.floor - 0.1;
  return h;
}

// ---- the far side: the Euphrates' east branch out on the plain to the east (the river ran in several across
// the plain), and a canal led off it towards the town ----
// (north of the walk, past z -1050, it bends away north-east rather than running into the main river)
const euBend = (z) => { const r = Math.max(0, -1050 - z); return (0.8 * r * r) / (r + 500); };
export const EAST_BRANCH = { half: 75, x: (z) => 380 + 0.3 * z + 40 * Math.sin(z / 230) + euBend(z) };
export const CANAL = [[96, -46], [170, -60], [250, -55], [EAST_BRANCH.x(-58) - EAST_BRANCH.half + 4, -58]];
// (from the lookout, within this bearing of due east, nothing tall stands beyond SHORT metres: the river shows)
export const VIEW_EAST = { half: 0.6, short: 110 };
// the temple's terrace inside its walls: one walks there, and up the ziggurat
// (and the steps up onto it from the way along its west side, in place of its wall there: hillTown.js)
export const TEMPLE_STEPS = { x0: STAIR_X + 1.6, x1: STAIR_X + 1.6 + 6 * 0.32, z0: 28.2, z1: TEMPLE_GATE.z - TEMPLE_GATE.half - 1.8, n: 6, tread: 0.32 };
export const inPrecinct = (x, z) => (x > PRECINCT.x0 + 1.4 && x < PRECINCT.x1 - 1.3 && z > PRECINCT.z0 + 1.4 && z < PRECINCT.z1 - 1.3) || inOuter(x, z)
  || (x > TEMPLE_STEPS.x0 - 0.2 && x < PRECINCT.x0 + 1.5 && z > TEMPLE_STEPS.z0 && z < TEMPLE_STEPS.z1);
export const inViewEast = (x, z) => {
  const dx = x - LOOKOUT.x, dz = z - LOOKOUT.z;
  return dx > 0 && Math.abs(Math.atan2(dz, dx)) < VIEW_EAST.half && Math.hypot(dx, dz) > VIEW_EAST.short;
};
