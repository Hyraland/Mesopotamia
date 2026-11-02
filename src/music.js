// The music: made here as it sounds (no recording), with the instruments of the
// time and the lyre's tunings as the tablets give them; not any song of theirs: music for the place, slow and
// wide, as for a film of it.
//
// The instruments: a lyre of nine gut strings, low (string 1 the B below the bass staff's middle), plucked (a
// string's sound made by Karplus and Strong's way: a burst of noise running round a delay of one period, softened
// each time round, as a gut string loses its brightness first), through a wooden body; strings 1 to 7 a scale, 8
// and 9 strings 1 and 2 an octave up. The long-necked lute (the gišgudi: on seals and clay plaques of the time),
// brighter, plucked fast on a held note (a tremolo). The reed pipes (the embūbu): a double pipe, one holding a
// drone, one the tune, with breath in them and a vibrato on long notes. A frame drum (the adapu). The temple's great
// drum (the lilissu, a kettle drum, bronze, its skin a bull's): a deep boom felt more than heard.
//
// The tunings: the tablets from Ur and Nippur (UET VII 126, CBS 10996, UET VII 74) name fourteen pairs of strings,
// seven of them fifths and fourths (nīš tuḫrim 1–5, išartum 2–6, embūbum 3–7, nīd qablim 4–1, qablītum 5–2,
// kitmum 6–3, pītum 7–4), seven thirds and sixths (šērum 7–5, šalšatum 1–6, rebûttum 2–7, isqum 1–3, titur
// qablītim 2–4, titur išartim 3–5, ṣerdum 4–6); the lyre was tuned by its fifths and fourths (so its notes stand as
// a chain of pure fifths: Pythagorean), and from one tuning to the next by tightening one string, through seven
// tunings named after the first seven pairs. Read as most do now: in each tuning the pair before its name in the
// chain is the one left a tritone. So kitmum is our natural minor on string 1, išartum our Phrygian (its second
// string a half step over the first: the bleakest of them). By day the lyre is in kitmum, at dusk and at night in
// išartum; changing the time, it is retuned.
//
// The walk's music: pieces of two or three minutes, each rising and falling: a drone coming in, the lyre alone,
// low; then the lyre's figure over and over (an ostinato, the pairs on its first beats), the frame drum under it,
// the pipe's tune over it; the great drum at the height, the lyre doubled an octave up, the tune higher; and down
// again, to the drone alone. Between pieces a long silence. Slower, sparser and softer at night.
//
// The eagle's music: on E, a piece of its own as long as the flight: a great stroke as it leaves, the figure and
// the drums driving under it down the stair and over the houses, the pipes rising over the ruins and the temples,
// the height as it climbs back over the ziggurat, and a last stroke, ringing out as the eye comes down. Cut short,
// it ends at once on its last stroke. M, or the menu, turns it off and on; the menu sets how loud.

