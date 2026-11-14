// Small rescues between the chapters (pure, no Phaser; spec 5.0i): every so often on the calm
// route a small animal is caught in a bit of net. One touch or a special frees it; it does a
// happy loop and swims along for a while. A few coins and a stamp in the reef book. The
// chapter's big friend stays the chapter's highlight: no small rescue stands near one, near a
// nest or on a set piece.

import { BIOMES, WORLD_END, biomeIndexAt } from './level/biomes.js';
import { FIELD, nestSpots, setPieceStretches } from './level/density.js';
import { weatherZones } from './level/weather.js';
import { SET_PIECES, ghostShip } from './level/setPieces.js';
import { JOURNEY, chapters } from './journey.js';

export const RESCUES = {
    every: 25000,        // px between two of them along the route
    first: 9000,         // px east of the start pool where the first one waits
    keep: 2200,          // px they stay away from nests, chapter events and set pieces
    coins: 5,
    freeRadius: 170,     // px: swimming this close frees it ...
    specialRadius: 420,  // ... and so does a special this close
    // What it is caught in and who that is (the reef-book entry it stamps), taken in turn along the way.
    // `ground`: it lies on the seabed under the route (only along the islands: out at sea the bottom is far too deep).
    traps: [{ trap: 'ring', kind: 'friend_parrotfish' }, { trap: 'bottle', kind: 'hermit_crab', ground: true }, { trap: 'bag', kind: 'friend_turtle' }],
    groundReach: 1300    // px below the route within which a ground trap finds its seabed (else it hangs on the route)
};

/** Stretches of the world [x0, x1] where no small rescue stands. */
function keepOuts(cfg) {
    const out = setPieceStretches(), w = weatherZones(), ship = ghostShip().x;
    out.push(w.storm, ...w.downs, [ship - SET_PIECES.ship.clear, ship + SET_PIECES.ship.clear]);
    for (const c of chapters()) {
        out.push([c.x - JOURNEY.clear, c.x + JOURNEY.clear]);
        if (c.event) out.push([c.event.x - JOURNEY.eventClear, c.event.endX + JOURNEY.eventClear]);
    }
    for (const x of nestSpots()) out.push([x - 200, x + FIELD.nestSearch * 120 + 200]);      // a nest may have moved east to find its seabed
    return out.map(([x0, x1]) => [x0 - cfg.keep, x1 + cfg.keep]).sort((a, b) => a[0] - b[0]);
}

let SPOTS = null;

/** Where they are, west to east: [{ id, x, trap, kind (reef-book entry), biome (id) }]. The same for every player. */
export function rescueSpots(cfg = RESCUES) {
    if (cfg === RESCUES && SPOTS) return SPOTS;
    const keep = keepOuts(cfg), out = [];
    let turn = 0;
    for (let at = FIELD.spawn.x + cfg.first, i = 0; at < WORLD_END - cfg.every / 2; at += cfg.every, i++) {
        let x = at;
        for (const [x0, x1] of keep) if (x > x0 && x < x1) x = x1;
        const b = BIOMES[biomeIndexAt(x)];
        if (b.zone === 'sea' && cfg.traps[turn % cfg.traps.length].ground) turn++;      // nothing lies on the bottom of the open sea
        out.push({ id: `r${i}`, x, ...cfg.traps[turn++ % cfg.traps.length], biome: b.id });
    }
    if (cfg === RESCUES) SPOTS = out;
    return out;
}

/** Does a fish at (fx, fy), or a special set off there, free the animal at (x, y)? */
export function freesRescue(x, y, fx, fy, special = false, cfg = RESCUES) {
    return Math.hypot(x - fx, y - fy) < (special ? cfg.specialRadius : cfg.freeRadius);
}
