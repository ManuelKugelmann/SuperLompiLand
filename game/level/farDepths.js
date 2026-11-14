// Far scenery (spec 10.10b, user 2026-11-14: "fake 3D by many 2D layers", "less detail in
// mid and back", "no floating landscape"): single objects — kelp stands, coral heads,
// boulders, hulls — each at its own parallax depth, never stacked bands with a ground
// line. Far ones are smaller, softer, hazier and fade out at their base into the water,
// so nothing has a cut edge and nothing floats. The open ocean has none.
// Pure (no Phaser): placement and looks; FarLayers.js draws. Tested in tests/farDepths.test.mjs.
import { biomeBlendAt, floorY } from './biomes.js';
import { rng, mix } from './layerMath.js';

export const FAR = {
    depths: [0.16, 0.24, 0.32, 0.41, 0.5, 0.6, 0.7],   // parallax (camera speed share), far -> near
    cell: 620,          // layer px per placement cell
    fog: 0.9,           // how much the farthest objects fade into the water (0 = none)
    tint: 0.7,          // and shift toward the water colour, at the farthest
    shrink: 0.6,        // farthest objects are this much smaller than near ones
    rise: 0.05,         // up to this share of the screen height above the far seabed
    horizon: 0.74       // screen height share of the infinitely far seabed (low: far bases hide behind the near seabed)
};

// What stands far away per biome: [texture key, weight, width range in px at depth 1].
const K = {
    kelp: [['kelp_stalk_1', 3, [700, 1300]], ['kelp_stalk_2', 3, [700, 1300]], ['kelp_stalk_3', 2, [600, 1100]]],
    corals: [['coral_1', 3, [300, 520]], ['coral_2', 3, [300, 520]], ['coral_3', 2, [260, 460]], ['seafan_1', 2, [280, 440]]],
    boulders: [['boulder_1', 1, [320, 700]], ['boulder_2', 1, [320, 700]], ['boulder_4', 1, [320, 700]], ['boulder_5', 1, [320, 700]]],
    hulls: [['wreck_1', 2, [1300, 2000]], ['wreck_2', 2, [1300, 2000]], ['trawler_1', 1, [900, 1300]], ['cutter_1', 1, [800, 1100]]]
};
const pick = (...groups) => groups.flatMap(([g, w]) => K[g].map(([key, kw, size]) => [key, kw * w, size]));

/** Per biome: objects per cell (at the nearest depth; far depths get fewer) and what they are. */
export const FAR_KINDS = {
    beach: { per: 0.8, kinds: pick(['boulders', 2], ['kelp', 0.3]) },
    reef: { per: 1, kinds: pick(['corals', 2], ['boulders', 1], ['kelp', 0.3]) },
    mangrove: { per: 1, kinds: pick(['kelp', 1], ['boulders', 1]) },
    kelp: { per: 2.4, kinds: pick(['kelp', 4], ['boulders', 0.5]) },
    blue: { per: 0, kinds: [] },
    wreck: { per: 1, kinds: pick(['hulls', 1], ['boulders', 1], ['kelp', 0.3]) },
    harbour: { per: 0.9, kinds: pick(['hulls', 1], ['boulders', 1]) },
    trench: { per: 0.7, kinds: pick(['boulders', 1]) }
};

/** World x that layer x `lx` lines up with when it is in the middle of a `W`-wide screen. */
export const worldXFor = (lx, s, W) => (lx - W / 2) / s + W / 2;

/**
 * The objects of placement cell `ci` at depth index `di` (deterministic).
 * @returns [{ key, lx, w, flip, rise, biome }]  lx in layer px, w = display width
 */
export function farCell(di, ci, W, seed = 1337, has = () => true) {
    const s = FAR.depths[di], r = rng(((seed * 31 + di) * 977 + ci) >>> 0);
    const mid = worldXFor((ci + 0.5) * FAR.cell, s, W);
    const biome = biomeBlendAt(mid).a;
    const spec = FAR_KINDS[biome.id] || FAR_KINDS.reef;
    const kinds = spec.kinds.filter(k => has(k[0]));
    const want = spec.per * (0.45 + 0.55 * s / FAR.depths[FAR.depths.length - 1]);
    const n = Math.floor(want) + (r() < want % 1 ? 1 : 0);
    const total = kinds.reduce((a, k) => a + k[1], 0);
    const out = [];
    for (let k = 0; k < n && total > 0; k++) {
        let roll = r() * total, kind = kinds[0];
        for (const e of kinds) { roll -= e[1]; if (roll <= 0) { kind = e; break; } }
        const [key, , [w0, w1]] = kind;
        const scale = 1 - FAR.shrink * (1 - s);
        out.push({ key, lx: (ci + 0.1 + r() * 0.8) * FAR.cell, w: (w0 + r() * (w1 - w0)) * scale, flip: r() < 0.5, rise: r() * FAR.rise * (1 - s), biome });
    }
    return out;
}

/**
 * Layer y of an object's base: on a far seabed that follows the real one at depth s and
 * approaches the horizon line as s goes to 0 (H = screen height). With scroll factor s
 * the base shows at screen y = result - camY * s.
 */
export function farBaseY(worldX, s, H, rise = 0) {
    return s * floorY(worldX) + H * FAR.horizon * (1 - s) - rise * H;
}

/** Alpha and tint of an object at depth s in a biome (fades into the water with distance). */
export function farLook(s, biome) {
    const far = 1 - s;
    const water = mix(biome.water[0], 0x2a9fc8, 0.5);
    return { alpha: 1 - FAR.fog * far, tint: mix(0xffffff, water, FAR.tint * far) };
}
