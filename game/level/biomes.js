// The journey runs west -> east along an island chain (spec 5.0c): the home island (lagoon,
// mangroves, coral reef), a reef wall that drops into the open sea, then open sea and islands
// in turn. `zone` says which a biome is; `floor` is how deep its seabed lies (world px).
// Islands are shallow coast; in the open sea the bottom is far below and the way across is
// near the surface.
// The journey runs west -> east. It starts in a shallow, safe lagoon behind the
// beach; the mangroves and the coral reef follow, and every biome further east is
// deeper and a little more dangerous.
// A Lompi nest (checkpoint) sits on the seabed at the start of each biome and
// the grand nest at the very end.
//
// Per biome:
//   rock     terrain colour bands, rim -> core          water   tint laid over the backdrop [colour, alpha]
//   open     how much rock is removed (0 = cave-rich, 0.3 = wide open water)
//   backRock reach (world px) of the rock behind the play plane under overhangs (0 = none: endless open water)
//   rockWall share of the near/mid rock layers that is closed wall (0 = all open water; rockLayerTable.js)
//   coral    chance that a floor spot gets coral          kelp    chance that it gets a kelp stalk
//   Friends are the sea's own creatures (anglerfish and urchins included).
//   Hazards are what the volcano's eruption and people left behind, all of
//   it inanimate and realistic: lost anchors on chains, rusty drums, wreck
//   scrap, drifting ghost nets. No machines with faces, no cartoon enemies.
//   (Texture keys are historical: mine = anchor on a chain, hazard_buoy = oil
//   drum, spikes = wreck scrap, hazard_net = ghost net.) Animals never hurt.
//   coins    coin trails per chunk                        friends / hazards: weighted spawn tables
//   friendRate / hazardRate: chance per chunk
//   props    scenery on the seabed (groups in LevelGenerator PROPS)   propRate: props per chunk
// How wide each biome is (world px). The lagoon starts 6500 px west of the start
// pool at x = 0; everything else follows from these widths.
const WIDTHS = { beach: 11500, mangrove: 9000, reef: 8000, blue: 16000, kelp: 9000, harbour: 9000, wreck: 14000, shore: 10000, trench: 12000 };
export const WORLD_WEST = -6500;

const ROCK_REEF = [0xf3dba0, 0xd2ae6c, 0x9c7a54, 0x6a5748, 0x4b4350];

