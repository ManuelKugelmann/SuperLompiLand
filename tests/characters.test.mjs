import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, getCharacter } from '../game/characters.js';
import { SPECIALS as SPECIAL_TABLE } from '../game/specials.js';
import { rotatedPageToGame, sizeFor, gameInsets, safeView, shapeOff, PICTURE } from '../game/orientationMath.js';

const SPECIALS = Object.keys(SPECIAL_TABLE);

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
        for (const key of ['thrust', 'maxSpeed', 'drag', 'turn', 'sink', 'armor', 'airGravity', 'airTurn', 'soft']) {
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

test('the picture fills the screen at any shape: no bars, ever', () => {
    assert.deepEqual(sizeFor(1920, 1080), { width: 1920, height: 1080 });
    assert.deepEqual(sizeFor(2340, 1080), { width: 2340, height: 1080 });      // a tall phone held sideways
    assert.deepEqual(sizeFor(1280, 800), { width: 1728, height: 1080 });       // 16:10
    assert.deepEqual(sizeFor(1024, 768), { width: 1440, height: 1080 });       // 4:3 tablet
    assert.deepEqual(sizeFor(800, 800), { width: PICTURE.minWidth, height: 1440 });   // square: more above and below
    assert.deepEqual(sizeFor(1080, 1920), { width: 1440, height: 2560 });      // an upright desktop window
    assert.deepEqual(sizeFor(4000, 1000), { width: 4320, height: 1080 });      // extremely wide: more to the sides
    assert.deepEqual(sizeFor(0, 0), { width: 1920, height: 1080 });
    for (const [w, h] of [[1366, 768], [812, 375], [915, 412], [500, 900], [3440, 1440], [1000, 999]]) {
        const s = sizeFor(w, h);
        assert.equal(s.width % 2, 0);
        assert.equal(s.height % 2, 0);
        assert.ok(Math.abs(s.width / s.height - w / h) < 0.004, `same shape as the screen for ${w}x${h}`);
        assert.ok(s.width >= PICTURE.minWidth && s.height >= PICTURE.height);
    }
});

test('safe-area insets follow the picture when it is shown rotated', () => {
    const page = { top: 47, right: 0, bottom: 34, left: 0 };       // a notched phone held upright
    assert.deepEqual(gameInsets(page, false, 2), { left: 0, top: 94, right: 0, bottom: 68 });
    assert.deepEqual(gameInsets(page, true, 2), { left: 94, top: 0, right: 68, bottom: 0 });   // the notch is at the picture's left
    assert.deepEqual(gameInsets({}, true), { left: 0, top: 0, right: 0, bottom: 0 });
});

test('the heads-up display fits whole and centred inside the safe area', () => {
    const none = safeView(1920, 1080, { left: 0, top: 0, right: 0, bottom: 0 });
    assert.deepEqual(none, { x: 0, y: 0, width: 1920, height: 1080, zoom: 1, scrollX: 0, scrollY: 0 });
    const v = safeView(2340, 1080, { left: 120, top: 0, right: 80, bottom: 40 });
    assert.equal(v.x, 120);
    assert.equal(v.width, 2140);
    assert.ok(v.zoom < 1 && v.width / v.zoom >= 2340 - 1e-6 && v.height / v.zoom >= 1080 - 1e-6, 'the whole layout is in view');
    assert.equal(v.scrollX + v.width / 2, 2340 / 2, 'centred on the layout');
});

test('shape difference: the same ratio is 0, an address bar is a little, a reshaped window is a lot', () => {
    assert.equal(shapeOff(1920, 1080, 960, 540), 0);
    assert.ok(shapeOff(812, 375, 812, 412) < 0.12);
    assert.ok(shapeOff(1920, 1080, 1000, 1000) > 0.5);
    assert.ok(Math.abs(shapeOff(1600, 900, 900, 1600) - shapeOff(900, 1600, 1600, 900)) < 1e-12);
});
