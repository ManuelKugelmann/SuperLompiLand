import test from 'node:test';
import assert from 'node:assert/strict';
import { HUNTER, hunterSpots, spotNear, startHunter, stepHunter, sightBlocked, freeHeading, findCover } from '../game/level/hunter.js';
import { BIOMES } from '../game/level/biomes.js';

const DT = 1 / 60;
const run = (fishAt, sees = () => true, maxS = 30) => {
    const h = startHunter(fishAt(0));
    let t = 0, shown = false;
    while (h.phase !== 'done' && t < maxS) { const f = fishAt(t); stepHunter(h, f, sees(t), DT); t += DT; if (h.phase === 'chase') shown = true; }
    return { h, t, shown };
};

test('hunters pass at fixed places inside their areas, each met once', () => {
    const spots = hunterSpots();
    assert.ok(spots.length >= 2, 'only where rock cover exists (reef, kelp)');
    for (const s of spots) { const b = BIOMES.find(q => q.id === s.biome); assert.ok(s.x > b.from && s.x < b.from + b.width, s.id); }
    const s = spots[0], done = new Set();
    assert.equal(spotNear(s.x + HUNTER.trigger - 10, done).id, s.id);
    assert.equal(spotNear(s.x - HUNTER.trigger - 10, done), null, 'not before its window');
    assert.equal(spotNear(s.x + HUNTER.window - 10, done).id, s.id, 'still while cover is looked for');
    assert.equal(spotNear(s.x + HUNTER.window + 10, done), null);
    done.add(s.id);
    assert.equal(spotNear(s.x, done), null);
    assert.deepEqual(hunterSpots({ ...HUNTER, enabled: false }), []);
});

test('it is announced first and sets off from outside the picture', () => {
    const h = startHunter({ x: 5000, y: 900 });
    assert.equal(h.phase, 'warn');
    assert.ok(Math.hypot(h.x - 5000, h.y - 900) > 1200, 'outside a 1920 px wide view');
    for (let t = 0; t < HUNTER.warnS - 0.1; t += DT) stepHunter(h, { x: 5000, y: 900 }, true, DT);
    assert.equal(h.phase, 'warn');
});

test('a fish that stays put is reached; then the hunter swims off and is gone', () => {
    const { h } = run(() => ({ x: 5000, y: 900 }));
    assert.equal(h.result, 'caught');
    assert.equal(h.phase, 'done');
});

test('behind rock it loses sight and gives up soon', () => {
    const { h, t } = run(() => ({ x: 5000, y: 900 }), () => false);
    assert.equal(h.result, 'escaped');
    assert.ok(t < HUNTER.warnS + HUNTER.blindS + 6);
});

test('a fish that swims on fast and dodges lasts the chase out', () => {
    // Away at 9.5 px per step, weaving up and down.
    const { h } = run(t => ({ x: 5000 + 570 * t, y: 900 + Math.sin(t * 2.2) * 380 }));
    assert.equal(h.result, 'escaped');
});

test('the chase never lasts longer than its time', () => {
    const { t } = run(t => ({ x: 5000 + 600 * t, y: 900 }), () => true, 60);
    assert.ok(t < HUNTER.warnS + HUNTER.chaseS + HUNTER.gone / (HUNTER.leaveSpeed - 600) + 1);
});

test('rock between two points blocks the view', () => {
    const wall = x => x > 450 && x < 550;      // rock is thicker than the sampling step
    assert.equal(sightBlocked(wall, 0, 0, 1000, 0), true);
    assert.equal(sightBlocked(wall, 0, 0, 400, 0), false);
    assert.equal(sightBlocked(() => false, 0, 0, 1000, 300), false);
});

test('it never swims into rock or above the surface, also when the fish hides behind a wall', () => {
    // A wall right of x = 5600 from y = 600 down, the surface at y = 300; the fish sits behind the wall.
    const world = { solid: (x, y) => x > 5600 && x < 5900 && y > 600, top: () => 300 };
    const fish = { x: 6100, y: 900 }, h = startHunter(fish, HUNTER, world);
    assert.ok(h.y >= 300 + HUNTER.under, 'it sets off under the surface');
    for (let t = 0; t < 25 && h.phase !== 'done'; t += DT) {
        stepHunter(h, fish, !sightBlocked(world.solid, h.x, h.y, fish.x, fish.y), DT, HUNTER, world);
        assert.ok(!world.solid(h.x, h.y), 'in rock at ' + Math.round(h.x) + ',' + Math.round(h.y));
        assert.ok(h.y > 300, 'above the surface');
    }
    assert.equal(h.phase, 'done');
});

test('the free heading is the wanted one in open water and turns off before rock', () => {
    const open = { solid: () => false, top: () => -Infinity };
    assert.equal(freeHeading(0, 0, 0.3, open), 0.3);
    assert.notEqual(freeHeading(0, 0, 0, { solid: x => x > 200, top: () => -Infinity }), 0);
});

test('cover: a place ahead with rock between it and where the hunter comes from, else none', () => {
    // A rock shelf above and behind a pocket 600 px ahead: from behind and above, the pocket is hidden.
    const shelf = (x, y) => x > 5200 && x < 5700 && y > 500 && y < 700;
    const c = findCover(shelf, 5000, 900);
    assert.ok(c, 'found');
    assert.ok(c.x > 5000 && !shelf(c.x, c.y));
    assert.ok(sightBlocked(shelf, c.x + HUNTER.from[0], c.y + HUNTER.from[1], c.x, c.y));
    assert.equal(findCover(() => false, 5000, 900), null, 'open water: nowhere to hide, so no hunt');
});
