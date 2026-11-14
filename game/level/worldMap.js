// The coarse map of the whole world (pure, no Phaser; spec 5.0j): made once and cheaply from
// the tables that say where things are. It knows every biome and its sub-zones and every thing
// worth meeting along the calm route (nests, friends, rescues, set pieces, weather, sea life),
// west to east. Nothing here draws or builds: the world itself is refined on demand around the
// view (chunks, layers); the map is what the whole journey looks like from far above.

import { BIOMES, WORLD_WEST, WORLD_END, biomeIndexAt, reefCrestX, REEF_CREST, LANDMARK } from './biomes.js';
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
import { dolphinSpot } from './dolphinRings.js';
import { OCTOPUS } from '../ai/octopus.js';
import { containerSpan } from './containers.js';
import { whaleSharkSlot } from './whaleShark.js';
import { frontSlot } from './front.js';
import { sandbarSpot } from './sandbar.js';
import { nurserySpot } from './nursery.js';
import { gardenSpot } from './jellyGarden.js';
import { archerX } from './archerfish.js';
import { siphonSpots } from './siphonophore.js';
import { seaLionSpot } from './seaLion.js';

/** Kinds of feature that are a place's main sight: no two of them may share a screen. */
export const SET_PIECE_KINDS = ['crest', 'cave', 'docks', 'arch', 'ship', 'friend', 'whale', 'baitball', 'whaleshark', 'front'];

/**
 * The journey's rhythm (spec 5.0l): at cruise speed something small every 6-12 s and a landmark
 * or set piece every 40-60 s, evenly: never a long empty stretch, never a crowd.
 */
export const RHYTHM = {
    cruise: 330,              // px per second a child swims along the route
    small: [2000, 4000],      // px between two things of any kind
    landmark: [13000, 20000], // px between two landmarks
    ratio: 2.5,               // the longest landmark gap is less than this many times the shortest
    merge: 9000,              // landmarks closer together than this play as one moment
    fill: 16500,              // the spacing aimed at where a long gap is filled with landmarks
    treat: 3000,              // ... and where a gap between small things is filled with coin figures
    sharks: 40000             // an adult shark passes every so many px of the open blue (spec 5.0l)
};

/** Big still scenery: a sight to swim past (a small "wow" beat), not an event (spec 5.0n). */
export const SCENERY_KINDS = ['colony', 'arch'];

/**
 * Kinds that are a landmark (spec 5.0n): what moves or answers the child (animals that act, toys,
 * rides, rescues, weather). Still scenery, however big, is not.
 */
export const LANDMARK_KINDS = [...SET_PIECE_KINDS, 'dolphins', 'octopus', 'sandbar', 'meadow', 'containers', 'vents', 'storm', 'current', 'bloom', 'manta', 'bigshark', 'nursery', 'jelly_garden', 'archerfish', 'siphonophore', 'sealion'].filter(k => !SCENERY_KINDS.includes(k));


/** Landmarks merged into moments (those closer than `merge` play as one): [{ x0, x1, kinds }], west to east. */
export function moments(features, cfg = RHYTHM, kinds = LANDMARK_KINDS) {
    const out = [];
    for (const f of features.filter(ft => kinds.includes(ft.kind) && ft.x1 >= 0).sort((a, b) => a.x0 - b.x0)) {
        const last = out[out.length - 1];
        if (last && f.x0 - last.x1 <= cfg.merge) { last.x1 = Math.max(last.x1, f.x1); last.kinds.push(f.kind); }
        else out.push({ x0: f.x0, x1: f.x1, kinds: [f.kind] });
    }
    return out;
}

/** The gaps of open route between the things in `list` ([{ x0, x1 }], sorted), from `from` to `to`: [{ x0, x1 }]. */
function gapsOf(list, from, to) {
    const out = [];
    let reach = from;
    for (const f of list) {
        if (f.x1 < from) continue;
        if (f.x0 > reach) out.push({ x0: reach, x1: f.x0 });
        reach = Math.max(reach, f.x1);
    }
    if (to > reach) out.push({ x0: reach, x1: to });
    return out;
}

