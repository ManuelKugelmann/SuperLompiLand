// The lost container field (pure, no Phaser; spec 5.0i/5.0j world map, hazards 7.1: realistic
// and inanimate): off the harbour, at the end of the kelp island, a handful of shipping
// containers that went overboard drift half sunk in the water, tilted, doors open. They hang
// in the calm route's lane (the open water between the rock): two
// of them lie on the route with both ends open, and the fish swims straight through them along
// a line of coins. They are pictures behind the fish: nothing to bump into, nothing that hurts.

import { BIOMES } from './biomes.js';

export const CONTAINERS = {
    biome: 'kelp',
    at: 0.922,           // where in the biome the field's middle lies (share of the width): off the harbour, where ships lose them
    size: [980, 400],    // px length and height of one container as drawn
    // Each container: px from the field's middle, px above (-) or below (+) the calm route, tilt (radians),
    // which paint it wears (index into the look's colours), and whether the route runs through it.
    boxes: [
        { dx: -1350, dy: -190, tilt: 0.22, paint: 0, through: false },
        { dx: -600, dy: 20, tilt: -0.06, paint: 1, through: true },
        { dx: 150, dy: 200, tilt: 0.3, paint: 2, through: false },
        { dx: 800, dy: -10, tilt: 0.08, paint: 0, through: true },
        { dx: 1500, dy: -180, tilt: -0.25, paint: 1, through: false }
    ],
    coins: 5,            // coins in a line through each container the route runs through
    bob: [14, 0.02]      // px each rises and falls, and radians it rocks, in the swell
};

let SPAN = null;

/** The field's stretch of the world: { x (middle), x0, x1 }. */
export function containerSpan(cfg = CONTAINERS) {
    if (cfg === CONTAINERS && SPAN) return SPAN;
    const b = BIOMES.find(bi => bi.id === cfg.biome), x = b.from + b.width * cfg.at, half = Math.max(...cfg.boxes.map(o => Math.abs(o.dx))) + cfg.size[0] / 2;
    const span = { x, x0: x - half, x1: x + half };
    if (cfg === CONTAINERS) SPAN = span;
    return span;
}

/**
 * The containers in the world: [{ id, x, y, tilt, paint, through, coins: [{ x, y }] }]. `routeY(x)` =
 * depth of the calm route. A container the route runs through lies along the route there, and
 * its coins run through it from end to end.
 */
export function containerField(routeY, cfg = CONTAINERS) {
    const s = containerSpan(cfg), [len] = cfg.size;
    return cfg.boxes.map((o, i) => {
        const x = s.x + o.dx, y = routeY(x) + o.dy;
        // Along the route's own slope when the fish goes through it; else as it happens to hang.
        const tilt = o.through ? Math.atan2(routeY(x + len / 2) - routeY(x - len / 2), len) + o.tilt * 0.5 : o.tilt;
        const coins = !o.through ? [] : Array.from({ length: cfg.coins }, (_, k) => {
            const u = (k / (cfg.coins - 1) - 0.5) * len * 0.8;
            return { x: x + Math.cos(tilt) * u, y: y + Math.sin(tilt) * u };
        });
        return { id: `container${i}`, x, y, tilt, paint: o.paint, through: o.through, coins };
    });
}
