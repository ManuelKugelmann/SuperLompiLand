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
    coastMs: 250      // keep drifting on the last velocity this long when starved
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, k) => a + (b - a) * k;

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
    }

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
        if (last && Math.hypot(snap.x - last.x, snap.y - last.y) > SNAP.teleportDist) this.buf.length = 0;
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
        if (t >= c.lt) {
            // Past the newest snapshot: coast on its velocity (60 Hz steps), briefly.
            const dt = Math.min(t - c.lt, SNAP.coastMs) / (1000 / 60);
            x = c.x + c.vx * dt; y = c.y + c.vy * dt; vx = c.vx; vy = c.vy;
        } else {
            const k = a === c ? 1 : clamp((t - a.lt) / (c.lt - a.lt), 0, 1);
            x = lerp(a.x, c.x, k); y = lerp(a.y, c.y, k);
            vx = lerp(a.vx, c.vx, k); vy = lerp(a.vy, c.vy, k);
        }
        return { x, y, vx, vy, f: c.f, c: c.c, s: c.s, stale: false };
    }
}
