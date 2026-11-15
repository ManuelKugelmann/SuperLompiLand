// The opening story, played inside the real level at the start (user 2026-11-14: "Story integrated in
// level start. Use level as environment. Not simplified."). Pure, no Phaser: which beat comes when and
// what it says; game/OpeningLayer.js plays it in the lagoon with the real friends, sky and water.

export const OPENING = {
    seenKey: 'sll_seen_intro',     // shown once on a fresh save; the title menu can play it again
    friends: 3,                    // how many friends swim with Lompi before the eruption
    beats: [
        { at: 0, id: 'calm', caption: { de: 'Ein ruhiger Morgen im Riff', en: 'A calm morning on the reef' } },
        { at: 1800, id: 'rumble', caption: { de: 'Was grollt da?', en: "What's that rumble?" } },
        { at: 3400, id: 'erupt', caption: { de: 'Der Vulkan bricht aus!', en: 'The volcano erupts!' } },
        { at: 5000, id: 'scatter', caption: { de: 'Alle Freunde schwimmen weg!', en: 'All the friends swim away!' } },
        { at: 6800, id: 'brave', caption: { de: '{name} hat keine Angst.', en: "{name} isn't scared." } },
        { at: 8400, id: 'goal', caption: { de: 'Finde deine Freunde!', en: 'Find your friends!' } },
        { at: 10400, id: 'end', caption: null }
    ]
};

/** The caption of a beat in a language, with the hero's name filled in (null for none). */
export function captionOf(beat, lang, name) {
    if (!beat.caption) return null;
    return (beat.caption[lang] || beat.caption.en).replace('{name}', name);
}

/** Has this save seen the opening? (storage blocked counts as seen: never trap a child in it) */
export function openingSeen(storage, cfg = OPENING) {
    try { return storage.getItem(cfg.seenKey) === '1'; } catch { return true; }
}
