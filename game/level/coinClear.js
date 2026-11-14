// Coins never lead into harm (pure, no Phaser): a coin trail is an invitation, so no coin lies
// within reach of a hazard, nor along the chain or line a hazard hangs from.

export const COIN_CLEAR = {
    radius: 180,     // px from a hazard's middle that stay free of coins (on top of nothing: the hazard's own size is inside this)
    chainHalf: 90    // px to either side of the chain above a hanging hazard
};

/**
 * Is the coin at (cx, cy) too close to the hazard at (hx, hy)? `chain` = the hazard hangs on a
 * chain that runs straight up from it (to the surface or to rock above).
 */
export function coinTooNear(cx, cy, hx, hy, chain = false, cfg = COIN_CLEAR) {
    if ((cx - hx) ** 2 + (cy - hy) ** 2 < cfg.radius ** 2) return true;
    return chain && cy < hy && Math.abs(cx - hx) < cfg.chainHalf;
}
