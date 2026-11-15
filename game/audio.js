// Sound effects, synthesised with the Web Audio API — no audio files.
// Every sound is a few oscillators / a noise burst through a gain envelope.
// Browsers only allow sound after a tap, so the context is created lazily on the
// first play() that follows user input.

import { createClock } from './music/clock.js';
import { SCORE, chordMix, arpAt, LAYERS, layerAt } from './music/score.js';
import { creakSamples } from './music/creak.js';
import { splashSize } from './fx/splash.js';

/**
 * The one music clock (spec ch.12): visual animation may lock to its beat via
 * musicClock.pulse(nowSeconds()); gameplay never does. Runs even when muted.
 */
export const musicClock = createClock();
export const nowSeconds = () => performance.now() / 1000;

const MUTE_KEY = 'sll_muted';
let ctx = null, master = null, noiseBuf = null;
const creaks = [];
let muted = (() => { try { return window.localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } })();

export const isMuted = () => muted;
export function setMuted(on) {
    muted = !!on;
    try { window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* storage blocked */ }
    if (master) master.gain.value = muted ? 0 : VOLUME;
}

const VOLUME = 0.5;
/**
 * Master bus (mix check 2026-11-14: every area measured -42 LUFS, far too quiet for a phone speaker, where
 * mobile games sit around -23 to -16): a gentle compressor holds the peaks, make-up gain lifts the whole
 * mix. Target: music about -28 LUFS, nothing over -1 dBTP.
 */
const MASTER = { threshold: -20, knee: 8, ratio: 4, attack: 0.004, release: 0.25, makeup: 3.2,
    limit: { threshold: -4, ratio: 20, attack: 0.001, release: 0.12 } };      // the last stage: peaks held under about -1 dBFS
// Fallback when play('coin') is called without a streak note: C major pentatonic.
const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51];

/**
 * Recorded sounds (CC0, _ref/cc0/<name>/SOURCE): fetched and decoded once when audio starts; until
 * then, or if a file is missing, the synthesized version plays instead. Paths are relative (base per branch).
 */
// Real recordings (CC0; sources in public/sfx/CREDITS.txt); each sound falls back to its code-made version while a file is missing.
const SAMPLE_FILES = {
    splash_a: 'sfx/splash_a.mp3', splash_b: 'sfx/splash_b.mp3',
    coin_glass: 'sfx/coin_glass.mp3',      // a tapped wine bottle (earshot: "a glass ting" z +4.1), rings at about 2104 Hz
    nest_chord: 'sfx/nest_chord.mp3',      // a glockenspiel chord ("a small bell" / "a success chime")
    boom_thunder: 'sfx/boom_thunder.mp3',  // distant thunder for the eruption ("a distant thunder boom")
    // Animal calls (user: "make sounds match animal type"): real recordings, the heralds and the whale and dolphins use them.
    call_sea_lion: 'sfx/call_sea_lion.mp3', call_seal: 'sfx/call_seal.mp3', call_dugong: 'sfx/call_dugong.mp3',
    call_otter: 'sfx/call_otter.mp3', call_dolphin: 'sfx/call_dolphin.mp3', call_whale: 'sfx/call_whale.mp3'
};
/** Gains and pitch of the recordings, set from earshot measurements (LUFS of the file -> the code-made sound's level). */
const REAL = {
    coin: { gain: 0.093, hz: 2104, octaves: 2 },   // measured through the master: -23.6 LUFS like the old coin; two octaves above the melody note
    nest: { gain: 0.65 },                          // about -20 LUFS through the master (rare, may stand out a little)
    boom: { gain: 0.39 },
    call: { gain: 0.11 },                          // a herald's animal call: soft and a little far off (about -24 LUFS)
    whale: { gain: 0.072 },                        // the humpback's call, about -20 LUFS through the mix
    dolphin: { gain: 0.06 }                        // a dolphin's whistle, about -26 LUFS through the mix                           // about -18 LUFS through the master
};
/** The recorded splash's gain from a gentle plop to a full dive (under the master's make-up: the top stays under -1 dBFS). */
const SPLASH_SAMPLE = { gain: [0.12, 0.34] };
const samples = {};
function loadSamples() {
    for (const [name, url] of Object.entries(SAMPLE_FILES)) {
        fetch(url).then(r => (r.ok ? r.arrayBuffer() : Promise.reject(r.status)))
            .then(b => ctx.decodeAudioData(b)).then(buf => { samples[name] = buf; })
            .catch(() => { /* missing: the synthesized sound stays */ });
    }
}

/** Play a recorded sound: gain, playback rate (pitch). False when it is not loaded. */
function playSample(name, gain = 1, rate = 1, at = 0) {
    const buf = samples[name];
    if (!buf) return false;
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = buf; src.playbackRate.value = rate; g.gain.value = gain;
    src.connect(g).connect(master);
    src.start(ctx.currentTime + at);
    return true;
}

/**
 * The ghost ship's creaks are worked out in JavaScript (music/creak.js), which costs tens of ms each
 * on a slow phone: measured as a 1.5 s freeze when the first one was made on arriving at the ship.
 * So they are made ahead, one at a time with pauses, right after the sound starts (the title and the
 * story are on screen then), and at half the sample rate, which a low wooden groan does not need more of.
 */
const CREAKS = { count: 3, firstMs: 2500, everyMs: 1200, rate: 0.5 };
function prepareCreaks() {
    const sr = Math.max(8000, Math.round(ctx.sampleRate * CREAKS.rate));
    for (let i = 0; i < CREAKS.count; i++) {
        setTimeout(() => {
            const d = creakSamples(sr, 0.9 + Math.random() * 0.6), buf = ctx.createBuffer(1, d.length, sr);
            buf.getChannelData(0).set(d);
            creaks.push(buf);
        }, CREAKS.firstMs + i * CREAKS.everyMs);
    }
}