const PY = { 0: 1, 1: 256 / 243, 2: 9 / 8, 3: 32 / 27, 4: 81 / 64, 5: 4 / 3, 7: 3 / 2, 8: 128 / 81, 9: 27 / 16, 10: 16 / 9, 11: 243 / 128 };
// the seven tunings, as semitones above string 1 of strings 1..7 (the 6 in nīš tuḫrim an augmented fourth, in
// qablītum a diminished fifth)
const TUNINGS = {
  isartum: [0, 1, 3, 5, 7, 8, 10], kitmum: [0, 2, 3, 5, 7, 8, 10], embubum: [0, 2, 3, 5, 7, 9, 10], pitum: [0, 2, 4, 5, 7, 9, 10],
  nidQablim: [0, 2, 4, 5, 7, 9, 11], nisTuhrim: [0, 2, 4, 6, 7, 9, 11], qablitum: [0, 1, 3, 5, 6, 8, 10],
};
const ratio = (name, semi) => semi === 6 ? (name === 'nisTuhrim' ? 729 / 512 : 1024 / 729) : PY[semi];
// the pairs (strings, 1-based)
const PAIRS = {
  nisTuhrim: [1, 5], isartum: [2, 6], embubum: [3, 7], nidQablim: [4, 1], qablitum: [5, 2], kitmum: [6, 3], pitum: [7, 4],
  seru: [7, 5], salsatum: [1, 6], rebuttum: [2, 7], isqum: [1, 3], titurQablitim: [2, 4], titurIsartim: [3, 5], serdum: [4, 6],
};
// the lyre's figures, a bar of eight (strings, 0-based; the pair played on the first): low, round string 1, the
// half step over it (in išartum) leaning back down to it
const FIGURES = [
  { pair: 'nisTuhrim', notes: [0, 4, 0, 1, 0, 4, 2, 1] },
  { pair: 'nisTuhrim', notes: [0, 0, 4, 0, 1, 1, 0, 4] },
  { pair: 'salsatum', notes: [0, 2, 4, 2, 1, 2, 0, 4] },
  { pair: 'nidQablim', notes: [0, 4, 3, 4, 1, 4, 0, 4] },
];
// by the time of day: the tuning; beats a minute; the reverb's share; how far the pieces rise (1 the full height);
// the silence between them (seconds)
const MOOD = {
  day: { tuning: 'kitmum', bpm: 66, wet: 0.42, peak: 1, rest: [8, 16] },
  dusk: { tuning: 'isartum', bpm: 58, wet: 0.5, peak: 0.95, rest: [10, 18] },
  night: { tuning: 'isartum', bpm: 50, wet: 0.6, peak: 0.75, rest: [12, 22] },
};
// a piece's shape: how far up it is, bar by bar (0 the drone alone, 1 everything)
const SHAPES = [
  [0.1, 0.1, 0.2, 0.25, 0.35, 0.4, 0.45, 0.5, 0.55, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 1, 1, 1, 1, 0.9, 0.7, 0.55, 0.45, 0.35, 0.25, 0.15, 0.1, 0.05],
  [0.15, 0.2, 0.3, 0.4, 0.5, 0.5, 0.55, 0.6, 0.65, 0.7, 0.6, 0.55, 0.6, 0.7, 0.8, 0.9, 1, 1, 1, 0.95, 0.85, 0.75, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1],
  [0.1, 0.15, 0.25, 0.3, 0.4, 0.45, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 1, 1, 1, 1, 1, 0.8, 0.6, 0.45, 0.4, 0.45, 0.5, 0.4, 0.3, 0.2, 0.1, 0.05],
];
const BASE = 123.47;   // string 1 (B2)

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];

// a string plucked at f (Hz): its sound, made once and kept. bright: how sharp the pluck (a fingertip soft, a
// plectrum bright); sustain: how long it rings (seconds to die away, at string 1); at: where along it is plucked
function pluckBuffer(ctx, f, { bright = 0.55, sustain = 5, at: pos = 0.2 } = {}) {
  const sr = ctx.sampleRate, len = Math.floor(sr * 5), buf = ctx.createBuffer(1, len, sr), y = buf.getChannelData(0);
  const P = sr / f - 0.5;                                  // (the averaging adds half a sample)
  const t60 = sustain * Math.sqrt(BASE / f), g = Math.pow(0.001, 1 / (t60 * f));
  const n = Math.ceil(P) + 2, ex = new Float32Array(n);
  let lp = 0;
  for (let i = 0; i < n; i++) { lp += bright * (Math.random() * 2 - 1 - lp); ex[i] = lp; }
  const at = Math.max(1, Math.round(P * pos));
  let prev = 0, peak = 0;
  for (let i = 0; i < len; i++) {
    let v = i < n ? ex[i] - (i >= at ? ex[i - at] : 0) : 0;
    const d = i - P;
    if (d >= 1) {
      const i0 = Math.floor(d), fr = d - i0, dl = y[i0] * (1 - fr) + y[i0 + 1] * fr;
      v += g * 0.5 * (dl + prev);
      prev = dl;
    }
    y[i] = v;
    peak = Math.max(peak, Math.abs(v));
  }
  for (let i = 0; i < len; i++) y[i] *= 0.8 / peak * Math.min(1, (len - i) / (sr * 0.3));
  return buf;
}

// the air round it: a large open place: a short gap, then seconds of noise dying away, darker as it goes
function impulse(ctx, secs) {
  const sr = ctx.sampleRate, len = Math.floor(sr * secs), buf = ctx.createBuffer(2, len, sr), gap = Math.floor(sr * 0.05);
  for (let c = 0; c < 2; c++) {
    const y = buf.getChannelData(c);
    let lp = 0;
    for (let i = gap; i < len; i++) {
      const t = (i - gap) / (len - gap), k = 0.85 - 0.78 * t;
      lp += k * (Math.random() * 2 - 1 - lp);
      y[i] = lp * Math.pow(1 - t, 2.4) * Math.min(1, (i - gap) / (sr * 0.04));
    }
  }
  return buf;
}
function noiseBuffer(ctx, secs, fall = 0) {
  const len = Math.floor(ctx.sampleRate * secs), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (fall ? Math.pow(1 - i / len, fall) : 1);
  return b;
}

