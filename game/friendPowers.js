// Friends help (pure, no Phaser; spec 5.0r): every friend in the school gives Lompi a small power,
// so rescuing pays off at once and the school feels like a team. One switch turns it all off.
// Every power is what the real animal can do (user 2026-11-15: "animal specialties oriented on real world").

export const FRIEND_POWERS = {
    enabled: true,
    // Seahorses snap their food in with a sudden suck of the snout: Hüpfi pulls coins in from much further away.
    seahorse: { kind: 'magnet', reach: 320, pull: 10, gain: 0.9 },
    // A sea turtle's hard shell: one hit is taken by Schildi's shell, again after every nest.
    turtle: { kind: 'shell', hits: 1 },
    // Many jellyfish make their own light (bioluminescence): with Quallina the deep is less dark,
    // `lift` = share of the missing light given back (game/fx/WaterLight.js).
    jellyfish: { kind: 'light', lift: 0.4 },
    // A lionfish's venomous spines: predators leave it alone. With the Feuerfisch the barracuda
    // gives up its chase sooner (`chase` x its chase time, game/level/HunterLayer.js).
    firefish: { kind: 'spines', chase: 0.5 },
    // Sharks feel the faint electric field of animals hidden in the sand: with Sharky the hidden
    // pearls' clams open and glow from `reach` x further away (game/level/SecretLayer.js).
    shark: { kind: 'sense', reach: 2.2 },
    // Flying fish leap out of the water and glide far over it (later: a power that needs tuning on a device).
    flyingfish: { kind: 'glide' }
};

/**
 * Coins are easy to collect for everyone (user 2026-11-14): a coin this close (px) is caught and flies
 * to Lompi, starting at `pull` px per step and `gain` faster every step, so it always arrives.
 */
export const COIN_PULL = { kind: 'magnet', reach: 150, pull: 10, gain: 0.9 };

/** What a friend's power is called, said once when it joins. */
export const POWER_WORDS = {
    seahorse: { de: 'Hüpfi zieht Münzen zu dir!', en: 'Hüpfi pulls coins to you!' },
    turtle: { de: 'Schildis Panzer schützt dich einmal pro Nest!', en: "Schildi's shell shields you once per nest!" },
    jellyfish: { de: 'Quallina leuchtet dir in der Tiefe!', en: 'Quallina lights up the deep for you!' },
    firefish: { de: 'Vor Feuerfischs Stacheln haben Jäger Respekt!', en: "Hunters keep clear of Feuerfisch's spines!" },
    shark: { de: 'Sharky spürt versteckte Perlen!', en: 'Sharky senses hidden pearls!' }
};

/** The powers the school gives: { magnet, shell, light, spines, sense: {...} | null } from the friends' ids; without a magnet friend the magnet is everyone's COIN_PULL. */
export function powersOf(ids, cfg = FRIEND_POWERS) {
    const out = { magnet: COIN_PULL, shell: null, light: null, spines: null, sense: null };
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
 * no coin hovers at the edge of the reach or falls behind a fast swimmer. `steps` = 60ths of a second
 * since the last call (age then grows by the same), so a slow phone pulls coins in as fast.
 */
export function magnetStep(cx, cy, fx, fy, magnet, age = 0, steps = 1) {
    const dx = fx - cx, dy = fy - cy, d = Math.hypot(dx, dy);
    if (!magnet || d < 1e-6 || (age === 0 && d > magnet.reach)) return null;
    const speed = (magnet.pull + age * magnet.gain) * steps, k = Math.min(1, speed / d);      // steps: 60ths of a second since the last call
    return { x: cx + dx * k, y: cy + dy * k };
}

/** How bright the water is (depthMeters.js depthLight, 0..1) with the school's `light` power. */
export function litDepth(bright, light) {
    return light ? bright + (1 - bright) * light.lift : bright;
}