function ready() {
    if (muted) return false;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    if (!ctx) {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = VOLUME;
        const comp = ctx.createDynamicsCompressor(), makeup = ctx.createGain();
        comp.threshold.value = MASTER.threshold; comp.knee.value = MASTER.knee; comp.ratio.value = MASTER.ratio;
        comp.attack.value = MASTER.attack; comp.release.value = MASTER.release; makeup.gain.value = MASTER.makeup;
        // Last, a limiter: the compressor's attack lets sharp onsets through, and the make-up gain lifted them over 0 dBFS (earshot 2026-11-15: the eruption and a full splash clipped).
        const lim = ctx.createDynamicsCompressor(), L = MASTER.limit;
        lim.threshold.value = L.threshold; lim.knee.value = 0; lim.ratio.value = L.ratio; lim.attack.value = L.attack; lim.release.value = L.release;
        master.connect(comp).connect(makeup).connect(lim).connect(ctx.destination);
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        loadSamples();
        prepareCreaks();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx.state !== 'closed';
}

/** One enveloped oscillator note. Frequencies may glide from `f` to `to`. */
function tone({ f, to = f, type = 'sine', at = 0, dur = 0.15, vol = 0.3, rise = 0.012 }) {
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (to !== f) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + rise);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
}

/** A burst of filtered noise (splashes, whooshes). */
function noise({ at = 0, dur = 0.3, vol = 0.3, from = 1200, to = 300, q = 0.8 }) {
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf;
    filter.type = 'bandpass';
    filter.Q.value = q;
    filter.frequency.setValueAtTime(from, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
}

/**
 * The crackle of a splash, made once: overlapping grains of noise, each a tiny drop that decays in a
 * few ms; dense at the start, thinning out as the water settles (about 0.75 s).
 */
let SPLASH_BUF = null;
function splashBuffer() {
    if (SPLASH_BUF) return SPLASH_BUF;
    const sr = ctx.sampleRate, n = Math.round(sr * 0.75), buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
    let next = 0;
    for (let i = 0; i < n; i++) {
        const u = i / n;
        if (i >= next) {
            const swell = Math.min(1, u / 0.06), len = Math.round(sr * (0.004 + Math.random() * 0.016)), amp = swell * (1 - u) ** 1.3 * (0.3 + Math.random() * 0.7);
            for (let j = 0; j < len * 4 && i + j < n; j++) d[i + j] += (Math.random() * 2 - 1) * amp * Math.exp(-j / len);
            next = i + Math.round(sr * (0.0006 + u * u * 0.012) * (0.5 + Math.random()));
        }
    }
    const attack = Math.round(sr * 0.03);
    for (let i = 0; i < attack; i++) d[i] *= i / attack;
    let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(d[i]));
    for (let i = 0; i < n; i++) d[i] /= peak || 1;
    SPLASH_BUF = buf;
    return buf;
}

/** Low-passed noise with a soft attack: running water, never a click. */
function wash({ at = 0, dur = 0.4, vol = 0.1, from = 1500, to = 400, attack = 0.02 }) {
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noiseBuf;
    src.loop = true;
    filter.type = 'lowpass';
    filter.Q.value = 0.5;
    filter.frequency.setValueAtTime(from, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, to), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(master);
    src.start(t);
    src.stop(t + dur + 0.05);
}

/** One bubble: a short sine whose pitch rises as it leaves the water, with a soft start. */
function bloop({ at = 0, f = 600, dur = 0.07, vol = 0.06 }) {
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 1.6, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
}

// Vowel formants (F1, F2) in Hz for a small, bright creature voice.
const VOWEL = { a: [900, 1500], e: [600, 2300], i: [380, 2900], o: [560, 1050], u: [380, 950], ae: [800, 1900] };

/**
 * A tiny sung syllable — what makes a friend sound like a happy little creature rather
 * than a beep: a buzzy source plus a breath of noise through three band-pass formants
 * that glide from one vowel to another, with an exclamation pitch scoop and vibrato.
 */
function voice({ at = 0, dur = 0.3, f0 = 520, f1 = f0 * 1.5, from = 'e', to = 'a', vol = 0.2, vib = 6 }) {
    const t = ctx.currentTime + at;
    const src = ctx.createOscillator();
    src.type = 'sawtooth';
    src.frequency.setValueAtTime(f0 * 0.82, t);
    src.frequency.exponentialRampToValueAtTime(f0, t + 0.04);
    src.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.75);
    const lfo = ctx.createOscillator(), lfoGain = ctx.createGain();
    lfo.frequency.value = vib;
    lfoGain.gain.value = f0 * 0.02;
    lfo.connect(lfoGain).connect(src.frequency);
    const breathSrc = ctx.createBufferSource(), breath = ctx.createGain();
    breathSrc.buffer = noiseBuf;
    breathSrc.loop = true;
    breath.gain.value = 0.35;
    breathSrc.connect(breath);
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(vol, t + 0.03);
    out.gain.setValueAtTime(vol, t + dur * 0.65);
    out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    [[0, 7, 1], [1, 11, 0.8], [2, 14, 0.35]].forEach(([k, q, gain]) => {
        const bp = ctx.createBiquadFilter(), g = ctx.createGain();
        bp.type = 'bandpass';
        bp.Q.value = q;
        bp.frequency.setValueAtTime(k < 2 ? VOWEL[from][k] : 3300, t);
        bp.frequency.linearRampToValueAtTime(k < 2 ? VOWEL[to][k] : 3460, t + dur * 0.6);
        g.gain.value = gain * 2.2;
        src.connect(bp);
        breath.connect(bp);
        bp.connect(g).connect(out);
    });
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 6000;
    out.connect(lp).connect(master);
    for (const node of [src, lfo, breathSrc]) { node.start(t); node.stop(t + dur + 0.05); }
}

