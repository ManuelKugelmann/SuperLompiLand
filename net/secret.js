// The family session word: normalised and generated here (pure, unit-tested).
export const MIN_SECRET = 6;
export const MAX_SECRET = 20;

/** Lower-case letters and digits only, accents folded (ä -> a), so "Müller" == "muller". */
export function normalizeSecret(input) {
    return String(input || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, MAX_SECRET);
}

/** A pronounceable random secret (consonant + vowel pairs), easy to say aloud. */
export function makeSecret(random = Math.random) {
    const C = 'bdfgklmnprstvz', V = 'aeiou';
    let s = '';
    for (let i = 0; i < 4; i++) s += C[Math.floor(random() * C.length)] + V[Math.floor(random() * V.length)];
    return s;
}
