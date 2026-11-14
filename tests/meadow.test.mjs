import test from 'node:test';
import assert from 'node:assert/strict';
import { MEADOW, meadowSpot, eelAt, eelOut, createRay, stepRay } from '../game/level/meadow.js';
import { BIOMES } from '../game/level/biomes.js';
import { createField } from '../game/level/density.js';
import { rescueSpots } from '../game/rescues.js';

const s = meadowSpot(), f = createField(1337);

test('the eel meadow lies in the lagoon\'s quiet last stretch, away from nests and rescues', () => {
    const beach = BIOMES.find(b => b.id === 'beach');
    assert.ok(s.x0 > 90000 && s.x1 < beach.from + beach.width - 6000, `${Math.round(s.x0)} .. ${Math.round(s.x1)}`);
    for (const n of f.nests) assert.ok(n.x < s.x0 - 1500 || n.x > s.x1 + 1500, `nest at ${Math.round(n.x)}`);
    for (const r of rescueSpots()) assert.ok(r.x < s.x0 - 1500 || r.x > s.x1 + 1500, r.id);
});

test('the eels stand spread over the colony, each of its own height, never two in one place', () => {
    const xs = [];
    for (let i = 0; i < MEADOW.eels; i++) {
        const e = eelAt(i);
        assert.ok(e.x > s.x0 && e.x < s.x1);
        assert.ok(e.height >= MEADOW.eelHeight[0] && e.height <= MEADOW.eelHeight[1]);
        xs.push(e.x);
    }
    for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] > 15, `eels ${i - 1} and ${i}`);
});

test('an eel slips into its burrow fast when the fish is close, and comes out slowly when it has gone', () => {
    let out = 1;
    for (let t = 0; t < MEADOW.hide; t += 0.05) out = eelOut(out, MEADOW.shy - 10, 0.05);
    assert.ok(out < 0.05, 'hidden within its hiding time');
    assert.equal(eelOut(0, MEADOW.shy - 10, 0.05), 0, 'it stays in while the fish stays');
    let steps = 0;
    while (out < 1 && steps < 1000) { out = eelOut(out, MEADOW.shy + 10, 0.05); steps++; }
    assert.ok(Math.abs(steps * 0.05 - MEADOW.rise) < 0.2, `out again after ${(steps * 0.05).toFixed(2)} s`);
});

test('the ray rests until the fish comes near, glides away from it over the sand, and settles again inside its stretch', () => {
    const R = MEADOW.ray, ray = createRay(1000);
    assert.equal(stepRay(ray, R.wake + 50, 1, 0.1, 0, 5000), 0);
    assert.equal(ray.x, 1000, 'at rest');
    let top = 0, steps = 0, last = ray.x;
    do {
        const lift = stepRay(ray, 100, -1, 1 / 60, 0, 5000);      // the fish is to its west: it goes east
        assert.ok(ray.x >= last - 1e-6, 'away from the fish, never back');
        assert.ok(ray.x - last < R.speed / 60 + 1e-6, 'never faster than its speed');
        top = Math.max(top, lift); last = ray.x; steps++;
    } while (ray.t > 0 && steps < 2000);
    assert.ok(Math.abs(ray.x - (1000 + R.glide)) < 1, `glided ${Math.round(ray.x - 1000)} px`);
    assert.ok(Math.abs(top - R.lift) < 2, 'it rises over the sand in the middle of its glide');
    // At the end of its stretch it turns round rather than leave it.
    const edge = createRay(4800);
    stepRay(edge, 100, -1, 1 / 60, 0, 5000);
    assert.equal(edge.dir, -1);
});