/** A celesta-like sparkle: a sine with two inharmonic partials and a ringing decay. */
function bell({ f, at = 0, dur = 0.6, vol = 0.06 }) {
    [[1, 1], [2.76, 0.35], [5.4, 0.12]].forEach(([m, a]) => tone({ f: f * m, at, dur: dur / Math.sqrt(m), vol: vol * a }));
}

let coinStreak = 0, lastCoin = 0, lastVoice = -1;

/** The coin's level against the rest of the effects (tester feedback 2026-11-14: it was too loud). */
const COIN_VOL = 0.6;
/** The splash in and out of the water sits with the other effects (it was 8-10 dB under them). */
const SPLASH_VOL = 2.3;

const SOUNDS = {
    /**
     * A coin: the next note of the streak melody (game/music/melody.js), snapped to the
     * music's 1/16 grid in sound only (the pickup itself is instant). Brighter as the
     * streak grows; a completed phrase ends with a little flourish.
     */
    coin(note) {
        if (!note) {                                  // no streak info: climb the fallback scale
            const now = performance.now();
            coinStreak = now - lastCoin < 900 ? Math.min(coinStreak + 1, SCALE.length - 1) : 0;
            lastCoin = now;
            note = { hz: SCALE[coinStreak], harmonyHz: SCALE[coinStreak] * 1.25, multiplier: 1 };
        }
        const at = musicClock.untilGrid(nowSeconds(), 4);
        const bright = Math.min(0.08, 0.02 * (note.multiplier - 1));
        // Tester: the coin was too loud next to everything else; coins come in long trails, so it sits
        // about 4.5 dB lower than it was (COIN_VOL), still the brightest small sound.
        const R = REAL.coin, rate = note.hz * 2 ** R.octaves / R.hz;
        if (!playSample('coin_glass', R.gain * (1 + bright * 4), rate, at)) {
            tone({ f: note.hz, type: 'triangle', at, dur: 0.18, vol: COIN_VOL * (0.2 + bright) });
            tone({ f: note.hz * 2, type: 'sine', at: at + 0.02, dur: 0.12, vol: COIN_VOL * (0.07 + bright) });
        }
        if (note.multiplier > 1) tone({ f: note.harmonyHz, type: 'sine', at, dur: 0.16, vol: COIN_VOL * (0.06 + bright) });
        if (note.flourish) {
            const step = 60 / musicClock.bpm / 4;
            note.flourish.forEach((f, i) => tone({ f, type: 'triangle', at: at + (i + 1) * step, dur: 0.22, vol: 0.16 }));
        }
    },
    /** A chain move (melody.js chainNote): a soft pluck on the 1/8 grid, a sparkle in flow. */
    chain(note) {
        const at = musicClock.untilGrid(nowSeconds(), 2);
        tone({ f: note.hz, type: 'triangle', at, dur: 0.24, vol: 0.13 });
        if (note.sparkleHz) bell({ f: note.sparkleHz, at: at + 0.01, dur: 0.4, vol: 0.05 });
    },
    /** A chain ends with a bonus: its chord, rolled up on the 1/16 grid. */
    chainEnd(chord) {
        const at = musicClock.untilGrid(nowSeconds(), 4), step = 60 / musicClock.bpm / 4;
        chord.forEach((f, i) => tone({ f, type: 'triangle', at: at + i * step * 0.5, dur: 0.6, vol: 0.1 }));
    },
    puff() {
        noise({ dur: 0.28, vol: 0.32, from: 500, to: 1800, q: 0.6 });
        tone({ f: 180, to: 420, type: 'sine', dur: 0.22, vol: 0.2 });
    },
    deflate() { noise({ dur: 0.35, vol: 0.2, from: 1600, to: 300, q: 0.7 }); },
    special() { tone({ f: 330, to: 990, type: 'sawtooth', dur: 0.2, vol: 0.14 }); noise({ dur: 0.2, vol: 0.18, from: 900, to: 2600 }); },
    // One voice per special move, so each character sounds like itself.
    sprint() { noise({ dur: 0.16, vol: 0.2, from: 500, to: 2400, q: 0.9 }); tone({ f: 180, to: 420, type: 'triangle', dur: 0.14, vol: 0.12 }); },
    leap() { noise({ dur: 0.3, vol: 0.2, from: 700, to: 3200, q: 0.6 }); tone({ f: 520, to: 1040, type: 'sine', dur: 0.26, vol: 0.12 }); },
    fan() { [0, 0.04, 0.08, 0.12].forEach((at, i) => tone({ f: 620 + i * 140, type: 'triangle', at, dur: 0.12, vol: 0.1 })); noise({ dur: 0.35, vol: 0.12, from: 3000, to: 900, q: 0.5 }); },
    shell() { tone({ f: 150, to: 90, type: 'square', dur: 0.16, vol: 0.2 }); tone({ f: 300, to: 180, type: 'triangle', at: 0.03, dur: 0.14, vol: 0.14 }); },
    pulse() { tone({ f: 240, to: 720, type: 'sine', dur: 0.32, vol: 0.18 }); tone({ f: 480, to: 1440, type: 'sine', at: 0.05, dur: 0.3, vol: 0.07 }); },
    grab() { tone({ f: 700, to: 500, type: 'triangle', dur: 0.08, vol: 0.16 }); tone({ f: 500, to: 520, type: 'sine', at: 0.07, dur: 0.1, vol: 0.12 }); },
    // Water elements: a bubble cannon's deep pop with a rush of air, a pad's rubbery boing.
    cannon() { tone({ f: 110, to: 320, type: 'sine', dur: 0.22, vol: 0.24 }); noise({ dur: 0.34, vol: 0.2, from: 400, to: 3200, q: 0.7 }); },
    boing() { tone({ f: 190, to: 560, type: 'triangle', dur: 0.2, vol: 0.2 }); tone({ f: 380, to: 300, type: 'sine', at: 0.16, dur: 0.14, vol: 0.1 }); },
    // Whale song: two long calls that slide, with a high answer.
    /** A dolphin's whistle (real recording; the code-made whistle stays for other uses). */
    dolphin() { if (!playSample('call_dolphin', REAL.dolphin.gain, 0.95 + Math.random() * 0.1)) SOUNDS.whistle(); },
    whale() {
        if (playSample('call_whale', REAL.whale.gain)) return; tone({ f: 170, to: 330, dur: 1.5, vol: 0.24 }); tone({ f: 330, to: 150, at: 1.3, dur: 1.9, vol: 0.22 }); tone({ f: 660, to: 880, at: 2.2, dur: 0.9, vol: 0.08 }); },
    hop() { tone({ f: 400, to: 800, type: 'sine', dur: 0.12, vol: 0.16 }); },
    // Old timbers groaning in the swell (the ghost ship, spec 5.0e; music/creak.js makes the samples).
    creak(k = 1) {
        // Three groans, made ahead of time (prepareCreaks) and played in turn, pitched a little apart.
        // None ready yet: this creak is skipped, nothing is ever worked out while the fish is at the ship.
        if (!creaks.length) return;
        const src = ctx.createBufferSource(), g = ctx.createGain();
        src.buffer = creaks[Math.floor(Math.random() * creaks.length)]; src.playbackRate.value = 0.85 + Math.random() * 0.3; g.gain.value = 0.2 * k;      // it peaked at 0 dBFS at 0.4
        src.connect(g).connect(master);
        src.start();
    },
    // A dolphin whistles as it blows a ring (spec 5.0k): a quick rising-falling chirp, pitched down to stay sweet.
    whistle() {
        // A dolphin whistle (mix check 2026-11-14: two 65 ms blips read as UI pops): one ~0.45 s contour that
        // rises with a small wiggle and falls at the end, a second harmonic, a soft breathy edge.
        const t = ctx.currentTime, f0 = 2000 + Math.random() * 500, dur = 0.45, n = 64, curve = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            const u = i / (n - 1), rise = u < 0.75 ? u / 0.75 : 1 - (u - 0.75) / 0.25 * 0.35;
            curve[i] = f0 * (1 + 0.55 * rise) * (1 + 0.05 * Math.sin(u * Math.PI * 5));
        }
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.05, t + 0.04);
        g.gain.setValueAtTime(0.05, t + dur - 0.1);
        g.gain.linearRampToValueAtTime(0.0001, t + dur);
        g.connect(master);
        [[1, 1], [2, 0.22]].forEach(([k, a]) => {
            const o = ctx.createOscillator(), og = ctx.createGain();
            o.frequency.setValueCurveAtTime(curve.map(v => v * k), t, dur);
            og.gain.value = a;
            o.connect(og).connect(g);
            o.start(t); o.stop(t + dur + 0.02);
        });
        noise({ dur, vol: 0.008, from: f0 * 1.2, to: f0 * 1.5, q: 4 });
    },

    // Swimming through a bubble ring: a soft round pop with a bright tail.
    ringPop() { tone({ f: 520, to: 1500, type: 'sine', dur: 0.09, vol: 0.08 }); noise({ dur: 0.08, vol: 0.03, from: 2600, to: 1200, q: 1.2 }); },
    // An octopus squirts ink: a short, soft whoosh.
    ink() {
        // A squirt that swells in and trails off (the first version, a sharp noise burst, read as a snare hit).
        const t = ctx.currentTime, dur = 0.75, src = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
        src.buffer = noiseBuf; src.loop = true;
        lp.type = 'lowpass'; lp.Q.value = 0.7;
        lp.frequency.setValueAtTime(1400, t); lp.frequency.exponentialRampToValueAtTime(260, t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.09, t + 0.14);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(lp).connect(g).connect(master);
        src.start(t); src.stop(t + dur + 0.05);
        tone({ f: 130, to: 65, type: 'sine', dur: 0.4, vol: 0.05 });
    },
    // A seabird calls before it dives (spec 5.0d): two harsh, falling croaks.
    cry() { [0, 0.16].forEach((at, i) => { tone({ f: 980 - i * 120, to: 620 - i * 80, type: 'sawtooth', dur: 0.13, vol: 0.07, at }); noise({ dur: 0.12, vol: 0.05, from: 1800, to: 900, q: 2, at }); }); },
    splash(strength = 1) {
        // A recorded splash (CC0; tester: the synthesized one popped like bubble wrap), one of two at
        // random, a little higher or lower each time. Its size follows the splash you see (fx/splash.js splashSize): a gentle plop
        // soft and bright, a full dive loud and deep (earshot 2026-11-15: before, 3.8 dB from plop to dive, peaks at 0 dBFS). Synthesized below as the fallback.
        const pick = Math.random() < 0.5 ? 'splash_a' : 'splash_b', size = splashSize(strength);
        if (playSample(pick, SPLASH_SAMPLE.gain[0] + (SPLASH_SAMPLE.gain[1] - SPLASH_SAMPLE.gain[0]) * size, 1.12 - 0.24 * size + (Math.random() - 0.5) * 0.1)) return;
        // A real splash (tester: the old one "popped like bubble wrap"): a soft body of water noise and a
        // dense cloud of tiny bubbles (dozens in a few tenths of a second, each a quick rising chirp), so
        // no single pop stands out. Every part fades in; a hard dive is a little louder and fuller.
        const k = SPLASH_VOL * Math.min(1, 0.35 + strength * 0.05);
        wash({ dur: 0.5, vol: 0.1 * k, from: 2200, to: 500, attack: 0.025 });
        tone({ f: 130, to: 60, type: 'sine', dur: 0.2, vol: 0.08 * k });
        const n = Math.round(24 + 30 * k);
        for (let i = 0; i < n; i++) {
            const u = Math.random() ** 1.7;                                   // most bubbles early
            bloop({ at: 0.01 + u * 0.4, f: 500 + Math.random() * 1800, dur: 0.012 + Math.random() * 0.025, vol: (0.012 + Math.random() * 0.016) * k * (1 - u * 0.6) });
        }
    },
    hit() { tone({ f: 190, to: 70, type: 'square', dur: 0.22, vol: 0.22 }); noise({ dur: 0.12, vol: 0.2, from: 400, to: 150 }); },
    /**
     * Meeting a friend: one of several happy little creature voices (giggles, "woo-hoo",
     * "yippee", "yay") with a soft sparkle, never the same twice in a row. Levels are
     * matched to about -30 LUFS each, under the coin notes. Checked by ear with earshot:
     * the giggles and the woo-hoo read as a cheering creature, not as a beep.
     */
    friend() {
        const voices = [
            // giggle
            () => { [620, 700, 660, 760, 720, 840].forEach((f, i) => voice({ at: i * 0.08, dur: 0.075, f0: f, f1: f * 1.08, from: 'e', to: 'i', vol: 0.2, vib: 0 })); bell({ f: 1760, at: 0.48 }); },
            // a higher, quicker giggle
            () => { [780, 700, 820, 740, 880, 800, 940].forEach((f, i) => voice({ at: i * 0.07, dur: 0.065, f0: f, f1: f * 1.06, from: 'i', to: 'e', vol: 0.2, vib: 0 })); bell({ f: 2093, at: 0.5 }); },
            // "woo-hoo"
            () => { voice({ dur: 0.24, f0: 420, f1: 560, from: 'u', to: 'o', vol: 0.09 }); voice({ at: 0.26, dur: 0.34, f0: 560, f1: 880, from: 'o', to: 'u', vol: 0.09 }); bell({ f: 1568, at: 0.55, vol: 0.03 }); },
            // "yippee"
            () => { voice({ dur: 0.18, f0: 520, f1: 600, from: 'i', to: 'i', vol: 0.14 }); voice({ at: 0.2, dur: 0.38, f0: 640, f1: 980, from: 'e', to: 'i', vol: 0.14 }); bell({ f: 1760, at: 0.6, vol: 0.04 }); },
            // "yay!" with a little chime
            () => { voice({ dur: 0.36, f0: 470, f1: 760, from: 'i', to: 'ae', vol: 0.09 }); [1318.5, 1568, 2093].forEach((f, i) => bell({ f, at: 0.3 + i * 0.06, vol: 0.03 })); }
        ];
        let pick;
        do { pick = Math.floor(Math.random() * voices.length); } while (pick === lastVoice && voices.length > 1);
        lastVoice = pick;
        voices[pick]();
    },
    nest() { if (playSample('nest_chord', REAL.nest.gain)) return; [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone({ f, type: 'triangle', at: i * 0.11, dur: 0.3, vol: 0.22 })); },
    // The finale's reveal (spec 5.0m beat 3): past the last chimney the nest comes into view; one warm swell, a few bells rising.
    reveal() {
        const t = ctx.currentTime;
        [130.81, 196, 261.63, 329.63, 392, 493.88].forEach((f, i) => pad(f, t + i * 0.12, 4.5, 0.3, master));
        [523.25, 659.25, 783.99, 987.77].forEach((f, i) => bellNote(f, t + 1.2 + i * 0.35, master));
    },
    win() { [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98].forEach((f, i) => tone({ f, type: 'triangle', at: i * 0.13, dur: 0.5, vol: 0.22 })); },
    respawn() { tone({ f: 440, to: 220, type: 'sine', dur: 0.4, vol: 0.2 }); },
    flap() { noise({ dur: 0.09, vol: 0.1, from: 700, to: 1400, q: 1.2 }); },
    tap() { tone({ f: 880, type: 'sine', dur: 0.06, vol: 0.12 }); },
    /** A trapped animal calls for help (RescueLayer): a soft falling two-note "here!". */
    call() { [[987.77, 0], [783.99, 0.16]].forEach(([f, at]) => tone({ f, type: 'sine', at, dur: 0.32, vol: 0.05, rise: 0.03 })); },
    /**
     * A big animal is near, heard before it is seen (game/level/heralds.js): a soft low swell of two notes,
     * like the music noticing something big. Synthesized barks and chirps were tried and read as a snare
     * hit and an alarm clock (earshot), so real animal calls wait for recorded CC0 sounds.
     */
    herald(call = { notes: [392, 587.33] }) {
        if (call.sample && playSample(call.sample, call.gain ?? REAL.call.gain)) return;
        const notes = call.notes || [392, 587.33];
        notes.forEach((f, i) => tone({ f, type: 'sine', at: i * 0.12, dur: 2.2, vol: 0.022, rise: 0.6 }));
    },
    /** Going down past depth mark i (game/level/depthMeters.js): a soft bell, a step lower every mark. */
    deeper(i = 0) {
        // Quieter than a coin, a soft swell instead of a strike, low and dark (earshot: the first version
        // was 8 dB louder than the coin and read as a "success chime"; a version at 98 Hz read as a sub bass drop that phones cannot play).
        // The body stays where phone speakers play (above ~300 Hz); a faint octave below adds depth on headphones.
        const f = 440 * Math.pow(0.8909, i);               // A4, a whole tone lower per mark (A4 .. B3 over nine marks)
        tone({ f, type: 'sine', dur: 1.7, vol: 0.032, rise: 0.1 });
        tone({ f: f * 1.5, type: 'sine', at: 0.02, dur: 1.1, vol: 0.008, rise: 0.12 });
        tone({ f: f / 2, type: 'sine', at: 0.04, dur: 1.9, vol: 0.013, rise: 0.2 });
    },
    // A boat's engine heard through the water (the trawl, spec 5.0t 2): a diesel's chug (ENGINE.chug firings a second)
    // over a low, muffled drone; its body sits above ~150 Hz, where phone speakers still play. `arg` = how near (0..1).
    engine(near = 1) {
        const E = ENGINE, t = ctx.currentTime, out = ctx.createGain(), lp = ctx.createBiquadFilter(), am = ctx.createGain(), lfo = ctx.createOscillator(), depth = ctx.createGain();
        lp.type = 'lowpass'; lp.frequency.value = E.muffle; lp.Q.value = 0.7;
        lfo.type = 'sine'; lfo.frequency.value = E.chug; depth.gain.value = E.chugDepth / 2;
        const wob = ctx.createOscillator(), wobG = ctx.createGain();      // the firing rate wanders a little, as a real engine's does
        wob.frequency.value = E.wander[0]; wobG.gain.value = E.wander[1]; wob.connect(wobG).connect(lfo.frequency); wob.start(t); wob.stop(t + E.dur + 0.05);
        am.gain.value = 1 - E.chugDepth / 2; lfo.connect(depth).connect(am.gain);
        const vol = E.vol * (0.35 + 0.65 * Math.max(0, Math.min(1, near)));
        // Linear fades: overlapping plays cross-fade to a steady level (exponential ones dip and pump).
        out.gain.setValueAtTime(0, t); out.gain.linearRampToValueAtTime(vol, t + E.fade); out.gain.setValueAtTime(vol, t + E.dur - E.fade); out.gain.linearRampToValueAtTime(0, t + E.dur);
        for (const [f, type, v] of E.voices) { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f; g.gain.value = v; o.connect(g).connect(am); o.start(t); o.stop(t + E.dur + 0.05); }
        for (const [fc, q, v] of E.hiss) {
            const src = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
            src.buffer = noiseBuf; src.loop = true; src.loopStart = Math.random(); bp.type = 'bandpass'; bp.frequency.value = fc; bp.Q.value = q; ng.gain.value = v;
            src.connect(bp).connect(ng).connect(am); src.start(t, Math.random()); src.stop(t + E.dur + 0.05);
        }
        am.connect(lp).connect(out).connect(master);
        lfo.start(t); lfo.stop(t + E.dur + 0.05);
    },
    // The volcano grumbling deep in the earth (the opening's "Was grollt da?"). earshot 2026-11-15: the old buzzing sawtooth
    // read as 'an error buzz'. Now low noise that swells and rolls, with an uneven tremble, and a little body above 150 Hz for phone speakers.
    rumble() {
        const t = ctx.currentTime, dur = 2.2, g = ctx.createGain(), lp = ctx.createBiquadFilter(), trem = ctx.createOscillator(), tremG = ctx.createGain();
        lp.type = 'lowpass'; lp.frequency.setValueAtTime(220, t); lp.frequency.linearRampToValueAtTime(420, t + 0.9); lp.frequency.linearRampToValueAtTime(160, t + dur); lp.Q.value = 0.9;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.24, t + 0.7); g.gain.linearRampToValueAtTime(0.17, t + 1.4); g.gain.linearRampToValueAtTime(0, t + dur);
        trem.frequency.value = 5.3; tremG.gain.value = 0.08; trem.connect(tremG).connect(g.gain);
        for (const [rate, off] of [[1, 0], [0.5, 0.37]]) {      // two takes of the noise, one an octave down: a deeper, rolling body
            const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true; src.playbackRate.value = rate;
            src.connect(lp); src.start(t, off); src.stop(t + dur + 0.05);
        }
        lp.connect(g).connect(master);
        trem.start(t); trem.stop(t + dur + 0.05);
        tone({ f: 48, to: 36, type: 'sine', dur, vol: 0.08, rise: 0.6 });
    },
    // The volcano erupting (the opening). earshot 2026-11-15: the old band-passed burst read as 'a snare hit'. Now a deep
    // thump, then a long rolling roar that darkens as it dies, and a little crackle of falling rock.
    boom() {
        if (playSample('boom_thunder', REAL.boom.gain)) return;
        const t = ctx.currentTime, dur = 3, g = ctx.createGain(), lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.Q.value = 0.6; lp.frequency.setValueAtTime(1400, t); lp.frequency.exponentialRampToValueAtTime(120, t + dur);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.15, t + 0.03); g.gain.exponentialRampToValueAtTime(0.06, t + 0.8); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        for (const [rate, off] of [[1, 0.1], [0.5, 0.6], [0.25, 0.3]]) {
            const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true; src.playbackRate.value = rate;
            src.connect(lp); src.start(t, off); src.stop(t + dur + 0.05);
        }
        lp.connect(g).connect(master);
        tone({ f: 70, to: 32, type: 'sine', dur: 1.1, vol: 0.16, rise: 0.01 });
        for (let i = 0; i < 9; i++) noise({ at: 0.5 + Math.random() * 1.8, dur: 0.05 + Math.random() * 0.06, vol: 0.025 + Math.random() * 0.025, from: 2500, to: 900, q: 1.5 });
    }
};

