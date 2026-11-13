// Pure snapshot smoothing for remote players (no Phaser, unit-tested).
//
// Every snapshot carries the sender's clock (`t`). The offset between the two
// clocks is estimated as the fastest recent delivery, so bursty arrival (a
// stalled data channel releasing several packets at once) does not turn into
// stutter. The player is sampled a little in the past, with a cushion that
// grows and shrinks with measured jitter.

export const SNAP = {
    keep: 24,         // snapshots kept per player
    staleMs: 6000,    // no update for this long = the player is gone quiet
    minDelay: 90,     // render-delay bounds (ms)
    maxDelay: 320,
    teleportDist: 700, // a jump this far (respawn, nest) is a teleport, not a swim
    offsetWindow: 80,
    predictMs: 500,   // when starved, keep predicting with swimming physics this long
    correctMs: 150    // a prediction that turns out wrong is blended out over this time
};

/**
 * The motion model used to predict a remote fish between packets, in the same
 * units as the physics (px per 60 Hz step). Defaults are Lompi's, as the coder
 * measured them; RemoteFish passes each character's own via setMotion() (the
 * values come from game/characters.js, so this module stays Phaser-free).
 */
export const PREDICT = {
    keepWater: 0.982,     // velocity kept per step in water
    keepAir: 0.9985,      // velocity kept per step in the air
    gravityWater: 0.0333, // px/step² downward in water
    gravityAir: 0.339,    // px/step² downward above the surface (a ballistic arc)
    surfaceY: 0           // y of the calm water surface (waves stay within ~30 px)
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, k) => a + (b - a) * k;
const STEP = 1000 / 60;

/**
 * Tangent for Hermite blending: the reported velocity, but kept close to the
 * actual path between the two snapshots (secant), so a sender whose velocity is
 * off (dropped frames) cannot make the curve overshoot.
 */
function tangent(v, secant) {
    const lim = Math.abs(secant) * 0.5 + 0.02;
    return secant + clamp(v - secant, -lim, lim);
}

/** Cubic Hermite between p0 and p1 with tangents m0, m1 (per ms), k in 0..1 over h ms. */
function hermite(p0, p1, m0, m1, h, k) {
    const k2 = k * k, k3 = k2 * k;
    return (2 * k3 - 3 * k2 + 1) * p0 + (k3 - 2 * k2 + k) * h * m0 + (-2 * k3 + 3 * k2) * p1 + (k3 - k2) * h * m1;
}

/** Predict `ms` ahead from a state with a motion model (see PREDICT). */
export function predict(state, ms, m = PREDICT) {
    let { x, y, vx, vy } = state;
    let left = ms;
    while (left > 0) {
        const f = Math.min(1, left / STEP);
        const air = y < m.surfaceY;
        const keep = Math.pow(air ? m.keepAir : m.keepWater, f);
        vx *= keep; vy *= keep;
        vy += (air ? m.gravityAir : m.gravityWater) * f;
        x += vx * f; y += vy * f;
        left -= STEP;
    }
    return { x, y, vx, vy };
}

export class SnapshotBuffer {
    constructor() {
        this.buf = [];
        this.offsets = [];
        this.lastSeq = -1;
        this.seen = 0;
        this.delay = 140;
        this.jitter = 0;
        this.interval = 50; // sender's time between snapshots (ms), smoothed: a slow phone sends less often
        this.lastT = null;
        this.drawn = null;      // last drawn position, to blend out corrections
        this.err = null;        // { x, y, at }: offset being blended out
        this.predicting = false;
        this.motion = PREDICT;
    }

    /** Use a character's own motion numbers for prediction (partial objects are fine). */
    setMotion(m) { this.motion = { ...PREDICT, ...m }; }

