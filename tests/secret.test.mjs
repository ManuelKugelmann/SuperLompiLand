import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSecret, rollWords, makeSecret, MAX_SECRET, MIN_SECRET } from '../net/secret.js';

test('spelling variants of a room name open the same room', () => {
    const same = ['Familie Müller!', 'familie muller', 'FAMILIE-MÜLLER', ' familie  müller '].map(normalizeSecret);
    assert.deepEqual(new Set(same), new Set(['familiemuller']));
});

test('the name is capped and holds only letters and digits', () => {
    assert.equal(normalizeSecret('a'.repeat(80)).length, MAX_SECRET);
    assert.match(normalizeSecret('Ö☃ä_ß-9'), /^[a-z0-9]*$/);
    assert.equal(normalizeSecret(null), '');
});

test('the dice rolls three different kid-friendly words, long enough to be hard to guess', () => {
    for (const lang of ['de', 'en']) {
        const seen = new Set();
        for (let i = 0; i < 200; i++) {
            const w = rollWords(lang);
            assert.equal(w.length, 3);
            assert.equal(new Set(w).size, 3, 'no word twice');
            for (const x of w) assert.match(x, /^[a-z]+$/, 'already normalised');
            const name = normalizeSecret(w.join(' '));
            assert.ok(name.length >= MIN_SECRET, `${name} is long enough`);
            assert.ok(name.length <= MAX_SECRET, `${name} fits`);
            seen.add(name);
        }
        assert.ok(seen.size > 190, `${lang}: rolls vary`);
    }
});

test('makeSecret joins the rolled words', () => {
    let i = 0; const r = () => [0, 0.5, 0.99][i++ % 3];
    assert.equal(makeSecret(r, 'en'), rollWords('en', (() => { let j = 0; return () => [0, 0.5, 0.99][j++ % 3]; })()).join(''));
});
