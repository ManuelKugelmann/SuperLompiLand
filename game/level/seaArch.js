// The rocky shore's sea arch (pure, no Phaser; spec gamedesign §5.0g). A huge natural arch stands
// in the surf in the middle of the rocky shore. Its painted upper half (img/coast/sea_arch.webp,
// sea_arch.json: the picture's bottom edge is the waterline) shows the opening above the water;
// below the water the rock goes on down to the seabed with the opening continuing under the
// surface, so the calm route swims through it and a jump flies through its top half.
// Tested in tests/seaArch.test.mjs.
import { BIOMES } from './biomes.js';

export const SEA_ARCH = {
    biome: 'shore',
    at: 0.5,              // where in the biome (share of its width)
    scale: 1.25,          // picture px -> world px
    art: { size: [1800, 600], opening: [570, 250, 689, 350] },   // from sea_arch.json
    under: 640,           // px the opening reaches under the surface
    footDepth: 1700,      // px down to which the arch's legs are solid rock (they join the seabed)
    wear: 40,             // px the under-water opening's edge wanders
    coins: 9              // coins in the arc through the opening's top half
};

/**
 * Where everything is, in the world (y grows downward, the surface is y 0):
 * { x (middle), x0, x1 (the arch's outer edges), open: { x0, x1, top, bottom }, scale }
 */
export function seaArch(cfg = SEA_ARCH) {
    const b = BIOMES.find(bi => bi.id === cfg.biome), x = b.from + b.width * cfg.at, k = cfg.scale;
    const [w, h] = cfg.art.size, [ox, oy, ow, oh] = cfg.art.opening;
    const left = x - w * k / 2;
    return {
        x, x0: left, x1: left + w * k, scale: k,
        open: { x0: left + ox * k, x1: left + (ox + ow) * k, top: (oy - h) * k, bottom: cfg.under }
    };
}

/** Is (x, y) the arch's rock (1), its opening (-1), or none of its business (0)? Under the water only (the picture is the part above). */
export function archRock(arch, x, y, cfg = SEA_ARCH) {
    if (y < 0 || y > cfg.footDepth || x < arch.x0 || x > arch.x1) return 0;
    const o = arch.open, wob = Math.sin(y / 97 + x / 211) * cfg.wear * 0.6 + Math.sin(y / 41) * cfg.wear * 0.4;
    // The opening narrows a little with depth and ends in a rounded floor.
    const k = Math.max(0, Math.min(1, y / o.bottom)), half = (o.x1 - o.x0) / 2 * (1 - 0.25 * k * k), mid = (o.x0 + o.x1) / 2;
    if (y < o.bottom && Math.abs(x - mid) < half + wob) return -1;
    return 1;
}

/** Did the fish pass through the opening between two frames (crossing its middle line inside it)? */
export function passedThrough(arch, prev, cur) {
    const mid = (arch.open.x0 + arch.open.x1) / 2;
    if ((prev.x - mid) * (cur.x - mid) > 0 || prev.x === cur.x) return false;
    const y = prev.y + (cur.y - prev.y) * (mid - prev.x) / (cur.x - prev.x);
    return y > arch.open.top && y < arch.open.bottom;
}

/** Coins in an arc through the opening's top half (the bonus line for a jump through the arch). */
export function archCoins(arch, cfg = SEA_ARCH) {
    const o = arch.open, out = [], top = o.top * 0.7;
    for (let i = 0; i < cfg.coins; i++) {
        const u = i / (cfg.coins - 1), x = o.x0 - 260 + u * (o.x1 - o.x0 + 520);
        out.push({ x, y: top + (1 - Math.sin(Math.PI * u)) * -top * 0.9 + 40 });
    }
    return out;
}
