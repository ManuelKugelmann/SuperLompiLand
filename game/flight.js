// Flight above the water. Two models, switched by FLIGHT.model (or ?flight=ballistic):
//
//   'bird'       high momentum, like a bird or a small plane: input turns the heading and never
//                adds speed; wings carry part of the weight while the flight is fast; diving
//                gains speed, climbing spends it, tight turns cost a little; too slow = stall.
//   'ballistic'  the old model: a thrown stone whose path can be bent a little.
//
// Pure maths, no Phaser (tests/flight.test.mjs). Speeds are px per step, angles radians.

export const FLIGHT = {
    model: 'bird',
    stall: 4,          // below this speed the wings do nothing: no lift, no steering
    speed: 12,         // from this speed on they work fully
    lift: 0.6,         // share of the weight carried in fast level flight (a character's `glide.lift` may be higher)
    turn: 0.055,       // radians per step the heading can turn at full speed (old model: 0.009); a loop takes ~2 s
    turnDrag: 0.08,    // share of speed lost per radian turned (a full loop costs about 40 %)
    brakeDrag: 0.04    // air drag while a pose is held (the puffed ball is an air brake; normal air: 0.0015)
};

if (typeof window !== 'undefined') {
    const model = new URLSearchParams(window.location.search).get('flight');
    if (model === 'bird' || model === 'ballistic') FLIGHT.model = model;
}

/** How well the wings work at this speed, 0 (stalled) .. 1. */
export function grip(speed, cfg = FLIGHT) {
    return Math.min(1, Math.max(0, (speed - cfg.stall) / (cfg.speed - cfg.stall)));
}

/**
 * One step of bird flight.
 *   vx, vy    velocity now
 *   ix, iy    steering input (length 0..1; 0 = hands off)
 *   gravity   downward acceleration acting on the body
 *   lift      share of the weight the wings can carry (default cfg.lift)
 *   agility   multiplier on the turn rate (a character's airTurn)
 * Writes to `out`: vx, vy = the velocity after steering; ax, ay = the wings' acceleration,
 * to be applied on top of gravity. Lift acts across the flight path only, so a dive still
 * speeds up and a climb still slows down.
 */
export function fly({ vx, vy, ix = 0, iy = 0, gravity, lift, agility = 1 }, cfg = FLIGHT, out = {}) {
    let speed = Math.hypot(vx, vy);
    out.vx = vx; out.vy = vy; out.ax = 0; out.ay = 0;
    const g = grip(speed, cfg);
    if (g <= 0) return out;
    let heading = Math.atan2(vy, vx);
    const input = Math.min(1, Math.hypot(ix, iy));
    if (input > 0.01) {
        let want = Math.atan2(iy, ix) - heading;
        want = Math.atan2(Math.sin(want), Math.cos(want));
        const max = cfg.turn * agility * input * g;
        const da = Math.max(-max, Math.min(max, want));
        heading += da;
        speed *= 1 - cfg.turnDrag * Math.abs(da);
        out.vx = Math.cos(heading) * speed; out.vy = Math.sin(heading) * speed;
    }
    // Across the path: n = (-sin, cos); gravity's share along n is gravity * cos(heading).
    const across = gravity * Math.cos(heading) * (lift ?? cfg.lift) * g;
    out.ax = Math.sin(heading) * across;
    out.ay = -Math.cos(heading) * across;
    return out;
}
