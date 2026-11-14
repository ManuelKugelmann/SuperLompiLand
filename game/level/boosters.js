// Water elements that feed momentum: bubble cannons and bounce pads, placed along the
// streams so a run can flow stream -> cannon -> jump. They are always optional, next to the
// calm water. Momentum is kept: a cannon adds to the speed, a pad returns it at the angle
// it was hit.
//
// Pure rules and placement, no Phaser (tests/boosters.test.mjs). Speeds are px per step.

import { streamY } from './flow.js';

export const BOOST = {
    cannonRadius: 95,     // reach of a bubble cannon's ring
    cannonKick: 10,       // speed a cannon adds along its direction
    cannonMin: 17,        // ... and the least speed anyone leaves it with
    cannonSide: 0.5,      // share of the sideways speed kept (the shot straightens the path)
    cannonRearm: 700,     // ms before the same cannon fires again
    padRadius: 105,       // reach of a bounce pad
    padBounce: 1.15,      // speed returned across the pad (above 1: a springy cushion)
    padMin: 11,           // ... and the least speed it throws back with
    padRearm: 400,
    maxSpeed: 32,         // nothing leaves an element faster than this
    padBelow: 300,        // a pad floats this far under the middle of its stream
    aimReach: 700         // an exit cannon aims at the surface this far ahead
};

/**
 * The elements of one stream (see flow.js): a cannon at its mouth firing along the lane,
 * a cannon at its end firing up and forward toward the surface, and a pad under its middle
 * that throws back up whoever drops out of the lane. (dx, dy) is a unit vector: the firing
 * direction of a cannon, the outward normal of a pad.
 */
export function boostersFor(s, cfg = BOOST) {
    const xin = s.x0 + 60, xout = s.x1 - 60, mid = (s.x0 + s.x1) / 2;
    const slope = Math.cos((xin + 200 - s.x0) / 520 + s.phase) * s.wave / 520, len = Math.hypot(1, slope);
    const yout = streamY(s, xout);
    const up = Math.min(1.0, Math.max(0.3, Math.atan2(yout, cfg.aimReach)));
    return [
        { id: `${s.index}:in`, kind: 'cannon', x: xin, y: streamY(s, xin), dx: 1 / len, dy: slope / len },
        { id: `${s.index}:out`, kind: 'cannon', x: xout, y: yout, dx: Math.cos(up), dy: -Math.sin(up) },
        { id: `${s.index}:pad`, kind: 'pad', x: mid, y: streamY(s, mid) + cfg.padBelow, dx: 0, dy: -1 }
    ];
}

/** Is a body of radius r at (x, y) inside the element's reach? */
export function touches(b, x, y, r, cfg = BOOST) {
    const reach = (b.kind === 'cannon' ? cfg.cannonRadius : cfg.padRadius) + r * 0.5;
    return (x - b.x) ** 2 + (y - b.y) ** 2 < reach * reach;
}

const capped = (out, max) => {
    const speed = Math.hypot(out.x, out.y);
    if (speed > max) { out.x *= max / speed; out.y *= max / speed; }
    return out;
};

/** A cannon shot: adds to the speed along its direction, never replaces it. */
export function cannonShot(vx, vy, b, cfg = BOOST, out = { x: 0, y: 0 }) {
    const along = vx * b.dx + vy * b.dy, side = -vx * b.dy + vy * b.dx;
    const a = Math.max(along + cfg.cannonKick, cfg.cannonMin), s = side * cfg.cannonSide;
    out.x = b.dx * a - b.dy * s; out.y = b.dy * a + b.dx * s;
    return capped(out, cfg.maxSpeed);
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
    return capped(out, cfg.maxSpeed);
}