export function createMusic({ on = () => true, volume = () => 0.6 } = {}) {
  let ctx = null, master, dry, wet, lyreBus, cursor = 0, timer = null, time = 'day', tuning = MOOD.day.tuning;
  let piece = null, cue = null, wasOn = true, only = null, pieces = 0;
  const now = () => ctx.currentTime;
  // what is written ahead goes through a section of its own, faded out when the lyre is retuned, the music turned
  // off, or the eagle's music begins (what was written not left to play on)
  let sect = null;
  const allow = (part) => !only || only === part;
  const strings = [];
  const cache = new Map();
  const section = (fade = 0.6) => {
    if (sect) for (const g of Object.values(sect)) { g.gain.setTargetAtTime(0, now(), fade); setTimeout(() => g.disconnect(), 8000); }
    sect = { lyre: ctx.createGain(), dry: ctx.createGain(), wet: ctx.createGain() };
    sect.lyre.connect(lyreBus);
    sect.dry.connect(dry);
    sect.wet.connect(wet);
  };

  const build = (c) => {
    ctx = c;
    master = ctx.createGain();
    master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    master.connect(comp).connect(ctx.destination);
    dry = ctx.createGain();
    wet = ctx.createGain();
    const verb = ctx.createConvolver();
    verb.buffer = impulse(ctx, 5);
    dry.connect(master);
    wet.connect(verb).connect(master);
    // the lyre's wooden body: its two low resonances, its top softened
    lyreBus = ctx.createGain();
    const b1 = ctx.createBiquadFilter(), b2 = ctx.createBiquadFilter(), top = ctx.createBiquadFilter();
    b1.type = b2.type = 'peaking';
    b1.frequency.value = 180; b1.Q.value = 1.2; b1.gain.value = 4;
    b2.frequency.value = 700; b2.Q.value = 1.5; b2.gain.value = 2;
    top.type = 'lowpass'; top.frequency.value = 3600; top.Q.value = 0.5;
    lyreBus.connect(b1).connect(b2).connect(top);
    top.connect(dry);
    top.connect(wet);
    section();
    retune(tuning);
  };
  // the nine strings' pitches in a tuning
  const retune = (name) => {
    tuning = name;
    const semis = TUNINGS[name];
    for (let s = 0; s < 9; s++) strings[s] = BASE * ratio(name, semis[s % 7]) * (s >= 7 ? 2 : 1);
  };
  // a string's pitch (past string 7, on up by octaves; below string 1, down)
  const pitch = (s) => {
    const o = Math.floor(s / 7), k = ((s % 7) + 7) % 7;
    return strings[k] * Math.pow(2, o);
  };
  const both = (node) => { node.connect(sect.dry); node.connect(sect.wet); };

  // ---- the instruments ----
  const sample = (f, vel, kind) => {
    const key = `${kind}${f.toFixed(2)}`;
    if (!cache.has(key)) cache.set(key, pluckBuffer(ctx, f, kind === 'lute' ? { bright: 0.85, sustain: 1.6, at: 0.12 } : {}));
    const src = ctx.createBufferSource(), g = ctx.createGain(), pan = ctx.createStereoPanner();
    src.buffer = cache.get(key);
    src.playbackRate.value = Math.pow(2, rand(-3, 3) / 1200);   // (no string quite as tuned)
    g.gain.value = vel;
    return { src, g, pan };
  };
  const pluck = (s, t, vel = 1) => {
    if (!allow('lyre')) return;
    const { src, g, pan } = sample(pitch(s), 0.5 * vel, 'lyre');
    pan.pan.value = Math.max(-0.4, Math.min(0.4, (s / 9 - 0.4) * 0.6));
    src.connect(g).connect(pan).connect(sect.lyre);
    src.start(t + rand(-0.01, 0.01));
  };
  // a pair: both strings at once, or the lower a little first (strummed); up: strings up (7 an octave)
  const pair = (name, t, vel = 1, broken = false, up = 0) => {
    const [a, b] = PAIRS[name];
    pluck(a - 1 + up, t, vel);
    pluck(b - 1 + up, t + (broken ? rand(0.05, 0.1) : 0.02), vel * 0.85);
  };
  // the lute: a note an octave over the string, plucked once, or fast and dying on a held one
  const lute = (s, t, dur, vel = 1) => {
    if (!allow('lute')) return;
    const f = pitch(s) * 2, n = dur > 0.9 ? Math.floor(dur / 0.1) : 1;
    for (let k = 0; k < n; k++) {
      const { src, g, pan } = sample(f, 0.3 * vel * (1 - 0.5 * k / Math.max(n, 1)), 'lute');
      pan.pan.value = 0.3;
      src.connect(g).connect(pan);
      both(pan);
      src.start(t + k * (0.1 + rand(-0.007, 0.007)));
    }
  };
  // the great drum: the skin's deep fall, a second mode over it, the stroke's thud
  const great = (t, vel = 1) => {
    if (!allow('drum')) return;
    for (const [f0, f1, a, d] of [[78, 42, 0.62, 2.6], [118, 70, 0.22, 0.7]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + 0.35);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(a * vel, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.001, t + d);
      o.connect(g);
      both(g);
      o.start(t);
      o.stop(t + d + 0.1);
    }
    const n = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), ng = ctx.createGain();
    n.buffer = noiseBuffer(ctx, 0.18, 3);
    lp.type = 'lowpass'; lp.frequency.value = 600;
    ng.gain.value = 0.45 * vel;
    n.connect(lp).connect(ng);
    both(ng);
    n.start(t);
  };
  // the frame drum: a low stroke in its middle (dum), a dry one at its rim (tak)
  const frame = (t, dum, vel = 1) => {
    if (!allow('drum')) return;
    if (dum) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(120, t);
      o.frequency.exponentialRampToValueAtTime(72, t + 0.1);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.2 * vel, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      o.connect(g);
      both(g);
      o.start(t);
      o.stop(t + 0.45);
    }
    const n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
    n.buffer = noiseBuffer(ctx, 0.06, 4);
    bp.type = 'bandpass'; bp.frequency.value = dum ? 700 : 1700; bp.Q.value = 1.3;
    ng.gain.value = (dum ? 0.07 : 0.1) * vel;
    n.connect(bp).connect(ng);
    both(ng);
    n.start(t);
  };
  // a reed pipe playing notes [{ s, d (seconds), loud }] from t, legato, sliding into each; breath in it; a
  // vibrato growing through the long ones. level: how loud
  const pipe = (t, notes, level = 1) => {
    if (!allow('pipe')) return;
    const total = notes.reduce((a, n) => a + n.d, 0);
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), vib = ctx.createOscillator(), vg = ctx.createGain();
    o1.type = 'sawtooth'; o2.type = 'triangle';
    vib.frequency.value = 5.3;
    vib.connect(vg);
    vg.connect(o1.detune); vg.connect(o2.detune);
    vg.gain.value = 0;
    const mix = ctx.createGain(), lp = ctx.createBiquadFilter(), body = ctx.createBiquadFilter(), env = ctx.createGain(), pan = ctx.createStereoPanner();
    mix.gain.value = 0.5;
    lp.type = 'lowpass'; lp.frequency.value = 2200; lp.Q.value = 0.6;
    body.type = 'peaking'; body.frequency.value = 1250; body.Q.value = 1.6; body.gain.value = 6;
    pan.pan.value = -0.2;
    o1.connect(mix); o2.connect(mix);
    mix.connect(lp).connect(body).connect(env).connect(pan);
    both(pan);
    const br = ctx.createBufferSource(), bbp = ctx.createBiquadFilter(), bg = ctx.createGain();
    br.buffer = noiseBuffer(ctx, 2);
    br.loop = true;
    bbp.type = 'bandpass'; bbp.frequency.value = 1800; bbp.Q.value = 0.9;
    bg.gain.value = 0.18;
    br.connect(bbp).connect(bg).connect(env);
    const L = 0.11 * level;
    env.gain.setValueAtTime(0, t);
    let at = t;
    notes.forEach((n, i) => {
      const f = pitch(n.s) * 2;
      if (i === 0) { o1.frequency.setValueAtTime(f, at); o2.frequency.setValueAtTime(f * 1.002, at); }
      else { o1.frequency.setTargetAtTime(f, at, 0.04); o2.frequency.setTargetAtTime(f * 1.002, at, 0.04); }
      env.gain.setTargetAtTime(L * (n.loud ?? 1), at, i === 0 ? 0.15 : 0.05);
      vg.gain.setTargetAtTime(0, at, 0.04);
      if (n.d > 0.9) vg.gain.setTargetAtTime(22, at + 0.3, n.d * 0.35);
      at += n.d;
    });
    env.gain.setTargetAtTime(0, at - 0.4, 0.2);
    for (const x of [o1, o2, vib, br]) { x.start(t); x.stop(t + total + 1.2); }
  };
  // the drone: string 1 and its fifth held low (the double pipe's other reed), its loudness following the music's
  // height bar by bar (levels: [time, 0..1]); from t to end
  const drone = (t, end, levels) => {
    if (!allow('drone')) return;
    const env = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 600; lp.Q.value = 0.6;
    lp.connect(env);
    both(env);
    env.gain.setValueAtTime(0, t);
    for (const [at, v] of levels) env.gain.setTargetAtTime(0.025 + 0.06 * v, at, 1.2);
    env.gain.setTargetAtTime(0, end - 2, 0.8);
    for (const [f, a] of [[pitch(0), 0.5], [pitch(4), 0.3], [pitch(0) * 1.004, 0.4], [pitch(0) / 2, 0.35]]) {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.value = f;
      og.gain.value = a;
      o.connect(og).connect(lp);
      o.start(t);
      o.stop(end + 0.5);
    }
  };

  // ---- the music ----
  // a tune for two bars: long notes, mostly by step, from the middle strings; ending on string 1 (close) or held
  // open on the fifth; high: an octave up
  const tune = (beat, high, close) => {
    const notes = [];
    let s = pick([4, 3, 5]) + (high ? 7 : 0), left = 8;
    const lens = pick([[3, 1, 2, 2], [2, 2, 3, 1], [4, 1, 1, 2], [1.5, 0.5, 2, 4], [3, 1, 1, 1, 2]]);
    lens.forEach((b, i) => {
      if (i === lens.length - 1) s = (close ? pick([0, 0, 4]) : 4) + (high ? 7 : 0);
      else if (i > 0) s += pick([-1, -1, 1, 1, -2, 2, 0]);
      notes.push({ s, d: beat * Math.min(b, left), loud: i === 0 ? 1 : 0.92 });
      left -= b;
    });
    return notes;
  };
  // one bar from t at height h (0..1), the figure fig, the bar's number k: what each part plays
  const bar = (t, beat, h, fig, k, tuneState) => {
    const e = beat / 2;
    // the lyre: a pair or a string now and then, low; from a third up the figure, then doubled an octave up
    if (h < 0.3) {
      if (k % 2 === 0) pair(fig.pair, t, 0.55 + h, true);
      else if (Math.random() < 0.6) pluck(pick([0, 4, 2]), t + beat * pick([0, 2]), 0.5);
    } else {
      fig.notes.forEach((s, i) => {
        const vel = (i === 0 ? 0.95 : i === 4 ? 0.8 : 0.6) * (0.7 + 0.3 * h);
        if (i === 0) pair(fig.pair, t, vel, false);
        else pluck(s, t + i * e, vel);
        if (h > 0.8 && i % 2 === 0) pluck(s + 7, t + i * e + 0.01, vel * 0.55);
      });
    }
    // the frame drum: from halfway, dum on the beats' heads, taks between; fuller near the top
    if (h >= 0.45) {
      const pat = h > 0.8 ? [1, 0, 2, 0, 1, 2, 0, 2] : [1, 0, 0, 2, 1, 0, 2, 0];
      pat.forEach((p, i) => { if (p) frame(t + i * e, p === 1, (i === 0 ? 1 : 0.7) * (0.6 + 0.4 * h)); });
    }
    // the great drum: at the height, on the bar's head (and its middle, at the very top)
    if (h >= 0.85) {
      great(t, 0.75 + 0.25 * h);
      if (h >= 0.98) great(t + beat * 2, 0.6);
    }
    // the pipe: a tune every two bars, from halfway up; higher at the top; the lute trembling with its long notes
    if (h >= 0.5 && k % 2 === 0) {
      const notes = tune(beat, h >= 0.9, tuneState.n++ % 2 === 1);
      pipe(t, notes, 0.8 + 0.3 * h);
      if (h >= 0.65) {
        let at = t;
        for (const n of notes) { if (n.d > beat * 1.4) lute(n.s - (h >= 0.9 ? 7 : 0), at, n.d, 0.9); at += n.d; }
      }
    }
  };
  const startPiece = (t) => {
    const m = MOOD[time], beat = 60 / m.bpm;
    const shape = pick(SHAPES).map((h) => h * m.peak);
    pieces++;
    piece = { beat, shape, fig: pick(FIGURES), k: 0, tuneState: { n: 0 } };
    drone(t, t + shape.length * beat * 4 + 4, shape.map((h, i) => [t + i * beat * 4, h]));
  };

  const tick = () => {
    if (!ctx || ctx.state !== 'running' || !on() || cue) return;
    advance(ctx.currentTime);
  };
  // the walk's music written on to a little past t
  const advance = (t) => {
    if (cursor < t + 0.3) cursor = t + 0.3;
    while (cursor < t + 1.5) {
      if (!piece) startPiece(cursor);
      const p = piece;
      bar(cursor, p.beat, p.shape[p.k], p.fig, p.k, p.tuneState);
      cursor += p.beat * 4;
      if (++p.k >= p.shape.length) {
        piece = null;
        cursor += p.beat * 4 + rand(...MOOD[time].rest);
      }
    }
  };
  const level = () => {
    if (!ctx) return;
    master.gain.setTargetAtTime(on() ? volume() : 0, now(), 0.4);
    const m = MOOD[time];
    wet.gain.setTargetAtTime(m.wet * 1.4, now(), 1);
    dry.gain.setTargetAtTime(0.95 - m.wet * 0.5, now(), 1);
  };

  // ---- the eagle's music ----
  // its shape: ten bars, as long as the flight: the stroke as it leaves; down the stair and over the houses; the
  // ruins; the temples; the climb back over the ziggurat; then the last stroke (at the flight's end)
  const CUE = [0.75, 0.6, 0.65, 0.7, 0.8, 0.85, 0.9, 0.95, 1, 1];
  const startCue = (secs) => {
    if (!ctx || !on()) return;
    section(0.3);
    piece = null;
    const t = now() + 0.05, beat = secs / (CUE.length * 4);
    cue = { beat, timer: null };
    // the stroke as it leaves: the great drum (twice, the second softer), the low pair, the pipe's call
    great(t, 1);
    great(t + 0.18, 0.45);
    pair('nisTuhrim', t, 1, false);
    drone(t, t + secs + 8, CUE.map((h, i) => [t + i * beat * 4, h]));
    const fig = FIGURES[0], ts = { n: 0 };
    CUE.forEach((h, k) => { if (k > 0) bar(t + k * beat * 4, beat, h, fig, k, ts); });
    pipe(t + 0.3, [{ s: 4, d: beat * 2 }, { s: 5, d: beat * 0.5 }, { s: 4, d: beat * 1.5 }], 1.2);
    // (its end comes with the flight's, landed(); this only if that never comes)
    cue.timer = setTimeout(() => endCue(false), (secs * 2 + 10) * 1000);
  };
  // its end: the last stroke and the low pair (and its octave) ringing out, the lute trembling, the pipe on
  // string 1; cut short, the rest of it dropped first
  const endCue = (cut) => {
    if (!cue || !ctx) return;
    clearTimeout(cue.timer);
    const b = cue.beat;
    cue = null;
    if (cut) section(0.25);
    const t = now() + 0.05;
    great(t, 1);
    great(t + b * 2, 0.5);
    pair('nisTuhrim', t, 1, false);
    pair('nisTuhrim', t + 0.02, 0.6, false, 7);
    lute(0, t, 2.4, 0.9);
    pipe(t, [{ s: 0, d: 4 }], 1.1);
    if (cut) drone(t, t + 8, [[t, 0.8]]);
    // the walk's music again after a while
    cursor = t + 14;
  };

  // the browser lets sound start only after one presses something: build it then
  const wake = () => {
    if (!ctx) build(new AudioContext());
    if (ctx.state !== 'running') ctx.resume();
    level();
    if (!timer) timer = setInterval(tick, 200);
  };
  for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, wake, { capture: true });

  // the time of day (day, dusk, night): its tuning (the lyre retuned, after a pause), its pace
  const toTime = (name) => {
    if (!MOOD[name] || name === time) return;
    time = name;
    retune(MOOD[name].tuning);
    if (!ctx || cue) return;
    section();
    piece = null;
    cursor = now() + 3;
    level();
  };

  return {
    setTime: toTime,
    // the menu's or M's change
    apply() {
      // (turned off: what was written ahead dropped, so turning it on again starts afresh)
      if (ctx && wasOn && !on()) { section(); piece = null; if (cue) { clearTimeout(cue.timer); cue = null; } cursor = 0; }
      wasOn = on();
      level();
      if (ctx && on()) cursor = Math.max(cursor, ctx.currentTime + 0.5);
    },
    // the eagle's flight: its music, secs long; and its end (cut: cut short)
    flight(secs) { startCue(secs); },
    landed(cut) { endCue(cut); },
    get tuning() { return tuning; },
  };
}
