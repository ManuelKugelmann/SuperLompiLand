// The two things that close the surface way across the open sea for a stretch (pure, no
// Phaser; spec 5.0c): a storm, under which the way on is below, and a downwelling current that
// pulls into the deep and comes up again further on. Both bend the calm route down, so the
// clear path always shows where to go, and neither is ever a dead end. Velocities are water
// speeds in px per 60 Hz step, to add to the flow field.

import { BIOMES } from './biomes.js';
import { chapters } from '../journey.js';

export const WEATHER = {
    storm: {
        biome: 'wreck', at: 0.475, length: 6300,   // which sea, where in it the storm's middle lies (share of its width), and how long it is (px)
        ramp: 1300,        // px over which it builds up and dies down at its edges
        routeY: 1300,      // the calm route passes this deep underneath
        depth: 340,        // the top layer of water the storm churns
        push: 7,           // px/step the churned water runs back west
        gust: 0.35,        // share of that which comes and goes in gusts
        waves: 2.4,        // the swell is this many times higher (added to 1)
        wind: 0.28         // px/step per step the wind takes from anything in the air
    },
    down: {
        seas: ['blue', 'wreck'],   // in which seas such currents run ...
        at: 0.14,          // ... the first one this share of the way into each ...
        every: 35000,      // ... and again every so many px (spec 5.0i)
        margin: 8000,      // px before the sea's end where the last one must have come up again
        keep: 5000,        // px they stay away from the storm and from the journey's friends and events
        span: 4400,        // px further east it comes up again
        halfWidth: 380,    // of each column; swim sideways this far and you are out
        top: 140,          // the columns begin this far under the surface
        speed: 11,         // px/step down in the one, up in the other
        routeY: 2300,      // how deep the calm route runs between them
        ramp: 2500         // px over which the route sinks and climbs
    }
};

const clamp01 = v => (v <= 0 ? 0 : v >= 1 ? 1 : v);
const smooth = v => { const t = clamp01(v); return t * t * (3 - 2 * t); };
const biome = id => BIOMES.find(b => b.id === id);
let STORM_SPAN = null, PAIRS = null;      // the shipped storm and current: worked out once (asked for many times a frame)

/** The storm's stretch of the world: { x0, x1 }. */
export function stormSpan(cfg = WEATHER.storm) {
    if (cfg === WEATHER.storm && STORM_SPAN) return STORM_SPAN;
    const b = biome(cfg.biome), mid = b.from + b.width * cfg.at, span = { x0: mid - cfg.length / 2, x1: mid + cfg.length / 2 };
    if (cfg === WEATHER.storm) STORM_SPAN = span;
    return span;
}

/** How much storm there is over x: 0 outside, 1 in the middle, building over `ramp` at both ends. */
export function stormShare(x, cfg = WEATHER.storm) {
    const { x0, x1 } = stormSpan(cfg);
    return Math.min(smooth((x - x0) / cfg.ramp), smooth((x1 - x) / cfg.ramp));
}

/** The storm's water velocity: the churned top layer runs back west in gusts; below it the sea is calm. */
export function stormAt(x, y, t, out = { x: 0, y: 0 }, cfg = WEATHER.storm) {
    out.x = 0; out.y = 0;
    const k = stormShare(x, cfg);
    if (k <= 0 || y < 0 || y > cfg.depth) return out;
    const gust = 1 - cfg.gust + cfg.gust * Math.sin(t * 1.7 + x / 600);
    out.x = -cfg.push * k * gust * smooth((cfg.depth - y) / (cfg.depth * 0.5));
    return out;
}

/** Every downwelling of the world, west to east: [{ down, up }] = where each goes down and where it comes up again (world x). */
export function downwellings(cfg = WEATHER.down) {
    if (cfg === WEATHER.down && PAIRS) return PAIRS;
    const { x0, x1 } = stormSpan(), keep = [[x0, x1]], out = [];
    for (const c of chapters()) {
        keep.push([c.x, c.x]);
        if (c.event) keep.push([c.event.x, c.event.endX]);
    }
    for (const id of cfg.seas) {
        const b = biome(id);
        for (let down = b.from + b.width * cfg.at; down + cfg.span + cfg.margin < b.from + b.width; down += cfg.every) {
            const from = down - cfg.ramp - cfg.keep, to = down + cfg.span + cfg.ramp + cfg.keep;
            if (!keep.some(([a, z]) => to > a && from < z)) out.push({ down, up: down + cfg.span });
        }
    }
    if (cfg === WEATHER.down) PAIRS = out;
    return out;
}

/** The downwelling nearest to x (the first one when no x is given): { down, up }. */
export function downwelling(x, cfg = WEATHER.down) {
    const all = downwellings(cfg);
    let best = all[0];
    if (x !== undefined) for (const p of all) if (Math.abs((p.down + p.up) / 2 - x) < Math.abs((best.down + best.up) / 2 - x)) best = p;
    return best;
}

/** The downwelling's water velocity: straight down in the one column, straight up in the other, between `top` and a little under the route. */
export function downAt(x, y, out = { x: 0, y: 0 }, cfg = WEATHER.down) {
    out.x = 0; out.y = 0;
    const { down, up } = downwelling(x, cfg), bottom = cfg.routeY + 250;
    if (y < cfg.top || y > bottom || x < down - cfg.halfWidth || x > up + cfg.halfWidth) return out;
    const ends = smooth((y - cfg.top) / 200) * smooth((bottom - y) / 300);
    const col = c => smooth(1 - Math.abs(x - c) / cfg.halfWidth);
    out.y = cfg.speed * ends * (col(down) - col(up));
    return out;
}

/**
 * Where the calm route leaves its near-surface line: { y, k } = the depth it goes to and how
 * far (0..1) it has gone there at x. Under the storm, and between the two columns of the
 * downwelling, it runs deep; the way down and up is gentle.
 */
export function detour(x, out = { y: 0, k: 0 }) {
    const s = WEATHER.storm, d = WEATHER.down, { down, up } = downwelling(x, d);
    const ks = stormShare(x, s);
    const kd = Math.min(smooth(0.5 + (x - down) / d.ramp), smooth(0.5 + (up - x) / d.ramp));
    if (ks >= kd) { out.y = s.routeY; out.k = ks; } else { out.y = d.routeY; out.k = kd; }
    return out;
}

/** Is x within `range` px of the storm or of the downwelling's columns? (their looks are only built when one is near) */
export function weatherNear(x, range) {
    const { x0, x1 } = stormSpan(), { down, up } = downwelling(x);
    return (x > x0 - range && x < x1 + range) || (x > down - range && x < up + range);
}

/** The stretches of the world (x) in which the storm and the downwellings can act at all: { storm: [x0, x1], downs: [[x0, x1], ...] }. */
export function weatherZones() {
    const { x0, x1 } = stormSpan();
    return { storm: [x0, x1], downs: downwellings().map(p => [p.down - WEATHER.down.halfWidth, p.up + WEATHER.down.halfWidth]) };
}
