import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTAINERS, containerSpan, containerField, containerCoins, landsOnRoof, roofBounce } from '../game/level/containers.js';
import { BIOMES } from '../game/level/biomes.js';
import { FIELD, createField } from '../game/level/density.js';
import { rescueSpots } from '../game/rescues.js';

const f = createField(1337), span = containerSpan(), boxes = containerField(), coins = containerCoins(f.routeY), [len, h] = CONTAINERS.size;

test('the container field floats off the harbour at the end of the kelp island, clear of nests and rescues', () => {
    const kelp = BIOMES.find(bi => bi.id === 'kelp'), harbour = BIOMES.find(bi => bi.id === 'harbour');
    assert.ok(span.x0 > kelp.from + kelp.width * 0.8 && span.x1 < harbour.from, `${Math.round(span.x0)} .. ${Math.round(span.x1)}`);
    for (const n of f.nests) assert.ok(n.x < span.x0 - 1500 || n.x > span.x1 + 1500, `nest at ${Math.round(n.x)}`);
    for (const r of rescueSpots()) assert.ok(r.x < span.x0 - 500 || r.x > span.x1 + 500, r.id);
});

test('the containers lie half sunk in the surface; one lies on top of another, out of the water', () => {
    const floating = boxes.filter(b => !b.stacked), stacked = boxes.filter(b => b.stacked);
    assert.ok(floating.length >= 4 && stacked.length === 1);
    for (const b of floating) {
        // Its top is above the waterline, its bottom below: about a third under water (the pictures' wet band).
        assert.ok(b.y - h / 2 < 0 && b.y + h / 2 > h * 0.3 && b.y + h / 2 < h * 0.45, `${b.id}: middle ${Math.round(b.y)} under the surface`);
        assert.ok(Math.abs(b.tilt) < 0.2);
        assert.ok(f.density(b.x, 80) < FIELD.threshold, 'open water at the surface there');
    }
    const top = stacked[0], below = boxes[CONTAINERS.boxes[boxes.indexOf(top)].on];
    assert.ok(top.y + h / 2 < 0, 'the stacked one is out of the water');
    assert.ok(Math.abs(top.x - below.x) < len * 0.5 && top.y < below.y - h * 0.8, 'and rests on the one below it');
    assert.equal(boxes.filter(b => b.open).length, 1);
    for (let i = 0; i < floating.length; i++) for (let j = i + 1; j < floating.length; j++) assert.ok(Math.abs(floating[i].x - floating[j].x) > len, 'no two floating ones overlap');
});

test('coins lead up from the calm route, hang in a row under each floating container and run through the open one', () => {
    const floating = boxes.filter(b => !b.stacked && !b.open), open = boxes.find(b => b.open);
    assert.equal(coins.length, CONTAINERS.trail + floating.length * CONTAINERS.under + CONTAINERS.through);
    const trail = coins.slice(0, CONTAINERS.trail);
    assert.ok(Math.abs(trail[0].y - f.routeY(trail[0].x)) < 200, 'the trail begins at the route');
    for (let i = 1; i < trail.length; i++) assert.ok(trail[i].y < trail[i - 1].y && trail[i].x > trail[i - 1].x, 'and leads up and on');
    for (const c of coins) assert.ok(c.y > 40 && f.density(c.x, c.y) < FIELD.threshold, `coin in open water under the surface at ${Math.round(c.x)}, ${Math.round(c.y)}`);
    const through = coins.filter(c => Math.abs(c.x - open.x) <= len / 2 && c.y < open.y + h / 2);
    assert.equal(through.length, CONTAINERS.through, 'a line through the open one\'s sunken half');
    for (const b of floating) assert.equal(coins.filter(c => Math.abs(c.x - b.x) < len / 2 && Math.abs(c.y - (b.y + h / 2 + CONTAINERS.underGap)) < 1).length, CONTAINERS.under);
});

test('a leap that comes down on a floating container\'s roof bounces off; from the side, from below or on the stacked one nothing happens', () => {
    const b = boxes.find(o => !o.stacked && !o.open), roof = b.y - h / 2, R = CONTAINERS.roof;
    assert.ok(landsOnRoof(b, 0, b.x, roof, 8), 'falling onto the middle of the roof');
    assert.ok(landsOnRoof(b, 25, b.x, roof + 25, 8), 'the roof rides on the swell');
    assert.ok(!landsOnRoof(b, 0, b.x, roof, -8), 'rising through it from below: no');
    assert.ok(!landsOnRoof(b, 0, b.x + len * 0.6, roof, 8), 'beside it: no');
    assert.ok(!landsOnRoof(b, 0, b.x, roof + 200, 8), 'in the water beside its wall: no');
    assert.ok(!landsOnRoof(boxes.find(o => o.stacked), 0, b.x, roof, 8), 'the stacked one has no roof to land on');
    assert.equal(roofBounce(20), -20 * R.spring);
    assert.equal(roofBounce(2), -R.least, 'never a feeble bounce');
});
