// Steering help for the simplest control scheme (pure, no Phaser; spec 1.1 "simple to play"):
// a child points where the fish should go and should get there. Two small helps, both gentle:
//   wall slide   a step or ledge straight in the way is climbed: the pull turns up along its face
//   depth hold   let go, and the fish stays about where it was instead of slowly sinking away
// These are feel constants: they are tuned with a person on a device, not guessed for good.

export const ASSIST = {
    slide: {
        probe: 130,      // px ahead of the fish (the way it is pulled) that is looked at
        step: 300,       // px above that point within which open water is looked for: steps up to this height are climbed
        scan: 40,        // px between two looks on the way up
        climb: 0.85,     // share of the pull that goes upward while climbing (the rest keeps going the way it was)
        surface: 220     // px under the surface above which nothing is climbed: the help never throws the fish out of the water
    },
    hold: {
        slack: 50,       // px the fish may sink below where it was let go before the hold begins to lift it
        full: 220,       // px below that at which the lift is at full strength
        lift: 0.5        // the lift at full strength, as a share of a full stroke
    }
};

/**
 * The direction to pull in: `dir` = where the player points (unit vector), `pos` = the fish,
 * `isOpen(x, y)` = open water there. When the way is blocked just ahead and open a little
 * higher, the pull turns upward along the face (writes into `out`; `out.climbing` says so).
 */
export function slideDir(pos, dir, isOpen, out = { x: 0, y: 0, climbing: false }, cfg = ASSIST.slide) {
    out.x = dir.x; out.y = dir.y; out.climbing = false;
    const ax = pos.x + dir.x * cfg.probe, ay = pos.y + dir.y * cfg.probe;
    if (Math.abs(dir.x) < 0.2 || isOpen(ax, ay)) return out;      // nothing in the way (or the pull is up or down anyway)
    for (let h = cfg.scan; h <= cfg.step; h += cfg.scan) {
        if (ay - h < cfg.surface) break;
        if (!isOpen(ax, ay - h)) continue;
        // Open water above the obstacle: mostly up, a little on, until the way ahead is clear.
        const fx = Math.sign(dir.x) * (1 - cfg.climb), len = Math.hypot(fx, cfg.climb);
        out.x = fx / len; out.y = -cfg.climb / len; out.climbing = true;
        return out;
    }
    return out;      // a real wall: nothing to climb, the pull stays as it is
}

/**
 * How hard to lift (0..lift, a share of a full stroke) a fish that was let go at depth `restY`
 * and is now at `y`: nothing within the slack, then more the further it has sunk.
 */
export function holdLift(y, restY, cfg = ASSIST.hold) {
    const sunk = y - restY - cfg.slack;
    return sunk <= 0 ? 0 : cfg.lift * Math.min(1, sunk / cfg.full);
}
