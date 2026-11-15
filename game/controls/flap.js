// Flap swimming's stroke (pure, no Phaser; FlapController.js). Every tap is one fin stroke toward
// where it was tapped; fast tapping swims fast, but only up to a top speed (playtest: "limit
// flattern speed"): a stroke adds speed along its direction only as far as that stays under it, so
// steering still works at full speed.

export const FLAP = {
    kick: 10.5,         // px per step a stroke at full deflection adds
    maxSpeed: 18,       // px per step: no stroke takes the fish faster than this along its direction (tuned on a device)
    longPressMs: 380    // held this long: the special instead of a stroke
};

/**
 * How much a stroke adds: `v` = the fish's velocity {x, y}, `dir` = the stroke's direction (unit),
 * `len` = its strength 0..1. Returns the speed to add along `dir` (0 when already at the top speed that way).
 */
export function strokeSpeed(v, dir, len, cfg = FLAP) {
    const along = v.x * dir.x + v.y * dir.y;
    return Math.max(0, Math.min(cfg.kick * len, cfg.maxSpeed - along));
}
