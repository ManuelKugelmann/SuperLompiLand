// Caustic light pattern and depth grade maths (pure, unit-tested in tests/caustics.test.mjs).

/** Small seeded RNG (mulberry32). */
function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Seamlessly tiling caustic pattern: bright thin lines along the edges of
 * Voronoi cells (where F2 - F1 is small), the look of sunlight focused by waves.
 * Returns intensities 0..1 in a Float32Array(size * size), row-major.
 */
export function causticPattern(size = 256, cells = 22, seed = 7, width = 0.075) {
    const r = rng(seed);
    const pts = Array.from({ length: cells }, () => [r(), r()]);
    const out = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const u = x / size, v = y / size;
            let f1 = Infinity, f2 = Infinity;
            for (const [px, py] of pts) {
                // Wrap-around distance makes the tile seamless.
                let dx = Math.abs(u - px); if (dx > 0.5) dx = 1 - dx;
                let dy = Math.abs(v - py); if (dy > 0.5) dy = 1 - dy;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
            }
            const e = Math.min(1, (f2 - f1) / width);
            out[y * size + x] = Math.pow(1 - e * e * (3 - 2 * e), 1.6);   // 1 on the edge, soft falloff
        }
    }
    return out;
}

/**
 * How strong surface light is at a depth (world y; the water surface is at 0).
 * Full just below the surface, gone by `fadeTo`. Above water: 0.
 */
export function sunlightAt(y, fadeTo = 2600) {
    if (y < 0) return 0;
    const k = Math.max(0, 1 - y / fadeTo);
    return k * k * (3 - 2 * k);
}

/**
 * 4x5 colour matrix (row-major, offsets in 0..1) for the underwater grade:
 * near the surface a gentle saturation lift (the lookdev is saturated and sunlit),
 * deeper the red channel is absorbed first and everything leans blue-green.
 * `light` = sunlightAt(depth), `sat` = extra saturation at full light.
 */
export function gradeMatrix(light, sat = 0.18, absorb = 0.35, exposure = 0) {
    const s = 1 + sat * light;                       // saturation factor
    const e = 1 + exposure * light;                  // brighter in sunlit water (auto-exposure by depth)
    const lr = 0.2126, lg = 0.7152, lb = 0.0722;     // luminance weights
    const sr = (1 - s) * lr, sg = (1 - s) * lg, sb = (1 - s) * lb;
    const dark = 1 - light;
    const red = 1 - absorb * dark;                   // reds fade first with depth
    const green = 1 - absorb * 0.35 * dark;
    return [
        (sr + s) * red * e, sg * red * e, sb * red * e, 0, 0,
        sr * green * e, (sg + s) * green * e, sb * green * e, 0, 0,
        sr * e, sg * e, (sb + s) * e, 0, 0.02 * dark,  // a touch of blue lift in the deep
        0, 0, 0, 1, 0
    ];
}

// Caustics on surfaces (spec 5.0j, user: "2.5d wrapped caustic patterns on assets and ground,
// not flat", "animated caustics, stronger near surface and light shafts"). The pattern is worked
// out per pixel in a shader (CausticsPipeline.js) from these numbers; the same rules are here as
// plain functions, so they can be tested and read.
export const SURFACE_CAUSTICS = {
    strength: 0.5,        // how much light the net adds at its brightest (0 = off: nothing gets the shader)
    line: 0.085,          // width of the net's lines, in shares of a cell (edges of moving Voronoi cells: an organic web, not a grid)
    full: 1300,           // px under the surface down to which it is at full strength (the whole sunny lagoon floor) ...
    gone: 3000,           // ... and by which it has faded out
    period: 4096,         // px after which the whole pattern repeats (the shader works with x wrapped to it)
    cells: [24, 36],      // net cells per period for the two layers laid over each other (~170 and ~115 px; even numbers)
    drift: [0.55, 0.75],  // how fast each layer's cells move (radians per second)
    wrap: 70,             // px the net is pushed along a surface's relief per unit of brightness change: it bends over bumps
    skin: [0.04, 0.09],   // texture-space reach of the top skin: light lands on the upper faces of a picture; deep inside it (opaque far above too) it fades
    relief: 0.012,        // texture-space step for reading the relief (wide enough that fine paint detail does not speckle)
    lit: [0.22, 0.55],   // brightness of a surface from which it begins to catch the net, and from which it catches all of it
    facing: 6,            // how quickly the net fades on a face that looks down (brightness rising downward)
    shaft: { bands: 2, slant: 0.35, floor: 0.45, speed: 0.06 },   // light shafts: bands per period, their slant (px sideways per px down), the share of light between them, their drift
    warmth: 0.5           // 0 = the net has the water's hue, 1 = it is white sunlight
};

const smooth01 = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

/** How strong the net is at world depth y (0 = the surface): none above the water, full near the surface, gone in the deep. */
export function causticDepth(y, cfg = SURFACE_CAUSTICS) {
    if (y < 0) return 0;
    const k = Math.max(0, Math.min(1, (cfg.gone - y) / (cfg.gone - cfg.full)));
    return k * k;
}

/** How much light a shaft brings at (x, y) at time t (s): 1 inside a shaft, `floor` between two. */
export function causticShaft(x, y, t, cfg = SURFACE_CAUSTICS) {
    const s = cfg.shaft, a = (x + y * s.slant) * (2 * Math.PI * s.bands / cfg.period) + t * s.speed;
    return s.floor + (1 - s.floor) * smooth01(-0.3, 0.7, Math.sin(a));
}

/** How much of the net a surface of this brightness catches, given how its brightness changes downward (per texel step). */
export function causticCatch(luma, lumaDown, cfg = SURFACE_CAUSTICS) {
    return smooth01(cfg.lit[0], cfg.lit[1], luma) * Math.max(0, Math.min(1, 1 - (lumaDown - luma) * cfg.facing));
}
