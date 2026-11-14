import test from 'node:test';
import assert from 'node:assert/strict';
import { MICRO, MICRO_KINDS, microTable, microAt, microKey } from '../game/level/microScatter.js';
import { BIOMES } from '../game/level/biomes.js';

const stream = seed => { let a = seed >>> 0; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; };

test('every biome has its own ground cover, made of known kinds', () => {
    for (const b of BIOMES) {
        const t = microTable(b.id);
        assert.ok(Object.keys(t).length > 0, b.id);
        for (const k of Object.keys(t)) assert.ok(MICRO_KINDS.includes(k), `${b.id}: ${k}`);
    }
    assert.deepEqual(microTable('nowhere'), { pebbles: 1 });
});

test('most flat floor gets something, steep rock stays bare', () => {
    const r = stream(5);
    let got = 0;
    for (let i = 0; i < 400; i++) if (microAt('reef', 0.1, r)) got++;
    assert.ok(got > 400 * (MICRO.rate - 0.1) && got < 400 * (MICRO.rate + 0.1));
    for (let i = 0; i < 50; i++) assert.equal(microAt('reef', 0.9, r), null);
});

test('a patch is one of the biome\'s kinds, within its sizes, and the weights show', () => {
    const r = stream(11), count = {};
    for (let i = 0; i < 2000; i++) {
        const m = microAt('beach', 0, r);
        if (!m) continue;
        assert.ok(m.kind in microTable('beach'));
        assert.ok(m.variant >= 0 && m.variant < MICRO.variants && Number.isInteger(m.variant));
        assert.ok(m.width >= MICRO.width[0] && m.width <= MICRO.width[1]);
        count[m.kind] = (count[m.kind] || 0) + 1;
    }
    assert.ok(count.shells > count.pebbles && count.pebbles > count.tufts, 'the beach is mostly shells');
    assert.equal(microKey('shells', 2), 'micro_shells_2');
});

test('the same random stream gives the same ground', () => {
    const a = stream(3), b = stream(3);
    for (let i = 0; i < 50; i++) assert.deepEqual(microAt('kelp', 0.2, a), microAt('kelp', 0.2, b));
});
