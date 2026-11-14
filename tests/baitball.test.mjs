import test from 'node:test';
import assert from 'node:assert/strict';
import { BAITBALL, baitballSlot, inBaitball } from '../game/level/baitball.js';
import { isSea } from '../game/level/biomes.js';
import { FIELD, createField } from '../game/level/density.js';
import { rescueSpots } from '../game/rescues.js';
import { bloomFields } from '../game/level/blooms.js';
import { weatherZones } from '../game/level/weather.js';
import { chapters } from '../game/journey.js';

const s = baitballSlot(), f = createField(1337);

test('the bait ball\'s slot lies in open water on the calm route, near the end of the open blue', () => {
    assert.ok(isSea(s.x0) && isSea(s.x1));
    const y = f.routeY(s.x);
    assert.ok(y > 200 && y < 900, `route there at ${Math.round(y)}`);
    for (const [dx, dy] of [[0, 0], [-s.radius * 0.7, 0], [s.radius * 0.7, 0], [0, -200], [0, s.radius * 0.7]]) assert.ok(f.density(s.x + dx, y + dy) < FIELD.threshold, 'open water inside it');
    assert.ok(inBaitball(s.x, y, f.routeY) && !inBaitball(s.x + s.radius + 10, y, f.routeY));
    assert.equal(s.radius, BAITBALL.radius);
});

test('nothing else stands in the slot: no rescue, bloom, current, storm, friend or event', () => {
    const clear = (x0, x1, what) => assert.ok(x1 < s.x0 || x0 > s.x1, what);
    for (const r of rescueSpots()) clear(r.x, r.x, r.id);
    for (const b of bloomFields()) clear(b.x0, b.x1, b.id);
    const w = weatherZones();
    clear(w.storm[0], w.storm[1], 'storm');
    for (const d of w.downs) clear(d[0], d[1], 'current');
    for (const c of chapters()) { if (c.friend) clear(c.x, c.x, c.id); if (c.event) clear(c.event.x, c.event.endX, c.event.id); }
});
