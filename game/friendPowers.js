// Friends help (pure, no Phaser; spec 5.0r): every friend in the school gives Lompi a small power,
// so rescuing pays off at once and the school feels like a team. One switch turns it all off.

export const FRIEND_POWERS = {
    enabled: true,
    seahorse: { kind: 'magnet', reach: 260, pull: 9 },      // coins this close drift to Lompi (px, px/step at the edge ... faster close)
    turtle: { kind: 'shell', hits: 1 },                       // one hit is taken by Schildi's shell, again after every nest
    jellyfish: { kind: 'light' },                             // glows in the dark (shown, no rule yet)
    shark: { kind: 'dash' },                                  // (later)
    flyingfish: { kind: 'leap' },                             // (later)
    firefish: { kind: 'warm' }                                // (later)
};

/** What a friend's power is called, said once when it joins. */
export const POWER_WORDS = {
    seahorse: { de: 'Hüpfi zieht Münzen zu dir!', en: 'Hüpfi pulls coins to you!' },
    turtle: { de: 'Schildis Panzer schützt dich einmal pro Nest!', en: "Schildi's shell shields you once per nest!" }
};

/** The powers the school gives: { magnet: {...} | null, shell: {...} | null, ... } from the friends' ids. */
export function powersOf(ids, cfg = FRIEND_POWERS) {
    const out = { magnet: null, shell: null, light: null };
    if (!cfg.enabled) return out;
    for (const id of ids) {
        const p = cfg[id];
        if (p && p.kind in out) out[p.kind] = p;
    }
    return out;
}

/**
 * One step of a coin pulled by the magnet: the coin at (cx, cy), Lompi at (fx, fy). Returns the
 * new { x, y }, or null when the coin is out of reach. Slow at the edge, quicker close, never past.
 */
export function magnetStep(cx, cy, fx, fy, magnet) {
    const dx = fx - cx, dy = fy - cy, d = Math.hypot(dx, dy);
    if (!magnet || d > magnet.reach || d < 1e-6) return null;
    const speed = magnet.pull * (1.5 - d / magnet.reach), k = Math.min(1, speed / d);
    return { x: cx + dx * k, y: cy + dy * k };
}
