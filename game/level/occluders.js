// The player is never hidden (spec 10.10a): anything drawn in front of the play plane
// (foreground roots, kelp, corals) fades while a player overlaps it, and comes back when
// clear. Pure helpers; MainScene applies them to the display list.

export const FOREGROUND = {
    minDepth: 7,      // foreground band: depth >= minDepth and < maxDepth
    maxDepth: 8,      // above this are effects and UI, never faded
    alpha: 0.35,      // share of its own alpha an occluder keeps while a player is behind it
    fadeS: 0.18,      // seconds to get most of the way there (exponential)
    pad: 1.3          // player circle = radius * pad
};

/** Is an axis-aligned box { x0, y0, x1, y1 } touched by the circle (cx, cy, r)? */
export function boxHitsCircle(b, cx, cy, r) {
    const dx = cx - Math.max(b.x0, Math.min(cx, b.x1)), dy = cy - Math.max(b.y0, Math.min(cy, b.y1));
    return dx * dx + dy * dy < r * r;
}

/** Next alpha of an occluder with resting alpha `base`, now `alpha`, covering a player or not. */
export function fadeStep(alpha, base, covering, dt, cfg = FOREGROUND) {
    const target = covering ? base * cfg.alpha : base;
    const k = 1 - Math.exp(-dt / cfg.fadeS * 2.3);   // ~90 % of the way in fadeS
    const next = alpha + (target - alpha) * k;
    return Math.abs(next - target) < 0.005 ? target : next;
}
