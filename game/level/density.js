// The shape of the world as a pure function: rock density at any point, where
// the nests lie, and the density grids a chunk is drawn from. No Phaser, no DOM,
// so it runs unchanged on the main thread, in a Web Worker and in the tests.
import { vnoise } from './terrain.js';
import { detour } from './weather.js';
import { SET_PIECES, ghostShip, pinnacleTop, descentStart } from './setPieces.js';
import { BRANCH, sideCave, ridgeTop, caveAt } from './branches.js';
import { SEA_ARCH, seaArch } from './seaArch.js';
import { BIOMES, BLEND, LANDMARK, WORLD_WEST, WORLD_END, ABYSS, biomeBlendAt, biomeIndexAt, floorY, seaShare, REEF_CREST, reefCrest, reefCrestTop, reefCrestX, reefPass } from './biomes.js';

export const FIELD = {
    threshold: 0.53,              // density above this is rock
    spawn: { x: 0, y: 420 },      // start pool in the shallow lagoon, kept free of rock
    maxDepth: 5600,               // deepest regular seabed (the abyss goes further)
    nestRadius: 230,              // half width of the sand basin a nest lies in
    nestRim: 16,                  // how far its rim stands above the middle
    crestRock: 1.4,               // density inside the reef crest (the calm route still cuts its channel through)
    foot: 0.32,                   // how much rock is added right above a coast's seabed ...
    footReach: 460,               // ... fading out this far above it
    seaClear: 1.3,                // how much rock the open sea takes away above its bottom (more than the noise can add)
    seaBottom: 300,               // px above the sea's bottom over which rock comes back
    nestSearch: 16,               // a nest may move up to this many steps of 120 px east to find real seabed
    nestEvery: 15000,             // along an island a nest lies every so many px (spec 5.0h) ...
    nestKeep: 2600,               // ... but this far away from the set pieces and the friends' nets
    nestBucket: 4096              // px: nests are looked up by stretches of this length
};

// The calm main route (spec 5.2c): one lane of open water through the whole journey, from
// the start pool past every nest to the grand nest. It is carved out of the rock, so it
// exists by construction, and hazards keep their distance from it (LevelGenerator).
export const ROUTE = {
    halfWidth: 260,     // the lane is open at least this far above and below its middle
    cruise: 0.5,        // along an island it runs at this share of the way down to the seabed ...
    minY: 320,          // ... but never shallower
    maxY: 2600,         // ... or deeper than this
    seaY: 470,          // across the open sea it stays this close under the surface (spec 5.0c)
    seaFrom: 2700,      // seabed depth from which the water counts as open sea for the route ...
    seaFull: 3700,      // ... and from which the route is fully at `seaY`
    ease: 5, easeStep: 280,   // the cruise depth is averaged over this many steps of this size to either side
    aboveNest: 240,     // it passes this far above every nest
    descent: 1.6,       // px along the way per px of depth when it dips to a nest (gentle slopes)
    clear: 420,         // hazards stay at least this far from its middle
    nestHalf: 300,      // px to either side of a nest within which passing over it reaches it, at any depth (its light stands up to the surface)
    fadeIn: [1500, 900],   // the lane starts this far west of the start pool and reaches full depth over this many px
    fadeOut: 280,       // and it closes over this many px before the world's east end (behind the grand nest)
    wander: [110, 45],  // px its edges wander outward, on a broad and on a fine scale (never inward: the lane keeps its width)
    grid: 32            // px: its depth is worked out every so many px and joined by straight pieces
};

/**
 * Build the world's density field for a seed.
 * Returns { density(x, y, withNests = true), nests, routeY(x) }.
 */
const smooth01 = v => { const t = v <= 0 ? 0 : v >= 1 ? 1 : v; return t * t * (3 - 2 * t); };

/**
 * The calm route's depth away from any nest: half way down along the coasts, near the surface
 * over deep water. Averaged along the way, so it climbs and sinks gently even where the seabed
 * falls away as a wall.
 */
