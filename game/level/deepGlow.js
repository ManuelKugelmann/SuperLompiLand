// Glowing life of the deep (pure, no Phaser; spec gamedesign §5.0e "Trench: the descent to the
// grand nest"). As the light fades with depth, things that make their own light take over:
// pulsing jellies, long siphonophore strings and drifting sparks of plankton. Placed per world
// cell, deterministic, so every visit (and every player in a room) sees the same deep.
// DeepGlowLayer.js draws them. Tested in tests/deepGlow.test.mjs.
import { rng } from './layerMath.js';

export const DEEP_GLOW = {
    cell: 700,            // world px per placement cell
    startY: 1700,         // nothing glows above this depth (world y) ...
    fullY: 3600,          // ... and from here on the deep is fully alive
    perCell: 1.3,         // things per cell at full depth
    night: 0.35,          // share of that alive in shallow water at full night (lanternfish rising, plankton sparks)
    kinds: [              // [kind, weight, size range px]
        ['jelly', 5, [100, 190]],
        ['string', 2, [320, 720]],
        ['sparks', 4, [160, 320]]
    ],
    hues: [0x7fe9ff, 0xff8ad8, 0x9dff9a, 0xc0a8ff]    // cyan, pink, green, violet
};

const smooth = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

/** How alive the deep is at world y (0 above startY .. 1 from fullY on). */
/** How alive the glow is at world y (0..1): by depth, and at night (0..1) a little everywhere. */
export const glowShare = (y, cfg = DEEP_GLOW, night = 0) => Math.max(smooth((y - cfg.startY) / (cfg.fullY - cfg.startY)), night * cfg.night);

/**
 * The glowing things of cell (cx, cy): [{ kind, x, y, size, hue, phase }]. `isOpen(x, y)` (optional)
 * keeps them out of rock. Deterministic for a seed.
 */
export function glowCell(cx, cy, seed = 1337, isOpen = null, cfg = DEEP_GLOW, night = 0) {
    const r = rng(((seed * 92821 + cx * 68917) ^ (cy * 31337)) >>> 0);
    const share = glowShare((cy + 0.5) * cfg.cell, cfg, night);
    if (share <= 0) return [];
    const want = cfg.perCell * share, n = Math.floor(want) + (r() < want % 1 ? 1 : 0);
    const total = cfg.kinds.reduce((a, k) => a + k[1], 0), out = [];
    for (let i = 0; i < n; i++) {
        let roll = r() * total, kind = cfg.kinds[0];
        for (const k of cfg.kinds) { roll -= k[1]; if (roll <= 0) { kind = k; break; } }
        const [name, , [s0, s1]] = kind;
        const x = (cx + 0.1 + r() * 0.8) * cfg.cell, y = (cy + 0.1 + r() * 0.8) * cfg.cell;
        const size = s0 + r() * (s1 - s0), hue = cfg.hues[Math.floor(r() * cfg.hues.length)], phase = r() * Math.PI * 2;
        if (isOpen && !isOpen(x, y)) continue;
        out.push({ kind: name, x, y, size, hue, phase });
    }
    return out;
}
