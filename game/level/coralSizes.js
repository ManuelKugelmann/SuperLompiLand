// Corals come in many sizes (pure, no Phaser; spec 5.0l "multi-scale life"): most are small
// detail, some stand as tall as the fish or taller, a few are big growths. (The huge colonies,
// 4 to 8 fish long, are landmarks of their own: worldMap.js 'colony'.) Sizes are in lengths of
// the fish, so the reef keeps its scale whatever the pictures' pixel sizes are.

export const CORAL_SIZES = {
    lompi: 170,      // px: the fish's length
    // [share of all corals, smallest, biggest (fish lengths, the picture's longer side)]
    classes: { small: [0.6, 0.45, 0.9], medium: [0.3, 1, 1.8], large: [0.1, 2, 3.2] },
    front: 'small'   // only this class may stand in front of the fish as detail; the bigger ones stand behind the play plane
};

/**
 * The size of one coral from a random number `u` (0..1): { cls, px (its longer side), front
 * (it may stand in front of the fish) }. The classes share `u`'s range by their shares, and
 * inside a class the size runs evenly from its smallest to its biggest.
 */
export function coralSize(u, cfg = CORAL_SIZES) {
    let from = 0;
    for (const [cls, [share, lo, hi]] of Object.entries(cfg.classes)) {
        if (u < from + share || cls === 'large') {
            const k = Math.min(1, Math.max(0, (u - from) / share));
            return { cls, px: cfg.lompi * (lo + (hi - lo) * k), front: cls === cfg.front };
        }
        from += share;
    }
    return null;
}
