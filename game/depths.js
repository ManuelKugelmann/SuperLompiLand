// The one order of things in the world scene, back to front (pure, no Phaser). Every depth a
// layer gives its objects lies in the band of its kind; a new layer picks its place here, not
// by trying numbers. Bands are [from, to): from the far sky to the in-scene overlays.
//
// The waterline rule: land on the horizon (coasts, islands, the volcano) is sky, behind the
// sea's fill; whatever stands in the water in the play plane (rock arches, quays, roots, rafts,
// resting animals) is behind the surface line, so the water visibly laps in front of it; only
// water itself and weather (surf, spray, rain) are drawn in front of the surface line above it.
// A thing that crosses the surface is one object with one depth above and below.

export const DEPTH = {
    bands: [
        { id: 'sky', from: -30, to: -28.02 },          // sky gradient, sun, clouds, far skyline, storm sky, coasts on the horizon
        { id: 'seaFill', from: -28.02, to: -27.95 },   // the sea's own colour from the wave line down: it hides the feet of everything in the sky band
        { id: 'sockets', from: -27.95, to: -27 },      // the underwater feet of coasts and islands, seen through the water
        { id: 'farWater', from: -27, to: -6 },         // far sea, far reef and rock layers (parallax), distant shoals, marine snow
        { id: 'backProps', from: -6, to: 0 },          // things just behind the play plane: back plants, big corals, far-off animals
        { id: 'ground', from: 0, to: 2 },              // terrain and what lies on it
        { id: 'setPieces', from: 2, to: 3.4 },         // big things standing in the play plane: arches, wrecks, quays, containers, gardens
        { id: 'creatures', from: 3.4, to: 4 },         // shoals and animals the swimmer passes in front of
        { id: 'player', from: 4, to: 4.85 },           // the swimmer, friends, rescues, animals at the surface
        { id: 'surfaceLine', from: 4.85, to: 5 },      // the wave line, its caps and streaks
        { id: 'front', from: 5, to: 8 },               // light shafts, surf and weather, front plants and silhouettes (they fade over the swimmer)
        { id: 'effects', from: 8, to: 39 },            // bursts, trails, markers
        { id: 'light', from: 39, to: 50 },             // the ambient light over the world, and the glows that stay bright in it
        { id: 'overlay', from: 50, to: Infinity }      // banners and in-scene UI
    ],
    seaFill: -28,          // Backdrop's sea fill and its fade
    coast: -28.05,         // the nearest land in the sky band
    socket: -27.9,         // rock under a coast
    surfaceLine: 4.9       // the wave line itself (caps just in front, streaks just behind)
};

/** The band a depth lies in (its id), or null below the sky. */
export function bandOf(depth, cfg = DEPTH) {
    for (const b of cfg.bands) if (depth >= b.from && depth < b.to) return b.id;
    return null;
}

/** Whether something at `depth` that reaches above the water keeps the waterline rule: behind the surface line, or sky. */
export function behindSurface(depth, cfg = DEPTH) {
    return depth < cfg.bands.find(b => b.id === 'surfaceLine').from;
}
