import test from 'node:test';
import assert from 'node:assert/strict';
import { ROUTE, FIELD, createField } from '../game/level/density.js';
import { spotsOf } from '../game/level/worldMap.js';

// The layer file imports nothing of Phaser but BonusCoins' texture helper: its pure parts are checked through a copy of the rule.
const TREAT = { coins: 5, half: 240, rise: 120 };
const SHAPES = [u => -Math.sin(Math.PI * u), u => Math.sin(2 * Math.PI * u) * 0.6, u => 0.5 - u];
const f = createField(1337);

test('every coin figure of the rhythm lies inside the calm lane, in open water', () => {
    const treats = spotsOf('treat');
    assert.ok(treats.length >= 100);
    treats.forEach((s, i) => {
        for (let k = 0; k < TREAT.coins; k++) {
            const u = k / (TREAT.coins - 1), x = s.x0 - TREAT.half + u * TREAT.half * 2, y = f.routeY(x) + SHAPES[i % 3](u) * TREAT.rise;
            assert.ok(Math.abs(y - f.routeY(x)) < ROUTE.halfWidth, 'in the lane');
            assert.ok(y > 60 && f.density(x, y) < FIELD.threshold, `open water at ${Math.round(x)}, ${Math.round(y)}`);
        }
    });
});
