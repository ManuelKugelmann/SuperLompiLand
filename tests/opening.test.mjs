import test from 'node:test';
import assert from 'node:assert/strict';
import { OPENING, captionOf, openingSeen } from '../game/story/opening.js';

test('the beats run in order, start at once, end with no caption, and last about ten seconds', () => {
    const b = OPENING.beats;
    assert.equal(b[0].at, 0);
    for (let i = 1; i < b.length; i++) assert.ok(b[i].at > b[i - 1].at, b[i].id);
    assert.equal(b.at(-1).id, 'end');
    assert.equal(b.at(-1).caption, null);
    assert.ok(b.at(-1).at >= 8000 && b.at(-1).at <= 13000);
});

test('captions in both languages, with the hero named', () => {
    const brave = OPENING.beats.find(q => q.id === 'brave');
    assert.equal(captionOf(brave, 'de', 'Sharky'), 'Sharky hat keine Angst.');
    assert.equal(captionOf(brave, 'fr', 'Lompi'), "Lompi isn't scared.", 'unknown language: English');
    for (const q of OPENING.beats.slice(0, -1)) assert.ok(q.caption.de && q.caption.en, q.id);
});

test('seen once per save; blocked storage never traps a child in the story', () => {
    const store = new Map();
    const storage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
    assert.equal(openingSeen(storage), false);
    storage.setItem(OPENING.seenKey, '1');
    assert.equal(openingSeen(storage), true);
    assert.equal(openingSeen({ getItem() { throw new Error('blocked'); } }), true);
});
