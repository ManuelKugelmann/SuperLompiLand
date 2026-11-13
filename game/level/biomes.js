// The journey runs west -> east. West of the home reef is a shallow, safe
// lagoon; every biome further east is deeper and a little more dangerous.
// A Lompi nest (checkpoint) sits on the seabed at the start of each biome and
// the grand nest at the very end.
//
// Per biome:
//   rock     terrain colour bands, rim -> core          water   tint laid over the backdrop [colour, alpha]
//   open     how much rock is removed (0 = cave-rich, 0.3 = wide open water)
//   coral    chance that a floor spot gets coral          kelp    chance that it gets a kelp stalk
//   Friends are the sea's own creatures (anglerfish and urchins included).
//   Hazards are what the volcano's eruption and people left behind, all of
//   it inanimate and realistic: lost anchors on chains, rusty drums, wreck
//   scrap, drifting ghost nets. No machines with faces, no cartoon enemies.
//   (Texture keys are historical: mine = anchor on a chain, hazard_buoy = oil
//   drum, spikes = wreck scrap, hazard_net = ghost net.) Animals never hurt.
//   coins    coin trails per chunk                        friends / hazards: weighted spawn tables
//   friendRate / hazardRate: chance per chunk
export const BIOME_WIDTH = 5000;
export const WORLD_WEST = -9000;

const ROCK_REEF = [0xf3dba0, 0xd2ae6c, 0x9c7a54, 0x6a5748, 0x4b4350];

export const BIOMES = [
    {
        id: 'beach', name: { de: 'Sandstrand', en: 'Sandy Beach' }, from: WORLD_WEST,
        rock: [0xfff0c0, 0xf2d894, 0xd9b877, 0xb89868, 0x937a5c], water: [0x7ff0e0, 0.22], open: 0.2,
        coral: 0.35, kelp: 0.1, coins: 2, friendRate: 0.5, hazardRate: 0,
        friends: { friend_starfish: 3, friend_snail: 3, friend_turtle: 1, friend_clownfish: 2, urchin: 1 }, hazards: {}
    },
    {
        id: 'reef', name: { de: 'Heimatriff', en: 'Home Reef' }, from: -2500,
        rock: ROCK_REEF, water: [0x3fd0e8, 0.0], open: 0.0,
        coral: 0.6, kelp: 0.12, coins: 2, friendRate: 0.4, hazardRate: 0.12,
        friends: { friend_starfish: 2, friend_snail: 2, friend_clownfish: 3, friend_turtle: 1, friend_seahorse: 1, urchin: 2 },
        hazards: { spikes: 1 }
    },
    {
        // Shallow, sheltered, full of roots to weave through. `roots` = mangrove
        // roots hanging from the surface, some in front of the fish, most behind.
        id: 'mangrove', name: { de: 'Mangroven-Lagune', en: 'Mangrove Lagoon' }, from: 2500,
        rock: [0xe8d9a6, 0xbfae77, 0x8f8257, 0x665d44, 0x474233], water: [0x4fb98a, 0.22], open: 0.22,
        coral: 0.25, kelp: 0.3, coins: 3, friendRate: 0.55, hazardRate: 0.1, roots: 4,
        friends: { friend_seahorse: 2, friend_snail: 2, friend_nudibranch: 2, friend_turtle: 1, friend_starfish: 1, urchin: 1 },
        hazards: { hazard_net: 1 }
    },
    {
        id: 'kelp', name: { de: 'Tangwald', en: 'Kelp Forest' }, from: 7500,
        rock: [0xc9d08a, 0x9fae62, 0x6f8250, 0x4d5f44, 0x384238], water: [0x2f9a5c, 0.26], open: 0.05,
        coral: 0.15, kelp: 0.85, coins: 2, friendRate: 0.35, hazardRate: 0.28,
        friends: { friend_seahorse: 3, friend_nudibranch: 3, friend_snail: 1, urchin: 1 },
        hazards: { hazard_net: 2, spikes: 1 }
    },
    {
        id: 'blue', name: { de: 'Blaues Meer', en: 'Open Blue' }, from: 12500,
        rock: [0xd9e2ee, 0xa9b8cc, 0x7d8fa8, 0x5a6a84, 0x414c63], water: [0x1b5fd0, 0.24], open: 0.3,
        coral: 0.15, kelp: 0.05, coins: 3, friendRate: 0.45, hazardRate: 0.25,
        friends: { friend_jellyfish: 4, friend_turtle: 2 }, hazards: { mine: 2, hazard_buoy: 1 }
    },
    {
        id: 'wreck', name: { de: 'Schiffsfriedhof', en: 'Ship Graveyard' }, from: 17500,
        rock: [0xd0a67c, 0xa87a55, 0x7c5a44, 0x58423a, 0x3e3132], water: [0x8a5a2a, 0.2], open: 0.1,
        coral: 0.12, kelp: 0.1, coins: 3, friendRate: 0.2, hazardRate: 0.55,
        friends: { friend_starfish: 1, friend_seahorse: 1, urchin: 1 },
        hazards: { mine: 4, hazard_buoy: 2, spikes: 2 }
    },
    {
        id: 'harbour', name: { de: 'Hafen', en: 'Harbour' }, from: 22500,
        rock: [0xb7b9b0, 0x8d9088, 0x676b66, 0x4a4e4c, 0x353838], water: [0x6f8f3a, 0.26], open: 0.08,
        coral: 0.05, kelp: 0.1, coins: 3, friendRate: 0.2, hazardRate: 0.65,
        friends: { friend_snail: 1, friend_nudibranch: 1 },
        hazards: { hazard_net: 4, hazard_buoy: 3, mine: 2, spikes: 2 }
    },
    {
        id: 'trench', name: { de: 'Tiefsee', en: 'Deep Trench' }, from: 27500,
        rock: [0x7f86c4, 0x5b5f9c, 0x434576, 0x303158, 0x21213f], water: [0x1a0f4a, 0.42], open: 0.04,
        coral: 0.2, kelp: 0.05, coins: 4, friendRate: 0.25, hazardRate: 0.5,
        friends: { friend_jellyfish: 2, friend_nudibranch: 1, enemy_angler: 4, urchin: 1 },
        hazards: { mine: 3, spikes: 1 }
    }
];

/** x of the grand nest = end of the journey. */
export const WORLD_END = BIOMES[BIOMES.length - 1].from + BIOME_WIDTH;
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

/** The abyss: a narrow chasm in the deep-sea biome that drops far below everything else. */
export const ABYSS = { x: BIOMES[BIOMES.length - 1].from + 2800, halfWidth: 650, depth: 7500 };

/** Seabed depth: shallow in the west, dropping steadily toward the east, plus the abyss. */
export function floorY(x) {
    const base = clamp(1050 + (x - WORLD_WEST) * 0.125, 1000, 5600);
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
