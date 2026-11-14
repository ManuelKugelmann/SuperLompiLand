// Bounce pads: a big friendly jelly under the middle of each stream throws back up whoever
// drops out of the lane, at the angle it was hit. Always optional, next to the calm water.
// (The bubble cannons that stood at the streams' ends are gone: the playtest read them as
// soap-bubble rings that shoot the fish somewhere it did not choose.)
//
// Pure rules and placement, no Phaser (tests/boosters.test.mjs). Speeds are px per step.

import { streamY } from './flow.js';

export const BOOST = {
    padRadius: 105,       // reach of a bounce pad
    padBounce: 1.15,      // speed returned across the pad (above 1: a springy cushion)
    padMin: 11,           // ... and the least speed it throws back with
    padRearm: 400,        // ms before the same pad throws again
    maxSpeed: 32,         // nothing leaves a pad faster than this
    padBelow: 300         // a pad floats this far under the middle of its stream
};

/** The pad of one stream (see flow.js), as a list: under its middle; (dx, dy) is its outward normal (a unit vector, up). */
export function boostersFor(s, cfg = BOOST) {
    const mid = (s.x0 + s.x1) / 2;
    return [{ id: `${s.index}:pad`, kind: 'pad', x: mid, y: streamY(s, mid) + cfg.padBelow, dx: 0, dy: -1 }];
}

/** Is a body of radius r at (x, y) inside the pad's reach? */
export function touches(b, x, y, r, cfg = BOOST) {
    const reach = cfg.padRadius + r * 0.5;
    return (x - b.x) ** 2 + (y - b.y) ** 2 < reach * reach;
}

/**
 * A bounce off a pad: the speed along the pad is kept, the speed into it comes back out.
 * Returns null when the body is not moving into the pad.
 */
export function padBounce(vx, vy, b, cfg = BOOST, out = { x: 0, y: 0 }) {
    const into = vx * b.dx + vy * b.dy;
    if (into >= 0) return null;
    const back = Math.max(-into * cfg.padBounce, cfg.padMin);
    out.x = vx - into * b.dx + back * b.dx; out.y = vy - into * b.dy + back * b.dy;
    const speed = Math.hypot(out.x, out.y);
    if (speed > cfg.maxSpeed) { out.x *= cfg.maxSpeed / speed; out.y *= cfg.maxSpeed / speed; }
    return out;
}
