// Background layer maths (pure, unit-tested in tests/backLayers.test.mjs):
// tileable ridgelines, where a layer sits on screen, and its fogged colour.

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

/**
 * A ridgeline that tiles: heights 0..1 for n columns, built from a few sine
 * octaves whose frequencies are whole numbers of periods across the strip, so
 * the last column runs into the first. `rough` adds smaller bumps.
 */
export function ridge(n, seed, { octaves = 4, rough = 0.5, base = 0.45, amp = 0.35 } = {}) {
    const r = rng(seed);
    const waves = [];
    for (let o = 0; o < octaves; o++) {
        const f = (o + 1) * (1 + Math.floor(r() * 2));                 // whole periods: seamless
        waves.push({ f, phase: r() * Math.PI * 2, a: Math.pow(rough, o) });
    }
    const norm = waves.reduce((s, w) => s + w.a, 0);
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        let v = 0;
        for (const w of waves) v += w.a * Math.sin((i / n) * Math.PI * 2 * w.f + w.phase);
        out[i] = Math.min(1, Math.max(0, base + amp * v / norm));
    }
    return out;
}

/**
 * Where a background layer's ground line is on screen. The layer's ground is
 * `floor` (world y) less a rise; it moves with the camera by `scroll`
 * horizontally and less vertically (`vscroll`), so diving reads as going deeper.
 * It never rises above the water surface on screen.
 */
export function layerGroundY({ camY, H, floor, scroll, vscroll = scroll * 0.6, rise = 0, surfaceGap = 140 }) {
    const centre = camY + H / 2;
    const y = H / 2 + (floor - rise - centre) * vscroll;
    const surface = -camY;                       // screen y of the water surface
    return Math.max(y, surface + surfaceGap);
}

/** Tile offset so a layer slides at `scroll` times the camera speed (scale = display/texture). */
export function tileOffsetX(camX, scroll, scale) {
    return (camX * scroll) / scale;
}

const ch = (c, s) => (c >> s) & 255;

/** Mix two 0xRRGGBB colours. */
export function mix(c1, c2, t) {
    const k = Math.min(1, Math.max(0, t));
    const m = s => Math.round(ch(c1, s) + (ch(c2, s) - ch(c1, s)) * k);
    return (m(16) << 16) | (m(8) << 8) | m(0);
}

/**
 * The colour a layer is tinted with: its rock colour fogged toward the water colour by
 * the layer's fog amount, then toward the deep colour as the view goes down.
 */
export function layerTint(rock, water, fog, deep = 0x04122e, deepAmount = 0) {
    return mix(mix(rock, water, fog), deep, deepAmount);
}
