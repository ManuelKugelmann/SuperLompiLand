import test from 'node:test';
import assert from 'node:assert/strict';
import { WHALE_SHARK, whaleSharkSlot, SHARK, sharkAt, slipAt } from '../game/level/whaleShark.js';
import { isSea } from '../game/level/biomes.js';
import { FIELD, ROUTE, createField } from '../game/level/density.js';
import { stormSpan, downwellings } from '../game/level/weather.js';
import { bloomFields } from '../game/level/blooms.js';
import { rescueSpots } from '../game/rescues.js';
import { worldMap, SET_PIECE_KINDS } from '../game/level/worldMap.js';

const s = whaleSharkSlot(), f = createField(1337);

test('the whale shark has a clear stretch of the calm route in the ship graveyard\'s sea, east of the storm', () => {
    assert.ok(s && s.x1 - s.x0 === WHALE_SHARK.length);
    assert.ok(isSea(s.x0) && isSea(s.x1) && s.x0 > stormSpan().x1);
    for (let x = s.x0; x <= s.x1; x += 250) {
        const y = f.routeY(x);
        assert.ok(Math.abs(y - ROUTE.seaY) < 5, `the route runs level near the surface at ${x}: ${Math.round(y)}`);
        assert.ok(f.density(x, y) < FIELD.threshold);
    }
});

test('nothing else lies in it: no current, bloom, rescue or other set piece', () => {
    const clear = (x0, x1, what) => assert.ok(x1 < s.x0 - WHALE_SHARK.keep + 1 || x0 > s.x1 + WHALE_SHARK.keep - 1, what);
    for (const d of downwellings()) clear(d.down, d.up, 'current');
    for (const b of bloomFields()) clear(b.x0, b.x1, b.id);
    for (const r of rescueSpots()) clear(r.x, r.x, r.id);
    const map = worldMap();
    assert.ok(map.features.some(ft => ft.kind === 'whaleshark' && ft.x0 === s.x0 && ft.x1 === s.x1), 'it is on the world map');
    for (const ft of map.features) if (SET_PIECE_KINDS.includes(ft.kind) && ft.kind !== 'whaleshark') clear(ft.x0, ft.x1, ft.kind);
});

test('the shark cruises to and fro inside its stretch, along the route below it', () => {
    const slot = whaleSharkSlot(), routeY = () => 470, o = {};
    for (let t = 0; t < 400; t += 3.7) {
        sharkAt(t, routeY, o);
        assert.ok(o.x >= slot.x0 && o.x <= slot.x1);
        assert.ok(o.y > 470 && Math.abs(o.dir) === 1);
    }
});

test('its slipstream carries a fish along its back the way it swims, and nowhere else', () => {
    const add = {}, routeY = () => 470;
    let pose = null;
    for (let t = 0; t < 400 && !pose; t += 1) { const p = sharkAt(t, routeY); if (Math.abs(p.vx) > 1) pose = p; }
    const lane = pose.y - SHARK.length * SHARK.aspect / 2 - SHARK.lane.over;
    slipAt(pose.x, lane, pose, add);
    assert.ok(add.x * pose.dir > SHARK.lane.push * 0.8);
    slipAt(pose.x, pose.y + 400, pose, add); assert.equal(add.x, 0);
    slipAt(pose.x + pose.dir * (SHARK.length + 600), lane, pose, add); assert.equal(add.x, 0);
});
