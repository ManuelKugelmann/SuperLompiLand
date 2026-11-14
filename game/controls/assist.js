// Steering help for the simplest control scheme (pure, no Phaser; spec 1.1 "simple to play"):
// a child points where the fish should go and should get there. Two small helps, both gentle:
//   wall slide   a step or ledge straight in the way is climbed: the pull turns up along its face
//   depth hold   let go, and the fish stays about where it was instead of slowly sinking away
//   level        while the pull is mostly sideways, speed up or down that the player did not ask for is damped
// These are feel constants: they are tuned with a person on a device, not guessed for good.

export const ASSIST = {
    slide: {
        probe: 130,      // px ahead of the fish (the way it is pulled) that is looked at
        step: 300,       // px above that point within which open water is looked for: steps up to this height are climbed
        scan: 40,        // px between two looks on the way up
        climb: 0.85,     // share of the pull that goes upward while climbing (the rest keeps going the way it was)
        surface: 220,    // px under the surface above which nothing is climbed: the help never throws the fish out of the water
        force: 0.7,      // strength of the pull while climbing, as a share of a full pull (a climb, not a launch)
        maxRise: 5       // px per step: a fish already rising this fast gets no more lift from the climb
    },
    hold: {
        slack: 15,       // px the fish may sink below where it was let go before the hold begins to lift it
        full: 90,        // px below that at which the lift is at full strength
        lift: 0.5,       // the lift at full strength, as a share of a full stroke
        dive: 150,       // px the finger must be below the fish for the pull to count as "steered down": only then a release takes a deeper depth to hold
        diveDir: 0.5     // ... and for schemes that steer by a direction: the downward share of it from which it counts as a dive
    },
    lane: {
        below: 250,      // px under the calm lane's lower edge from which a depth the player did not choose is eased back up
        stop: 0,         // ... and px under that edge at which the easing, once started, ends
        rise: 40,        // px per second by which the held depth then rises toward that edge
        level: 0.15      // the pull counts as level (the hold keeps working during it) while its up or down part is below this share
    },
    level: {
        flat: 0.4,       // the pull counts as "mostly sideways" while its up or down part is below this share of it
        damp: 0.09,      // share of a full stroke per px/step of unwanted speed up or down
        max: 0.6         // ... but never more than this share of a full stroke
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

/** How hard to pull while climbing (0..1 of a full pull) for a fish moving at `vy` px per step (negative = rising): nothing once it rises fast enough. */
export function climbForce(vy, cfg = ASSIST.slide) {
    return vy <= -cfg.maxRise ? 0 : cfg.force;
}

/**
 * The depth to hold after letting go at `y`, given the depth held before (`rest`, or null) and
 * whether the player steered down during the pull: the shallower of the two, unless the player
 * dived on purpose. So a row of level taps does not ratchet the fish downward, and a child who
 * dives to the eels stays there.
 */
export function restDepth(y, rest, steeredDown) {
    return rest !== null && y > rest && !steeredDown ? rest : y;
}

/** Did the player steer down? `fingerY` and `fishY` in world px. */
export function steersDown(fingerY, fishY, cfg = ASSIST.hold) {
    return fingerY - fishY > cfg.dive;
}

/**
 * While the player pulls mostly sideways: the thrust (share of a full stroke, positive = down)
 * that damps speed up or down the player did not ask for (after a slope, a current, a bounce).
 * `dirY` = the up or down part of the pull's unit direction, `vy` = the fish's speed down (px/step).
 */
export function levelThrust(dirY, vy, cfg = ASSIST.level) {
    if (Math.abs(dirY) >= cfg.flat || vy * dirY > 0) return 0;      // the player steers up or down, or the fish already goes where the pull points
    return Math.max(-cfg.max, Math.min(cfg.max, -vy * cfg.damp)) + 0;      // + 0: never a negative zero
}

/**
 * Whether the held depth is being eased back to the calm lane: it starts once a depth the player
 * did not dive to lies more than `below` px under the lane's lower edge, and then goes on until
 * the depth has reached `stop` px under that edge (`was` = it was easing already). A depth the
 * player chose by diving is never eased.
 */
export function easing(rest, laneBottom, chosen, was, cfg = ASSIST.lane) {
    return !chosen && rest !== null && rest > laneBottom + (was ? cfg.stop : cfg.below);
}

/** The held depth a moment later while it is eased: up by `rise` px per second, no higher than `stop` px under the lane's lower edge. `dt` s. */
export function easeRest(rest, laneBottom, dt, cfg = ASSIST.lane) {
    return Math.max(laneBottom + cfg.stop, rest - cfg.rise * dt);
}