export function cruiseY(x, cfg = ROUTE) {
    let sum = 0;
    for (let k = -cfg.ease; k <= cfg.ease; k++) {
        const fy = floorY(x + k * cfg.easeStep), coast = Math.min(cfg.maxY, Math.max(cfg.minY, Math.min(fy, cfg.seaFrom) * cfg.cruise));
        // Not in the trench: there the way leads down to the grand nest and never comes back up to the surface.
        const sx = x + k * cfg.easeStep, up = sx > TRENCH_FROM ? 0 : 1;
        sum += coast + (cfg.seaY - coast) * up * smooth01((fy - cfg.seaFrom) / (cfg.seaFull - cfg.seaFrom));
    }
    const y = sum / (cfg.ease * 2 + 1), d = detour(x, DETOUR);
    const deep = y + (d.y - y) * d.k;      // under a storm and through a downwelling the route goes deep (weather.js)
    // The reef pass: the reef is solid from its crest far down, and the way through it lies deep.
    return deep + Math.max(0, REEF_CREST.passY - deep) * reefPass(x);
}

const DETOUR = { y: 0, k: 0 };

const SHIP_X = ghostShip().x;      // the ghost ship's place (worked out once)
const TRENCH_FROM = BIOMES[BIOMES.length - 1].from;
const ARCH = seaArch(), ARCH_HALF = (ARCH.x1 - ARCH.x0) / 2;      // the rocky shore's sea arch (worked out once)
const CAVE_REACH = BRANCH.mouth + BRANCH.rim + BRANCH.ends * 4;      // how far beyond mouth and exit the side cave's ridge can reach

// Where the reef crest is and how far its slopes can reach (worked out once).
const CREST_X = reefCrestX(), CREST_REACH = REEF_CREST.inset + REEF_CREST.half + 3000 / REEF_CREST.lagoonSlope;

/** Stretches where no nest may lie: [x0, x1] around the reef crest, the side cave, the docks, the sea arch and every chapter's net. */
function nestKeepOuts() {
    const k = FIELD.nestKeep, by = id => BIOMES.find(b => b.id === id), cave = by(BRANCH.biome).from + by(BRANCH.biome).width * BRANCH.at;
    const out = [[CREST_X - CREST_REACH, Infinity === CREST_REACH ? CREST_X : CREST_X + REEF_CREST.inset], [cave - CAVE_REACH, cave + BRANCH.length + CAVE_REACH],
        [ARCH.x0 - SEA_ARCH.approach, ARCH.x1 + SEA_ARCH.approach]];
    for (const b of BIOMES) {
        out.push([b.from + b.width * 0.55 - 400, b.from + b.width * 0.55 + 400]);      // the chapter's net (journey.js JOURNEY.at)
        if (b.landmark) out.push([b.from + LANDMARK.entry - 1200, b.from + LANDMARK.entry + 1200]);
    }
    return out.map(([x0, x1]) => [x0 - k, x1 + k]);
}

/** Where the nests go (world x, before each finds its seabed): the start pool, then every `nestEvery` px along each island, the grand nest at the end. */
export function nestSpots() {
    const keep = nestKeepOuts(), xs = [FIELD.spawn.x];
    for (const b of BIOMES) {
        if (b.zone !== 'island') continue;
        for (let x = b === BIOMES[0] ? FIELD.spawn.x + FIELD.nestEvery : b.from + 260; x < b.from + b.width - BLEND; x += FIELD.nestEvery) {
            let at = x;
            for (const [x0, x1] of keep) if (at > x0 && at < x1) at = x1;
            xs.push(at);
        }
    }
    xs.push(WORLD_END - 300);
    return xs;
}

const NO_NESTS = [];

