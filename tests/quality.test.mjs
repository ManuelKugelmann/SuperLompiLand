import test from 'node:test';
import assert from 'node:assert/strict';
import { QUALITY, startTier, scaled, createAutotune } from '../game/quality.js';

const run = (tune, fps, seconds) => { let changed = null; for (let t = 0; t < seconds; t += 1 / fps) changed = tune.step(1000 / fps) || changed; return changed; };

test('every tier names every share, and each is no more expensive than the one above', () => {
    const keys = Object.keys(QUALITY.high);
    for (const t of QUALITY.tiers) assert.deepEqual(Object.keys(QUALITY[t]), keys, t);
    const [low, medium, high] = QUALITY.tiers.map(t => QUALITY[t]);
    for (const k of ['caustics', 'particles', 'shoals']) assert.ok(low[k] <= medium[k] && medium[k] <= high[k], k);
    for (const k of ['simEvery', 'midEvery']) assert.ok(low[k] >= medium[k] && medium[k] >= high[k], k);
});

test('it starts with the saved tier, else medium on a phone and high on a desktop', () => {
    assert.equal(startTier('low', false), 'low');
    assert.equal(startTier(null, true), 'medium');
    assert.equal(startTier('nonsense', false), 'high');
});

test('a share of a burst: the whole part, and the rest as a chance', () => {
    assert.equal(scaled(10, 0.6, 0.99), 6);
    assert.equal(scaled(1, 0.35, 0.2), 1);
    assert.equal(scaled(1, 0.35, 0.5), 0);
    assert.equal(scaled(4, 1, 0.5), 4);
    let sum = 0;
    for (let i = 0; i < 1000; i++) sum += scaled(3, 0.35, (i * 0.618) % 1);
    assert.ok(Math.abs(sum / 1000 - 1.05) < 0.05, 'on average exactly the share');
});

test('under 30 frames a second for three seconds: a tier down; a good frame rate: nothing', () => {
    const t = createAutotune('high');
    assert.equal(run(t, 60, 20), null, 'at 60 on the highest tier nothing changes');
    assert.equal(run(t, 24, 1.5), null, 'a short dip is not enough');
    assert.equal(run(t, 60, 3), null);
    assert.equal(run(t, 24, 6), 'medium');
    assert.equal(t.tier, 'medium');
    assert.ok(Math.abs(t.fps - 24) < 1);
    assert.equal(run(t, 24, 2), null, 'right after a change nothing is judged');
    assert.equal(run(t, 24, 8), 'low');
    assert.equal(run(t, 12, 30), null, 'there is nothing under the lowest tier');
});

test('over 50 for ten seconds: a tier up; and a tier that had to be left again at once is not tried again', () => {
    const t = createAutotune('low');
    assert.equal(run(t, 58, 8), null, 'not yet');
    assert.equal(run(t, 58, 8), 'medium');
    assert.equal(run(t, 40, 30), null, 'between 30 and 50: it stays');
    assert.equal(run(t, 58, 16), 'high');
    assert.equal(run(t, 22, 9), 'medium', 'too much: down again');
    assert.equal(run(t, 58, 120), null, 'and high is not tried again in this run');
    assert.equal(t.tier, 'medium');
});

test('a pause is not a slow frame', () => {
    const t = createAutotune('high');
    run(t, 60, 5);
    for (let i = 0; i < 40; i++) assert.equal(t.step(5000), null);
    assert.equal(t.tier, 'high');
    assert.ok(t.fps > 55);
});
