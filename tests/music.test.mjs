import test from 'node:test';
import assert from 'node:assert/strict';
import { createClock } from '../game/music/clock.js';
import { createStreak, degreeHz, midiToHz, BIOME_MUSIC, STREAK } from '../game/music/melody.js';

const close = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

test('clock counts beats and bars at the set tempo', () => {
    const c = createClock({ bpm: 120, beatsPerBar: 4 });
    const p = c.phase(2.25);                    // 120 bpm = 2 beats/s -> 4.5 beats
    assert.ok(close(p.beat, 4.5));
    assert.ok(close(p.beatPhase, 0.5));
    assert.equal(p.bar, 1);
    assert.equal(p.beatInBar, 0);
    assert.ok(close(p.barPhase, 0.125));
});

test('tempo changes wait for the next bar line', () => {
    const c = createClock({ bpm: 120, beatsPerBar: 4 });
    c.setTempo(60, 0.5);                        // beat 1 -> next bar at beat 4 = 2.0 s
    assert.ok(close(c.phase(1.5).beat, 3));     // still 120 bpm before the bar line
    assert.ok(close(c.phase(2.0).beat, 4));
    assert.ok(close(c.phase(3.0).beat, 5));     // 60 bpm afterwards: 1 beat per second
    assert.equal(c.bpm, 60);
});

test('tempo is clamped and a same-tempo request changes nothing', () => {
    const c = createClock({ bpm: 1000 });
    assert.equal(c.bpm, 200);
    c.setTempo(200, 0.1);
    assert.ok(close(c.phase(10).beat, 10 * 200 / 60));
});

test('untilGrid snaps to the next 1/16 note and never waits longer than one step', () => {
    const c = createClock({ bpm: 120 });        // 1/16 note = 0.125 s
    assert.ok(close(c.untilGrid(0.3, 4), 0.075));
    assert.ok(close(c.untilGrid(0.25, 4), 0));
    for (let t = 0; t < 3; t += 0.037) assert.ok(c.untilGrid(t, 4) <= 0.125 + 1e-9);
});

test('pulse peaks on the beat and decays within it', () => {
    const c = createClock({ bpm: 60 });
    assert.ok(close(c.pulse(3.0), 1));
    assert.ok(c.pulse(3.5) < c.pulse(3.1));
    assert.ok(c.barPulse(4.0) > c.barPulse(5.0));   // downbeat at 4 s (bar 1)
});

test('degrees map into the biome key and wrap into higher octaves', () => {
    assert.ok(close(midiToHz(69), 440));
    const reef = BIOME_MUSIC.reef;
    assert.ok(close(degreeHz('reef', 0), midiToHz(reef.root)));
    assert.ok(close(degreeHz('reef', 5), 2 * degreeHz('reef', 0)));   // pentatonic: 5 steps = octave
    assert.ok(close(degreeHz('nowhere', 0), degreeHz('reef', 0)));    // unknown biome falls back
});

test('a streak plays its motif note by note and completes with a flourish', () => {
    const s = createStreak({ window: 1, stepEvery: 4 });
    const motif = BIOME_MUSIC.beach.motifs[0];
    let r;
    for (let i = 0; i < motif.length; i++) {
        r = s.add(i * 0.5, 'beach');
        assert.ok(close(r.hz, degreeHz('beach', motif[i])));
        assert.equal(r.count, i + 1);
    }
    assert.equal(r.completed, true);
    assert.equal(r.flourish.length, 4);
    assert.equal(r.multiplier, 1 + Math.floor((motif.length - 1) / 4));
    const next = s.add(motif.length * 0.5, 'beach');                 // a new phrase, streak goes on
    assert.equal(next.count, motif.length + 1);
    assert.ok(close(next.hz, degreeHz('beach', BIOME_MUSIC.beach.motifs[1][0])));
});

test('a gap longer than the window starts over without penalty', () => {
    const s = createStreak({ window: 1 });
    s.add(0, 'reef'); s.add(0.5, 'reef');
    const r = s.add(5, 'reef');
    assert.equal(r.count, 1);
    assert.equal(r.multiplier, 1);
});

test('the counter steps up every stepEvery coins', () => {
    const s = createStreak({ window: 10, stepEvery: 3 });
    const steps = [];
    for (let i = 0; i < 7; i++) steps.push(s.add(i * 0.1, 'kelp'));
    assert.deepEqual(steps.map(r => r.multiplier), [1, 1, 1, 2, 2, 2, 3]);
    assert.deepEqual(steps.map(r => r.stepped), [false, false, false, true, false, false, true]);
});

test('every biome has motifs with valid degrees', () => {
    assert.ok(STREAK.window > 0);
    for (const [id, b] of Object.entries(BIOME_MUSIC)) {
        assert.ok(b.motifs.length >= 2, id);
        for (const m of b.motifs) for (const d of m) assert.ok(Number.isFinite(degreeHz(id, d)), id);
    }
});

