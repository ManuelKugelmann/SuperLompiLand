// Coins buy something (pure, no Phaser; spec 5.0r loop 2, first step): swim trails for Lompi. A trail
// is bought once with coins and then owned; one is worn at a time. One switch turns the shop off.

export const TRAILS = {
    enabled: true,
    everyMs: 70,          // a trail leaves a particle this often while Lompi swims ...
    minSpeed: 2.2,        // ... faster than this (px per step)
    list: [
        { id: 'none', price: 0, preset: null, name: { de: 'Keine Spur', en: 'No trail' } },
        { id: 'bubble', price: 15, preset: 'bubble', name: { de: 'Blubberspur', en: 'Bubble trail' } },
        { id: 'glint', price: 40, preset: 'glint', name: { de: 'Glitzerspur', en: 'Sparkle trail' } },
        { id: 'plankton', price: 80, preset: 'plankton', name: { de: 'Leuchtspur', en: 'Glow trail' } }
    ]
};

export const trailOf = (id, cfg = TRAILS) => cfg.list.find(t => t.id === id) || cfg.list[0];

/**
 * Choose a trail: worn at once if owned, bought and worn if the coins are enough.
 * Returns { ok, coins, owned, worn, missing } (missing = coins short when ok is false).
 */
export function chooseTrail(id, coins, owned, cfg = TRAILS) {
    const t = trailOf(id, cfg);
    if (t.price === 0 || owned.includes(t.id)) return { ok: true, coins, owned, worn: t.id, missing: 0 };
    if (coins < t.price) return { ok: false, coins, owned, worn: null, missing: t.price - coins };
    return { ok: true, coins: coins - t.price, owned: [...owned, t.id], worn: t.id, missing: 0 };
}

/** The shop line of a trail: its name with "✓" when worn, "(gekauft)" when owned, else its price. */
export function trailLabel(t, owned, worn, lang = 'de') {
    const name = t.name[lang] || t.name.en;
    if (t.id === worn) return `${name} ✓`;
    if (t.price === 0 || owned.includes(t.id)) return name;
    return lang === 'de' ? `${name} · ${t.price} Münzen` : `${name} · ${t.price} coins`;
}
