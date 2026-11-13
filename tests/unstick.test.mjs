import test from 'node:test';
import assert from 'node:assert/strict';
import { UNSTICK, hasRoom, popOut, wedged, Stillness } from '../game/level/unstick.js';
import { FIELD, createField } from '../game/level/density.js';
import { BIOMES, ABYSS, WORLD_WEST, WORLD_END, spotFor } from '../game/level/biomes.js';
import { hash } from '../game/level/terrain.js';

const field = createField(1337), density = field.density;
const R = 56, BIG = 98;        // Lompi normal and puffed

test('open water has room; rock and the air above the water do not', () => {
    assert.equal(hasRoom(density, FIELD.spawn.x, FIELD.spawn.y, R), true);
    assert.equal(hasRoom(density, 0, FIELD.maxDepth + 3000, R), false);
    assert.equal(hasRoom(density, 0, 20, R), false, 'never above the waterline');
});

test('a body with room stays where it is', () => {
    const p = popOut(density, FIELD.spawn.x, FIELD.spawn.y, R);
    assert.deepEqual(p, { x: FIELD.spawn.x, y: FIELD.spawn.y, moved: false });
});

test('dropped anywhere, inside rock or not, the body pops into open water close by', () => {
    let inRock = 0, worst = 0;
    for (let i = 0; i < 600; i++) {
        const x = WORLD_WEST + hash(i, 1, 7) * (WORLD_END - WORLD_WEST), y = 100 + hash(i, 2, 7) * 4200;
        const stuck = density(x, y) > FIELD.threshold;
        const p = popOut(density, x, y, R);
        assert.ok(p, `no way out at ${x | 0},${y | 0}`);
        assert.ok(hasRoom(density, p.x, p.y, R), `still overlapping at ${x | 0},${y | 0}`);
        assert.ok(p.y - R >= UNSTICK.surface, 'under water, not on dry land');
        if (stuck) { inRock++; worst = Math.max(worst, Math.hypot(p.x - x, p.y - y)); }
    }
    assert.ok(inRock > 100, `sampled enough rock: ${inRock}`);
    assert.ok(worst < 6000, `farthest pop: ${worst | 0} px`);
});

test('a body just inside the rock comes out on its own side, not through the wall', () => {
    let checked = 0;
    for (let i = 0; i < 6000 && checked < 60; i++) {
        const x = hash(i, 3, 9) * 30000, y = 400 + hash(i, 4, 9) * 3000;
        const d = density(x, y);
        if (d < FIELD.threshold + 0.005 || d > FIELD.threshold + 0.03) continue;      // shallow in the rock
        const p = popOut(density, x, y, 20);
        checked++;
        const far = Math.hypot(p.x - x, p.y - y);
        assert.ok(far < 400, `shallow overlap popped ${far | 0} px away at ${x | 0},${y | 0}`);
        // Half way between start and target the rock is no deeper than at the start: no wall was crossed.
        assert.ok(density((x + p.x) / 2, (y + p.y) / 2) <= d + 0.02, `crossed rock at ${x | 0},${y | 0}`);
    }
    assert.ok(checked >= 30, `checked ${checked}`);
});

test('every place a player can appear has room: start, nests, named spots — also puffed up', () => {
    const places = [{ ...FIELD.spawn, name: 'start' },
        ...field.nests.map(n => ({ x: n.x, y: n.y - 240, name: `nest ${n.index}` })),
        ...[...BIOMES.map(b => b.id), 'abyss'].map(id => ({ ...spotFor(id), name: id }))];
    for (const place of places) {
        const p = popOut(density, place.x, place.y, BIG);
        assert.ok(p && hasRoom(density, p.x, p.y, BIG), `${place.name}: room for a puffed player`);
        assert.ok(Math.hypot(p.x - place.x, p.y - place.y) < 1700, `${place.name}: close to where it was meant`);
    }
    assert.ok(hasRoom(density, FIELD.spawn.x, FIELD.spawn.y, BIG), 'the start pool needs no correction');
    assert.ok(Math.abs(spotFor('abyss').x - ABYSS.x) < 1);
});

test('stillness: pushing against rock without moving for two seconds counts as stuck', () => {
    const s = new Stillness();
    let fired = 0;
    for (let i = 0; i < 119; i++) if (s.step(1000 / 60, true, 0.1, true)) fired++;
    assert.equal(fired, 0, 'not yet');
    assert.equal(s.step(1000 / 60, true, 0.1, true) || s.step(1000 / 60, true, 0.1, true), true);
    // Resting, moving or swimming free never triggers it.
    for (const [pushing, speed, touching] of [[false, 0, true], [true, 5, true], [true, 0.1, false]]) {
        const t = new Stillness();
        for (let i = 0; i < 400; i++) assert.equal(t.step(1000 / 60, pushing, speed, touching), false);
    }
});

test('wedged means rock on opposite sides; a floor or a single wall is not', () => {
    const T = FIELD.threshold;
    const floor = (x, y) => (y > 100 ? T + 0.2 : T - 0.2);                 // rock below y = 100
    const slot = (x, y) => (Math.abs(x) > 40 ? T + 0.2 : T - 0.2);         // an 80 px wide vertical slot
    const corner = (x, y) => (y > 100 || x > 60 ? T + 0.2 : T - 0.2);      // floor meets a wall
    assert.equal(wedged(floor, 0, 50, 56), false);
    assert.equal(wedged(slot, 0, 50, 56), true);
    assert.equal(wedged(corner, 10, 50, 56), false, 'a corner still leaves a way out');
    assert.equal(wedged(() => T - 0.2, 0, 500, 56), false);
});
