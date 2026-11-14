// The ghost finger's script (pure, no Phaser; spec 9.1 "ghost finger shows the control",
// "tutorial by doing: ghost fingers and icons only"). A loop relative to the fish on screen:
// the finger comes in ahead of the fish, presses and holds while an elastic band stretches
// from the fish to it, lets go (the band snaps back), then double-taps the fish for the special.
// GhostFinger.js draws it. Tested in tests/ghostDemo.test.mjs.

export const GHOST = {
    cycleS: 4.2,          // one demonstration
    cycles: 2,            // shown this many times, then it bows out
    runs: 2,              // ... on this many first game starts
    hold: [140, -70],     // px from the fish where the finger presses (ahead and a little up)
    pull: [330, -130],    // ... and where it drags to while holding
    key: 'sll_finger_runs'
};

const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/**
 * The demo at time t (s): { x, y } of the fingertip relative to the fish, `down` (pressing),
 * `band` (0..1: how visible the elastic band is), `ring` (0..1 progress of a tap ring, or -1),
 * `alpha`, and `done` once all cycles have played.
 */
export function fingerAt(t, cfg = GHOST) {
    if (t >= cfg.cycleS * cfg.cycles) return { x: 0, y: 0, down: false, band: 0, ring: -1, alpha: 0, done: true };
    const c = t % cfg.cycleS, [hx, hy] = cfg.hold, [px, py] = cfg.pull;
    const out = { x: hx, y: hy, down: false, band: 0, ring: -1, alpha: 1, done: false };
    if (c < 0.5) {                                 // glides in from further out, fading in
        const k = ease(c / 0.5);
        out.x = lerp(px + 120, hx, k); out.y = lerp(py - 60, hy, k); out.alpha = k;
    } else if (c < 0.8) {                          // presses: a ring shows where
        out.down = true; out.ring = (c - 0.5) / 0.3;
    } else if (c < 2.0) {                          // holds and drags: the band stretches from the fish
        const k = ease((c - 0.8) / 1.2);
        out.down = true; out.band = 1; out.x = lerp(hx, px, k); out.y = lerp(hy, py, k);
    } else if (c < 2.4) {                          // lets go: the band snaps back
        out.x = px; out.y = py; out.band = 1 - (c - 2.0) / 0.4;
    } else if (c < 2.9) {                          // moves onto the fish
        const k = ease((c - 2.4) / 0.5);
        out.x = lerp(px, 0, k); out.y = lerp(py, -10, k);
    } else if (c < 3.6) {                          // double tap on the fish
        const u = (c - 2.9) / 0.35, i = Math.floor(u);
        out.x = 0; out.y = -10; out.down = (u - i) < 0.45; out.ring = u - i;
    } else {                                       // fades away
        out.x = 0; out.y = -10; out.alpha = 1 - (c - 3.6) / 0.6;
    }
    return out;
}

/** Should the demo play on this start? `runs` = how many starts already showed it. */
export const shouldShow = (runs, cfg = GHOST) => (Number(runs) || 0) < cfg.runs;
