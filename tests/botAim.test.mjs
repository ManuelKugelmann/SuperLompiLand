import test from 'node:test';
import assert from 'node:assert/strict';
import { BOT, createBot, botAim } from '../game/controls/botAim.js';

const DT = 1 / 60, open = { route: () => 1000, solid: () => false };
const swim = (world, s, speed = 500, start = { x: 0, y: 1000 }) => {
    const bot = createBot(), fish = { ...start };
    for (let t = 0; t < s; t += DT) {
        const a = botAim(bot, fish, world, DT);
        assert.ok(Math.abs(Math.hypot(a.x, a.y) - 1) < 1e-9);
        const nx = fish.x + a.x * speed * DT, ny = fish.y + a.y * speed * DT;
        if (!world.solid(nx, ny)) { fish.x = nx; fish.y = ny; }
    }
    return fish;
};

test('in open water it swims east along the route, weaving a little', () => {
    const fish = swim(open, 20);
    assert.ok(fish.x > 8000, 'makes way: ' + Math.round(fish.x));
    assert.ok(Math.abs(fish.y - 1000) <= BOT.weave + 40);
});

test('a fish far off the route comes back to it', () => {
    const fish = swim(open, 8, 500, { x: 0, y: 2200 });
    assert.ok(Math.abs(fish.y - 1000) < BOT.weave + 80);
});

test('it goes round a block of rock on the route', () => {
    const world = { route: () => 1000, solid: (x, y) => x > 2000 && x < 2600 && y > 700 && y < 1300 };
    assert.ok(swim(world, 25).x > 4000);
});

test('walled in ahead it backs off and gets out over the top', () => {
    // A pocket open only upward and to the west: a wall ahead and a floor below.
    const world = { route: () => 1000, solid: (x, y) => (x > 2000 && x < 2300 && y > 300) || (y > 1200 && x > 1200 && x < 2300) };
    assert.ok(swim(world, 60).x > 2600);
});
