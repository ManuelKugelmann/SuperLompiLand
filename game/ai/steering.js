// Steering for single creatures (spec 6.2, AI v1): small pure helpers that turn "where I
// want to go" into a heading, shared by every creature brain. No Phaser. Angles in radians,
// 0 = east, positive = down (screen coordinates).

/** Shortest signed difference from angle a to angle b. */
export function angleTo(a, b) {
    const d = b - a;
    return Math.atan2(Math.sin(d), Math.cos(d));
}

/** Turn `heading` toward `want`, at most `rate` radians. */
export function turnToward(heading, want, rate) {
    const d = angleTo(heading, want);
    return heading + Math.max(-rate, Math.min(rate, d));
}

/**
 * A wandering heading: smooth, never repeating, different for every `seed`.
 * Mostly level (fish swim more along than up and down).
 */
export function wanderHeading(t, seed) {
    const a = Math.sin(t * 0.31 + seed * 12.9) + Math.sin(t * 0.17 + seed * 4.1) * 0.7;      // which way along
    const pitch = Math.sin(t * 0.43 + seed * 7.7) * 0.45 + Math.sin(t * 0.11 + seed) * 0.2;  // up and down
    return (a > 0 ? 0 : Math.PI) + (a > 0 ? pitch : -pitch);
}

/**
 * Home range: inside it the wish stands; toward its edge the heading is pulled back home,
 * outside it points straight home (a soft leash, no wall).
 */
export function leash(x, y, home, range, want) {
    const dx = home.x - x, dy = home.y - y, d = Math.hypot(dx, dy);
    if (d < range * 0.6) return want;
    const back = Math.atan2(dy, dx), k = Math.min(1, (d - range * 0.6) / (range * 0.4));
    return want + angleTo(want, back) * k;
}

/**
 * Terrain avoidance: probe ahead; if the way is blocked, take the nearest open direction
 * (sliding along the wall), or turn round when boxed in.
 */
export function avoid(isOpen, x, y, want, look) {
    const free = a => isOpen(x + Math.cos(a) * look, y + Math.sin(a) * look) && isOpen(x + Math.cos(a) * look * 0.5, y + Math.sin(a) * look * 0.5);
    if (free(want)) return want;
    for (const off of [0.5, -0.5, 1.0, -1.0, 1.6, -1.6, 2.3, -2.3]) if (free(want + off)) return want + off;
    return want + Math.PI;
}
