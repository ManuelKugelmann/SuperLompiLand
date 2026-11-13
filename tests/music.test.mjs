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
