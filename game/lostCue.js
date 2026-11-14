// The lost cue (pure, no Phaser; spec 5.0l): there is no map. When a child stands still for a
// while or keeps swimming the wrong way, a soft arrow at the edge of the picture points to the
// next thing worth going to (the next friend in a net or the next nest); once the fish heads
// that way, the arrow fades again. One gentle hint, never a nag.

export const LOST = {
    idleS: 10,         // s of barely moving after which the cue comes
    westS: 8,          // s of swimming west (away from the journey's direction) after which it comes
    idleSpeed: 1.2,    // px per step below which the fish counts as barely moving
    westSpeed: 2,      // px per step westward from which it counts as swimming west
    headS: 1.5,        // s of heading toward the goal after which the cue fades
    headSpeed: 2.5,    // px per step toward the goal from which that counts
    fadeIn: 0.8, fadeOut: 0.6,   // s the arrow takes to appear and to go
    near: 900          // px: with the goal this close (it is on screen), no arrow is needed
};

/** The next goal east of `x`: the nearest of `xs` (world x of unfreed friends and unreached nests) that lies ahead, or null. */
export function nextGoal(x, xs) {
    let best = null;
    for (const gx of xs) if (gx > x && (best === null || gx < best)) best = gx;
    return best;
}

/**
 * Returns { step(dt s, vx px/step, speed px/step, dxToGoal px (goal x minus fish x), or null when there is no goal) -> alpha 0..1 }.
 * The cue comes after `idleS` of standing still or `westS` of going west, and goes when the
 * fish has headed for the goal for `headS`, or the goal is close.
 */
export function createLostCue(cfg = LOST) {
    let idle = 0, west = 0, heading = 0, on = false, alpha = 0;
    return {
        get on() { return on; },
        step(dt, vx, speed, dxToGoal) {
            if (dxToGoal === null || Math.abs(dxToGoal) < cfg.near) { on = false; idle = west = heading = 0; }
            else {
                idle = speed < cfg.idleSpeed ? idle + dt : 0;
                west = vx < -cfg.westSpeed ? west + dt : 0;
                heading = vx * Math.sign(dxToGoal) > cfg.headSpeed ? heading + dt : 0;
                if (idle >= cfg.idleS || west >= cfg.westS) on = true;
                if (on && heading >= cfg.headS) { on = false; idle = west = 0; }
            }
            alpha = on ? Math.min(1, alpha + dt / cfg.fadeIn) : Math.max(0, alpha - dt / cfg.fadeOut);
            return alpha;
        }
    };
}
