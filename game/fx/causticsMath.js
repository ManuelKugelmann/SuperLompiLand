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
export function gradeMatrix(light, sat = 0.18, absorb = 0.35) {
    const s = 1 + sat * light;                       // saturation factor
    const lr = 0.2126, lg = 0.7152, lb = 0.0722;     // luminance weights
    const sr = (1 - s) * lr, sg = (1 - s) * lg, sb = (1 - s) * lb;
    const dark = 1 - light;
    const red = 1 - absorb * dark;                   // reds fade first with depth
    const green = 1 - absorb * 0.35 * dark;
    return [
        (sr + s) * red, sg * red, sb * red, 0, 0,
        sr * green, (sg + s) * green, sb * green, 0, 0,
        sr, sg, sb + s, 0, 0.02 * dark,              // a touch of blue lift in the deep
        0, 0, 0, 1, 0
    ];
}
