// How far things move up and down on screen when the camera dives (pure, no Phaser; spec 5.0w).
// One rule for everything behind the play plane: the farther away, the less it moves, by the same
// share up and down as sideways, so far layers never slide against one another or against the seabed
// they stand on. And the surface stays the anchor of a dive: a far, bright band of it stays at the top
// edge for the first screens down and slides away slowly (playtest: "bg vertical parallax needs fixing",
// "depth scale not felt").

export const PARALLAX = {
    farSea: 0.25,        // the open sea's far island socket and wrecks: share of the camera's vertical movement
    farSeaRest: 500,     // camera y at which they stand on the view's bottom edge
    surface: {
        k: 0.3,          // the far surface band moves this share of the camera's vertical movement
        from: 300,       // camera y at which its top meets the view's top edge (the near sea is out of the picture by then)
        band: 640,       // px tall
        alpha: 0.32,     // how bright at its top (it is added to the water's colour)
        fadeTo: 4200     // camera y by which it has faded out altogether
    }
};

/** Screen y of a far thing that stands at `base` when the camera is at `rest`: it moves `k` of the camera's way. */
export function farY(base, camY, k, rest) {
    return base - (camY - rest) * k;
}

/** The far surface band at camera y: { top (screen y of its top edge), alpha }, alpha 0 when it is not to be seen. */
export function surfaceBand(camY, cfg = PARALLAX.surface) {
    const top = farY(0, camY, cfg.k, cfg.from);
    const fade = Math.max(0, Math.min(1, 1 - (camY - cfg.from) / (cfg.fadeTo - cfg.from)));
    return { top, alpha: camY < 0 || top + cfg.band < 0 ? 0 : cfg.alpha * fade };
}
