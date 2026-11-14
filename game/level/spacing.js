// Variety on the seabed: the same picture is never placed twice close together.
// Pure, no Phaser (tests/spacing.test.mjs).

/**
 * Remembers where each key was last placed.
 *   options(keys, x, y)  the keys that have no twin within `minDist` of (x, y)
 *   add(key, x, y)       note a placement
 * Only the latest `keep` placements are remembered (the world is built around the player).
 */
export function createSpacing(minDist, keep = 96) {
    const placed = [];
    return {
        options(keys, x, y) {
            return keys.filter(k => !placed.some(p => p.key === k && Math.hypot(p.x - x, p.y - y) < minDist));
        },
        add(key, x, y) {
            placed.push({ key, x, y });
            if (placed.length > keep) placed.shift();
        }
    };
}
