// The whale shark's stretch (pure, no Phaser; spec 5.0i open sea, 5.0j world map): a gentle
// giant cruises slowly along the calm route in the ship graveyard's sea (open-sea idea #4). This
// module reserves where (a clear stretch of the route east of the storm), moves the animal to
// and fro in it, and gives the slipstream along its back that carries Lompi with it (a push
// for MainScene.waterAt). WhaleSharkLayer.js only draws.

import { BIOMES } from './biomes.js';
import { WEATHER, stormSpan, downwellings } from './weather.js';
import { SET_PIECES, ghostShip } from './setPieces.js';
import { bloomFields } from './blooms.js';
import { rescueSpots } from '../rescues.js';
import { JOURNEY, chapters } from '../journey.js';
import { SIZES } from '../scale.js';

export const WHALE_SHARK = {
    biome: 'wreck',
    length: 6000,        // px of the calm route it cruises along
    keep: 900,           // px the stretch stays away from everything else on the route
    step: 500            // px by which the search for a clear stretch moves on
};

let SLOT = null;

/** Everything on the route in that sea that the stretch must not touch: [x0, x1] each. */
function taken() {
    const s = stormSpan(), ship = ghostShip().x, out = [[s.x0 - WEATHER.storm.ramp, s.x1 + WEATHER.storm.ramp], [ship - SET_PIECES.ship.clear, ship + SET_PIECES.ship.clear]];
    for (const d of downwellings()) out.push([d.down - WEATHER.down.ramp, d.up + WEATHER.down.ramp]);
    for (const b of bloomFields()) out.push([b.x0, b.x1]);
    for (const r of rescueSpots()) out.push([r.x, r.x]);
    for (const c of chapters()) {
        if (c.friend) out.push([c.x - JOURNEY.clear, c.x + JOURNEY.clear]);
        if (c.event) out.push([c.event.x - JOURNEY.eventClear, c.event.endX + JOURNEY.eventClear]);
    }
    return out;
}

/** The stretch: { x0, x1 }, the first clear one east of the storm (null if the sea had none, which the tests rule out). */
export function whaleSharkSlot(cfg = WHALE_SHARK) {
    if (cfg === WHALE_SHARK && SLOT) return SLOT;
    const b = BIOMES.find(bi => bi.id === cfg.biome), keep = taken(), end = b.from + b.width - cfg.length - 6000;
    let slot = null;
    for (let x0 = stormSpan().x1; x0 <= end && !slot; x0 += cfg.step) {
        if (!keep.some(([a, z]) => x0 + cfg.length + cfg.keep > a && x0 - cfg.keep < z)) slot = { x0, x1: x0 + cfg.length };
    }
    if (cfg === WHALE_SHARK) SLOT = slot;
    return slot;
}

/** The animal and its slipstream. */
export const SHARK = {
    length: SIZES.whaleShark,   // px nose to tail (scale.js)
    aspect: 284 / 1024,  // height / length of its picture
    speed: 80,           // px per second at its fastest
    margin: 900,         // px of the stretch it leaves free at each end (it turns there)
    below: 170,          // px its middle lies under the calm route: Lompi swims along its back
    swell: 40,           // px it rises and falls
    lane: {
        over: 70,        // px above its back where the lane's middle runs
        half: 120,       // px: the lane's half height
        ahead: 260,      // px it reaches past the nose ...
        behind: 0.95,    // ... and back along its body (share of its length)
        push: 9          // px per 60 Hz step at the lane's heart (a current to ride: the chain counts from 6)
    }
};

const smooth = v => (v <= 0 ? 0 : v >= 1 ? 1 : v * v * (3 - 2 * v));

/**
 * Where it is at time t (s): { x, y, dir (1 east, -1 west), vx (px per 60 Hz step) }. To and
 * fro along its stretch, easing round at each end (a cosine, never a dead stop).
 */
export function sharkAt(t, routeY, out = {}, cfg = SHARK) {
    const slot = whaleSharkSlot(), x0 = slot.x0 + cfg.margin, len = slot.x1 - cfg.margin - x0;
    const period = 2 * len / cfg.speed * (Math.PI / 2), ph = (t / period) * Math.PI * 2;
    out.x = x0 + len * (0.5 - 0.5 * Math.cos(ph));
    out.vx = len * 0.5 * Math.sin(ph) * (Math.PI * 2 / period) / 60;
    out.dir = Math.sin(ph) >= 0 ? 1 : -1;
    out.y = routeY(out.x) + cfg.below + Math.sin(t * 0.23) * cfg.swell;
    return out;
}

/**
 * The slipstream's push at (x, y) for the shark at `pose` (sharkAt): along its back, the way it
 * swims, strongest in the lane's middle and fading at its edges and ends. Writes px per 60 Hz
 * step into add.{x, y}.
 */
export function slipAt(x, y, pose, add, cfg = SHARK) {
    const L = cfg.lane, h = cfg.length * cfg.aspect;
    const along = (x - pose.x) * pose.dir;                       // + ahead of its middle
    const back = cfg.length * L.behind - cfg.length / 2, front = cfg.length / 2 + L.ahead;
    const across = Math.abs(y - (pose.y - h / 2 - L.over)) / L.half;
    const k = smooth(1 - across) * smooth((along + back) / 200) * smooth((front - along) / 200);
    add.x = pose.dir * L.push * k * Math.min(1, Math.abs(pose.vx) / 0.6);
    add.y = 0;
    return add;
}