/**
 * Background score and underwater ambience (spec ch.12; notes from game/music/score.js),
 * scheduled a little ahead on the shared music clock. Starts with the first sound after a
 * tap (browsers need that), fades in, follows the biome (new key at the next bar) and
 * darkens with depth (the deeper, the lower the filter and the louder the hum).
 */
/** The trawl's engine (SOUNDS.engine): one play lasts `dur` s and overlaps the next by its fades (TrawlLayer plays it every 1.6 s). */
export const ENGINE = {
    dur: 2.2, fade: 0.45, vol: 0.22,
    chug: 7.5, chugDepth: 0.65,      // firings a second, and how much each one pulses the level
    wander: [0.7, 1.2],            // the firing rate drifts this often (Hz) by this much (Hz)
    muffle: 700,                   // Hz: the water takes the highs
    voices: [[82, 'triangle', 0.22], [164, 'sawtooth', 0.08]],   // Hz, wave, level: a faint hum under the noise
    hiss: [[180, 0.6, 1.4], [520, 1.1, 0.7], [1100, 2, 0.15]]   // band-passed noise: centre Hz, Q, level (the churn and the clatter of the cylinders)
};

export const MUSIC = {
    vol: 0.16,            // music bus level under the effects
    padVol: 0.05,         // each pad voice
    arpVol: 0.03,         // each bell note
    ambVol: 0.045,        // sea hum
    lookahead: 0.4,       // s scheduled ahead
    cutoffTop: 3800,      // Hz music filter at the surface ...
    cutoffDeep: 650,      // ... and in the deep
    fadeInS: 2.5,
    stormVol: 0.14,       // the storm's low rumble at full strength (spec 5.0c)
    rushVol: 0.2,         // the rush of strong moving water: surge, breakers, downwelling
    rushHz: 900,          // centre of the rush's band
    layerVol: 0.035,      // each proximity layer at full (game/music/score.js LAYERS)
    layerFade: 1.5,       // s for a layer to come in or go
    wave: 0.7             // the sea hum swells by this share once a bar near the surface, like a wave coming in (gone in the deep)
};
let bus = null, busFilter = null, amb = null, ambFilter = null, nextBeat = -1, beatIdx = 0, rumble = null, rush = null, layerGain = null, layerWant = {};

