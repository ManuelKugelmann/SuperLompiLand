// Sound effects, synthesised with the Web Audio API — no audio files.
// Every sound is a few oscillators / a noise burst through a gain envelope.
// Browsers only allow sound after a tap, so the context is created lazily on the
// first play() that follows user input.

import { createClock } from './music/clock.js';
import { SCORE, chordMix, arpAt } from './music/score.js';
import { creakSamples } from './music/creak.js';

/**
 * The one music clock (spec ch.12): visual animation may lock to its beat via
 * musicClock.pulse(nowSeconds()); gameplay never does. Runs even when muted.
 */
export const musicClock = createClock();
export const nowSeconds = () => performance.now() / 1000;

const MUTE_KEY = 'sll_muted';
let ctx = null, master = null, noiseBuf = null, creaks = null;
let muted = (() => { try { return window.localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } })();

export const isMuted = () => muted;
export function setMuted(on) {
    muted = !!on;
    try { window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* storage blocked */ }
    if (master) master.gain.value = muted ? 0 : VOLUME;
}

const VOLUME = 0.5;
// Fallback when play('coin') is called without a streak note: C major pentatonic.
const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51];

function ready() {
    if (muted) return false;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    if (!ctx) {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = VOLUME;
        master.connect(ctx.destination);
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx.state !== 'closed';
}

/** One enveloped oscillator note. Frequencies may glide from `f` to `to`. */
function tone({ f, to = f, type = 'sine', at = 0, dur = 0.15, vol = 0.3 }) {
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (to !== f) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
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
        tone({ f: note.hz, type: 'triangle', at, dur: 0.18, vol: 0.2 + bright });
        tone({ f: note.hz * 2, type: 'sine', at: at + 0.02, dur: 0.12, vol: 0.07 + bright });
        if (note.multiplier > 1) tone({ f: note.harmonyHz, type: 'sine', at, dur: 0.16, vol: 0.06 + bright });
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
    whale() { tone({ f: 170, to: 330, dur: 1.5, vol: 0.24 }); tone({ f: 330, to: 150, at: 1.3, dur: 1.9, vol: 0.22 }); tone({ f: 660, to: 880, at: 2.2, dur: 0.9, vol: 0.08 }); },
    hop() { tone({ f: 400, to: 800, type: 'sine', dur: 0.12, vol: 0.16 }); },
    // Old timbers groaning in the swell (the ghost ship, spec 5.0e; music/creak.js makes the samples).
    creak(k = 1) {
        // Three groans are made once (a few ms each) and played in turn, pitched a little apart.
        if (!creaks) creaks = [0, 1, 2].map(() => {
            const d = creakSamples(ctx.sampleRate, 0.9 + Math.random() * 0.6), buf = ctx.createBuffer(1, d.length, ctx.sampleRate);
            buf.getChannelData(0).set(d);
            return buf;
        });
        const src = ctx.createBufferSource(), g = ctx.createGain();
        src.buffer = creaks[Math.floor(Math.random() * creaks.length)]; src.playbackRate.value = 0.85 + Math.random() * 0.3; g.gain.value = 0.4 * k;
        src.connect(g).connect(master);
        src.start();
    },
    // A seabird calls before it dives (spec 5.0d): two harsh, falling croaks.
    cry() { [0, 0.16].forEach((at, i) => { tone({ f: 980 - i * 120, to: 620 - i * 80, type: 'sawtooth', dur: 0.13, vol: 0.07, at }); noise({ dur: 0.12, vol: 0.05, from: 1800, to: 900, q: 2, at }); }); },
    splash(strength = 1) {
        // Soft and airy; a hard dive is only a little louder than a gentle one.
        const v = Math.min(0.14, 0.04 + strength * 0.006);
        noise({ dur: 0.4, vol: v, from: 3200, to: 900, q: 0.4 });
        noise({ at: 0.06, dur: 0.5, vol: v * 0.45, from: 1200, to: 400, q: 0.7 });
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
    nest() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone({ f, type: 'triangle', at: i * 0.11, dur: 0.3, vol: 0.22 })); },
    win() { [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98].forEach((f, i) => tone({ f, type: 'triangle', at: i * 0.13, dur: 0.5, vol: 0.22 })); },
    respawn() { tone({ f: 440, to: 220, type: 'sine', dur: 0.4, vol: 0.2 }); },
    flap() { noise({ dur: 0.09, vol: 0.1, from: 700, to: 1400, q: 1.2 }); },
    tap() { tone({ f: 880, type: 'sine', dur: 0.06, vol: 0.12 }); },
    rumble() { tone({ f: 55, to: 38, type: 'sawtooth', dur: 1.6, vol: 0.3 }); noise({ dur: 1.6, vol: 0.25, from: 180, to: 70, q: 0.4 }); },
    boom() { noise({ dur: 1.2, vol: 0.5, from: 900, to: 60, q: 0.3 }); tone({ f: 90, to: 30, type: 'sine', dur: 0.9, vol: 0.4 }); }
};

/**
 * Background score and underwater ambience (spec ch.12; notes from game/music/score.js),
 * scheduled a little ahead on the shared music clock. Starts with the first sound after a
 * tap (browsers need that), fades in, follows the biome (new key at the next bar) and
 * darkens with depth (the deeper, the lower the filter and the louder the hum).
 */
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
    rushHz: 900           // centre of the rush's band
};
let bus = null, busFilter = null, amb = null, ambFilter = null, nextBeat = -1, beatIdx = 0, rumble = null, rush = null;

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
}

/** Weather sound, 0..1 each: the storm overhead and how hard the water around the fish moves. */
export function updateWeatherSound(storm01, rush01) {
    if (!rumble || muted) return;
    const t = ctx.currentTime, k = v => Math.max(0, Math.min(1, v));
    rumble.gain.setTargetAtTime(MUSIC.stormVol * k(storm01), t, 0.8);
    rush.gain.setTargetAtTime(MUSIC.rushVol * k(rush01), t, 0.25);
}

/** A soft pad voice: two slightly detuned triangles, slow attack and release. */
function pad(hz, t, dur, gain = 1) {
    for (const cents of [-5, 5]) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = hz;
        o.detune.value = cents;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(MUSIC.padVol * gain, t + Math.min(1.5, dur * 0.3));
        g.gain.setValueAtTime(MUSIC.padVol * gain, t + dur * 0.7);
        g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.6);
        o.connect(g).connect(bus);
        o.start(t);
        o.stop(t + dur + 0.7);
    }
}

/** A gentle bell for the arpeggio (sine plus a quiet overtone, soft decay). */
function bellNote(hz, t) {
    [[1, 1], [2.01, 0.25]].forEach(([m, a]) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = hz * m;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(MUSIC.arpVol * a, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
        o.connect(g).connect(bus);
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
            const hz = arpAt(biomeId, bar, inBar * 2 + half, depth01);
            if (hz) bellNote(hz, nextBeat + half * beatS / 2);
        }
        nextBeat += beatS;
        beatIdx++;
    }
    const d = Math.max(0, Math.min(1, depth01));
    busFilter.frequency.setTargetAtTime(MUSIC.cutoffTop * Math.pow(MUSIC.cutoffDeep / MUSIC.cutoffTop, d), ctx.currentTime, 0.6);
    ambFilter.frequency.setTargetAtTime(520 - 200 * d, ctx.currentTime, 0.6);
    amb.gain.setTargetAtTime(MUSIC.ambVol * (1 + 0.3 * d), ctx.currentTime, 0.6);
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
