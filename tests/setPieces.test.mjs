import test from 'node:test';
import assert from 'node:assert/strict';
import { SET_PIECES, ghostShip, pinnacleTop, descentStart } from '../game/level/setPieces.js';
import { stormSpan, stormShare } from '../game/level/weather.js';
import { BIOMES, floorY, isSea } from '../game/level/biomes.js';
import { createField, FIELD, ROUTE } from '../game/level/density.js';

test('the ghost ship stands in the middle of the storm, on the calm route', () => {
    const s = ghostShip(), { x0, x1 } = stormSpan(), f = createField(1337);
    assert.ok(s.x > x0 && s.x < x1 && isSea(s.x));
    assert.equal(stormShare(s.x), 1);
    assert.ok(Math.abs(f.routeY(s.x) - s.y) < 5, 'the route goes through it');
    assert.ok(s.keelY > s.y + ROUTE.halfWidth, 'its keel lies under the lane');
});

test('a pinnacle of rock carries it: solid from just under the keel down to the deep floor, a spire, with open sea around', () => {
    const s = ghostShip(), f = createField(1337);
    assert.ok(f.density(s.x, s.y) < FIELD.threshold, 'the lane through the hull is open water');
    for (let y = s.keelY + 260; y < floorY(s.x); y += 200) assert.ok(f.density(s.x, y) > FIELD.threshold, `rock under the ship at ${y}`);
    assert.ok(pinnacleTop(s.x + 800) > pinnacleTop(s.x) + 900, 'it falls away steeply');
    assert.equal(pinnacleTop(s.x + 4000), Infinity);
    // Beside the spire the sea is open again down to near the bottom.
    for (const dx of [-3200, 3200]) for (let y = 300; y < floorY(s.x + dx) - FIELD.seaBottom; y += 300) assert.ok(f.density(s.x + dx, y) < FIELD.threshold, `open at ${dx}, ${y}`);
});

test('in the trench the calm route goes down from the trench\'s start all the way to the grand nest, gently', () => {
    const f = createField(1337), trench = BIOMES.at(-1), nest = f.nests.at(-1), x0 = descentStart();
    assert.ok(x0 > trench.from && x0 < trench.from + 2000);
    assert.ok(f.routeY(x0) < 1500, 'it starts from about the depth of the coast');
    let prev = f.routeY(x0 + 400), steepest = 0;
    for (let x = x0 + 600; x < nest.x - 200; x += 200) {
        const y = f.routeY(x);
        assert.ok(y >= prev - 2, `always down, at ${x}`);
        steepest = Math.max(steepest, (y - prev) / 200);
        prev = y;
    }
    assert.ok(steepest < 0.75, `gentle: ${steepest.toFixed(2)}`);
    assert.ok(f.routeY((x0 + nest.x) / 2) > 1800, 'half way along it is already deep');
    assert.ok(Math.abs(f.routeY(nest.x) - (nest.y - ROUTE.aboveNest)) < 20, 'and it ends above the grand nest');
    assert.ok(SET_PIECES.descent.beacon[1] > 3000, 'the beacon is seen from far above');
});