/** Evenly spaced spots that cut a gap into pieces no longer than about `aim`: [x, ...] (none when the gap is not longer than `limit`). */
function cut(gap, limit, aim) {
    const len = gap.x1 - gap.x0;
    if (len <= limit) return [];
    const n = Math.ceil(len / aim) - 1;
    return Array.from({ length: n }, (_, k) => gap.x0 + len * (k + 1) / (n + 1));
}

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
    span('dolphins', dolphinSpot().x0, dolphinSpot().x1);
    span('octopus', OCTOPUS.x - OCTOPUS.roam, OCTOPUS.x + OCTOPUS.roam);
    span('containers', containerSpan().x0, containerSpan().x1);
    span('whaleshark', whaleSharkSlot().x0, whaleSharkSlot().x1);
    span('front', frontSlot().x0, frontSlot().x1);
    span('sandbar', sandbarSpot().x0, sandbarSpot().x1);
    span('nursery', nurserySpot().x0, nurserySpot().x1);
    span('jelly_garden', gardenSpot().x0, gardenSpot().x1);
    spot('archerfish', archerX());
    for (const sp of siphonSpots()) span('siphonophore', sp.x0, sp.x1);
    span('sealion', seaLionSpot().x0, seaLionSpot().x1);
    for (const d of downwellings()) span('current', d.down, d.up);
    for (const f of bloomFields()) span('bloom', f.x0, f.x1);
    for (const r of raftSpots()) spot('raft', r.x);
    const reef = by(MANTA.biome);
    for (const at of MANTA.ats) { const m = mantaSpan(reef.from + reef.width * at); span('manta', m.x0, m.x1); }
    // Adult sharks pass in the open blue every so often (spec 5.0l), whatever else is there.
    const blue = by('blue');
    for (let x = blue.from + RHYTHM.sharks / 2; x < blue.from + blue.width - RHYTHM.sharks / 4; x += RHYTHM.sharks) spot('bigshark', x);
    // Even rhythm: a long stretch without a landmark gets one, a huge coral colony along the islands
    // and an adult shark passing out at sea (the trench has its glowing jelly fields for that).
    // (Sights of any kind count here, scenery too, so the fillers stand where nothing big is.)
    features.sort((a, b) => a.x0 - b.x0);
    for (const gap of gapsOf(moments(features, RHYTHM, [...LANDMARK_KINDS, ...SCENERY_KINDS]), FIELD.spawn.x, WORLD_END)) {
        for (const x of cut(gap, RHYTHM.landmark[1], RHYTHM.fill)) spot(BIOMES[biomeIndexAt(x)].zone === 'island' ? 'colony' : 'bigshark', x);
    }
    // ... and a long stretch with nothing at all gets a small treat: a figure of coins on the route.
    features.sort((a, b) => a.x0 - b.x0);
    for (const gap of gapsOf(features, FIELD.spawn.x, WORLD_END)) for (const x of cut(gap, RHYTHM.small[1], RHYTHM.treat)) spot('treat', x);
    features.sort((a, b) => a.x0 - b.x0);
    MAP = { from: WORLD_WEST, to: WORLD_END, start: FIELD.spawn.x, zones, features };
    return MAP;
}

/** The spots of one kind on the map, west to east: [{ x0, x1 }]. */
export function spotsOf(kind, map = worldMap()) {
    return map.features.filter(f => f.kind === kind);
}

/**
 * How even the journey is: the gaps between things of any kind and between landmark moments,
 * in px and in seconds at cruise speed.
 * { small: { n, median, max }, landmark: { n, min, max, ratio, gaps: [px, ...], first, last, repeats }, seconds(px) }
 * `repeats` = two landmark moments in a row of the same single kind: [{ kind, x0 (the second one) }] (spec 5.0n: never).
 */
export function rhythm(map = worldMap(), cfg = RHYTHM) {
    const lens = list => gapsOf(list, map.start, map.to).map(g => g.x1 - g.x0).sort((a, b) => a - b);
    // Between landmark moments only: the way to the first one and from the last one to the grand nest are the journey's beginning and end, not its rhythm.
    const small = lens(map.features), mom = moments(map.features, cfg), land = mom.slice(1).map((m, i) => m.x0 - mom[i].x1);
    const sorted = [...land].sort((a, b) => a - b), same = (a, b) => new Set([...a.kinds, ...b.kinds]).size === 1;
    const repeats = mom.slice(1).filter((m, i) => same(m, mom[i])).map(m => ({ kind: m.kinds[0], x0: m.x0 }));
    return {
        small: { n: small.length, median: small[small.length >> 1], max: small[small.length - 1] },
        landmark: { n: land.length, min: sorted[0], max: sorted[sorted.length - 1], ratio: sorted[sorted.length - 1] / sorted[0], gaps: land, first: mom[0].x0 - map.start, last: map.to - mom[mom.length - 1].x1, repeats },
        seconds: px => px / cfg.cruise
    };
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
