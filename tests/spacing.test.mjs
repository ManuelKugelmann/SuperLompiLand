import test from 'node:test';
import assert from 'node:assert/strict';
import { createSpacing } from '../game/level/spacing.js';

const KEYS = ['coral_1', 'coral_2', 'coral_3'];

test('a key with a twin nearby is not offered; far away it is', () => {
    const s = createSpacing(600);
    assert.deepEqual(s.options(KEYS, 0, 0), KEYS);
    s.add('coral_1', 0, 0);
    assert.deepEqual(s.options(KEYS, 300, 100), ['coral_2', 'coral_3']);
    assert.deepEqual(s.options(KEYS, 700, 0), KEYS);
    s.add('coral_2', 300, 0); s.add('coral_3', 500, 0);
    assert.deepEqual(s.options(KEYS, 250, 0), [], 'nothing fits: place none');
});

test('placing along a seabed never puts the same key within the distance', () => {
    const s = createSpacing(600), row = [];
    let seed = 5;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let x = 0; x < 20000; x += 80 + rnd() * 240) {
        const opts = s.options(KEYS, x, 1000);
        if (!opts.length) continue;
        const key = opts[Math.floor(rnd() * opts.length)];
        s.add(key, x, 1000); row.push({ key, x });
    }
    assert.ok(row.length > 60, `placed ${row.length}`);
    for (let i = 0; i < row.length; i++) {
        for (let j = i + 1; j < row.length && row[j].x - row[i].x < 600; j++) assert.notEqual(row[i].key, row[j].key, `twins at ${row[i].x} and ${row[j].x}`);
    }
});

test('only the latest placements are remembered', () => {
    const s = createSpacing(600, 3);
    s.add('coral_1', 0, 0); s.add('coral_2', 5000, 0); s.add('coral_3', 6000, 0); s.add('coral_2', 7000, 0);
    assert.deepEqual(s.options(KEYS, 0, 0), KEYS, 'the first one has been forgotten');
});
