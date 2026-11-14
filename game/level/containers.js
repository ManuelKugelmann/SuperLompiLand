// The lost container field (pure, no Phaser; spec 5.0i/5.0j world map, hazards 7.1: realistic
// and inanimate): off the harbour, at the end of the kelp island, a handful of shipping
// containers that went overboard float half sunk at the surface, tilted, rocking in the swell,
// one lying on top of another. One has both ends open: the fish swims through its sunken half
// along a line of coins. More coins hang in a row under each, and a trail of coins leads up to
// the field from the calm route below. They are pictures: nothing to bump into, nothing that hurts.

import { BIOMES } from './biomes.js';

export const CONTAINERS = {
    biome: 'kelp',
    at: 0.922,           // where in the biome the field's middle lies (share of the width): off the harbour, where ships lose them
    size: [980, 400],    // px length and height of one container as drawn
    // Each container: px from the field's middle, the share of its height under the waterline (the painted
    // pictures have their wet band and algae at 64 % of their height, so about 0.36), its tilt
    // (radians), which paint it wears (index into the look's colours), `open` = both ends open (the fish
    // swims through), `on` = it lies on top of the container with that index instead of floating.
    boxes: [
        { dx: -1500, sunk: 0.36, tilt: 0.1, paint: 0 },
        { dx: -350, sunk: 0.39, tilt: -0.05, paint: 2, open: true },      // paint 2 is the picture with its doors open
        { dx: 800, sunk: 0.34, tilt: 0.14, paint: 1 },
        { dx: 2000, sunk: 0.37, tilt: -0.12, paint: 0 },
        { dx: 900, tilt: -0.2, paint: 0, on: 2 }
    ],
    through: 5,          // coins in a line through the open container's sunken half
    under: 3,            // coins in a row under each floating container ...
    underGap: 130,       // ... this far under its bottom
    trail: 6,            // coins that lead up from the calm route to the field's west end
    rock: 0.05,          // radians each rocks in the swell
    shadow: 0.3,         // darkness of the shadow in the water under each
    // A leap that comes down on a floating container's roof bounces off it (only from above: never a wall from the side or below).
    roof: { reach: 0.46, band: 70, spring: 1.1, least: 10, again: 0.35 }   // share of the length that counts as roof; px above and below the roof line that catch a falling fish; speed returned; the least speed up (px per step); s before it can bounce again
};

let SPAN = null;

/** The field's stretch of the world: { x (middle), x0, x1 }. */
export function containerSpan(cfg = CONTAINERS) {
    if (cfg === CONTAINERS && SPAN) return SPAN;
    const b = BIOMES.find(bi => bi.id === cfg.biome), x = b.from + b.width * cfg.at;
    const span = { x, x0: x + Math.min(...cfg.boxes.map(o => o.dx)) - cfg.size[0] / 2, x1: x + Math.max(...cfg.boxes.map(o => o.dx)) + cfg.size[0] / 2 };
    if (cfg === CONTAINERS) SPAN = span;
    return span;
}

/**
 * The containers: [{ id, x, y, tilt, paint, open, stacked }]. `y` = how far the container's
 * middle lies under the water surface there (negative: above it); whoever draws it adds the
 * surface's own height. A stacked one lies on the container below it, out of the water.
 */
export function containerField(cfg = CONTAINERS) {
    const s = containerSpan(cfg), h = cfg.size[1];
    const float = o => h * (o.sunk - 0.5);
    return cfg.boxes.map((o, i) => ({
        id: `container${i}`, x: s.x + o.dx, tilt: o.tilt, paint: o.paint, open: !!o.open, stacked: o.on !== undefined,
        y: o.on === undefined ? float(o) : float(cfg.boxes[o.on]) - h * 0.92
    }));
}

/**
 * The field's coins, for a calm surface at y 0: [{ x, y }]. A trail up from the calm route, a
 * row under each floating container, and a line through the open one's sunken half.
 */
export function containerCoins(routeY, cfg = CONTAINERS) {
    const s = containerSpan(cfg), [len, h] = cfg.size, out = [], boxes = containerField(cfg);
    const from = { x: s.x0 - 900, y: routeY(s.x0 - 900) - 130 }, first = boxes[0], to = { x: first.x - len * 0.3, y: first.y + h / 2 + cfg.underGap };
    for (let i = 0; i < cfg.trail; i++) { const u = i / cfg.trail; out.push({ x: from.x + (to.x - from.x) * u, y: from.y + (to.y - from.y) * u }); }
    for (const b of boxes) {
        if (b.stacked) continue;
        if (b.open) {
            // Through its sunken half, along its axis, a little under the waterline.
            const dy = Math.max(60, (b.y + h / 2) * 0.5);
            for (let k = 0; k < cfg.through; k++) { const u = (k / (cfg.through - 1) - 0.5) * len * 0.8; out.push({ x: b.x + Math.cos(b.tilt) * u, y: dy + Math.sin(b.tilt) * u }); }
        } else {
            for (let k = 0; k < cfg.under; k++) out.push({ x: b.x + (k - (cfg.under - 1) / 2) * len * 0.3, y: b.y + h / 2 + cfg.underGap });
        }
    }
    return out;
}

/**
 * Does a fish at (fx, fy), moving down at `vy` px per step (positive = falling), land on this
 * container's roof? `surface` = the water surface's height under the container's middle.
 * Only a floating container has a roof to land on, and only a fish that comes from above does.
 */
export function landsOnRoof(box, surface, fx, fy, vy, cfg = CONTAINERS) {
    if (box.stacked || vy <= 0) return false;
    const [len, h] = cfg.size, roof = surface + box.y - h / 2 + Math.tan(box.tilt) * (fx - box.x);
    return Math.abs(fx - box.x) < len * cfg.roof.reach && Math.abs(fy - roof) < cfg.roof.band;
}

/** The speed up (negative, px per step) a fish leaves the roof with when it came down at `vy`: a springy bounce, never a feeble one. */
export function roofBounce(vy, cfg = CONTAINERS) {
    return -Math.max(cfg.roof.least, Math.abs(vy) * cfg.roof.spring);
}