function musicNodes() {
    if (bus) return;
    busFilter = ctx.createBiquadFilter();
    busFilter.type = 'lowpass';
    busFilter.frequency.value = MUSIC.cutoffTop;
    bus = ctx.createGain();
    bus.gain.value = 0;
    bus.connect(busFilter).connect(master);
    bus.gain.setTargetAtTime(MUSIC.vol, ctx.currentTime, MUSIC.fadeInS / 3);
    // The sea: 6 s of soft (brown) noise, long enough that its loop is never heard as a throb.
    const len = ctx.sampleRate * 6, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    const fade = ctx.sampleRate * 0.5;          // ends meet: cross-fade the seam
    for (let i = 0; i < fade; i++) { const k = i / fade; d[len - fade + i] = d[len - fade + i] * (1 - k) + d[i] * k; }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.loopStart = fade / ctx.sampleRate;
    src.loopEnd = len / ctx.sampleRate;
    ambFilter = ctx.createBiquadFilter();
    ambFilter.type = 'lowpass';
    ambFilter.frequency.value = 420;
    amb = ctx.createGain();
    amb.gain.value = 0;
    src.connect(ambFilter).connect(amb).connect(master);
    amb.gain.setTargetAtTime(MUSIC.ambVol, ctx.currentTime, MUSIC.fadeInS / 3);
    src.start();
    // Weather from the same noise, silent until needed: a deep rumble and a band of rushing water.
    const voice = (type, hz, q, offset) => {
        const n = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
        n.buffer = buf; n.loop = true; n.loopStart = src.loopStart; n.loopEnd = src.loopEnd;
        fl.type = type; fl.frequency.value = hz; fl.Q.value = q; g.gain.value = 0;
        n.connect(fl).connect(g).connect(master);
        n.start(ctx.currentTime, offset);
        return g;
    };
    rumble = voice('lowpass', 160, 0.7, 1.7);
    rush = voice('bandpass', MUSIC.rushHz, 0.6, 3.9);
    // One gain per proximity layer, so a layer fades in and out smoothly however its notes fall.
    layerGain = {};
    for (const k of Object.keys(LAYERS)) { const g = ctx.createGain(); g.gain.value = 0; g.connect(bus); layerGain[k] = g; }
}

