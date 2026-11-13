import test from 'node:test';
import assert from 'node:assert/strict';
import { EMOTES, EMOTE_ICON, isEmote, colorsFor, PLAYER_COLORS, RateLimit } from '../net/social.js';

test('every emote has an icon; anything else is rejected', () => {
    for (const e of EMOTES) { assert.ok(isEmote(e)); assert.ok(EMOTE_ICON[e]); }
    for (const bad of ['', 'chat', 'hello world', null, 3, {}, '__proto__']) assert.equal(isEmote(bad), false);
});

test('all clients agree on colours, and up to 4 players never share one', () => {
    const ids = ['zed', 'amy', 'kim', 'bob'];
    const a = colorsFor(ids), b = colorsFor([...ids].reverse());
    for (const id of ids) assert.equal(a.get(id), b.get(id));
    assert.equal(new Set(a.values()).size, 4);
    for (const c of a.values()) assert.ok(PLAYER_COLORS.includes(c));
});

test('duplicates and empty ids are ignored', () => {
    const m = colorsFor(['a', 'a', '', null, 'b']);
    assert.deepEqual([...m.keys()], ['a', 'b']);
});

test('rate limit: one emote per gap, per player', () => {
    const r = new RateLimit(700);
    assert.equal(r.allow('me', 0), true);
    assert.equal(r.allow('me', 300), false);
    assert.equal(r.allow('you', 300), true, 'separate per player');
    assert.equal(r.allow('me', 700), true);
});