export function createField(seed) {
    let nests = null;
    // The nests whose dip or basin can reach x: looked up by stretch, so a long world with many nests costs nothing per sample.
    const nearBy = new Map(), nestsNear = x => nearBy.get(Math.floor(x / FIELD.nestBucket)) || NO_NESTS;

    /**
     * Height of the calm route's middle at world x. Worked out on a grid of x and joined by
     * straight pieces: it is asked for at every rock sample and by every creature, each at its
     * own x, and it changes slowly.
     */
    const routeGrid = new Map();
    const routeAt = i => {
        let y = routeGrid.get(i);
        if (y !== undefined) return y;
        const x = i * ROUTE.grid;
        y = cruiseY(x);
        for (const nest of nestsNear(x)) {
            const dx = Math.abs(x - nest.x);
            if (dx < nest.reach) y += (nest.y - ROUTE.aboveNest - y) * smooth01(1 - dx / nest.reach);
        }
        // The sea arch: the route climbs to just under the surface and runs through its opening.
        const ax = Math.abs(x - ARCH.x) - ARCH_HALF;
        if (ax < SEA_ARCH.approach) y += (SEA_ARCH.swim - y) * smooth01(1 - Math.max(0, ax) / SEA_ARCH.approach);
        if (routeGrid.size > 16384) routeGrid.clear();
        routeGrid.set(i, y);
        return y;
    };
    const routeY = x => {
        const f = x / ROUTE.grid, i = Math.floor(f), y0 = routeAt(i);
        return f === i ? y0 : y0 + (routeAt(i + 1) - y0) * (f - i);
    };

    // What depends on x alone (seabed depth, how open the biome is, how much open sea): worked
    // out on a grid of x and joined by straight pieces, like the route. Every rock sample, every
    // creature and every shoal fish asks for it.
    const colGrid = new Map(), COL = { fy: 0, open: 0, sea: 0 };
    const colAtGrid = i => {
        let c = colGrid.get(i);
        if (c) return c;
        const x = i * ROUTE.grid, { a, b, t } = biomeBlendAt(x);
        c = { fy: floorY(x), open: a.open + (b.open - a.open) * t, sea: seaShare(x) };
        if (colGrid.size > 16384) colGrid.clear();
        colGrid.set(i, c);
        return c;
    };
    const columnAt = x => {
        const f = x / ROUTE.grid, i = Math.floor(f), k = f - i, c0 = colAtGrid(i);
        if (k === 0) return c0;
        const c1 = colAtGrid(i + 1);
        COL.fy = c0.fy + (c1.fy - c0.fy) * k; COL.open = c0.open + (c1.open - c0.open) * k; COL.sea = c0.sea + (c1.sea - c0.sea) * k;
        return COL;
    };

    let cave = null;
    const caveOf = () => cave || (cave = sideCave(routeY));      // needs the route, so it is worked out on first use

    const density = (x, y, withNests = true) => {
        // Two broad octaves only: big soft blobs and winding passages, no jagged detail.
        let n = 0.72 * vnoise(x / 1000, y / 1000, seed) + 0.28 * vnoise(x / 420, y / 420, seed + 7);
        const col = columnAt(x), fy = col.fy;
        n -= col.open;                                                   // beach / open sea have less rock
        if (y < 520) n -= ((520 - y) / 520) * 0.6;                       // open water under the surface
        if (y > fy) n += (y - fy) / 380 + FIELD.foot * (1 - col.sea);     // the seabed (with the coast's foot, see below: no step at the bottom)
        else {
            // Open sea: clear water from the surface down to just above the bottom. Rock that
            // hangs in mid-water belongs to the islands' flanks only (spec 5.0c).
            const sea = col.sea;
            if (sea > 0) n -= FIELD.seaClear * sea * Math.min(1, (fy - y) / FIELD.seaBottom);
            // Along the coasts rock that hangs low over the seabed grows together with it: no slab
            // floats a little above the bottom with a slit of water under it.
            const low = 1 - (fy - y) / FIELD.footReach;
            if (low > 0 && sea < 1) n += FIELD.foot * low * (1 - sea);
        }
        // Keep the abyss shaft swimmable all the way down.
        if (y > 4200 && y < fy - 150 && Math.abs(x - ABYSS.x) < ABYSS.halfWidth * 0.75) n -= 0.6;
        // The reef crest: solid coral from just under the surface down, whatever the noise says.
        // Its upper face is lumpy, slopes away to both sides and has grooves: no flat top, no cut faces.
        const crestTop = Math.abs(x - CREST_X) > CREST_REACH ? Infinity      // nowhere near it: nothing to work out
            : reefCrestTop(x) + REEF_CREST.lump * (vnoise(x / 170, 3.7, seed + 21) * 2 - 1) + REEF_CREST.knobs * (vnoise(x / 55, 9.1, seed + 22) * 2 - 1);
        const crest = crestTop < fy ? reefCrest(x) : 0;
        if (crestTop < fy && y > crestTop) n += (FIELD.crestRock - n) * smooth01((y - crestTop) / 120);
        if (x < WORLD_WEST + 900) n += (WORLD_WEST + 900 - x) / 500;     // western shore
        if (x > WORLD_END + 900) n += (x - WORLD_END - 900) / 500;       // wall behind the grand nest
        const ds = Math.hypot(x - FIELD.spawn.x, y - FIELD.spawn.y);
        if (ds < 900) n -= (1 - ds / 900) * 0.6;                         // clear start pool
        if (withNests && nests) {
            // The calm route: fully open inside its half width, fading back to rock over as much
            // again (a soft edge: no sharp step in the field). Where the lane runs just under the
            // open surface water, everything above it is lane too, so no sliver of rock is left between.
            const ry = routeY(x), shallow = crest < 0.5 && ry - ROUTE.halfWidth * 2 < 620 && y < ry;      // not under the reef crest: there the lane is a channel through coral
            // Its edges wander: the lane is never narrower than its half width, but how far beyond that
            // it eats into the rock varies on two scales, so where the route ramps no straight cut shows.
            let off = shallow ? 0 : Math.abs(y - ry) / ROUTE.halfWidth;
            if (off > 0.9 && off < 2.6) {
                const wide = ROUTE.halfWidth + ROUTE.wander[0] * vnoise(x / 260, y / 260, seed + 51) + ROUTE.wander[1] * vnoise(x / 85, y / 85, seed + 52);
                off = Math.abs(y - ry) / wide;
            }
            // The lane begins west of the start pool and ends at the grand nest; it fades in and out
            // there over a stretch, so it never ends in a cut face in the sand.
            const ends = Math.min(smooth01((x - (FIELD.spawn.x - ROUTE.fadeIn[0])) / ROUTE.fadeIn[1]), smooth01((WORLD_END - x) / ROUTE.fadeOut));
            if (off < 2 && ends > 0) n -= 0.95 * smooth01(2 - off) * ends;
            for (const nest of nestsNear(x)) {
                const dx = Math.abs(x - nest.x);
                if (dx > 520) continue;
                if (y <= nest.y - 30) {                                  // open water above every nest
                    const d = Math.hypot(x - nest.x, y - (nest.y - 260));
                    if (d < 480) n -= (1 - d / 480) * 0.7;
                }
                // The nest lies in a shallow sand basin with a raised rim, levelled into
                // the seabed, so it sits right on any slope instead of floating or sinking.
                const R = FIELD.nestRadius, reach = R + 170;
                if (dx < reach && Math.abs(y - nest.y) < 260) {
                    const u = dx / R;
                    const rim = u < 1 ? u * u : Math.max(0, 1 - (dx - R) / 170);       // 0 in the middle, 1 on the rim, back to 0 outside
                    const ground = nest.y - FIELD.nestRim * rim;
                    const side = dx <= R ? 1 : smooth01(1 - (dx - R) / 170);
                    const w = side * smooth01(1 - Math.abs(y - nest.y) / 260);
                    n += (FIELD.threshold + (y - ground) / 320 - n) * w;
                }
            }
        }
        // The side cave (branches.js): a ridge of rock under the calm route with a tunnel through it.
        if (withNests && nests) {
            const cv = caveOf();
            if (x > cv.x0 - CAVE_REACH && x < cv.x1 + CAVE_REACH) {
                // Lumps on its top, bigger bulges on the flanks beyond mouth and exit (no straight ramps).
                const flank = Math.min(1, Math.max(0, cv.x0 - BRANCH.mouth - BRANCH.rim - x, x - cv.x1 - BRANCH.mouth - BRANCH.rim) / 250);
                const top = ridgeTop(cv, x) + BRANCH.lump * (vnoise(x / 230, 8.1, seed + 41) * 2 - 1) + BRANCH.bulge * flank * (vnoise(x / 180, 4.4, seed + 42) * 2 - 1);
                const d = caveAt(cv, x, y, top);
                if (d !== null) {
                    // Rock of the ridge, turning into open water over a worn edge at the tunnel's walls.
                    const rock = n + (FIELD.crestRock - n) * smooth01((y - top) / 100), water = Math.min(n, FIELD.threshold - 0.5);
                    n = water + (rock - water) * smooth01(0.5 + d / (BRANCH.soft * 2));
                }
            }
        }
        // The ghost ship's pinnacle (setPieces.js): a spire of rock from the deep floor up to the ship's keel.
        // Laid down last, after the calm route's lane is carved: under the ship the lane ends at the
        // keel's bed (the ship's hole is the way through), so the ship stands on rock.
        if (Math.abs(x - SHIP_X) < SET_PIECES.ship.pinnacleHalf + 2600) {
            // Broad lumps on its flanks (none under the keel, which must lie in its hollow) and small knobs everywhere.
            // Lumps and knobs on its flanks; under the keel only small dips (the bed never rises into the lane).
            const P = SET_PIECES.ship, flank = Math.min(1, Math.max(0, (Math.abs(x - SHIP_X) - P.pinnacleHalf) / 300));
            const top = pinnacleTop(x) + P.lump * flank * (vnoise(x / 400, 5.3, seed + 31) * 2 - 1 + 0.5 * (vnoise(x / 170, 1.7, seed + 33) * 2 - 1))
                + P.knobs * (flank * (vnoise(x / 90, 2.9, seed + 32) * 2 - 1) + (1 - flank) * 0.5 * vnoise(x / 90, 2.9, seed + 32));
            if (y > top) n += (FIELD.crestRock - n) * smooth01((y - top) / 80);
        }
        return n;
    };

    // The first nest right under the start pool (in the lagoon), then one every so often along
    // every island (the open sea has none: its bottom is far below the way across), the grand
    // nest at the end; each on the real seabed: start inside it and walk up.
    const xs = nestSpots();
    const groundAt = x => { let y = floorY(x) + 260; while (y > 400 && density(x, y, false) > FIELD.threshold) y -= 12; return y; };
    nests = xs.map((at, index) => {
        // On the seabed, not on top of a rock that happens to stand there: of the columns
        // close by, the one whose ground lies deepest.
        let x = at, y = groundAt(at);
        if (index > 0 && index < xs.length - 1) {
            for (let k = 1; k <= FIELD.nestSearch; k++) { const gx = at + k * 120, gy = groundAt(gx); if (gy > y) { x = gx; y = gy; } }
        }
        // How far to either side the route's dip to this nest reaches.
        const cruise = cruiseY(x);
        let reach = Math.max(900, Math.abs(y + 12 - ROUTE.aboveNest - cruise) * ROUTE.descent);
        // The way down to the grand nest begins where the trench begins (spec 5.0e): a long, gentle descent.
        if (index === xs.length - 1) reach = Math.max(reach, x - descentStart());
        return { x, y: y + 12, index, grand: index === xs.length - 1, reach, biome: biomeIndexAt(x) };
    });

    for (const n of nests) {
        const r = Math.max(n.reach, 520);
        for (let i = Math.floor((n.x - r) / FIELD.nestBucket); i <= Math.floor((n.x + r) / FIELD.nestBucket); i++) { if (!nearBy.has(i)) nearBy.set(i, []); nearBy.get(i).push(n); }
    }

    return { density, nests, routeY, cave: caveOf() };
}

