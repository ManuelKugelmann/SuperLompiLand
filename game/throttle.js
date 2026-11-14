// Decisions run at a low rate, staggered; only motion and drawing run every frame (pure, no
// Phaser). Whatever decides something (a shoal fish's steering, a creature's goal, a layer's
// "is the swimmer near me?" test, a sample of the light) asks here whether it is its turn this
// frame. Each asker has an offset of its own, so the work spreads evenly over the frames
// instead of all landing on the same one. What stays every frame: physics, the player, the
// camera, the places of things in view, the water surface.

export const THINK = {
    // Frames between two decisions, by kind, at the high quality tier.
    every: {
        shoal: 2,       // a shoal fish's steering (boids.js thinkEvery; on top of the shoals' own turns)
        creature: 3,    // a creature's or crawler's goal
        follower: 3,    // the goals of those that follow (friends, fry, birds)
        sample: 6,      // slow things read from the world: light, biome blend, music depth
        check: 4,       // small tests near the swimmer: coin pull, reveal and fade
        idle: 30        // a set piece that is not live: is the swimmer near yet?
    },
    tier: { low: 1.5, medium: 1.25, high: 1 }      // a lower tier decides more slowly
};

/** Frames between two decisions of a kind at a quality tier (a whole number, at least 1). */
export function everyOf(kind, tier = 'high', cfg = THINK) {
    return Math.max(1, Math.round(cfg.every[kind] * (cfg.tier[tier] ?? 1)));
}

/** Whether it is this asker's turn in this frame: every `every` frames, shifted by its own `offset`. */
export function due(frame, every, offset = 0) {
    return every <= 1 || (frame + offset) % every === 0;
}

/** Hands out offsets 0, 1, 2, ... : one per asker, taken once when it is made, so askers of one rate take turns. */
export function createStagger() {
    let n = 0;
    return () => n++;
}

/**
 * An asker's own clock: `turn(frame, dt, every)` gives the time that has passed since its last
 * turn when it is its turn (so nothing is lost in between), else 0.
 */
export function createTurns(offset = 0) {
    let owed = 0;
    return {
        turn(frame, dt, every) {
            owed += dt;
            if (!due(frame, every, offset)) return 0;
            const t = owed;
            owed = 0;
            return t;
        }
    };
}
