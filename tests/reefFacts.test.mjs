import test from 'node:test';
import assert from 'node:assert/strict';
import { ENTRIES, entryFor } from '../game/reefbook.js';
import { MORE_FACTS, factsOf } from '../game/reefFacts.js';

test('more facts belong to book entries and come in both languages', () => {
    for (const [id, list] of Object.entries(MORE_FACTS)) {
        assert.ok(entryFor(id), `no entry ${id}`);
        for (const fact of list) assert.ok(fact.de && fact.en, id);
    }
});

test('every creature has several facts, the first is the entry fact', () => {
    for (const e of ENTRIES.filter(q => q.kind === 'creature')) {
        const facts = factsOf(e);
        assert.ok(facts.length >= 3, e.id);
        assert.equal(facts[0], e.fact);
        assert.equal(new Set(facts.map(q => q.en)).size, facts.length, `${e.id} repeats a fact`);
    }
});

test('an entry without more facts shows its one', () => {
    assert.equal(factsOf(entryFor('reef')).length, 1);
});
