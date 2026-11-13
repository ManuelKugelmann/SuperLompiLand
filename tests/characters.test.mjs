import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, getCharacter } from '../game/characters.js';
import { rotatedPageToGame } from '../game/orientationMath.js';

const SPECIALS = ['puff', 'dash', 'leap', 'shield', 'pulse'];

test('every character is complete and has a known special', () => {
    const ids = new Set();
    for (const c of CHARACTERS) {
        assert.ok(!ids.has(c.id), `duplicate id ${c.id}`);
        ids.add(c.id);
        assert.ok(c.name && c.blurb.de && c.blurb.en, `${c.id}: name and blurb`);
        assert.ok(SPECIALS.includes(c.special), `${c.id}: special ${c.special}`);
        assert.ok(['swim', 'pulse', 'sway', 'paddle', undefined].includes(c.anim), `${c.id}: anim ${c.anim}`);
        const n = c.states.normal;
        assert.ok(n && n.key && n.width > 0 && n.radius > 0 && n.air > 0, `${c.id}: normal state`);
        assert.ok(n.radius * 2 <= n.width, `${c.id}: collision circle fits inside the sprite`);
    }
    assert.ok(CHARACTERS[0].states.inflated, 'Lompi can inflate');
});

test('movement multipliers stay in a sane range', () => {
    for (const c of CHARACTERS) {
        for (const key of ['thrust', 'maxSpeed', 'drag', 'turn', 'sink', 'armor', 'airGravity', 'airTurn']) {
            if (c[key] === undefined) continue;
            assert.ok(c[key] > 0 && c[key] <= 3, `${c.id}.${key} = ${c[key]}`);
        }
    }
});

test('getCharacter falls back to the first character', () => {
    assert.equal(getCharacter('shark').id, 'shark');
    assert.equal(getCharacter('nope'), CHARACTERS[0]);
    assert.equal(getCharacter(undefined), CHARACTERS[0]);
});

test('rotated canvas: page points map to the right game corners', () => {
    // 1920x1080 game shown rotated 90° clockwise, filling a 540x960 portrait page.
    const rect = { left: 0, top: 0, width: 540, height: 960 };
    const near = (p, x, y) => assert.ok(Math.abs(p.x - x) < 1e-6 && Math.abs(p.y - y) < 1e-6, JSON.stringify(p));
    near(rotatedPageToGame(270, 480, rect, 1920, 1080), 960, 540);   // centre
    near(rotatedPageToGame(540, 0, rect, 1920, 1080), 0, 0);         // page top-right = game top-left
    near(rotatedPageToGame(0, 0, rect, 1920, 1080), 0, 1080);        // page top-left = game bottom-left
    near(rotatedPageToGame(0, 960, rect, 1920, 1080), 1920, 1080);   // page bottom-left = game bottom-right
});
