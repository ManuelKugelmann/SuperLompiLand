import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTAINERS, containerSpan, containerField } from '../game/level/containers.js';
import { BIOMES } from '../game/level/biomes.js';
import { FIELD, ROUTE, createField } from '../game/level/density.js';
import { weatherZones, WEATHER } from '../game/level/weather.js';
import { rescueSpots } from '../game/rescues.js';
import { bloomFields } from '../game/level/blooms.js';
import { ghostShip, SET_PIECES } from '../game/level/setPieces.js';

const f = createField(1337), span = containerSpan(), boxes = containerField(f.routeY);

test('the container field drifts off the harbour at the end of the kelp island, clear of nests, rescues and everything else on the map', () => {
    const kelp = BIOMES.find(bi => bi.id === 'kelp'), harbour = BIOMES.find(bi => bi.id === 'harbour');
    assert.ok(span.x0 > kelp.from + kelp.width * 0.8 && span.x1 < harbour.from, `${Math.round(span.x0)} .. ${Math.round(span.x1)}`);
    for (const n of f.nests) assert.ok(n.x < span.x0 - 1500 || n.x > span.x1 + 1500, `nest at ${Math.round(n.x)}`);
    const w = weatherZones(), clear = (x0, x1, what) => assert.ok(x1 < span.x0 || x0 > span.x1, what);
    clear(w.storm[0] - WEATHER.storm.ramp, w.storm[1] + WEATHER.storm.ramp, 'storm');
    clear(ghostShip().x - SET_PIECES.ship.clear, ghostShip().x + SET_PIECES.ship.clear, 'ghost ship');
    for (const d of w.downs) clear(d[0], d[1], 'current');
    for (const b of bloomFields()) clear(b.x0, b.x1, b.id);
    for (const r of rescueSpots()) clear(r.x, r.x, r.id);
});

test('five containers hang in open water around the route; two lie on it and the fish swims through them along their coins', () => {
    assert.equal(boxes.length, CONTAINERS.boxes.length);
    const through = boxes.filter(b => b.through);
    assert.equal(through.length, 2);
    for (const b of boxes) {
        assert.ok(b.y > 60 && f.density(b.x, b.y) < FIELD.threshold, `${b.id} hangs in open water at ${Math.round(b.y)}`);
        assert.equal(b.coins.length, b.through ? CONTAINERS.coins : 0);
    }
    for (const b of through) {
        assert.ok(Math.abs(b.y - f.routeY(b.x)) < 60, 'on the route');
        assert.ok(Math.abs(b.tilt) < 0.25, 'nearly level');
        for (const c of b.coins) {
            assert.ok(Math.abs(c.y - f.routeY(c.x)) < ROUTE.halfWidth * 0.6, 'its coins lie in the lane');
            // Inside the box: along its axis, within its length.
            const dx = c.x - b.x, dy = c.y - b.y, along = dx * Math.cos(b.tilt) + dy * Math.sin(b.tilt), across = -dx * Math.sin(b.tilt) + dy * Math.cos(b.tilt);
            assert.ok(Math.abs(along) <= CONTAINERS.size[0] / 2 && Math.abs(across) < 1);
        }
    }
    // No two containers overlap.
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) assert.ok(Math.hypot(boxes[i].x - boxes[j].x, boxes[i].y - boxes[j].y) > CONTAINERS.size[1] * 1.4, `${i} and ${j}`);
});
