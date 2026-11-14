// Sub-zones (pure, no Phaser; spec 5.0j): a long biome is not one stretch of the same seabed.
// Along it, every 15 000 to 25 000 px, the ground changes character: open sand flats, a seagrass
// meadow, low rock outcrops, a rocky gully, a garden of growth. A sub-zone shifts the seabed's
// depth, how much rock there is, and what grows and lies there; neighbours blend into each other.
// Which kinds a biome has is in its row in biomes.js (`zones`).

export const SUBZONES = {
    length: [15000, 25000],   // px one sub-zone is long
    blend: 3200,              // px over which two neighbours turn into each other
    margin: 6000,             // px at a biome's ends without any sub-zone effect (there the biomes themselves blend)
    fade: 3000,               // px over which the effect comes in after that margin
    // floor: px the seabed lies deeper (+) or higher (-); open: rock taken away (+) or added (-);
    // coral, kelp, propRate: factors on the biome's own rates; props: factors on its prop groups' weights;
    // cover: factor on the small ground cover (shells, pebbles, tufts), 1 where not given.
    kinds: {
        flats: { floor: 40, open: 0.07, coral: 0.4, kelp: 0.35, propRate: 0.8, cover: 1.5, props: { boulder: 0.4 } },
        meadow: { floor: 90, open: 0.04, coral: 0.4, kelp: 1.7, propRate: 1.5, props: { seagrass: 3.5, kelpclump: 2.5, boulder: 0.5 } },
        outcrops: { floor: -230, open: -0.06, coral: 1.2, kelp: 0.8, propRate: 1.25, props: { boulder: 3 } },
        gully: { floor: 320, open: -0.04, coral: 0.8, kelp: 1.1, propRate: 1, props: { boulder: 1.6, seafan: 2 } },
        garden: { floor: -90, open: 0, coral: 2.2, kelp: 0.5, propRate: 1.4, props: { anemone: 2.5, seafan: 2.5, boulder: 0.5 } }
    }
};

const hash = (i, k) => { const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };
const smooth = v => { const t = v <= 0 ? 0 : v >= 1 ? 1 : v; return t * t * (3 - 2 * t); };
const seedOf = id => { let s = 0; for (let i = 0; i < id.length; i++) s = s * 31 + id.charCodeAt(i); return s % 9973; };

const EDGES = new Map();      // biome id -> px from the biome's start at which each sub-zone ends

/** Where a biome's sub-zones end, as px from its start: [e0, e1, ...] (the last reaches its end). */
export function zoneEdges(biome, cfg = SUBZONES) {
    const cached = cfg === SUBZONES && EDGES.get(biome.id);
    if (cached) return cached;
    const s = seedOf(biome.id), out = [];
    for (let at = 0, k = 0; at < biome.width; k++) {
        at += cfg.length[0] + (cfg.length[1] - cfg.length[0]) * hash(s, k);
        out.push(at);
    }
    if (cfg === SUBZONES) EDGES.set(biome.id, out);
    return out;
}

const MIX = { a: null, b: null, t: 0, w: 0, index: 0 };

/**
 * The sub-zones at world x of a biome with `zones` (a list of kinds): writes { a, b (kind names),
 * t (0..1 how far into b), w (0..1 how strongly sub-zones act here), index (of a) } into `out`.
 * Returns null for a biome without sub-zones.
 */
export function zoneMix(biome, x, out = MIX, cfg = SUBZONES) {
    const kinds = biome.zones;
    if (!kinds?.length) return null;
    const edges = zoneEdges(biome, cfg), local = x - biome.from, start = (seedOf(biome.id) % kinds.length);
    let k = 0;
    while (k < edges.length - 1 && local >= edges[k] + cfg.blend / 2) k++;
    const kind = i => kinds[(start + i) % kinds.length];
    // Around this zone's east edge it turns into the next one, over `blend` px centred on the edge.
    out.a = kind(k); out.index = k;
    if (k < edges.length - 1 && local > edges[k] - cfg.blend / 2) { out.b = kind(k + 1); out.t = smooth(0.5 + (local - edges[k]) / cfg.blend); }
    else { out.b = out.a; out.t = 0; }
    const from = biome.zoneFrom ?? biome.from + cfg.margin;
    out.w = Math.min(smooth((x - from) / cfg.fade), smooth((biome.from + biome.width - cfg.margin - x) / cfg.fade));
    return out;
}

/** One of a mix's numbers (`floor` or `open`), blended and weighted; 0 where there are no sub-zones. */
export function zoneValue(mix, field, cfg = SUBZONES) {
    if (!mix || mix.w <= 0) return 0;
    const a = cfg.kinds[mix.a][field], b = cfg.kinds[mix.b][field];
    return (a + (b - a) * mix.t) * mix.w;
}

/** The kind that rules at a mix (for what grows and lies there), or null where sub-zones do not act. */
export function zoneKind(mix) {
    if (!mix || mix.w < 0.5) return null;
    return mix.t < 0.5 ? mix.a : mix.b;
}

const ZONED = new Map();      // "biome id:kind" -> the biome's row with that kind's rates

/** A biome's row as it is inside a sub-zone of `kind`: its own rates and prop weights times the kind's factors. */
export function zonedBiome(biome, kind, cfg = SUBZONES) {
    if (!kind) return biome;
    const key = `${biome.id}:${kind}`, cached = cfg === SUBZONES && ZONED.get(key);
    if (cached) return cached;
    const z = cfg.kinds[kind], props = {};
    for (const [group, w] of Object.entries(biome.props || {})) props[group] = w * (z.props[group] ?? 1);
    const row = { ...biome, zone: biome.zone, subzone: kind, coral: Math.min(0.9, biome.coral * z.coral), kelp: Math.min(0.9, biome.kelp * z.kelp), propRate: biome.propRate * z.propRate, cover: z.cover ?? 1, props };
    if (cfg === SUBZONES) ZONED.set(key, row);
    return row;
}
