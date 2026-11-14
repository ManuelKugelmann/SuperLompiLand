// Small shared maths for scenery layers (pure, tested in tests/farDepths.test.mjs).

/** Seeded RNG (mulberry32). */
export function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const ch = (c, s) => (c >> s) & 255;

/** Mix two 0xRRGGBB colours. */
export function mix(c1, c2, t) {
    const k = Math.min(1, Math.max(0, t));
    const m = s => Math.round(ch(c1, s) + (ch(c2, s) - ch(c1, s)) * k);
    return (m(16) << 16) | (m(8) << 8) | m(0);
}

/**
 * Pictures of far or back rock are baked small and drawn several times enlarged (rock layers,
 * chunk back walls): fine bright detail in the material would show as pixel blocks. A one-texel
 * blur of the colour (the outline, in alpha, stays sharp) keeps them soft, as far rock should be.
 */
export function softenLayer(rgba, size) {
    const src = Uint8ClampedArray.from(rgba);
    // Every texel, the border ones too (clamped): a border row left sharp would show as a line
    // where two chunks meet.
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const o = (y * size + x) * 4;
            if (src[o + 3] === 0) continue;
            for (let c = 0; c < 3; c++) {
                let sum = 0, w = 0;
                for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                    const yy = Math.min(size - 1, Math.max(0, y + dy)), xx = Math.min(size - 1, Math.max(0, x + dx));
                    const q = (yy * size + xx) * 4, k = (dx === 0 && dy === 0 ? 4 : dx === 0 || dy === 0 ? 2 : 1) * (src[q + 3] > 0 ? 1 : 0);
                    sum += src[q + c] * k; w += k;
                }
                rgba[o + c] = sum / w;
            }
        }
    }
    return rgba;
}
