// Sound effects, synthesised with the Web Audio API — no audio files.
// Every sound is a few oscillators / a noise burst through a gain envelope.
// Browsers only allow sound after a tap, so the context is created lazily on the
// first play() that follows user input.

const MUTE_KEY = 'sll_muted';
let ctx = null, master = null, noiseBuf = null;
let muted = (() => { try { return window.localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } })();

export const isMuted = () => muted;
export function setMuted(on) {
    muted = !!on;
    try { window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* storage blocked */ }
    if (master) master.gain.value = muted ? 0 : VOLUME;
}

const VOLUME = 0.5;
// C major pentatonic, so any run of coin notes sounds like a little tune.
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

let coinStreak = 0, lastCoin = 0, lastVoice = -1;

const SOUNDS = {
    /** Coins collected in quick succession climb the scale. */
    coin() {
        const now = performance.now();
        coinStreak = now - lastCoin < 900 ? Math.min(coinStreak + 1, SCALE.length - 1) : 0;
        lastCoin = now;
        tone({ f: SCALE[coinStreak], type: 'triangle', dur: 0.16, vol: 0.22 });
        tone({ f: SCALE[coinStreak] * 2, type: 'sine', at: 0.03, dur: 0.12, vol: 0.1 });
    },
    puff() {
        noise({ dur: 0.28, vol: 0.32, from: 500, to: 1800, q: 0.6 });
        tone({ f: 180, to: 420, type: 'sine', dur: 0.22, vol: 0.2 });
    },
    deflate() { noise({ dur: 0.35, vol: 0.2, from: 1600, to: 300, q: 0.7 }); },
    special() { tone({ f: 330, to: 990, type: 'sawtooth', dur: 0.2, vol: 0.14 }); noise({ dur: 0.2, vol: 0.18, from: 900, to: 2600 }); },
    splash(strength = 1) {
        // Soft and airy; a hard dive is only a little louder than a gentle one.
        const v = Math.min(0.14, 0.04 + strength * 0.006);
        noise({ dur: 0.4, vol: v, from: 3200, to: 900, q: 0.4 });
        noise({ at: 0.06, dur: 0.5, vol: v * 0.45, from: 1200, to: 400, q: 0.7 });
    },
    hit() { tone({ f: 190, to: 70, type: 'square', dur: 0.22, vol: 0.22 }); noise({ dur: 0.12, vol: 0.2, from: 400, to: 150 }); },
    /** Meeting a friend: one of several happy little voices, never the same twice in a row. */
    friend() {
        const voices = [
            // "yay!" — a quick dip and a long happy rise
            () => { tone({ f: 620, to: 520, type: 'triangle', dur: 0.07, vol: 0.2 }); tone({ f: 540, to: 1250, type: 'triangle', at: 0.07, dur: 0.3, vol: 0.24 }); },
            // "woo-hoo" — up, then higher
            () => { tone({ f: 520, to: 780, type: 'sine', dur: 0.16, vol: 0.24 }); tone({ f: 700, to: 1180, type: 'sine', at: 0.2, dur: 0.26, vol: 0.24 }); },
            // giggle — a run of quick bright blips
            () => { [880, 1046.5, 932, 1174.66, 1046.5, 1318.51].forEach((f, i) => tone({ f, to: f * 1.12, type: 'triangle', at: i * 0.065, dur: 0.06, vol: 0.18 })); },
            // "hello!" chirp — three notes of a major chord
            () => { [659.25, 783.99, 1046.5].forEach((f, i) => tone({ f, type: 'triangle', at: i * 0.09, dur: 0.2, vol: 0.2 })); },
            // happy squeak — fast wobble upward
            () => { for (let i = 0; i < 4; i++) tone({ f: 700 + i * 130, to: 900 + i * 130, type: 'sine', at: i * 0.07, dur: 0.07, vol: 0.2 }); }
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
