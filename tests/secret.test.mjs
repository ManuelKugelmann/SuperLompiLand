import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSecret, makeSecret, MAX_SECRET } from '../net/secret.js';

test('spelling variants of a family word open the same session', () => {
    const same = ['Familie Müller!', 'familie muller', 'FAMILIE-MÜLLER', ' familie  müller '].map(normalizeSecret);
    assert.deepEqual(new Set(same), new Set(['familiemuller']));
});

test('the word is capped and holds only letters and digits', () => {
    assert.equal(normalizeSecret('a'.repeat(50)).length, MAX_SECRET);
    assert.match(normalizeSecret('Ö☃ä_ß-9'), /^[a-z0-9]*$/);
    assert.equal(normalizeSecret(null), '');
});

test('random words are pronounceable and different', () => {
    const seen = new Set();
    for (let i = 0; i < 50; i++) {
        const w = makeSecret();
        assert.match(w, /^([bdfgklmnprstvz][aeiou]){4}$/);
        seen.add(w);
    }
    assert.ok(seen.size > 40);
    assert.equal(makeSecret(() => 0), 'babababa');
});
