// Layer table for the parallax groups (spec 10.10 / 10.10b). Background group only for
// now; the mid and foreground groups can add rows with the same fields.
//   scroll   horizontal parallax (camera speed multiplier); vertical uses 0.6 x scroll
//   fog      0..1 toward the biome's water colour (far = more)
//   height   silhouette height as a share of the screen height
//   rise     how far (world px) the layer's ground sits above the seabed (far ridges rise)
//   density  how many shapes the layer's texture gets (1 = the kind's full count)
//   blur     bake blur in texture px (far = softer)
//   depth    Phaser depth (behind the backdrop schools at -16 and light shafts at -12)
//   strength 0 switches a layer off
export const BACK_LAYERS = [
    // Off (strength 0) until painted, 2.5D layer art replaces the drawn primitive silhouettes,
    // which read as flat solids with cut-offs (user feedback 2026-11-14).
    { id: 'haze', scroll: 0.08, fog: 0.74, height: 0.42, rise: 900, density: 0.45, blur: 7, depth: -21, strength: 0 },
    { id: 'far', scroll: 0.25, fog: 0.5, height: 0.36, rise: 450, density: 0.75, blur: 4, depth: -19, strength: 0 },
    { id: 'back', scroll: 0.45, fog: 0.3, height: 0.3, rise: 120, density: 1, blur: 2, depth: -17.5, strength: 0 }
];

// Midground (spec 10.10 "mid reef" and "back play"): the game's own painted art — rock and
// sand textures for the ground, the coral, rock and kelp sprites on top — baked in
// world-anchored chunks, scaled by distance and fogged toward the water.
//   scroll   horizontal parallax; vertical uses vscroll
//   fog      0..1 toward the water colour      height  chunk height as a share of the screen
//   rise     ground above the seabed (px)       items   decor per 1024-px chunk
//   size     decor size (share of chunk height) depth   Phaser depth (shafts are at -12)
export const MID_LAYERS = [
    // Off (strength 0): the stacked bands showed creases, cut-offs and seams and felt like a
    // layer cake (user, 2026-11-14). Being replaced by many individual depths (spec 10.10b).
    { id: 'mid', scroll: 0.6, vscroll: 0.7, fog: 0.58, height: 0.42, rise: 260, items: 9, size: 0.42, depth: -15, strength: 0 },
    { id: 'backplay', scroll: 0.82, vscroll: 0.88, fog: 0.36, height: 0.4, rise: 60, items: 7, size: 0.55, depth: -10, strength: 0 }
];

// Silhouette kinds (big soft shapes only — the background has no micro detail, spec 10.10b).
//   ridge    ground line roughness/height
//   shapes   which shapes stand on the ground, and how many per texture (at density 1)
export const BACK_KINDS = {
    dunes: { ridge: { rough: 0.35, base: 0.25, amp: 0.18 }, shapes: { dome: 4, grass: 10 } },
    reef: { ridge: { rough: 0.5, base: 0.35, amp: 0.3 }, shapes: { dome: 9, fan: 6, branch: 6 } },
    meadow: { ridge: { rough: 0.3, base: 0.25, amp: 0.15 }, shapes: { grass: 22, dome: 3 } },
    kelp: { ridge: { rough: 0.45, base: 0.3, amp: 0.25 }, shapes: { kelp: 16, dome: 2 } },
    seamount: { ridge: { rough: 0.6, base: 0.2, amp: 0.45 }, shapes: { dome: 2 } },
    wreck: { ridge: { rough: 0.5, base: 0.3, amp: 0.25 }, shapes: { hull: 2, mast: 3, dome: 3 } },
    harbour: { ridge: { rough: 0.25, base: 0.3, amp: 0.12 }, shapes: { piling: 10, quay: 1 } },
    spires: { ridge: { rough: 0.65, base: 0.3, amp: 0.35 }, shapes: { spire: 8 } }
};

const BY_BIOME = { beach: 'dunes', reef: 'reef', mangrove: 'meadow', kelp: 'kelp', blue: 'seamount', wreck: 'wreck', harbour: 'harbour', trench: 'spires' };

/** Which silhouette kind a biome's background uses. */
export function kindFor(biomeId) {
    return BY_BIOME[biomeId] || 'reef';
}
