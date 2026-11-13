// Eye behaviour: where an eye looks, when it blinks, how wide the pupil is.
// The picture of the eye is drawn elsewhere (render/meshRenderer.js); this is
// only the life in it. Pure and deterministic per seed (tests/eyes.test.mjs).
//
// An eye does not glide after its target: it holds a fixation, and when the
// target has moved far enough it jumps there in a quick saccade, with tiny
// drifts in between. Blinks come at irregular intervals and often with a big
// change of gaze. Two eyes that each look at the same nearby point converge by
// themselves.

export const EYES = {
    reach: 0.9,            // how far the iris may travel from the middle (1 = to the rim)
    saccadeAt: 0.16,       // gaze error (in eye radii) that triggers a jump
    saccadeSpeed: 22,      // how fast a jump closes the error (per second, exponential)
    pursuit: 2.2,          // slow following of small errors (per second)
    drift: 0.012,          // size of the tiny wandering while fixating
    blinkEvery: [2.4, 6.0],   // seconds between blinks
    blinkTime: 0.16,       // seconds a blink takes, closing and opening
    blinkOnSaccade: 0.35,  // chance that a big jump comes with a blink
    restLid: 0.1,          // how much the upper lid covers when relaxed
    pupilRest: 1,          // pupil size in normal light
    pupilDark: 1.35, pupilBright: 0.75, pupilScared: 1.45,
    pupilSpeed: 4          // how fast the pupil adapts (per second)
};

/** Small deterministic random source (mulberry32). */
function random(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export class Gaze {
    constructor(seed = 1, cfg = EYES) {
        this.cfg = cfg;
        this.rand = random(seed);
        this.x = 0; this.y = 0;            // where the iris is, -1..1 (x toward the nose, y up)
        this.goalX = 0; this.goalY = 0;    // the fixation it is settling on
        this.jumping = false;
        this.lid = cfg.restLid;            // 0 = wide open .. 1 = closed
        this.blink = -1;                   // seconds into a blink, -1 = not blinking
        this.nextBlink = this.span(cfg.blinkEvery);
        this.pupil = cfg.pupilRest;
        this.t = 0;
    }

    span([a, b]) { return a + (b - a) * this.rand(); }

    /**
     * @param dt       seconds
     * @param target   { x, y } direction to look, in eye radii from the eye's middle (may be far outside)
     * @param o.light  0 = dark .. 1 = bright (default 0.5)   @param o.scared 0..1
     * @param o.lid    extra lid closing for an expression: 0 = none, 0.4 = sleepy, negative = wide open
     * @returns this (x, y, lid, pupil are the result)
     */
    update(dt, target, { light = 0.5, scared = 0, lid = 0 } = {}) {
        const c = this.cfg;
        this.t += dt;
        // The eye can only turn so far: the wish is clamped to the reachable disc.
        let wx = target.x, wy = target.y;
        const len = Math.hypot(wx, wy);
        if (len > c.reach) { wx *= c.reach / len; wy *= c.reach / len; }
        const err = Math.hypot(wx - this.goalX, wy - this.goalY);
        if (err > c.saccadeAt) {
            // Far enough off: jump. A big jump often comes with a blink.
            if (err > 0.6 && this.blink < 0 && this.rand() < c.blinkOnSaccade) this.blink = 0;
            this.goalX = wx; this.goalY = wy;
            this.jumping = true;
        } else {
            // Close: follow slowly.
            const k = 1 - Math.exp(-c.pursuit * dt);
            this.goalX += (wx - this.goalX) * k; this.goalY += (wy - this.goalY) * k;
        }
        const speed = this.jumping ? c.saccadeSpeed : c.pursuit * 3;
        const k = 1 - Math.exp(-speed * dt);
        this.x += (this.goalX - this.x) * k; this.y += (this.goalY - this.y) * k;
        if (this.jumping && Math.hypot(this.goalX - this.x, this.goalY - this.y) < 0.01) this.jumping = false;
        if (!this.jumping) {
            // Fixation is never perfectly still.
            this.x += Math.sin(this.t * 3.1 + 1.3) * c.drift * dt * 6;
            this.y += Math.cos(this.t * 2.3) * c.drift * dt * 6;
        }

        // Blinking.
        if (this.blink < 0) {
            this.nextBlink -= dt;
            if (this.nextBlink <= 0) this.blink = 0;
        }
        let closed = 0;
        if (this.blink >= 0) {
            this.blink += dt;
            const u = this.blink / c.blinkTime;
            closed = u >= 1 ? 0 : Math.sin(Math.PI * u);          // down and up again
            if (u >= 1) { this.blink = -1; this.nextBlink = this.span(c.blinkEvery); }
        }
        const rest = Math.min(1, Math.max(0, c.restLid + lid - scared * c.restLid));
        this.lid = rest + (1 - rest) * closed;

        // Pupil: wide in the dark and when scared, narrow in bright light.
        const lit = light < 0.5
            ? c.pupilRest + (c.pupilDark - c.pupilRest) * (1 - light * 2)
            : c.pupilRest + (c.pupilBright - c.pupilRest) * (light * 2 - 1);
        const want = lit + (c.pupilScared - lit) * scared;
        this.pupil += (want - this.pupil) * (1 - Math.exp(-c.pupilSpeed * dt));
        return this;
    }
}
