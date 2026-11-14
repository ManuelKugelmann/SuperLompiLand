// Coast forces (pure, no Phaser; spec 5.0d): the surge in the surf zone on the beach side of
// the lagoon, and the breakers on the outer edge of the coral reef. Both are water velocities
// (px per 60 Hz step) that add to the flow field; neither ever hurts. Time is counted in
// waves (`phase`, one per wave period), so the sea can breathe with the music's bars.

import { floorY, REEF_CREST, reefCrestX } from './biomes.js';

export const SURF = {
    surge: {
        floorMax: 620,     // the surf zone is where the sand lies this close under the surface or closer ...
        fade: 320,         // ... reaching full strength where it is this much shallower still
        depth: 250,        // full at the surface, nothing this deep
        wavelength: 950,   // px from one wave to the next
        speed: 8,          // px/step the water moves at the height of a push
        lift: 0.45         // share of that which goes up on the push and down in the backwash
    },
    breaker: {
        reach: 760,        // px the foam cloud runs on toward the lagoon ...
        lead: 260,         // ... and how far it starts on the sea side of the break
        depth: REEF_CREST.top + 20,   // px the foam reaches down: the water over the reef crest; below it is coral, beside it calm
        set: 3,            // breakers in a set ...
        gap: 3,            // ... then this many quiet waves: the moment to cross
        speed: 13,         // px/step toward the lagoon at the height of a breaker
        down: 0.55,        // share of that which goes down
        drawback: 0.6,     // waves before a set during which the sea draws back ...
        pull: 4            // ... outward, at up to this many px/step
    }
};

const clamp01 = v => (v <= 0 ? 0 : v >= 1 ? 1 : v);
const smooth = v => { const t = clamp01(v); return t * t * (3 - 2 * t); };

/** How much of the surge reaches (x, y): 1 in the shallows at the surface, 0 in deeper water and below the surf zone. */
export function surgeShare(x, y, cfg = SURF.surge) {
    if (y < 0 || y > cfg.depth) return 0;
    return smooth((cfg.floorMax - floorY(x)) / cfg.fade) * (1 - y / cfg.depth);
}

/** Is a push running at x right now (+1 at its height), or the backwash (-1)? */
export function surgeWave(x, phase, cfg = SURF.surge) {
    return Math.sin((phase + x / cfg.wavelength) * Math.PI * 2);      // crests run west, toward the beach
}

/** The surge's water velocity at (x, y): shoreward (west) and up on a push, seaward and down in the backwash. */
export function surgeAt(x, y, phase, out = { x: 0, y: 0 }, cfg = SURF.surge) {
    const k = surgeShare(x, y, cfg);
    if (k <= 0) { out.x = 0; out.y = 0; return out; }
    const s = surgeWave(x, phase, cfg) * k * cfg.speed;
    out.x = -s; out.y = -s * cfg.lift;
    return out;
}

/** World x of the crest of push number n at this phase (for the foam lines that announce it). */
export function surgeCrestX(n, phase, cfg = SURF.surge) {
    return (n + 0.25 - phase) * cfg.wavelength;
}

/** Where the waves break: on the reef crest, just inside the outer edge of the coral reef. */
export function breakerX() {
    return reefCrestX();
}

/**
 * The state of the breakers at this phase: { breaking 0..1 (the foam's force right now),
 * drawback 0..1 (the sea pulling back before a set), wave (which breaker of the set, -1 in the gap) }.
 */
export function breakerState(phase, out = {}, cfg = SURF.breaker) {
    const cycle = cfg.set + cfg.gap, c = ((phase % cycle) + cycle) % cycle;
    if (c < cfg.set) {
        const u = c - Math.floor(c), e = Math.sin(Math.PI * u);
        out.breaking = e * e; out.drawback = 0; out.wave = Math.floor(c);
    } else {
        out.breaking = 0; out.wave = -1;
        out.drawback = smooth((c - (cycle - cfg.drawback)) / cfg.drawback);
    }
    return out;
}

const STATE = {};

/** The breakers' water velocity at (x, y): in the foam toward the lagoon and down; before a set, gently outward; under the foam, nothing. */
export function breakerAt(x, y, phase, out = { x: 0, y: 0 }, cfg = SURF.breaker) {
    out.x = 0; out.y = 0;
    const dx = x - breakerX(cfg);
    if (y < 0 || y > cfg.depth || dx < -cfg.reach || dx > cfg.lead) return out;
    // Strongest at the break, fading along the run toward the lagoon and at the cloud's lower edge.
    const along = dx > 0 ? 1 - dx / cfg.lead : 1 + dx / cfg.reach, k = smooth(along * 2) * smooth((cfg.depth - y) / (cfg.depth * 0.4));
    const st = breakerState(phase, STATE, cfg);
    if (st.breaking > 0) { out.x = -cfg.speed * st.breaking * k; out.y = cfg.speed * cfg.down * st.breaking * k; }
    else if (st.drawback > 0) out.x = cfg.pull * st.drawback * k;
    return out;
}