/** How loud each proximity layer should be, 0..1 (score.js layerLevels); the scheduler fades to it. */
export function setMusicLayers(levels) { layerWant = levels || {}; }

/** One note of a layer: bass (soft round low), wood (short knock), pluck (bright short), glass (high, ringing). */
function layerNote(hz, t, voice, out) {
    const V = { bass: [['triangle', 1, 1], 0.9], wood: [['sine', 1, 1], 0.22, ['sine', 3, 0.25]], pluck: [['triangle', 1, 1], 0.45, ['sine', 2, 0.3]], glass: [['sine', 1, 1], 1.3, ['sine', 3.01, 0.2]] }[voice];
    const dur = V[1];
    for (const [type, m, a] of [V[0], ...(V[2] ? [V[2]] : [])]) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type; o.frequency.value = hz * m;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(a, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(out);
        o.start(t); o.stop(t + dur + 0.05);
    }
}

/** Weather sound, 0..1 each: the storm overhead and how hard the water around the fish moves. */
export function updateWeatherSound(storm01, rush01) {
    if (!rumble || muted) return;
    const t = ctx.currentTime, k = v => Math.max(0, Math.min(1, v));
    rumble.gain.setTargetAtTime(MUSIC.stormVol * k(storm01), t, 0.8);
    rush.gain.setTargetAtTime(MUSIC.rushVol * k(rush01), t, 0.25);
}

