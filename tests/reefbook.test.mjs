import test from 'node:test';
import assert from 'node:assert/strict';
import { ENTRIES, KINDS, createBook, entryFor } from '../game/reefbook.js';
import { BIOMES } from '../game/level/biomes.js';

test('every entry is complete in both languages', () => {
    const ids = new Set();
    for (const e of ENTRIES) {
        assert.ok(!ids.has(e.id), `duplicate ${e.id}`);
        ids.add(e.id);
        assert.ok(KINDS.includes(e.kind), e.id);
        for (const lang of ['de', 'en']) {
            assert.ok(e.name[lang]?.length > 1, `${e.id} name ${lang}`);
            assert.ok(e.fact[lang]?.length > 10, `${e.id} fact ${lang}`);
        }
    }
});

test('every biome has a place entry', () => {
    for (const b of BIOMES) assert.equal(entryFor(b.id)?.kind, 'place', b.id);
});

test('discover returns the entry once, then nothing; unknown ids are ignored', () => {
    const book = createBook();
    assert.equal(book.discover('friend_turtle').id, 'friend_turtle');
    assert.equal(book.discover('friend_turtle'), null);
    assert.equal(book.discover('dragon'), null);
    assert.deepEqual(book.progress(), { found: 1, total: ENTRIES.length });
});

test('a saved book restores, ignores stale ids, and round-trips', () => {
    const book = createBook(['reef', 'urchin', 'removed_species', 'reef']);
    assert.equal(book.progress().found, 2);
    assert.equal(book.has('urchin'), true);
    const again = createBook(JSON.parse(JSON.stringify(book)));
    assert.deepEqual(again.toJSON().sort(), ['reef', 'urchin']);
    assert.equal(createBook('garbage').progress().found, 0);
});

test('entries by kind carry their found flag', () => {
    const book = createBook(['hazard_net']);
    const left = book.entries('leftover');
    assert.ok(left.length >= 3);
    assert.equal(left.find(e => e.id === 'hazard_net').found, true);
    assert.equal(left.find(e => e.id === 'mine').found, false);
    assert.equal(book.entries().length, ENTRIES.length);
});
