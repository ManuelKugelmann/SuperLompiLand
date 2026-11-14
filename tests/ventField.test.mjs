import test from 'node:test';
import assert from 'node:assert/strict';
import { VENT_FIELD, FINALE, ventSpot, chimneyAt, chimneyHeight, ventLift, ventCoins, finaleY, terraceTop } from '../game/level/ventField.js';
import { createField, ROUTE } from '../game/level/density.js';
import { BIOMES } from '../game/level/biomes.js';
import { nestSpots } from '../game/level/density.js';

test('the field lies at the trench end, before the grand nest, chimneys inside it in order', () => {
    const s = ventSpot(), trench = BIOMES.find(b => b.id === 'trench'), grand = Math.max(...nestSpots());
    assert.ok(s.x0 > trench.from && s.x1 < trench.from + trench.width);
    assert.ok(s.x1 < grand - 2000, 'the grand nest has its own screen');
    let prev = s.x0;
    for (let i = 0; i < VENT_FIELD.chimneys; i++) { const c = chimneyAt(i); assert.ok(c.x > prev && c.x < s.x1); prev = c.x; }
});

test('a chimney stands its full height unless its mouth would rise past the limit over the calm route', () => {
    const c = { height: 640 };
    assert.equal(chimneyHeight(c, 6000, 5000), 640);
    assert.equal(chimneyHeight(c, 5300, 5000), 5300 - 5000 - VENT_FIELD.clear);
    assert.equal(chimneyHeight(c, 5000 + VENT_FIELD.clear - 10, 5000), 0);
});

test('warm water lifts over a mouth, not beside it, not below it, and fades above the route', () => {
    const mouths = [{ x: 1000, y: 5600 }], route = 5000, o = { x: 0, y: 0 };
    assert.ok(ventLift(1000, 5300, mouths, route, o).y < -VENT_FIELD.lift * 0.9);
    assert.equal(ventLift(1000 + VENT_FIELD.halfWidth + 1, 5300, mouths, route, o).y, 0);
    assert.equal(ventLift(1000, 5700, mouths, route, o).y, 0);
    assert.equal(ventLift(1000, route - VENT_FIELD.reach - 1, mouths, route, o).y, 0);
    assert.ok(Math.abs(ventLift(1000, route - VENT_FIELD.reach + 50, mouths, route, o).y) < VENT_FIELD.lift * 0.4, 'gentle at its top');
});

test('coins hang in the column, lowest first, never above the lift', () => {
    const route = 5000, coins = ventCoins({ x: 1000, y: 5600 }, route);
    assert.equal(coins.length, VENT_FIELD.coins);
    for (let k = 1; k < coins.length; k++) assert.ok(coins[k].y < coins[k - 1].y);
    assert.ok(coins.every(c => c.y > route - VENT_FIELD.reach && c.x === 1000));
    assert.ok(ventCoins({ x: 0, y: route - 200 }, route).length < VENT_FIELD.coins, 'a short column holds fewer');
});

test('the finale: the last stretch of the route drops clearly, about 1:6, and never climbs', () => {
    const f = createField(1337), nest = f.nests.at(-1), s = ventSpot();
    const drop = f.routeY(nest.x) - f.routeY(nest.x - 15000);
    assert.ok(drop >= 2000 && drop <= 2500, `the last 15 000 px drop ${Math.round(drop)} px`);
    let steepest = 0;
    for (let x = s.x0; x < nest.x; x += 100) {
        const d = (f.routeY(x + 100) - f.routeY(x)) / 100;
        assert.ok(d >= -0.01, `never up, at ${x}`);
        steepest = Math.max(steepest, d);
    }
    assert.ok(steepest > 0.12 && steepest < 0.25, `about 1:6 (${steepest.toFixed(2)})`);
    assert.ok(Math.abs(f.routeY(nest.x) - (nest.y - ROUTE.aboveNest)) < 20, 'it ends above the grand nest');
    assert.equal(finaleY(s.x0 - 500, nest.x, 5000), 5000 - FINALE.drop);
    assert.equal(finaleY(nest.x + 500, nest.x, 5000), 5000);
});

test('the finale: every chimney stands on a terrace with its mouth just below the middle of the lane', () => {
    const f = createField(1337);
    for (let i = 0; i < VENT_FIELD.chimneys; i++) {
        const c = chimneyAt(i), route = f.routeY(c.x);
        let ground = route;
        while (f.density(c.x, ground) < 0.53 && ground < route + 3000) ground += 10;
        assert.ok(ground - route > ROUTE.halfWidth + 150 && ground - route < 950, `chimney ${i}: its terrace lies ${Math.round(ground - route)} px under the route`);
        const mouth = ground - chimneyHeight(c, ground, route);
        assert.ok(mouth - route > -150 && mouth - route < 420, `chimney ${i}: mouth ${Math.round(mouth - route)} px below the route (on screen)`);
        for (let y = route - ROUTE.halfWidth; y <= route + ROUTE.halfWidth; y += 40) assert.ok(f.density(c.x, y) < 0.53, `the lane is open over it, at ${y}`);
    }
    const s = ventSpot(), flat = x => 5000;
    assert.equal(terraceTop(s.x0 - 99999, flat), Infinity);
    assert.equal(terraceTop((s.x0 + s.x1) / 2, flat), 5000 + FINALE.shelf);
    assert.ok(terraceTop(s.x1 + FINALE.tail + 400, flat) > 5000 + FINALE.shelf + 900, 'past the last terrace the rock falls away');
});
