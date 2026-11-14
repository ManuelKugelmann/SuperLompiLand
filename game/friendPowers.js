// Friends help (pure, no Phaser; spec 5.0r): every friend in the school gives Lompi a small power,
// so rescuing pays off at once and the school feels like a team. One switch turns it all off.

export const FRIEND_POWERS = {
    enabled: true,
    seahorse: { kind: 'magnet', reach: 320, pull: 10, gain: 0.9 },      // Hüpfi: coins from much further away fly to Lompi
    turtle: { kind: 'shell', hits: 1 },                       // one hit is taken by Schildi's shell, again after every nest
    jellyfish: { kind: 'light' },                             // glows in the dark (shown, no rule yet)
    shark: { kind: 'dash' },                                  // (later)
    flyingfish: { kind: 'leap' },                             // (later)
    firefish: { kind: 'warm' }                                // (later)
};

/**
 * Coins are easy to collect for everyone (user 2026-11-14): a coin this close (px) is caught and flies
 * to Lompi, starting at `pull` px per step and `gain` faster every step, so it always arrives.
 */
export const COIN_PULL = { kind: 'magnet', reach: 150, pull: 10, gain: 0.9 };

/** What a friend's power is called, said once when it joins. */
export const POWER_WORDS = {
    seahorse: { de: 'Hüpfi zieht Münzen zu dir!', en: 'Hüpfi pulls coins to you!' },
    turtle: { de: 'Schildis Panzer schützt dich einmal pro Nest!', en: "Schildi's shell shields you once per nest!" }
};

/** The powers the school gives: { magnet, shell: {...} | null, ... } from the friends' ids; without a magnet friend the magnet is everyone's COIN_PULL. */
export function powersOf(ids, cfg = FRIEND_POWERS) {
    const out = { magnet: COIN_PULL, shell: null, light: null };
    if (!cfg.enabled) return out;
    for (const id of ids) {
        const p = cfg[id];
        if (p && p.kind in out) out[p.kind] = p;
    }
    return out;
}

/**
 * One step of a coin pulled by the magnet: the coin at (cx, cy), Lompi at (fx, fy), `age` = steps
 * it has been flying already (0 = not caught yet). Returns the new { x, y }, or null when a coin
 * not yet caught is out of reach. Once caught it keeps coming, faster every step, never past him:
 * no coin hovers at the edge of the reach or falls behind a fast swimmer.
 */
export function magnetStep(cx, cy, fx, fy, magnet, age = 0) {
    const dx = fx - cx, dy = fy - cy, d = Math.hypot(dx, dy);
    if (!magnet || d < 1e-6 || (age === 0 && d > magnet.reach)) return null;
    const speed = magnet.pull + age * magnet.gain, k = Math.min(1, speed / d);
    return { x: cx + dx * k, y: cy + dy * k };
}
