// The secret room name: normalised and rolled here (pure, unit-tested).
// Spec: gamedesign.md ch.13 "Multiplayer: secret named rooms".
export const MIN_JOIN = 3;    // shortest name that can be used at all
export const MIN_SECRET = 8;  // shorter than this gets a soft "too easy to guess" hint
export const MAX_SECRET = 30;

/** Lower-case letters and digits only, accents folded (ä -> a), so "Müller" == "muller". */
export function normalizeSecret(input) {
    return String(input || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, MAX_SECRET);
}

// Kid-friendly sea and nature words for the dice. Short, easy to say and spell.
const WORDS = {
    de: ['koralle', 'schildi', 'mond', 'welle', 'stern', 'muschel', 'perle', 'sonne', 'wal', 'robbe',
        'qualle', 'krabbe', 'insel', 'anker', 'boot', 'algen', 'blase', 'delfin', 'otter', 'pinguin',
        'seestern', 'tang', 'riff', 'strand', 'sand', 'regen', 'wolke', 'blitz', 'feder', 'apfel',
        'kiwi', 'mango', 'zitrone', 'banane', 'kakao', 'honig', 'keks', 'pirat', 'schatz', 'kompass',
        'leuchtturm', 'moewe', 'pelikan', 'flosse', 'kiemen', 'tintenfisch', 'seepferd', 'hummer', 'auster', 'lagune'],
    en: ['coral', 'turtle', 'moon', 'wave', 'star', 'shell', 'pearl', 'sun', 'whale', 'seal',
        'jelly', 'crab', 'island', 'anchor', 'boat', 'kelp', 'bubble', 'dolphin', 'otter', 'penguin',
        'starfish', 'reef', 'beach', 'sand', 'rain', 'cloud', 'thunder', 'feather', 'apple', 'kiwi',
        'mango', 'lemon', 'banana', 'cocoa', 'honey', 'cookie', 'pirate', 'treasure', 'compass', 'lighthouse',
        'gull', 'pelican', 'fin', 'squid', 'seahorse', 'lobster', 'oyster', 'lagoon', 'puffin', 'manatee']
};

/** Three random words, e.g. ['koralle', 'schildi', 'mond'] — joined they are the room name. */
export function rollWords(lang = 'de', random = Math.random) {
    const list = WORDS[lang] || WORDS.en;
    const out = [];
    while (out.length < 3) {
        const w = list[Math.floor(random() * list.length)];
        if (!out.includes(w)) out.push(w);
    }
    return out;
}

/** Kept for callers that want one random name. */
export function makeSecret(random = Math.random, lang = 'de') {
    return rollWords(lang, random).join('');
}
