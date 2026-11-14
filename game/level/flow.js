// The water moves. One field says how, for everything that floats or swims:
// the player, particles, later plants, swarms and props.
//
//   swell    a slow to-and-fro near the surface that fades with depth
//   streams  currents that run through open water like lanes: enter one and it
//            carries you along. They are placed by the seed, lead east, and
//            are the first of the world's "speed gifts".
//
// Pure and deterministic (no Phaser; tests/flow.test.mjs). Velocities are in
// world px per physics step, like the player's.
import { hash, vnoise } from './terrain.js';
import { floorY, WORLD_WEST, WORLD_END } from './biomes.js';

export const FLOW = {
    swell: 0.9,            // strongest to-and-fro at the surface (px per step)
    swellDepth: 700,       // depth by which it has faded away
    streamEvery: 4200,     // one stream slot per this much world width ...
    streamChance: 0.7,     // ... which holds a stream this often
    streamLength: [1500, 2600],
    streamWidth: 150,      // distance from the middle at which the pull has dropped to about a third
    streamSpeed: 19,       // speed of the water in the middle of a stream: above the swimmers' own top speed (Lompi ~17); was 11
    streamWave: 170,       // how far a stream's path swings up and down
    carry: 0.045,          // how quickly the water takes a body up to its own speed (per step)
    calm: [200, 420]       // px from the calm route's middle: no stream pull inside the first, full pull beyond the second
};

/**
 * The stream in slot `i`, or null. A stream follows a gentle wave between the
 * surface and the seabed and fades in and out at its ends.
 */
export function streamInSlot(i, seed, cfg = FLOW) {
    if (hash(i, 11, seed) > cfg.streamChance) return null;
    const [a, b] = cfg.streamLength;
    const length = a + (b - a) * hash(i, 12, seed);
    const x0 = i * cfg.streamEvery + hash(i, 13, seed) * (cfg.streamEvery - length);
    if (x0 < WORLD_WEST + 2500 || x0 + length > WORLD_END - 600) return null;
    const mid = x0 + length / 2;
    const y0 = 320 + (floorY(mid) * 0.5 - 320) * (0.25 + 0.6 * hash(i, 14, seed));
    return { index: i, x0, x1: x0 + length, y0, phase: hash(i, 15, seed) * 6.28, wave: cfg.streamWave * (0.5 + 0.5 * hash(i, 16, seed)) };
}

/** Height of a stream's middle line at world x. */
export function streamY(s, x) {
    return s.y0 + Math.sin((x - s.x0) / 520 + s.phase) * s.wave;
}

/**
 * @param calmY  optional: x -> y of the calm main route. Streams lose their pull near it,
 *               so the route stays calm even where a stream crosses it.
 */
export function createFlow(seed, cfg = FLOW, calmY = null) {
    const slots = new Map();
    const slot = i => { if (!slots.has(i)) slots.set(i, streamInSlot(i, seed, cfg)); return slots.get(i); };

    /** Streams that touch the range x0..x1 (for drawing them and for placing things along them). */
    const streamsIn = (x0, x1) => {
        const found = [];
        for (let i = Math.floor(x0 / cfg.streamEvery) - 1; i <= Math.floor(x1 / cfg.streamEvery); i++) {
            const s = slot(i);
            if (s && s.x1 > x0 && s.x0 < x1) found.push(s);
        }
        return found;
    };

    /** Water velocity at a point and time (t in seconds), written into `out` = { x, y }. */
    const at = (x, y, t, out) => {
        out.x = 0; out.y = 0;
        if (y < 0) return out;                                   // air
        if (y < cfg.swellDepth) {
            const k = (1 - y / cfg.swellDepth) * cfg.swell;
            out.x += Math.sin(t * 0.7 + x / 900) * k * (0.6 + 0.8 * vnoise(x / 1300, t * 0.05, seed + 5));
            out.y += Math.cos(t * 0.9 + x / 700) * k * 0.3;
        }
        const i = Math.floor(x / cfg.streamEvery);
        for (let k = i - 1; k <= i; k++) {
            const s = slot(k);
            if (!s || x < s.x0 || x > s.x1) continue;
            const cy = streamY(s, x), d = (y - cy) / cfg.streamWidth;
            if (Math.abs(d) > 2.6) continue;
            const ends = Math.min(1, (x - s.x0) / 260, (s.x1 - x) / 260);          // fades in and out
            let speed = cfg.streamSpeed * Math.exp(-d * d) * ends * ends * (3 - 2 * ends);
            if (calmY) {
                const k = Math.min(1, Math.max(0, (Math.abs(y - calmY(x)) - cfg.calm[0]) / (cfg.calm[1] - cfg.calm[0])));
                speed *= k * k * (3 - 2 * k);
            }
            const slope = Math.cos((x - s.x0) / 520 + s.phase) * s.wave / 520;     // the lane's direction
            const len = Math.hypot(1, slope);
            out.x += speed / len; out.y += speed * slope / len;
        }
        return out;
    };

    return { at, streamsIn };
}

/**
 * What moving water does to a body: it takes it up to its own speed, but never
 * slows it down — whoever enters a stream fast leaves it faster.
 * Writes the change of velocity for one step into `out` = { x, y }.
 */
export function carry(flowX, flowY, vx, vy, cfg = FLOW, out = { x: 0, y: 0 }) {
    out.x = 0; out.y = 0;
    const speed = Math.hypot(flowX, flowY);
    if (speed < 0.05) return out;
    const ux = flowX / speed, uy = flowY / speed;
    const along = vx * ux + vy * uy;                 // how fast the body already goes the water's way
    if (along >= speed) return out;
    const gain = (speed - along) * cfg.carry;
    out.x = ux * gain; out.y = uy * gain;
    return out;
}