export const BIOMES = [
    {
        // The shallow lagoon behind the beach, where the journey starts: seagrass meadows and a
        // few rocks; corals only here and there (sign-off S3).
        id: 'beach', name: { de: 'Flache Lagune', en: 'Shallow Lagoon' }, zone: 'island', floor: 1650,
        rock: [0xfff0c0, 0xf2d894, 0xd9b877, 0xb89868, 0x937a5c], water: [0x7ff0e0, 0.22], open: 0.2,
        backRock: 400,
        rockWall: 0.15,
        coral: 0.12, kelp: 0.1, coins: 2, friendRate: 0.5, hazardRate: 0,
        props: { boulder: 2, seagrass: 5, anemone: 1 }, propRate: 2.0,
        friends: { friend_starfish: 3, friend_snail: 3, friend_turtle: 1, urchin: 1 }, hazards: {}
    },
    {
        // Shallow, sheltered, full of roots to weave through. `roots` = mangrove
        // roots hanging from the surface, some in front of the fish, most behind.
        id: 'mangrove', name: { de: 'Mangroven', en: 'Mangroves' }, zone: 'island', floor: 1900,
        rock: [0xe8d9a6, 0xbfae77, 0x8f8257, 0x665d44, 0x474233], water: [0x4fb98a, 0.22], open: 0.22,
        backRock: 400,
        rockWall: 0.6,
        coral: 0.25, kelp: 0.3, coins: 3, friendRate: 0.55, hazardRate: 0.1, roots: 4, spot: 'surface',
        props: { boulder: 1, barrel: 1, seagrass: 3, rowboat: 1 }, propRate: 1.3,
        friends: { friend_seahorse: 2, friend_snail: 2, friend_nudibranch: 2, friend_turtle: 1, friend_starfish: 1, urchin: 1 },
        hazards: { hazard_net: 1 }
    },
    {
        id: 'reef', name: { de: 'Korallenriff', en: 'Coral Reef' }, zone: 'island', floor: 2200,
        rock: ROCK_REEF, water: [0x3fd0e8, 0.0], open: 0.0,
        backRock: 900,
        rockWall: 0.45,
        coral: 0.6, kelp: 0.12, coins: 2, friendRate: 0.4, hazardRate: 0.12,
        props: { boulder: 2, seafan: 2, anemone: 2, seagrass: 1 }, propRate: 1.5,
        friends: { friend_starfish: 2, friend_snail: 2, friend_turtle: 1, friend_seahorse: 1, urchin: 2 },
        hazards: { spikes: 1 }
    },
    {
        id: 'blue', name: { de: 'Blaues Meer', en: 'Open Blue' }, zone: 'sea', floor: 4300,
        rock: [0xd9e2ee, 0xa9b8cc, 0x7d8fa8, 0x5a6a84, 0x414c63], water: [0x1b5fd0, 0.24], open: 0.3,
        backRock: 0,
        rockWall: 0,
        coral: 0, kelp: 0, coins: 3, friendRate: 0.45, hazardRate: 0.25,
        props: { boulder: 1, seafan: 1 }, propRate: 0.6,
        friends: { friend_jellyfish: 4, friend_turtle: 2 }, hazards: { mine: 2, hazard_buoy: 1 }
    },
    {
        // Cold water: anemones and sea fans, no reef corals.
        id: 'kelp', name: { de: 'Tangwald', en: 'Kelp Forest' }, zone: 'island', floor: 1900,
        rock: [0xc9d08a, 0x9fae62, 0x6f8250, 0x4d5f44, 0x384238], water: [0x2f9a5c, 0.26], open: 0.05,
        backRock: 1200,
        rockWall: 0.75,
        coral: 0, kelp: 0.85, coins: 2, friendRate: 0.35, hazardRate: 0.28,
        props: { boulder: 3, kelpclump: 3, anemone: 2, seafan: 1 }, propRate: 1.8,
        friends: { friend_seahorse: 3, friend_nudibranch: 3, friend_snail: 1, urchin: 1 },
        hazards: { hazard_net: 2, spikes: 1 }
    },
    {
        id: 'harbour', name: { de: 'Hafen', en: 'Harbour' }, zone: 'island', floor: 2000,
        rock: [0xb7b9b0, 0x8d9088, 0x676b66, 0x4a4e4c, 0x353838], water: [0x6f8f3a, 0.26], open: 0.08,
        backRock: 1200,
        rockWall: 0.7,
        coral: 0.05, kelp: 0.1, coins: 3, friendRate: 0.2, hazardRate: 0.65,
        props: { pier: 1, trawler: 4, rowboat: 2, barrel: 2, crate: 2, boulder: 1 }, propRate: 1.8,
        landmark: 'pier', spot: 'surface',   // the pier stands at the waterline
        friends: { friend_snail: 1, friend_nudibranch: 1 },
        hazards: { hazard_net: 4, hazard_buoy: 3, mine: 2, spikes: 2 }
    },
    {
        // Open sea again; far below lie the wrecks, for whoever dives. No light reaches that floor: no corals, no kelp.
        id: 'wreck', name: { de: 'Schiffsfriedhof', en: 'Ship Graveyard' }, zone: 'sea', floor: 4700,
        rock: [0xd0a67c, 0xa87a55, 0x7c5a44, 0x58423a, 0x3e3132], water: [0x8a5a2a, 0.2], open: 0.26,
        backRock: 0,
        rockWall: 0,
        coral: 0, kelp: 0, coins: 3, friendRate: 0.2, hazardRate: 0.55,
        props: { wreck: 5, trawler: 3, rowboat: 1, barrel: 2, crate: 1, boulder: 1, anemone: 1 }, propRate: 2.4,
        landmark: 'wreck',
        friends: { friend_starfish: 1, friend_seahorse: 1, urchin: 1 },
        hazards: { mine: 4, hazard_buoy: 2, spikes: 2 }
    },
    {
        // The last island before the volcano: bare rock, cold clear water, sea fans and urchins.
        id: 'shore', name: { de: 'Felsenküste', en: 'Rocky Shore' }, zone: 'island', floor: 1900,
        rock: [0xcfd3cc, 0xa3a9a4, 0x7b827f, 0x585f60, 0x3f4547], water: [0x4fa7b8, 0.2], open: 0.12,
        backRock: 1300,
        rockWall: 0.8,
        coral: 0.1, kelp: 0.3, coins: 3, friendRate: 0.4, hazardRate: 0.2,
        props: { boulder: 4, seafan: 2, anemone: 2, kelpclump: 1 }, propRate: 1.8,
        friends: { friend_starfish: 2, friend_snail: 1, friend_seahorse: 1, friend_nudibranch: 2, urchin: 3 },
        hazards: { spikes: 1, hazard_net: 1 }
    },
    {
        // No light down here: no reef corals and no seaweed (review R2).
        id: 'trench', name: { de: 'Tiefsee', en: 'Deep Trench' }, zone: 'sea', floor: 5600,
        rock: [0x7f86c4, 0x5b5f9c, 0x434576, 0x303158, 0x21213f], water: [0x1a0f4a, 0.42], open: 0.04,
        backRock: 1400,
        rockWall: 0.7,
        coral: 0, kelp: 0, coins: 4, friendRate: 0.25, hazardRate: 0.5,
        props: { boulder: 2, anemone: 1 }, propRate: 0.8,
        friends: { friend_jellyfish: 2, friend_nudibranch: 1, enemy_angler: 4, urchin: 1 },
        hazards: { mine: 3, spikes: 1 }
    }
];

