// The coarse map of the whole world (pure, no Phaser; spec 5.0j): made once and cheaply from
// the tables that say where things are. It knows every biome and its sub-zones and every thing
// worth meeting along the calm route (nests, friends, rescues, set pieces, weather, sea life),
// west to east. Nothing here draws or builds: the world itself is refined on demand around the
// view (chunks, layers); the map is what the whole journey looks like from far above.

import { BIOMES, WORLD_WEST, WORLD_END, reefCrestX, REEF_CREST, LANDMARK } from './biomes.js';
import { zoneEdges, zoneMix } from './subzones.js';
import { FIELD, nestSpots } from './density.js';
import { BRANCH } from './branches.js';
import { seaArch } from './seaArch.js';
import { ghostShip } from './setPieces.js';
import { stormSpan, downwellings } from './weather.js';
import { bloomFields } from './blooms.js';
import { raftSpots } from './rafts.js';
import { rescueSpots } from '../rescues.js';
import { chapters } from '../journey.js';
import { MANTA, mantaSpan } from '../ai/manta.js';
import { baitballSlot } from './baitball.js';
import { meadowSpot } from './meadow.js';
import { ventSpot } from './ventField.js';
import { containerSpan } from './containers.js';
import { whaleSharkSlot } from './whaleShark.js';

/** Kinds of feature that are a place's main sight: no two of them may share a screen. */
export const SET_PIECE_KINDS = ['crest', 'cave', 'docks', 'arch', 'ship', 'friend', 'whale', 'baitball', 'whaleshark'];

let MAP = null;

/**
 * { from, to, zones: [{ biome, kind (sub-zone or null), x0, x1 }], features: [{ kind, x0, x1 }] },
 * both lists west to east. Features have a stretch (x0 = x1 for a single spot).
 */
export function worldMap() {
    if (MAP) return MAP;
    const zones = [], features = [], spot = (kind, x) => features.push({ kind, x0: x, x1: x }), span = (kind, x0, x1) => features.push({ kind, x0, x1 });
    for (const b of BIOMES) {
        if (!b.zones) { zones.push({ biome: b.id, kind: null, x0: b.from, x1: b.from + b.width }); continue; }
        let prev = 0;
        for (const e of zoneEdges(b)) {
            const end = Math.min(e, b.width);
            zones.push({ biome: b.id, kind: zoneMix(b, b.from + (prev + end) / 2, {}).a, x0: b.from + prev, x1: b.from + end });
            prev = end;
            if (end >= b.width) break;
        }
    }
    for (const x of nestSpots()) spot('nest', x);
    for (const r of rescueSpots()) spot('rescue', r.x);
    for (const c of chapters()) {
        if (c.friend) spot('friend', c.x);
        if (c.event) span(c.event.id, c.event.x, c.event.endX);
    }
    const by = id => BIOMES.find(b => b.id === id), arch = seaArch(), storm = stormSpan(), cave = by(BRANCH.biome).from + by(BRANCH.biome).width * BRANCH.at;
    span('crest', reefCrestX() - REEF_CREST.half, reefCrestX() + REEF_CREST.inset);
    span('cave', cave, cave + BRANCH.length);
    for (const b of BIOMES) if (b.landmark === 'pier') spot('docks', b.from + LANDMARK.entry);
    span('arch', arch.x0, arch.x1);
    spot('ship', ghostShip().x);
    span('storm', storm.x0, storm.x1);
    span('baitball', baitballSlot().x0, baitballSlot().x1);
    span('meadow', meadowSpot().x0, meadowSpot().x1);
    span('vents', ventSpot().x0, ventSpot().x1);
    span('containers', containerSpan().x0, containerSpan().x1);
    span('whaleshark', whaleSharkSlot().x0, whaleSharkSlot().x1);
    for (const d of downwellings()) span('current', d.down, d.up);
    for (const f of bloomFields()) span('bloom', f.x0, f.x1);
    for (const r of raftSpots()) spot('raft', r.x);
    const reef = by(MANTA.biome);
    for (const at of MANTA.ats) { const m = mantaSpan(reef.from + reef.width * at); span('manta', m.x0, m.x1); }
    features.sort((a, b) => a.x0 - b.x0);
    MAP = { from: WORLD_WEST, to: WORLD_END, start: FIELD.spawn.x, zones, features };
    return MAP;
}

/** The longest stretches of the calm route (from the start pool on) with nothing on the map: [{ x0, x1 }], longest first. */
export function quietStretches(map = worldMap(), count = 5) {
    const out = [];
    let reach = map.start;
    for (const f of map.features) {
        if (f.x1 < map.start) continue;
        if (f.x0 > reach) out.push({ x0: reach, x1: f.x0 });
        reach = Math.max(reach, f.x1);
    }
    if (map.to > reach) out.push({ x0: reach, x1: map.to });
    return out.sort((a, b) => (b.x1 - b.x0) - (a.x1 - a.x0)).slice(0, count);
}
