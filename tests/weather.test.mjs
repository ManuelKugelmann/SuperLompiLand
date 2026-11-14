import test from 'node:test';
import assert from 'node:assert/strict';
import { WEATHER, stormSpan, stormShare, stormAt, downwelling, downAt, detour, weatherNear } from '../game/level/weather.js';
import { BIOMES, isSea } from '../game/level/biomes.js';
import { createField, ROUTE, FIELD } from '../game/level/density.js';

test('the storm lies over open sea, builds up at its edges and is full in the middle', () => {
    const { x0, x1 } = stormSpan(), mid = (x0 + x1) / 2;
    assert.ok(isSea(x0) && isSea(x1) && isSea(mid));
    assert.equal(stormShare(x0 - 10), 0);
    assert.equal(stormShare(x1 + 10), 0);
    assert.equal(stormShare(mid), 1);
    assert.ok(stormShare(x0 + WEATHER.storm.ramp / 2) > 0.4 && stormShare(x0 + WEATHER.storm.ramp / 2) < 0.6);
});

test('under the storm the top layer runs back west; below it the sea is calm', () => {
    const { x0, x1 } = stormSpan(), mid = (x0 + x1) / 2;
    for (let t = 0; t < 8; t += 0.3) {
        const v = stormAt(mid, 40, t);
        assert.ok(v.x < 0 && v.x >= -WEATHER.storm.push - 1e-9 && v.y === 0);
    }
    assert.deepEqual({ ...stormAt(mid, WEATHER.storm.depth + 5, 1) }, { x: 0, y: 0 });
    assert.deepEqual({ ...stormAt(x0 - 500, 40, 1) }, { x: 0, y: 0 });
});

test('the downwelling pulls down in one column and lifts in the next; a sideways stroke leaves it', () => {
    const { down, up } = downwelling(), y = 1000;
    assert.ok(isSea(down) && isSea(up) && up > down);
    assert.ok(Math.abs(downAt(down, y).y - WEATHER.down.speed) < 1e-9, 'full speed down in the middle');
    assert.ok(Math.abs(downAt(up, y).y + WEATHER.down.speed) < 1e-9, 'full speed up in the other');
    assert.equal(downAt(down + WEATHER.down.halfWidth + 1, y).y, 0, 'out of it sideways');
    assert.equal(downAt(down, WEATHER.down.top - 10).y, 0, 'the surface above is free');
    assert.equal(downAt((down + up) / 2, y).y, 0, 'calm between the columns');
});

test('the calm route goes deep under the storm and between the columns, and is back near the surface elsewhere', () => {
    const f = createField(1337), { x0, x1 } = stormSpan(), { down, up } = downwelling();
    assert.ok(Math.abs(f.routeY((x0 + x1) / 2) - WEATHER.storm.routeY) < 5);
    assert.ok(f.routeY((x0 + x1) / 2) > WEATHER.storm.depth + ROUTE.halfWidth, 'the whole lane lies under the churned layer');
    assert.ok(Math.abs(f.routeY((down + up) / 2) - WEATHER.down.routeY) < 5);
    const blue = BIOMES.find(b => b.id === 'blue');
    assert.ok(Math.abs(f.routeY(blue.from + blue.width * 0.68) - ROUTE.seaY) < 5, 'near the surface again where the whale waits');
    assert.equal(detour(blue.from + blue.width * 0.68).k, 0);
    // The lane is open water all the way through both.
    for (let x = down - 2000; x < up + 2000; x += 60) assert.ok(f.density(x, f.routeY(x)) < FIELD.threshold);
    for (let x = x0 - 500; x < x1 + 500; x += 60) assert.ok(f.density(x, f.routeY(x)) < FIELD.threshold);
});

test('the route passes through the middle of each column on its way down and up', () => {
    const f = createField(1337), { down, up } = downwelling();
    for (const c of [down, up]) {
        const y = f.routeY(c);
        assert.ok(y > WEATHER.down.top + 200 && y < WEATHER.down.routeY - 200, `half way at ${c}: ${Math.round(y)}`);
    }
});

test('weather is near around the storm and the columns, and nowhere else', () => {
    const { x0, x1 } = stormSpan(), { down, up } = downwelling();
    for (const x of [x0 - 3000, (x0 + x1) / 2, x1 + 3000, down - 3000, (down + up) / 2, up + 3000]) assert.ok(weatherNear(x, 4000), `near at ${x}`);
    assert.ok(!weatherNear(0, 4000));
    assert.ok(!weatherNear((up + x0) / 2, 4000), 'not on the kelp island between them');
});