    /** Snapshot: { n, t, x, y, vx, vy, s, f, c }. `now` = local clock, ms. Returns false if ignored. */
    push(snap, now) {
        if (!snap || typeof snap.t !== 'number' || typeof snap.x !== 'number' || typeof snap.y !== 'number') return false;
        if (snap.n <= this.lastSeq && this.lastSeq - snap.n < 1000) return false; // late / duplicate
        this.lastSeq = snap.n;

        this.offsets.push(now - snap.t);
        if (this.offsets.length > SNAP.offsetWindow) this.offsets.shift();
        let offset = Infinity;
        for (const o of this.offsets) if (o < offset) offset = o;
        const lt = snap.t + offset; // sender time expressed on our clock
        // How late this packet was compared with the fastest ones, smoothed.
        this.jitter += ((now - lt) - this.jitter) * 0.08;
        if (this.lastT !== null) {
            const dt = clamp(snap.t - this.lastT, 1, 1000);
            this.interval += (dt - this.interval) * 0.1;
        }
        this.lastT = snap.t;
        // Cushion: jitter margin, but never less than ~2 send intervals, so there are
        // always two snapshots to blend and we interpolate instead of guessing ahead.
        this.delay = clamp(Math.max(60 + this.jitter * 3, this.interval * 2.2 + this.jitter), SNAP.minDelay, SNAP.maxDelay);

        const last = this.buf[this.buf.length - 1];
        if (last && Math.hypot(snap.x - last.x, snap.y - last.y) > SNAP.teleportDist) { this.buf.length = 0; this.drawn = null; this.err = null; }
        this.buf.push({ ...snap, lt });
        if (this.buf.length > SNAP.keep) this.buf.shift();
        this.seen = now;
        return true;
    }

    /** Where the player is drawn at local time `now`, or null if nothing usable. */
    sample(now) {
        const b = this.buf;
        if (!b.length) return null;
        if (now - this.seen > SNAP.staleMs) return { ...b[b.length - 1], stale: true };
        const t = now - this.delay;
        let a = b[0], c = b[b.length - 1];
        for (let i = b.length - 1; i > 0; i--) {
            if (b[i - 1].lt <= t) { a = b[i - 1]; c = b[i]; break; }
        }
        let x, y, vx, vy;
        const wasPredicting = this.predicting;
        if (t >= c.lt) {
            // Starved (packets late or lost): predict with the swimming model, briefly.
            ({ x, y, vx, vy } = predict(c, Math.min(t - c.lt, SNAP.predictMs), this.motion));
            this.predicting = true;
        } else {
            const k = a === c ? 1 : clamp((t - a.lt) / (c.lt - a.lt), 0, 1);
            const h = c.lt - a.lt;
            if (a === c || h <= 0) { x = c.x; y = c.y; }
            else {
                // Smooth curve through the snapshots using their velocities (px/step -> px/ms).
                const sx = (c.x - a.x) / h, sy = (c.y - a.y) / h;
                x = hermite(a.x, c.x, tangent(a.vx / STEP, sx), tangent(c.vx / STEP, sx), h, k);
                y = hermite(a.y, c.y, tangent(a.vy / STEP, sy), tangent(c.vy / STEP, sy), h, k);
            }
            vx = lerp(a.vx, c.vx, k); vy = lerp(a.vy, c.vy, k);
            this.predicting = false;
        }
        // A prediction that turned out wrong: start from where the fish was drawn and
        // blend the difference out, instead of snapping.
        if (wasPredicting && !this.predicting && this.drawn) {
            const ex = this.drawn.x - x, ey = this.drawn.y - y;
            if (Math.hypot(ex, ey) < SNAP.teleportDist) this.err = { x: ex, y: ey, at: now };
        }
        if (this.err) {
            const w = 1 - (now - this.err.at) / SNAP.correctMs;
            if (w <= 0) this.err = null;
            else { x += this.err.x * w; y += this.err.y * w; }
        }
        this.drawn = { x, y };
        return { x, y, vx, vy, f: c.f, c: c.c, s: c.s, stale: false };
    }
}
