// Waving hello (user: "when you press the wave button, the character waves, e.g. Lompi waving with his
// fin and beaming"): the multiplayer wave makes the character lift one fin and wave it three times, tilt
// toward the viewer, bob once and beam (eyes squinted into smiling arcs, a wide grin). It rides on top of
// swimming and turning and never stops the body. Characters without a waving fin (profile `wave` unset)
// do a happy wiggle instead. Pure, no Phaser: CardRig and Rig apply the pose.

export const WAVE = {
    s: 1.4,          // how long one wave takes
    waves: 3,        // fin waves
    lift: 1.2,       // rad the fin is lifted (in the picture, nose right: a fin lying back turns up); a profile's `wave.lift` overrides it
    swing: 0.5,      // rad of each wave either side of the lift
    tilt: 0.35,      // rad the body turns toward the viewer
    bob: 0.1,        // the one bob up, share of the picture height
    wiggle: 0.14,    // rad of the happy wiggle (no fin to wave) ...
    wiggles: 4,      // ... this many times
    ease: [0.15, 0.2],   // share of the time the pose takes to come in, and to go again
    beam: [0.08, 0.85]   // the face beams from .. to this share of the time (a little longer than the fin)
};

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * The pose `t` s after the wave started, into `o`: on (still waving), k (0..1 how far in: the fin is lifted
 * by k x its lift), fin (rad of waving on top of the lift), yaw (rad toward the viewer: negative), bob (share of the picture height,
 * negative = up), wiggle (rad to add to the body's turn), happy (0..1: squinted eyes, grin).
 */
export function waveAt(t, o = {}, W = WAVE) {
    const u = t / W.s;
    if (!(u >= 0 && u < 1)) { o.on = false; o.k = 0; o.fin = 0; o.yaw = 0; o.bob = 0; o.wiggle = 0; o.happy = 0; return o; }
    const [a, b] = W.ease, k = smooth(0, a, u) * (1 - smooth(1 - b, 1, u));
    const v = Math.min(1, Math.max(0, (u - a) / (1 - a - b)));      // the waves run while the pose is fully in
    o.on = true; o.k = k;
    o.fin = W.swing * Math.sin(Math.PI * 2 * W.waves * v) * k;
    o.yaw = -W.tilt * k;
    o.bob = -W.bob * Math.sin(Math.PI * u) ** 2;
    o.wiggle = W.wiggle * k * Math.sin(Math.PI * 2 * W.wiggles * v);
    o.happy = smooth(0, W.beam[0], u) * (1 - smooth(W.beam[1], 1, u));
    return o;
}

/** One rig's wave: start() it, step(dt) every drawn frame; `pose` is this frame's waveAt (all 0 when not waving). */
export class Wave {
    constructor() { this.t = -1; this.pose = waveAt(-1); }
    start() { this.t = 0; }
    step(dt) {
        if (this.t < 0) return this.pose;
        this.t += dt;
        waveAt(this.t, this.pose);
        if (!this.pose.on) this.t = -1;
        return this.pose;
    }
}