/**
 * Density samples for one chunk on a (n + 1) x (n + 1) grid, row by row:
 *   fine  the rock density itself
 *   back  density of the "rock wall behind the cave" layer (-1 where there is none)
 */
export function chunkGrids(field, seed, ox, oy, span, n) {
    const side = n + 1, step = span / n;
    const fine = new Float32Array(side * side), back = new Float32Array(side * side);
    for (let j = 0; j < side; j++) {
        for (let i = 0; i < side; i++) {
            const x = ox + i * step, y = oy + j * step;
            const d = field.density(x, y);
            fine[j * side + i] = d;
            back[j * side + i] = vnoise(x / 1500, y / 1500, seed + 31) > 0.56 && y > 600 ? d + 0.05 : -1;
        }
    }
    return { fine, back };
}

/** View a flat row-major grid as an array of rows (no copying). */
export function gridRows(flat, side) {
    return Array.from({ length: side }, (_, j) => flat.subarray(j * side, (j + 1) * side));
}

/**
 * Does a fish at (x, y) reach the nest? Anywhere in the water above it: a column of light stands
 * on every nest up to the surface, and swimming through it is enough. So a child who follows the
 * route down to the nest reaches it, and so does one who simply swims straight on overhead.
 */
export function nestReached(nest, x, y, cfg = ROUTE) {
    // The grand nest is the journey's end: there you have to arrive in the lane, not pass far overhead.
    return Math.abs(x - nest.x) < cfg.nestHalf && y < nest.y + 40 && y > (nest.grand ? nest.y - cfg.aboveNest - cfg.halfWidth - 40 : 0);
}