test('chain notes climb the scale under the coins, cap at the top, sparkle in flow', async () => {
    const { chainNote, chainChord, degreeHz, CHAIN_MUSIC } = await import('../game/music/melody.js');
    const notes = [1, 2, 3, 4, 5].map(count => chainNote('reef', { count, flow: false }).hz);
    for (let i = 1; i < notes.length; i++) assert.ok(notes[i] > notes[i - 1], 'rising');
    assert.ok(notes[0] < degreeHz('reef', 0), 'an octave under the coin melody');
    const top = chainNote('reef', { count: CHAIN_MUSIC.top + 1, flow: false }).hz;
    assert.equal(chainNote('reef', { count: 40, flow: false }).hz, top, 'long chains hold the top note');
    const f = chainNote('kelp', { count: 6, flow: true });
    assert.equal(f.sparkleHz, f.hz * 2);
    assert.equal(chainNote('nowhere', { count: 1 }).hz, chainNote('reef', { count: 1 }).hz, 'unknown biome falls back');
    assert.equal(chainChord('beach').length, 4);
});

test('score: every biome has chords in its own key, slow changes, and a sparse arpeggio', async () => {
    const { chordAt, arpAt, SCORE } = await import('../game/music/score.js');
    const { BIOME_MUSIC, degreeHz } = await import('../game/music/melody.js');
    for (const id of Object.keys(BIOME_MUSIC)) {
        const c0 = chordAt(id, 0);
        assert.equal(c0.hz.length, 3);
        assert.ok(c0.hz[0] < c0.hz[1] && c0.hz[1] < c0.hz[2], `${id} chord rises`);
        assert.ok(c0.hz[2] < degreeHz(id, 0), `${id} pads sit under the coin melody`);
        assert.deepEqual(chordAt(id, SCORE.barsPerChord - 1).hz, c0.hz, 'a chord lasts barsPerChord bars');
        let notes = 0, steps = 0;
        for (let bar = 0; bar < 16; bar++) for (let s = 0; s < 8; s++) { steps++; if (arpAt(id, bar, s)) notes++; }
        assert.ok(notes > steps * 0.15 && notes < steps * 0.6, `${id}: ${notes}/${steps} arpeggio notes`);
        assert.equal(arpAt(id, 5, 3), arpAt(id, 5, 3), 'deterministic');
    }
    assert.deepEqual(chordAt('nowhere', 0), chordAt('reef', 0), 'unknown biome falls back');
});

test('score: the arpeggio thins out in the deep, never on the surface', async () => {
    const { arpAt } = await import('../game/music/score.js');
    const count = depth => { let n = 0; for (let bar = 0; bar < 32; bar++) for (let s = 0; s < 8; s++) if (arpAt('trench', bar, s, depth)) n++; return n; };
    const top = count(0), deep = count(1);
    assert.ok(deep < top * 0.5, `deep ${deep} vs surface ${top}`);
    assert.ok(deep > 0, 'a few notes remain in the dark');
    assert.equal(count(0), count(undefined), 'depth defaults to the surface');
});

test('creak: a groan of jittered slips, normalised, silent at both ends', async () => {
    const { creakSamples } = await import('../game/music/creak.js');
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const d = creakSamples(8000, 1.2, rnd);
    assert.equal(d.length, 9600);
    let pk = 0; for (const v of d) pk = Math.max(pk, Math.abs(v));
    assert.ok(Math.abs(pk - 1) < 1e-6);
    assert.equal(d[0], 0);
    let tail = 0; for (let i = d.length - 80; i < d.length; i++) tail = Math.max(tail, Math.abs(d[i]));
    assert.ok(tail < 0.2, `fades out (${tail})`);
});

test('where two biomes blend, the pads cross from one key into the next: gains add up to 1, never a hard switch (spec 5.0h)', async () => {
    const { chordAt, chordMix } = await import('../game/music/score.js');
    const sum = notes => notes.reduce((s, n) => s + n.gain, 0) / 3;
    for (const bar of [0, 2, 7]) {
        assert.deepEqual(chordMix('reef', 'reef', 0.4, bar), chordAt('reef', bar).hz.map(hz => ({ hz, gain: 1 })), 'inside one biome: its chord, full');
        assert.deepEqual(chordMix('reef', 'blue', 0, bar).map(n => n.hz), chordAt('reef', bar).hz, 'at the blend\'s start only the first key');
        const end = chordMix('reef', 'blue', 1, bar);
        assert.deepEqual(end.map(n => n.hz), chordAt('blue', bar).hz, 'at its end only the second');
        let prev = 1;
        for (let t = 0.1; t < 1; t += 0.1) {
            const mix = chordMix('reef', 'blue', t, bar), from = mix.slice(0, 3), to = mix.slice(3);
            assert.equal(mix.length, 6);
            assert.ok(Math.abs(sum(mix) - 1) < 1e-9, 'the two chords together are as loud as one');
            assert.ok(from[0].gain < prev && Math.abs(to[0].gain - t) < 1e-9, 'the first fades as the second comes');
            prev = from[0].gain;
        }
    }
});
