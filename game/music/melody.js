// Coin streaks that play tunes (pure, no Phaser, no Web Audio).
// Coins picked up within a short window build a streak; each coin is the next note
// of a short original melody in the current biome's key. Finishing the melody
// without a break completes the streak (a flourish). Missing the window simply
// starts a new phrase: no penalty.

export const STREAK = {
    window: 1.1,        // s between two coins that still count as "in a row"
    stepEvery: 4        // the visible counter goes up (x2, x3, ...) every this many coins
};

/** Scales as semitone offsets; degrees index into them (and wrap into higher octaves). */
const SCALES = {
    major: [0, 2, 4, 5, 7, 9, 11],
    pentatonic: [0, 2, 4, 7, 9],
    minorPenta: [0, 3, 5, 7, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    minor: [0, 2, 3, 5, 7, 8, 10]
};

/**
 * Per biome: root note (MIDI), scale and a few original motifs (scale degrees).
 * Short phrases, written for this game; no quotes of existing songs.
 */
export const BIOME_MUSIC = {
    beach: { root: 72, scale: 'major', motifs: [[0, 2, 4, 2, 4, 7], [4, 3, 2, 4, 7, 9, 7]] },
    reef: { root: 72, scale: 'pentatonic', motifs: [[0, 1, 2, 4, 3, 2, 5], [2, 4, 5, 4, 2, 1, 0, 5]] },
    mangrove: { root: 67, scale: 'major', motifs: [[0, 4, 2, 5, 4, 7], [7, 5, 4, 2, 4, 5, 7]] },
    kelp: { root: 62, scale: 'dorian', motifs: [[0, 2, 4, 3, 2, 6, 7], [4, 6, 7, 6, 4, 3, 2, 0]] },
    blue: { root: 65, scale: 'lydian', motifs: [[0, 3, 4, 6, 7, 4, 9], [7, 6, 4, 3, 4, 7, 11]] },
    wreck: { root: 69, scale: 'minorPenta', motifs: [[0, 2, 1, 3, 2, 4, 5], [5, 4, 2, 3, 1, 0, 2]] },
    harbour: { root: 64, scale: 'mixolydian', motifs: [[0, 2, 4, 6, 4, 2, 7], [4, 4, 6, 7, 6, 4, 2]] },
    trench: { root: 62, scale: 'minor', motifs: [[0, 4, 3, 2, 4, 7], [7, 5, 4, 3, 2, 0, 4]] }
};
const FALLBACK = 'reef';

export const midiToHz = m => 440 * Math.pow(2, (m - 69) / 12);

/** Frequency of a scale degree (wrapping into higher octaves) in a biome's key. */
export function degreeHz(biomeId, degree) {
    const b = BIOME_MUSIC[biomeId] || BIOME_MUSIC[FALLBACK];
    const scale = SCALES[b.scale];
    const oct = Math.floor(degree / scale.length);
    const step = ((degree % scale.length) + scale.length) % scale.length;
    return midiToHz(b.root + oct * 12 + scale[step]);
}

/**
 * A streak tracker. add() is called per collected coin and returns what to play
 * and show. Deterministic: the motif is chosen by a counter, not by chance.
 */
export function createStreak(opts = {}) {
    const window = opts.window ?? STREAK.window;
    const stepEvery = opts.stepEvery ?? STREAK.stepEvery;
    let last = -Infinity, count = 0, note = 0, motifPick = 0, biome = FALLBACK, motif = null;

    return {
        get count() { return count; },

        /** A coin was collected at `time` (seconds) in biome `biomeId`. */
        add(time, biomeId) {
            const fresh = time - last > window;
            if (fresh || !motif || biomeId !== biome) {
                biome = BIOME_MUSIC[biomeId] ? biomeId : FALLBACK;
                const set = BIOME_MUSIC[biome].motifs;
                motif = set[motifPick++ % set.length];
                note = 0;
                if (fresh) count = 0;
            }
            last = time;
            count += 1;
            const degree = motif[note];
            const completed = note === motif.length - 1;
            note = completed ? 0 : note + 1;
            if (completed) motif = null;          // the next coin starts a new phrase
            const multiplier = 1 + Math.floor((count - 1) / stepEvery);
            return {
                count,
                multiplier,
                stepped: count > 1 && (count - 1) % stepEvery === 0,   // the counter just went up
                hz: degreeHz(biome, degree),
                harmonyHz: degreeHz(biome, degree + 2),               // a third above, quieter
                completed,
                // On completion a short rising flourish over the biome's chord.
                flourish: completed ? [0, 2, 4, 7].map(d => degreeHz(biome, d + 7)) : null
            };
        },

        /** Forget the streak (e.g. on respawn). */
        reset() { last = -Infinity; count = 0; note = 0; motif = null; }
    };
}
