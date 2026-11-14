import test from 'node:test';
import assert from 'node:assert/strict';
import { DOCKS, docksSpot, docksShare, freesCrab } from '../game/level/docks.js';
import { BIOMES, landmarkGroup } from '../game/level/biomes.js';
import { createField, ROUTE } from '../game/level/density.js';

const spot = docksSpot(), f = createField(1337);

test('the docks are under the harbour\'s landmark pier, at the surface', () => {
    const harbour = BIOMES.find(b => b.id === 'harbour');
    assert.ok(spot.x > harbour.from && spot.x < harbour.from + harbour.width);
    assert.equal(landmarkGroup(Math.floor(spot.x / DOCKS.chunk), DOCKS.chunk), 'pier', 'the pier is forced into this chunk column');
    assert.equal(spot.x % DOCKS.chunk, DOCKS.chunk / 2, 'its middle is the column\'s middle');
    assert.ok(spot.top > 0 && spot.bottom < 600);
});

test('they lie far off the calm route: everything in them is clear of the lane and of the hazard-free corridor', () => {
    for (let x = spot.x0; x <= spot.x1; x += 100) assert.ok(f.routeY(x) - spot.bottom > ROUTE.clear, `route at ${x}: ${Math.round(f.routeY(x))}`);
    for (const p of [spot.net, spot.crab]) {
        assert.ok(p.x > spot.x0 && p.x < spot.x1 && p.y > spot.top && p.y < spot.bottom);
        assert.ok(f.routeY(p.x) - p.y > ROUTE.clear + 100);
    }
    assert.ok(Math.hypot(spot.net.x - spot.crab.x, spot.net.y - spot.crab.y) > 300, 'the crab does not hang in the net');
    assert.ok(spot.ropes.some(x => Math.abs(x - spot.crab.x) < 1), 'it hangs in one of the ropes');
});

test('the murk is thickest under the deck and gone outside', () => {
    assert.equal(docksShare(spot, spot.x, 250), 1);
    assert.equal(docksShare(spot, spot.x0 - 300, 250), 0);
    assert.equal(docksShare(spot, spot.x, spot.bottom + 200), 0);
    const edge = docksShare(spot, spot.x0 - 100, 250);
    assert.ok(edge > 0.3 && edge < 0.7, 'it thins out at the sides');
});

test('a special close by frees the crab, and so does a nudge; from far away neither does', () => {
    assert.ok(freesCrab(spot, spot.crab.x - 300, spot.crab.y));
    assert.ok(!freesCrab(spot, spot.crab.x - 400, spot.crab.y));
    assert.ok(freesCrab(spot, spot.crab.x + 60, spot.crab.y, true));
    assert.ok(!freesCrab(spot, spot.crab.x + 200, spot.crab.y, true));
});
