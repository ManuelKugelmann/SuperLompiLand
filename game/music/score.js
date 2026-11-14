// The background score (pure, no Web Audio; spec ch.12 "meditative, changes with area
// and depth"). Every biome plays a slow chord progression in its own key (melody.js
// BIOME_MUSIC) with a sparse, gentle arpeggio on top: calm enough to explore to, never
// a loop you notice. The scheduler in audio.js turns these notes into sound on the
// shared music clock.

import { BIOME_MUSIC, degreeHz } from './melody.js';

export const SCORE = {
    barsPerChord: 2,          // a chord lasts this many bars (slow, breathing harmony)
    padOctave: -2,            // pads sit two octaves under the coin melody ...
    lowRoot: 66,              // ... one octave only where the key is this low (MIDI), so they never sink into a hum
    arpOctave: -1,            // the arpeggio one octave under it
    restChance: 0.45,         // share of arpeggio steps left silent (space, not a stream)
    deepRest: 0.4             // in the deep (depth 1) this much more of it is silent: the score thins out as the light goes (5.0e)
};

/** Chord roots as scale degrees, per mood. Bright biomes rise, dark ones circle. */
const PROGRESSIONS = {
    bright: [0, 5, 3, 4],     // I  vi IV V  (major-ish scales)
    float:  [0, 3, 5, 3],     // I  IV vi IV (lydian, pentatonic: no tension)
    dark:   [0, 5, 3, 6]      // i  VI iv VII (minor scales)
};
const MOOD = { major: 'bright', mixolydian: 'bright', dorian: 'dark', minor: 'dark', minorPenta: 'dark', pentatonic: 'float', lydian: 'float' };

const biomeOf = id => (BIOME_MUSIC[id] ? id : 'reef');
const scaleLen = id => ({ major: 7, pentatonic: 5, minorPenta: 5, dorian: 7, lydian: 7, mixolydian: 7, minor: 7 })[BIOME_MUSIC[biomeOf(id)].scale];

/** The chord of a bar: root degree and three pad frequencies (root, third, fifth in the scale). */
export function chordAt(biomeId, bar) {
    const id = biomeOf(biomeId), mood = MOOD[BIOME_MUSIC[id].scale] || 'float';
    const prog = PROGRESSIONS[mood];
    const root = prog[Math.floor(bar / SCORE.barsPerChord) % prog.length];
    const n = scaleLen(id), base = (BIOME_MUSIC[id].root < SCORE.lowRoot ? SCORE.padOctave + 1 : SCORE.padOctave) * n;
    return { root, mood, hz: [0, 2, 4].map(k => degreeHz(id, base + root + k)) };
}

/**
 * One arpeggio step (8 steps per bar, eighth notes): a frequency or null (rest).
 * Deterministic from bar and step, so every player in a room hears the same tune.
 * depth01 (0 surface .. 1 deep) leaves more steps silent.
 */
export function arpAt(biomeId, bar, step, depth01 = 0) {
    const id = biomeOf(biomeId), { root } = chordAt(id, bar);
    const h = Math.sin((bar * 8 + step) * 12.9898 + root * 78.233) * 43758.5453;
    if (h - Math.floor(h) < SCORE.restChance + SCORE.deepRest * Math.max(0, Math.min(1, depth01)) || step % 2 === 1 && (h * 7 - Math.floor(h * 7)) < 0.5) return null;
    const shape = [0, 2, 4, 7, 4, 2, 4, 9];                  // up and back down, a wave
    return degreeHz(id, SCORE.arpOctave * scaleLen(id) + root + shape[step % 8]);
}