// Lay the biomes out west -> east.
{
    let x = WORLD_WEST;
    for (const b of BIOMES) { b.from = x; b.width = WIDTHS[b.id]; x += b.width; }
}

/** x of the grand nest = end of the journey. */
export const WORLD_END = BIOMES[BIOMES.length - 1].from + BIOMES[BIOMES.length - 1].width;
const BLEND = 700; // px over which neighbouring biomes fade into each other

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function biomeIndexAt(x) {
    let i = 0;
    while (i < BIOMES.length - 1 && x >= BIOMES[i + 1].from) i++;
    return i;
}

/** The two biomes around x and how far (0..1) we are into the second one. */
export function biomeBlendAt(x) {
    const i = biomeIndexAt(x);
    const next = BIOMES[i + 1];
    if (next && x > next.from - BLEND) return { a: BIOMES[i], b: next, t: (x - (next.from - BLEND)) / (BLEND * 2) };
    const cur = BIOMES[i];
    if (i > 0 && x < cur.from + BLEND) return { a: BIOMES[i - 1], b: cur, t: 0.5 + (x - cur.from) / (BLEND * 2) };
    return { a: cur, b: cur, t: 0 };
}

export function mixColor(c1, c2, t) {
    const k = clamp(t, 0, 1);
    const ch = shift => Math.round(((c1 >> shift) & 255) + (((c2 >> shift) & 255) - ((c1 >> shift) & 255)) * k);
    return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

const BEACH_END = BIOMES[1].from;          // where the lagoon hands over to the mangroves
export const SHORE = WORLD_WEST + 1500;   // west of this the sand is above the water

/** How much higher the waves run here: surf builds up over the shallow beach. */
export function surfAt(x) {
    return 1 + 1.4 * clamp((BEACH_END - x) / (BEACH_END - SHORE), 0, 1);
}

/** The abyss: a narrow chasm in the deep-sea biome that drops far below everything else. */
export const ABYSS = { x: BIOMES[BIOMES.length - 1].from + 5200, halfWidth: 650, depth: 7500 };

// How the seabed gets from one biome's depth to the next (px along the way). Between an island
// and the sea the whole slope lies on the sea's side, so an island's coast keeps its depth right
// up to its edge: leaving an island the bottom falls away as a wall, toward one it climbs gently.
export const SEABED = { dropOff: 900, rise: 2600, coast: 1600, seaEdge: [300, 900], dropView: 1500 };   // seaEdge: px over which the open sea begins after an island and ends before one; dropView: px to either side of a drop-off over which the view tips down

const smooth = v => { const t = clamp(v, 0, 1); return t * t * (3 - 2 * t); };

/** Is the water at x open sea (far from any island's coast)? */
export function isSea(x) {
    return BIOMES[biomeIndexAt(x)].zone === 'sea';
}

// The reef crest (spec 5.0d): at the coral reef's outer edge the reef grows up to just under
// the surface, a wall of coral from there down to the seabed. Waves break on it; the calm
// route passes through it as a channel; beyond it the seabed falls away into the open sea.
export const REEF_CREST = { inset: 520, half: 400, ramp: 300, top: 180 };

/** World x of the middle of the reef crest. */
export function reefCrestX(cfg = REEF_CREST) {
    const reef = BIOMES.find(b => b.id === 'reef');
    return reef.from + reef.width - cfg.inset;
}

/** How much of the reef crest stands at x: 1 on it, 0 away from it. */
export function reefCrest(x, cfg = REEF_CREST) {
    return smooth((cfg.half + cfg.ramp - Math.abs(x - reefCrestX(cfg))) / cfg.ramp);
}

/** How much the water at x is open sea: 0 along the coasts, 1 out at sea, easing in just past an island's edge and out before the next. */
export function seaShare(x, cfg = SEABED) {
    const b = BIOMES[biomeIndexAt(x)];
    if (b.zone !== 'sea') return 0;
    return Math.min(smooth((x - b.from) / cfg.seaEdge[0]), smooth((b.from + b.width - x) / cfg.seaEdge[1]));
}

/**
 * How much the view should tip down at x (0..1): at a drop-off, where an island's seabed falls
 * away into the open sea, so the wall and the deep below come into the picture.
 */
export function dropOffView(x, cfg = SEABED) {
    let k = 0;
    for (let i = 1; i < BIOMES.length; i++) {
        if (BIOMES[i].zone !== 'sea' || BIOMES[i - 1].zone !== 'island') continue;
        k = Math.max(k, smooth(1 - Math.abs(x - (BIOMES[i].from + cfg.dropOff * 0.4)) / cfg.dropView));
    }
    return k;
}

/** Seabed depth: shallow along the islands, far down in the open sea between them, plus the abyss. */
export function floorY(x, cfg = SEABED) {
    const i = biomeIndexAt(x), b = BIOMES[i], prev = BIOMES[i - 1], next = BIOMES[i + 1];
    let base = b.floor;
    if (prev && prev.zone !== b.zone) {
        // island -> sea: the drop-off just inside the sea; sea -> island: nothing here, the rise lay in the sea
        if (b.zone === 'sea') base = prev.floor + (b.floor - prev.floor) * smooth((x - b.from) / cfg.dropOff);
    } else if (prev && x < b.from + cfg.coast / 2) {
        base = prev.floor + (b.floor - prev.floor) * smooth(0.5 + (x - b.from) / cfg.coast);
    }
    if (next && next.zone !== b.zone) {
        if (b.zone === 'sea') { const k = smooth((x - (next.from - cfg.rise)) / cfg.rise); base += (next.floor - base) * k; }
    } else if (next && x > next.from - cfg.coast / 2) {
        base = b.floor + (next.floor - b.floor) * smooth(0.5 + (x - next.from) / cfg.coast);
    }
    // The lagoon: the sand rises gently toward the west until it leaves the water.
    if (x < BEACH_END) {
        const t = clamp((x - SHORE) / (BEACH_END - SHORE), 0, 1);
        base = -70 + (base + 70) * Math.pow(t, 1.15);
    }
    const d = (x - ABYSS.x) / ABYSS.halfWidth;
    return base + ABYSS.depth * Math.exp(-d * d * 1.6);
}

/** Pick a key from a weighted table, skipping entries whose art is missing. */
export function pickWeighted(rng, table, exists) {
    const entries = Object.entries(table).filter(([key]) => exists(key));
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    if (total <= 0) return null;
    let roll = rng.frac() * total;
    for (const [key, w] of entries) { roll -= w; if (roll <= 0) return key; }
    return entries[entries.length - 1][0];
}

/**
 * A named place in the world, for repeatable screenshots and reviews
 * (`?at=kelp`, `?at=abyss`, `?at=12000,1800`): a biome id, "abyss" or "x,y".
 * Returns { x, y } or null. The caller moves it into open water if needed.
 */
export function spotFor(spec) {
    const xy = /^(-?\d+),(-?\d+)$/.exec(spec || '');
    if (xy) return { x: Number(xy[1]), y: Number(xy[2]) };
    if (spec === 'abyss') return { x: ABYSS.x, y: floorY(ABYSS.x - ABYSS.halfWidth * 3) + ABYSS.depth * 0.4 };
    const b = BIOMES.find(bi => bi.id === spec);
    if (!b) return null;
    const x = b.from + b.width / 2;
    // Where the biome shows what it is: under the roots at the surface, beside its landmark
    // on the seabed, otherwise in mid-water.
    if (b.spot === 'surface') return { x, y: Math.min(250, floorY(x) * 0.5) };
    if (b.landmark) return { x, y: floorY(x) - LANDMARK.above };
    return { x, y: Math.max(400, floorY(x) * 0.55) };
}

// A biome's landmark (`landmark` = a prop group: the wreck in the ship graveyard, the trawler
// in the harbour) is guaranteed where the player arrives: in the chunk column of the biome's
// entry and in the one of its `?at=` spot.
export const LANDMARK = { entry: 1500, above: 360 };

/** The landmark prop group that the chunk column `cx` must show, or null. */
export function landmarkGroup(cx, chunk, cfg = LANDMARK) {
    for (const b of BIOMES) {
        if (!b.landmark) continue;
        if (cx === Math.floor((b.from + cfg.entry) / chunk) || cx === Math.floor((b.from + b.width / 2) / chunk)) return b.landmark;
    }
    return null;
}
