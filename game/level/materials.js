// Rock materials for the terrain shader: real stone photographed as seamless PBR
// sets (ambientCG, CC0), reduced to one compact tile each. A tile tells the shader
// how the stone's colour varies around its mean (so the biome palette still sets
// the overall colour) and how high its surface is (for the light). Each biome mixes
// two materials under a large, soft mask, so no stretch of rock is uniform.
// Pure (no Phaser, no DOM): built on the main thread from the loaded images, sent
// once to the terrain worker. Without the images the shader keeps its procedural
// grain. Tested in tests/materials.test.mjs.

export const MAT = {
    size: 512,          // tile side, px (rock picture px)
    colour: 0.8,        // how much of the stone's own colour variation shows (0 = flat palette)
    relief: 0.32,       // strength of the stone's surface in the lighting
    macro: 0.22,        // large, slow light/dark variation (breaks up repeats)
    maskScale: 760,     // world px: size of the patches where the second material shows
    share: 0.38         // rough share of the second material
};

/** Material per file under public/img/mat/ (colour `<name>.jpg`, height `<name>_h.jpg`); `reef` is made by scripts/mat/reef.py. */
export const MATERIALS = ['limestone', 'sandstone', 'granite', 'mudstone', 'basalt', 'rust', 'reef'];

/** [main, second] material per biome. */
export const BIOME_MATERIALS = {
    beach: ['limestone', 'sandstone'],
    reef: ['reef', 'limestone'],     // coral-encrusted limestone (procedural: scripts/mat/reef.py)
    mangrove: ['mudstone', 'limestone'],
    kelp: ['granite', 'basalt'],
    blue: ['granite', 'limestone'],
    wreck: ['sandstone', 'rust'],
    shore: ['granite', 'basalt'],
    harbour: ['granite', 'rust'],
    trench: ['basalt', 'mudstone']
};

/**
 * One tile from decoded RGBA pixels of the colour and height images (both size²).
 * Out: Uint8Array size²×4 — RGB = the colour relative to the stone's mean (128 = mean,
 * 255 = twice as bright), A = height (0..255).
 */
export function prepareTile(colour, height, size = MAT.size) {
    const n = size * size, mean = [0, 0, 0];
    for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) mean[c] += colour[i * 4 + c];
    // A floor on the mean keeps very dark stone (basalt) from amplifying JPEG noise.
    for (let c = 0; c < 3; c++) mean[c] = Math.max(24, mean[c] / n);
    const out = new Uint8Array(n * 4);
    for (let i = 0; i < n; i++) {
        for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.min(255, Math.round(colour[i * 4 + c] / mean[c] * 128));
        out[i * 4 + 3] = height[i * 4];
    }
    return out;
}

/** Index of each biome's [main, second] material in MATERIALS. */
export const BIOME_INDEX = Object.fromEntries(Object.entries(BIOME_MATERIALS).map(([id, m]) => [id, m.map(x => MATERIALS.indexOf(x))]));

let tiles = null;
/** @param t  array of tiles in MATERIALS order (null = procedural grain) */
export function setMaterials(t) { tiles = t && t.length === MATERIALS.length && t.every(Boolean) ? t : null; }
export function materialTiles() { return tiles; }
