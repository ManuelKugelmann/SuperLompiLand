// The water moves. One field says how, for everything that floats or swims:
// the player, particles, later plants, swarms and props.
//
//   swell    a slow to-and-fro near the surface that fades with depth
//   streams  big sea currents that run through open water like lanes: enter one
//            and it carries you along. They are placed by the seed, lead east and
//            run straight and slanting, up or down (playtest: "the whirl current is
//            strange. Better make it large, diagonal sea currents"), long enough to
//            be read from afar.
//
// Pure and deterministic (no Phaser; tests/flow.test.mjs). Velocities are in
// world px per physics step, like the player's.
import { hash, vnoise } from './terrain.js';
import { floorY, WORLD_WEST, WORLD_END } from './biomes.js';

export const FLOW = {
    swell: 0.9,            // strongest to-and-fro at the surface (px per step)
    swellDepth: 700,       // depth by which it has faded away
    streamEvery: 7200,     // one stream slot per this much world width ...
    streamChance: 0.65,    // ... which holds a stream this often
    streamLength: [3600, 6400],
    streamSlope: [0.1, 0.32],   // px down (or up) per px east: a clear slant, never steep
    streamBand: [320, 0.55],    // a stream keeps between this depth and this share of the seabed's depth (open water)
    streamWidth: 150,      // distance from the middle at which the pull has dropped to about a third
    streamSpeed: 19,       // speed of the water in the middle of a stream: above the swimmers' own top speed (Lompi ~17); was 11
    carry: 0.045,          // how quickly the water takes a body up to its own speed (per step)
    calm: [200, 420],      // px from the calm route's middle: no stream pull inside the first, full pull beyond the second
    clear: { side: 420, ahead: 1300 }   // px to either side of a stream's middle line, and beyond its end, where no hazard may be (it would be carried into)
};

/**
 * The stream in slot `i`, or null: a straight lane from (x0, y0) to (x1, y1), slanting up or down,
 * that fades in and out at its ends. Both ends lie in open water (FLOW.streamBand).
 */
export function streamInSlot(i, seed, cfg = FLOW) {
    if (hash(i, 11, seed) > cfg.streamChance) return null;
    const [a, b] = cfg.streamLength;
    const length = a + (b - a) * hash(i, 12, seed);
    const x0 = i * cfg.streamEvery + hash(i, 13, seed) * (cfg.streamEvery - length);
    if (x0 < WORLD_WEST + 2500 || x0 + length > WORLD_END - 600) return null;
    const x1 = x0 + length, [top, share] = cfg.streamBand;
    const low = x => Math.max(top, floorY(x) * share);            // the deepest a stream may run at x
    // How far it can slant: as far as its band allows at both ends; up or down by the seed.
    const room = Math.min(low(x0), low(x1)) - top;
    const want = cfg.streamSlope[0] + (cfg.streamSlope[1] - cfg.streamSlope[0]) * hash(i, 14, seed);
    const drop = Math.min(want * length, room) * (hash(i, 16, seed) < 0.5 ? 1 : -1);
    const start = top + (room - Math.abs(drop)) * hash(i, 15, seed);
    const y0 = drop >= 0 ? start : start + Math.abs(drop);
    return { index: i, x0, x1, y0, y1: y0 + drop };
}

/** Height of a stream's middle line at world x. */
export function streamY(s, x) {
    return s.y0 + (s.y1 - s.y0) * (x - s.x0) / (s.x1 - s.x0);
}

/** A stream's direction: the unit vector along its lane, east. */
export function streamDir(s) {
    const dx = s.x1 - s.x0, dy = s.y1 - s.y0, len = Math.hypot(dx, dy);
    return { x: dx / len, y: dy / len };
}

/**
 * @param calmY  optional: x -> y of the calm main route. Streams lose their pull near it,
 *               so the route stays calm even where a stream crosses it.
 */
const CALM_STEP = 40;      // px: grid on which the calm route's depth is looked up

export function createFlow(seed, cfg = FLOW, calmY = null) {
    const slots = new Map();
    const slot = i => { if (!slots.has(i)) slots.set(i, streamInSlot(i, seed, cfg)); return slots.get(i); };
    // How much pull is left at (x, y): none inside the calm route, all of it away from it.
    const pull = (x, y) => {
        if (!calmY) return 1;
        // The route's depth is asked for on a coarse grid of x: it changes slowly, and this is asked
        // for every shoal fish and particle in a stream, each at its own x.
        const k = Math.min(1, Math.max(0, (Math.abs(y - calmY(Math.round(x / CALM_STEP) * CALM_STEP)) - cfg.calm[0]) / (cfg.calm[1] - cfg.calm[0])));
        return k * k * (3 - 2 * k);
    };

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
            const speed = cfg.streamSpeed * Math.exp(-d * d) * ends * ends * (3 - 2 * ends) * pull(x, y);
            const dir = s.dir || (s.dir = streamDir(s));      // along the lane
            out.x += speed * dir.x; out.y += speed * dir.y;
        }
        return out;
    };

    /** How much of a stream's pull is left at (x, y): 0 inside the calm route, 1 away from it (for showing the streams where they pull). */
    return { at, streamsIn, pullAt: pull };
}

/**
 * Whether (x, y) lies where a stream would carry a swimmer: in its lane or just beyond its end.
 * Nothing harmful is placed there. `streams` = the streams about (streamsIn).
 */
export function inStreamPath(x, y, streams, cfg = FLOW) {
    for (const s of streams) {
        if (x < s.x0 - 200 || x > s.x1 + cfg.clear.ahead) continue;
        if (Math.abs(y - streamY(s, Math.min(x, s.x1))) < cfg.clear.side) return true;
    }
    return false;
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
