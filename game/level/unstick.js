// Never stuck in rock. Pure helpers on the density field (no Phaser;
// tests/unstick.test.mjs):
//   hasRoom   is there open water for a body of this size here?
//   popOut    the nearest spot of open water for a body that overlaps rock —
//             found by walking down the density slope (the shortest way out of
//             the rock, so never through a wall), with a widening search as
//             the fallback. Always under water, never on dry land.
//   wedged    rock on opposite sides of the body
//   Stillness notices a player who pushes but does not get anywhere.
import { FIELD } from './density.js';

export const UNSTICK = {
    slack: 0.015,        // density below threshold - slack counts as open (a little margin from the contour)
    surface: 70,         // open water starts this far below the calm waterline (y = 0)
    step: 14,            // px per step down the slope
    maxSteps: 420,       // far enough to surface from deep under the seabed
    searchStep: 48,      // fallback: rings this far apart ...
    searchMax: 6000,     // ... out to this distance
    stuckMs: 2000,       // pushing without moving for this long = stuck
    stuckSpeed: 0.7      // px per step: slower than this while pushing counts as not moving
};

const RING = Array.from({ length: 8 }, (_, i) => [Math.cos(i * Math.PI / 4), Math.sin(i * Math.PI / 4)]);

/** Open water for a body of `radius` centred here: the centre and its rim are free and under water. */
export function hasRoom(density, x, y, radius, cfg = UNSTICK) {
    const open = FIELD.threshold - cfg.slack;
    if (y - radius < cfg.surface || density(x, y) >= open) return false;
    for (const [dx, dy] of RING) if (density(x + dx * radius, y + dy * radius) >= open) return false;
    return true;
}

/**
 * Where a body of `radius` at (x, y) should be so that it is in open water.
 * @returns { x, y, moved } — the same place with moved = false when there is room already;
 *          null only if no open water exists anywhere near (should not happen in a valid world).
 */
export function popOut(density, x, y, radius, cfg = UNSTICK) {
    if (hasRoom(density, x, y, radius, cfg)) return { x, y, moved: false };
    // Walk down the density slope: out of the rock by the shortest way.
    let px = x, py = Math.max(y, cfg.surface + radius);
    for (let i = 0; i < cfg.maxSteps; i++) {
        const e = 10;
        let gx = density(px + e, py) - density(px - e, py), gy = density(px, py + e) - density(px, py - e);
        const len = Math.hypot(gx, gy);
        if (len < 1e-7) break;                                    // flat: no slope to follow
        px -= gx / len * cfg.step;
        py = Math.max(cfg.surface + radius, py - gy / len * cfg.step);
        if (hasRoom(density, px, py, radius, cfg)) return { x: px, y: py, moved: true };
    }
    // Fallback: the nearest free spot on widening rings.
    for (let r = cfg.searchStep; r <= cfg.searchMax; r += cfg.searchStep) {
        const n = Math.max(8, Math.round(r / 12));
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2, sx = x + Math.cos(a) * r, sy = y + Math.sin(a) * r;
            if (hasRoom(density, sx, sy, radius, cfg)) return { x: sx, y: sy, moved: true };
        }
    }
    return null;
}

/**
 * Wedged: rock touches the body from opposite sides, so there may be no way to
 * swim free. Resting on a floor or leaning on a wall is not wedged.
 */
export function wedged(density, x, y, radius, cfg = UNSTICK) {
    const open = FIELD.threshold - cfg.slack;
    const hit = RING.map(([dx, dy]) => density(x + dx * radius, y + dy * radius) >= open);
    for (let i = 0; i < 8; i++) {
        if (hit[i] && (hit[(i + 3) % 8] || hit[(i + 4) % 8] || hit[(i + 5) % 8])) return true;
    }
    return false;
}

/** Tracks "pushing but not getting anywhere". Call once per step; returns true when the player counts as stuck. */
export class Stillness {
    constructor(cfg = UNSTICK) { this.cfg = cfg; this.ms = 0; }

    /** @param pushing the player is trying to move  @param speed px per step  @param held the body is wedged between rock */
    step(dt, pushing, speed, held) {
        if (pushing && held && speed < this.cfg.stuckSpeed) this.ms += dt;
        else this.ms = 0;
        if (this.ms < this.cfg.stuckMs) return false;
        this.ms = 0;
        return true;
    }
}
