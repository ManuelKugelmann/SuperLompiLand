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
