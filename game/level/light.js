// The light under water (pure, no Phaser; spec gamedesign §5.0j, user 2026-11-14): "tint and light
// from skylight, ground reflect, ambient light, sediment and depth"; "very gradual surface light
// changes: storm, day, night, sunset"; "tint not too strong, assets carry mood". Every part is
// subtle; the result multiplies the scene, so white = no change. Tested in tests/light.test.mjs.
import { mixColor } from './biomes.js';

export const LIGHT = {
    dayS: 1200,          // one sky cycle (s): day, sunset, night, dawn, very gradual
    phases: [            // [share of the cycle, sky colour, strength 0..1]
        [0.55, 0xfff6e8, 1.0],     // day: warm white
        [0.12, 0xffb27a, 0.92],    // sunset: golden orange
        [0.21, 0x6a82d0, 0.6],     // night: cool blue, still bright enough to play
        [0.12, 0xffc9b0, 0.9]      // dawn: soft pink
    ],
    skyReach: 1800,      // px: the sky's colour fades out over this depth
    storm: [0x9aa3a8, 0.86],      // overcast grey and strength under a storm
    hue: 0.12,           // how far the biome's water hue tints the light (gentle: assets carry the mood)
    bounce: 0.14,        // how much the seabed's colour bounces up near it ...
    bounceReach: 700,    // ... within this many px above it
    sediment: 0.1,       // a biome's murk (0..1, MURK) pulls the light further toward its hue by this much at most
    deepColor: 0x0c1436, // depth darkens toward this, mixed with the biome hue (WATER_LIGHT.deepHue)
    deep: 0.8,           // at full depth
    sunNight: 0.15,      // light shafts and the exposure lift left at night ...
    sunStorm: 0.6        // ... and taken by a full storm
};

/** Sediment per biome (0 clear .. 1 murky): mangrove mud, harbour silt, rust round the wrecks. */
export const MURK = { mangrove: 0.8, harbour: 0.7, wreck: 0.5, kelp: 0.3, shore: 0.3 };

/** A biome blend's murk ({ a, b, t } from biomes.biomeBlendAt). */
export const murkAt = ({ a, b, t }) => (MURK[a.id] || 0) * (1 - t) + (MURK[b.id] || 0) * t;

const smooth = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const scale = (c, k) => mixColor(0x000000, c, k);

/** The sky's colour and strength at time t (s): phases blend into each other over their whole length. */
export function skyAt(t, cfg = LIGHT) {
    const u = ((t / cfg.dayS) % 1 + 1) % 1, ph = cfg.phases;
    let start = 0;
    for (let i = 0; i < ph.length; i++) {
        const len = ph[i][0];
        if (u < start + len || i === ph.length - 1) {
            const k = (u - start) / len, next = ph[(i + 1) % ph.length];
            // Hold the first half of the phase, cross into the next over its second half.
            const m = smooth((k - 0.5) / 0.5);
            return { color: mixColor(ph[i][1], next[1], m), strength: ph[i][2] + (next[2] - ph[i][2]) * m };
        }
        start += len;
    }
    return { color: ph[0][1], strength: ph[0][2] };
}

/** How much it is night (0 day .. 1 full night), from the sky's strength: sunset and dawn are partway. */
export function nightShare(t, cfg = LIGHT) {
    const day = cfg.phases[0][2], night = Math.min(...cfg.phases.map(p => p[2]));
    return Math.min(1, Math.max(0, (day - 0.05 - skyAt(t, cfg).strength) / (day - 0.05 - night)));
}

/** The sun's share of the light (1 clear day .. `cfg.sunNight` at night; a storm takes up to `cfg.sunStorm`): shafts and exposure follow it. */
export const sunAt = (t, storm = 0, cfg = LIGHT) => (1 - (1 - cfg.sunNight) * nightShare(t, cfg)) * (1 - cfg.sunStorm * storm);

/**
 * The scene light at a place: { depth01 (0 surface .. 1 deep), t (s), storm (0..1), hue (the
 * biome's water hue), deepHue (a deep version of it), floorGap (px from here down to the seabed),
 * ground (the seabed's colour), murk (0..1) }.
 */
export function lightAt({ depth01 = 0, y = 0, t = 0, storm = 0, hue = 0xffffff, deepHue = LIGHT.deepColor, floorGap = Infinity, ground = 0xd9c39a, murk = 0 }, cfg = LIGHT) {
    // Skylight: the sky's colour near the surface, a storm turns it overcast; fades with depth.
    const sky = skyAt(t, cfg), skyCol = mixColor(sky.color, cfg.storm[0], storm), skyK = sky.strength + (cfg.storm[1] - sky.strength) * storm;
    const nearSurface = 1 - smooth(y / cfg.skyReach);
    let c = mixColor(0xffffff, scale(skyCol, skyK), nearSurface);
    // Ambient: the biome's hue, gently.
    c = mixColor(c, hue, cfg.hue + cfg.sediment * murk);
    // Ground bounce: the seabed's colour, close above it.
    const b = cfg.bounce * (1 - smooth(floorGap / cfg.bounceReach));
    c = mixColor(c, mixColor(c, ground, 0.6), b);
    // Depth: darker, toward a deep version of the hue.
    return mixColor(c, deepHue, depth01 * cfg.deep);
}