/** A soft pad voice: two slightly detuned triangles, slow attack and release. */
function pad(hz, t, dur, gain = 1, out = bus) {
    for (const cents of [-5, 5]) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = hz;
        o.detune.value = cents;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(MUSIC.padVol * gain, t + Math.min(1.5, dur * 0.3));
        g.gain.setValueAtTime(MUSIC.padVol * gain, t + dur * 0.7);
        g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.6);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + dur + 0.7);
    }
}

/** A gentle bell for the arpeggio (sine plus a quiet overtone, soft decay). */
function bellNote(hz, t, out = bus) {
    [[1, 1], [2.01, 0.25]].forEach(([m, a]) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = hz * m;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(MUSIC.arpVol * a, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + 1.5);
    });
}

/**
 * Call every frame: depth 0 (surface) .. 1 (abyss) and the biome blend of the current place
 * ({ a, b, t } of biomeBlendAt): the pads cross from a's key into b's over the blend, the bells
 * follow the nearer one.
 */
export function updateMusic(blend, depth01) {
    const biomeId = (blend.t < 0.5 ? blend.a : blend.b).id;
    if (!ctx || muted || ctx.state !== 'running') return;
    musicNodes();
    const now = nowSeconds(), beatS = 60 / musicClock.bpm;
    if (nextBeat < ctx.currentTime) {          // (re)start in step with the clock
        beatIdx = Math.floor(musicClock.phase(now).beat) + 1;
        nextBeat = ctx.currentTime + musicClock.untilGrid(now, 1);
    }
    while (nextBeat < ctx.currentTime + MUSIC.lookahead) {
        const bar = Math.floor(beatIdx / musicClock.beatsPerBar), inBar = beatIdx % musicClock.beatsPerBar;
        if (inBar === 0 && bar % SCORE.barsPerChord === 0) {
            for (const n of chordMix(blend.a.id, blend.b.id, blend.t, bar)) pad(n.hz, nextBeat, beatS * musicClock.beatsPerBar * SCORE.barsPerChord, n.gain);
        }
        for (const half of [0, 1]) {
            const step = inBar * 2 + half, at = nextBeat + half * beatS / 2;
            const hz = arpAt(biomeId, bar, step, depth01);
            if (hz) bellNote(hz, at);
            // The proximity layers (only those that are in: no silent notes are made).
            for (const k in layerGain) {
                if ((layerWant[k] || 0) < 0.02 && layerGain[k].gain.value < 0.001) continue;
                const lh = layerAt(k, biomeId, bar, step);
                if (lh) layerNote(lh, at, LAYERS[k].voice, layerGain[k]);
            }
        }
        // The sea hum swells once a bar like a wave coming in, near the surface (the waves beat with the music).
        if (inBar === 0) {
            const base = MUSIC.ambVol * (1 + 0.3 * Math.max(0, Math.min(1, depth01))), up = base * (1 + MUSIC.wave * (1 - Math.max(0, Math.min(1, depth01 * 3))));
            amb.gain.setTargetAtTime(up, nextBeat, beatS * 0.6);
            amb.gain.setTargetAtTime(base, nextBeat + beatS * 1.5, beatS);
        }
        nextBeat += beatS;
        beatIdx++;
    }
    const d = Math.max(0, Math.min(1, depth01));
    busFilter.frequency.setTargetAtTime(MUSIC.cutoffTop * Math.pow(MUSIC.cutoffDeep / MUSIC.cutoffTop, d), ctx.currentTime, 0.6);
    ambFilter.frequency.setTargetAtTime(520 - 200 * d, ctx.currentTime, 0.6);
    for (const k in layerGain) layerGain[k].gain.setTargetAtTime(MUSIC.layerVol * (layerWant[k] || 0), ctx.currentTime, MUSIC.layerFade / 3);
}

/** Play a named sound; unknown names and blocked audio are ignored silently. */
export function play(name, arg) {
    try {
        if (SOUNDS[name] && ready()) SOUNDS[name](arg);
    } catch { /* audio must never break the game */ }
}

/** Menu entry for the burger menu. `relabel` is unused: the menu is rebuilt on restart. */
export function soundMenuItem(lang, onToggle) {
    const de = lang === 'de';
    return {
        label: muted ? (de ? 'TON: AUS' : 'SOUND: OFF') : (de ? 'TON: AN' : 'SOUND: ON'),
        color: muted ? 0x30363a : 0x00838f,
        callback: () => { setMuted(!muted); play('tap'); onToggle?.(); }
    };
}
